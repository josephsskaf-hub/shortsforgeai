import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { generateScenes } from '@/lib/runway'
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

const SUPPORTED_DURATIONS = [30, 45, 60] as const
type Duration = (typeof SUPPORTED_DURATIONS)[number]

// Fast Mode credit cost. Kept low on purpose — Pexels search is free
// and TTS + Creatomate are the only paid pieces.
const FAST_MODE_CREDIT_COST = 1

function clipCountForDuration(d: Duration): number {
  // Stock clips are usually >10s, but we still ask for N distinct clips so
  // Creatomate has variety. We cap at 6 to avoid hammering Pexels.
  return Math.max(2, Math.min(6, Math.ceil(d / 10)))
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

    // Step 1 — Generate cinematic scene descriptions + matching stock-search
    // keywords. Push #128 — each scene now carries both a cinematic
    // `description` (for the visual model) AND a tight `searchKeywords`
    // string (for Pexels). Searching with the prose description was
    // returning wildly wrong footage (e.g. "pyramids egypt" prompt →
    // photographer clip) because the prose opens with framing filler
    // like "A lone photographer crouches…".
    let scenes: Awaited<ReturnType<typeof generateScenes>>
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
    // explicit search keywords (NOT the cinematic prose), falling back to
    // the curated stockLibrary so we always return SOMETHING even if
    // PEXELS_API_KEY is missing or a search returns 0 results.
    const clipUrls: string[] = await Promise.all(
      scenes.map(async (scene, idx) => {
        const pexelsUrl = await getPexelsVideoForScene(scene.searchKeywords, scene.description)
        if (pexelsUrl) return pexelsUrl
        // For library fallback prefer the keyword query — its tag-matching
        // also does poorly on cinematic prose openers.
        const query = scene.searchKeywords || scene.description
        const lib = pickLibraryClips(query, 1, idx)
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
    console.log(
      `[generate-fast] OK user=${user.id.slice(0, 8)} clips=${filtered.length} duration=${duration}s`
    )

    // Client expects `scenes` to be a string array of descriptions for the
    // result-page recap UI — flatten before serializing.
    return NextResponse.json({
      mode: 'fast',
      generationId,
      prompt,
      duration,
      scenes: scenes.map((s) => s.description),
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
