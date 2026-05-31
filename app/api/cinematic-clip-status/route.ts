// Push #315 — Cinematic Mode: polls fal.ai queue for clip generation status.
// Called by the client every 5s after /api/generate-video-cinematic.
// Returns status of each clip and their video URLs when complete.
import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

export const dynamic = 'force-dynamic'

const FAL_MODEL = 'fal-ai/wan/v2.1/1.3b/text-to-video'
// fal's queue status/result are keyed by the APP base (first 2 id segments,
// e.g. fal-ai/wan), not the full versioned endpoint. Submit uses FAL_MODEL;
// status/result use FAL_APP so the client builds the correct queue URLs.
const FAL_APP = FAL_MODEL.split('/').slice(0, 2).join('/')

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
    fal.config({ credentials: falKey })
    const st = await fal.queue.status(FAL_APP, { requestId })
    const s = (st as { status?: string }).status

    if (s === 'IN_QUEUE') return { id: requestId, status: 'pending', url: null }
    if (s === 'IN_PROGRESS') return { id: requestId, status: 'processing', url: null }

    if (s === 'COMPLETED') {
      const res = await fal.queue.result(FAL_APP, { requestId })
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
    return { id: requestId, status: 'failed', url: null, dbg: `STATUS=${String(s)}` }
  } catch (err) {
    console.error(`[cinematic-status] error checking ${requestId}:`, err)
    return { id: requestId, status: 'failed', url: null, dbg: `EXC=${err instanceof Error ? (err.name + ': ' + err.message) : String(err)}` }
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
