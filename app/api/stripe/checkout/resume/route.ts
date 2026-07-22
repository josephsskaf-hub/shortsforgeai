import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const SESSION_COOKIE = 'kineo_checkout_session'
const DISMISSED_COOKIE = 'kineo_checkout_resume_dismissed'
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
const DISMISS_MAX_AGE_SECONDS = 7 * 24 * 60 * 60
const SESSION_ID_PATTERN = /^cs_(?:test_|live_)?[A-Za-z0-9]{10,200}$/
const TERMINAL_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  'canceled',
  'incomplete_expired',
])
const PAID_PLANS = new Set([
  'starter', 'starter_trial',
  'basic', 'basic_trial',
  'pro', 'pro_trial',
  'creator', 'creator_trial',
  'studio', 'studio_trial',
])

type Tier = 'starter' | 'basic' | 'pro'
type Billing = 'monthly' | 'annual'
type DestinationKind = 'open_session' | 'stripe_recovery' | 'internal_retry'

type ResumeResolution = {
  session: Stripe.Checkout.Session
  destination: string
  destinationKind: DestinationKind
  planName: string
  tier: Tier
  billing: Billing
  currency: string
  firstChargeAmount: number
  renewalAmount: number
}

function noStore<T extends NextResponse>(response: T): T {
  response.headers.set('Cache-Control', 'private, no-store, no-cache, max-age=0')
  response.headers.set('Pragma', 'no-cache')
  return response
}

function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

function clearDismissedCookie(response: NextResponse): void {
  response.cookies.set({
    name: DISMISSED_COOKIE,
    value: '',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

function unavailableResponse(
  req: NextRequest,
  go: boolean,
  reason: string,
  options: { clearSession?: boolean; clearDismissed?: boolean; status?: number } = {},
): NextResponse {
  const response = go
    ? NextResponse.redirect(new URL('/pricing', req.url))
    : NextResponse.json({ available: false, reason }, { status: options.status ?? 200 })
  if (options.clearSession) clearSessionCookie(response)
  if (options.clearDismissed) clearDismissedCookie(response)
  return noStore(response)
}

function readSessionId(value: unknown): string | null {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value) ? value : null
}

function customerIdOf(session: Stripe.Checkout.Session): string | null {
  if (typeof session.customer === 'string') return session.customer
  return session.customer?.id ?? null
}

function tierOf(session: Stripe.Checkout.Session): Tier | null {
  const tier = session.metadata?.tier
  return tier === 'starter' || tier === 'basic' || tier === 'pro' ? tier : null
}

function billingOf(session: Stripe.Checkout.Session): Billing {
  return session.metadata?.billing === 'annual' ? 'annual' : 'monthly'
}

function planName(tier: Tier): string {
  if (tier === 'starter') return 'Starter'
  if (tier === 'pro') return 'Studio'
  return 'Creator'
}

function hasContinuingDiscount(session: Stripe.Checkout.Session): boolean {
  const discounts = session.total_details?.breakdown?.discounts ?? []
  return discounts.some(({ discount }) => {
    if ('deleted' in discount && discount.deleted) return false
    const coupon = discount.coupon
    if ('deleted' in coupon && coupon.deleted) return false
    if (coupon.duration === 'forever') return true
    return coupon.duration === 'repeating' && (coupon.duration_in_months ?? 0) > 1
  })
}

function offerAmounts(session: Stripe.Checkout.Session): {
  currency: string
  firstChargeAmount: number
  renewalAmount: number
} | null {
  const currency = (session.currency ?? '').toLowerCase()
  const firstChargeAmount = session.amount_total
  const fullRecurringAmount = session.amount_subtotal
  if (
    !/^[a-z]{3}$/.test(currency) ||
    typeof firstChargeAmount !== 'number' ||
    firstChargeAmount < 0 ||
    typeof fullRecurringAmount !== 'number' ||
    fullRecurringAmount < 0
  ) {
    return null
  }

  return {
    currency,
    firstChargeAmount,
    // Intro and KINEO5 are one-invoice discounts, so the next invoice returns
    // to amount_subtotal. A forever/repeating coupon keeps the first total for
    // the next renewal instead.
    renewalAmount: hasContinuingDiscount(session) ? firstChargeAmount : fullRecurringAmount,
  }
}

function promotionCodeFromCancelUrl(session: Stripe.Checkout.Session): string | null {
  if (!session.cancel_url) return null
  try {
    const url = new URL(session.cancel_url)
    if (url.pathname !== '/checkout/cancelled') return null
    const promo = (url.searchParams.get('promo') ?? '').trim()
    return /^[A-Za-z0-9_-]{1,64}$/.test(promo) ? promo : null
  } catch {
    return null
  }
}

function internalRetryUrl(req: NextRequest, session: Stripe.Checkout.Session): string | null {
  const tier = tierOf(session)
  if (!tier) return null
  const billing = billingOf(session)
  const promo = promotionCodeFromCancelUrl(session)
  const privateOffer = session.metadata?.offer === 'kineo5_pack_upgrade'

  // A private $5 promise may only be retried with the exact private code. The
  // normal checkout route validates its customer, expiry and exact first price.
  // If an older Session did not retain the code, hide recovery rather than ever
  // substituting a full-price Creator checkout.
  if (privateOffer && (!promo || !promo.toUpperCase().startsWith('KINEO5-'))) {
    return null
  }

  const params = new URLSearchParams({ tier, billing })
  params.set('recovery', '1')
  if (session.metadata?.intro === '1') params.set('intro', '1')
  if (promo) params.set('promo', promo)
  if (session.metadata?.checkout_origin === 'post_video_clean_export') {
    params.set('return', 'wm')
  }
  return new URL(`/api/stripe/checkout?${params.toString()}`, req.url).toString()
}

async function latestAbandonedSessionId(userId: string): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null

  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await admin
    .from('checkout_abandoned')
    .select('stripe_session_id')
    .eq('user_id', userId)
    .not('tier', 'is', null)
    .order('expired_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (error.code !== '42P01') {
      console.warn('[stripe/checkout/resume] abandoned lookup unavailable:', error.code)
    }
    return null
  }
  return readSessionId(data?.stripe_session_id)
}

function isMissingStripeResource(error: unknown): boolean {
  const stripeError = error as { code?: string; type?: string; statusCode?: number } | null
  return stripeError?.code === 'resource_missing' ||
    (stripeError?.type === 'StripeInvalidRequestError' && stripeError?.statusCode === 404)
}

async function retrieveOwnedSubscriptionSession(
  sessionId: string,
  userId: string,
): Promise<Stripe.Checkout.Session | null> {
  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['total_details.breakdown'],
    })
  } catch (error) {
    if (!isMissingStripeResource(error)) {
      console.warn('[stripe/checkout/resume] Stripe Session lookup failed')
    }
    return null
  }

  if (session.mode !== 'subscription') return null
  if (session.metadata?.supabase_user_id !== userId) return null
  return session
}

async function hasBlockingStripeSubscription(
  session: Stripe.Checkout.Session,
  profileCustomerId: string | null,
  userId: string,
): Promise<boolean> {
  const sessionCustomerId = customerIdOf(session)
  const customerIds = Array.from(new Set(
    [sessionCustomerId, profileCustomerId].filter((id): id is string => Boolean(id)),
  ))

  for (const customerId of customerIds) {
    try {
      const customer = await stripe.customers.retrieve(customerId)
      if ('deleted' in customer && customer.deleted) continue
      if (customer.metadata?.supabase_user_id !== userId) return true

      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 100,
      })
      if (subscriptions.data.some((subscription) => {
        const owner = subscription.metadata?.supabase_user_id
        return owner !== userId || !TERMINAL_SUBSCRIPTION_STATUSES.has(subscription.status)
      })) {
        return true
      }
    } catch {
      // Recovery is optional. Fail closed when current billing state cannot be
      // verified, rather than risk opening a second recurring subscription.
      return true
    }
  }
  return false
}

async function resolveCandidate(
  req: NextRequest,
  sessionId: string,
  userId: string,
  profileCustomerId: string | null,
): Promise<ResumeResolution | null> {
  const session = await retrieveOwnedSubscriptionSession(sessionId, userId)
  if (!session || session.status === 'complete') return null

  // Both the first display request and the click-through request audit all
  // known Customers. That closes the common duplicate-subscription race where
  // another tab completed Checkout before the profile webhook arrived.
  if (await hasBlockingStripeSubscription(session, profileCustomerId, userId)) return null

  const tier = tierOf(session)
  const amounts = offerAmounts(session)
  if (!tier || !amounts) return null

  let destination: string | null = null
  let destinationKind: DestinationKind | null = null
  if (session.status === 'open' && session.url) {
    destination = session.url
    destinationKind = 'open_session'
  } else if (session.status === 'expired') {
    const recovery = session.after_expiration?.recovery
    const now = Math.floor(Date.now() / 1000)
    const requiresCurrentServerValidation =
      session.metadata?.intro === '1' ||
      session.metadata?.offer === 'kineo5_pack_upgrade' ||
      Boolean(promotionCodeFromCancelUrl(session))
    if (
      !requiresCurrentServerValidation &&
      recovery?.enabled &&
      recovery.url &&
      (!recovery.expires_at || recovery.expires_at > now)
    ) {
      destination = recovery.url
      destinationKind = 'stripe_recovery'
    } else if (now - session.expires_at <= SESSION_MAX_AGE_SECONDS) {
      destination = internalRetryUrl(req, session)
      destinationKind = destination ? 'internal_retry' : null
    }
  }

  if (!destination || !destinationKind) return null
  return {
    session,
    destination,
    destinationKind,
    planName: planName(tier),
    tier,
    billing: billingOf(session),
    ...amounts,
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const go = req.nextUrl.searchParams.get('go') === '1'

  if (!process.env.STRIPE_SECRET_KEY) {
    return unavailableResponse(req, go, 'billing_unavailable', { status: go ? undefined : 503 })
  }

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    if (go) {
      const redirect = encodeURIComponent('/api/stripe/checkout/resume?go=1')
      return noStore(NextResponse.redirect(new URL(`/login?reason=checkout&redirect=${redirect}`, req.url)))
    }
    return unavailableResponse(req, false, 'signed_out', { status: 401 })
  }

  if (req.cookies.get(DISMISSED_COOKIE)?.value === '1') {
    return unavailableResponse(req, go, 'dismissed')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_pro, plan, stripe_customer_id, stripe_subscription_id, paypal_subscription_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return unavailableResponse(req, go, 'profile_unavailable')
  }

  const normalizedPlan = String(profile.plan ?? '').trim().toLowerCase()
  if (
    profile.is_pro === true ||
    PAID_PLANS.has(normalizedPlan) ||
    Boolean(profile.paypal_subscription_id)
  ) {
    return unavailableResponse(req, go, 'already_subscribed', {
      clearSession: true,
      clearDismissed: true,
    })
  }

  if (profile.stripe_subscription_id) {
    try {
      const subscription = await stripe.subscriptions.retrieve(String(profile.stripe_subscription_id))
      if (!TERMINAL_SUBSCRIPTION_STATUSES.has(subscription.status)) {
        return unavailableResponse(req, go, 'already_subscribed', {
          clearSession: true,
          clearDismissed: true,
        })
      }
    } catch (error) {
      if (!isMissingStripeResource(error)) {
        return unavailableResponse(req, go, 'billing_state_unavailable')
      }
    }
  }

  const cookieValue = req.cookies.get(SESSION_COOKIE)?.value
  const cookieSessionId = readSessionId(cookieValue)
  const hadInvalidCookie = Boolean(cookieValue && !cookieSessionId)
  const latestAbandonedId = cookieSessionId ? null : await latestAbandonedSessionId(user.id)
  const sessionId = cookieSessionId ?? latestAbandonedId
  if (!sessionId) {
    return unavailableResponse(req, go, 'none', { clearSession: hadInvalidCookie })
  }

  let resolution = await resolveCandidate(
    req,
    sessionId,
    user.id,
    typeof profile.stripe_customer_id === 'string' ? profile.stripe_customer_id : null,
  )

  // A stale but syntactically valid cookie must not hide a newer abandoned
  // checkout recorded by the webhook. Try that owned fallback in this same
  // request so the banner does not require another navigation to appear.
  if (!resolution && cookieSessionId) {
    const fallbackSessionId = await latestAbandonedSessionId(user.id)
    if (fallbackSessionId && fallbackSessionId !== cookieSessionId) {
      resolution = await resolveCandidate(
        req,
        fallbackSessionId,
        user.id,
        typeof profile.stripe_customer_id === 'string' ? profile.stripe_customer_id : null,
      )
    }
  }

  if (!resolution) {
    return unavailableResponse(req, go, 'stale', { clearSession: true })
  }

  if (go) return noStore(NextResponse.redirect(resolution.destination))

  return noStore(NextResponse.json({
    available: true,
    resumeUrl: '/api/stripe/checkout/resume?go=1',
    destinationKind: resolution.destinationKind,
    planName: resolution.planName,
    tier: resolution.tier,
    billing: resolution.billing,
    currency: resolution.currency,
    firstChargeAmount: resolution.firstChargeAmount,
    renewalAmount: resolution.renewalAmount,
  }))
}

export async function POST(): Promise<NextResponse> {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return noStore(NextResponse.json({ ok: false }, { status: 401 }))
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: DISMISSED_COOKIE,
    value: '1',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: DISMISS_MAX_AGE_SECONDS,
  })
  return noStore(response)
}
