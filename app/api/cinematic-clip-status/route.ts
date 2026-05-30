// Push #315 — Cinematic Mode: polls fal.ai queue for clip generation status.
// Called by the client every 5s after /api/generate-video-cinematic.
// Returns status of each clip and their video URLs when complete.
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const FAL_MODEL = 'fal-ai/wan/v2.1/1.3b/text-to-video'
const FAL_QUEUE_BASE = `https://queue.fal.run/${FAL_MODEL}`
// fal.ai queue status/result live under the APP base (first two id segments,
// e.g. fal-ai/wan), NOT the full versioned model path. Submitting to the full
// path works, but polling the full path 405s — fal returns these as status_url/
// response_url. Derive the app base so status + result hit the right endpoint.
const FAL_APP_BASE = `https://queue.fal.run/${FAL_MODEL.split('/').slice(0, 2).join('/')}`

type ClipStatus = {
  id: string | null
  status: 'pending' | 'processing' | 'done' | 'failed'
  url: string | null
  dbg?: string
}

async function checkFalClip(requestId: string): Promise<ClipStatus> {
  const falKey = process.env.FAL_KEY
  if (!falKey) return { id: requestId, status: 'failed', url: null }

  try {
    // Check status first
    const statusRes = await fetch(
      `${FAL_APP_BASE}/requests/${requestId}/status`,
      { headers: { 'Authorization': `Key ${falKey}` } }
    )

    if (!statusRes.ok) {
      const body = await statusRes.text().catch(() => '')
      console.error(`[cinematic-status] status check failed for ${requestId}: ${statusRes.status} body=${body.slice(0,300)}`)
      return { id: requestId, status: 'failed', url: null, dbg: `HTTP ${statusRes.status} :: ${body.slice(0,160)}` }
    }

    const statusData = await statusRes.json()
    const falStatus = statusData.status as string

    if (falStatus === 'IN_QUEUE' || falStatus === 'IN_PROGRESS') {
      return { id: requestId, status: falStatus === 'IN_QUEUE' ? 'pending' : 'processing', url: null }
    }

    if (falStatus === 'FAILED') {
      console.error(`[cinematic-status] clip ${requestId} failed:`, statusData.error)
      return { id: requestId, status: 'failed', url: null, dbg: `FAILED :: ${JSON.stringify(statusData.error ?? statusData).slice(0,200)}` }
    }

    if (falStatus === 'COMPLETED') {
      // Fetch the actual result
      const resultRes = await fetch(
        `${FAL_APP_BASE}/requests/${requestId}`,
        { headers: { 'Authorization': `Key ${falKey}` } }
      )

      if (!resultRes.ok) {
        const rbody = await resultRes.text().catch(() => '')
        console.error(`[cinematic-status] result fetch failed for ${requestId}: ${resultRes.status}`)
        return { id: requestId, status: 'failed', url: null, dbg: `RESULT HTTP ${resultRes.status} :: ${rbody.slice(0,150)}` }
      }

      const result = await resultRes.json()
      // fal.ai Wan 2.1 output: { video: { url, content_type } }
      const videoUrl = result.video?.url ?? result.output?.video?.url ?? null

      if (videoUrl) {
        console.log(`[cinematic-status] clip ${requestId} done: ${videoUrl.slice(0, 60)}`)
        return { id: requestId, status: 'done', url: videoUrl }
      }

      console.error(`[cinematic-status] clip ${requestId} completed but no video URL in result:`, JSON.stringify(result).slice(0, 200))
      return { id: requestId, status: 'failed', url: null, dbg: `NO_URL :: ${JSON.stringify(result).slice(0,180)}` }
    }

    // Unknown status
    return { id: requestId, status: 'pending', url: null }
  } catch (err) {
    console.error(`[cinematic-status] error checking ${requestId}:`, err)
    return { id: requestId, status: 'failed', url: null, dbg: `EXC :: ${err instanceof Error ? err.message : String(err)}` }
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const idsParam = searchParams.get('ids') ?? ''

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
    const clips: ClipStatus[] = await Promise.all(
      rawIds.map((id) => {
        if (!id) return Promise.resolve({ id: null, status: 'failed' as const, url: null })
        return checkFalClip(id)
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
