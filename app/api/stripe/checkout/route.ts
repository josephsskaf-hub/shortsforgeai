import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'

type Tier = 'basic' | 'pro'

// Plan definitions:
//   Basic = $9/month, 50 Fast Mode videos/month.
//   Pro   = $19/month, 100 Fast Mode videos/month + 1 Cinematic (Runway AI) video/month.
// Launch offer: 50% off the first month via LAUNCH50 coupon (duration: once).
const TIERS: Record<Tier, { name: string; description: string; amount: number; credits: number }> = {
  basic: {
    name: 'ShortsForgeAI — Basic',
    description: '50 Fast Mode videos / month',
    amount: 900, // $9.00
    credits: 50,
  },
  pro: {
    name: 'ShortsForgeAI — Pro',
    description: '100 Fast Mode videos / month + 1 Cinematic (Runway AI) video / month',
    amount: 1900, // $19.00
    credits: 100,
  },
}

const LAUNCH_COUPON = 'LAUNCH50'

export async function POST(req: NextRequest) {
  try {
    // Guard: fail fast if Stripe is not configured
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[stripe/checkout] STRIPE_SECRET_KEY is not set in environment variables')
      return NextResponse.json(
        { error: 'Payment service is not configured. Please contact support.' },
        { status: 500 }
      )
    }

    let tier: Tier = 'basic'
    try {
      const body = await req.json().catch(() => null)
      // Accept legacy `creator` as an alias for `basic` so any cached client
      // calls don't break during the rollout.
      if (body?.tier === 'pro') tier = 'pro'
      else if (body?.tier === 'basic' || body?.tier === 'creator') tier = 'basic'
    } catch {
      // ignore body parse errors and use default tier
    }
    const plan = TIERS[tier]

    const supabase = createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error('[stripe/checkout] Auth error:', authError.message)
      return NextResponse.json({ error: 'Authentication failed. Please sign in again.' }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({ error: 'You must be signed in to upgrade.' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, stripe_customer_id, is_pro')
      .eq('id', user.id)
      .single()

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('[stripe/checkout] Profile fetch error:', profileError.message, profileError.code)
    }

    if (profile?.is_pro) {
      return NextResponse.json({ error: 'You already have an active subscription.' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.shortsforgeai.com'

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      try {
        const customer = await stripe.customers.create({
          email: profile?.email ?? user.email ?? '',
          metadata: { supabase_user_id: user.id },
        })
        customerId = customer.id

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', user.id)

        if (updateError) {
          console.error('[stripe/checkout] Failed to persist customer ID:', updateError.message)
        }
      } catch (customerErr) {
        const msg = customerErr instanceof Error ? customerErr.message : String(customerErr)
        console.error('[stripe/checkout] Failed to create Stripe customer:', msg)
        return NextResponse.json({ error: 'Failed to set up payment. Please try again.' }, { status: 500 })
      }
    }

    // ── Launch-offer discount ────────────────────────────────────────────────
    // Push #020 advertises "50% off first month" as $4.50 / $9.50. We prefer
    // attaching the LAUNCH50 coupon (duration: once) directly so the discount
    // is guaranteed regardless of whether the user pastes a promo code. If the
    // coupon doesn't exist in this Stripe account yet we silently fall back to
    // allow_promotion_codes so the checkout still works.
    //
    // TODO (ops): create coupon LAUNCH50 in Stripe Dashboard:
    //   percent_off: 50, duration: once, redeem_by: <launch end date>
    // until the coupon exists, customers must paste a promo code at checkout
    // OR the displayed first-month price will not be applied.
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined
    let allowPromotionCodes = false
    try {
      await stripe.coupons.retrieve(LAUNCH_COUPON)
      discounts = [{ coupon: LAUNCH_COUPON }]
    } catch {
      // Coupon missing — fall back to user-entered promo codes.
      allowPromotionCodes = true
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: plan.name,
              description: plan.description,
            },
            unit_amount: plan.amount,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      // Push #063 — recovery-friendly post-checkout pages. /checkout/success
      // shows the activation note and nudges back into /generate;
      // /checkout/cancelled re-offers the launch links so the abandoned-cart
      // intent doesn't vanish.
      success_url: `${appUrl}/checkout/success`,
      cancel_url: `${appUrl}/checkout/cancelled`,
      metadata: { supabase_user_id: user.id, tier, plan_credits: String(plan.credits) },
      subscription_data: {
        metadata: { supabase_user_id: user.id, tier, plan_credits: String(plan.credits) },
      },
    }

    if (discounts) sessionParams.discounts = discounts
    if (allowPromotionCodes) sessionParams.allow_promotion_codes = true

    let session
    try {
      session = await stripe.checkout.sessions.create(sessionParams)
    } catch (sessionErr) {
      const msg = sessionErr instanceof Error ? sessionErr.message : String(sessionErr)
      console.error('[stripe/checkout] Session creation error:', msg)
      return NextResponse.json(
        { error: `Payment session failed: ${msg || 'Please try again'}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[stripe/checkout] Unexpected error:', msg)
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 })
  }
}
