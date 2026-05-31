import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildCreatomateSource,
  estimateMp3DurationSeconds,
  generateTTS,
  pollCreatomateRender,
  scaleVoiceoverScript,
  submitCreatomateRender,
  targetWordCount,
  transcribeTTSWithTimestamps,
  uploadVoiceoverToSupabase,
  type WhisperWord,
} from '@/lib/compose'
import { stripScriptMarkers } from '@/lib/scriptParser'
import { fetchUserPlan } from '@/lib/plan'
import { getBackgroundMusicUrl } from '@/lib/pixabayMusic'
import { selectPersonaForScript } from '@/lib/narration/niche-mapping'

export const maxDuration = 300

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
type Quality = 'fast' | 'basic' | 'basic_ai' | 'pro' | 'cinematic_ai'

interface ComposeBody {
  generationId?: string
  clip_urls?: string[]
  voiceover_script?: string
  scene_captions?: string[]
  duration?: number
  topic?: string
  quality?: string
  // Push #235 — explicit TTS speed from a user-authored script ("speed: 1.05").
  // When present, compose uses the narration verbatim at this speed and skips
  // both the word-count scaling and the duration corrective re-synthesis.
  speed?: number
  // Push #316 — output language (en | pt | es). The OpenAI TTS model is
  // multilingual and auto-detects the language of the input text, so the same
  // 'onyx' voice narrates in Portuguese or Spanish when the script is in that
  // language. We accept and log the param for observability but no voice switch
  // is required.
  language?: string
  // Phase 1 Narration Engine — content vertical hint (e.g. 'mystery', 'finance',
  // 'geography'). Forwarded from analyze-idea via GenerateClient so the persona
  // selector can pick the right voice + speed profile for the niche.
  vertical?: string
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

    // Push #236 — sanitize at the boundary so NO script marker ([Pexels: ...],
    // [Scene], [HOOK]), directive line (speed:/duration:/...), or markdown can
    // reach TTS or the on-screen captions. This is the single server-side
    // chokepoint every narration path flows through before it is both spoken
    // (generateTTS) and rendered as caption text (buildCreatomateSource).
    // Idempotent: verbatim scripts are already clean; raw-prompt fallbacks are
    // cleaned here.
    const voiceoverScript = stripScriptMarkers(body.voiceover_script ?? '')
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
      // Push #315 — added cinematic_ai for fal.ai Wan 2.1 mode (3 credits).
      return q === 'fast' || q === 'basic' || q === 'pro' || q === 'cinematic_ai' ? q : 'basic_ai'
    })()

    // Push #316 — output language. OpenAI TTS auto-detects from the script text.
    const language = body.language === 'pt' ? 'pt' : body.language === 'es' ? 'es' : 'en'

    // Phase 1 Narration Engine — content vertical from analyze-idea (e.g. 'mystery',
    // 'finance', 'geography'). Used by selectPersonaForScript() inside generateTTS()
    // to pick the right voice persona for the niche.
    const vertical = typeof body.vertical === 'string' && body.vertical.trim()
      ? body.vertical.trim().toLowerCase()
      : undefined
    // Map render quality → narration tier so premium/cinematic users get better personas.
    const narrationTier: 'free' | 'premium' | 'cinematic' =
      quality === 'cinematic_ai' ? 'cinematic' : quality === 'pro' ? 'premium' : 'free'

    // Push #235 — explicit user speed. When supplied (verbatim mode), the
    // narration is the user's exact text spoken at this rate; we don't rewrite
    // the word count and we don't slow the voice to fill the requested duration.
    // Clamped to the same natural band generateTTS() enforces.
    const explicitSpeed: number | null = (() => {
      const s = Number(body.speed)
      return Number.isFinite(s) && s > 0 ? Math.max(0.7, Math.min(1.3, s)) : null
    })()

    // Push #087 — Cinematic-tier renders (anything other than 'fast') must
    // come from a Pro user. Fast Mode renders skip the gate so Free + Basic
    // users can still produce videos via the Pexels pipeline.
    // Push #088 — Cinematic also requires a cinematic_token to have been
    // reserved upstream. /api/generate-video already does the consume on
    // the way in, so by the time we reach /api/compose the user paid for
    // the render. We do NOT decrement again here. We only verify the
    // upstream gate held (plan === pro) as defense in depth.
    // Push #315 — cinematic_ai (fal.ai mode) uses credits, not Pro plan.
    // Only the old Runway-based modes (basic, basic_ai, pro) require Pro.
    if (quality !== 'fast' && quality !== 'cinematic_ai') {
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
    // Push #235 — verbatim mode (explicit speed) skips scaling entirely: the
    // user wrote the exact narration, so rewriting it to a word-count target
    // would defeat the purpose. The video length then tracks the user's script
    // spoken at their chosen speed.
    let scaledScript: string
    if (explicitSpeed != null) {
      scaledScript = voiceoverScript
      console.log(
        `[compose] verbatim narration (speed=${explicitSpeed}) — skipping word-count scaling`,
      )
    } else {
      try {
        scaledScript = await scaleVoiceoverScript(voiceoverScript, targetWordCount(duration))
        if (!scaledScript) scaledScript = voiceoverScript
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[compose] script scaling failed:', msg)
        // Non-fatal — fall back to the raw script.
        scaledScript = voiceoverScript
      }
    }

    // Step 2 — Generate TTS.
    console.log(
      `[compose] voiceover generation started: user=${user.id.slice(0, 8)} script_words=${scaledScript.split(/\s+/).filter(Boolean).length} duration=${duration}s language=${language}`,
    )
    let audioBuffer: Buffer
    try {
      audioBuffer = await generateTTS(scaledScript, explicitSpeed ?? 1.0, vertical, narrationTier, language)
      console.log(
        `[compose] TTS response received: bytes=${audioBuffer.length} mime=audio/mpeg speed=${explicitSpeed ?? 1.0}`,
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
      explicitSpeed == null &&
      realAudioDuration > 4 &&
      Math.abs(realAudioDuration - duration) > DURATION_TOLERANCE_SECONDS
    ) {
      const correctiveSpeed = realAudioDuration / duration
      console.log(
        `[compose] duration off by ${(realAudioDuration - duration).toFixed(1)}s — re-synthesizing at speed=${correctiveSpeed.toFixed(3)}`,
      )
      try {
        const retryBuffer = await generateTTS(scaledScript, correctiveSpeed, vertical, narrationTier, language)
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

    // Step 2b — Push #258: transcribe the TTS audio via Whisper to get
    // word-level timestamps for DIRECT caption building. Captions are now
    // built from Whisper words directly (not mapped from script segments),
    // eliminating drift from number expansion (e.g. "63%" → "sixty three
    // percent"). Non-fatal: if Whisper fails the proportional fallback runs.
    let whisperWords: WhisperWord[] | undefined
    try {
      const words = await transcribeTTSWithTimestamps(audioBuffer)
      if (words.length > 0) {
        whisperWords = words
        console.log(`[compose] Whisper sync: ${words.length} words for direct caption build`)
      } else {
        console.warn('[compose] Whisper returned 0 words — proportional fallback')
      }
    } catch (whisperErr) {
      console.warn('[compose] Whisper step threw — proportional fallback:', whisperErr)
    }

    // Phase 5 — Detect persona for response metadata (observability + future UI).
    const detectedPersonaId: string | undefined = vertical
      ? selectPersonaForScript(scaledScript, vertical, narrationTier, language).id
      : undefined

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

    // Push #293 — fetch background music. Best-effort: never block the render.
    let musicUrl: string | null = null
    try {
      musicUrl = await getBackgroundMusicUrl()
    } catch (err) {
      console.warn('[compose] music fetch failed, continuing without music:', err instanceof Error ? err.message : String(err))
    }

    let source: Record<string, unknown>
    try {
      source = buildCreatomateSource({
        clipUrls,
        voiceoverUrl,
        voiceoverScript: scaledScript,
        sceneCaptions,
        duration,
        realAudioDuration,
        whisperWords,
        musicUrl,
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

    // Push #355 — Link the broll_metrics row (created in generate-video-fast)
    // to this Creatomate render so compose/status can write render_time_ms.
    // Best-effort: never blocks the render response.
    if (body.generationId) {
      try {
        const { error: metricsErr } = await supabase
          .from('broll_metrics')
          .update({
            render_id:    renderId,
            vertical:     vertical ?? null,
            submitted_at: new Date().toISOString(),
          })
          .eq('generation_id', body.generationId)
        if (metricsErr) {
          console.warn('[broll_metrics] compose update failed:', metricsErr.message)
        } else {
          console.log(`[broll_metrics] linked generation_id=${body.generationId} → render_id=${renderId}`)
        }
      } catch (metricsEx) {
        console.warn('[broll_metrics] compose update threw:', metricsEx instanceof Error ? metricsEx.message : String(metricsEx))
      }
    }

    return NextResponse.json({
      render_id: renderId,
      quality,
      duration,
      voiceover_url: voiceoverUrl,
      persona_id: detectedPersonaId,
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
