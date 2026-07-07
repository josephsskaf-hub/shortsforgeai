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

async function isProtectedProfile(
  supabase: AdminClient,
  filter: { userId?: string; customerId?: string }
): Promise<boolean> {
  try {
    let query = supabase.from('profiles').select('email').limit(1)
    if (filter.userId) query = query.eq('id', filter.userId)
    else if (filter.customerId) query = query.eq('stripe_customer_id', filter.customerId)
    else return false
    const { data } = await query.single()
    return PROTECTED_EMAILS.has((data?.email ?? '').toLowerCase())
  } catch {
    return false
  }
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
    if (dedupeErr) {
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
            // Legacy Payment-Link amounts (USD): $9 → 10, $19 → 25, $4.90 → 25.
            if (amount === 900) creditsToAdd = 10
            else if (amount === 1900) creditsToAdd = 25
            else if (amount === 490) creditsToAdd = 25 // KINEO-PACK-25 — $4.90 pack now 25 Fast Shorts
          }

          if (creditsToAdd === 0) {
            console.warn('[stripe webhook] unexpected amount_total for credit pack:', amount, session.id)
            break
          }

          const { data: profile, error: fetchErr } = await supabase
            .from('profiles')
            .select('video_credits')
            .eq('id', userId)
            .single()

          if (fetchErr) {
            console.error('[stripe webhook] failed to fetch profile for credit top-up:', fetchErr.message, userId)
            break
          }

          const current = profile?.video_credits ?? 0
          const next = current + creditsToAdd

          const { error: updateErr } = await supabase
            .from('profiles')
            // KINEO-PACK-NOWM-2026-07-06 — mark buyer as paid so their free-plan
            // Fast renders come out watermark-free (the point of the $4.90 pack).
            .update({ video_credits: next, has_paid: true })
            .eq('id', userId)

          if (updateErr) {
            console.error('[stripe webhook] failed to add credits:', updateErr.message, userId)
          } else {
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
        const planCredits = tier === 'pro' ? 400 : tier === 'starter' ? 50 : 240
        const creditsToGrant = isTrial ? 5 : planCredits

        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('video_credits')
          .eq('id', userId)
          .single()

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
          console.error('[stripe webhook] subscription credit grant failed:', subUpdErr.message, userId)
        } else {
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

        let subscription: Stripe.Subscription
        try {
          subscription = await stripe.subscriptions.retrieve(subscriptionId)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error('[stripe webhook] failed to load subscription for renewal:', msg, subscriptionId)
          break
        }

        const renewalUserId = subscription.metadata?.supabase_user_id
        const renewalTier = subscription.metadata?.tier === 'pro' ? 'pro' : subscription.metadata?.tier === 'starter' ? 'starter' : 'basic'
        // KINEO-STUDIO-400-2026-07-06 — renewal credits: Studio 400, Creator 240,
        // Starter 50. Set (not added) each cycle → no rollover between months.
        const renewalCredits = renewalTier === 'pro' ? 400 : renewalTier === 'starter' ? 50 : 240
        if (!renewalUserId) break

        // On renewal we set the balance to the plan amount rather than adding,
        // so unused credits from the prior cycle don't pile up indefinitely.
        // Push #088 — also reset cinematic_tokens on renewal: Pro = 1,
        // Basic = 0. Resetting (not adding) keeps the monthly cap honest
        // even if the user never spent the prior month's token.
        const renewalCinematicTokens = renewalTier === 'pro' ? 1 : 0
        // Push #416 — never let a legacy subscription renewal overwrite a
        // manually-managed admin account.
        if (await isProtectedProfile(supabase, { userId: renewalUserId })) {
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
          console.error('[stripe webhook] renewal credit refill failed:', renewErr.message, renewalUserId)
        } else {
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

        // Push #416 — protected admin accounts are managed manually.
        if (await isProtectedProfile(supabase, { customerId })) {
          console.log('[stripe webhook] subscription.updated skipped for protected admin:', customerId)
          break
        }

        await supabase
          .from('profiles')
          .update({
            is_pro: isActive,
            stripe_subscription_id: subscription.id,
          })
          .eq('stripe_customer_id', customerId)

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        // Push #416 — protected admin accounts are managed manually.
        if (await isProtectedProfile(supabase, { customerId })) {
          console.log('[stripe webhook] subscription.deleted skipped for protected admin:', customerId)
          break
        }

        // Push #088 — wipe cinematic_tokens on cancellation so a former
        // Pro user can't keep a stranded Runway token after their plan
        // lapses. Regular credits stay (they were already paid for).
        await supabase
          .from('profiles')
          .update({
            is_pro: false,
            plan: 'free',
            stripe_subscription_id: null,
            cinematic_tokens: 0,
          })
          .eq('stripe_customer_id', customerId)

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        if (!customerId) {
          console.warn('[stripe webhook] payment_failed without customer id')
          break
        }

        // Push #416 — protected admin accounts are managed manually.
        if (await isProtectedProfile(supabase, { customerId })) {
          console.log('[stripe webhook] payment_failed skipped for protected admin:', customerId)
          break
        }

        const { error: revokeErr } = await supabase
          .from('profiles')
          .update({ is_pro: false, plan: 'free' })
          .eq('stripe_customer_id', customerId)

        if (revokeErr) {
          console.error('[stripe webhook] failed to revoke access on payment_failed:', revokeErr.message, customerId)
        } else {
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
    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
