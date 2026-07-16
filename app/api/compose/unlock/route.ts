import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import {
  buildCreatomateSource,
  CreatomateSubmitError,
  estimateMp3DurationSeconds,
  generateTTS,
  scaleVoiceoverScript,
  submitCreatomateRender,
  targetWordCount,
  transcribeTTSWithTimestamps,
  uploadVoiceoverToSupabase,
  type WhisperWord,
} from '@/lib/compose'
import { stripScriptMarkers } from '@/lib/scriptParser'
import { getBackgroundMusicUrl } from '@/lib/pixabayMusic'
// KINEO-CREDIT-INTENT-2026-07-11 — record the engine + intended cost for the
// clean re-render so /api/compose/status bills it from the server-side intent
// (not the client ?quality param), exactly like /api/compose does.
import { creditCostFor } from '@/lib/credits/engineCost'
import { inspectActiveComposeCreditHolds } from '@/lib/credits/composeHold'
import { recordRenderIntent } from '@/lib/credits/renderIntent'
import {
  COMPOSE_CLAIM_EVENT,
  COMPOSE_CLAIM_PATH,
  composeClaimId,
  signComposeClaim,
  verifyComposeClaim,
} from '@/lib/composeClaim'
import { createHash } from 'node:crypto'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

type UnlockSubmissionCacheEntry = { promise: Promise<string>; expiresAt: number }
const unlockSubmissionCache = new Map<string, UnlockSubmissionCacheEntry>()

function submitUnlockOnce(source: Record<string, unknown>, key: string): Promise<string> {
  const now = Date.now()
  for (const [cachedKey, entry] of unlockSubmissionCache) {
    if (entry.expiresAt <= now) unlockSubmissionCache.delete(cachedKey)
  }
  const cached = unlockSubmissionCache.get(key)
  if (cached) return cached.promise
  const entry: UnlockSubmissionCacheEntry = {
    promise: Promise.resolve(''),
    expiresAt: now + 30_000,
  }
  entry.promise = submitCreatomateRender(source).then(
    (renderId) => {
      entry.expiresAt = Date.now() + 10 * 60 * 1000
      return renderId
    },
    (error) => {
      if (!(error instanceof CreatomateSubmitError && error.ambiguous)) {
        unlockSubmissionCache.delete(key)
      }
      throw error
    },
  )
  unlockSubmissionCache.set(key, entry)
  return entry.promise
}

// KINEO-WM-CHECKOUT-2026-07-07 — "watermark moment" inline unlock.
//
// When a FREE-plan user's video finishes it carries a burnt-in watermark
// (see /api/compose → buildCreatomateSource, track 9 — it is baked into the MP4,
// so removing it REQUIRES a fresh render). The post-render CTA sells the $4.90
// recurring Starter intro (25 credits/month, sets profiles.has_paid=true). On
// return, the client calls THIS route with the EXACT compositing inputs. Legacy
// paid Starter Pack sessions remain valid so existing buyers do not break.
//
// This route:
//   1. Verifies the Stripe Checkout Session is PAID and belongs to this user.
//      It talks to Stripe directly, so it works even before the async webhook
//      lands (and in staging where the webhook may not be wired). No credits are
//      granted here — the webhook remains the single grantor of plan/pack
//      credits (so there is zero double-credit risk).
//   2. Sets profiles.has_paid=true (idempotent safety net; the webhook does too).
//   3. Re-renders the SAME video with watermark:false and returns render_id.
//      The client then polls the normal /api/compose/status pipeline, which
//      migrates the asset to permanent storage + writes Visual History exactly
//      like any Fast render. The clean composition costs 1 credit; if the
//      webhook grant has not landed yet, the route returns a retryable pending
//      response before any provider submission.
//
// NOTE: no exploit surface for FREE renders — the clean re-render flows through
// the standard credit path, so replaying a session_id only ever spends the
// user's own credits (same as making a normal Fast video).

interface UnlockBody {
  session_id?: string
  clip_urls?: string[]
  voiceover_script?: string
  scene_captions?: string[]
  duration?: number
  topic?: string
  language?: string
  vertical?: string
  speed?: number
}

// Keep the clean re-render identical to the just-created Fast preview.
const SUPPORTED_DURATIONS = [10, 30, 45, 50, 60, 90] as const

export async function POST(req: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json({ error: 'Storage backend is not configured.' }, { status: 500 })
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Payment service is not configured.' }, { status: 500 })
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: UnlockBody
    try {
      body = (await req.json()) as UnlockBody
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const sessionId = (body.session_id ?? '').trim()
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required.' }, { status: 400 })
    }

    const clipUrls = Array.isArray(body.clip_urls)
      ? body.clip_urls.filter((u) => typeof u === 'string' && u.trim().length > 0)
      : []
    const voiceoverScript = stripScriptMarkers(body.voiceover_script ?? '')

    // ── 1) Verify the Stripe Checkout Session (webhook-independent) ──────────
    let paidOk = false
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      const belongsToUser =
        session.metadata?.supabase_user_id === user.id || session.client_reference_id === user.id
      const isPack =
        session.mode === 'payment' && session.metadata?.pack === 'starter10'
      const subscriptionTier = session.metadata?.tier
      let isEligibleSubscription =
        session.mode === 'subscription' &&
        (subscriptionTier === 'starter' || subscriptionTier === 'basic' || subscriptionTier === 'pro')
      if (isEligibleSubscription) {
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id
        if (!subscriptionId) {
          isEligibleSubscription = false
        } else {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          isEligibleSubscription = subscription.status === 'active' || subscription.status === 'trialing'
        }
      }
      paidOk =
        session.payment_status === 'paid' &&
        session.status === 'complete' &&
        belongsToUser &&
        (isPack || isEligibleSubscription)
      if (!paidOk) {
        console.warn('[compose/unlock] session not eligible', {
          id: sessionId.slice(0, 12),
          mode: session.mode,
          payment_status: session.payment_status,
          belongsToUser,
          isPack,
          isEligibleSubscription,
        })
      }
    } catch (err) {
      console.error('[compose/unlock] stripe session retrieve failed:', err instanceof Error ? err.message : String(err))
      return NextResponse.json({ error: 'Could not verify your purchase. Please try again.' }, { status: 502 })
    }
    if (!paidOk) {
      return NextResponse.json({ error: 'This purchase could not be verified.' }, { status: 402 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    // One paid Checkout Session unlocks one clean re-render. A deterministic,
    // server-signed claim lets reloads and lost HTTP responses converge on the
    // same Creatomate job instead of spending another render.
    const generationId = `unlock_${createHash('sha256').update(sessionId).digest('hex').slice(0, 32)}`
    const claimId = composeClaimId(user.id, generationId)
    const submissionCacheKey = `${user.id}:${generationId}`
    const intendedCost = creditCostFor('fast', true)
    let ownsSubmissionClaim = false

    const claimUnavailable = () => NextResponse.json(
      { error: 'Your clean render safety check is temporarily unavailable. Please refresh in a moment.' },
      { status: 503 },
    )

    const responseForClaim = async (row: unknown): Promise<NextResponse> => {
      const claim = row as { id?: unknown; name?: unknown; user_id?: unknown; path?: unknown; session_id?: unknown; metadata?: unknown } | null
      if (
        claim?.id !== claimId || claim.name !== COMPOSE_CLAIM_EVENT ||
        claim.user_id !== user.id || claim.path !== COMPOSE_CLAIM_PATH ||
        claim.session_id !== generationId
      ) {
        console.error('[compose/unlock] deterministic claim collision:', claimId)
        return claimUnavailable()
      }
      const metadata = claim.metadata && typeof claim.metadata === 'object'
        ? claim.metadata as Record<string, unknown>
        : {}
      const status = metadata.status === 'done' ? 'done' : metadata.status === 'pending' ? 'pending' : null
      const renderId = typeof metadata.render_id === 'string' ? metadata.render_id.trim() : ''
      if (
        !status || metadata.generation_id !== generationId || metadata.quality !== 'fast' ||
        metadata.cost !== intendedCost ||
        !verifyComposeClaim(serviceRoleKey, {
          claimId,
          userId: user.id,
          generationId,
          status,
          ...(renderId ? { renderId } : {}),
          quality: 'fast',
          cost: intendedCost,
        }, metadata.authority)
      ) {
        console.error('[compose/unlock] rejected unsigned/invalid claim:', claimId)
        return claimUnavailable()
      }
      if (status === 'done' && renderId) {
        return NextResponse.json({ verified: true, render_id: renderId, quality: 'fast', resumed: true })
      }
      const cached = unlockSubmissionCache.get(submissionCacheKey)
      if (cached && cached.expiresAt > Date.now()) {
        try {
          const recoveredRenderId = await cached.promise
          const intentStored = await recordRenderIntent({
            renderId: recoveredRenderId,
            userId: user.id,
            quality: 'fast',
            cost: intendedCost,
          })
          const recoveredMetadata = {
            generation_id: generationId,
            status: 'done',
            render_id: recoveredRenderId,
            quality: 'fast',
            cost: intendedCost,
            credit_hold: true,
            completed_at: new Date().toISOString(),
            authority: signComposeClaim(serviceRoleKey, {
              claimId,
              userId: user.id,
              generationId,
              status: 'done',
              renderId: recoveredRenderId,
              quality: 'fast',
              cost: intendedCost,
            }),
          }
          const { data: recovered } = await admin
            .from('events')
            .update({ metadata: recoveredMetadata })
            .eq('id', claimId)
            .eq('user_id', user.id)
            .eq('name', COMPOSE_CLAIM_EVENT)
            .select('id')
            .maybeSingle()
          if (intentStored || recovered?.id === claimId) {
            return NextResponse.json({
              verified: true,
              render_id: recoveredRenderId,
              quality: 'fast',
              resumed: true,
            })
          }
        } catch {
          // Ambiguous provider submissions remain pending and are never posted again.
        }
      }
      return NextResponse.json(
        { error: 'Your clean render is already being submitted.', pending: true, retry_after_ms: 3000 },
        { status: 409 },
      )
    }

    const { data: existingClaim, error: existingClaimError } = await admin
      .from('events')
      .select('id,name,user_id,path,session_id,metadata')
      .eq('id', claimId)
      .maybeSingle()
    if (existingClaimError) {
      console.error('[compose/unlock] claim preflight failed:', existingClaimError.message)
      return claimUnavailable()
    }
    if (existingClaim) return await responseForClaim(existingClaim)

    // ── 2) Safety-net: mark payment history. Clean output still requires the
    //    one-credit balance below; has_paid alone is never an entitlement.
    try {
      await admin.from('profiles').update({ has_paid: true }).eq('id', user.id)
    } catch (err) {
      // Non-fatal — the webhook will set it too; the clean render below still runs.
      console.warn('[compose/unlock] has_paid set failed (non-fatal):', err instanceof Error ? err.message : String(err))
    }

    // A legitimate buyer may return in another browser or after clearing local
    // storage. Confirm the purchase before the client unlocks paid UI even when
    // there are no captured inputs to re-compose on this device.
    if (clipUrls.length === 0 || !voiceoverScript) {
      return NextResponse.json({ verified: true, render_id: null })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'AI service is not configured.' }, { status: 500 })
    }
    if (!process.env.CREATOMATE_API_KEY) {
      return NextResponse.json({ error: 'Render service is not configured.' }, { status: 500 })
    }

    const releaseExplicitlyRejectedClaim = async (): Promise<void> => {
      if (!ownsSubmissionClaim) return
      const { error: releaseError } = await admin
        .from('events')
        .delete()
        .eq('id', claimId)
        .eq('user_id', user.id)
        .eq('name', COMPOSE_CLAIM_EVENT)
      if (releaseError) {
        console.error('[compose/unlock] explicit rejection claim release failed:', releaseError.message)
      } else {
        ownsSubmissionClaim = false
      }
    }

    // Acquire the deterministic provider mutex and credit hold BEFORE script
    // scaling, TTS, Whisper or uploads. Parallel returns from the same checkout
    // converge here without duplicating any provider cost.
    const { error: claimInsertError } = await admin.from('events').insert({
      id: claimId,
      user_id: user.id,
      name: COMPOSE_CLAIM_EVENT,
      path: COMPOSE_CLAIM_PATH,
      session_id: generationId,
      metadata: {
        generation_id: generationId,
        status: 'pending',
        quality: 'fast',
        cost: intendedCost,
        credit_hold: true,
        authority: signComposeClaim(serviceRoleKey, {
          claimId,
          userId: user.id,
          generationId,
          status: 'pending',
          quality: 'fast',
          cost: intendedCost,
        }),
      },
    })
    if (claimInsertError) {
      if (claimInsertError.code !== '23505') {
        console.error('[compose/unlock] claim insert failed:', claimInsertError.message)
        return claimUnavailable()
      }
      const { data: racedClaim, error: racedClaimError } = await admin
        .from('events')
        .select('id,name,user_id,path,session_id,metadata')
        .eq('id', claimId)
        .maybeSingle()
      if (racedClaimError || !racedClaim) {
        console.error('[compose/unlock] claim race recheck failed:', racedClaimError?.message ?? 'claim missing')
        return claimUnavailable()
      }
      return await responseForClaim(racedClaim)
    }
    ownsSubmissionClaim = true

    const holds = await inspectActiveComposeCreditHolds({
      db: admin,
      secret: serviceRoleKey,
      userId: user.id,
      currentClaimId: claimId,
    })
    if (!holds.ok || !holds.currentSeen) {
      console.error('[compose/unlock] credit hold audit failed:', holds.ok ? 'current claim missing' : holds.error)
      await releaseExplicitlyRejectedClaim()
      return claimUnavailable()
    }

    // Wait for the webhook's credit grant before spending provider money. The
    // client treats this deterministic unlock as pending and reconnects.
    const { data: creditProfile, error: creditProfileError } = await admin
      .from('profiles')
      .select('video_credits')
      .eq('id', user.id)
      .single()
    if (creditProfileError) {
      console.error('[compose/unlock] credit verification failed:', creditProfileError.message)
      await releaseExplicitlyRejectedClaim()
      return NextResponse.json(
        { error: 'Your purchase is confirmed. Waiting for your credits…', pending: true, retry_after_ms: 2500 },
        { status: 503 },
      )
    }
    const availableCredits = Math.max(0, Number(creditProfile?.video_credits ?? 0))
    if (holds.totalHeld > availableCredits) {
      await releaseExplicitlyRejectedClaim()
      return NextResponse.json(
        { error: 'Your purchase is confirmed. Waiting for an available credit…', pending: true, retry_after_ms: 2500 },
        { status: 409 },
      )
    }

    // ── 3) Rebuild the SAME Fast video, clean (watermark:false) ──────────────
    const requestedDuration = Number(body.duration) || 45
    const duration = (SUPPORTED_DURATIONS as readonly number[]).includes(requestedDuration)
      ? requestedDuration
      : 45
    const language = body.language === 'pt' ? 'pt' : body.language === 'es' ? 'es' : 'en'
    const vertical =
      typeof body.vertical === 'string' && body.vertical.trim() ? body.vertical.trim().toLowerCase() : undefined
    const explicitSpeed: number | null = (() => {
      const s = Number(body.speed)
      return Number.isFinite(s) && s > 0 ? Math.max(0.7, Math.min(1.3, s)) : null
    })()
    const sceneCaptions = Array.isArray(body.scene_captions)
      ? body.scene_captions.map((c) => (typeof c === 'string' ? c.trim() : '')).filter((c) => c.length > 0)
      : []

    // Mirror /api/compose scaling: verbatim (explicit speed) is used as-is; a
    // generated brief is scaled to the duration's word target. Falls back safely.
    let scaledScript: string
    if (explicitSpeed != null) {
      scaledScript = voiceoverScript
    } else {
      try {
        scaledScript = await scaleVoiceoverScript(voiceoverScript, targetWordCount(duration))
        if (!scaledScript) scaledScript = voiceoverScript
      } catch {
        scaledScript = voiceoverScript
      }
    }

    let audioBuffer: Buffer
    try {
      audioBuffer = await generateTTS(scaledScript, explicitSpeed ?? 1.0, vertical, 'free', language)
    } catch (err) {
      console.error('[compose/unlock] TTS failed:', err instanceof Error ? err.message : String(err))
      await releaseExplicitlyRejectedClaim()
      return NextResponse.json({ error: 'Voiceover generation failed. Please try again.' }, { status: 502 })
    }
    if (!audioBuffer || audioBuffer.length === 0) {
      await releaseExplicitlyRejectedClaim()
      return NextResponse.json({ error: 'Voiceover generation returned no audio.' }, { status: 502 })
    }

    const realAudioDuration = estimateMp3DurationSeconds(audioBuffer)

    // Captions (best-effort word-level sync, same as /api/compose).
    let whisperWords: WhisperWord[] | undefined
    try {
      const words = await transcribeTTSWithTimestamps(audioBuffer)
      if (words.length > 0) whisperWords = words
    } catch {
      whisperWords = undefined
    }

    let voiceoverUrl: string
    try {
      voiceoverUrl = await uploadVoiceoverToSupabase(user.id, audioBuffer)
    } catch (err) {
      console.error('[compose/unlock] voiceover upload failed:', err instanceof Error ? err.message : String(err))
      await releaseExplicitlyRejectedClaim()
      return NextResponse.json({ error: 'Could not store the voiceover. Please try again.' }, { status: 502 })
    }

    let musicUrl: string | null = null
    try {
      musicUrl = await getBackgroundMusicUrl(voiceoverUrl)
    } catch {
      musicUrl = null
    }

    let source: Record<string, unknown>
    try {
      source = buildCreatomateSource({
        clipUrls,
        voiceoverUrl,
        voiceoverScript: scaledScript,
        sceneCaptions,
        duration,
        quality: 'fast',
        realAudioDuration,
        whisperWords,
        musicUrl,
        // Paid means a genuinely clean MP4: no watermark and no promotional
        // end card. This matches the public pricing promise.
        watermark: false,
        endCard: false,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[compose/unlock] source build failed:', msg)
      await releaseExplicitlyRejectedClaim()
      return NextResponse.json({ error: `Could not assemble the render: ${msg}` }, { status: 500 })
    }

    let renderId: string
    try {
      renderId = await submitUnlockOnce(source, submissionCacheKey)
    } catch (err) {
      console.error('[compose/unlock] Creatomate submit failed:', err instanceof Error ? err.message : String(err))
      if (err instanceof CreatomateSubmitError && err.ambiguous) {
        return NextResponse.json(
          { error: 'Your clean render submission is still being verified.', pending: true, retry_after_ms: 3000 },
          { status: 409 },
        )
      }
      await releaseExplicitlyRejectedClaim()
      return NextResponse.json({ error: 'Render service rejected the job. Please try again.' }, { status: 502 })
    }

    // KINEO-CREDIT-INTENT-2026-07-11 — this is a Fast render for a user who just
    // paid and credit-verified above, so the intended cost is exactly 1 credit.
    // /api/compose/status settles that signed cost before releasing the asset.
    const intentStored = await recordRenderIntent({
      renderId,
      userId: user.id,
      quality: 'fast',
      cost: intendedCost,
    })

    const doneMetadata = {
      generation_id: generationId,
      status: 'done',
      render_id: renderId,
      quality: 'fast',
      cost: intendedCost,
      credit_hold: true,
      completed_at: new Date().toISOString(),
      authority: signComposeClaim(serviceRoleKey, {
        claimId,
        userId: user.id,
        generationId,
        status: 'done' as const,
        renderId,
        quality: 'fast',
        cost: intendedCost,
      }),
    }
    let claimStored = false
    for (let attempt = 1; attempt <= 3 && !claimStored; attempt += 1) {
      const { data: completed, error: completeError } = await admin
        .from('events')
        .update({ metadata: doneMetadata })
        .eq('id', claimId)
        .eq('user_id', user.id)
        .eq('name', COMPOSE_CLAIM_EVENT)
        .select('id')
        .maybeSingle()
      claimStored = !completeError && completed?.id === claimId
      if (completeError) console.error('[compose/unlock] claim completion failed:', completeError.message)
    }
    if (claimStored) ownsSubmissionClaim = false
    if (!intentStored && !claimStored) {
      return NextResponse.json(
        { error: 'Your clean render was accepted and is being recovered safely.', pending: true, retry_after_ms: 5000 },
        { status: 503 },
      )
    }

    console.log(`[compose/unlock] clean re-render started user=${user.id.slice(0, 8)} render=${renderId} duration=${duration}s`)
    return NextResponse.json({ verified: true, render_id: renderId, quality: 'fast', duration })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[compose/unlock] unexpected error:', msg)
    return NextResponse.json({ error: 'Something went wrong preparing the clean render.' }, { status: 500 })
  }
}
