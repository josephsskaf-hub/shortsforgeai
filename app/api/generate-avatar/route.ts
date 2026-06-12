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
  type AvatarEngine,
} from '@/lib/avatar/veed'
import { getPixabayVideoForQueries } from '@/lib/pixabay'
import { pickLibraryClips } from '@/lib/stockLibrary'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

// Product rule: avatar videos are locked to the 45–60s band.
const MIN_DURATION = 45
const MAX_DURATION = 60

// Rate limit — max 3 avatar jobs per account inside a rolling window. The
// window approximates "simultaneous renders" (a VEED job takes a few minutes).
// In-memory: good enough per warm lambda for checkpoint 1; checkpoint 2
// replaces it with a DB-backed in-flight counter.
const RATE_WINDOW_MS = 5 * 60 * 1000
const RATE_MAX = 3
const recentJobs = new Map<string, number[]>()
function rateLimited(userId: string): boolean {
  const now = Date.now()
  const stamps = (recentJobs.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (stamps.length >= RATE_MAX) {
    recentJobs.set(userId, stamps)
    return true
  }
  stamps.push(now)
  recentJobs.set(userId, stamps)
  return false
}

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
    const engine: AvatarEngine = body.engine === 'omnihuman' ? 'omnihuman' : 'fabric'
    const hookMode = body.avatarMode === 'hook'

    // The face photo must be OUR storage URL (uploaded via /api/avatar/upload)
    // — never an arbitrary external URL (no SSRF / hot-linking surface).
    // Dry runs don't need a photo (voice-only).
    const avatarImageUrl = (body.avatarImageUrl ?? '').trim()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!dryRun && !avatarImageUrl.startsWith(`${supabaseUrl}/storage/v1/object/public/avatars/`)) {
      return NextResponse.json({ error: 'Please upload your photo first.' }, { status: 400 })
    }

    if (!dryRun && rateLimited(user.id)) {
      return NextResponse.json(
        { error: 'You have 3 avatar videos rendering already — please wait for one to finish.' },
        { status: 429 },
      )
    }

    // ── CP2 paywall — avatar videos are paid via the SEPARATE avatar_credits
    // add-on (never plan credits). This is only the upfront balance gate; the
    // actual 1-credit DEBIT happens on SUCCESS in compose/status, so a failed
    // VEED/render never charges (protection rule). The client turns this 402
    // into the avatar pack checkout modal ("paywall claro"). Voice dry runs
    // (internal, cents of TTS) skip the gate.
    if (!dryRun) {
      const { data: avProfile } = await supabase
        .from('profiles')
        .select('avatar_credits')
        .eq('id', user.id)
        .single()
      const avatarBalance = avProfile?.avatar_credits ?? 0
      if (avatarBalance < 1) {
        return NextResponse.json(
          {
            error: 'Avatar videos use Avatar Credits. Grab a pack to render this video.',
            upsell: 'avatar_pack',
            balance: avatarBalance,
          },
          { status: 402 },
        )
      }
    }

    const requested = Number(body.duration) || MIN_DURATION
    const duration = Math.max(MIN_DURATION, Math.min(MAX_DURATION, Math.round(requested)))
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
    const ttsSource = verbatim ? prompt : narration
    let audioBuffer: Buffer
    try {
      audioBuffer = await generateTTS(ttsSource, speed ?? 1.0, vertical, 'cinematic', language)
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
      imageUrl: avatarImageUrl,
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

    // ── 4. B-roll cutaways (best-effort) ─────────────────────────────────
    // Hook mode: b-roll carries everything after the hook → fetch up to 6.
    const queries = verbatim
      ? parsed.segments.map((s) => s.pexelsQuery).filter(Boolean)
      : [prompt.slice(0, 80)]
    const clipUrls = await fetchCutawayClips(queries, prompt, avatarHookSeconds != null ? 6 : 3)

    const estSeconds = avatarHookSeconds != null
      ? avatarHookSeconds
      : realAudioDuration > 4 ? realAudioDuration : duration
    const generationId = randomUUID()
    const usdPerSecond = engine === 'omnihuman' ? OMNIHUMAN_720P_USD_PER_SECOND : VEED_720P_USD_PER_SECOND
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
      // Cost contract for the UI ("estimated cost BEFORE render"). 1 avatar
      // video = 1 avatar credit; the USD figure is internal accounting.
      avatar_credits_needed: 1,
      estimated_seconds: Math.round(estSeconds),
      estimated_cost_usd: Number((estSeconds * usdPerSecond).toFixed(2)),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[generate-avatar] unexpected error:', msg)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
