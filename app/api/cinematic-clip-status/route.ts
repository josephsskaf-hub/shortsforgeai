// Push #315 — Cinematic Mode: polls fal.ai queue for clip generation status.
// Called by the client every 5s after /api/generate-video-cinematic.
// Returns status of each clip and their video URLs when complete.
import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

export const dynamic = 'force-dynamic'

// #368/#401 — must match generate-video-cinematic. Default Seedance; the client
// passes ?model= so a Pro (Kling) generation is polled on the Kling endpoint.
const SEEDANCE_MODEL = 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video'
const KLING_MODEL = 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video'
// Push #489 — Veo 3.1 Fast cinematic engine. Same { video: { url } } output, so
// checkFalClip parses it unchanged — only the allow-list needs the model id.
const VEO_MODEL = 'fal-ai/veo3.1/fast'
const SORA_MODEL = 'fal-ai/sora-2/text-to-video'
// KINEO-HOLLYWOOD-2026-07-09 — Kling 3 Pro (Hollywood dialogue scenes, native audio).
const KLING3_MODEL = 'fal-ai/kling-video/v3/pro/text-to-video'
// KINEO-HOLLYWOOD-30-2026-07-10 — Kling O3 Pro image-to-video: Hollywood 3.0
// anchored scenes (portrait/environment-still image_url). Same { video: { url } }
// output, so checkFalClip parses it unchanged — only the allow-list needs the id.
const KLING3_I2V_MODEL = 'fal-ai/kling-video/o3/pro/image-to-video'
// KINEO-HOLLYWOOD-HOST-2026-07-13 — Kling AI Avatar v2: Hollywood Host Mode
// v3.5 renders anchored DIALOGUE scenes on the AI Presenter engine (portrait
// anchor + our TTS of the line → one voice for the whole video). Same
// { video: { url } } output shape (verified against checkAvatarJob in
// lib/avatar/veed.ts), so checkFalClip parses it unchanged — only the
// allow-list needs the id. Without this entry the client's per-scene `models`
// array would null out host clips and poll them on the WRONG (default) queue.
const HOST_PRESENTER_MODEL = 'fal-ai/kling-video/ai-avatar/v2/standard'
const ALLOWED_MODELS = new Set([SEEDANCE_MODEL, KLING_MODEL, VEO_MODEL, SORA_MODEL, KLING3_MODEL, KLING3_I2V_MODEL, HOST_PRESENTER_MODEL])

type ClipStatus = {
  id: string | null
  status: 'pending' | 'processing' | 'done' | 'failed'
  url: string | null
}

async function checkFalClip(requestId: string, model: string): Promise<ClipStatus> {
  const falKey = process.env.FAL_KEY
  if (!falKey) return { id: requestId, status: 'failed', url: null }

  try {
    fal.config({ credentials: falKey })
    const st = await fal.queue.status(model, { requestId })
    const s = (st as { status?: string }).status

    if (s === 'IN_QUEUE') return { id: requestId, status: 'pending', url: null }
    if (s === 'IN_PROGRESS') return { id: requestId, status: 'processing', url: null }

    if (s === 'COMPLETED') {
      const res = await fal.queue.result(model, { requestId })
      const data = ((res as { data?: unknown }).data ?? res) as {
        video?: { url?: string }
        output?: { video?: { url?: string } }
      }
      const videoUrl = data?.video?.url ?? data?.output?.video?.url ?? null
      if (videoUrl) {
        console.log(`[cinematic-status] clip ${requestId} done: ${videoUrl.slice(0, 60)}`)
        return { id: requestId, status: 'done', url: videoUrl }
      }
      console.error(`[cinematic-status] clip ${requestId} completed but no video URL`)
      return { id: requestId, status: 'failed', url: null }
    }

    // FAILED or unknown
    return { id: requestId, status: 'failed', url: null }
  } catch (err) {
    console.error(`[cinematic-status] error checking ${requestId}:`, err)
    return { id: requestId, status: 'failed', url: null }
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const idsParam = searchParams.get('ids') ?? ''
    // #401 — which fal endpoint to poll. Defaults to Seedance for back-compat.
    const modelParam = searchParams.get('model') ?? ''
    const model = ALLOWED_MODELS.has(modelParam) ? modelParam : SEEDANCE_MODEL

    // KINEO-HOLLYWOOD-2026-07-09 — optional `models` param: a JSON array
    // PARALLEL to `ids` (Hollywood routes each scene to a different engine, and
    // the fal queue is per-model). Absent/invalid → single-model behavior as before.
    const modelsParam = searchParams.get('models') ?? ''
    let perClipModels: (string | null)[] = []
    if (modelsParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(modelsParam))
        if (Array.isArray(parsed)) {
          perClipModels = parsed.map((m) => (typeof m === 'string' && ALLOWED_MODELS.has(m) ? m : null))
        }
      } catch {
        perClipModels = []
      }
    }

    if (!idsParam) {
      return NextResponse.json({ error: 'ids parameter is required' }, { status: 400 })
    }

    // ids is a JSON array of strings/nulls (nulls = clips that failed to submit)
    let rawIds: (string | null)[]
    try {
      rawIds = JSON.parse(decodeURIComponent(idsParam))
    } catch {
      rawIds = idsParam.split(',').map((s) => s.trim() || null)
    }

    // Check each fal.ai request in parallel
    // KINEO-HOLLYWOOD-2026-07-09 — each clip polls ITS OWN model when the
    // parallel `models` array is present; otherwise the single shared model.
    const clips: ClipStatus[] = await Promise.all(
      rawIds.map((id, i) => {
        if (!id) return Promise.resolve({ id: null, status: 'failed' as const, url: null })
        return checkFalClip(id, perClipModels[i] ?? model)
      })
    )

    const allDone = clips.every((c) => c.status === 'done' || c.status === 'failed')
    const anyDone = clips.some((c) => c.status === 'done')
    const failedCount = clips.filter((c) => c.status === 'failed').length

    // If every clip failed, return an error
    if (failedCount === clips.length) {
      return NextResponse.json(
        { error: 'All clips failed to generate. Please try again.', clips },
        { status: 502 }
      )
    }

    return NextResponse.json({
      clips,
      allDone,
      anyDone,
      done: clips.filter((c) => c.status === 'done').length,
      total: clips.length,
      failed: failedCount,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[cinematic-clip-status] unexpected error:', msg)
    return NextResponse.json({ error: 'Status check failed.' }, { status: 500 })
  }
}
