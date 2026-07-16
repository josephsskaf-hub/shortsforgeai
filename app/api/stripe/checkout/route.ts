import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import { OFFER_290_ENABLED } from '@/lib/flags'
import Stripe from 'stripe'
import { createHash } from 'node:crypto'
import { paypalFetch } from '@/lib/paypal'

// Push #175 — force-dynamic so Next.js never tries to statically cache this
// route. Without this, the GET handler could be pre-rendered at build time
// and fail to read Supabase auth cookies on every request.
export const dynamic = 'force-dynamic'

type Tier = 'starter' | 'basic' | 'pro'
type Currency = 'usd' | 'brl' | 'inr'

function isStripeResourceMissing(error: unknown): boolean {
  const stripeError = error as { code?: string; type?: string; statusCode?: number } | null
  return stripeError?.code === 'resource_missing' ||
    (stripeError?.type === 'StripeInvalidRequestError' && stripeError?.statusCode === 404)
}

function isMissingStripeCustomer(error: unknown): boolean {
  const stripeError = error as { code?: string; param?: string; message?: string; statusCode?: number } | null
  if (!isStripeResourceMissing(error)) return false
  return stripeError?.param === 'customer' || /no such customer/i.test(stripeError?.message ?? '')
}

// KINEO-RECOVERY-2026-07-15 — checkout telemetry is written server-side so
// the immediate navigation to Stripe cannot cancel it. This also records the
// anonymous auth wall, which client-only click tracking could never see.
async function recordCheckoutEvent(
  name: 'checkout_attempted' | 'checkout_auth_required' | 'checkout_started' | 'checkout_failed',
  userId: string | null,
  metadata: Record<string, unknown>,
  sessionId?: string,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return
  try {
    const admin = createAdminClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const eventRow: Record<string, unknown> = {
      name,
      user_id: userId,
      path: '/api/stripe/checkout',
      session_id: sessionId ?? null,
      metadata,
    }
    // Stripe idempotency can return the same Checkout Session to two racing
    // requests. Give checkout_started a deterministic UUID so analytics also
    // remain idempotent instead of counting the same session twice.
    const stripeSessionId = typeof metadata.stripe_session_id === 'string' ? metadata.stripe_session_id : null
    if (name === 'checkout_started' && stripeSessionId) {
      const hex = createHash('sha256').update(`checkout_started:${stripeSessionId}`).digest('hex').slice(0, 32)
      eventRow.id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    }
    const { error } = await admin.from('events').insert(eventRow)
    if (error?.code === '23505' && name === 'checkout_started') return
    if (error) console.error('[stripe/checkout] event insert failed:', name, error.code, error.message)
  } catch (error) {
    console.error('[stripe/checkout] event insert threw:', name, error)
  }
}

// Push #273 — multi-currency support.
//   Starter: $2.90 / month  (USD)  |  R$14.90 / month  (BRL)  |  ₹249 / month  (INR)
//   Basic:   $4.90 / month  (USD)  |  R$24.90 / month  (BRL)  |  ₹399 / month  (INR)
//   Pro:     $9.90 / month  (USD)  |  R$49.90 / month  (BRL)  |  ₹799 / month  (INR)
// Currency is auto-detected from the visitor's IP country (Vercel header).
// Payment methods are automatic (Stripe chooses card / UPI / PIX / etc. per country).
// Hosted payment links (direct, no session needed):
//   Basic: https://buy.stripe.com/14A28reRf6jtcev48CgjC0r
//   Pro:   https://buy.stripe.com/00w9AT5gF8rBa6ndJcgjC0q
// KINEO-STRIPE-NAMES-2026-07-01 — checkout line-item names show "Kineo" (era ShortsForgeAI)
// KINEO-INTRO-MONTH-2026-07-13 — Starter/Studio ainda tinham copy+credits
// PRÉ-rebase ("50 Fast videos", 50/400) na TELA DE PAGAMENTO do Stripe — o
// comprador via uma promessa dobrada no momento mais sensível. O webhook
// nunca leu esses valores (usa a própria tabela 25/150/200), então era só
// copy/metadata — mas copy errada no checkout é trust-killer. Agora: 25/150/200.
const TIERS: Record<Tier, { name: string; description: string; credits: number }> = {
  starter: {
    name: 'Kineo — Starter',
    description: '25 credits / month — Fast videos (smart stock footage + AI voiceover), watermark-free',
    credits: 25,
  },
  basic: {
    name: 'Kineo — Creator',
    // KINEO-PRICING-V3B-2026-07-10 — Creator = 150 credits: 1 Hollywood film
    // every month included (150 cr), or ~7 AI-generated videos. Metadata
    // plan_credits follows this value.
    description: '150 credits / month — 1 Hollywood film included (or ~7 AI-generated videos)',
    credits: 150,
  },
  pro: {
    name: 'Kineo — Studio',
    description: '200 credits / month — cinematic Kling engine at 1080p, priority render queue',
    credits: 200,
  },
}

// Amounts in the smallest currency unit (cents / centavos / paise).
// INR: ₹249 = 24900 paise (Starter), ₹399 = 39900 paise (Basic), ₹799 = 79900 paise (Pro).
// Push #401 — new 2-plan pricing. Basic $12.90 (Seedance), Pro $38.90 (Kling).
// BRL ≈ USD×5.0, INR ≈ USD×81 (same ratios as the old plans). starter kept only
// for grandfathered Spark subscribers; not offered to new users.
// Push #404 — 3-tier pricing. Starter $11.90 (Fast), Creator $24.90 (Seedance),
// Studio $37.90 (Kling). BRL ≈ USD×5.0, INR ≈ USD×81.
// KINEO-PRICE-2026-07-06 — competitive repricing: Starter $11.90→$9.90,
// Creator $24.90→$19.90 (Studio unchanged). Margins recompute ≥45% (Seedance/Veo
// forced to 720p). BRL≈USD×5, INR≈USD×80.6 (same ratios as before).
// KINEO-PRICING-V3B-2026-07-10 — Creator monthly USD $19.90 → $24.90 (150
// credits, 1 Hollywood film/month included). BRL/INR and annual left as-is
// pending founder decision on the local-currency ladder. Existing subscribers
// are NOT affected (Stripe keeps the price on active subscriptions).
const TIER_PRICES: Record<Tier, Record<Currency, number>> = {
  starter: { usd: 990,  brl: 4990,  inr: 79900  },
  basic:   { usd: 2490, brl: 9990,  inr: 159900 },
  pro:     { usd: 3790, brl: 18990, inr: 299900 },
}

// #381 — Annual prices = 10× the monthly price (≈2 months free). Smallest unit.
// KINEO-PRICE-2026-07-06 — annual = 10× the new monthly (2 months free).
const ANNUAL_PRICES: Record<Tier, Record<Currency, number>> = {
  starter: { usd: 9900,  brl: 49900,  inr: 799000  },
  basic:   { usd: 19900, brl: 99900,  inr: 1599000 },
  pro:     { usd: 37900, brl: 189900, inr: 2999000 },
}

type Billing = 'monthly' | 'annual'

// KINEO-INTRO-MONTH-2026-07-13 — ROTA DE RECORRÊNCIA. O pack one-time $4.90
// era o beco sem saída do funil: quem pagava, comprava ISSO, gastava e sumia
// (5 pagantes, ~0 assinaturas). Agora os preços de entrada viram o 1º MÊS do
// plano de cima — mesmo "sim" barato, mas o default é recorrente:
//   $4.90 (ex-pack)   → 1º mês do Starter (renova $9.90)
//   $9.90 (ex-Starter)→ 1º mês do Creator (renova $24.90)
// Os valores por moeda REUSAM a escada existente (PACK_PRICES / TIER_PRICES),
// então o desconto fecha exato em USD/BRL/INR. Cupom Stripe amount_off,
// duration 'once' (só a 1ª fatura), criado IDEMPOTENTE em runtime por
// tier+moeda — zero setup manual no dashboard. Fail-safe: qualquer erro de
// cupom segue o checkout a preço cheio (nunca bloqueia venda).
// Anti-abuso: 1 intro por cliente — recusa se o customer já teve QUALQUER
// assinatura com metadata.intro='1' (cancelar/reassinar não repete o desconto).
type IntroTier = 'starter' | 'basic'
const INTRO_PRICES: Record<IntroTier, Record<Currency, number>> = {
  starter: { usd: 490, brl: 2490, inr: 39900 },  // = PACK_PRICES (o antigo one-time)
  basic:   { usd: 990, brl: 4990, inr: 79900 },  // = TIER_PRICES.starter (degrau de baixo)
}

async function ensureIntroCoupon(
  tier: IntroTier,
  currency: Currency,
  amountOff: number,
): Promise<string | null> {
  const id = `KINEO_INTRO_${tier.toUpperCase()}_${currency.toUpperCase()}`
  try {
    await stripe.coupons.retrieve(id)
    return id
  } catch {
    try {
      await stripe.coupons.create({
        id,
        amount_off: amountOff,
        currency,
        duration: 'once',
        name: `Kineo — first month intro (${tier}/${currency.toUpperCase()})`,
      })
      return id
    } catch (createErr) {
      // Corrida entre requests: outro request pode ter criado entre o retrieve
      // e o create. Confere de novo antes de desistir.
      try {
        await stripe.coupons.retrieve(id)
        return id
      } catch {
        console.warn('[stripe/checkout] intro coupon unavailable — full price:', id, createErr)
        return null
      }
    }
  }
}

// Map Vercel IP-country header → billing currency.
// Everyone not explicitly mapped gets USD.
function resolveCurrency(country: string): Currency {
  if (country === 'BR') return 'brl'
  if (country === 'IN') return 'inr'
  return 'usd'
}

// #473 — Starter Pack: a one-time, low-commitment entry point (10 videos).
// Breaks first-purchase hesitation for users who won't commit to a monthly
// subscription — they make the (hardest) first payment, then upsell to a plan
// later. Credited by the webhook via metadata.pack_credits (currency-proof,
// see webhook Path A). No Stripe product needed — inline price_data.
const STARTER_PACK = {
  // KINEO-PACK-25-2026-07-06 — bumped 10→25 Fast Shorts for the same $4.90.
  // KINEO-PRICING-V3C-2026-07-10 — back to 10 credits. With Fast now costing
  // 1 credit for paying accounts, the pack reads as "10 videos for $4.90"
  // (25 was over-generous after the 2:1 rebase: 25 cr ≈ the $9.90 plan).
  credits: 10,
  name: 'Kineo — Starter Pack',
  description: 'One-time: 10 videos (no subscription).',
}
//   USD $4.90 | BRL R$24.90 | INR ₹399  (same ratios as the plans)
const PACK_PRICES: Record<Currency, number> = { usd: 490, brl: 2490, inr: 39900 }

// KINEO-OFFER290-2026-07-07 — first-purchase URGENCY offer. A NEW user in the
// first 24h after their 1st video sees "$4.90 → $2.90, expires in 24h" with a
// live countdown. Same mechanics as the Starter Pack (one-time, inline
// price_data, credited by the webhook via metadata.pack_credits) but a smaller
// 10-Fast-videos entry at a discounted $2.90 to break the very first payment.
// LIMITED to 1 per account (profiles.offer290_used + has_paid guards). Gated
// entirely behind OFFER_290_ENABLED — while that flag is false this SKU returns
// 410 and never creates a Stripe session.
const STARTER290_PACK = {
  credits: 10,
  name: 'Kineo — First Pack (24h offer)',
  description: 'One-time launch offer: 10 Fast Shorts. Limited to 1 per account.',
}
//   USD $2.90 | BRL R$14.90 | INR ₹249  (same ratios as the plans)
const PACK290_PRICES: Record<Currency, number> = { usd: 290, brl: 1490, inr: 24900 }

// KINEO-TOPUP-2026-07-06 — AI credit top-ups for EXISTING subscribers who burn
// through their monthly AI credits before renewal. Priced ABOVE the plan
// per-credit rate ($0.104/cr Creator) so they never cannibalize a subscription,
// and sized SMALLER than a full plan so heavy users are nudged to upgrade
// instead of stacking packs. Seedance costs 40 cr/video. Credited by the webhook
// via metadata.pack_credits (same Path A as the Starter Pack). Gated to Creator+.
// Expire automatically at renewal (webhook SETS balance to the plan amount).
type TopupId = 'topup40' | 'topup120'
const CREDIT_TOPUPS: Record<TopupId, { credits: number; name: string; description: string; prices: Record<Currency, number> }> = {
  topup40:  { credits: 40,  name: 'Kineo — +40 credits',  description: 'One-time: 40 credits (1 AI-generated video). No subscription.',  prices: { usd: 590,  brl: 2990, inr: 49900  } },
  topup120: { credits: 120, name: 'Kineo — +120 credits', description: 'One-time: 120 credits (3 AI-generated videos). No subscription.', prices: { usd: 1290, brl: 6490, inr: 109900 } },
}

// KINEO-AVATAR-PACKS-RETIRED-2026-07-06 — the one-time "AI Avatar packs"
// (avatar1/avatar3/avatar10) sold the SEPARATE profiles.avatar_credits balance.
// Avatar generation now costs 120 UNIVERSAL video_credits, so those avatar
// credits are unspendable and the packs are retired. The AVATAR_PACKS map,
// STUDIO_AVATAR_DISCOUNT, and buildAvatarPackAndRedirect() are removed; the GET
// handler returns a clean 410 for ?pack=avatar1|avatar3|avatar10 instead of
// creating a Stripe session. Existing profiles.avatar_credits balances stay in
// the DB (just unsellable). Subscriptions, Starter Pack, and top-ups untouched.

// ─── Shared checkout-session builder ────────────────────────────────────────

async function buildAndRedirect(
  req: NextRequest,
  tier: Tier,
  isGet: boolean,
  billing: Billing = 'monthly',
  promo?: string,
  // KINEO-INTRO-MONTH-2026-07-13 — ?intro=1 pede o desconto de 1º mês
  // (starter/basic, monthly only). Ignorado silenciosamente fora disso.
  intro = false,
): Promise<NextResponse> {
  // Always return to the hostname the buyer actually used. The legacy env can
  // still point at shortsforgeai.vercel.app; trusting it adds an unnecessary
  // cross-domain hop and can drop auth/attribution cookies.
  const appUrl = req.nextUrl.origin
  const browserSessionCookie = req.cookies.get('kineo_event_session_id')?.value ?? ''
  const browserSessionId = /^[A-Za-z0-9_-]{8,64}$/.test(browserSessionCookie)
    ? browserSessionCookie
    : null

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
  const returnToWatermark = req.nextUrl.searchParams.get('return') === 'wm'
  const checkoutMetadata = {
    tier,
    billing,
    currency,
    intro_requested: intro,
    return_to: returnToWatermark ? 'watermark_moment' : 'checkout_success',
  }

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  await recordCheckoutEvent('checkout_attempted', user?.id ?? null, checkoutMetadata, browserSessionId ?? undefined)

  if (authError || !user) {
    await recordCheckoutEvent('checkout_auth_required', null, checkoutMetadata, browserSessionId ?? undefined)
    console.error('[stripe/checkout] Auth error or no user:', authError?.message)
    // KINEO-CHECKOUT-RESUME-2026-07-07 — 7 buyers hit "Auth session missing" and
    // the old redirect (/signup?redirect=/pricing) silently DROPPED the purchase
    // intent (tier/billing/promo) — one user clicked 7× in 3s and gave up. Now we
    // send them to the create-account screen carrying the FULL checkout URL.
    // Google OAuth works for both new and returning users there, while the email
    // login link preserves the same query. `resumed=1`
    // is a loop guard: if a resumed request STILL has no session, show a visible
    // error on /pricing instead of bouncing login↔checkout forever.
    if (!isGet) return jsonError('You must be signed in to upgrade.', 401)
    if (req.nextUrl.searchParams.get('resumed') === '1') {
      return redirectError('We could not confirm your sign-in. Please sign in and try again.')
    }
    const resume = `${req.nextUrl.pathname}${req.nextUrl.search}${req.nextUrl.search ? '&' : '?'}resumed=1`
    return NextResponse.redirect(`${appUrl}/signup?reason=checkout&redirect=${encodeURIComponent(resume)}`)
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email, stripe_customer_id, is_pro, plan, stripe_subscription_id, paypal_subscription_id')
    .eq('id', user.id)
    .single()

  if (profileError && profileError.code !== 'PGRST116') {
    console.error('[stripe/checkout] Profile fetch error:', profileError.message, profileError.code)
    return isGet
      ? redirectError('We could not verify your account. Please try again in a moment.')
      : jsonError('We could not verify your account. Please try again in a moment.', 503)
  }
  if (!profile) {
    console.error('[stripe/checkout] Profile missing for authenticated user:', user.id)
    return isGet
      ? redirectError('Your account is still being prepared. Please refresh and try again.')
      : jsonError('Your account is still being prepared. Please refresh and try again.', 503)
  }

  const originalCustomerId = profile.stripe_customer_id as string | null
  let customerId = originalCustomerId
  let linkedStripeCustomerId: string | null = null
  const subscriptionCandidates = new Map<string, Stripe.Subscription>()
  const hadLinkedProvider = Boolean(profile.paypal_subscription_id || profile.stripe_subscription_id)
  let stalePayPalSubscription = false
  let staleStripeSubscription = false
  let staleStripeCustomer = false

  const subscriptionPriority = (sub: Stripe.Subscription): number => {
    if (sub.status === 'active' || sub.status === 'trialing') return 0
    if (sub.status === 'past_due') return 1
    if (sub.status === 'paused') return 2
    if (sub.status === 'incomplete') return 3
    if (sub.status === 'unpaid') return 4
    return 5
  }
  const considerSubscription = (sub: Stripe.Subscription): void => {
    if (sub.status === 'canceled' || sub.status === 'incomplete_expired') return
    if (!subscriptionCandidates.has(sub.id)) subscriptionCandidates.set(sub.id, sub)
  }

  // Inspect every linked provider before mutating the profile. A stale linked
  // id must never downgrade a payer when another live subscription exists.
  if (profile.paypal_subscription_id) {
    const paypalSubscriptionId = String(profile.paypal_subscription_id)
    try {
      const paypalSubscription = await paypalFetch(`/v1/billing/subscriptions/${paypalSubscriptionId}`) as { status?: string } | null
      const paypalStatus = String(paypalSubscription?.status ?? '').toUpperCase()
      stalePayPalSubscription = paypalStatus === 'CANCELLED' || paypalStatus === 'EXPIRED'
      if (!stalePayPalSubscription) {
        return redirectError('You already have a Kineo subscription. Manage that plan before starting another one.')
      }
    } catch (err) {
      console.error('[stripe/checkout] could not verify PayPal subscription; refusing duplicate checkout:', paypalSubscriptionId, err)
      return isGet
        ? redirectError('We could not verify your current subscription. Please try again or contact support.')
        : jsonError('We could not verify your current subscription. Please try again or contact support.', 503)
    }
  }

  if (profile.stripe_subscription_id) {
    const subId = String(profile.stripe_subscription_id)
    try {
      const sub = await stripe.subscriptions.retrieve(subId)
      const linkedSubscriptionOwnerId = sub.metadata?.supabase_user_id
      if (linkedSubscriptionOwnerId && linkedSubscriptionOwnerId !== user.id) {
        console.error('[stripe/checkout] linked Stripe subscription belongs to another user:', user.id, subId)
        return isGet
          ? redirectError('We could not verify your current subscription. Please contact support.')
          : jsonError('We could not verify your current subscription. Please contact support.', 409)
      }
      linkedStripeCustomerId = typeof sub.customer === 'string'
        ? sub.customer
        : sub.customer?.id ?? null
      staleStripeSubscription = sub.status === 'canceled' || sub.status === 'incomplete_expired'
      if (!staleStripeSubscription) {
        // Carry this into the common repair path. Returning here would block a
        // duplicate checkout but leave a mismatched Customer pointer (and stale
        // access state) unrepaired.
        considerSubscription(sub)
      } else {
        console.log('[stripe/checkout] terminal linked Stripe subscription found:', user.id, subId, sub.status)
      }
    } catch (err) {
      if (isStripeResourceMissing(err)) {
        staleStripeSubscription = true
        console.warn('[stripe/checkout] linked Stripe subscription no longer exists; auditing Customer:', user.id, subId)
      } else {
        console.error('[stripe/checkout] could not verify Stripe subscription; refusing duplicate checkout:', subId, err)
        return isGet
          ? redirectError('We could not verify your current subscription. Please try again or contact support.')
          : jsonError('We could not verify your current subscription. Please try again or contact support.', 503)
      }
    }
  }

  const customerIdsToAudit = Array.from(new Set(
    [customerId, linkedStripeCustomerId].filter((id): id is string => Boolean(id)),
  ))
  const validCustomerIds: string[] = []

  // A legacy profile can have a Customer pointer that differs from the
  // Customer attached to its linked subscription. Audit both before clearing
  // access so a live subscription on either Customer cannot be overlooked.
  // Customer ownership is checked before reusing it: a corrupted/malicious
  // profile pointer must never expose or charge another user's saved Customer.
  for (const auditCustomerId of customerIdsToAudit) {
    try {
      const stripeCustomer = await stripe.customers.retrieve(auditCustomerId)
      if ('deleted' in stripeCustomer && stripeCustomer.deleted) {
        if (auditCustomerId === originalCustomerId) staleStripeCustomer = true
        console.warn('[stripe/checkout] deleted Stripe Customer excluded after ownership audit:', user.id, auditCustomerId)
        continue
      }
      if (stripeCustomer.metadata?.supabase_user_id !== user.id) {
        console.error('[stripe/checkout] Stripe Customer ownership mismatch; refusing checkout:', user.id, auditCustomerId)
        return isGet
          ? redirectError('We could not verify your billing account. Please contact support.')
          : jsonError('We could not verify your billing account. Please contact support.', 409)
      }
      const subscriptions = await stripe.subscriptions.list({ customer: auditCustomerId, status: 'all', limit: 100 })
      validCustomerIds.push(auditCustomerId)
      for (const subscription of subscriptions.data) {
        const subscriptionOwnerId = subscription.metadata?.supabase_user_id
        if (subscriptionOwnerId && subscriptionOwnerId !== user.id) {
          console.error('[stripe/checkout] Customer contains subscription for another user; refusing checkout:', user.id, auditCustomerId, subscription.id)
          return isGet
            ? redirectError('We could not verify your current subscription. Please contact support.')
            : jsonError('We could not verify your current subscription. Please contact support.', 409)
        }
        considerSubscription(subscription)
      }
    } catch (err) {
      if (isMissingStripeCustomer(err)) {
        if (auditCustomerId === originalCustomerId) staleStripeCustomer = true
        console.warn('[stripe/checkout] Stripe Customer no longer exists; excluding it after the full audit:', user.id, auditCustomerId)
      } else {
        console.error('[stripe/checkout] could not audit Customer subscriptions; refusing duplicate checkout:', auditCustomerId, err)
        return isGet
          ? redirectError('We could not verify your current subscription. Please try again or contact support.')
          : jsonError('We could not verify your current subscription. Please try again or contact support.', 503)
      }
    }
  }

  const preferredCustomerId = customerId ?? linkedStripeCustomerId
  customerId = preferredCustomerId && validCustomerIds.includes(preferredCustomerId)
    ? preferredCustomerId
    : validCustomerIds[0] ?? null

  const existingCustomerSubscription = Array.from(subscriptionCandidates.values())
    .sort((a, b) => subscriptionPriority(a) - subscriptionPriority(b))[0] ?? null

  if (existingCustomerSubscription) {
    const grantsAccess = existingCustomerSubscription.status === 'active' || existingCustomerSubscription.status === 'trialing'
    const repair: Record<string, unknown> = {
      stripe_subscription_id: existingCustomerSubscription.id,
      is_pro: grantsAccess,
    }
    const subscriptionCustomerId = typeof existingCustomerSubscription.customer === 'string'
      ? existingCustomerSubscription.customer
      : existingCustomerSubscription.customer?.id ?? null
    if (subscriptionCustomerId) repair.stripe_customer_id = subscriptionCustomerId
    if (stalePayPalSubscription) repair.paypal_subscription_id = null
    const activeTier = existingCustomerSubscription.metadata?.tier
    if (grantsAccess && (activeTier === 'starter' || activeTier === 'basic' || activeTier === 'pro')) {
      repair.plan = activeTier
    } else if (!grantsAccess) {
      repair.plan = 'free'
    }
    const { error: repairError } = await supabase.from('profiles').update(repair).eq('id', user.id)
    if (repairError) {
      console.error('[stripe/checkout] active subscription profile repair failed:', user.id, repairError.message)
    }
    console.warn('[stripe/checkout] non-terminal subscription found on Customer; duplicate checkout blocked:', user.id, existingCustomerSubscription.id, existingCustomerSubscription.status)
    return redirectError('You already have a Kineo subscription. Manage that plan before starting another one.')
  }

  // Provider-less Pro may be an admin grant or a legacy payment. Only linked
  // provider ids confirmed terminal/missing authorize a downgrade.
  if (profile.is_pro && !hadLinkedProvider) {
    return isGet
      ? redirectError('Your account already has paid access. Contact support before starting another subscription.')
      : jsonError('Your account already has paid access. Contact support before starting another subscription.', 409)
  }

  const staleProfilePatch: Record<string, unknown> = {}
  if (stalePayPalSubscription) staleProfilePatch.paypal_subscription_id = null
  if (staleStripeSubscription) staleProfilePatch.stripe_subscription_id = null
  if (staleStripeCustomer || (!originalCustomerId && customerId)) {
    staleProfilePatch.stripe_customer_id = customerId
  }
  if (hadLinkedProvider) {
    staleProfilePatch.is_pro = false
    staleProfilePatch.plan = 'free'
  }
  if (Object.keys(staleProfilePatch).length > 0) {
    const { error: staleUpdateError } = await supabase
      .from('profiles')
      .update(staleProfilePatch)
      .eq('id', user.id)
    if (staleUpdateError) {
      console.error('[stripe/checkout] confirmed-stale profile cleanup failed:', user.id, staleUpdateError.message)
      return isGet
        ? redirectError('We could not update your account. Please try again in a moment.')
        : jsonError('We could not update your account. Please try again in a moment.', 503)
    }
  }

  // KINEO-RECOVERY-2026-07-15 — never create a second recurring subscription
  // for an already-active customer. It causes duplicate billing and inflates
  // subscriber counts; credit top-ups remain available through their own route.
  // Only a provider-confirmed terminal state may clear a stale profile. A
  // temporary provider/API error must fail closed, never downgrade a payer.
  if (!customerId) {
    try {
      const customerKey = staleStripeCustomer && originalCustomerId
        ? `kineo-customer-recovery-v1:${user.id}:${createHash('sha256').update(originalCustomerId).digest('hex').slice(0, 20)}`
        : `kineo-customer-v1:${user.id}`
      const customer = await stripe.customers.create(
        {
          email: profile.email ?? user.email ?? '',
          metadata: { supabase_user_id: user.id },
        },
        // Two simultaneous first-checkout requests must converge on the same
        // Customer before the profile update has time to persist. A confirmed
        // deleted Customer gets a new deterministic recovery key.
        { idempotencyKey: customerKey },
      )
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
    cancel_url: `${appUrl}/checkout/cancelled?tier=${tier}&billing=${billing}${intro ? '&intro=1' : ''}${returnToWatermark ? '&return=wm' : ''}`,
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

  let discountApplied = false

  // KINEO-INTRO-MONTH-2026-07-13 — desconto de 1º mês (vence o ?promo=: o
  // intro é mais fundo que 20%). Só monthly, só starter/basic, 1 por cliente.
  if (intro && !isAnnual && (tier === 'starter' || tier === 'basic')) {
    let introAlreadyUsed = false
    try {
      const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 })
      introAlreadyUsed = subs.data.some((s) => s.metadata?.intro === '1')
    } catch (listErr) {
      // Se a listagem falhar, seguimos: o cupom é 'once' e o dano máximo é
      // um 1º mês barato repetido — melhor que bloquear a venda.
      console.warn('[stripe/checkout] intro eligibility check failed, allowing:', listErr)
    }
    if (!introAlreadyUsed) {
      const amountOff = TIER_PRICES[tier][currency] - INTRO_PRICES[tier][currency]
      if (amountOff > 0) {
        const couponId = await ensureIntroCoupon(tier, currency, amountOff)
        if (couponId) {
          sessionParams.discounts = [{ coupon: couponId }]
          discountApplied = true
          // Marca a assinatura: é assim que o anti-abuso acima reconhece
          // "este cliente já usou o intro" sem precisar de migração no DB.
          sessionParams.subscription_data!.metadata!.intro = '1'
          // Espelha no Checkout Session para o webhook registrar corretamente
          // payment_success.metadata.intro sem uma chamada extra à API Stripe.
          sessionParams.metadata!.intro = '1'
          // Success page mostra o valor realmente cobrado hoje.
          sessionParams.success_url = `${appUrl}/checkout/success?success=true&currency=${currency}&amount=${INTRO_PRICES[tier][currency]}&intro=1&session_id={CHECKOUT_SESSION_ID}`
        }
      }
    }
  }

  // Push #453 — auto-apply a promotion code (e.g. FOUNDING50) when ?promo= is
  // present, so win-back / founding links give the discount with ZERO typing.
  // Looked up by its human-facing code; if it doesn't exist or is inactive we
  // silently skip it (checkout still proceeds at full price — never blocks a
  // sale). NOTE: Stripe forbids combining `discounts` with allow_promotion_codes,
  // and we set neither elsewhere, so this is safe.
  if (!discountApplied && promo) {
    try {
      const codes = await stripe.promotionCodes.list({ code: promo, active: true, limit: 1 })
      const pc = codes.data[0]
      if (pc) {
        sessionParams.discounts = [{ promotion_code: pc.id }]
        discountApplied = true
      } else {
        console.warn('[stripe/checkout] promo not found/inactive, skipping:', promo)
      }
    } catch (promoErr) {
      console.warn('[stripe/checkout] promo lookup failed, skipping:', promo, promoErr)
    }
  }

  // KINEO-PROMO-FIELD-2026-07-08 — manual promo field for loose campaigns.
  // When we did NOT auto-apply a discount via ?promo=, turn on Stripe's built-in
  // "Add promotion code" field so someone can type a code (e.g. KINEO20) by hand —
  // useful for social posts / stories where we can't force the ?promo= link.
  // Stripe forbids combining `discounts` with allow_promotion_codes, so we enable
  // it ONLY when no discount was applied above (never both on the same session).
  if (!discountApplied) {
    sessionParams.allow_promotion_codes = true
  }

  // The payment page may need its normal amount copy, but a successful
  // post-video purchase must return to the exact saved render for a clean
  // re-composition. Apply this last so intro/promo branches cannot overwrite it.
  if (returnToWatermark) {
    sessionParams.success_url = `${appUrl}/generate?wm_unlock=1&session_id={CHECKOUT_SESSION_ID}`
  }

  // #481 — Rewardful affiliate attribution. The rewardful_referral cookie is set
  // client-side (root layout) when a visitor arrives via an affiliate link. Pass it
  // as client_reference_id so Rewardful attributes the subscription to the affiliate.
  // Only when present — Stripe Checkout errors on a blank client_reference_id.
  const rwReferral = req.cookies.get('rewardful_referral')?.value
  if (rwReferral) sessionParams.client_reference_id = rwReferral

  // KINEO-CHECKOUT-IDEMPOTENCY-2026-07-15 — 19 of 37 historical expired
  // subscription sessions were repeats; one account created eight sessions in
  // three seconds. Deduplicate only identical purchase intent in a five-minute
  // window. The signature includes every value that can change the price,
  // entitlement, attribution or return behaviour, so another tier, currency,
  // intro/promo, billing period or cancel/success destination stays distinct.
  const checkoutWindow = Math.floor(Date.now() / (5 * 60 * 1000))
  const checkoutIdempotencyKeyFor = (finalCustomerId: string): string => {
    const checkoutSignature = JSON.stringify({
      version: 2,
      user_id: user.id,
      customer_id: finalCustomerId,
      tier,
      billing,
      currency,
      unit_amount: unitAmount,
      interval,
      intro_requested: intro,
      discount_applied: discountApplied,
      discounts: sessionParams.discounts ?? null,
      allow_promotion_codes: sessionParams.allow_promotion_codes ?? false,
      success_url: sessionParams.success_url,
      cancel_url: sessionParams.cancel_url,
      client_reference_id: sessionParams.client_reference_id ?? null,
      window: checkoutWindow,
    })
    return `kineo-sub-v2:${createHash('sha256').update(checkoutSignature).digest('hex')}`
  }
  const createCheckoutSessionFor = (finalCustomerId: string) => {
    sessionParams.customer = finalCustomerId
    return stripe.checkout.sessions.create(
      sessionParams,
      { idempotencyKey: checkoutIdempotencyKeyFor(finalCustomerId) },
    )
  }

  let session: Stripe.Checkout.Session
  try {
    session = await createCheckoutSessionFor(customerId)
  } catch (sessionErr) {
    const stripeErr = sessionErr as { message?: string; code?: string }
    const isCurrencyMismatch =
      typeof stripeErr?.message === 'string' &&
      stripeErr.message.toLowerCase().includes('cannot combine currencies')

    if (isCurrencyMismatch) {
      console.warn('[stripe/checkout] currency mismatch — creating new customer and retrying')
      try {
        const priorCustomerId = typeof sessionParams.customer === 'string' ? sessionParams.customer : customerId
        const repairCustomerHash = createHash('sha256')
          .update(`${user.id}:${currency}:${priorCustomerId}`)
          .digest('hex')
          .slice(0, 32)
        const newCustomer = await stripe.customers.create(
          {
            email: profile.email ?? user.email ?? '',
            metadata: { supabase_user_id: user.id, currency_repair: currency },
          },
          { idempotencyKey: `kineo-customer-currency-v1:${repairCustomerHash}` },
        )
        const { error: repairPersistError } = await supabase
          .from('profiles')
          .update({ stripe_customer_id: newCustomer.id })
          .eq('id', user.id)
        if (repairPersistError) {
          console.error('[stripe/checkout] currency repair Customer persistence failed:', repairPersistError.message)
        }
        // Recompute from the final Customer so concurrent repairs and the next
        // request using the repaired profile all converge on the same Session.
        session = await createCheckoutSessionFor(newCustomer.id)
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

  await recordCheckoutEvent(
    'checkout_started',
    user.id,
    { ...checkoutMetadata, intro_applied: discountApplied && intro, stripe_session_id: session.id },
    browserSessionId ?? undefined,
  )

  return isGet
    ? NextResponse.redirect(session.url!)
    : NextResponse.json({ url: session.url })
}

// ─── One-time Starter Pack checkout (mode: 'payment') ────────────────────────
// #473 — $4.90 (USD) one-time → 10 Fast Shorts. No recurring, no Stripe product:
// inline price_data + metadata.pack_credits that the webhook reads to grant
// credits (currency-proof). client_reference_id kept for the legacy webhook path.
async function buildPackAndRedirect(req: NextRequest, isGet: boolean): Promise<NextResponse> {
  const appUrl = req.nextUrl.origin
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
    // KINEO-CHECKOUT-RESUME-2026-07-07 — carry the full pack checkout URL through
    // login so the purchase resumes automatically after sign-in (see buildAndRedirect).
    // `resumed=1` = loop guard (visible error instead of login↔checkout forever).
    if (!isGet) return jsonError('You must be signed in to buy the Starter Pack.', 401)
    if (req.nextUrl.searchParams.get('resumed') === '1') {
      return redirectError('We could not confirm your sign-in. Please sign in and try again.')
    }
    const resume = `${req.nextUrl.pathname}${req.nextUrl.search}${req.nextUrl.search ? '&' : '?'}resumed=1`
    return NextResponse.redirect(`${appUrl}/login?reason=checkout&redirect=${encodeURIComponent(resume)}`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, stripe_customer_id')
    .eq('id', user.id)
    .single()

  // KINEO-WM-CHECKOUT-2026-07-07 — the post-render "remove watermark" CTA sends
  // ?return=wm so Stripe returns the buyer to /generate?wm_unlock=1 (instead of
  // /checkout/success). The generator then re-renders the SAME just-made Fast
  // video WITHOUT the watermark and swaps it into the preview. Any other pack
  // purchase keeps the normal success page.
  const returnTo = req.nextUrl.searchParams.get('return')
  const packSuccessUrl =
    returnTo === 'wm'
      ? `${appUrl}/generate?wm_unlock=1&session_id={CHECKOUT_SESSION_ID}`
      : `${appUrl}/checkout/success?success=true&pack=starter&currency=${currency}&amount=${unitAmount}&session_id={CHECKOUT_SESSION_ID}`

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
    success_url: packSuccessUrl,
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

// ─── KINEO-OFFER290-2026-07-07 — first-purchase $2.90 offer (mode: 'payment') ─
// $2.90 (USD) one-time → 10 Fast Shorts. Gated behind OFFER_290_ENABLED and
// hard-limited to 1 per account: rejects if the user already used the offer
// (profiles.offer290_used) OR already paid anything (has_paid). Credited by the
// webhook via metadata.pack_credits (=10); the webhook also sets offer290_used.
async function buildStarter290AndRedirect(req: NextRequest, isGet: boolean): Promise<NextResponse> {
  const appUrl = req.nextUrl.origin
  function redirectError(msg: string) {
    return NextResponse.redirect(`${appUrl}/generate?checkout_error=${encodeURIComponent(msg)}`)
  }
  function jsonError(msg: string, status: number) {
    return NextResponse.json({ error: msg }, { status })
  }

  // Feature flag OFF → SKU disabled (410 Gone). Nothing can be purchased.
  if (!OFFER_290_ENABLED) {
    return isGet
      ? redirectError('This offer is not available.')
      : jsonError('Offer disabled.', 410)
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[stripe/checkout] STRIPE_SECRET_KEY is not set')
    return isGet ? redirectError('Payment service is not configured. Please contact support.') : jsonError('Payment service is not configured. Please contact support.', 500)
  }

  const country = req.headers.get('x-vercel-ip-country') ?? 'US'
  const currency: Currency = resolveCurrency(country)
  const unitAmount = PACK290_PRICES[currency]

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    // KINEO-CHECKOUT-RESUME-2026-07-07 — resume the offer checkout after sign-in.
    if (!isGet) return jsonError('You must be signed in to claim this offer.', 401)
    if (req.nextUrl.searchParams.get('resumed') === '1') {
      return redirectError('We could not confirm your sign-in. Please sign in and try again.')
    }
    const resume = `${req.nextUrl.pathname}${req.nextUrl.search}${req.nextUrl.search ? '&' : '?'}resumed=1`
    return NextResponse.redirect(`${appUrl}/login?reason=checkout&redirect=${encodeURIComponent(resume)}`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, stripe_customer_id, has_paid, offer290_used')
    .eq('id', user.id)
    .single()

  // Enforce 1-per-account: already claimed the offer, or already paid anything.
  if (profile?.offer290_used === true || profile?.has_paid === true) {
    return isGet
      ? redirectError('You already claimed this one-time offer.')
      : jsonError('Offer already used.', 409)
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency,
          product_data: { name: STARTER290_PACK.name, description: STARTER290_PACK.description },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ],
    client_reference_id: user.id,
    success_url: `${appUrl}/checkout/success?success=true&pack=starter290&currency=${currency}&amount=${unitAmount}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/generate`,
    metadata: {
      supabase_user_id: user.id,
      pack: 'starter290',
      pack_credits: String(STARTER290_PACK.credits),
    },
  }
  if (profile?.stripe_customer_id) sessionParams.customer = profile.stripe_customer_id
  else sessionParams.customer_email = profile?.email ?? user.email ?? undefined

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create(sessionParams)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes('cannot combine currencies')) {
      delete sessionParams.customer
      sessionParams.customer_email = profile?.email ?? user.email ?? undefined
      try {
        session = await stripe.checkout.sessions.create(sessionParams)
      } catch (retryErr) {
        const rmsg = retryErr instanceof Error ? retryErr.message : String(retryErr)
        console.error('[stripe/checkout] starter290 retry failed:', rmsg)
        return isGet ? redirectError(`Payment session failed: ${rmsg || 'Please try again'}`) : jsonError('Payment session failed.', 500)
      }
    } else {
      console.error('[stripe/checkout] starter290 session error:', msg)
      return isGet ? redirectError(`Payment session failed: ${msg || 'Please try again'}`) : jsonError('Payment session failed.', 500)
    }
  }

  console.log(`[stripe/checkout] starter290 session: user=${user.id.slice(0, 8)} amount=${unitAmount}`)
  return isGet ? NextResponse.redirect(session.url!) : NextResponse.json({ url: session.url })
}

// ─── KINEO-TOPUP-2026-07-06 — AI credit top-up checkout (mode: 'payment') ─────
// Gated to Creator+ (basic/pro). Frees a subscriber who ran out of AI credits
// mid-cycle to buy 1 or 3 more AI videos instead of hitting a wall. Credited by
// the webhook via metadata.pack_credits.
async function buildTopupAndRedirect(req: NextRequest, topupId: TopupId, isGet: boolean): Promise<NextResponse> {
  const appUrl = req.nextUrl.origin
  function redirectError(msg: string) {
    return NextResponse.redirect(`${appUrl}/generate?checkout_error=${encodeURIComponent(msg)}`)
  }
  function jsonError(msg: string, status: number) {
    return NextResponse.json({ error: msg }, { status })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[stripe/checkout] STRIPE_SECRET_KEY is not set')
    return isGet ? redirectError('Payment service is not configured. Please contact support.') : jsonError('Payment service is not configured. Please contact support.', 500)
  }

  const country = req.headers.get('x-vercel-ip-country') ?? 'US'
  const currency: Currency = resolveCurrency(country)
  const topup = CREDIT_TOPUPS[topupId]
  const unitAmount = topup.prices[currency]

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    // KINEO-CHECKOUT-RESUME-2026-07-07 — resume the top-up checkout after sign-in.
    // `resumed=1` = loop guard (visible error instead of login↔checkout forever).
    if (!isGet) return jsonError('You must be signed in to buy credits.', 401)
    if (req.nextUrl.searchParams.get('resumed') === '1') {
      return redirectError('We could not confirm your sign-in. Please sign in and try again.')
    }
    const resume = `${req.nextUrl.pathname}${req.nextUrl.search}${req.nextUrl.search ? '&' : '?'}resumed=1`
    return NextResponse.redirect(`${appUrl}/login?reason=checkout&redirect=${encodeURIComponent(resume)}`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, stripe_customer_id, plan')
    .eq('id', user.id)
    .single()

  // Gate: AI credit top-ups are a Creator/Studio benefit (the AI engine lives on
  // those plans). Free/Starter users are sent to /pricing to subscribe instead.
  const planVal = (profile?.plan ?? 'free').toLowerCase()
  const isCreatorPlus = planVal === 'basic' || planVal === 'basic_trial' || planVal === 'pro' || planVal === 'pro_trial'
  if (!isCreatorPlus) {
    return isGet
      ? NextResponse.redirect(`${appUrl}/pricing?checkout_error=${encodeURIComponent('Credit top-ups are for Creator & Studio plans. Upgrade to unlock the AI engine.')}`)
      : jsonError('Credit top-ups require a Creator or Studio plan.', 403)
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency,
          product_data: { name: topup.name, description: topup.description },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ],
    client_reference_id: user.id,
    success_url: `${appUrl}/generate?success=true&topup=${topupId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/generate`,
    metadata: {
      supabase_user_id: user.id,
      pack: topupId,
      pack_credits: String(topup.credits),
    },
  }
  if (profile?.stripe_customer_id) sessionParams.customer = profile.stripe_customer_id
  else sessionParams.customer_email = profile?.email ?? user.email ?? undefined

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create(sessionParams)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.toLowerCase().includes('cannot combine currencies')) {
      delete sessionParams.customer
      sessionParams.customer_email = profile?.email ?? user.email ?? undefined
      try {
        session = await stripe.checkout.sessions.create(sessionParams)
      } catch (retryErr) {
        const rmsg = retryErr instanceof Error ? retryErr.message : String(retryErr)
        console.error('[stripe/checkout] topup retry failed:', rmsg)
        return isGet ? redirectError(`Payment session failed: ${rmsg || 'Please try again'}`) : jsonError('Payment session failed.', 500)
      }
    } else {
      console.error('[stripe/checkout] topup session error:', msg)
      return isGet ? redirectError(`Payment session failed: ${msg || 'Please try again'}`) : jsonError('Payment session failed.', 500)
    }
  }

  console.log(`[stripe/checkout] topup session: ${topupId} user=${user.id.slice(0, 8)} amount=${unitAmount}`)
  return isGet ? NextResponse.redirect(session.url!) : NextResponse.json({ url: session.url })
}

// KINEO-AVATAR-PACKS-RETIRED-2026-07-06 — buildAvatarPackAndRedirect() removed.
// Avatar packs sold profiles.avatar_credits, now unspendable (avatar generation
// costs 120 universal video_credits). ?pack=avatar* now returns a clean 410 in
// the GET handler below instead of creating a Stripe session.

// ─── GET handler (iOS Safari safe — server-side redirect) ────────────────────
// Buttons set window.location.href = '/api/stripe/checkout?tier=basic' so
// the browser navigates synchronously (no await / no gesture-chain break).
export async function GET(req: NextRequest) {
  try {
    // #473 — Starter Pack one-time checkout: /api/stripe/checkout?pack=starter
    const packParam = req.nextUrl.searchParams.get('pack')
    if (packParam) {
      // KINEO-AVATAR-PACKS-RETIRED-2026-07-06 — avatar packs are gone. Avatar
      // videos now use universal credits, so avatar_credits packs are unsellable.
      // Return a clean 410 rather than crashing on the removed builder.
      if (packParam === 'avatar1' || packParam === 'avatar3' || packParam === 'avatar10') {
        return NextResponse.json(
          { error: 'Avatar packs retired — avatar videos now use universal credits' },
          { status: 410 },
        )
      }
      // KINEO-TOPUP-2026-07-06 — AI credit top-ups (Creator+).
      if (packParam === 'topup40' || packParam === 'topup120') {
        return await buildTopupAndRedirect(req, packParam, true)
      }
      // KINEO-OFFER290-2026-07-07 — first-purchase $2.90 offer (flag-gated).
      if (packParam === 'starter290') {
        return await buildStarter290AndRedirect(req, true)
      }
      return await buildPackAndRedirect(req, true)
    }
    const tierParam = req.nextUrl.searchParams.get('tier') ?? 'basic'
    const tier: Tier = tierParam === 'pro' ? 'pro' : tierParam === 'starter' ? 'starter' : 'basic'
    const billing: Billing = req.nextUrl.searchParams.get('billing') === 'annual' ? 'annual' : 'monthly'
    const promo = req.nextUrl.searchParams.get('promo') ?? undefined
    // KINEO-INTRO-MONTH-2026-07-13 — ?intro=1 → 1º mês com desconto.
    const intro = req.nextUrl.searchParams.get('intro') === '1'
    return await buildAndRedirect(req, tier, true, billing, promo, intro)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[stripe/checkout GET] Unexpected error:', msg)
    const appUrl = req.nextUrl.origin
    return NextResponse.redirect(
      `${appUrl}/pricing?checkout_error=${encodeURIComponent('An unexpected error occurred. Please try again.')}`
    )
  }
}
