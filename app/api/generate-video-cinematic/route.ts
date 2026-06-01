// Push #315 — Cinematic Mode: fal.ai Wan 2.1 AI video generation.
// Submits each scene to fal.ai queue (async), returns request IDs immediately.
// Client polls /api/cinematic-clip-status until all clips are ready, then
// hands off to /api/compose exactly like Fast Mode. Cost: 3 credits.
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { generateScenes, shortCaptionFromVoiceover } from '@/lib/runway'
import { parseUserScript } from '@/lib/scriptParser'
import { fal } from '@fal-ai/client'

export const maxDuration = 60

const CINEMATIC_CREDIT_COST = 30

// fal.ai model — #366 switched Wan 2.5 -> Seedance 1.5 Pro (commercial). Same
// queue API + same { video: { url } } output shape. Cheaper (~$0.13/clip @ 720p
// 5s NO audio vs Wan $0.25/clip), faster (~30-45s/clip), higher quality.
// Fallback: revert this constant + the input block to Wan if needed.
const FAL_MODEL = 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video'

// Cap clips at 4 to bound fal cost (~$0.25/clip @ 5s 720p) -> ~$1.00/video.
function clipCountForDuration(d: number): number {
  return Math.max(2, Math.min(5, Math.ceil(d / 9)))
}

async function submitToFal(prompt: string): Promise<string | null> {
  const falKey = process.env.FAL_KEY
  if (!falKey) return null

  try {
    fal.config({ credentials: falKey })
    const { request_id } = await fal.queue.submit(FAL_MODEL, {
      input: {
        prompt,
        aspect_ratio: '9:16',
        resolution: '720p',
        duration: '5',
        // #366 — Seedance generates its own dialogue/foley by default; we add our
        // own TTS narration in compose, so keep the AI clips SILENT (also ~halves
        // the per-clip cost: $1.2 vs $2.4 per 1M video tokens).
        generate_audio: false,
      },
    })
    return request_id ?? null
  } catch (err) {
    console.error('[cinematic] fal.ai submit error:', err)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.FAL_KEY) {
      return NextResponse.json(
        { error: 'Cinematic mode is not configured. Please contact support.' },
        { status: 500 }
      )
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
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

    const duration = Number(body.duration) || 45
    const clipCount = clipCountForDuration(duration)

    // Upfront credit balance check (deduction happens in compose/status)
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('video_credits')
      .eq('id', user.id)
      .single()

    if (profileErr && profileErr.code !== 'PGRST116') {
      console.error('[cinematic] credit fetch failed:', profileErr.message)
    }
    const balance = profile?.video_credits ?? 0
    if (balance < CINEMATIC_CREDIT_COST) {
      return NextResponse.json(
        { error: `Cinematic Mode needs ${CINEMATIC_CREDIT_COST} credits. You have ${balance}.`, needed: CINEMATIC_CREDIT_COST, balance },
        { status: 402 }
      )
    }

    // Parse script for verbatim mode
    const parsedScript = parseUserScript(prompt)
    const verbatim = parsedScript.hasMarkers && parsedScript.segments.length > 0

    // Build scenes
    let scenes: { description: string; voiceover: string; caption: string; stockSearchQuery?: string }[]

    if (verbatim) {
      scenes = parsedScript.segments.slice(0, 5).map((seg) => ({
        description: seg.pexelsQuery,
        voiceover: seg.voiceover,
        caption: shortCaptionFromVoiceover(seg.voiceover || seg.pexelsQuery),
        stockSearchQuery: seg.pexelsQuery,
      }))
    } else {
      const generated = await generateScenes(prompt.slice(0, 1200), clipCount)
      scenes = generated.map((s) => ({
        description: s.description,
        voiceover: s.voiceover ?? '',
        caption: s.caption ?? shortCaptionFromVoiceover(s.description),
        stockSearchQuery: s.stockSearchQuery,
      }))
    }

    // Submit all scenes to fal.ai in parallel
    const falRequestIds = await Promise.all(
      scenes.map((scene) => {
        // Build a cinematic prompt for fal.ai from the scene description + voiceover
        const visualPrompt = scene.stockSearchQuery || scene.description
        const cinematic = `${visualPrompt}, cinematic 9:16 vertical video, YouTube Shorts style, high quality`
        return submitToFal(cinematic)
      })
    )

    // Check if at least one submission succeeded
    const validIds = falRequestIds.filter((id): id is string => id !== null)
    if (validIds.length === 0) {
      return NextResponse.json(
        { error: 'Could not submit clips to AI generator. Please try again.' },
        { status: 502 }
      )
    }

    const voiceoverScript = verbatim && parsedScript.narration
      ? parsedScript.narration
      : scenes.map((s) => s.voiceover).filter(Boolean).join(' ')

    const generationId = randomUUID()

    console.log(
      `[cinematic] submitted ${validIds.length}/${scenes.length} clips to fal.ai user=${user.id.slice(0, 8)} generationId=${generationId}`
    )

    return NextResponse.json({
      mode: 'cinematic_ai',
      generationId,
      prompt,
      duration,
      scenes: scenes.map((s) => s.description),
      scene_captions: scenes.map((s) => s.caption),
      voiceover_script: voiceoverScript,
      fal_request_ids: falRequestIds, // null for failed submissions
      verbatim,
      speed: parsedScript.speed,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[cinematic] unexpected error:', msg)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
