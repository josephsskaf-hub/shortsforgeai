// Automation-friendly Animate API.
// POST imports a public image on the server, submits the same 5-credit Kling
// job used by /animate, and returns 202 + a status URL. GET returns clip_url
// when the asynchronous provider job is complete.
import { NextRequest, NextResponse } from 'next/server'
import { deleteOwnedAvatarPhoto, uploadAvatarPhoto } from '@/lib/avatar/storage'
import {
  acquireAnimateClaim,
  admitAnimateAttempt,
  animateValueHash,
  completeAnimateClaim,
  confirmAnimateDebit,
  deletePendingAnimateClaim,
  loadVerifiedAnimateJobByBilling,
  releaseAnimateClaim,
  type AnimateClaimResponse,
  type VerifiedAnimateClaim,
  validAnimateIdempotencyKey,
} from '@/lib/animate/claim'
import { authenticateAnimateRequest } from '@/lib/animate/requestAuth'
import {
  ANIMATE_COST,
  AnimateServiceError,
  getAnimateBalance,
  getAnimateJobStatus,
  normalizeAnimatePrompt,
  reconcileAnimateCreditRefund,
  reserveAnimateCredits,
  startAnimateJob,
} from '@/lib/animate/service'
import { downloadPublicAnimateImage, RemoteImageError } from '@/lib/animate/remoteImage'

export const maxDuration = 60
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const PENDING_RECONCILE_MS = 90_000
const MAX_RISKY_ATTEMPTS_PER_WINDOW = 10

function statusUrl(req: NextRequest, requestId: string): string {
  const url = new URL('/api/animate', req.nextUrl.origin)
  url.searchParams.set('request_id', requestId)
  return url.toString()
}

function acceptedResponse(req: NextRequest, response: AnimateClaimResponse, extra?: Record<string, unknown>) {
  return NextResponse.json(
    {
      status: 'processing',
      ...response,
      status_url: statusUrl(req, response.request_id),
      clip_url: null,
      poll_after_ms: 5000,
      ...extra,
    },
    {
      status: 202,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' },
    },
  )
}

function serviceError(error: AnimateServiceError | RemoteImageError, extra?: Record<string, unknown>) {
  const pending = error instanceof AnimateServiceError && error.details?.pending === true
  return NextResponse.json(
    { error: error.message, ...(error instanceof AnimateServiceError ? error.details ?? {} : {}), ...extra },
    {
      status: error.status,
      headers: {
        'Cache-Control': 'no-store',
        ...(pending ? { 'Retry-After': '5' } : {}),
      },
    },
  )
}

export async function POST(req: NextRequest) {
  let claim: VerifiedAnimateClaim | null = null
  let creditsReserved = false
  let providerStageStarted = false
  let importedImageUrl = ''
  try {
    const auth = await authenticateAnimateRequest(req)
    if (!auth) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })

    let body: {
      image_url?: unknown
      motion_prompt?: unknown
      duration?: unknown
      idempotency_key?: unknown
    }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const remoteUrl = typeof body.image_url === 'string' ? body.image_url.trim() : ''
    if (!remoteUrl) {
      return NextResponse.json({ error: 'image_url must be a public JPG or PNG URL.' }, { status: 400 })
    }
    const rawDuration = String(body.duration ?? '5')
    if (rawDuration !== '5' && rawDuration !== '10') {
      return NextResponse.json({ error: 'duration must be 5 or 10 seconds.' }, { status: 400 })
    }
    const duration = rawDuration as '5' | '10'
    const prompt = normalizeAnimatePrompt(body.motion_prompt)
    const headerKey = req.headers.get('idempotency-key')?.trim() ?? ''
    const bodyKey = typeof body.idempotency_key === 'string' ? body.idempotency_key.trim() : ''
    const idempotencyKey = headerKey || bodyKey
    if (!validAnimateIdempotencyKey(idempotencyKey)) {
      return NextResponse.json(
        { error: 'Send an Idempotency-Key header (8-100 letters, numbers, dot, colon, dash or underscore).' },
        { status: 400 },
      )
    }

    const fingerprint = animateValueHash({ image_url: remoteUrl, motion_prompt: prompt, duration })
    const acquired = await acquireAnimateClaim({
      userId: auth.user.id,
      idempotencyKey,
      fingerprint,
    })
    if (acquired.kind === 'error') {
      console.error('[api/animate] claim acquire failed:', acquired.error)
      return NextResponse.json(
        { error: 'Animate submission safety is temporarily unavailable. Nothing was submitted.' },
        { status: 503, headers: { 'Retry-After': '5' } },
      )
    }
    if (acquired.kind === 'conflict') {
      return NextResponse.json({ error: acquired.error }, { status: 409 })
    }
    if (acquired.kind === 'replay') {
      return acceptedResponse(req, acquired.response, { idempotent_replay: true })
    }
    if (acquired.kind === 'released') {
      return NextResponse.json(
        {
          error: 'This Animate attempt was closed after a confirmed refund. Start again with a new Idempotency-Key.',
          use_new_idempotency_key: true,
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      )
    }
    if (acquired.kind === 'pending') {
      // The provider mapping is published before the claim response. If the
      // original serverless invocation ended between those writes, recover
      // the exact signed response instead of leaving the key stuck or
      // submitting a duplicate paid job.
      const recovered = await loadVerifiedAnimateJobByBilling({
        userId: auth.user.id,
        billingReference: acquired.claim.billingReference,
      })
      if (recovered.ok === false) {
        console.error('[api/animate] pending claim recovery failed:', recovered.error)
        return NextResponse.json(
          { error: 'This Animate request is safe while its idempotency record is reconciled.', pending: true, retry_after_ms: 5000 },
          { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' } },
        )
      }
      if (recovered.job) {
        const response: AnimateClaimResponse = {
          request_id: recovered.job.requestId,
          image_url: recovered.job.imageUrl,
          duration: recovered.job.duration,
          credits_charged: ANIMATE_COST,
          balance: recovered.job.balance,
        }
        const saved = await completeAnimateClaim({
          claim: acquired.claim,
          idempotencyKey,
          response,
        })
        return acceptedResponse(req, response, {
          idempotent_replay: true,
          idempotency_saved: saved,
          recovered: true,
        })
      }

      const ageMs = Date.now() - Date.parse(acquired.claim.startedAt)
      const debit = await confirmAnimateDebit({
        userId: auth.user.id,
        billingReference: acquired.claim.billingReference,
      })
      if (debit.ok && debit.refunded) {
        const released = await releaseAnimateClaim({
          claim: acquired.claim,
          reason: 'refund_confirmed_before_job_publication',
        })
        return NextResponse.json(
          {
            error: released
              ? 'The previous Animate attempt was refunded and closed. Start again with a new Idempotency-Key.'
              : 'The previous refund is confirmed while its idempotency record is being closed.',
            use_new_idempotency_key: released,
            pending: !released,
          },
          {
            status: released ? 409 : 503,
            headers: { 'Cache-Control': 'no-store', ...(released ? {} : { 'Retry-After': '5' }) },
          },
        )
      }
      if (!debit.ok && debit.reason !== 'missing') {
        console.error('[api/animate] pending debit reconciliation failed:', debit.error)
        return NextResponse.json(
          { error: 'This Animate request is safe while its credit reservation is reconciled.', pending: true, retry_after_ms: 5000 },
          { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' } },
        )
      }
      if (Number.isFinite(ageMs) && ageMs >= PENDING_RECONCILE_MS) {
        let closeMode: 'delete' | 'release' | null = debit.ok ? 'release' : 'delete'
        if (debit.ok) {
          const refund = await reconcileAnimateCreditRefund({
            userId: auth.user.id,
            billingReference: acquired.claim.billingReference,
          })
          if (refund.state === 'unconfirmed') closeMode = null
          else if (refund.state === 'missing') closeMode = 'delete'
          else closeMode = 'release'
        }
        if (!closeMode) {
          return NextResponse.json(
            { error: 'The stale Animate attempt is being refunded. Retry this same key shortly.', pending: true, retry_after_ms: 5000 },
            { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' } },
          )
        }
        const closed = closeMode === 'release'
          ? await releaseAnimateClaim({ claim: acquired.claim, reason: 'stale_attempt_refunded' })
          : await deletePendingAnimateClaim(acquired.claim)
        return NextResponse.json(
          {
            error: closed
              ? closeMode === 'release'
                ? 'The stale Animate attempt was refunded and closed. Start again with a new Idempotency-Key.'
                : 'The stale pre-charge attempt was closed. Retry now with the same Idempotency-Key.'
              : 'The stale Animate attempt is still being reconciled.',
            use_new_idempotency_key: closed && closeMode === 'release',
            retry_same_idempotency_key: closed && closeMode === 'delete',
            pending: !closed,
          },
          {
            status: closed ? 409 : 503,
            headers: { 'Cache-Control': 'no-store', ...(!closed ? { 'Retry-After': '5' } : {}) },
          },
        )
      }
      return NextResponse.json(
        {
          status: 'pending',
          pending: true,
          error: 'This Animate request is already being submitted. Retry with the same Idempotency-Key shortly.',
          retry_after_ms: 3000,
        },
        { status: 409, headers: { 'Cache-Control': 'no-store', 'Retry-After': '3' } },
      )
    }
    claim = acquired.claim

    // Avoid remote egress/storage when this account cannot start the job.
    const balance = await getAnimateBalance(auth.supabase, auth.user.id)
    if (balance < ANIMATE_COST) {
      await deletePendingAnimateClaim(claim)
      claim = null
      return NextResponse.json(
        { error: `Animating a photo costs ${ANIMATE_COST} credits. You have ${balance}.`, balance },
        { status: 402 },
      )
    }

    // Reserve before touching the remote host or public storage. Besides
    // closing the provider billing race, this prevents the API from becoming
    // a free authenticated image proxy under parallel requests.
    const reservedBalance = await reserveAnimateCredits({
      supabase: auth.supabase,
      userId: auth.user.id,
      billingReference: claim.billingReference,
    })
    creditsReserved = true

    const admission = await admitAnimateAttempt({
      userId: auth.user.id,
      billingReference: claim.billingReference,
      refundedSinceIso: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      activeSinceIso: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      maxAttempts: MAX_RISKY_ATTEMPTS_PER_WINDOW,
    })
    if (!admission.ok || !admission.allowed) {
      const refund = await reconcileAnimateCreditRefund({
        userId: auth.user.id,
        billingReference: claim.billingReference,
      })
      if (refund.state !== 'refunded') {
        throw new AnimateServiceError(
          'Your Animate reservation is being reconciled. Nothing was submitted.',
          503,
          { pending: true, debitCommitted: true },
        )
      }
      const released = await releaseAnimateClaim({
        claim,
        reason: admission.ok ? 'attempt_window_limit_refunded' : 'admission_check_refunded',
      })
      if (!released) {
        throw new AnimateServiceError(
          'Your credits were refunded while this request is being closed.',
          503,
          { pending: true, debitRefunded: true },
        )
      }
      creditsReserved = false
      claim = null
      return NextResponse.json(
        {
          error: admission.ok
            ? 'Too many recent or refunded Animate attempts. Please wait before starting another batch.'
            : 'Animate safety checks are temporarily unavailable. Your credits were refunded.',
          use_new_idempotency_key: true,
        },
        {
          status: admission.ok ? 429 : 503,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': admission.ok ? '120' : '5',
          },
        },
      )
    }

    const remote = await downloadPublicAnimateImage(remoteUrl)
    const imageUrl = await uploadAvatarPhoto(auth.user.id, remote.buffer, remote.contentType)
    importedImageUrl = imageUrl
    providerStageStarted = true
    const result = await startAnimateJob({
      supabase: auth.supabase,
      userId: auth.user.id,
      imageUrl,
      prompt,
      duration,
      billingReference: claim.billingReference,
      prepaidBalance: reservedBalance,
    })
    const response: AnimateClaimResponse = {
      request_id: result.requestId,
      image_url: result.imageUrl,
      duration: result.duration,
      credits_charged: result.creditsCharged,
      balance: result.balance,
    }
    const idempotencySaved = await completeAnimateClaim({ claim, idempotencyKey, response })
    if (!idempotencySaved) {
      console.error(`[api/animate] job started but claim completion needs recovery request=${result.requestId}`)
    }
    return acceptedResponse(req, response, { idempotency_saved: idempotencySaved })
  } catch (error) {
    const retrySafe = error instanceof AnimateServiceError && error.details?.retrySafe === true
    const canReleaseClaim = !providerStageStarted || retrySafe
    const debitCommitted = error instanceof AnimateServiceError && error.details?.debitCommitted === true
    const debitUnknown = error instanceof AnimateServiceError && error.details?.debitUnknown === true
    const debitRefunded = error instanceof AnimateServiceError && error.details?.debitRefunded === true
    const knownDebit = creditsReserved || debitCommitted
    const debitMayExist = knownDebit || debitUnknown || debitRefunded
    let lifecycleReconciliationFailed = false
    let claimReleased = false
    if (claim && canReleaseClaim) {
      if (importedImageUrl) {
        await deleteOwnedAvatarPhoto(claim.userId, importedImageUrl)
      }
      if (debitMayExist) {
        const refund = await reconcileAnimateCreditRefund({
          userId: claim.userId,
          billingReference: claim.billingReference,
        })
        if (refund.state === 'unconfirmed' || (refund.state === 'missing' && debitMayExist)) {
          lifecycleReconciliationFailed = true
        } else if (refund.state === 'refunded') {
          claimReleased = await releaseAnimateClaim({ claim, reason: 'submission_closed_after_refund' })
          lifecycleReconciliationFailed = !claimReleased
        } else {
          const deleted = await deletePendingAnimateClaim(claim)
          lifecycleReconciliationFailed = !deleted
        }
      } else {
        const deleted = await deletePendingAnimateClaim(claim)
        lifecycleReconciliationFailed = !deleted
      }
    }
    if (lifecycleReconciliationFailed) {
      return NextResponse.json(
        {
          error: 'Your image was not submitted while we reconcile its credit reservation. Retry this same Idempotency-Key in 90 seconds.',
          pending: true,
          retry_after_ms: PENDING_RECONCILE_MS,
        },
        { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '90' } },
      )
    }
    if (error instanceof AnimateServiceError || error instanceof RemoteImageError) {
      return serviceError(error, claimReleased ? { use_new_idempotency_key: true } : undefined)
    }
    console.error('[api/animate] unexpected POST error:', error instanceof Error ? error.message : String(error))
    if (claim && providerStageStarted) {
      return NextResponse.json(
        {
          error: 'This Animate submission is being reconciled. Retry the same Idempotency-Key shortly.',
          pending: true,
          retry_after_ms: 5000,
        },
        { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' } },
      )
    }
    return NextResponse.json({ error: 'Could not start the animation. Please try again.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateAnimateRequest(req)
    if (!auth) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })

    const requestId = (req.nextUrl.searchParams.get('request_id') ?? '').trim()
    const state = await getAnimateJobStatus({ userId: auth.user.id, requestId })
    if (state.status === 'done' && state.videoUrl) {
      return NextResponse.json(
        { status: 'done', request_id: requestId, clip_url: state.videoUrl, video_url: state.videoUrl },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }
    if (state.status === 'failed') {
      const refunded = state.creditsRefunded ?? 0
      return NextResponse.json(
        {
          status: 'failed',
          request_id: requestId,
          clip_url: null,
          credits_refunded: refunded,
          error: refunded > 0
            ? `Generation failed. Your ${refunded} credits were automatically refunded.`
            : 'Animation generation failed. You were not charged.',
        },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      )
    }
    return NextResponse.json(
      { status: state.status, request_id: requestId, clip_url: null, poll_after_ms: 5000 },
      { status: 202, headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' } },
    )
  } catch (error) {
    if (error instanceof AnimateServiceError) return serviceError(error)
    console.error('[api/animate] unexpected GET error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Could not check the animation status.' }, { status: 500 })
  }
}
