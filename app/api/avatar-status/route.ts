// AI Avatar (feature/ai-avatar) — polls the fal queue for the VEED Fabric job
// submitted by /api/generate-avatar. Mirrors /api/cinematic-clip-status (#315).
// The client polls every ~5s; on `done` it kicks /api/compose with the
// avatar video as the main track.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { checkAvatarJob, type AvatarEngine } from '@/lib/avatar/veed'
import { refundRenderCredits } from '@/lib/credits/refund'
import { settleAvatarCreditHoldForFailedRequest } from '@/lib/avatar/reservation'
import {
  AVATAR_CLAIM_EVENT,
  AVATAR_CLAIM_PATH,
  avatarClaimId,
  avatarValueHash,
  validAvatarGenerationId,
  verifyAvatarClaim,
} from '@/lib/avatar/claim'

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

      let owned = job?.user_id === user.id && job?.engine === engine
      if (!owned && !job) {
        const { data: claim, error: claimError } = await admin
          .from('events')
          .select('id,user_id,path,session_id,metadata')
          .eq('name', AVATAR_CLAIM_EVENT)
          .eq('user_id', user.id)
          .contains('metadata', { response: { avatar_request_id: requestId } })
          .limit(1)
          .maybeSingle()
        if (claimError) {
          console.error('[avatar-status] signed owner fallback failed:', claimError.message)
          return NextResponse.json({ error: 'Status safety check is temporarily unavailable.' }, { status: 503 })
        }
        const metadata = claim?.metadata && typeof claim.metadata === 'object'
          ? claim.metadata as Record<string, unknown>
          : {}
        const generationId = typeof claim?.session_id === 'string' ? claim.session_id : ''
        const fingerprint = typeof metadata.fingerprint === 'string' ? metadata.fingerprint : ''
        const responseHash = typeof metadata.response_hash === 'string' ? metadata.response_hash : ''
        const claimStatus = metadata.status === 'settled' ? 'settled' : metadata.status === 'done' ? 'done' : null
        const creditCost = typeof metadata.credit_cost === 'number' && Number.isInteger(metadata.credit_cost)
          ? metadata.credit_cost
          : null
        const response = metadata.response && typeof metadata.response === 'object' && !Array.isArray(metadata.response)
          ? metadata.response as Record<string, unknown>
          : null
        owned = Boolean(
          claim && response && claimStatus && validAvatarGenerationId(generationId) && fingerprint && responseHash && creditCost !== null &&
          claim.id === avatarClaimId(user.id, generationId) &&
          claim.path === AVATAR_CLAIM_PATH &&
          response.avatar_request_id === requestId && response.engine === engine &&
          avatarValueHash(response) === responseHash &&
          verifyAvatarClaim(serviceRoleKey, {
            claimId: claim.id as string,
            userId: user.id,
            generationId,
            status: claimStatus,
            fingerprint,
            creditCost,
            responseHash,
          }, metadata.authority)
        )
      }
      if (!owned) {
        return NextResponse.json({ error: 'Avatar job not found.' }, { status: 404 })
      }
    }

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
      } else {
        const released = await settleAvatarCreditHoldForFailedRequest({ userId: user.id, requestId })
        if (!released) console.warn(`[avatar-hold] failed provider hold could not be settled request=${requestId}`)
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
