import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'

// Push #175 — force-dynamic so Next.js never tries to statically cache this
// route. Without this, the GET handler could be pre-rendered at build time
// and fail to read Supabase auth cookies on every request.
export const dynamic = 'force-dynamic'

type Tier = 'starter' | 'basic' | 'pro'
type Currency = 'usd' | 'brl' | 'inr'

// Push #273 — multi-currency support.
//   Starter: $2.90 / month  (USD)  |  R$14.90 / month  (BRL)  |  ₹249 / month  (INR)
//   Basic:   $4.90 / month  (USD)  |  R$24.90 / month  (BRL)  |  ₹399 / month  (INR)
//   Pro:     $9.90 / month  (USD)  |  R$49.90 / month  (BRL)  |  ₹799 / month  (INR)
// Currency is auto-detected from the visitor's IP country (Vercel header).
// Payment methods are automatic (Stripe chooses card / UPI / PIX / etc. per country).
// Hosted payment links (direct, no session needed):
//   Basic: https://buy.stripe.com/14A28reRf6jtcev48CgjC0r
//   Pro:   https://buy.stripe.com/00w9AT5gF8rBa6ndJcgjC0q
const TIERS: Record<Tier, { name: string; description: string; credits: number }> = {
  starter: {
    name: 'ShortsForgeAI — Starter',
    description: '50 Fast videos / month (smart stock footage + AI voiceover)',
    credits: 50,
  },
  basic: {
    name: 'ShortsForgeAI — Creator',
    description: '8 AI-generated videos / month (Seedance engine)',
    credits: 240,
  },
  pro: {
    name: 'ShortsForgeAI — Studio',
    description: '8 cinematic AI videos / month (Kling engine, top quality)',
    credits: 360,
  },
}

// Amounts in the smallest currency unit (cents / centavos / paise).
// INR: ₹249 = 24900 paise (Starter), ₹399 = 39900 paise (Basic), ₹799 = 79900 paise (Pro).
// Push #401 — new 2-plan pricing. Basic $12.90 (Seedance), Pro $38.90 (Kling).
// BRL ≈ USD×5.0, INR ≈ USD×81 (same ratios as the old plans). starter kept only
// for grandfathered Spark subscribers; not offered to new users.
// Push #404 — 3-tier pricing. Starter $11.90 (Fast), Creator $24.90 (Seedance),
// Studio $37.90 (Kling). BRL ≈ USD×5.0, INR ≈ USD×81.
const TIER_PRICES: Record<Tier, Record<Currency, number>> = {
  starter: { usd: 1190, brl: 5990,  inr: 95900 },
  basic:   { usd: 2490, brl: 12490, inr: 199900 },
  pro:     { usd: 3790, brl: 18990, inr: 299900 },
}

// #381 — Annual prices = 10× the monthly price (≈2 months free). Smallest unit.
const ANNUAL_PRICES: Record<Tier, Record<Currency, number>> = {
  starter: { usd: 11900, brl: 59900,  inr: 959000 },
  basic:   { usd: 24900, brl: 124900, inr: 1999000 },
  pro:     { usd: 37900, brl: 189900, inr: 2999000 },
}

type Billing = 'monthly' | 'annual'

// Map Vercel IP-country header → billing currency.
// Everyone not explicitly mapped gets USD.
function resolveCurrency(country: string): Currency {
  if (country === 'BR') return 'brl'
  if (country === 'IN') return 'inr'
  return 'usd'
}

// #473 — Starter Pack: a one-time, low-commitment entry point (10 Fast Shorts).
// Breaks first-purchase hesitation for users who won't commit to a monthly
// subscription — they make the (hardest) first payment, then upsell to a plan
// later. Credited by the webhook via metadata.pack_credits (currency-proof,
// see webhook Path A). No Stripe product needed — inline price_data.
const STARTER_PACK = {
  credits: 10,
  name: 'ShortsForgeAI — Starter Pack',
  description: 'One-time: 10 Fast Shorts (no subscription).',
}
//   USD $4.90 | BRL R$24.90 | INR ₹399  (same ratios as the plans)
const PACK_PRICES: Record<Currency, number> = { usd: 490, brl: 2490, inr: 39900 }

// ─── Shared checkout-session builder ────────────────────────────────────────

async function buildAndRedirect(
  req: NextRequest,
  tier: Tier,
  isGet: boolean,
  billing: Billing = 'monthly',
  promo?: string,
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
  // #381 — annual vs monthly price + billing interval.
  const isAnnual = billing === 'annual'
  const unitAmount = isAnnual ? ANNUAL_PRICES[tier][currency] : TIER_PRICES[tier][currency]
  const interval: 'month' | 'year' = isAnnual ? 'year' : 'month'

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

  // Push #273 — multi-currency (USD/BRL/INR).
  // Push #414 — CONVERSION FIX: removed the hard `payment_method_types: ['card']`
  // restriction. 48 abandoned checkouts vs 3 payers, mostly BRL/INR — card-only
  // blocks UPI (India), local wallets and Link. Omitting the field lets Stripe
  // show every dashboard-enabled method that supports subscriptions for the
  // buyer's currency/country (worst case: identical card-only behavior).
  // Credits are granted immediately at checkout completion (no trial).
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: isAnnual ? `${plan.name} (Annual)` : plan.name,
            description: plan.description,
          },
          unit_amount: unitAmount,
          recurring: { interval },
        },
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${appUrl}/checkout/success?success=true&currency=${currency}&amount=${unitAmount}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/checkout/cancelled`,
    metadata: {
      supabase_user_id: user.id,
      tier,
      billing,
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

  // Push #453 — auto-apply a promotion code (e.g. FOUNDING50) when ?promo= is
  // present, so win-back / founding links give the discount with ZERO typing.
  // Looked up by its human-facing code; if it doesn't exist or is inactive we
  // silently skip it (checkout still proceeds at full price — never blocks a
  // sale). NOTE: Stripe forbids combining `discounts` with allow_promotion_codes,
  // and we set neither elsewhere, so this is safe.
  if (promo) {
    try {
      const codes = await stripe.promotionCodes.list({ code: promo, active: true, limit: 1 })
      const pc = codes.data[0]
      if (pc) {
        sessionParams.discounts = [{ promotion_code: pc.id }]
      } else {
        console.warn('[stripe/checkout] promo not found/inactive, skipping:', promo)
      }
    } catch (promoErr) {
      console.warn('[stripe/checkout] promo lookup failed, skipping:', promo, promoErr)
    }
  }

  // #481 — Rewardful affiliate attribution. The rewardful_referral cookie is set
  // client-side (root layout) when a visitor arrives via an affiliate link. Pass it
  // as client_reference_id so Rewardful attributes the subscription to the affiliate.
  // Only when present — Stripe Checkout errors on a blank client_reference_id.
  const rwReferral = req.cookies.get('rewardful_referral')?.value
  if (rwReferral) sessionParams.client_reference_id = rwReferral

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

// ─── One-time Starter Pack checkout (mode: 'payment') ────────────────────────
// #473 — $4.90 (USD) one-time → 10 Fast Shorts. No recurring, no Stripe product:
// inline price_data + metadata.pack_credits that the webhook reads to grant
// credits (currency-proof). client_reference_id kept for the legacy webhook path.
async function buildPackAndRedirect(req: NextRequest, isGet: boolean): Promise<NextResponse> {
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
  const unitAmount = PACK_PRICES[currency]

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return isGet
      ? NextResponse.redirect(`${appUrl}/signup?redirect=${encodeURIComponent('/generate')}`)
      : jsonError('You must be signed in to buy the Starter Pack.', 401)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, stripe_customer_id')
    .eq('id', user.id)
    .single()

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency,
          product_data: { name: STARTER_PACK.name, description: STARTER_PACK.description },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ],
    client_reference_id: user.id,
    success_url: `${appUrl}/checkout/success?success=true&pack=starter&currency=${currency}&amount=${unitAmount}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/generate`,
    metadata: {
      supabase_user_id: user.id,
      pack: 'starter10',
      pack_credits: String(STARTER_PACK.credits),
    },
  }
  // Attach the saved customer when present (cleaner receipts); else use email.
  if (profile?.stripe_customer_id) sessionParams.customer = profile.stripe_customer_id
  else sessionParams.customer_email = profile?.email ?? user.email ?? undefined

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create(sessionParams)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // A prior subscription in another currency can trigger "cannot combine
    // currencies" when attaching the customer — retry with email only so the
    // sale never blocks.
    if (msg.toLowerCase().includes('cannot combine currencies')) {
      delete sessionParams.customer
      sessionParams.customer_email = profile?.email ?? user.email ?? undefined
      try {
        session = await stripe.checkout.sessions.create(sessionParams)
      } catch (retryErr) {
        const rmsg = retryErr instanceof Error ? retryErr.message : String(retryErr)
        console.error('[stripe/checkout] pack retry failed:', rmsg)
        return isGet ? redirectError(`Payment session failed: ${rmsg || 'Please try again'}`) : jsonError('Payment session failed.', 500)
      }
    } else {
      console.error('[stripe/checkout] pack session error:', msg)
      return isGet ? redirectError(`Payment session failed: ${msg || 'Please try again'}`) : jsonError('Payment session failed.', 500)
    }
  }

  return isGet ? NextResponse.redirect(session.url!) : NextResponse.json({ url: session.url })
}

// ─── GET handler (iOS Safari safe — server-side redirect) ────────────────────
// Buttons set window.location.href = '/api/stripe/checkout?tier=basic' so
// the browser navigates synchronously (no await / no gesture-chain break).
export async function GET(req: NextRequest) {
  try {
    // #473 — Starter Pack one-time checkout: /api/stripe/checkout?pack=starter
    if (req.nextUrl.searchParams.get('pack')) {
      return await buildPackAndRedirect(req, true)
    }
    const tierParam = req.nextUrl.searchParams.get('tier') ?? 'basic'
    const tier: Tier = tierParam === 'pro' ? 'pro' : tierParam === 'starter' ? 'starter' : 'basic'
    const billing: Billing = req.nextUrl.searchParams.get('billing') === 'annual' ? 'annual' : 'monthly'
    const promo = req.nextUrl.searchParams.get('promo') ?? undefined
    return await buildAndRedirect(req, tier, true, billing, promo)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[stripe/checkout GET] Unexpected error:', msg)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://shortsforgeai.com'
    return NextResponse.redirect(
      `${appUrl}/pricing?checkout_error=${encodeURIComponent('An unexpected error occurred. Please try again.')}`
    )
  }
}
