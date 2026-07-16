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
//      like any Fast render. (The clean composition costs 1 credit; Starter has
//      25/month, so it is covered. If the webhook credit
//      grant hasn't landed yet, the debit RPC simply no-ops and the clean video
//      is still delivered — safe degradation.)
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

const SUPPORTED_DURATIONS = [45, 60, 90] as const

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
    const intendedCost = creditCostFor('fast', true)
    let ownsSubmissionClaim = false

    const claimUnavailable = () => NextResponse.json(
      { error: 'Your clean render safety check is temporarily unavailable. Please refresh in a moment.' },
      { status: 503 },
    )

    const responseForClaim = (row: unknown): NextResponse => {
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
    if (existingClaim) return responseForClaim(existingClaim)

    // ── 2) Safety-net: mark the user as paid so any FUTURE render is clean too.
    //    Idempotent; the Stripe webhook also sets this. Never grants credits.
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
      return NextResponse.json({ error: 'Voiceover generation failed. Please try again.' }, { status: 502 })
    }
    if (!audioBuffer || audioBuffer.length === 0) {
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
        // The whole point of the pack: no watermark. End card stays (it is the
        // free/Starter "Made with Kineo" ad, not the corner watermark, and it
        // matches what a fresh Fast render from a pack buyer already produces).
        watermark: false,
        endCard: true,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[compose/unlock] source build failed:', msg)
      return NextResponse.json({ error: `Could not assemble the render: ${msg}` }, { status: 500 })
    }

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
      return responseForClaim(racedClaim)
    }
    ownsSubmissionClaim = true

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

    let renderId: string
    try {
      renderId = await submitCreatomateRender(source)
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
    // paid (has_paid=true above), so the intended cost is 1 credit. The debit in
    // /api/compose/status fail-opens if the pack credits haven't landed yet
    // (balance < 1 → delivered without debit), preserving the documented
    // "clean re-render is covered / safe degradation" behavior.
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
