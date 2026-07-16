// AI Avatar — VEED Fabric 1.0 integration (talking-head from photo + audio).
// Runs on fal.ai (same client/key as Seedance/Kling). Takes a public image URL
// + a public audio URL and returns a public MP4 URL of the person speaking.
// Pricing: 8¢/s @480p, 15¢/s @720p. Output shape: { video: { url } }.
//
// Protection rule (#avatar): the caller must only DEBIT an avatar credit AFTER
// this resolves successfully. We retry ONCE automatically before failing, and
// throw on failure so the route can skip the debit + tell the user.
import { fal } from '@fal-ai/client'
// KINEO-FAL-ALERT-LIB-2026-07-10 — founder alarm when fal balance is exhausted
// (incident 10/07: avatar engines failed silently while fal was at $0).
import { alertFalExhausted, looksExhausted } from '@/lib/falAlert'

// fal model id for VEED Fabric 1.0 (https://fal.ai/models/veed/fabric-1.0).
// `veed/fabric-1.0` is the standard model; `veed/fabric-1.0/fast` is the 2.5x
// faster variant. Keep 720p for the premium quality bar the product promises.
const VEED_FABRIC_MODEL = 'veed/fabric-1.0'

// Face-app wave 1 (12/06) — second avatar engine: ByteDance OmniHuman v1.5
// (https://fal.ai/models/fal-ai/bytedance/omnihuman/v1.5). Animates the WHOLE
// figure in the photo — body, hands, gestures follow the audio's emotion —
// where Fabric is a head/shoulders talking head. Same FAL_KEY, same queue
// pattern. $0.16/s @720p (vs Fabric $0.15/s); 720p supports up to 60s audio
// (1080p caps at 30s, so the 45-60s product lock forces 720p here).
const OMNIHUMAN_MODEL = 'fal-ai/bytedance/omnihuman/v1.5'

// Avatar Studio (12/06) — third engine: video-source lip-sync. The user
// uploads a short VIDEO of themselves (instead of a photo) and sync.so's
// lipsync model re-animates the mouth to our narration mp3. Same fal queue.
const LIPSYNC_MODEL = 'fal-ai/sync-lipsync/v3'

// Animate (13/06) — image-to-video: brings a REAL PHOTO to life with motion
// (Upwork-demand feature). Kling 2.5 Turbo Pro: best quality/price on fal at
// ~$0.07/s (~$0.35 per 5s clip).
const ANIMATE_MODEL = 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video'

// KINEO-PRESENTER-2026-07-10 — AI Presenter engine: Kling AI Avatar v2
// Standard (https://fal.ai/models/fal-ai/kling-video/ai-avatar/v2/standard).
// Photo + audio → realistic talking human with native lip-sync, at $0.0562/s
// — ~1/3 of VEED Fabric's $0.15/s ($3.37 vs $9.00 per 60s video). Input is
// { image_url, audio_url } (NO resolution param); output { video: { url } }.
// Validated demand: the #1 recurring ask across Upwork AI-video jobs (09-10/07).
// KINEO-HOLLYWOOD-HOST-2026-07-13 — now EXPORTED: Hollywood Host Mode v3.5
// renders anchored dialogue scenes on this same engine (portrait anchor +
// our TTS of the spoken line) so the host keeps ONE voice across every scene.
export const PRESENTER_MODEL = 'fal-ai/kling-video/ai-avatar/v2/standard'
export const PRESENTER_PRO_MODEL = 'fal-ai/kling-video/ai-avatar/v2/pro'

// KINEO-PRESENTER-MOTION-2026-07-10 — Joseph's feedback on the first prod
// render: the body stayed FROZEN (only lips moved). Kling AI Avatar v2
// accepts an optional `prompt` (default ".") that directs the performance —
// this makes the presenter move like a real host: hands, posture, head,
// energy following the speech instead of a static portrait with moving lips.
// KINEO-HOLLYWOOD-HOST-2026-07-13 — extracted to an exported const so the
// Hollywood host scenes reuse the exact same production-validated direction
// (lib/hollywood/hostVoice.ts appends the plan's character/style sheets).
export const PRESENTER_PERFORMANCE_PROMPT =
  'the person speaks directly to the camera like a charismatic presenter: natural expressive hand gestures emphasizing key words, subtle head and shoulder movement, engaged body language that matches the rhythm of the speech, realistic natural motion'

export const PRESENTER_ENERGETIC_PERFORMANCE_PROMPT =
  'the person speaks directly to the camera with upbeat presenter energy: lively but controlled visible-hand gestures, confident head and shoulder movement, expressive posture matching the rhythm of the speech, realistic natural motion, stable camera, preserve the exact face and appearance'

export const OMNIHUMAN_PERFORMANCE_PROMPT =
  'A stable medium shot holds on the person speaking directly to the camera. Use natural head, shoulder, torso, and visible-hand movement that follows the speech. Keep the person centered and preserve the exact face, clothing, body proportions, and background. No sudden pose changes, no invented limbs, and no camera shake.'

export const OMNIHUMAN_ENERGETIC_PERFORMANCE_PROMPT =
  'A stable medium shot holds on the person speaking enthusiastically to the camera. Use energetic but controlled head, shoulder, torso, and visible-hand gestures that emphasize key words and follow the speech rhythm. Keep the person centered and preserve the exact face, clothing, body proportions, and background. No sudden pose changes, no invented limbs, and no camera shake.'

/** Which model animates the avatar. 'presenter'/'presenter_pro' = Kling AI
 *  Avatar v2 talking human; 'fabric' = VEED talking head from a photo (legacy
 *  default); 'omnihuman' = full-figure body & gestures from a photo ("Pro");
 *  'lipsync' = re-voice a real VIDEO of the person (Avatar Studio); 'animate'
 *  = image-to-video motion (no narration). */
export type AvatarEngine = 'presenter' | 'presenter_pro' | 'fabric' | 'omnihuman' | 'lipsync' | 'animate'
export type PerformanceStyle = 'natural' | 'energetic'

/** Server-owned directions only. Routes should map trusted style enums here
 * instead of forwarding arbitrary client prompts to a provider. */
export function performancePromptFor(
  engine: AvatarEngine | undefined,
  style: PerformanceStyle = 'natural',
): string | undefined {
  if (engine === 'omnihuman') {
    return style === 'energetic'
      ? OMNIHUMAN_ENERGETIC_PERFORMANCE_PROMPT
      : OMNIHUMAN_PERFORMANCE_PROMPT
  }
  if (engine === 'presenter' || engine === 'presenter_pro') {
    return style === 'energetic'
      ? PRESENTER_ENERGETIC_PERFORMANCE_PROMPT
      : PRESENTER_PERFORMANCE_PROMPT
  }
  return undefined
}

function modelFor(engine: AvatarEngine | undefined): string {
  if (engine === 'presenter') return PRESENTER_MODEL
  if (engine === 'presenter_pro') return PRESENTER_PRO_MODEL
  if (engine === 'omnihuman') return OMNIHUMAN_MODEL
  if (engine === 'lipsync') return LIPSYNC_MODEL
  if (engine === 'animate') return ANIMATE_MODEL
  return VEED_FABRIC_MODEL
}

/**
 * Animate (13/06) — submit an image-to-video job (photo + motion prompt).
 * Same single-submit queue pattern as submitAvatarJob; polled via checkAvatarJob
 * with engine='animate'.
 */
export async function submitAnimateJob(args: {
  imageUrl: string
  prompt: string
  /** '5' | '10' seconds (Kling i2v accepted durations). */
  duration?: '5' | '10'
}): Promise<string | null> {
  if (!process.env.FAL_KEY) return null
  const input: Record<string, unknown> = {
    image_url: args.imageUrl,
    prompt: args.prompt,
    duration: args.duration ?? '5',
  }
  // Widen to plain string so the fal client uses its generic (untyped-input)
  // overload — same pattern as submitAvatarJob below. The endpoint literal
  // otherwise selects a typed overload that rejects Record<string, unknown>.
  const model: string = ANIMATE_MODEL
  try {
    return await submitQueueOnce(model, input)
  } catch (err) {
    const e = err as { status?: number; message?: string }
    console.error('[animate] single queue submit failed:', JSON.stringify({
      status: err instanceof AvatarSubmitError ? err.status : e?.status,
      ambiguous: err instanceof AvatarSubmitError ? err.ambiguous : true,
      message: e?.message,
    }))
    if (looksExhausted(e)) void alertFalExhausted('animate submit')
    // A transport failure after POST may still mean FAL accepted the paid job.
    // Propagate that uncertainty so callers never tell the user to submit a
    // second job. Explicit provider rejections remain safe to retry.
    if (err instanceof AvatarSubmitError && err.ambiguous) throw err
    return null
  }
}

export interface AvatarVideoResult {
  videoUrl: string
  /** seconds of generated video, when fal returns it (for cost accounting). */
  durationSeconds: number | null
}

interface FabricInput {
  image_url: string
  audio_url: string
  resolution: '480p' | '720p'
}

/**
 * Generate the talking-avatar clip. Resolves to the MP4 URL or throws.
 * `fal.subscribe` handles the async queue + polling internally and returns the
 * final result, so the caller doesn't manage request ids.
 */
async function callFabricOnce(input: FabricInput): Promise<AvatarVideoResult> {
  const result = (await fal.subscribe(VEED_FABRIC_MODEL, { input })) as {
    data?: { video?: { url?: string }; duration?: number }
    video?: { url?: string }
  }
  const url = result?.data?.video?.url ?? result?.video?.url ?? null
  if (!url) {
    throw new Error('VEED Fabric returned no video URL.')
  }
  const durationSeconds =
    typeof result?.data?.duration === 'number' ? result.data.duration : null
  return { videoUrl: url, durationSeconds }
}

/**
 * Generate the avatar video with ONE automatic retry (protection rule).
 * Throws after the retry also fails — the caller catches this and must NOT
 * debit the user's avatar credit, then surfaces a friendly error.
 */
export async function generateAvatarVideo(args: {
  imageUrl: string
  audioUrl: string
  resolution?: '480p' | '720p'
}): Promise<AvatarVideoResult> {
  const input: FabricInput = {
    image_url: args.imageUrl,
    audio_url: args.audioUrl,
    resolution: args.resolution ?? '720p',
  }
  try {
    return await callFabricOnce(input)
  } catch (firstErr) {
    const msg = firstErr instanceof Error ? firstErr.message : String(firstErr)
    console.warn('[avatar/veed] first attempt failed, retrying once:', msg)
    try {
      return await callFabricOnce(input)
    } catch (secondErr) {
      const msg2 = secondErr instanceof Error ? secondErr.message : String(secondErr)
      console.error('[avatar/veed] retry also failed:', msg2)
      throw new Error(`Avatar generation failed: ${msg2}`)
    }
  }
}

// 720p VEED Fabric price (USD) per second — for the "estimated cost" shown to
// the user BEFORE render, and for internal cost accounting.
export const VEED_720P_USD_PER_SECOND = 0.15
export const VEED_480P_USD_PER_SECOND = 0.08
// OmniHuman v1.5 @720p — slightly above Fabric; surfaced in the cost estimate.
export const OMNIHUMAN_720P_USD_PER_SECOND = 0.16
// KINEO-PRESENTER-2026-07-10 — Kling AI Avatar v2 Standard ($0.0562/s on fal).
export const PRESENTER_USD_PER_SECOND = 0.0562
// Kling AI Avatar v2 Pro — higher-fidelity presenter endpoint ($0.115/s on fal).
export const PRESENTER_PRO_USD_PER_SECOND = 0.115

// ── Queue mode (used by /api/generate-avatar + /api/avatar-status) ──────────
// VEED takes minutes for a 45-60s talking head, far beyond a Vercel function
// budget, so the orchestrator route SUBMITS to the fal queue and the client
// polls /api/avatar-status — the same submit/poll pattern as Seedance/Kling
// (#315). fal.subscribe (above) stays for any future worker/queue-less use.

function configureFal(): boolean {
  const key = process.env.FAL_KEY
  if (!key) return false
  fal.config({ credentials: key })
  return true
}

export class AvatarSubmitError extends Error {
  readonly ambiguous: boolean
  readonly status: number | null

  constructor(message: string, options: { ambiguous: boolean; status?: number | null; cause?: unknown }) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'AvatarSubmitError'
    this.ambiguous = options.ambiguous
    this.status = options.status ?? null
  }
}

/**
 * The fal SDK retries queue POSTs on gateway errors and transport failures.
 * That is unsafe for paid creation calls because the first POST may already
 * have been accepted. Send one raw queue POST and let the durable caller claim
 * decide whether an explicit rejection may be retried.
 */
async function submitQueueOnce(model: string, input: Record<string, unknown>): Promise<string> {
  const key = process.env.FAL_KEY
  if (!key) {
    throw new AvatarSubmitError('FAL_KEY is not configured', { ambiguous: false })
  }

  let response: Response
  try {
    response = await fetch(`https://queue.fal.run/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${key}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      cache: 'no-store',
    })
  } catch (error) {
    throw new AvatarSubmitError('Avatar provider submit transport failed', {
      ambiguous: true,
      cause: error,
    })
  }

  const raw = await response.text().catch(() => '')
  let payload: Record<string, unknown> = {}
  try {
    payload = raw ? JSON.parse(raw) as Record<string, unknown> : {}
  } catch {
    payload = {}
  }

  if (!response.ok) {
    const providerMessage = typeof payload.detail === 'string'
      ? payload.detail
      : typeof payload.error === 'string'
        ? payload.error
        : raw.slice(0, 300)
    // Gateway/server failures and request timeouts cannot prove that the queue
    // did not accept the job. Keep the server claim pending and never re-POST.
    const ambiguous = response.status === 408 || response.status >= 500
    throw new AvatarSubmitError(
      `Avatar provider rejected submit (${response.status})${providerMessage ? `: ${providerMessage}` : ''}`,
      { ambiguous, status: response.status },
    )
  }

  const requestId = typeof payload.request_id === 'string' ? payload.request_id.trim() : ''
  if (!requestId) {
    throw new AvatarSubmitError('Avatar provider response had no request id', {
      ambiguous: true,
      status: response.status,
    })
  }
  return requestId
}

/**
 * Submit the avatar job to the fal queue exactly once. The caller owns a
 * durable generation claim, so an ambiguous response is never blindly
 * re-posted and an explicit rejection can be surfaced without charging.
 */
export async function submitAvatarJob(args: {
  /** Face photo URL — fabric/omnihuman engines. */
  imageUrl?: string
  /** Source VIDEO URL — lipsync engine (Avatar Studio video mode). */
  videoUrl?: string
  audioUrl: string
  resolution?: '480p' | '720p'
  engine?: AvatarEngine
  /** Optional server-owned performance direction for presenter,
   * presenter_pro, or omnihuman. Hollywood host scenes pass the gesture prompt
   * PLUS the plan's characterSheet/styleSheet so the avatar clip matches the
   * anchored look. Absent/empty → the safe per-engine default below. */
  performancePrompt?: string
}): Promise<string> {
  const model = modelFor(args.engine)
  const performancePrompt =
    args.performancePrompt?.trim() || performancePromptFor(args.engine, 'natural')
  // lipsync re-voices a video (video_url + audio_url); presenter variants
  // (Kling AI Avatar v2) take image_url + audio_url with NO resolution param;
  // OmniHuman also accepts a body/camera prompt; Fabric only accepts the
  // legacy image_url + audio_url + resolution input.
  const input: Record<string, unknown> =
    args.engine === 'lipsync'
      ? { video_url: args.videoUrl, audio_url: args.audioUrl, sync_mode: 'cut_off' }
      : args.engine === 'presenter' || args.engine === 'presenter_pro'
        ? {
            image_url: args.imageUrl,
            audio_url: args.audioUrl,
            // KINEO-PRESENTER-MOTION-2026-07-10 — performance direction (see
            // the exported const above for the full rationale).
            // KINEO-HOLLYWOOD-HOST-2026-07-13 — callers may override with an
            // enriched prompt (host scenes add character/style sheets);
            // default keeps every existing presenter render identical.
            prompt: performancePrompt,
          }
        : args.engine === 'omnihuman'
          ? {
              image_url: args.imageUrl,
              audio_url: args.audioUrl,
              resolution: args.resolution ?? '720p',
              prompt: performancePrompt,
              turbo_mode: false,
            }
          : {
            image_url: args.imageUrl,
            audio_url: args.audioUrl,
            resolution: args.resolution ?? '720p',
          }
  try {
    return await submitQueueOnce(model, input)
  } catch (err) {
    const e = err as { status?: number; body?: unknown; message?: string; name?: string }
    console.error(`[avatar/veed] single queue submit (${model}) failed:`, JSON.stringify({
      name: e?.name,
      status: err instanceof AvatarSubmitError ? err.status : e?.status,
      ambiguous: err instanceof AvatarSubmitError ? err.ambiguous : true,
      message: e?.message,
      body: e?.body,
    }))
      // KINEO-FAL-ALERT-LIB-2026-07-10 — exhausted balance → e-mail the founder.
    if (looksExhausted(e)) void alertFalExhausted(`avatar submit model=${model}`)
    throw err
  }
}

export type AvatarJobState = {
  status: 'pending' | 'processing' | 'done' | 'failed'
  videoUrl: string | null
}

// ── KINEO-GESTURE-2026-07-10 — transparent gesture clips (Feature 3) ────────
// Stage 2 of the gesture pipeline: VEED video background removal on fal
// (https://fal.ai/models/veed/video-background-removal/fast). Input
// { video_url, output_codec:'vp9' } → WebM with EMBEDDED ALPHA channel — the
// e-learning deliverable (Articulate Storyline etc.) clients pay $100+/pack
// for on Upwork. No green screen needed (person auto-matted).
const MATTE_MODEL = 'veed/video-background-removal/fast'

/** Submit the background-removal job for a finished gesture clip. */
export async function submitMatteJob(videoUrl: string): Promise<string | null> {
  if (!configureFal()) return null
  const model: string = MATTE_MODEL
  const input: Record<string, unknown> = {
    video_url: videoUrl,
    output_codec: 'vp9', // single WebM with embedded alpha
    refine_foreground_edges: true,
    subject_is_person: true,
  }
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { request_id } = await fal.queue.submit(model, { input })
      if (request_id) return request_id
    } catch (err) {
      const e = err as { status?: number; message?: string }
      console.error(`[gesture/matte] queue submit attempt ${attempt} failed:`, JSON.stringify({ status: e?.status, message: e?.message }))
      if (looksExhausted(e)) void alertFalExhausted('gesture matte submit')
      if (attempt === 1) await new Promise((r) => setTimeout(r, 800))
    }
  }
  return null
}

/** Poll the matte job. Output shape: { video: [{ url, content_type }] }. */
export async function checkMatteJob(requestId: string): Promise<AvatarJobState> {
  if (!configureFal()) return { status: 'failed', videoUrl: null }
  try {
    const st = await fal.queue.status(MATTE_MODEL, { requestId })
    const s = (st as { status?: string }).status
    if (s === 'IN_QUEUE') return { status: 'pending', videoUrl: null }
    if (s === 'IN_PROGRESS') return { status: 'processing', videoUrl: null }
    if (s === 'COMPLETED') {
      const res = await fal.queue.result(MATTE_MODEL, { requestId })
      const data = ((res as { data?: unknown }).data ?? res) as {
        video?: Array<{ url?: string }> | { url?: string }
      }
      const url = Array.isArray(data?.video)
        ? data.video[0]?.url ?? null
        : (data?.video as { url?: string } | undefined)?.url ?? null
      if (url) return { status: 'done', videoUrl: url }
      console.error(`[gesture/matte] job ${requestId} completed but returned no video URL`)
      return { status: 'failed', videoUrl: null }
    }
    return { status: 'failed', videoUrl: null }
  } catch (err) {
    console.error(`[gesture/matte] status check failed for ${requestId}:`, err instanceof Error ? err.message : String(err))
    return { status: 'failed', videoUrl: null }
  }
}

/** Poll the fal queue for the avatar job (mirrors cinematic-clip-status). */
export async function checkAvatarJob(requestId: string, engine?: AvatarEngine): Promise<AvatarJobState> {
  if (!configureFal()) return { status: 'failed', videoUrl: null }
  const model = modelFor(engine)
  try {
    const st = await fal.queue.status(model, { requestId })
    const s = (st as { status?: string }).status
    if (s === 'IN_QUEUE') return { status: 'pending', videoUrl: null }
    if (s === 'IN_PROGRESS') return { status: 'processing', videoUrl: null }
    if (s === 'COMPLETED') {
      const res = await fal.queue.result(model, { requestId })
      const data = ((res as { data?: unknown }).data ?? res) as {
        video?: { url?: string }
        output?: { video?: { url?: string } }
      }
      const url = data?.video?.url ?? data?.output?.video?.url ?? null
      if (url) return { status: 'done', videoUrl: url }
      console.error(`[avatar/veed] job ${requestId} completed but returned no video URL`)
      return { status: 'failed', videoUrl: null }
    }
    return { status: 'failed', videoUrl: null }
  } catch (err) {
    console.error(`[avatar/veed] status check failed for ${requestId}:`, err instanceof Error ? err.message : String(err))
    // A queue-status request can fail while the already-paid provider job keeps
    // running (network reset, 429, provider 5xx). Treat transport exceptions as
    // retryable; only an explicit terminal queue state above is allowed to make
    // the clients discard their resumable snapshot and offer a fresh submit.
    return { status: 'processing', videoUrl: null }
  }
}
