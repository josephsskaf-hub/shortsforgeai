import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildCreatomateSource,
  estimateMp3DurationSeconds,
  generateTTS,
  mapWhisperTimingsToSegments,
  pollCreatomateRender,
  scaleVoiceoverScript,
  submitCreatomateRender,
  targetWordCount,
  transcribeTTSWithTimestamps,
  uploadVoiceoverToSupabase,
} from '@/lib/compose'
import { buildCaptionSegments } from '@/lib/openai'
import { fetchUserPlan } from '@/lib/plan'

export const maxDuration = 60

// Push #064 — durations bumped to 30 / 45 / 60 in lockstep with
// /api/generate-video. Legacy 10 / 50 kept here for backward
// compatibility with any in-flight requests from the old client.
// Push #234 — added 90: the client offers 45/60/90, and without 90 here a
// 90s request silently coerced to 45 → the script was sized for 45s and the
// final video came out ~half the requested length.
const SUPPORTED_DURATIONS = [10, 30, 45, 50, 60, 90] as const

// Push #234 — how far the measured narration may stray from the requested
// duration before we re-synthesize the TTS at an adjusted speed to pull it
// back in line. ±3s matches the product tolerance.
const DURATION_TOLERANCE_SECONDS = 3
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

    // Push #158 — measure the REAL narration length so captions key to the
    // actual audio, not the requested duration (which assumed 2.5 wps).
    let realAudioDuration = estimateMp3DurationSeconds(audioBuffer)
    console.log(
      `[compose] estimated TTS duration: ${realAudioDuration.toFixed(1)}s (requested ${duration}s)`,
    )

    // Push #234 — corrective pass. The final video length tracks the audio
    // length (see buildCreatomateSource), so if the first narration drifts more
    // than the tolerance from the requested duration we re-synthesize once at an
    // adjusted speed. duration scales as 1/speed, so speed = measured/requested
    // pulls the length toward the target (clamped to a natural band in
    // generateTTS). This is best-effort: any failure, or a result that isn't
    // actually closer, keeps the original audio so compose never regresses.
    if (
      realAudioDuration > 4 &&
      Math.abs(realAudioDuration - duration) > DURATION_TOLERANCE_SECONDS
    ) {
      const correctiveSpeed = realAudioDuration / duration
      console.log(
        `[compose] duration off by ${(realAudioDuration - duration).toFixed(1)}s — re-synthesizing at speed=${correctiveSpeed.toFixed(3)}`,
      )
      try {
        const retryBuffer = await generateTTS(scaledScript, correctiveSpeed)
        if (retryBuffer && retryBuffer.length > 0) {
          const retryDuration = estimateMp3DurationSeconds(retryBuffer)
          const improved =
            retryDuration > 4 &&
            Math.abs(retryDuration - duration) < Math.abs(realAudioDuration - duration)
          if (improved) {
            audioBuffer = retryBuffer
            realAudioDuration = retryDuration
            console.log(
              `[compose] corrected TTS duration: ${retryDuration.toFixed(1)}s (requested ${duration}s)`,
            )
          } else {
            console.log(
              `[compose] corrective pass not closer (${retryDuration.toFixed(1)}s) — keeping original`,
            )
          }
        }
      } catch (retryErr) {
        const msg = retryErr instanceof Error ? retryErr.message : String(retryErr)
        console.warn('[compose] corrective TTS pass failed — keeping original:', msg)
      }
    }

    // Step 2b — Push #175: transcribe the TTS audio via Whisper to get
    // word-level timestamps. These are mapped to caption segments so captions
    // display in exact sync with the narrator voice. Non-fatal: if Whisper
    // fails we fall through to proportional distribution in compose.ts.
    let whisperTimings: Array<{ time: number; duration: number }> | undefined
    try {
      const whisperWords = await transcribeTTSWithTimestamps(audioBuffer)
      if (whisperWords.length > 0) {
        const captionSegs = buildCaptionSegments(scaledScript, 7)
        if (captionSegs.length > 0) {
          const audioDur = realAudioDuration > 0 ? realAudioDuration : duration
          const mapped = mapWhisperTimingsToSegments(whisperWords, captionSegs, audioDur, 2.5)
          if (mapped.length === captionSegs.length) {
            whisperTimings = mapped
            console.log(`[compose] Whisper sync: ${mapped.length} caption segments mapped`)
          } else {
            console.warn(
              `[compose] Whisper mismatch (${mapped.length} vs ${captionSegs.length}) — proportional fallback`,
            )
          }
        }
      }
    } catch (whisperErr) {
      console.warn('[compose] Whisper step threw — proportional fallback:', whisperErr)
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
    // Push #158 (Fix #158) — captions are re-derived from the FINAL scaled
    // script (the exact text the TTS reads) by buildCreatomateSource's
    // buildCaptionSegments pipeline. This reverses Push #132, which used the
    // original per-scene `scene_captions`: whenever scaleVoiceoverScript
    // rewrote the narration, the voice said one thing while the caption
    // showed the pre-rewrite scene text. `scene_captions` is now passed only
    // as a fallback for when the scaled script can't be segmented.
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
      `[compose] caption source: re-segmented scaled script (${scaledScript.split(/\s+/).filter(Boolean).length} words); scene_captions fallback available=${haveSceneCaptions}`,
    )

    let source: Record<string, unknown>
    try {
      source = buildCreatomateSource({
        clipUrls,
        voiceoverUrl,
        voiceoverScript: scaledScript,
        sceneCaptions,
        duration,
        realAudioDuration,
        whisperTimings,
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
