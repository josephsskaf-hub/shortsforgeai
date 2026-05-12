import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRunwayTask, extractVideoUrl } from '@/lib/runway'

export const maxDuration = 30

// In-memory dedup of refunds within a serverless instance. The key is
// `${userId}:${sortedTaskIds}` so the same poll never refunds twice while the
// instance is warm. Cold starts can theoretically re-refund (worst case: the
// user gets back an extra credit), but this avoids requiring a schema change.
const REFUNDED_GENERATIONS = new Set<string>()

async function refundCredits(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  cost: number,
  generationId: string,
  reason: string
): Promise<void> {
  if (cost <= 0) return
  try {
    const { data: profile, error: lookupErr } = await supabase
      .from('profiles')
      .select('video_credits')
      .eq('id', userId)
      .single()
    if (lookupErr) {
      console.error(`[generate-video] refund lookup failed for user ${userId}:`, lookupErr.message)
      return
    }
    const current = profile?.video_credits ?? 0
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ video_credits: current + cost })
      .eq('id', userId)
    if (updateErr) {
      console.error(`[generate-video] refund update failed for user ${userId}:`, updateErr.message)
      return
    }
    console.log(`[generate-video] credits refunded: ${cost} for user ${userId} (generation: ${generationId}, reason: ${reason})`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[generate-video] refund threw for user ${userId}:`, msg)
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!process.env.RUNWAY_API_KEY) {
      return NextResponse.json(
        { error: 'Video service is not configured.' },
        { status: 500 }
      )
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
    }

    const tasksParam = req.nextUrl.searchParams.get('tasks') ?? ''
    const ids = tasksParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    if (ids.length === 0) {
      return NextResponse.json({ error: 'Missing tasks parameter.' }, { status: 400 })
    }
    if (ids.length > 8) {
      return NextResponse.json({ error: 'Too many tasks requested.' }, { status: 400 })
    }

    // Client tells us how much was charged so we can refund the exact amount if
    // the whole generation fails. Clamped to [1, 2] — those are the only valid
    // costs in /api/generate-video (basic/basic_ai = 1, pro = 2).
    const costParam = req.nextUrl.searchParams.get('cost')
    const claimedCost = costParam && /^\d+$/.test(costParam) ? parseInt(costParam, 10) : 1
    const refundCost = Math.min(2, Math.max(1, claimedCost))

    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const state = await getRunwayTask(id)
          console.log(`[runway] poll task_id=${id} status=${state.status} output=${state.outputUrl?.slice(0, 120) ?? 'null'}`)

          // Rule 1 — when SUCCEEDED, extract the real video URL. If the URL
          // is missing or looks like an intermediate image, downgrade the
          // returned status to FAILED so the client never treats this clip
          // as completed.
          if (state.status === 'SUCCEEDED') {
            const videoUrl = extractVideoUrl(state)
            if (!videoUrl) {
              console.error(`[generate-video] task ${id} SUCCEEDED but no usable video URL — marking FAILED`)
              return {
                id: state.id,
                status: 'FAILED' as const,
                progress: state.progress,
                videoUrl: null as string | null,
                failure: state.failure ?? 'No video file in Runway output.',
              }
            }
            console.log(`[generate-video] video_url saved: ${videoUrl.slice(0, 120)} (task ${id})`)
            return {
              id: state.id,
              status: state.status,
              progress: state.progress,
              videoUrl,
              failure: state.failure,
            }
          }

          return {
            id: state.id,
            status: state.status,
            progress: state.progress,
            videoUrl: null as string | null,
            failure: state.failure,
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`[generate-video/status] task ${id} lookup error:`, msg)
          return {
            id,
            status: 'FAILED' as const,
            progress: null,
            videoUrl: null as string | null,
            failure: msg,
          }
        }
      })
    )

    const done = results.every(
      (r) => r.status === 'SUCCEEDED' || r.status === 'FAILED' || r.status === 'CANCELLED'
    )
    const playable = results.filter((r) => r.status === 'SUCCEEDED' && r.videoUrl).length
    const anyFailed = results.some((r) => r.status === 'FAILED' || r.status === 'CANCELLED')
    const succeeded = results.filter((r) => r.status === 'SUCCEEDED').length

    // Rule 4 — when the generation is fully done and produced zero playable
    // clips, refund the credits that were optimistically deducted in
    // /api/generate-video. Idempotent via the in-memory Set so repeated polls
    // don't refund twice.
    let refunded = false
    if (done && playable === 0) {
      const generationId = [...ids].sort().join(',')
      const refundKey = `${user.id}:${generationId}`
      if (!REFUNDED_GENERATIONS.has(refundKey)) {
        REFUNDED_GENERATIONS.add(refundKey)
        await refundCredits(
          supabase,
          user.id,
          refundCost,
          generationId,
          'all clips failed or returned no video URL'
        )
        refunded = true
      } else {
        console.log(`[generate-video] refund skipped (already refunded): user=${user.id} generation=${generationId}`)
      }
    }

    return NextResponse.json({
      done,
      anyFailed,
      succeeded,
      playable,
      refunded,
      total: results.length,
      tasks: results,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[generate-video/status] unexpected error:', msg)
    return NextResponse.json(
      { error: 'Status lookup failed. Please retry.' },
      { status: 500 }
    )
  }
}
