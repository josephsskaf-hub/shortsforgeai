// PAYPAL-2026-07-06 — GET redirect entry point, mirrors /api/stripe/checkout
// UX (no fetch/gesture breakage: plain 302 to PayPal approval page).
//   /api/paypal/checkout?pack=starter            → one-time $4.90 order
//   /api/paypal/checkout?tier=basic&billing=...  → subscription (monthly|annual)
// USD only — PayPal shows the buyer their own currency conversion.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  paypalAdminClient,
  paypalFetch,
  ensurePlan,
  PAYPAL_PACK,
  type PayPalTier,
  type PayPalBilling,
} from '@/lib/paypal'

export const dynamic = 'force-dynamic'

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.usekineo.com'
}

function redirectError(msg: string) {
  return NextResponse.redirect(`${appUrl()}/pricing?checkout_error=${encodeURIComponent(msg)}`)
}

export async function GET(req: NextRequest) {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return redirectError('PayPal is not configured yet. Please use card checkout.')
  }

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.redirect(`${appUrl()}/signup?redirect=${encodeURIComponent('/pricing')}`)
  }

  const params = req.nextUrl.searchParams
  const pack = params.get('pack')
  const tierParam = params.get('tier')
  const billing: PayPalBilling = params.get('billing') === 'annual' ? 'annual' : 'monthly'

  try {
    // ── One-time Starter Pack ────────────────────────────────────────────────
    if (pack === 'starter') {
      const order = await paypalFetch('/v2/checkout/orders', {
        method: 'POST',
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              custom_id: user.id,
              description: PAYPAL_PACK.name,
              amount: { currency_code: 'USD', value: PAYPAL_PACK.usd },
            },
          ],
          application_context: {
            brand_name: 'Kineo',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
            return_url: `${appUrl()}/api/paypal/return?flow=pack`,
            cancel_url: `${appUrl()}/checkout/cancelled`,
          },
        }),
      })
      const links = (order?.links ?? []) as Array<{ rel: string; href: string }>
      const approve = links.find((l) => l.rel === 'approve')?.href
      if (!approve) throw new Error('no approve link on order')
      return NextResponse.redirect(approve)
    }

    // ── Subscription ─────────────────────────────────────────────────────────
    const tier = (['starter', 'basic', 'pro'] as const).includes(tierParam as PayPalTier)
      ? (tierParam as PayPalTier)
      : null
    if (!tier) return redirectError('Invalid plan.')

    const admin = paypalAdminClient()
    const planId = await ensurePlan(admin, tier, billing)

    const sub = await paypalFetch('/v1/billing/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        plan_id: planId,
        custom_id: user.id,
        subscriber: user.email ? { email_address: user.email } : undefined,
        application_context: {
          brand_name: 'Kineo',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: `${appUrl()}/api/paypal/return?flow=sub&tier=${tier}&billing=${billing}`,
          cancel_url: `${appUrl()}/checkout/cancelled`,
        },
      }),
    })
    const links = (sub?.links ?? []) as Array<{ rel: string; href: string }>
    const approve = links.find((l) => l.rel === 'approve')?.href
    if (!approve) throw new Error('no approve link on subscription')
    return NextResponse.redirect(approve)
  } catch (err) {
    console.error('[paypal/checkout] failed:', err)
    return redirectError('PayPal checkout failed. Please try card checkout or contact support.')
  }
}

// Kept for parity with the Stripe route pattern (POST from modals).
export async function POST(req: NextRequest) {
  return GET(req)
}

// PayPal quote for the pricing page display: USD $${PAYPAL_TIER_USD.starter.monthly} etc.
