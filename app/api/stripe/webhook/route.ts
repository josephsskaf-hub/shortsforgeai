import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { createHash } from 'node:crypto'

// Use service role key for webhook — bypasses RLS
function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Push #416 — owner/admin accounts are managed manually (e.g. Joseph's
// account is set to Studio by hand for testing all engines). Webhook events
// from his legacy real subscription kept overwriting that back to
// starter/free. Any plan-changing event for these emails is skipped.
const PROTECTED_EMAILS = new Set([
  'josephsskaf@gmail.com',
  'josephskaf@gmail.com',
  'josephskaf@hotmail.com',
  'joseph-test@shortsforgeai.com',
])

type AdminClient = ReturnType<typeof getAdminClient>

class RetryableEntitlementError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RetryableEntitlementError'
  }
}

async function isProtectedProfile(
  supabase: AdminClient,
  filter: { userId?: string; customerId?: string }
): Promise<boolean> {
  let query = supabase.from('profiles').select('email').limit(1)
  if (filter.userId) query = query.eq('id', filter.userId)
  else if (filter.customerId) query = query.eq('stripe_customer_id', filter.customerId)
  else return false

  const { data, error } = await query.single()
  if (error) {
    // No matching profile means the account is simply not protected; retain
    // the previous behavior while propagating actual database failures.
    if (error.code === 'PGRST116') return false
    throw new RetryableEntitlementError(
      `Failed to check protected profile: ${error.code ?? 'unknown'} ${error.message}`
    )
  }
  return PROTECTED_EMAILS.has((data?.email ?? '').toLowerCase())
}

// #480 — Affiliate commission. If the paying user was attributed to an affiliate
// (profiles.affiliate_id), record a PENDING commission (rate × amount paid).
// Idempotent via unique(provider, external_id). Stays 'pending' until the admin
// approves it (so refunds inside the window simply never get approved/paid).
async function recordAffiliateCommission(
  supabase: AdminClient,
  args: { userId: string; externalId: string; amountGross: number; currency: string; type: 'initial' | 'recurring' }
): Promise<void> {
  try {
    if (!args.userId || !args.externalId || !args.amountGross || args.amountGross <= 0) return
    const { data: prof } = await supabase.from('profiles').select('affiliate_id').eq('id', args.userId).single()
    const affiliateId = (prof?.affiliate_id as string | null | undefined) ?? null
    if (!affiliateId) return
    const { data: aff } = await supabase.from('affiliates').select('id, commission_rate, status').eq('id', affiliateId).single()
    if (!aff || aff.status !== 'active') return
    const rate = Number(aff.commission_rate ?? 0)
    if (!(rate > 0)) return
    const commission = Math.round(args.amountGross * rate)
    if (commission <= 0) return

    // Link to the referral row + mark it paid (best-effort).
    const { data: ref } = await supabase
      .from('affiliate_referrals')
      .select('id, status')
      .eq('affiliate_id', affiliateId)
      .eq('referred_user_id', args.userId)
      .maybeSingle()
    if (ref && ref.status !== 'paid') {
      await supabase.from('affiliate_referrals').update({ status: 'paid', converted_at: new Date().toISOString() }).eq('id', ref.id)
    }

    const { error } = await supabase.from('affiliate_commissions').insert({
      affiliate_id: affiliateId,
      referral_id: ref?.id ?? null,
      provider: 'stripe',
      external_id: args.externalId,
      type: args.type,
      amount_gross: args.amountGross,
      currency: args.currency || 'usd',
      commission_amount: commission,
      status: 'pending',
      period: new Date().toISOString().slice(0, 10),
    })
    if (error && error.code !== '23505') {
      console.error('[affiliate commission] insert error:', error.code, error.message)
    } else if (!error) {
      console.log(`[affiliate commission] +${commission} (${args.type}) affiliate ${affiliateId} ← user ${args.userId}`)
    }
  } catch (err) {
    console.error('[affiliate commission] unexpected:', err)
  }
}

// KINEO-PAYMENT-EVENT-2026-07-15 — the checkout success page used to be the
// only writer of `payment_success`. Buyers who closed that tab were invisible
// to the funnel, while refreshes could create duplicates. Stripe is the source
// of truth: one verified, deduped webhook event now writes the canonical row.
async function recordPaymentSuccess(
  supabase: AdminClient,
  stripeEventId: string,
  session: Stripe.Checkout.Session
): Promise<void> {
  if (session.payment_status !== 'paid') return

  // Entitlement failures intentionally release the stripe_events guard so
  // Stripe can retry. Keep this analytics row idempotent across that retry.
  const { data: existingRows, error: existingError } = await supabase
    .from('events')
    .select('id')
    .eq('name', 'payment_success')
    .contains('metadata', { stripe_session_id: session.id })
    .limit(1)
  if (!existingError && existingRows && existingRows.length > 0) return
  if (existingError) {
    console.error('[stripe webhook] payment_success dedupe lookup error:', existingError.code, existingError.message)
  }

  const userId = session.metadata?.supabase_user_id ?? session.client_reference_id ?? null
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id ?? null
  const rawBrowserSessionId = session.metadata?.browser_session_id ?? ''
  let browserSessionId: string | null = /^[A-Za-z0-9_-]{8,64}$/.test(rawBrowserSessionId)
    ? rawBrowserSessionId
    : null
  // Checkout idempotency deliberately ignores the originating tab. Keeping a
  // tab id in Stripe metadata would make otherwise-identical requests use the
  // same key with different parameters. Recover attribution from the
  // deterministic checkout_started event instead.
  if (!browserSessionId) {
    const { data: checkoutRows, error: checkoutLookupError } = await supabase
      .from('events')
      .select('session_id')
      .eq('name', 'checkout_started')
      .contains('metadata', { stripe_session_id: session.id })
      .limit(1)
    if (checkoutLookupError) {
      console.error('[stripe webhook] checkout_started attribution lookup error:', checkoutLookupError.code, checkoutLookupError.message)
    } else {
      const recoveredSessionId = checkoutRows?.[0]?.session_id
      if (typeof recoveredSessionId === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(recoveredSessionId)) {
        browserSessionId = recoveredSessionId
      }
    }
  }
  const eventHex = createHash('sha256').update(`payment_success:${session.id}`).digest('hex').slice(0, 32)
  const row = {
    id: `${eventHex.slice(0, 8)}-${eventHex.slice(8, 12)}-${eventHex.slice(12, 16)}-${eventHex.slice(16, 20)}-${eventHex.slice(20)}`,
    name: 'payment_success',
    user_id: userId,
    path: '/api/stripe/webhook',
    session_id: browserSessionId,
    metadata: {
      source: 'stripe_webhook',
      stripe_event_id: stripeEventId,
      stripe_session_id: session.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      checkout_mode: session.mode,
      tier: session.metadata?.tier ?? null,
      billing: session.metadata?.billing ?? null,
      pack: session.metadata?.pack ?? null,
      checkout_origin: session.metadata?.checkout_origin ?? null,
      intro: session.metadata?.intro === '1',
      amount_total: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
    },
  }

  const { error } = await supabase.from('events').insert(row)
  if (!error || error.code === '23505') return

  // A deleted auth user should not make us lose the revenue event. If the
  // user_id foreign key rejects the row, preserve the payment with user=null.
  if (userId && error.code === '23503') {
    const { error: anonymousError } = await supabase
      .from('events')
      .insert({ ...row, user_id: null })
    if (!anonymousError || anonymousError.code === '23505') return
    console.error('[stripe webhook] payment_success fallback insert error:', anonymousError.code, anonymousError.message)
    return
  }

  console.error('[stripe webhook] payment_success insert error:', error.code, error.message)
}

// KINEO-SPRINT-EVENTS-2026-07-15 — payment_success server-side tracking is
// ALREADY handled by recordPaymentSuccess() above (called at the top of the
// shared Checkout fulfillment case, covering immediate and delayed payment,
// subscription and pack paths. Session-level idempotency prevents double grant.

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook secret is not configured' }, { status: 500 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getAdminClient()
  let dedupeRowAcquired = false
  let entitlementPending = false
  let entitlementConfirmed = false
  let checkoutFulfillmentGuard: string | null = null
  let checkoutFulfillmentGuardAcquired = false

  // Idempotency guard. Stripe retries the same event on 5xx (or if our
  // response is slow), and this handler has read-modify-write paths that
  // would double-credit a user on retry. We dedupe on event.id by inserting
  // into `stripe_events` — duplicate inserts fail and we exit early.
  // Run this once in the Supabase SQL editor:
  //   create table if not exists public.stripe_events (
  //     id text primary key,
  //     received_at timestamptz default now()
  //   );
  try {
    const { error: dedupeErr } = await supabase
      .from('stripe_events')
      .insert({ id: event.id })
    if (!dedupeErr) {
      dedupeRowAcquired = true
    } else {
      // 23505 = unique_violation — we've already processed this event.
      if (dedupeErr.code === '23505') {
        const duplicateCheckout =
          event.type === 'checkout.session.completed' ||
          event.type === 'checkout.session.async_payment_succeeded'
        const duplicateSession = duplicateCheckout
          ? event.data.object as Stripe.Checkout.Session
          : null
        // Subscription fulfillment below is idempotent by subscription id and
        // an absolute balance write. Let it resume after a process crash even
        // when event.id was already claimed. Additive legacy packs retain the
        // strict event-level early return.
        if (duplicateSession?.mode !== 'subscription') {
          return NextResponse.json({ received: true, duplicate: true })
        }
        console.warn('[stripe webhook] resuming idempotent subscription event:', event.id, duplicateSession.id)
      }
      if (dedupeErr.code !== '23505') {
        // Fulfillment without its ledger is unsafe. A 5xx asks Stripe to retry
        // after the database recovers instead of risking a duplicate grant.
        console.error('[stripe webhook] dedupe insert error:', dedupeErr.code, dedupeErr.message)
        return NextResponse.json({ error: 'Webhook idempotency unavailable' }, { status: 500 })
      }
    }
  } catch (err) {
    console.error('[stripe webhook] dedupe threw:', err)
    return NextResponse.json({ error: 'Webhook idempotency unavailable' }, { status: 500 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session

        // Delayed methods can complete Checkout while payment is still pending.
        // Grant access only after Stripe confirms settlement.
        const checkoutSettled = session.payment_status === 'paid' || session.payment_status === 'no_payment_required'
        if (!checkoutSettled) {
          console.log('[stripe webhook] checkout payment pending; entitlement deferred:', session.id, session.payment_status)
          break
        }

        // Canonical conversion tracking happens before entitlement updates, so
        // a paid checkout remains visible even if a later profile write fails.
        // Tracking is ancillary: a temporary analytics failure must never stop
        // the paid user from receiving their entitlement.
        try {
          await recordPaymentSuccess(supabase, event.id, session)
        } catch (trackingError) {
          console.error('[stripe webhook] payment_success tracking threw:', trackingError)
        }

        // Both immediate and delayed success converge on this session key. A
        // legacy pack claims it before its additive grant; recurring checkout
        // publishes it only after the idempotent entitlement update succeeds.
        checkoutFulfillmentGuard = `checkout_fulfilled:${session.id}`

        // ── Path A: Legacy one-time credit-pack purchase via Payment Link ──
        // Push #020 moved off Payment Links onto Stripe Checkout subscriptions,
        // but old links may still exist in the wild. Keep the legacy mapping
        // so refunds / late webhooks don't lose users their pack.
        if (session.mode === 'payment') {
          // #473 — Starter Pack ($4.90 → 10 Shorts) + legacy credit packs.
          // Prefer metadata.pack_credits (currency-proof) over the amount map,
          // and accept metadata.supabase_user_id as well as client_reference_id.
          const userId = session.metadata?.supabase_user_id ?? session.client_reference_id
          if (!userId) {
            console.warn('[stripe webhook] payment session has no user id', session.id)
            break
          }

          // KINEO-AVATAR-PACKS-RETIRED-2026-07-06 — the metadata.avatar_credits
          // crediting block (which topped up the SEPARATE profiles.avatar_credits
          // balance for the retired avatar packs) was removed here. No checkout
          // path sets metadata.avatar_credits anymore — avatar videos now cost
          // 120 universal video_credits — so the block was dead. Existing
          // profiles.avatar_credits balances are left untouched in the DB.
          // The Starter Pack / top-ups keep using metadata.pack_credits below.

          const metaCredits = Number(session.metadata?.pack_credits ?? 0)
          const amount = session.amount_total ?? 0
          let creditsToAdd = metaCredits > 0 ? metaCredits : 0
          if (creditsToAdd === 0) {
            // Legacy Payment-Link amounts (USD): $9 → 10, $19 → 25, $4.90 → 10.
            if (amount === 900) creditsToAdd = 10
            else if (amount === 1900) creditsToAdd = 25
            else if (amount === 490) creditsToAdd = 10 // KINEO-PRICING-V3C-2026-07-10 — $4.90 pack back to 10 (mirrors STARTER_PACK.credits)
          }

          if (creditsToAdd === 0) {
            console.warn('[stripe webhook] unexpected amount_total for credit pack:', amount, session.id)
            break
          }

          entitlementPending = true
          // Legacy packs are additive and have no transaction-capable purchase
          // ledger, so retain the conservative pre-write session marker here.
          const { error: packGuardError } = await supabase
            .from('stripe_events')
            .insert({ id: checkoutFulfillmentGuard })
          if (!packGuardError) {
            checkoutFulfillmentGuardAcquired = true
          } else if (packGuardError.code === '23505') {
            entitlementConfirmed = true
            entitlementPending = false
            console.log('[stripe webhook] credit pack already fulfilled:', session.id)
            break
          } else {
            throw new RetryableEntitlementError(
              `Failed to acquire credit-pack fulfillment guard (${session.id}): ${packGuardError.message}`
            )
          }

          const { data: profile, error: fetchErr } = await supabase
            .from('profiles')
            .select('video_credits')
            .eq('id', userId)
            .single()

          if (fetchErr) {
            throw new RetryableEntitlementError(
              `Failed to fetch profile for credit top-up (${userId}): ${fetchErr.message}`
            )
          }

          const current = profile?.video_credits ?? 0
          const next = current + creditsToAdd

          // KINEO-OFFER290-2026-07-07 — the first-purchase $2.90 offer is one per
          // account. When this session is the starter290 offer, also stamp
          // offer290_used=true so the buyer can never claim it again (checkout
          // rejects on that flag). Idempotent: this whole block only runs once
          // per event.id (stripe_events dedupe above).
          const isOffer290 = session.metadata?.pack === 'starter290'
          const profileUpdate: Record<string, unknown> = { video_credits: next, has_paid: true }
          if (isOffer290) profileUpdate.offer290_used = true

          const { error: updateErr } = await supabase
            .from('profiles')
            // KINEO-PACK-NOWM-2026-07-06 — mark buyer as paid so their free-plan
            // Fast renders come out watermark-free (the point of the $4.90 pack).
            .update(profileUpdate)
            .eq('id', userId)

          if (updateErr) {
            throw new RetryableEntitlementError(
              `Failed to add credits (${userId}): ${updateErr.message}`
            )
          } else {
            entitlementConfirmed = true
            entitlementPending = false
            console.log(`[stripe webhook] +${creditsToAdd} credits → user ${userId} (now ${next})`)
          }
          await recordAffiliateCommission(supabase, { userId, externalId: session.id, amountGross: session.amount_total ?? 0, currency: session.currency ?? 'usd', type: 'initial' })
          break
        }

        // ── Path B: Subscription checkout ──
        const userId = session.metadata?.supabase_user_id
        const customerId = typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id ?? null
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id ?? null
        const tier = session.metadata?.tier === 'pro' ? 'pro' : session.metadata?.tier === 'starter' ? 'starter' : 'basic'

        entitlementPending = true
        if (!userId || !customerId || !subscriptionId) {
          throw new RetryableEntitlementError(
            `Settled subscription Checkout missing authoritative ids (${session.id})`
          )
        }

        // Conversion — 3-day trial: if payment_status is 'no_payment_required'
        // the subscription is in trial. Grant 5 preview credits so the user
        // can experience the product before paying; full credits are granted
        // by the invoice.payment_succeeded handler on Day 4 first charge.
        const isTrial = session.payment_status === 'no_payment_required'
        // KINEO-STUDIO-400-2026-07-06 — Studio(pro)=400 (aligned with pricing.ts
        // + UI; was 600 here, 360 there → margin leak). Creator(basic) 240, Starter 50.
        // KINEO-PRICING-V3B-2026-07-10 — Creator $24.90 grants 150 credits
        // (1 Hollywood film/month included). pro/starter ALINHADOS ao rebase
        // 2:1 (200/25, iguais ao lib/pricing.ts) — fecha o leak de margem.
        const planCredits = tier === 'pro' ? 200 : tier === 'starter' ? 25 : 150
        const creditsToGrant = isTrial ? 5 : planCredits
        const subscriptionFulfillmentId = `checkout_fulfilled:${session.id}`
        const publishSubscriptionFulfillment = async (): Promise<void> => {
          const { error: fulfillmentCompleteError } = await supabase
            .from('stripe_events')
            .insert({ id: subscriptionFulfillmentId })
          if (fulfillmentCompleteError && fulfillmentCompleteError.code !== '23505') {
            throw new RetryableEntitlementError(
              `Failed to publish Checkout fulfillment (${session.id}): ${fulfillmentCompleteError.message}`
            )
          }
        }

        const { data: fulfilledSession, error: fulfilledLookupError } = await supabase
          .from('stripe_events')
          .select('id')
          .eq('id', subscriptionFulfillmentId)
          .maybeSingle()
        if (fulfilledLookupError) {
          throw new RetryableEntitlementError(
            `Failed to verify Checkout fulfillment (${session.id}): ${fulfilledLookupError.message}`
          )
        }
        if (fulfilledSession?.id === subscriptionFulfillmentId) {
          entitlementConfirmed = true
          entitlementPending = false
          await recordAffiliateCommission(supabase, { userId, externalId: session.id, amountGross: session.amount_total ?? 0, currency: session.currency ?? 'usd', type: 'initial' })
          console.log('[stripe webhook] subscription Checkout already fulfilled:', session.id)
          break
        }

        let currentSubscription: Stripe.Subscription
        try {
          currentSubscription = await stripe.subscriptions.retrieve(subscriptionId)
        } catch (subscriptionLookupError) {
          const message = subscriptionLookupError instanceof Error
            ? subscriptionLookupError.message
            : String(subscriptionLookupError)
          throw new RetryableEntitlementError(
            `Failed to verify current subscription state (${subscriptionId}): ${message}`
          )
        }
        const currentSubscriptionCustomerId = typeof currentSubscription.customer === 'string'
          ? currentSubscription.customer
          : currentSubscription.customer?.id ?? null
        const currentSubscriptionUserId = currentSubscription.metadata?.supabase_user_id
        if (
          currentSubscriptionCustomerId !== customerId ||
          currentSubscriptionUserId !== userId
        ) {
          throw new RetryableEntitlementError(
            `Subscription identity mismatch for settled Checkout (${session.id})`
          )
        }
        const subscriptionGrantsAccess =
          currentSubscription.status === 'active' || currentSubscription.status === 'trialing'
        if (!subscriptionGrantsAccess) {
          // A late/replayed Checkout event must never reactivate a subscription
          // that Stripe now reports as canceled, unpaid, paused or otherwise
          // non-access. The original payment remains recorded for analytics and
          // affiliate accounting, then this stale event is closed permanently.
          await recordAffiliateCommission(supabase, { userId, externalId: session.id, amountGross: session.amount_total ?? 0, currency: session.currency ?? 'usd', type: 'initial' })
          await publishSubscriptionFulfillment()
          entitlementConfirmed = true
          entitlementPending = false
          console.warn('[stripe webhook] stale Checkout replay ignored for non-access subscription:', session.id, subscriptionId, currentSubscription.status)
          break
        }
        const currentSubscriptionTier =
          currentSubscription.metadata?.tier === 'pro'
            ? 'pro'
            : currentSubscription.metadata?.tier === 'starter'
              ? 'starter'
              : currentSubscription.metadata?.tier === 'basic'
                ? 'basic'
                : null
        if (currentSubscriptionTier && currentSubscriptionTier !== tier) {
          // The same Stripe subscription can be changed to another tier after
          // its original Checkout. A delayed replay of that old Checkout must
          // not add the old grant or downgrade the account back to its historic
          // tier. The live subscription metadata is authoritative here.
          await recordAffiliateCommission(supabase, { userId, externalId: session.id, amountGross: session.amount_total ?? 0, currency: session.currency ?? 'usd', type: 'initial' })
          await publishSubscriptionFulfillment()
          entitlementConfirmed = true
          entitlementPending = false
          console.warn('[stripe webhook] stale Checkout replay ignored after subscription tier change:', session.id, tier, currentSubscriptionTier)
          break
        }

        const { data: currentProfile, error: currentProfileErr } = await supabase
          .from('profiles')
          .select('video_credits, stripe_subscription_id, plan, is_pro')
          .eq('id', userId)
          .single()

        if (currentProfileErr) {
          throw new RetryableEntitlementError(
            `Failed to read subscription profile (${userId}): ${currentProfileErr.message}`
          )
        }

        const current = currentProfile?.video_credits ?? 0
        const expectedPlan = isTrial ? `${tier}_trial` : tier
        const resumedGrant =
          currentProfile?.stripe_subscription_id === subscriptionId &&
          (currentProfile?.plan === expectedPlan || (isTrial && currentProfile?.plan === tier)) &&
          currentProfile?.is_pro === true
        // The first grant is additive so paid pack credits remain in the
        // account. A retry sees the same subscription id and writes the current
        // absolute balance unchanged; concurrent first events read the same
        // balance and converge on the same absolute next value.
        const next = resumedGrant ? current : current + creditsToGrant

        // Push #088 — Pro plan also includes 1 cinematic token / month.
        const cinematicTokensForTier = tier === 'pro' ? 1 : 0

        if (!resumedGrant) {
          const { data: updatedProfile, error: subUpdErr } = await supabase
            .from('profiles')
            .update({
              is_pro: true,
              plan: expectedPlan,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              video_credits: next,
              cinematic_tokens: isTrial ? 0 : cinematicTokensForTier,
              has_paid: true, // KINEO-PACK-NOWM-2026-07-06 — clean output for paid users
            })
            .eq('id', userId)
            .select('id')
            .maybeSingle()

          if (subUpdErr || !updatedProfile?.id) {
            throw new RetryableEntitlementError(
              `Subscription credit grant failed (${userId}): ${subUpdErr?.message ?? 'profile row missing'}`
            )
          }
        }

        // Commission insert is independently idempotent by external_id. Run it
        // before publishing fulfillment so a crash cannot leave a permanent
        // completed marker with the commission missing.
        await recordAffiliateCommission(supabase, { userId, externalId: session.id, amountGross: session.amount_total ?? 0, currency: session.currency ?? 'usd', type: 'initial' })

        // This marker means completed, so publish it only after the idempotent
        // profile update. If publication fails, Stripe retries; the same
        // subscription id + absolute balance write is harmless on that retry.
        await publishSubscriptionFulfillment()

        entitlementConfirmed = true
        entitlementPending = false
        console.log(`[stripe webhook] ${isTrial ? 'TRIAL' : 'subscription'} start: ${tier} (${resumedGrant ? 'resumed idempotently' : `balance ${current}→${next}`}) → user ${userId}`)

        break
      }

      case 'checkout.session.expired': {
        // Push #259 — track abandoned checkouts so we can measure drop-off.
        // Supabase SQL to create the table (run once in the SQL editor):
        //
        //   create table if not exists public.checkout_abandoned (
        //     id uuid default gen_random_uuid() primary key,
        //     user_id uuid references auth.users(id),
        //     tier text,
        //     currency text,
        //     amount_total bigint,
        //     stripe_session_id text unique,
        //     expired_at timestamptz default now()
        //   );
        const expiredSession = event.data.object as Stripe.Checkout.Session
        const abandonedUserId = expiredSession.metadata?.supabase_user_id ?? null
        const abandonedTier = expiredSession.metadata?.tier ?? null

        try {
          const { error: abanErr } = await supabase
            .from('checkout_abandoned')
            .insert({
              user_id: abandonedUserId,
              tier: abandonedTier,
              currency: expiredSession.currency,
              amount_total: expiredSession.amount_total,
              stripe_session_id: expiredSession.id,
            })
          if (abanErr && abanErr.code !== '42P01' && abanErr.code !== '23505') {
            // 42P01 = table doesn't exist yet (migration not applied — non-fatal)
            // 23505 = duplicate — already recorded
            console.error('[stripe webhook] checkout_abandoned insert error:', abanErr.code, abanErr.message)
          } else {
            console.log(`[stripe webhook] checkout abandoned: session=${expiredSession.id} user=${abandonedUserId} tier=${abandonedTier}`)
          }
        } catch (abanCatch) {
          console.warn('[stripe webhook] checkout_abandoned insert threw:', abanCatch)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        // Handles two cases:
        // 1. Monthly renewal (billing_reason='subscription_cycle') — refill credits.
        // 2. First real payment after 3-day trial (billing_reason='subscription_cycle')
        //    — upgrades user from 5 trial credits to full plan credits.
        // Skip subscription_create: non-trial subscriptions already get full
        // credits via checkout.session.completed (payment_status='paid').
        const invoice = event.data.object as Stripe.Invoice & { billing_reason?: string; subscription?: string }
        const billingReason = invoice.billing_reason
        if (billingReason === 'subscription_create') break

        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null
        if (!subscriptionId) break

        entitlementPending = true
        let subscription: Stripe.Subscription
        try {
          subscription = await stripe.subscriptions.retrieve(subscriptionId)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          throw new RetryableEntitlementError(
            `Failed to load subscription for renewal (${subscriptionId}): ${msg}`
          )
        }

        const renewalUserId = subscription.metadata?.supabase_user_id
        const renewalTier = subscription.metadata?.tier === 'pro' ? 'pro' : subscription.metadata?.tier === 'starter' ? 'starter' : 'basic'
        // KINEO-STUDIO-400-2026-07-06 — renewal credits: Studio 400, Creator 240,
        // Starter 50. Set (not added) each cycle → no rollover between months.
        // KINEO-PRICING-V3B-2026-07-10 — Creator renewal = 150 credits. pro/starter
        // ALINHADOS ao rebase 2:1 (200/25) — fecha o leak de margem.
        const renewalCredits = renewalTier === 'pro' ? 200 : renewalTier === 'starter' ? 25 : 150
        if (!renewalUserId) {
          entitlementPending = false
          break
        }
        const renewalCustomerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id ?? null
        if (!renewalCustomerId) {
          throw new RetryableEntitlementError(
            `Renewal subscription missing Customer (${subscriptionId})`
          )
        }
        if (await isProtectedProfile(supabase, { userId: renewalUserId })) {
          entitlementConfirmed = true
          entitlementPending = false
          console.log('[stripe webhook] renewal skipped for protected admin account:', renewalUserId)
          break
        }
        if (subscription.status !== 'active' && subscription.status !== 'trialing') {
          // Stripe events can arrive out of order. A historical paid invoice
          // must not reactivate/refill a subscription whose live state is now
          // canceled, unpaid, paused or otherwise non-access.
          entitlementConfirmed = true
          entitlementPending = false
          console.warn('[stripe webhook] stale renewal ignored for non-access subscription:', invoice.id, subscriptionId, subscription.status)
          break
        }

        const { data: renewalProfile, error: renewalProfileError } = await supabase
          .from('profiles')
          .select('id, stripe_customer_id, stripe_subscription_id')
          .eq('id', renewalUserId)
          .maybeSingle()
        if (renewalProfileError || !renewalProfile?.id) {
          throw new RetryableEntitlementError(
            `Failed to verify renewal profile (${renewalUserId}): ${renewalProfileError?.message ?? 'profile row missing'}`
          )
        }
        if (renewalProfile.stripe_customer_id && renewalProfile.stripe_customer_id !== renewalCustomerId) {
          throw new RetryableEntitlementError(
            `Renewal Customer identity mismatch (${renewalUserId}, ${subscriptionId})`
          )
        }
        if (
          renewalProfile.stripe_subscription_id &&
          renewalProfile.stripe_subscription_id !== subscriptionId
        ) {
          // A paid invoice for an older duplicate subscription must never reset
          // the balance/tier belonging to the profile's newer subscription.
          entitlementConfirmed = true
          entitlementPending = false
          await recordAffiliateCommission(supabase, { userId: renewalUserId, externalId: invoice.id ?? subscriptionId, amountGross: invoice.amount_paid ?? 0, currency: invoice.currency ?? 'usd', type: 'recurring' })
          console.warn('[stripe webhook] stale renewal ignored for superseded subscription:', invoice.id, subscriptionId, renewalProfile.stripe_subscription_id)
          break
        }

        // On renewal we set the balance to the plan amount rather than adding,
        // so unused credits from the prior cycle don't pile up indefinitely.
        // Push #088 — also reset cinematic_tokens on renewal: Pro = 1,
        // Basic = 0. Resetting (not adding) keeps the monthly cap honest
        // even if the user never spent the prior month's token.
        const renewalCinematicTokens = renewalTier === 'pro' ? 1 : 0
        // Push #416 — never let a legacy subscription renewal overwrite a
        // manually-managed admin account.
        const { data: renewedProfile, error: renewErr } = await supabase
          .from('profiles')
          .update({
            video_credits: renewalCredits,
            is_pro: true,
            plan: renewalTier,
            cinematic_tokens: renewalCinematicTokens,
            stripe_customer_id: renewalCustomerId,
            stripe_subscription_id: subscriptionId,
          })
          .eq('id', renewalUserId)
          .select('id')
          .maybeSingle()

        if (renewErr || !renewedProfile?.id) {
          throw new RetryableEntitlementError(
            `Renewal credit refill failed (${renewalUserId}): ${renewErr?.message ?? 'profile row missing'}`
          )
        } else {
          entitlementConfirmed = true
          entitlementPending = false
          console.log(`[stripe webhook] renewal: ${renewalTier} (${renewalCredits}, cin=${renewalCinematicTokens}) → user ${renewalUserId}`)
        }

        await recordAffiliateCommission(supabase, { userId: renewalUserId, externalId: invoice.id ?? subscriptionId, amountGross: invoice.amount_paid ?? 0, currency: invoice.currency ?? 'usd', type: 'recurring' })

        break
      }

      case 'customer.subscription.updated': {
        entitlementPending = true
        const eventSubscription = event.data.object as Stripe.Subscription
        let subscription: Stripe.Subscription
        try {
          // Delivery order is not authority for current access. Read Stripe's
          // live state so an old `active` event cannot undo a later cancel.
          subscription = await stripe.subscriptions.retrieve(eventSubscription.id)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          throw new RetryableEntitlementError(
            `Failed to verify subscription update (${eventSubscription.id}): ${message}`
          )
        }
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id ?? null
        if (!customerId) {
          throw new RetryableEntitlementError(
            `Subscription update missing Customer (${subscription.id})`
          )
        }
        const isActive =
          subscription.status === 'active' || subscription.status === 'trialing'

        // Push #416 — protected admin accounts are managed manually.
        if (await isProtectedProfile(supabase, { customerId })) {
          entitlementConfirmed = true
          entitlementPending = false
          console.log('[stripe webhook] subscription.updated skipped for protected admin:', customerId)
          break
        }

        const { data: subscriptionProfile, error: subscriptionProfileError } = await supabase
          .from('profiles')
          .select('id, stripe_subscription_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
        if (subscriptionProfileError) {
          throw new RetryableEntitlementError(
            `Failed to locate subscription profile (${customerId}): ${subscriptionProfileError.message}`
          )
        }
        if (!subscriptionProfile?.id) {
          // Checkout fulfillment owns the initial profile link. If its event
          // has not arrived yet, this lifecycle event has nothing safe to edit.
          entitlementConfirmed = true
          entitlementPending = false
          console.warn('[stripe webhook] subscription update has no linked profile:', customerId, subscription.id)
          break
        }
        const subscriptionOwnerId = subscription.metadata?.supabase_user_id
        if (!subscriptionOwnerId || subscriptionOwnerId !== subscriptionProfile.id) {
          // A mutable/corrupted Customer pointer must not let one account adopt
          // another user's live subscription. Kineo subscriptions always carry
          // their authenticated Supabase owner in Stripe metadata.
          entitlementConfirmed = true
          entitlementPending = false
          console.error('[stripe webhook] subscription owner/profile mismatch ignored:', subscription.id, subscriptionOwnerId, subscriptionProfile.id)
          break
        }
        if (
          subscriptionProfile.stripe_subscription_id &&
          subscriptionProfile.stripe_subscription_id !== subscription.id
        ) {
          entitlementConfirmed = true
          entitlementPending = false
          console.warn('[stripe webhook] stale subscription update ignored for superseded subscription:', subscription.id, subscriptionProfile.stripe_subscription_id)
          break
        }
        if (!subscriptionProfile.stripe_subscription_id && !isActive) {
          entitlementConfirmed = true
          entitlementPending = false
          console.warn('[stripe webhook] unlinked non-access subscription update ignored:', subscription.id, subscription.status)
          break
        }

        const subscriptionPatch: Record<string, unknown> = {
          is_pro: isActive,
          stripe_subscription_id: subscription.id,
        }
        if (!isActive) {
          subscriptionPatch.plan = 'free'
          subscriptionPatch.cinematic_tokens = 0
        }
        const { data: updatedSubscriptionProfile, error: subscriptionUpdateErr } = await supabase
          .from('profiles')
          .update(subscriptionPatch)
          .eq('id', subscriptionProfile.id)
          .select('id')
          .maybeSingle()

        if (subscriptionUpdateErr || !updatedSubscriptionProfile?.id) {
          throw new RetryableEntitlementError(
            `Failed to apply subscription update (${customerId}): ${subscriptionUpdateErr?.message ?? 'profile row missing'}`
          )
        }
        entitlementConfirmed = true
        entitlementPending = false

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id ?? null

        entitlementPending = true
        if (!customerId) {
          throw new RetryableEntitlementError(
            `Deleted subscription missing Customer (${subscription.id})`
          )
        }
        // Push #416 — protected admin accounts are managed manually.
        if (await isProtectedProfile(supabase, { customerId })) {
          entitlementConfirmed = true
          entitlementPending = false
          console.log('[stripe webhook] subscription.deleted skipped for protected admin:', customerId)
          break
        }

        // Push #088 — wipe cinematic_tokens on cancellation so a former
        // Pro user can't keep a stranded Runway token after their plan
        // lapses. Regular credits stay (they were already paid for).
        const { data: deletedSubscriptionProfile, error: subscriptionDeleteErr } = await supabase
          .from('profiles')
          .update({
            is_pro: false,
            plan: 'free',
            stripe_subscription_id: null,
            cinematic_tokens: 0,
          })
          .eq('stripe_customer_id', customerId)
          .eq('stripe_subscription_id', subscription.id)
          .select('id')
          .maybeSingle()

        if (subscriptionDeleteErr) {
          throw new RetryableEntitlementError(
            `Failed to revoke deleted subscription (${customerId}): ${subscriptionDeleteErr.message}`
          )
        }
        entitlementConfirmed = true
        entitlementPending = false
        if (!deletedSubscriptionProfile?.id) {
          console.warn('[stripe webhook] stale subscription deletion ignored for superseded subscription:', subscription.id, customerId)
        }

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null
        }
        const customerId = typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id ?? null
        const failedSubscriptionId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id ?? null

        if (!customerId || !failedSubscriptionId) {
          console.warn('[stripe webhook] payment_failed without authoritative customer/subscription id')
          break
        }

        entitlementPending = true
        // Push #416 — protected admin accounts are managed manually.
        if (await isProtectedProfile(supabase, { customerId })) {
          entitlementConfirmed = true
          entitlementPending = false
          console.log('[stripe webhook] payment_failed skipped for protected admin:', customerId)
          break
        }

        let failedSubscription: Stripe.Subscription
        try {
          failedSubscription = await stripe.subscriptions.retrieve(failedSubscriptionId)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          throw new RetryableEntitlementError(
            `Failed to verify payment_failed subscription (${failedSubscriptionId}): ${message}`
          )
        }
        const failedSubscriptionCustomerId = typeof failedSubscription.customer === 'string'
          ? failedSubscription.customer
          : failedSubscription.customer?.id ?? null
        if (failedSubscriptionCustomerId !== customerId) {
          throw new RetryableEntitlementError(
            `payment_failed subscription identity mismatch (${failedSubscriptionId})`
          )
        }
        if (failedSubscription.status === 'active' || failedSubscription.status === 'trialing') {
          // A later successful retry may already have restored the subscription
          // before this older failure event arrives. Live Stripe state wins.
          entitlementConfirmed = true
          entitlementPending = false
          console.warn('[stripe webhook] stale payment_failed ignored for live access subscription:', failedSubscriptionId, failedSubscription.status)
          break
        }

        const { data: revokedProfile, error: revokeErr } = await supabase
          .from('profiles')
          .update({ is_pro: false, plan: 'free' })
          .eq('stripe_customer_id', customerId)
          .eq('stripe_subscription_id', failedSubscriptionId)
          .select('id')
          .maybeSingle()

        if (revokeErr) {
          throw new RetryableEntitlementError(
            `Failed to revoke access on payment_failed (${customerId}): ${revokeErr.message}`
          )
        } else {
          entitlementConfirmed = true
          entitlementPending = false
          if (revokedProfile?.id) {
            console.log('[stripe webhook] revoked access for current failed subscription:', customerId, failedSubscriptionId)
          } else {
            console.warn('[stripe webhook] stale payment_failed ignored for superseded subscription:', customerId, failedSubscriptionId)
          }
        }
        break
      }

      default:
        // Unhandled event type — log and continue
        console.log('Unhandled webhook event type:', event.type)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    const shouldRetryEntitlement =
      error instanceof RetryableEntitlementError &&
      entitlementPending &&
      !entitlementConfirmed

    let checkoutGuardReleased = !checkoutFulfillmentGuardAcquired
    if (shouldRetryEntitlement && checkoutFulfillmentGuardAcquired && checkoutFulfillmentGuard) {
      try {
        const { error: fulfillmentReleaseError } = await supabase
          .from('stripe_events')
          .delete()
          .eq('id', checkoutFulfillmentGuard)
        if (fulfillmentReleaseError) {
          console.error(
            '[stripe webhook] failed to release Checkout Session fulfillment guard:',
            fulfillmentReleaseError.code,
            fulfillmentReleaseError.message,
            checkoutFulfillmentGuard,
          )
        } else {
          checkoutFulfillmentGuardAcquired = false
          checkoutGuardReleased = true
        }
      } catch (fulfillmentReleaseThrown) {
        console.error('[stripe webhook] fulfillment guard release threw:', fulfillmentReleaseThrown, checkoutFulfillmentGuard)
      }
    }

    if (shouldRetryEntitlement && dedupeRowAcquired && checkoutGuardReleased) {
      try {
        const { error: releaseError } = await supabase
          .from('stripe_events')
          .delete()
          .eq('id', event.id)

        if (releaseError) {
          console.error(
            '[stripe webhook] failed to release dedupe row for retry:',
            releaseError.code,
            releaseError.message,
            event.id
          )
        } else {
          dedupeRowAcquired = false
          console.warn('[stripe webhook] released dedupe row; Stripe retry required:', event.id)
        }
      } catch (releaseThrown) {
        console.error('[stripe webhook] dedupe release threw:', releaseThrown, event.id)
      }
    }

    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
