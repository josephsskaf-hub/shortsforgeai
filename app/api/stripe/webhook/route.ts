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

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // ── Path A: One-time credit-pack purchase via Stripe Payment Link ──
        // Payment Links use mode='payment' and pass the Supabase user ID via
        // ?client_reference_id=... appended on the pricing page.
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

          // Read-modify-write the credit balance.
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

        // ── Path B: Subscription checkout (existing flow) ──
        const userId = session.metadata?.supabase_user_id
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        if (!userId) break

        await supabase
          .from('profiles')
          .update({
            is_pro: true,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          })
          .eq('id', userId)

        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string
        const isActive =
          subscription.status === 'active' || subscription.status === 'trialing'

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

        await supabase
          .from('profiles')
          .update({
            is_pro: false,
            stripe_subscription_id: null,
          })
          .eq('stripe_customer_id', customerId)

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        // Optionally downgrade on payment failure
        // For now, we keep the subscription active until Stripe retries
        console.log('Payment failed for customer:', customerId)
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
