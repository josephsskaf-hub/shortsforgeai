// PAYPAL-2026-07-06 — direct PayPal REST integration (packs one-time +
// subscriptions). Why: Stripe BR accounts cannot enable PayPal (EEA/UK/CH
// only), and PayPal is the #2 payment preference for US buyers — the exact
// segment abandoning USD checkouts (see audit 06/07: rlee34445, kantomerboy).
// This file is self-contained; NOTHING in lib/stripe.ts or the Stripe routes
// is touched. USD-only on purpose (PayPal converts for the buyer).
//
// Env needed (Vercel): PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET
// Optional: PAYPAL_ENV=sandbox (defaults to live)
// Everything else (plan ids, webhook id) is auto-created by /api/paypal/setup
// and persisted in the paypal_config table — zero extra env vars.

import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export type PayPalTier = 'starter' | 'basic' | 'pro'
export type PayPalBilling = 'monthly' | 'annual'

export const PAYPAL_BASE =
  process.env.PAYPAL_ENV === 'sandbox'
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com'

// USD prices — MUST mirror TIER_PRICES/ANNUAL_PRICES in api/stripe/checkout.
export const PAYPAL_TIER_USD: Record<PayPalTier, { monthly: string; annual: string; name: string }> = {
  starter: { monthly: '9.90',  annual: '99.00',  name: 'Kineo — Starter' },
  basic:   { monthly: '19.90', annual: '199.00', name: 'Kineo — Creator' },
  pro:     { monthly: '37.90', annual: '379.00', name: 'Kineo — Studio' },
}

// Credits granted — MUST mirror the Stripe webhook.
// KINEO-STUDIO-400-2026-07-06 — pro aligned 600→400 (see pricing.ts + webhook).
export const PAYPAL_PLAN_CREDITS: Record<PayPalTier, number> = {
  starter: 50,
  basic: 240,
  pro: 400,
}

// KINEO-PACK-25-2026-07-06 — 25 Fast Shorts for $4.90 (was 10). ~$1 cost, ~80% margin.
export const PAYPAL_PACK = { credits: 25, usd: '4.90', name: 'Kineo — Starter Pack (25 Fast Shorts)' }

export function paypalAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
type Admin = ReturnType<typeof paypalAdminClient>

// ── OAuth ────────────────────────────────────────────────────────────────────
let cachedToken: { token: string; exp: number } | null = null

export async function paypalAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp - 60_000) return cachedToken.token
  const id = process.env.PAYPAL_CLIENT_ID
  const secret = process.env.PAYPAL_CLIENT_SECRET
  if (!id || !secret) throw new Error('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not set')
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`paypal oauth ${res.status}: ${await res.text()}`)
  const data = await res.json()
  cachedToken = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 }
  return cachedToken.token
}

export async function paypalFetch(path: string, init?: RequestInit & { idempotencyKey?: string }) {
  const token = await paypalAccessToken()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }
  if (init?.idempotencyKey) headers['PayPal-Request-Id'] = init.idempotencyKey
  const res = await fetch(`${PAYPAL_BASE}${path}`, { ...init, headers, cache: 'no-store' })
  const text = await res.text()
  let json: unknown = null
  try { json = text ? JSON.parse(text) : null } catch { /* non-JSON body */ }
  if (!res.ok) {
    throw new Error(`paypal ${init?.method ?? 'GET'} ${path} → ${res.status}: ${text.slice(0, 500)}`)
  }
  return json as Record<string, unknown> | null
}

// ── Config store (paypal_config: key text pk, value text) ───────────────────
export async function getPaypalConfig(admin: Admin, key: string): Promise<string | null> {
  const { data } = await admin.from('paypal_config').select('value').eq('key', key).maybeSingle()
  return (data?.value as string | undefined) ?? null
}

export async function setPaypalConfig(admin: Admin, key: string, value: string): Promise<void> {
  await admin.from('paypal_config').upsert({ key, value })
}

// ── Products & Plans (auto-created, ids persisted) ──────────────────────────
async function ensureProduct(admin: Admin, tier: PayPalTier): Promise<string> {
  const cfgKey = `product_${tier}`
  const existing = await getPaypalConfig(admin, cfgKey)
  if (existing) return existing
  const product = await paypalFetch('/v1/catalogs/products', {
    method: 'POST',
    idempotencyKey: `kineo-product-${tier}-v1`,
    body: JSON.stringify({
      name: PAYPAL_TIER_USD[tier].name,
      type: 'SERVICE',
      category: 'SOFTWARE',
      home_url: 'https://www.usekineo.com',
    }),
  })
  const id = String(product?.id)
  await setPaypalConfig(admin, cfgKey, id)
  return id
}

export async function ensurePlan(admin: Admin, tier: PayPalTier, billing: PayPalBilling): Promise<string> {
  const cfgKey = `plan_${tier}_${billing}`
  const existing = await getPaypalConfig(admin, cfgKey)
  if (existing) return existing
  const productId = await ensureProduct(admin, tier)
  const price = billing === 'annual' ? PAYPAL_TIER_USD[tier].annual : PAYPAL_TIER_USD[tier].monthly
  const plan = await paypalFetch('/v1/billing/plans', {
    method: 'POST',
    idempotencyKey: `kineo-plan-${tier}-${billing}-v1`,
    body: JSON.stringify({
      product_id: productId,
      name: `${PAYPAL_TIER_USD[tier].name} (${billing === 'annual' ? 'Annual' : 'Monthly'})`,
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: { interval_unit: billing === 'annual' ? 'YEAR' : 'MONTH', interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0, // infinite until cancelled
          pricing_scheme: { fixed_price: { value: price, currency_code: 'USD' } },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CANCEL',
        payment_failure_threshold: 2,
      },
    }),
  })
  const id = String(plan?.id)
  await setPaypalConfig(admin, cfgKey, id)
  return id
}

// Reverse lookup: PayPal plan id → { tier, billing } (used by the webhook).
export async function tierFromPlanId(admin: Admin, planId: string): Promise<{ tier: PayPalTier; billing: PayPalBilling } | null> {
  const { data } = await admin.from('paypal_config').select('key,value').like('key', 'plan_%')
  for (const row of data ?? []) {
    if (row.value === planId) {
      const [, tier, billing] = String(row.key).split('_')
      return { tier: tier as PayPalTier, billing: billing as PayPalBilling }
    }
  }
  return null
}

// ── Webhook signature verification ───────────────────────────────────────────
export async function verifyPaypalWebhook(
  admin: Admin,
  headers: Headers,
  rawBody: string
): Promise<boolean> {
  const webhookId = await getPaypalConfig(admin, 'webhook_id')
  if (!webhookId) {
    console.error('[paypal] webhook_id missing in paypal_config — run /api/paypal/setup')
    return false
  }
  try {
    const result = await paypalFetch('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      body: JSON.stringify({
        auth_algo: headers.get('paypal-auth-algo'),
        cert_url: headers.get('paypal-cert-url'),
        transmission_id: headers.get('paypal-transmission-id'),
        transmission_sig: headers.get('paypal-transmission-sig'),
        transmission_time: headers.get('paypal-transmission-time'),
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody),
      }),
    })
    return result?.verification_status === 'SUCCESS'
  } catch (err) {
    console.error('[paypal] webhook verification threw:', err)
    return false
  }
}

// ── Idempotency (paypal_events: id text pk) ─────────────────────────────────
// Returns true when this logical key was seen for the FIRST time.
export async function paypalClaimEvent(admin: Admin, id: string, type: string): Promise<boolean> {
  const { error } = await admin.from('paypal_events').insert({ id, type })
  if (!error) return true
  if (error.code === '23505') return false // duplicate — already processed
  // 42P01 = table missing; log and allow (better than dropping live payments)
  if (error.code !== '42P01') console.error('[paypal] claim event error:', error.code, error.message)
  return true
}

// ── Credit granting (mirrors the Stripe webhook paths) ──────────────────────
export async function grantPackCredits(admin: Admin, userId: string, credits: number): Promise<void> {
  const { data: profile } = await admin.from('profiles').select('video_credits').eq('id', userId).single()
  const next = (profile?.video_credits ?? 0) + credits
  const { error } = await admin.from('profiles').update({ video_credits: next }).eq('id', userId)
  if (error) console.error('[paypal] pack credit grant failed:', error.message, userId)
  else console.log(`[paypal] +${credits} credits (pack) → user ${userId} (now ${next})`)
}

export async function activateSubscription(
  admin: Admin,
  userId: string,
  tier: PayPalTier,
  subscriptionId: string
): Promise<void> {
  const credits = PAYPAL_PLAN_CREDITS[tier]
  const { data: profile } = await admin.from('profiles').select('video_credits').eq('id', userId).single()
  const next = (profile?.video_credits ?? 0) + credits
  const { error } = await admin
    .from('profiles')
    .update({
      is_pro: true,
      plan: tier,
      paypal_subscription_id: subscriptionId,
      video_credits: next,
      cinematic_tokens: tier === 'pro' ? 1 : 0,
    })
    .eq('id', userId)
  if (error) console.error('[paypal] subscription activate failed:', error.message, userId)
  else console.log(`[paypal] subscription ACTIVE: ${tier} (+${credits} credits) → user ${userId} (now ${next})`)
}

export async function renewSubscriptionCredits(admin: Admin, userId: string, tier: PayPalTier): Promise<void> {
  // Mirrors Stripe renewal semantics: balance RESETS to the plan allowance.
  const credits = PAYPAL_PLAN_CREDITS[tier]
  const { error } = await admin
    .from('profiles')
    .update({ video_credits: credits, cinematic_tokens: tier === 'pro' ? 1 : 0, is_pro: true, plan: tier })
    .eq('id', userId)
  if (error) console.error('[paypal] renewal grant failed:', error.message, userId)
  else console.log(`[paypal] renewal: ${tier} → user ${userId} (credits reset to ${credits})`)
}
