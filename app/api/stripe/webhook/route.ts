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
          const userId = session.client_reference_id
          if (!userId) {
            console.warn('[stripe webhook] payment session has no client_reference_id', session.id)
            break
          }

          const amount = session.amount_total ?? 0
          let creditsToAdd = 0
          if (amount === 900) creditsToAdd = 10
          else if (amount === 1900) creditsToAdd = 25

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
            .update({ video_credits: next })
            .eq('id', userId)

          if (updateErr) {
            console.error('[stripe webhook] failed to add credits:', updateErr.message, userId)
          } else {
            console.log(`[stripe webhook] +${creditsToAdd} credits → user ${userId} (now ${next})`)
          }
          break
        }

        // ── Path B: Subscription checkout (push #020) ──
        // Push #259 — free trial support. When is_trial='true' (set by the
        // checkout route for first-time subscribers), grant only 10 trial
        // credits so the user can test the product before being charged. Full
        // plan credits are granted on the first real payment via
        // invoice.payment_succeeded (billing_reason='subscription_cycle').
        const userId = session.metadata?.supabase_user_id
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string
        const tier = session.metadata?.tier === 'pro' ? 'pro' : 'basic'
        const isTrial = session.metadata?.is_trial === 'true'
        const planCredits = tier === 'pro' ? 100 : 50
        const TRIAL_CREDITS = 10

        if (!userId) break

        // Read current balance so the initial plan grant adds to (not replaces)
        // any free credits the user still had unspent.
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('video_credits')
          .eq('id', userId)
          .single()

        const current = currentProfile?.video_credits ?? 0
        // Trial sessions get 10 credits to test the product.
        // Full-plan sessions (re-subscriptions, no trial) get full plan credits.
        const creditsToGrant = isTrial ? TRIAL_CREDITS : planCredits
        const next = current + creditsToGrant

        // Push #088 — Pro plan also includes 1 cinematic token / month.
        // Basic stays at 0 (Cinematic is Pro-exclusive). We use a separate
        // column so the user can't accidentally drain their 100 Fast Mode
        // credits on Runway renders.
        const cinematicTokensForTier = tier === 'pro' ? 1 : 0

        const { error: subUpdErr } = await supabase
          .from('profiles')
          .update({
            is_pro: true,
            plan: tier,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            video_credits: next,
            cinematic_tokens: cinematicTokensForTier,
          })
          .eq('id', userId)

        if (subUpdErr) {
          console.error('[stripe webhook] subscription credit grant failed:', subUpdErr.message, userId)
        } else {
          console.log(`[stripe webhook] subscription start: ${tier} trial=${isTrial} (+${creditsToGrant} credits, cin=${cinematicTokensForTier}) → user ${userId} (now ${next})`)
        }

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
        // Subscription renewal — refill the user's monthly credit allowance.
        // Push #259 — also handles the first real payment after a free trial
        // (billing_reason='subscription_cycle'): grants full plan credits,
        // replacing the 10 trial credits issued at checkout.session.completed.
        // Skip subscription_create billing reason — those credits are already
        // handled by checkout.session.completed (or are 10 trial credits for
        // trial sessions that don't need renewal-level re-grants yet).
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
        const renewalTier = subscription.metadata?.tier === 'pro' ? 'pro' : 'basic'
        const renewalCredits = renewalTier === 'pro' ? 100 : 50
        if (!renewalUserId) break

        // On renewal we set the balance to the plan amount rather than adding,
        // so unused credits from the prior cycle don't pile up indefinitely.
        // Push #088 — also reset cinematic_tokens on renewal: Pro = 1,
        // Basic = 0. Resetting (not adding) keeps the monthly cap honest
        // even if the user never spent the prior month's token.
        const renewalCinematicTokens = renewalTier === 'pro' ? 1 : 0
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
          console.error('[stripe webhook] renewal credit refill failed:'