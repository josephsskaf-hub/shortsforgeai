import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { generateScenes, shortCaptionFromVoiceover } from '@/lib/runway'
import type { Scene } from '@/lib/runway'
import { getPexelsVideoForScene, getPexelsVideoForExactQuery } from '@/lib/pexels'
import { pickLibraryClips } from '@/lib/stockLibrary'
import { ensureAccessibleUrl } from '@/lib/videoCache'
import { parseUserScript } from '@/lib/scriptParser'

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

    // Push #235 — Verbatim mode. If the user authored the script with explicit
    // `[Pexels: QUERY]` markers, honor them literally: each marker becomes a
    // scene whose footage query and spoken line come straight from the user.
    // We do NOT send the script to GPT in this case — the whole point is that
    // the user already chose the perfect clip and wrote the exact narration.
    const parsedScript = parseUserScript(prompt)
    const verbatim = parsedScript.hasMarkers && parsedScript.segments.length > 0

    // Step 1 — Build scenes.
    //   - Verbatim: one scene per [Pexels: ...] marker, query + narration as-is.
    //   - Otherwise: GPT plans scenes (each with a cinematic description and
    //     topic-specific Pexels keywords). Push #235 widened the prompt window
    //     from 400 → 1200 chars so longer briefs keep their topic fidelity.
    let scenes: Scene[]
    if (verbatim) {
      scenes = parsedScript.segments.slice(0, 12).map((seg) => ({
        description: seg.pexelsQuery,
        searchKeywords: seg.pexelsQuery,
        stockSearchQuery: seg.pexelsQuery,
        negativeVisualPrompt: '',
        scenePurpose: 'EXPLANATION',
        visualIntent: 'User-specified footage',
        visualCategory: 'general_documentary',
        voiceover: seg.voiceover,
        caption: shortCaptionFromVoiceover(seg.voiceover || seg.pexelsQuery),
      }))
      console.log(
        `[generate-fast] VERBATIM mode: ${scenes.length} user-specified clip(s); speed=${parsedScript.speed ?? 'default'}`,
      )
    } else {
      try {
        scenes = await generateScenes(prompt.slice(0, 1200), clipCount)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[generate-fast] scene generation failed:', msg)
        return NextResponse.json(
          { error: 'Failed to plan scenes. Please try a different prompt.' },
          { status: 500 }
        )
      }
    }

    // Step 2 — Resolve each scene to a clip URL.
    //
    // Push #215 — Removed STOCKLIB_PRIORITY mode (Push #213/214).
    // Root cause: ALL Pexels CDN URLs (videos.pexels.com/video-files/...) return
    // HTTP 403 when Creatomate fetches them server-side. NASA SVS also 403s.
    // The only stockLibrary URLs that work server-side are Cloudinary demo.
    // Priority mode was forcing broken URLs → always 403 for rocket topics.
    //
    // Fix: always try Pexels API first (PEXELS_API_KEY must be set in Vercel
    // for this to return real results). The visual category + slug filter from
    // Push #212 (pexels.ts) still applies to reject abstract/wrong footage.
    // Fallback: stockLibrary (Cloudinary demo clips — wrong content but renders).

    const clipUrls: string[] = await Promise.all(
      scenes.map(async (scene, idx) => {
        const cat = scene.visualCategory ?? ''
        const libQuery = cat && cat !== 'general_documentary'
          ? cat.replace(/_/g, ' ')
          : (scene.searchKeywords || scene.description)

        // Final fallback: stockLibrary (Cloudinary demo — always server-accessible)
        // In verbatim mode the user's own query routes the fallback too, so even
        // the safety net stays on-topic.
        const lib = pickLibraryClips(verbatim ? scene.stockSearchQuery : libQuery, 1, idx)
        const fallbackUrl = lib[0]?.url ?? ''

        // Try Pexels API first (requires PEXELS_API_KEY env var).
        // Push #216 — Pexels CDN URLs are proxied through Supabase Storage so
        // Creatomate can download them. ensureAccessibleUrl() downloads the clip
        // from Pexels server-side (our Vercel is authorized) and caches it in
        // the "stock-videos" Supabase bucket, then returns the public Supabase URL.
        //
        // Push #235 — verbatim mode searches the user's EXACT query directly,
        // bypassing the category allowedQueries override that would otherwise
        // swap "SpaceX Starship launch closeup" for a generic "rocket fire night"
        // (which surfaced a candle clip). Non-verbatim keeps the GPT/category path.
        const pexelsUrl = verbatim
          ? await getPexelsVideoForExactQuery(scene.stockSearchQuery)
          : await getPexelsVideoForScene(
              scene.searchKeywords,
              scene.description,
              scene.stockSearchQuery,
              scene.voiceover,
            )
        if (pexelsUrl) {
          const cachedUrl = await ensureAccessibleUrl(pexelsUrl, fallbackUrl)
          console.log(`[clip] scene=${idx + 1} category=${cat} CACHED url=${cachedUrl.slice(0, 80)}`)
          return cachedUrl
        }

        // No Pexels result — use Cloudinary stockLibrary fallback
        console.log(`[clip] scene=${idx + 1} category=${cat} STOCKLIB url=${fallbackUrl.slice(0, 80)}`)
        return fallbackUrl
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
    // Push #235 — in verbatim mode the spoken text is the user's own narration
    // (markers/directives already stripped by the parser). Prefer it so what is
    // narrated is exactly what the user wrote; otherwise join the scene lines.
    const sceneJoinedVoiceover = scenes
      .map((s) => s.voiceover)
      .filter((v) => typeof v === 'string' && v.trim().length > 0)
      .join(' ')
    const voiceoverScript =
      verbatim && parsedScript.narration ? parsedScript.narration : sceneJoinedVoiceover

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
      // Push #235 — when the user authored the script verbatim, tell the client
      // so it forwards this narration (not the analyze-idea brief) and the
      // requested TTS speed to /api/compose.
      verbatim,
      speed: parsedScript.speed,
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
