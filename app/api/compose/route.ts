import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildCreatomateSource,
  generateTTS,
  pollCreatomateRender,
  scaleVoiceoverScript,
  submitCreatomateRender,
  targetWordCount,
  uploadVoiceoverToSupabase,
  validateAndFallbackClipUrls,
} from '@/lib/compose'
import { fetchUserPlan } from '@/lib/plan'

export const maxDuration = 60

// Push #064 — durations bumped to 30 / 45 / 60 in lockstep with
// /api/generate-video. Legacy 10 / 50 kept here for backward
// compatibility with any in-flight requests from the old client.
const SUPPORTED_DURATIONS = [10, 30, 45, 50, 60] as const
type Quality = 'fast' | 'basic' | 'basic_ai' | 'pro'

interface ComposeBody {
  generationId?: string
  clip_urls?: string[]
  voiceover_script?: string
  scene_captions?: string[]
  duration?: number
  topic?: string
  quality?: string
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service is not configured.' },
        { status: 500 }
      )
    }
    if (!process.env.CREATOMATE_API_KEY) {
      return NextResponse.json(
        { error: 'Render service is not configured.' },
        { status: 500 }
      )
    }
    // Push #049 — fail fast if the service-role key is missing. Without
    // it the voiceover upload cannot reach Supabase storage and we'd
    // burn an OpenAI TTS call on a job we can't finish.
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[compose] SUPABASE_SERVICE_ROLE_KEY is not configured — refusing to start render.')
      return NextResponse.json(
        { error: 'Voiceover storage is not configured. Please contact support.' },
        { status: 500 }
      )
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('[compose] NEXT_PUBLIC_SUPABASE_URL is not configured.')
      return NextResponse.json(
        { error: 'Storage backend is not configured.' },
        { status: 500 }
      )
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: ComposeBody
    try {
      body = (await req.json()) as ComposeBody
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const clipUrls = Array.isArray(body.clip_urls)
      ? body.clip_urls.filter((u) => typeof u === 'string' && u.trim().length > 0)
      : []
    if (clipUrls.length === 0) {
      return NextResponse.json({ error: 'clip_urls is required.' }, { status: 400 })
    }

    // Push #145 — black-screen fix.
    // Validate every clip URL is actually reachable BEFORE handing the
    // timeline to Creatomate. A dead Pexels URL on the visual track
    // renders as a black tail with audio (the reported bug). The helper
    // swaps unreachable URLs for a curated library fallback so every
    // timeline slot has guaranteed video coverage.
    const topicHint = (body.topic ?? '').toString().slice(0, 200)
    let validatedClipUrls: string[]
    try {
      validatedClipUrls = await validateAndFallbackClipUrls(clipUrls, topicHint)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[compose] clip URL validation threw (continuing with raw URLs):', msg)
      validatedClipUrls = clipUrls
    }
    if (validatedClipUrls.length === 0) {
      console.error('[compose] no usable clip URLs after validation — refusing to render.')
      return NextResponse.json(
        { error: 'No usable video clips for this render. Please try again.' },
        { status: 502 }
      )
    }

    const voiceoverScript = (body.voiceover_script ?? '').toString().trim()
    if (!voiceoverScript) {
      return NextResponse.json({ error: 'voiceover_script is required.' }, { status: 400 })
    }

    const sceneCaptions = Array.isArray(body.scene_captions)
      ? body.scene_captions
          .map((c) => (typeof c === 'string' ? c.trim() : ''))
          .filter((c) => c.length > 0)
      : []

    const requestedDuration = Number(body.duration) || 45
    const duration = (SUPPORTED_DURATIONS as readonly number[]).includes(requestedDuration)
      ? requestedDuration
      : 45

    const quality: Quality = ((): Quality => {
      const q = (body.quality ?? 'basic_ai').toString()
      return q === 'fast' || q === 'basic' || q === 'pro' ? q : 'basic_ai'
    })()

    // Push #087 — Cinematic-tier renders (anything other than 'fast') must
    // come from a Pro user. Fast Mode renders skip the gate so Free + Basic
    // users can still produce videos via the Pexels pipeline.
    // Push #088 — Cinematic also requires a cinematic_token to have been
    // reserved upstream. /api/generate-video already does the consume on
    // the way in, so by the time we reach /api/compose the user paid for
    // the render. We do NOT decrement again here. We only verify the
    // upstream gate held (plan === pro) as defense in depth.
    if (quality !== 'fast') {
      const plan = await fetchUserPlan(supabase, user.id)
      if (!plan.isPro) {
        return NextResponse.json(
          {
            error: 'Cinematic mode requires the Pro plan.',
            currentPlan: plan.tier,
            upgrade: '/pricing',
          },
          { status: 403 }
        )
      }
    }

    // Step 1 — Scale the voiceover script to the right word count.
    let scaledScript: string
    try {
      scaledScript = await scaleVoiceoverScript(voiceoverScript, targetWordCount(duration))
      if (!scaledScript) scaledScript = voiceoverScript
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[compose] script scaling failed:', msg)
      // Non-fatal — fall back to the raw script.
      scaledScript = voiceoverScript
    }

    // Step 2 — Generate TTS.
    console.log(
      `[compose] voiceover generation started: user=${user.id.slice(0, 8)} script_words=${scaledScript.split(/\s+/).filter(Boolean).length} duration=${duration}s`,
    )
    let audioBuffer: Buffer
    try {
      audioBuffer = await generateTTS(scaledScript)
      console.log(
        `[compose] TTS response received: bytes=${audioBuffer.length} mime=audio/mpeg`,
      )
    } catch (err) {
      // Surface the FULL error object so OpenAI-side issues (rate limit,
      // quota, auth) are diagnosable without redeploying.
      console.error('[compose] TTS failed:', err instanceof Error
        ? JSON.stringify({ name: err.name, message: err.message, stack: err.stack?.split('\n').slice(0, 3).join(' | ') })
        : String(err))
      return NextResponse.json(
        { error: 'Voiceover generation failed. Please try again.' },
        { status: 502 }
      )
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      console.error('[compose] TTS produced an empty buffer — refusing to upload.')
      return NextResponse.json(
        { error: 'Voiceover generation returned no audio. Please try again.' },
        { status: 502 }
      )
    }

    // Step 3 — Upload TTS to Supabase storage.
    let voiceoverUrl: string
    try {
      voiceoverUrl = await uploadVoiceoverToSupabase(user.id, audioBuffer)
      console.log(`[compose] voiceover stored at: ${voiceoverUrl}`)
    } catch (err) {
      // Surface FULL error object — name, message, stack head — so the
      // root cause (bucket missing, RLS, network) is visible in Vercel
      // logs. Never log the service key itself.
      console.error('[compose] voiceover upload failed:', err instanceof Error
        ? JSON.stringify({ name: err.name, message: err.message, stack: err.stack?.split('\n').slice(0, 3).join(' | ') })
        : String(err))
      return NextResponse.json(
        { error: 'Could not store the voiceover. Please try again.' },
        { status: 502 }
      )
    }

    // Step 4 — Build the Creatomate source.
    //
    // Push #132 — per-scene captions are now the single source of truth for
    // on-screen text. analyze-idea (and /api/generate-video-fast) populate
    // `scene_captions` with ≤8 word readable paraphrases of each scene's
    // own voiceover line, so the narration the TTS reads and the caption
    // the viewer sees come from the SAME source string per scene. When
    // sceneCaptions is non-empty we pass an empty `voiceoverScript` to
    // buildCreatomateSource — its existing caption pipeline (lib/compose.ts)
    // falls back to sceneCaptions in that case, giving us one caption slot
    // per scene instead of arbitrary 7-word slices of the full script.
    //
    // When sceneCaptions is empty (legacy clients), we still pass the
    // scaled script so the chunker can recover a caption strip.
    const haveSceneCaptions = sceneCaptions.length > 0
    console.log(
      '[compose] scenes:',
      JSON.stringify(
        sceneCaptions.map((caption, i) => ({
          scene: i + 1,
          voiceover: scaledScript, // shared TTS source — per-scene split not available at this layer
          caption,
        })),
      ),
    )
    console.log('[compose] captions being sent:', JSON.stringify(sceneCaptions))
    console.log(
      `[compose] caption source: ${haveSceneCaptions ? 'per-scene scene_captions' : 'chunked voiceover_script (fallback)'} count=${haveSceneCaptions ? sceneCaptions.length : 'derived'}`,
    )

    let source: Record<string, unknown>
    try {
      source = buildCreatomateSource({
        clipUrls: validatedClipUrls,
        voiceoverUrl,
        voiceoverScript: haveSceneCaptions ? '' : scaledScript,
        sceneCaptions,
        duration,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[compose] source build failed:', msg)
      return NextResponse.json(
        { error: `Could not assemble the render: ${msg}` },
        { status: 500 }
      )
    }

    // Step 5 — Submit to Creatomate.
    let renderId: string
    try {
      renderId = await submitCreatomateRender(source)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[compose] Creatomate submit failed:', msg)
      return NextResponse.json(
        { error: 'Render service rejected the job. Please try again.' },
        { status: 502 }
      )
    }

    // Best-effort sanity check — confirm the render actually exists.
    try {
      await pollCreatomateRender(renderId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[compose] post-submit poll warning:', msg)
    }

    return NextResponse.json({
      render_id: renderId,
      quality,
      duration,
      voiceover_url: voiceoverUrl,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[compose] unexpected error:', msg)
    return NextResponse.json(
      { error: 'Something went wrong while preparing the render.' },
      { status: 500 }
    )
  }
}
