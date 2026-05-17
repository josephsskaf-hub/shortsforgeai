import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'

type Tier = 'basic' | 'pro'
// Push #111 — BR cards reject USD charges, so we now bill BRL natively
// for users whose locale signals pt-* (detection happens client-side
// and the value rides through on the request body). USD stays the
// default.
type Currency = 'usd' | 'brl'

// Plan definitions:
//   Basic = $9/month, 50 Fast Mode videos/month.h
//   Pro   = $19/month, 100 Fast Mode videos/month + 1 Cinematic (Runway AI) video/month.
// Launch offer: 50% off the first month via LAUNCH50 coupon (duration: once).
const TIERS: Record<Tier, { name: string; description: string; credits: number }> = {
  basic: {
    name: 'ShortsForgeAI — Basic',
    description: '50 Fast Mode videos / month',
    credits: 50,
  },
  pro: {
    name: 'ShortsForgeAI — Pro',
    description: '100 Fast Mode videos / month + 1 Cinematic (Runway AI) video / month',
    credits: 100,
  },
}

// Push #111 — per-currency unit_amount table. BRL prices are tuned to
// roughly mirror the USD list price (Basic R$49 ≈ $9, Pro R$99 ≈ $19)
// rather than a live FX rate, so the "$9 / R$49" framing stays stable
// across both surfaces.
const TIER_PRICES: Record<Tier, Record<Currency, number>> = {
  basic: { usd: 900, brl: 4900 },
  pro: { usd: 1900, brl: 9900 },
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
    let bodyCurrencyOverride: Currency | null = null
    try {
      const body = await req.json().catch(() => null)
      // Accept legacy `creator` as an alias for `basic` so any cached client
      // calls don't break during the rollout.
      if (body?.tier === 'pro') tier = 'pro'
      else if (body?.tier === 'basic' || body?.tier === 'creator') tier = 'basic'
      // Explicit override from the client still wins — useful for local dev
      // (no Vercel headers) and for QA forcing a specific currency.
      if (body?.currency === 'brl') bodyCurrencyOverride = 'brl'
    } catch {
      // ignore body parse errors and use default tier
    }

    // Push #112 — server-side BRL detection via Vercel's edge header. The
    // navigator.language path from #111 turned out to be unreliable (browser
    // locale doesn't always match account country, and a few embedded
    // browsers never set it). x-vercel-ip-country is set on every request
    // from the edge in production, so BR visitors get BRL pricing
    // automatically regardless of what their browser reports.
    const ipCountry = req.headers.get('x-vercel-ip-country') ?? ''
    const currency: Currency =
      bodyCurrencyOverride ?? (ipCountry === 'BR' ? 'brl' : 'usd')
    const plan = TIERS[tier]
    const unitAmount = TIER_PRICES[tier][currency]

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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shortsforgeai.com'

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
    // Push #020 advertises "50% off first month" as $4.50 / $9.50. We attach
    // the LAUNCH50 coupon (duration: once) directly so the discount is
    // guaranteed regardless of whether the user pastes a promo code. If the
    // coupon doesn't exist in this Stripe account yet, we create it on the
    // fly so the advertised first-month price is always honored.
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined
    let allowPromotionCodes = false
    try {
      await stripe.coupons.retrieve(LAUNCH_COUPON)
      discounts = [{ coupon: LAUNCH_COUPON }]
    } catch {
      try {
        await stripe.coupons.create({
          id: LAUNCH_COUPON,
          percent_off: 50,
          duration: 'once',
          name: '50% off first month',
        })
        discounts = [{ coupon: LAUNCH_COUPON }]
      } catch (createErr) {
        const stripeErr = createErr as { code?: string; message?: string }
        // `resource_already_exists` means a concurrent request just created it
        // — safe to attach. Anything else, fall back to user-entered codes.
        if (stripeErr?.code === 'resource_already_exists') {
          discounts = [{ coupon: LAUNCH_COUPON }]
        } else {
          console.error('[stripe/checkout] LAUNCH50 create failed:', stripeErr?.code, stripeErr?.message)
          allowPromotionCodes = true
        }
      }
    }

    // Push #111 — BR cards regularly fail on card-only checkout when the
    // bill is in BRL; offering boleto alongside the card option is the
    // standard workaround. USD checkouts stay card-only.
    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      currency === 'brl' ? ['card', 'boleto'] : ['card']

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: paymentMethodTypes,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: plan.name,
              description: plan.description,
            },
            unit_amount: unitAmount,
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
      success_url: `${appUrl}/checkout/success?success=true`,
      cancel_url: `${appUrl}/checkout/cancelled`,
      metadata: { supabase_user_id: user.id, tier, plan_credits: String(plan.credits) },
      subscription_data: {
        // Push #104 — 7-day free trial so users can try the paid tier
        // before any charge hits the card. The LAUNCH50 coupon still
        // applies once the trial ends, so the first real bill is 50% off.
        trial_period_days: 7,
        metadata: { supabase_user_id: user.id, tier, plan_credits: String(plan.credits) },
      },
    }

    if (discounts) sessionParams.discounts = discounts
    if (allowPromotionCodes) sessionParams.allow_promotion_codes = true

    let session
    try {
      session = await stripe.checkout.sessions.create(sessionParams)
    } catch (sessionErr) {
      // Push #112 — boleto requires an explicit Stripe Dashboard toggle
      // (Settings → Payments → Payment methods → Boleto). If the account
      // hasn't flipped it on yet, Stripe returns invalid_payment_method
      // _types / parameter_unknown — retry card-only so the BR user still
      // reaches checkout in BRL instead of being told "payment failed".
      const stripeErr = sessionErr as { code?: string; param?: string; message?: string }
      const isBoletoIssue =
        currency === 'brl' &&
        sessionParams.payment_method_types?.includes('boleto') &&
        (stripeErr?.code === 'invalid_payment_method_types' ||
          stripeErr?.code === 'parameter_unknown' ||
          (typeof stripeErr?.param === 'string' && stripeErr.param.includes('payment_method_types')) ||
          (typeof stripeErr?.message === 'string' && stripeErr.message.toLowerCase().includes('boleto')))
      if (isBoletoIssue) {
        console.warn(
          '[stripe/checkout] boleto rejected by Stripe — retrying card-only',
          stripeErr?.code,
          stripeErr?.message,
        )
        sessionParams.payment_method_types = ['card']
        try {
          session = await stripe.checkout.sessions.create(sessionParams)
        } catch (retryErr) {
          const msg = retryErr instanceof Error ? retryErr.message : String(retryErr)
          console.error('[stripe/checkout] Session creation retry error:', msg)
          return NextResponse.json(
            { error: `Payment session failed: ${msg || 'Please try again'}` },
            { status: 500 }
          )
        }
      } else {
        const msg = sessionErr instanceof Error ? sessionErr.message : String(sessionErr)
        console.error('[stripe/checkout] Session creation error:', msg)
        return NextResponse.json(
          { error: `Payment session failed: ${msg || 'Please try again'}` },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[stripe/checkout] Unexpected error:', msg)
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 })
  }
}
