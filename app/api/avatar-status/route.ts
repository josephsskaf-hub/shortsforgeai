// AI Avatar (feature/ai-avatar) — polls the fal queue for the VEED Fabric job
// submitted by /api/generate-avatar. Mirrors /api/cinematic-clip-status (#315).
// The client polls every ~5s; on `done` it kicks /api/compose with the
// avatar video as the main track.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkAvatarJob, type AvatarEngine } from '@/lib/avatar/veed'
import { refundRenderCredits } from '@/lib/credits/refund'

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

    // Face-app wave 1 — the fal queue is per-model, so the poll must use the
    // same engine the job was submitted with ('fabric' default | 'omnihuman').
    const engineParam = (req.nextUrl.searchParams.get('engine') ?? '').trim()
    const engine: AvatarEngine =
      engineParam === 'omnihuman' ? 'omnihuman'
      : engineParam === 'lipsync' ? 'lipsync'
      : engineParam === 'animate' ? 'animate'
      : 'fabric'

    const state = await checkAvatarJob(requestId, engine)

    if (state.status === 'failed') {
      // Protection rule: a VEED failure never charges the user (checkpoint 1
      // has no billing at all; checkpoint 2's debit only happens on success).
      //
      // AUTO-REFUND (TAAFT feedback) — the Animate flow is the exception: it
      // debits upfront, keyed `animate-<request_id>`. On failure, refund that
      // exact ledger row. Idempotent (the RPC only claims rows WHERE
      // refunded_at IS NULL), so repeated polls of a failed job can never
      // double-refund.
      let creditsRefunded = 0
      if (engine === 'animate') {
        creditsRefunded = await refundRenderCredits(`animate-${requestId}`)
      }
      return NextResponse.json({
        status: 'failed',
        video_url: null,
        creditsRefunded,
        error:
          creditsRefunded > 0
            ? `Generation failed. Your ${creditsRefunded} credits were automatically refunded — please try again.`
            : 'Avatar generation failed. You were not charged — please try again.',
      })
    }

    return NextResponse.json({ status: state.status, video_url: state.videoUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[avatar-status] unexpected error:', msg)
    return NextResponse.json({ error: 'Status check failed.' }, { status: 500 })
  }
}
