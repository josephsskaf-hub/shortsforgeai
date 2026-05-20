import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildCreatomateSource,
  generateTTS,
  getMp3DurationSeconds,
  pollCreatomateRender,
  scaleVoiceoverScript,
  submitCreatomateRender,
  targetWordCount,
  transcribeWordTimings,
  uploadVoiceoverToSupabase,
  type WordTiming,
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
  // Push #180 — viewer-facing captions toggle. Accepts 'on' | 'off' (or
  // boolean for older clients). Default is 'on' because captions are the
  // single biggest driver of retention on Shorts.
  captions?: string | boolean
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

    // Push #180 — captions toggle. Accept 'on'/'off' strings and booleans
    // (older clients). Anything we can't parse defaults to ON because
    // captions are the single biggest retention driver on Shorts.
    const captionsEnabled: boolean = ((): boolean => {
      const raw = body.captions
      if (typeof raw === 'boolean') return raw
      if (typeof raw === 'string') {
        const v = raw.trim().toLowerCase()
        if (v === 'off' || v === 'false' || v === '0' || v === 'no') return false
      }
      return true
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
    //
    // Push #180 — pass duration through so TTS speed is computed to land
    // the audio inside the user's chosen video length. Without this the
    // audio defaults to speed=1.0, leaving silence at the end of longer
    // videos and clipping the final word on shorter ones.
    console.log(
      `[compose] voiceover generation started: user=${user.id.slice(0, 8)} script_words=${scaledScript.split(/\s+/).filter(Boolean).length} duration=${duration}s`,
    )
    let audioBuffer: Buffer
    try {
      audioBuffer = await generateTTS(scaledScript, { targetSeconds: duration })
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

    // Drive the render off the REAL voiceover length. computeTTSSpeed only
    // nudges the pace toward the target (and is clamped), so the audio still
    // over/undershoots — and a fixed-duration render then cut the voiceover
    // off AND dropped the last few seconds of word-by-word captions (their
    // cutoff is derived from totalDuration). Measuring the MP3 and rendering
    // to its true length fixes both. Falls back to the target if the parse
    // fails so the render never depends on the measurement.
    let renderDuration = duration
    const measuredAudio = getMp3DurationSeconds(audioBuffer)
    if (measuredAudio && measuredAudio >= 5 && measuredAudio <= 120) {
      renderDuration = measuredAudio
      console.log(
        `[compose] measured TTS audio duration: ${measuredAudio}s (target was ${duration}s) — rendering to actual length`,
      )
    } else {
      console.warn(
        `[compose] could not measure TTS audio duration (got ${measuredAudio}); falling back to target ${duration}s`,
      )
    }

    // Step 2.5 — Push #180 — word-level caption timings from Whisper. We
    // run this BEFORE the upload (so the buffer is still in memory) and
    // strictly best-effort: if Whisper hiccups, `wordTimings` stays null
    // and the renderer falls back to segment captions. Skipped entirely
    // when the viewer turned captions off — saves the Whisper round-trip.
    let wordTimings: WordTiming[] | null = null
    if (captionsEnabled) {
      try {
        wordTimings = await transcribeWordTimings(audioBuffer)
        const count = Array.isArray(wordTimings) ? wordTimings.length : 0
        console.log(`[compose] word-level captions: words=${count} (whisper-1, granularity=word)`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('[compose] word-level caption transcription failed (falling back to segments):', msg)
        wordTimings = null
      }
    } else {
      console.log('[compose] captions disabled by client — skipping Whisper transcription')
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
        clipUrls,
        voiceoverUrl,
        voiceoverScript: haveSceneCaptions ? '' : scaledScript,
        sceneCaptions,
        duration: renderDuration,
        wordTimings,
        captionsEnabled,
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
      duration: renderDuration,
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
