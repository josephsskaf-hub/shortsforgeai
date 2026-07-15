import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import Stripe from 'stripe'

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
    .eq('session_id', session.id)
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
  const row = {
    name: 'payment_success',
    user_id: userId,
    path: '/api/stripe/webhook',
    session_id: session.id,
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
      intro: session.metadata?.intro === '1',
      amount_total: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
    },
  }

  const { error } = await supabase.from('events').insert(row)
  if (!error) return

  // A deleted auth user should not make us lose the revenue event. If the
  // user_id foreign key rejects the row, preserve the payment with user=null.
  if (userId && error.code === '23503') {
    const { error: anonymousError } = await supabase
      .from('events')
      .insert({ ...row, user_id: null })
    if (!anonymousError) return
    console.error('[stripe webhook] payment_success fallback insert error:', anonymousError.code, anonymousError.message)
    return
  }

  console.error('[stripe webhook] payment_success insert error:', error.code, error.message)
}

// KINEO-SPRINT-EVENTS-2026-07-15 — payment_success server-side tracking is
// ALREADY handled by recordPaymentSuccess() above (called at the top of the
// checkout.session.completed case, covering BOTH the subscription and pack
// paths, deduped via the stripe_events idempotency guard). No separate writer
// is added here to avoid emitting duplicate payment_success rows.

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
        return NextResponse.json({ received: true, duplicate: true })
      }
      // 42P01 = relation does not exist — table hasn't been created yet.
      // Log and fall through; idempotency will be a no-op until the migration
      // is applied, which is better than rejecting live webhooks.
      if (dedupeErr.code !== '42P01') {
        console.error('[stripe webhook] dedupe insert error:', dedupeErr.code, dedupeErr.message)
      }
    }
  } catch (err) {
    console.error('[stripe webhook] dedupe threw:', err)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Canonical conversion tracking happens before entitlement updates, so
        // a paid checkout remains visible even if a later profile write fails.
        // Tracking is ancillary: a temporary analytics failure must never stop
        // the paid user from receiving their entitlement.
        try {
          await recordPaymentSuccess(supabase, event.id, session)
        } catch (trackingError) {
          console.error('[stripe webhook] payment_success tracking threw:', trackingError)
        }

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
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string
        const tier = session.metadata?.tier === 'pro' ? 'pro' : session.metadata?.tier === 'starter' ? 'starter' : 'basic'

        if (!userId) break

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

        entitlementPending = true
        const { data: currentProfile, error: currentProfileErr } = await supabase
          .from('profiles')
          .select('video_credits')
          .eq('id', userId)
          .single()

        if (currentProfileErr) {
          throw new RetryableEntitlementError(
            `Failed to read subscription profile (${userId}): ${currentProfileErr.message}`
          )
        }

        const current = currentProfile?.video_credits ?? 0
        const next = current + creditsToGrant

        // Push #088 — Pro plan also includes 1 cinematic token / month.
        const cinematicTokensForTier = tier === 'pro' ? 1 : 0

        const { error: subUpdErr } = await supabase
          .from('profiles')
          .update({
            is_pro: true,
            plan: isTrial ? `${tier}_trial` : tier,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            video_credits: next,
            cinematic_tokens: isTrial ? 0 : cinematicTokensForTier,
            has_paid: true, // KINEO-PACK-NOWM-2026-07-06 — clean output for paid users
          })
          .eq('id', userId)

        if (subUpdErr) {
          throw new RetryableEntitlementError(
            `Subscription credit grant failed (${userId}): ${subUpdErr.message}`
          )
        } else {
          entitlementConfirmed = true
          entitlementPending = false
          console.log(`[stripe webhook] ${isTrial ? 'TRIAL' : 'subscription'} start: ${tier} (+${creditsToGrant} credits) → user ${userId} (now ${next})`)
        }

        await recordAffiliateCommission(supabase, { userId, externalId: session.id, amountGross: session.amount_total ?? 0, currency: session.currency ?? 'usd', type: 'initial' })

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

        // On renewal we set the balance to the plan amount rather than adding,
        // so unused credits from the prior cycle don't pile up indefinitely.
        // Push #088 — also reset cinematic_tokens on renewal: Pro = 1,
        // Basic = 0. Resetting (not adding) keeps the monthly cap honest
        // even if the user never spent the prior month's token.
        const renewalCinematicTokens = renewalTier === 'pro' ? 1 : 0
        // Push #416 — never let a legacy subscription renewal overwrite a
        // manually-managed admin account.
        if (await isProtectedProfile(supabase, { userId: renewalUserId })) {
          entitlementConfirmed = true
          entitlementPending = false
          console.log('[stripe webhook] renewal skipped for protected admin account:', renewalUserId)
          break
        }
        const { error: renewErr } = await supabase
          .from('profiles')
          .update({
            video_credits: renewalCredits,
            is_pro: true,
            plan: renewalTier,
            cinematic_tokens: renewalCinematicTokens,
          })
          .eq('id', renewalUserId)

        if (renewErr) {
          throw new RetryableEntitlementError(
            `Renewal credit refill failed (${renewalUserId}): ${renewErr.message}`
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
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const isActive =
          subscription.status === 'active' || subscription.status === 'trialing'

        entitlementPending = true
        // Push #416 — protected admin accounts are managed manually.
        if (await isProtectedProfile(supabase, { customerId })) {
          entitlementConfirmed = true
          entitlementPending = false
          console.log('[stripe webhook] subscription.updated skipped for protected admin:', customerId)
          break
        }

        const { error: subscriptionUpdateErr } = await supabase
          .from('profiles')
          .update({
            is_pro: isActive,
            stripe_subscription_id: subscription.id,
          })
          .eq('stripe_customer_id', customerId)

        if (subscriptionUpdateErr) {
          throw new RetryableEntitlementError(
            `Failed to apply subscription update (${customerId}): ${subscriptionUpdateErr.message}`
          )
        }
        entitlementConfirmed = true
        entitlementPending = false

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        entitlementPending = true
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
        const { error: subscriptionDeleteErr } = await supabase
          .from('profiles')
          .update({
            is_pro: false,
            plan: 'free',
            stripe_subscription_id: null,
            cinematic_tokens: 0,
          })
          .eq('stripe_customer_id', customerId)

        if (subscriptionDeleteErr) {
          throw new RetryableEntitlementError(
            `Failed to revoke deleted subscription (${customerId}): ${subscriptionDeleteErr.message}`
          )
        }
        entitlementConfirmed = true
        entitlementPending = false

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        if (!customerId) {
          console.warn('[stripe webhook] payment_failed without customer id')
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

        const { error: revokeErr } = await supabase
          .from('profiles')
          .update({ is_pro: false, plan: 'free' })
          .eq('stripe_customer_id', customerId)

        if (revokeErr) {
          throw new RetryableEntitlementError(
            `Failed to revoke access on payment_failed (${customerId}): ${revokeErr.message}`
          )
        } else {
          entitlementConfirmed = true
          entitlementPending = false
          console.log('[stripe webhook] revoked access for customer:', customerId)
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

    if (shouldRetryEntitlement && dedupeRowAcquired) {
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
