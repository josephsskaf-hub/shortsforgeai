// AI Avatar (feature/ai-avatar) — polls the fal queue for the VEED Fabric job
// submitted by /api/generate-avatar. Mirrors /api/cinematic-clip-status (#315).
// The client polls every ~5s; on `done` it kicks /api/compose with the
// avatar video as the main track.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkAvatarJob, type AvatarEngine } from '@/lib/avatar/veed'
import { refundRenderCredits } from '@/lib/credits/refund'
import {
  bindAvatarCompletedVideo,
  confirmAvatarBirthDebit,
  loadVerifiedAvatarClaimForRequest,
  refundAvatarBirthDebitForFailedRequest,
} from '@/lib/avatar/reservation'

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
      : engineParam === 'presenter_pro' ? 'presenter_pro'
      // KINEO-PRESENTER-2026-07-10 — Kling AI Avatar v2 engine.
      : engineParam === 'presenter' ? 'presenter'
      : 'fabric'

    // Provider request ids are capabilities, not browser authority. Every poll
    // must prove the authenticated owner before querying FAL. Modern avatar
    // jobs use avatar_jobs plus a signed-claim fallback; legacy Animate uses
    // its debit ledger (and optionally avatar_jobs) as the ownership record.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Status safety check is temporarily unavailable.' }, { status: 503 })
    }
    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    if (engine === 'animate') {
      const [{ data: job, error: jobError }, { data: debit, error: debitError }] = await Promise.all([
        admin
          .from('avatar_jobs')
          .select('request_id,user_id,engine')
          .eq('request_id', requestId)
          .maybeSingle(),
        admin
          .from('credit_debits')
          .select('render_id,user_id')
          .eq('render_id', `animate-${requestId}`)
          .maybeSingle(),
      ])
      if (jobError || debitError) {
        console.error('[avatar-status] animate owner lookup failed:', jobError?.message ?? debitError?.message)
        return NextResponse.json({ error: 'Status safety check is temporarily unavailable.' }, { status: 503 })
      }
      const owned =
        (job?.user_id === user.id && job?.engine === 'animate') ||
        debit?.user_id === user.id
      if (!owned) return NextResponse.json({ error: 'Avatar job not found.' }, { status: 404 })
    } else {
      const { data: job, error: jobError } = await admin
        .from('avatar_jobs')
        .select('request_id,user_id,engine')
        .eq('request_id', requestId)
        .maybeSingle()
      if (jobError) {
        console.error('[avatar-status] owner lookup failed:', jobError.message)
        return NextResponse.json({ error: 'Status safety check is temporarily unavailable.' }, { status: 503 })
      }

      // avatar_jobs is only a rate-limit/lookup aid. Authorization comes from
      // the server-signed birth claim, so a permissive or accidentally changed
      // RLS policy on the auxiliary table can never grant provider polling.
      const verified = await loadVerifiedAvatarClaimForRequest({ userId: user.id, requestId })
      if (!verified.ok) {
        console.error('[avatar-status] signed owner verification failed:', verified.error)
        return NextResponse.json({ error: 'Status safety check is temporarily unavailable.' }, { status: 503 })
      }
      const jobConflicts = Boolean(job && (job.user_id !== user.id || job.engine !== engine))
      if (!verified.claim || verified.claim.engine !== engine || jobConflicts) {
        return NextResponse.json({ error: 'Avatar job not found.' }, { status: 404 })
      }
    }

    const state = await checkAvatarJob(requestId, engine)

    if (state.status === 'failed') {
      // Protection rule: all paid avatar providers debit before submission and
      // refund their exact deterministic ledger key on terminal failure.
      // Idempotent refund RPCs ensure repeated polls can never double-refund.
      let creditsRefunded = 0
      if (engine === 'animate') {
        creditsRefunded = await refundRenderCredits(`animate-${requestId}`)
      } else {
        const refunded = await refundAvatarBirthDebitForFailedRequest({ userId: user.id, requestId })
        if (!refunded.ok) {
          console.warn(`[avatar-hold] failed provider refund could not be settled request=${requestId}: ${refunded.error}`)
          return NextResponse.json(
            { error: 'Finalizing your automatic avatar refund. Please retry this status check.' },
            { status: 503 },
          )
        }
        creditsRefunded = refunded.credits
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

    if (state.status === 'done' && state.videoUrl && engine !== 'animate') {
      // Bind the exact Fal URL into the signed birth claim and confirm the
      // deterministic upfront debit before any raw paid MP4 leaves the server.
      const bound = await bindAvatarCompletedVideo({
        userId: user.id,
        requestId,
        engine,
        videoUrl: state.videoUrl,
      })
      if (!bound.ok || !bound.claim) {
        console.error('[avatar-status] completed URL binding failed:', bound.ok ? 'claim missing' : bound.error)
        return NextResponse.json(
          { error: 'Your avatar is ready while we verify secure delivery. Please retry this status check.' },
          { status: 503 },
        )
      }
      const debit = await confirmAvatarBirthDebit({
        userId: user.id,
        generationId: bound.claim.generationId,
        creditCost: bound.claim.creditCost,
      })
      if (!debit.ok) {
        console.error('[avatar-status] completed avatar debit verification failed:', debit.error)
        return NextResponse.json(
          { error: 'Your avatar is ready while we verify its credit charge. Please retry this status check.' },
          { status: 503 },
        )
      }
    }

    return NextResponse.json({ status: state.status, video_url: state.videoUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[avatar-status] unexpected error:', msg)
    return NextResponse.json({ error: 'Status check failed.' }, { status: 500 })
  }
}
