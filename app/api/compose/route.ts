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

// Push #434 — FORCE-WATERMARK list. Accounts here ALWAYS get the watermark,
// regardless of plan or engine, so Joseph can post self-promo videos from his
// own paid account that advertise the site. Kept fully separate from the
// customer watermark rules below — adding/removing an email here changes
// nothing for real users. To stop watermarking his videos, delete the email.
const FORCE_WATERMARK_EMAILS = new Set<string>([
  'josephsskaf@gmail.com',
])

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
// feature/ai-avatar — 'avatar' = premium talking-head render (VEED Fabric).
// Checkpoint 1: no credit cost wired yet (billing lands in checkpoint 2).
type Quality = 'fast' | 'basic' | 'basic_ai' | 'pro' | 'cinematic_ai' | 'cinematic_kling' | 'cinematic_veo' | 'cinematic_sora' | 'avatar'

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
  // feature/ai-avatar — avatar mode (quality === 'avatar'). The narration mp3
  // ALREADY exists (generated in /api/generate-avatar and lip-synced by VEED),
  // so compose must NOT re-synthesize TTS — a new mp3 would have different
  // timing and break lip sync. avatar_url is the VEED talking-head MP4 that
  // becomes the main video track.
  avatar_url?: string
  voiceover_url?: string
  real_audio_duration?: number
  // Face-app wave 1 (12/06) — Hook Avatar: the avatar MP4 only covers the
  // first ~N seconds; b-roll tiles the rest. Forwarded to buildCreatomateSource.
  avatar_hook_seconds?: number
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

    // feature/ai-avatar — avatar requests are validated below (quality parse +
    // URL allow-list); they may legitimately carry ZERO stock clips because
    // the talking head fills the whole timeline.
    const isAvatarReq =
      (body.quality ?? '').toString() === 'avatar' &&
      typeof body.avatar_url === 'string' &&
      body.avatar_url.trim().length > 0

    const clipUrls = Array.isArray(body.clip_urls)
      ? body.clip_urls.filter((u) => typeof u === 'string' && u.trim().length > 0)
      : []
    if (clipUrls.length === 0 && !isAvatarReq) {
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
    // Avatar duration fix (02/07, TAAFT reviewer bug) — avatar renders follow
    // the REAL narration length (a 4s verbatim line is a ~4s video), so the
    // requested duration is only sanity-clamped for them instead of coerced to
    // the Shorts whitelist. The old coercion turned a short verbatim request
    // (e.g. duration=4 from AvatarStudioClient) into 45, and combined with the
    // ">4s" plausibility gate below produced a 45s render where the avatar
    // speaks for ~4s and the remaining ~40s is black screen.
    const duration = isAvatarReq
      ? Math.max(3, Math.min(90, Math.round(requestedDuration)))
      : (SUPPORTED_DURATIONS as readonly number[]).includes(requestedDuration)
        ? requestedDuration
        : 45

    const quality: Quality = ((): Quality => {
      const q = (body.quality ?? 'basic_ai').toString()
      // Push #315 — added cinematic_ai for fal.ai Wan 2.1 mode (3 credits).
      // feature/ai-avatar — 'avatar' accepted ONLY when the request actually
      // carries an avatar payload (validated above).
      if (q === 'avatar') return isAvatarReq ? 'avatar' : 'basic_ai'
      return q === 'fast' || q === 'basic' || q === 'pro' || q === 'cinematic_ai' || q === 'cinematic_kling' || q === 'cinematic_veo' || q === 'cinematic_sora' ? q : 'basic_ai'
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
      quality === 'cinematic_ai' || quality === 'cinematic_kling' || quality === 'cinematic_veo' || quality === 'cinematic_sora' ? 'cinematic' : quality === 'pro' ? 'premium' : 'free'

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
    // feature/ai-avatar — 'avatar' is exempt from the Pro gate: it is paid via
    // the separate avatar-credits add-on (checkpoint 2), never the Pro plan.
    if (quality !== 'fast' && quality !== 'cinematic_ai' && quality !== 'cinematic_kling' && quality !== 'cinematic_veo' && quality !== 'cinematic_sora' && quality !== 'avatar') {
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

    // #384 — FREE AI-GENERATE TRIAL: watermark decision is computed SERVER-SIDE
    // from the DB profile (never trusts the client). A render is the free trial
    // ONLY when: AI mode AND the user has NOT used their free AI yet AND they
    // do NOT have enough credits to pay the 30-credit price. So anyone PAYING
    // (>= 30 credits) NEVER gets a watermark — guaranteed here, server-side.
    // The quota flag itself is flipped on SUCCESS in /api/compose/status.
    // Push #430 — welcome credits (30 on signup) let FREE-plan users reach the
    // paid AI path with a full balance, which used to skip the watermark. Rule
    // now: ANY AI video from a free-plan account is watermarked. Clean video =
    // paid plan. Fast videos stay watermark-free on every plan.
    // Push #434 — Fast Mode is now FREE + unlimited as a growth engine. To make
    // every free Fast video market the product, free-plan Fast renders carry the
    // watermark (clean Fast = paid plan). Same rule already applies to AI videos.
    let isFreeAiTrial = false
    let isFreePlanAi = false
    let isFreePlanFast = false
    let withEndCard = false
    if (quality === 'cinematic_ai' || quality === 'fast') {
      const { data: prof } = await supabase
        .from('profiles')
        .select('free_ai_generate_used, video_credits, plan')
        .eq('id', user.id)
        .single()
      const PAID_PLANS = new Set([
        'starter', 'starter_trial', 'basic', 'basic_trial',
        'pro', 'pro_trial', 'creator', 'creator_trial', 'studio', 'studio_trial',
      ])
      const isFreePlan = !PAID_PLANS.has((prof?.plan ?? 'free').toLowerCase())
      // #482 — end card (Option A): free + Starter get the "Made with
      // ShortsForgeAI" end card so every posted video advertises the product.
      // Clean on Creator/Studio (they're not free and not in STARTER_PLANS).
      const STARTER_PLANS = new Set(['starter', 'starter_trial', 'basic', 'basic_trial'])
      const isStarterPlan = STARTER_PLANS.has((prof?.plan ?? 'free').toLowerCase())
      withEndCard = isFreePlan || isStarterPlan
      if (quality === 'cinematic_ai') {
        const used = prof?.free_ai_generate_used === true
        const creds = prof?.video_credits ?? 0
        isFreeAiTrial = !used && creds < 30
        isFreePlanAi = isFreePlan
      } else {
        // quality === 'fast'
        isFreePlanFast = isFreePlan
      }
    }

    // ── feature/ai-avatar — validate the avatar payload URLs ──────────────
    // voiceover_url must be OUR public storage object (it was uploaded by
    // /api/generate-avatar); avatar_url must be the fal CDN output or our
    // storage. Anything else is rejected — no arbitrary-URL render surface.
    const avatarMode = quality === 'avatar'
    const avatarUrlBody = (body.avatar_url ?? '').trim()
    const voiceoverUrlBody = (body.voiceover_url ?? '').trim()
    if (avatarMode) {
      const storagePrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`
      const falCdn = /^https:\/\/([a-z0-9-]+\.)*fal\.(media|run|ai)\//i
      if (!voiceoverUrlBody.startsWith(storagePrefix)) {
        return NextResponse.json({ error: 'Invalid voiceover for avatar render.' }, { status: 400 })
      }
      if (!falCdn.test(avatarUrlBody) && !avatarUrlBody.startsWith(storagePrefix)) {
        return NextResponse.json({ error: 'Invalid avatar video URL.' }, { status: 400 })
      }
    }

    // Step 1 — Scale the voiceover script to the right word count.
    // Push #235 — verbatim mode (explicit speed) skips scaling entirely: the
    // user wrote the exact narration, so rewriting it to a word-count target
    // would defeat the purpose. The video length then tracks the user's script
    // spoken at their chosen speed.
    // feature/ai-avatar — avatar mode also skips scaling: the script passed in
    // is EXACTLY what the already-rendered mp3 narrates (captions derive from it).
    let scaledScript: string
    if (avatarMode) {
      scaledScript = voiceoverScript
      console.log('[compose] avatar mode — narration already synthesized, skipping scaling')
    } else if (explicitSpeed != null) {
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
    // feature/ai-avatar — SKIPPED in avatar mode: the narration mp3 already
    // exists (made in /api/generate-avatar) and VEED lip-synced the talking
    // head to that exact file. Re-synthesizing here would produce different
    // timing and desync the lips. We re-download the mp3 only to measure its
    // duration + run Whisper for drift-free captions (both best-effort).
    let audioBuffer: Buffer | null = null
    if (avatarMode) {
      try {
        const audioRes = await fetch(voiceoverUrlBody)
        if (audioRes.ok) {
          audioBuffer = Buffer.from(await audioRes.arrayBuffer())
          console.log(`[compose] avatar voiceover fetched for analysis: ${audioBuffer.length} bytes`)
        } else {
          console.warn(`[compose] avatar voiceover fetch HTTP ${audioRes.status} — proportional captions fallback`)
        }
      } catch (err) {
        console.warn('[compose] avatar voiceover fetch failed — proportional captions fallback:', err instanceof Error ? err.message : String(err))
      }
    } else {
      console.log(
        `[compose] voiceover generation started: user=${user.id.slice(0, 8)} script_words=${scaledScript.split(/\s+/).filter(Boolean).length} duration=${duration}s language=${language}`,
      )
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
    }

    // Push #158 — measure the REAL narration length so captions key to the
    // actual audio, not the requested duration (which assumed 2.5 wps).
    let realAudioDuration = audioBuffer ? estimateMp3DurationSeconds(audioBuffer) : 0
    // Avatar duration fix (02/07) — threshold dropped 4s → 0.5s: a legitimately
    // SHORT verbatim line (one sentence ≈ 3s of speech) was being treated as a
    // failed measurement and replaced with the requested duration, so the final
    // video ballooned to 45s with a black tail after the avatar stopped talking.
    // 0.5s still catches real measurement failures (estimateMp3DurationSeconds
    // returns 0 for unparseable buffers).
    if (avatarMode && !(realAudioDuration > 0.5)) {
      // Avatar fallback chain: measured → value sent by generate-avatar → requested.
      const sent = Number(body.real_audio_duration)
      realAudioDuration = Number.isFinite(sent) && sent > 0.5 ? sent : duration
    }
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
      !avatarMode && // feature/ai-avatar — never re-synthesize the lip-synced mp3
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

    // Step 2b + Step 3 — Fix 3 (12/06): Whisper transcription and the
    // voiceover upload are INDEPENDENT (Whisper reads the in-memory buffer,
    // the upload writes the same buffer to storage), but they used to run
    // back-to-back on the hot path, adding their latencies (~2s + ~1s) to
    // every render. They now run in PARALLEL — same outputs, same fallbacks,
    // 1–3s less user-facing wait per video.
    //
    // Whisper (Push #258): word-level timestamps for DIRECT caption building
    // (no drift from number expansion). Non-fatal — proportional fallback.
    // Upload: avatar mode reuses the mp3 already in storage (zero work).
    const whisperPromise: Promise<WhisperWord[] | undefined> = audioBuffer
      ? transcribeTTSWithTimestamps(audioBuffer)
          .then((words) => {
            if (words.length > 0) {
              console.log(`[compose] Whisper sync: ${words.length} words for direct caption build`)
              return words
            }
            console.warn('[compose] Whisper returned 0 words — proportional fallback')
            return undefined
          })
          .catch((whisperErr) => {
            console.warn('[compose] Whisper step threw — proportional fallback:', whisperErr)
            return undefined
          })
      : Promise.resolve(undefined)

    const uploadPromise: Promise<{ url: string } | { uploadError: unknown }> = avatarMode
      ? Promise.resolve({ url: voiceoverUrlBody })
      : uploadVoiceoverToSupabase(user.id, audioBuffer as Buffer)
          .then((url) => {
            console.log(`[compose] voiceover stored at: ${url}`)
            return { url }
          })
          .catch((err: unknown) => ({ uploadError: err }))

    const [whisperWords, uploadResult] = await Promise.all([whisperPromise, uploadPromise])

    if ('uploadError' in uploadResult) {
      const err = uploadResult.uploadError
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
    const voiceoverUrl: string = uploadResult.url

    // Phase 5 — Detect persona for response metadata (observability + future UI).
    const detectedPersonaId: string | undefined = vertical
      ? selectPersonaForScript(scaledScript, vertical, narrationTier, language).id
      : undefined

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
        quality,
        realAudioDuration,
        whisperWords,
        musicUrl,
        avatarUrl: avatarMode ? avatarUrlBody : null,
        // Hook Avatar (12/06) — validated: only meaningful in avatar mode and
        // when plausibly inside the timeline.
        avatarHookSeconds:
          avatarMode &&
          typeof body.avatar_hook_seconds === 'number' &&
          body.avatar_hook_seconds > 2 &&
          body.avatar_hook_seconds < 30
            ? body.avatar_hook_seconds
            : null,
        watermark:
          isFreeAiTrial ||
          isFreePlanAi ||
          isFreePlanFast ||
          FORCE_WATERMARK_EMAILS.has((user.email ?? '').toLowerCase()), // #434 — Joseph's self-promo accounts always watermarked
        // #482 — end card on free + Starter; also on Joseph's own self-promo
        // accounts so his daily content advertises the product.
        endCard:
          withEndCard ||
          FORCE_WATERMARK_EMAILS.has((user.email ?? '').toLowerCase()),
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
    // 10/06 — ONE automatic retry: a transient Creatomate reject killed an
    // avatar render whose (expensive, slow) VEED clip was already done; the
    // identical payload succeeded seconds later. The retry protects every
    // mode but matters most for avatar, where a lost compose wastes a paid
    // multi-minute talking-head generation.
    let renderId: string
    try {
      renderId = await submitCreatomateRender(source)
    } catch (firstErr) {
      const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr)
      console.warn('[compose] Creatomate submit failed — retrying once in 1.5s:', firstMsg)
      await new Promise((r) => setTimeout(r, 1500))
      try {
        renderId = await submitCreatomateRender(source)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[compose] Creatomate submit failed (after retry):', msg)
        return NextResponse.json(
          { error: 'Render service rejected the job. Please try again.' },
          { status: 502 }
        )
      }
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
