// AI Avatar — VEED Fabric 1.0 integration (talking-head from photo + audio).
// Runs on fal.ai (same client/key as Seedance/Kling). Takes a public image URL
// + a public audio URL and returns a public MP4 URL of the person speaking.
// Pricing: 8¢/s @480p, 15¢/s @720p. Output shape: { video: { url } }.
//
// Protection rule (#avatar): the caller must only DEBIT an avatar credit AFTER
// this resolves successfully. We retry ONCE automatically before failing, and
// throw on failure so the route can skip the debit + tell the user.
import { fal } from '@fal-ai/client'

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
const LIPSYNC_MODEL = 'fal-ai/sync-lipsync'

/** Which model animates the avatar. 'fabric' = talking head from a photo
 *  (default); 'omnihuman' = full-figure body & gestures from a photo ("Pro");
 *  'lipsync' = re-voice a real VIDEO of the person (Avatar Studio). */
export type AvatarEngine = 'fabric' | 'omnihuman' | 'lipsync'

function modelFor(engine: AvatarEngine | undefined): string {
  if (engine === 'omnihuman') return OMNIHUMAN_MODEL
  if (engine === 'lipsync') return LIPSYNC_MODEL
  return VEED_FABRIC_MODEL
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

/**
 * Submit the avatar job to the fal queue with ONE automatic retry (protection
 * rule: a transient submit reject must not fail the user's render). Returns
 * the request id, or null when fal could not accept the job at all — the
 * caller then surfaces the error WITHOUT charging anything.
 */
export async function submitAvatarJob(args: {
  /** Face photo URL — fabric/omnihuman engines. */
  imageUrl?: string
  /** Source VIDEO URL — lipsync engine (Avatar Studio video mode). */
  videoUrl?: string
  audioUrl: string
  resolution?: '480p' | '720p'
  engine?: AvatarEngine
}): Promise<string | null> {
  if (!configureFal()) return null
  const model = modelFor(args.engine)
  // lipsync re-voices a video (video_url + audio_url); the photo engines
  // animate a still (image_url + audio_url + resolution).
  const input: Record<string, unknown> =
    args.engine === 'lipsync'
      ? { video_url: args.videoUrl, audio_url: args.audioUrl }
      : {
          image_url: args.imageUrl,
          audio_url: args.audioUrl,
          resolution: args.resolution ?? '720p',
        }
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { request_id } = await fal.queue.submit(model, { input })
      if (request_id) return request_id
    } catch (err) {
      const e = err as { status?: number; body?: unknown; message?: string; name?: string }
      console.error(`[avatar/veed] queue submit attempt ${attempt} (${model}) failed:`, JSON.stringify({
        name: e?.name, status: e?.status, message: e?.message, body: e?.body,
      }))
      if (attempt === 1) await new Promise((r) => setTimeout(r, 800))
    }
  }
  return null
}

export type AvatarJobState = {
  status: 'pending' | 'processing' | 'done' | 'failed'
  videoUrl: string | null
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
    return { status: 'failed', videoUrl: null }
  }
}
