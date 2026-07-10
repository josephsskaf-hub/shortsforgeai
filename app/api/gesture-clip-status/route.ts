// KINEO-GESTURE-2026-07-10 — gesture-clip poller (Feature 3).
// Two stages, one endpoint:
//   stage=animate  → polls the Kling i2v job; when done, AUTO-SUBMITS the
//                    VEED background-removal (matte) job and returns
//                    { stage:'matte', matte_request_id } for the next polls.
//   stage=matte    → polls the matte job; done → transparent WebM URL.
// Failure at ANY stage auto-refunds `gesture-<request_id>` (idempotent RPC —
// repeated polls can never double-refund; same pattern as animate-image).
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAvatarJob, checkMatteJob, submitMatteJob } from '@/lib/avatar/veed'
import { refundRenderCredits } from '@/lib/credits/refund'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    const requestId = (req.nextUrl.searchParams.get('request_id') ?? '').trim()
    if (!requestId) {
      return NextResponse.json({ error: 'request_id is required.' }, { status: 400 })
    }
    const stage = (req.nextUrl.searchParams.get('stage') ?? 'animate').trim()
    const matteId = (req.nextUrl.searchParams.get('matte_id') ?? '').trim()

    async function failWithRefund(msg: string) {
      const creditsRefunded = await refundRenderCredits(`gesture-${requestId}`)
      return NextResponse.json({
        status: 'failed',
        video_url: null,
        creditsRefunded,
        error: creditsRefunded > 0
          ? `${msg} Your ${creditsRefunded} credits were automatically refunded — please try again.`
          : `${msg} Please try again.`,
      })
    }

    if (stage === 'matte' && matteId) {
      const matte = await checkMatteJob(matteId)
      if (matte.status === 'failed') return failWithRefund('Transparency processing failed.')
      if (matte.status === 'done') {
        return NextResponse.json({ status: 'done', stage: 'matte', video_url: matte.videoUrl })
      }
      return NextResponse.json({ status: matte.status, stage: 'matte', matte_request_id: matteId })
    }

    // stage 'animate'
    const anim = await checkAvatarJob(requestId, 'animate')
    if (anim.status === 'failed') return failWithRefund('Clip generation failed.')
    if (anim.status === 'done' && anim.videoUrl) {
      // Auto-advance: submit the matte job so the client just keeps polling.
      const newMatteId = await submitMatteJob(anim.videoUrl)
      if (!newMatteId) return failWithRefund('Transparency processing could not start.')
      console.log(`[gesture-clip-status] animate done → matte submitted request=${requestId} matte=${newMatteId}`)
      return NextResponse.json({
        status: 'processing',
        stage: 'matte',
        matte_request_id: newMatteId,
        // The raw (non-transparent) MP4, in case the user wants both.
        raw_video_url: anim.videoUrl,
      })
    }
    return NextResponse.json({ status: anim.status, stage: 'animate' })
  } catch (err) {
    console.error('[gesture-clip-status] unexpected error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Status check failed.' }, { status: 500 })
  }
}
