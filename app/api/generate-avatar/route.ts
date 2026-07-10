// AI Avatar (feature/ai-avatar) — orchestrator for the premium talking-avatar
// pipeline. Flow:
//   1. Narration: parse the user's script (verbatim [Pexels:] markers honored,
//      same as Fast/AI Gen) or scale the idea to the duration's word target.
//   2. TTS via the existing engine (lib/compose.generateTTS) → upload the mp3
//      to the public voiceovers bucket. The SAME mp3 is (a) lip-synced by VEED
//      and (b) the final video's narration track, so lips and audio can never
//      drift.
//   3. Submit photo+audio to VEED Fabric 1.0 (720p) on the fal queue. The
//      client polls /api/avatar-status, then kicks /api/compose with
//      avatar_url + voiceover_url (compose skips TTS in avatar mode).
//   4. B-roll cutaways: best-effort Pixabay/stock-library clips so the
//      composition can cut away from the talking head (never blocks).
//
// CHECKPOINT 1 (current state): NO billing exists yet — no Stripe products, no
// avatar-credit debit, no paywall. This route must NOT reach production until
// checkpoint 2 wires the avatar_credits balance + paywall (Joseph's explicit
// gate). The cost estimate is still computed and returned so the UI contract
// is ready.
//
// Protection rules live where they belong:
//   • VEED failure → no debit (nothing is debited in checkpoint 1; the retry
//     happens in submitAvatarJob, and a failed job simply errors the client).
//   • Rate limit: max 3 avatar renders in flight per account (in-memory,
//     best-effort on serverless — checkpoint 2 moves this to a DB counter
//     alongside avatar_credits).
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import {
  estimateMp3DurationSeconds,
  generateTTS,
  scaleVoiceoverScript,
  targetWordCount,
  uploadVoiceoverToSupabase,
} from '@/lib/compose'
import { parseUserScript, stripScriptMarkers } from '@/lib/scriptParser'
import {
  submitAvatarJob,
  VEED_720P_USD_PER_SECOND,
  OMNIHUMAN_720P_USD_PER_SECOND,
  PRESENTER_USD_PER_SECOND,
  type AvatarEngine,
} from '@/lib/avatar/veed'
import { synthesizeWithVoice } from '@/lib/avatar/voice'
import { getPixabayVideoForQueries } from '@/lib/pixabay'
import { pickLibraryClips } from '@/lib/stockLibrary'
// Avatar B-roll fix (13/06) — reuse the Phase-1 B-roll Intelligence engine so
// cutaways come from per-scene queries instead of prompt.slice(0,80) garbage
// (the "menina dançando" bug Joseph hit on 12/06).
import { brollEngine } from '@/lib/broll/broll-engine'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

// Product rule: avatar videos are locked to the 45–60s band.
const MIN_DURATION = 45
const MAX_DURATION = 60

// Rate limit — max 3 avatar jobs per account inside a rolling 5-min window.
// Fix 1 (12/06): DB-BACKED via public.avatar_jobs (one row per submitted fal
// job). The old in-memory Map was per-lambda and useless on Vercel — every
// cold/parallel instance had its own empty Map, so the limit didn't hold.
const RATE_WINDOW_MS = 5 * 60 * 1000
const RATE_MAX = 3

/** Best-effort b-roll cutaway clips. Never throws, may return [].
 *  Hook mode passes a higher max — b-roll carries ~85% of the timeline there,
 *  so 3 clips would visibly recycle. */
async function fetchCutawayClips(queries: string[], topic: string, max = 3): Promise<string[]> {
  const urls: string[] = []
  try {
    for (const q of queries.slice(0, max)) {
      const url = await getPixabayVideoForQueries([q], false, topic.slice(0, 50))
      if (url && !urls.includes(url)) urls.push(url)
      if (urls.length >= max) break
    }
    if (urls.length < max) {
      // FALLBACK-B — curated library, same hierarchy as Fast Mode.
      for (const clip of pickLibraryClips(topic, max)) {
        if (!urls.includes(clip.url)) urls.push(clip.url)
        if (urls.length >= max) break
      }
    }
  } catch (err) {
    console.warn('[generate-avatar] b-roll fetch failed (continuing avatar-only):', err instanceof Error ? err.message : String(err))
  }
  return urls.slice(0, max)
}

// Face-app wave 1 (12/06) — Hook Avatar mode: the face speaks only the first
// ~8s. The mp3 sent to VEED is a byte-sliced copy of the FULL narration mp3
// (CBR, so a proportional slice lands within a frame of the target second) —
// the lip-synced hook therefore matches the final narration track EXACTLY,
// with zero drift, and VEED only bills ~8s instead of ~52s (≈85% cost cut).
const HOOK_SECONDS = 8

function sliceMp3Head(buffer: Buffer, totalSeconds: number, headSeconds: number): Buffer {
  if (!(totalSeconds > headSeconds + 2)) return buffer // too short — keep full
  const bytes = Math.floor(buffer.length * (headSeconds / totalSeconds))
  return buffer.subarray(0, Math.max(bytes, 1024))
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: 'Avatar engine is not configured. Please contact support.' }, { status: 500 })
    }
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'AI service is not configured.' }, { status: 500 })
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json({ error: 'Storage backend is not configured.' }, { status: 500 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: {
      prompt?: string
      duration?: number
      language?: string
      avatarImageUrl?: string
      // Joseph feedback 10/06 ("voz acelerou no final"): content vertical from
      // analyze-idea. Enables the Narration Engine persona + Phase 2 section
      // pacing (hook fast, PAYOFF slowed) instead of one flat TTS speed.
      vertical?: string
      // Voice dry run — generate + store ONLY the narration mp3 and return its
      // URL, skipping VEED ($) and b-roll entirely. Lets us approve pacing for
      // ~$0.02 of TTS instead of a ~$6 talking-head render. Doesn't count
      // against the avatar rate limit.
      dryRun?: boolean
      // Face-app wave 1 — avatar engine: 'fabric' (talking head, default) or
      // 'omnihuman' (full-figure body & gestures, "Pro" tier).
      engine?: string
      // Face-app wave 1 — 'hook' = face speaks only the first ~8s, b-roll
      // carries the rest (same 1 credit, ~85% lower VEED cost). 'full' = legacy.
      avatarMode?: string
      // Avatar Studio (12/06) — source VIDEO mode: a short clip of the person
      // (our storage URL) that the lipsync engine re-voices with the narration.
      // When present it takes precedence over avatarImageUrl.
      avatarSourceVideoUrl?: string
      // Verbatim fix (13/06) — 'verbatim': speak EXACTLY the user's text (no
      // GPT expansion, no 45s-minimum padding). Joseph wrote a 10s greeting
      // and the scaler invented a 52s script around it. 'expand' = legacy
      // behavior (scale to the duration's word target), now explicit.
      scriptMode?: string
      // Voice cloning (16/06) — when present, the narration is spoken in the
      // user's CLONED voice (MiniMax) instead of the default TTS engine.
      voiceId?: string
      // Scene mode (16/06) — when the source is a generated scene (e.g. the
      // person already IN a stadium wearing the jersey), the avatar must FILL
      // the whole video: no stock b-roll cutaways, length = the narration.
      noBroll?: boolean
    }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const prompt = (body.prompt ?? '').trim()
    if (!prompt) {
      return NextResponse.json({ error: 'Your script or idea is required.' }, { status: 400 })
    }

    const dryRun = body.dryRun === true
    const hookMode = body.avatarMode === 'hook'

    // Source must be OUR storage URL (uploaded via /api/avatar/upload) —
    // never an arbitrary external URL (no SSRF / hot-linking surface).
    // Dry runs don't need a source (voice-only).
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const storagePrefix = `${supabaseUrl}/storage/v1/object/public/avatars/`
    const avatarImageUrl = (body.avatarImageUrl ?? '').trim()
    // Avatar Studio — video source takes precedence and forces the lipsync engine.
    const avatarSourceVideoUrl = (body.avatarSourceVideoUrl ?? '').trim()
    const videoMode = avatarSourceVideoUrl.length > 0
    // KINEO-PRESENTER-2026-07-10 — 'presenter' (Kling AI Avatar v2) accepted.
    const engine: AvatarEngine = videoMode
      ? 'lipsync'
      : body.engine === 'omnihuman' ? 'omnihuman'
      : body.engine === 'presenter' ? 'presenter'
      : 'fabric'
    if (!dryRun && videoMode && !avatarSourceVideoUrl.startsWith(storagePrefix)) {
      return NextResponse.json({ error: 'Please upload your video first.' }, { status: 400 })
    }
    if (!dryRun && !videoMode && !avatarImageUrl.startsWith(storagePrefix)) {
      return NextResponse.json({ error: 'Please upload your photo first.' }, { status: 400 })
    }

    if (!dryRun) {
      // Fix 1 (12/06) — count THIS user's jobs in the rolling window straight
      // from the DB (works across every lambda instance). Fail-open on a
      // count error: a transient DB blip must not block a paying render.
      const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
      const { count: recentCount, error: rateErr } = await supabase
        .from('avatar_jobs')
        .select('request_id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', windowStart)
      if (!rateErr && (recentCount ?? 0) >= RATE_MAX) {
        return NextResponse.json(
          { error: 'You have 3 avatar videos rendering already — please wait for one to finish.' },
          { status: 429 },
        )
      }
    }

    // KINEO-AVATAR-120-2026-07-06 — avatar videos now cost 120 UNIVERSAL
    // video_credits (was the separate avatar_credits add-on @ 1/video). This is
    // only the upfront balance gate; the actual 120-credit DEBIT happens on
    // SUCCESS in compose/status via debit_video_credits (idempotent by
    // render_id), so a failed VEED/render never charges (protection rule).
    // The 402 matches the universal out-of-credits shape used by Fast/compose
    // (upsell:'credits' → the $4.90 pack / plan upgrade modal), NOT the retired
    // avatar_pack. Voice dry runs (internal, cents of TTS) skip the gate.
    // KINEO-REBASE-2026-07-10 — 220 → 110 (2:1 credit rebase). This gate was
    // missed in the rebase push and stayed at 220 while compose/status debits
    // 110 — users with 110-219 credits were wrongly blocked. Fixed here.
    // KINEO-PRESENTER-2026-07-10 — per-engine cost: 'presenter' (Kling AI
    // Avatar v2 Standard, $0.0562/s → ~$3.37/60s real cost) charges 70
    // credits (~71% margin on Creator $/cr; Joseph subiu 60→70 em 10/07); the
    // VEED/OmniHuman engines stay at 110 (real cost ~$9-9.60/60s). Keep in
    // sync with creditCostFor() in compose/status ('presenter' → 70).
    const AVATAR_CREDIT_COST = engine === 'presenter' ? 70 : 110
    if (!dryRun) {
      const { data: avProfile } = await supabase
        .from('profiles')
        .select('video_credits')
        .eq('id', user.id)
        .single()
      const videoCreditBalance = avProfile?.video_credits ?? 0
      if (videoCreditBalance < AVATAR_CREDIT_COST) {
        return NextResponse.json(
          {
            error: `Avatar videos cost ${AVATAR_CREDIT_COST} credits. You have ${videoCreditBalance}. Get 25 more Shorts for $4.90, or upgrade to a plan for unlimited posting.`,
            upsell: 'credits',
            outOfCredits: true,
            balance: videoCreditBalance,
            upgrade: '/pricing',
          },
          { status: 402 },
        )
      }
    }

    const forceVerbatim = body.scriptMode === 'verbatim'
    const requested = Number(body.duration) || MIN_DURATION
    // Verbatim fix (13/06) — the 45–60s lock exists so EXPANDED scripts fit
    // the Shorts format. In verbatim mode the user's text IS the video, so a
    // 10s greeting renders as ~10s (sanity-clamped 3–90s) instead of being
    // padded with invented content.
    const duration = forceVerbatim
      ? Math.max(3, Math.min(90, Math.round(requested)))
      : Math.max(MIN_DURATION, Math.min(MAX_DURATION, Math.round(requested)))
    const language = body.language === 'pt' ? 'pt' : body.language === 'es' ? 'es' : 'en'
    const vertical = typeof body.vertical === 'string' && body.vertical.trim()
      ? body.vertical.trim().toLowerCase()
      : undefined

    // ── 1. Narration text ────────────────────────────────────────────────
    const parsed = parseUserScript(prompt)
    const verbatim = parsed.hasMarkers && parsed.segments.length > 0
    let narration: string
    if (verbatim) {
      narration = parsed.narration
    } else if (forceVerbatim) {
      // Verbatim fix (13/06) — speak EXACTLY what the user typed. No GPT
      // rewrite, no padding to a word target. What you write is what plays.
      narration = stripScriptMarkers(prompt)
    } else {
      const clean = stripScriptMarkers(prompt)
      try {
        narration = (await scaleVoiceoverScript(clean, targetWordCount(duration))) || clean
      } catch {
        narration = clean
      }
    }
    const speed = verbatim ? parsed.speed : 1.0

    // ── 2. TTS (the exact audio VEED will lip-sync) ──────────────────────
    // Joseph feedback 10/06 — the flat single-speed TTS rushed the PAYOFF
    // ("TITO SAH" gritado rápido demais). Passing the MARKED script + vertical
    // turns on the Narration Engine: persona voice + Phase 2 per-section
    // pacing (hook punchy, payoff slowed for drama). generateTTS strips the
    // markers itself, so nothing leaks into the narration. Tier 'cinematic' =
    // the avatar is the flagship product. Falls back to the flat pass when
    // the script has no markers or no vertical was sent (legacy behavior).
    const cloneVoiceId = typeof body.voiceId === 'string' && body.voiceId.trim() ? body.voiceId.trim() : null
    const ttsSource = verbatim ? prompt : narration
    let audioBuffer: Buffer
    try {
      if (cloneVoiceId) {
        // Cloned voice — speak the clean narration in the user's OWN voice
        // (MiniMax). On ANY failure, fall back to the default TTS so the render
        // never dies just because voice cloning hiccuped.
        try {
          audioBuffer = await synthesizeWithVoice({ voiceId: cloneVoiceId, text: narration, language })
        } catch (cloneErr) {
          console.warn('[generate-avatar] cloned voice failed, falling back to default TTS:', cloneErr instanceof Error ? cloneErr.message : String(cloneErr))
          audioBuffer = await generateTTS(ttsSource, speed ?? 1.0, vertical, 'cinematic', language)
        }
      } else {
        // Verbatim tail fix (13/06) — the 'cinematic' Narration Engine adds
        // dramatic pauses/padding, which inflates the mp3 past the actual
        // speech on short word-for-word lines (Joseph's 5s greeting rendered
        // as a 9s video with a dead tail). Verbatim uses the FLAT pass: the
        // audio ends when the words end.
        audioBuffer = forceVerbatim && !verbatim
          ? await generateTTS(ttsSource, 1.0, undefined, 'free', language)
          : await generateTTS(ttsSource, speed ?? 1.0, vertical, 'cinematic', language)
      }
    } catch (err) {
      console.error('[generate-avatar] TTS failed:', err instanceof Error ? err.message : String(err))
      return NextResponse.json({ error: 'Voiceover generation failed. Please try again.' }, { status: 502 })
    }
    if (!audioBuffer || audioBuffer.length === 0) {
      return NextResponse.json({ error: 'Voiceover generation returned no audio.' }, { status: 502 })
    }
    const realAudioDuration = estimateMp3DurationSeconds(audioBuffer)

    let voiceoverUrl: string
    try {
      voiceoverUrl = await uploadVoiceoverToSupabase(user.id, audioBuffer)
    } catch (err) {
      console.error('[generate-avatar] voiceover upload failed:', err instanceof Error ? err.message : String(err))
      return NextResponse.json({ error: 'Could not store the voiceover. Please try again.' }, { status: 502 })
    }

    // ── Voice dry run: stop here — mp3 stored, zero fal spend ────────────
    if (dryRun) {
      console.log(`[generate-avatar] DRY RUN voice-only user=${user.id.slice(0, 8)} audio=${realAudioDuration.toFixed(1)}s vertical=${vertical ?? '-'}`)
      return NextResponse.json({
        mode: 'avatar_dry_run',
        voiceover_url: voiceoverUrl,
        voiceover_script: narration,
        real_audio_duration: realAudioDuration,
        speed: speed ?? 1.0,
        verbatim,
      })
    }

    // ── 3. Submit to the avatar engine (720p) on the fal queue ──────────
    // 'fabric' = VEED talking head; 'omnihuman' = full-figure body & gestures.
    // Hook mode lip-syncs ONLY the head slice of the narration mp3 — the slice
    // is byte-identical to the start of the full track, so lips stay locked.
    let avatarAudioUrl = voiceoverUrl
    let avatarHookSeconds: number | null = null
    if (hookMode && realAudioDuration > HOOK_SECONDS + 2) {
      const hookBuffer = sliceMp3Head(audioBuffer, realAudioDuration, HOOK_SECONDS)
      if (hookBuffer.length < audioBuffer.length) {
        try {
          avatarAudioUrl = await uploadVoiceoverToSupabase(user.id, Buffer.from(hookBuffer))
          const measured = estimateMp3DurationSeconds(Buffer.from(hookBuffer))
          avatarHookSeconds = measured > 2 && measured < realAudioDuration ? measured : HOOK_SECONDS
        } catch (err) {
          // Fall back to a full-length avatar rather than failing the render.
          console.warn('[generate-avatar] hook slice upload failed — falling back to full avatar:', err instanceof Error ? err.message : String(err))
          avatarAudioUrl = voiceoverUrl
          avatarHookSeconds = null
        }
      }
    }
    const requestId = await submitAvatarJob({
      imageUrl: videoMode ? undefined : avatarImageUrl,
      videoUrl: videoMode ? avatarSourceVideoUrl : undefined,
      audioUrl: avatarAudioUrl,
      resolution: '720p',
      engine,
    })
    if (!requestId) {
      // Protection rule: nothing was (or ever will be at this point) charged.
      return NextResponse.json(
        { error: 'The avatar engine could not accept the job. You were not charged — please try again.' },
        { status: 502 },
      )
    }

    // Fix 1 (12/06) — register the job for the DB-backed rate limit (replaces
    // the per-lambda Map). Best-effort: a failed insert never fails the render.
    try {
      await supabase.from('avatar_jobs').insert({ request_id: requestId, user_id: user.id, engine })
    } catch (err) {
      console.warn('[generate-avatar] avatar_jobs insert failed (non-blocking):', err instanceof Error ? err.message : String(err))
    }

    // ── 4. B-roll cutaways (best-effort) ─────────────────────────────────
    // Hook mode: b-roll carries everything after the hook → fetch up to 6.
    // B-roll fix (13/06) — scripts WITHOUT [Pexels:] markers used to search
    // with prompt.slice(0,80) (raw user text) → irrelevant stock ("menina
    // dançando"). Now the Phase-1 brollEngine derives per-scene queries from
    // the ACTUAL narration; the raw slice is only the last-resort fallback.
    let queries: string[]
    if (verbatim) {
      queries = parsed.segments.map((s) => s.pexelsQuery).filter(Boolean)
    } else {
      queries = []
      try {
        const plan = await brollEngine({
          script: narration,
          niche: vertical ?? 'facts',
          tone: 'energetic',
          duration,
          language,
        })
        if (plan.degraded !== true && Array.isArray(plan.scenes)) {
          queries = plan.scenes.map((s) => s.pexelsQuery).filter(Boolean)
        }
      } catch (err) {
        console.warn('[generate-avatar] brollEngine failed — falling back to topic slice:', err instanceof Error ? err.message : String(err))
      }
      if (queries.length === 0) queries = [narration.slice(0, 80)]
    }
    // Scene mode → no cutaways: the avatar (already in the scene) carries the
    // whole video, so it stays "you in the stadium" the entire time and the
    // length follows the narration (no b-roll padding stretching it out).
    const clipUrls = body.noBroll === true
      ? []
      : await fetchCutawayClips(queries, narration, avatarHookSeconds != null ? 6 : 3)

    const estSeconds = avatarHookSeconds != null
      ? avatarHookSeconds
      : realAudioDuration > 4 ? realAudioDuration : duration
    const generationId = randomUUID()
    const usdPerSecond =
      engine === 'presenter' ? PRESENTER_USD_PER_SECOND
      : engine === 'omnihuman' ? OMNIHUMAN_720P_USD_PER_SECOND
      : VEED_720P_USD_PER_SECOND
    console.log(
      `[generate-avatar] submitted user=${user.id.slice(0, 8)} engine=${engine} request=${requestId} audio=${estSeconds.toFixed(1)}s clips=${clipUrls.length} generationId=${generationId}`,
    )

    return NextResponse.json({
      mode: 'avatar',
      engine,
      avatar_mode: avatarHookSeconds != null ? 'hook' : 'full',
      avatar_hook_seconds: avatarHookSeconds,
      generationId,
      avatar_request_id: requestId,
      voiceover_url: voiceoverUrl,
      voiceover_script: narration,
      real_audio_duration: realAudioDuration,
      clip_urls: clipUrls,
      duration,
      speed: speed ?? 1.0,
      verbatim,
      // KINEO-AVATAR-120-2026-07-06 — Cost contract for the UI ("estimated cost
      // BEFORE render"). 1 avatar video = 120 UNIVERSAL video_credits (was 1
      // separate avatar credit). Key kept as-is for client compatibility but the
      // value now reflects the 120 universal-credit charge; credits_needed is a
      // clearer alias reading the same number.
      avatar_credits_needed: AVATAR_CREDIT_COST,
      credits_needed: AVATAR_CREDIT_COST,
      estimated_seconds: Math.round(estSeconds),
      estimated_cost_usd: Number((estSeconds * usdPerSecond).toFixed(2)),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[generate-avatar] unexpected error:', msg)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
