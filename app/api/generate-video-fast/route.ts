import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { generateScenes } from '@/lib/runway'
import type { Scene } from '@/lib/runway'
import { getPexelsVideoForScene } from '@/lib/pexels'
import { pickLibraryClips } from '@/lib/stockLibrary'

export const maxDuration = 60

// Push #084 — Fast Mode: cheap stock-footage + TTS pipeline.
//
// This endpoint mirrors /api/generate-video's request shape but skips
// Runway entirely. For each generated scene description it picks a
// portrait HD clip from Pexels (with the curated stockLibrary as a
// safety net), then returns clip URLs synchronously — the client jumps
// straight to /api/compose without polling. Target unit cost is
// ~$0.01-0.05 per video.

// Push #208 — removed 30s option, added 90s. 30s replaced by 45s minimum.
const SUPPORTED_DURATIONS = [45, 60, 90] as const
type Duration = (typeof SUPPORTED_DURATIONS)[number]

// Fast Mode credit cost. Kept low on purpose — Pexels search is free
// and TTS + Creatomate are the only paid pieces.
const FAST_MODE_CREDIT_COST = 1

function clipCountForDuration(d: Duration): number {
  // Stock clips are usually >10s, but we still ask for N distinct clips so
  // Creatomate has variety. We cap at 9 to support 90s videos.
  return Math.max(2, Math.min(9, Math.ceil(d / 10)))
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('[generate-fast] OPENAI_API_KEY is not configured')
      return NextResponse.json(
        { error: 'AI service is not configured. Please contact support.' },
        { status: 500 }
      )
    }
    // Push #087 — fail fast if the downstream renderer isn't configured.
    // /api/compose will hard-error on this same check; surfacing it here
    // saves an OpenAI scene-generation call for a job we can't finish.
    if (!process.env.CREATOMATE_API_KEY) {
      console.error('[generate-fast] CREATOMATE_API_KEY is not configured')
      return NextResponse.json(
        { error: 'Video assembly is not configured — please contact support.' },
        { status: 500 }
      )
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'You must be signed in to generate a video.' },
        { status: 401 }
      )
    }

    let body: { prompt?: string; duration?: number }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const prompt = (body.prompt ?? '').trim()
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 })
    }
    if (prompt.length > 5000) {
      return NextResponse.json({ error: 'Prompt is too long (5000 chars max).' }, { status: 400 })
    }

    const requestedDuration = Number(body.duration) || 45
    const duration: Duration = SUPPORTED_DURATIONS.includes(requestedDuration as Duration)
      ? (requestedDuration as Duration)
      : 45

    const clipCount = clipCountForDuration(duration)

    // Upfront credit balance check. Deduction happens in /api/compose/status
    // when the final mp4 succeeds.
    {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('video_credits')
        .eq('id', user.id)
        .single()
      if (profileErr && profileErr.code !== 'PGRST116') {
        console.error('[generate-fast] credit balance fetch failed:', profileErr.message)
      }
      const balance = profile?.video_credits ?? 0
      if (balance < FAST_MODE_CREDIT_COST) {
        return NextResponse.json(
          { error: 'Not enough credits.', needed: FAST_MODE_CREDIT_COST, balance },
          { status: 402 }
        )
      }
    }

    // Step 1 — Generate scenes: each scene has a cinematic description
    // (for Runway) and explicit searchKeywords (for Pexels stock search).
    // Push #128 — previously, searchKeywords were the first 3 words of the
    // cinematic description, causing totally wrong footage ("A lone photographer"
    // for a pyramid prompt). Now GPT returns topic-specific keywords.
    let scenes: Scene[]
    try {
      scenes = await generateScenes(prompt.slice(0, 400), clipCount)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[generate-fast] scene generation failed:', msg)
      return NextResponse.json(
        { error: 'Failed to plan scenes. Please try a different prompt.' },
        { status: 500 }
      )
    }

    // Step 2 — Resolve each scene to a Pexels HD portrait clip using the
    // topic-specific searchKeywords (NOT the cinematic description).
    // Curated stockLibrary is the fallback so we always return something.
    const clipUrls: string[] = await Promise.all(
      scenes.map(async (scene, idx) => {
        // Push #211 — pass stockSearchQuery as primary premium query
        const pexelsUrl = await getPexelsVideoForScene(scene.searchKeywords, scene.description, scene.stockSearchQuery)
        if (pexelsUrl) return pexelsUrl
        const lib = pickLibraryClips(scene.searchKeywords || scene.description, 1, idx)
        return lib[0]?.url ?? ''
      })
    )

    const filtered = clipUrls.filter((u) => typeof u === 'string' && u.length > 0)
    if (filtered.length === 0) {
      return NextResponse.json(
        { error: 'No stock footage could be sourced. Please try a different topic.' },
        { status: 502 }
      )
    }

    const generationId = randomUUID()

    // Push #132 — assemble the caption/voiceover pipeline. Each scene now
    // carries the SAME source string for both: the per-scene `voiceover` is
    // the narration TTS will read, and the per-scene `caption` is its
    // ≤8-word readable on-screen paraphrase. We log both so any future
    // drift between captions and narration is debuggable from server logs.
    const sceneCaptions = scenes.map((s) => s.caption)
    const voiceoverScript = scenes
      .map((s) => s.voiceover)
      .filter((v) => typeof v === 'string' && v.trim().length > 0)
      .join(' ')

    console.log(
      '[generate-fast] scenes:',
      JSON.stringify(
        scenes.map((s, i) => ({
          scene: i + 1,
          voiceover: s.voiceover,
          caption: s.caption,
        })),
      ),
    )

    console.log(
      `[generate-fast] OK user=${user.id.slice(0, 8)} clips=${filtered.length} duration=${duration}s captions=${sceneCaptions.length}`
    )

    // Client expects `scenes` to be a string array of descriptions for the
    // result-page recap UI — flatten before serializing. We also surface
    // `scene_captions` and `voiceover_script` so the compose request can
    // be assembled with the per-scene caption pipeline as the single source
    // of truth.
    return NextResponse.json({
      mode: 'fast',
      generationId,
      prompt,
      duration,
      scenes: scenes.map((s) => s.description), // client still gets string array
      scene_captions: sceneCaptions,
      voiceover_script: voiceoverScript,
      clip_urls: filtered,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[generate-fast] unexpected error:', msg)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
