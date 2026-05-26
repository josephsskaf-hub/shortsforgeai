import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'

// Push #175 — force-dynamic so Next.js never tries to statically cache this
// route. Without this, the GET handler could be pre-rendered at build time
// and fail to read Supabase auth cookies on every request.
export const dynamic = 'force-dynamic'

type Tier = 'basic' | 'pro'
type Currency = 'usd' | 'brl' | 'inr'

// Push #273 — multi-currency support.
//   Basic:  $4.90 / month  (USD)  |  R$24.90 / month  (BRL)  |  ₹399 / month  (INR)
//   Pro:    $9.90 / month  (USD)  |  R$49.90 / month  (BRL)  |  ₹799 / month  (INR)
// Currency is auto-detected from the visitor's IP country (Vercel header).
// Payment methods are automatic (Stripe chooses card / UPI / PIX / etc. per country).
// Hosted payment links (direct, no session needed):
//   Basic: https://buy.stripe.com/14A28reRf6jtcev48CgjC0r
//   Pro:   https://buy.stripe.com/00w9AT5gF8rBa6ndJcgjC0q
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

// Amounts in the smallest currency unit (cents / centavos / paise).
// INR: ₹399 = 39900 paise (Basic), ₹799 = 79900 paise (Pro).
const TIER_PRICES: Record<Tier, Record<Currency, number>> = {
  basic: { usd: 490,  brl: 2490, inr: 39900 },
  pro:   { usd: 990,  brl: 4990, inr: 79900 },
}

// Map Vercel IP-country header → billing currency.
// Everyone not explicitly mapped gets USD.
function resolveCurrency(country: string): Currency {
  if (country === 'BR') return 'brl'
  if (country === 'IN') return 'inr'
  return 'usd'
}

// ─── Shared checkout-session builder ────────────────────────────────────────

async function buildAndRedirect(
  req: NextRequest,
  tier: Tier,
  isGet: boolean,
): Promise<NextResponse> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shortsforgeai.com'

  function redirectError(msg: string) {
    return NextResponse.redirect(`${appUrl}/pricing?checkout_error=${encodeURIComponent(msg)}`)
  }
  function jsonError(msg: string, status: number) {
    return NextResponse.json({ error: msg }, { status })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[stripe/checkout] STRIPE_SECRET_KEY is not set')
    return isGet
      ? redirectError('Payment service is not configured. Please contact support.')
      : jsonError('Payment service is not configured. Please contact support.', 500)
  }

  const country = req.headers.get('x-vercel-ip-country') ?? 'US'
  const currency: Currency = resolveCurrency(country)
  const plan = TIERS[tier]
  const unitAmount = TIER_PRICES[tier][currency]

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error('[stripe/checkout] Auth error or no user:', authError?.message)
    return isGet
      ? NextResponse.redirect(`${appUrl}/signup?redirect=${encodeURIComponent('/pricing')}`)
      : jsonError('You must be signed in to upgrade.', 401)
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email, stripe_customer_id, is_pro, stripe_subscription_id')
    .eq('id', user.id)
    .single()

  if (profileError && profileError.code !== 'PGRST116') {
    console.error('[stripe/checkout] Profile fetch error:', profileError.message, profileError.code)
  }

  // Push #166 — allow repeat purchases to stack credits.
  // Users with an active subscription can buy again; the webhook's
  // additive (current + planCredits) logic will add credits on top.
  // We still clear stale is_pro flags so the DB stays consistent.
  if (profile?.is_pro) {
    const subId = profile.stripe_subscription_id as string | null
    let isActuallyActive = false
    if (subId) {
      try {
        const sub = await stripe.subscriptions.retrieve(subId)
        isActuallyActive = sub.status === 'active' || sub.status === 'trialing'
      } catch (err) {
        console.warn('[stripe/checkout] could not verify subscription status, allowing checkout:', subId, err)
      }
    }
    if (!isActuallyActive) {
      // Stale flag — clear it and fall through to create a new checkout session.
      console.log('[stripe/checkout] stale is_pro cleared for user:', user.id, 'sub:', subId)
      await supabase
        .from('profiles')
        .update({ is_pro: false, plan: 'free', stripe_subscription_id: null })
        .eq('id', user.id)
    }
    // Active subscribers fall through to create a new checkout session —
    // credits are added additively by the webhook (current + planCredits).
  }

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
      return isGet
        ? redirectError('Failed to set up payment. Please try again.')
        : jsonError('Failed to set up payment. Please try again.', 500)
    }
  }

  // Push #273 — multi-currency (USD/BRL/INR). Payment methods via explicit list
  // so the Stripe SDK version stays compatible with subscription mode.
  // Stripe dashboard controls which methods are active per currency/country.
  // Credits are granted immediately at checkout completion (no trial).
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    payment_method_types: ['card'],
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
    success_url: `${appUrl}/checkout/success?success=true&currency=${currency}&amount=${unitAmount}`,
    cancel_url: `${appUrl}/checkout/cancelled`,
    metadata: {
      supabase_user_id: user.id,
      tier,
      plan_credits: String(plan.credits),
    },
    subscription_data: {
      metadata: {
        supabase_user_id: user.id,
        tier,
        plan_credits: String(plan.credits),
      },
    },
  }

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create(sessionParams)
  } catch (sessionErr) {
    const stripeErr = sessionErr as { message?: string; code?: string }
    const isCurrencyMismatch =
      typeof stripeErr?.message === 'string' &&
      stripeErr.message.toLowerCase().includes('cannot combine currencies')

    if (isCurrencyMismatch) {
      console.warn('[stripe/checkout] currency mismatch — creating new customer and retrying')
      try {
        const newCustomer = await stripe.customers.create({
          email: profile?.email ?? user.email ?? '',
          metadata: { supabase_user_id: user.id },
        })
        await supabase
          .from('profiles')
          .update({ stripe_customer_id: newCustomer.id })
          .eq('id', user.id)
        sessionParams.customer = newCustomer.id
        session = await stripe.checkout.sessions.create(sessionParams)
      } catch (retryErr) {
        const msg = retryErr instanceof Error ? retryErr.message : String(retryErr)
        console.error('[stripe/checkout] currency mismatch retry failed:', msg)
        return isGet
          ? redirectError(`Payment session failed: ${msg || 'Please try again'}`)
          : jsonError(`Payment session failed: ${msg || 'Please try again'}`, 500)
      }
    } else {
      const msg = sessionErr instanceof Error ? sessionErr.message : String(sessionErr)
      console.error('[stripe/checkout] Session creation error:', msg)
      return isGet
        ? redirectError(`Payment session failed: ${msg || 'Please try again'}`)
        : jsonError(`Payment session failed: ${msg || 'Please try again'}`, 500)
    }
  }

  return isGet
    ? NextResponse.redirect(session.url!)
    : NextResponse.json({ url: session.url })
}

// ─── GET handler (iOS Safari safe — server-side redirect) ────────────────────
// Buttons set window.location.href = '/api/stripe/checkout?tier=basic' so
// the browser navigates synchronously (no await / no gesture-chain break).
export async function GET(req: NextRequest) {
  try {
    const tierParam = req.nextUrl.searchParams.get('tier') ?? 'basic'
    const tier: Tier = tierParam === 'pro' ? 'pro' : 'basic'
    return await buildAndRedirect(req, tier, true)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[stripe/checkout GET] Unexpected error:', msg)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shortsforgeai.com'
    return NextResponse.redirect(
      `${appUrl}/pricing?checkout_error=${encodeURIComponent('An unexpected error occurred. Please try again.')}`
    )
  }
}

// ─── POST handl