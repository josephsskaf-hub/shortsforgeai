// PAYPAL-2026-07-06 — buyer lands here after approving on paypal.com.
//   ?flow=pack&token=ORDER_ID           → capture + credit 10 Fast Shorts
//   ?flow=sub&subscription_id=I-XXX&tier=&billing= → verify + activate plan
// Crediting is idempotent (paypal_events claim) — the webhook is the backup
// path for the same grants, whichever arrives first wins, the other no-ops.

import { NextRequest, NextResponse } from 'next/server'
import {
  paypalAdminClient,
  paypalFetch,
  paypalClaimEvent,
  grantPackCredits,
  activateSubscription,
  PAYPAL_PACK,
  PAYPAL_TIER_USD,
  type PayPalTier,
} from '@/lib/paypal'

export const dynamic = 'force-dynamic'

function appUrl() {
  return 'https://www.usekineo.com'
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const flow = params.get('flow')
  const admin = paypalAdminClient()

  try {
    // ── One-time pack: capture the approved order ────────────────────────────
    if (flow === 'pack') {
      const orderId = params.get('token')
      if (!orderId) throw new Error('missing order token')

      let capture: Record<string, unknown> | null = null
      try {
        capture = await paypalFetch(`/v2/checkout/orders/${orderId}/capture`, {
          method: 'POST',
          idempotencyKey: `capture-${orderId}`,
          body: JSON.stringify({}),
        })
      } catch (err) {
        // ORDER_ALREADY_CAPTURED → double return-visit; fetch instead.
        const msg = String(err)
        if (!msg.includes('ORDER_ALREADY_CAPTURED')) throw err
        capture = await paypalFetch(`/v2/checkout/orders/${orderId}`)
      }

      const status = String(capture?.status ?? '')
      if (status !== 'COMPLETED') throw new Error(`order not completed: ${status}`)

      const pu = ((capture?.purchase_units ?? []) as Array<Record<string, unknown>>)[0] ?? {}
      const userId = String(pu.custom_id ?? ((pu.payments as Record<string, unknown> | undefined)?.captures as Array<Record<string, unknown>> | undefined)?.[0]?.custom_id ?? '')
      if (!userId) throw new Error('order missing custom_id')

      if (await paypalClaimEvent(admin, `order:${orderId}`, 'pack_capture')) {
        await grantPackCredits(admin, userId, PAYPAL_PACK.credits)
      }
      return NextResponse.redirect(
        `${appUrl()}/checkout/success?success=true&pack=starter&currency=usd&amount=490&via=paypal`
      )
    }

    // ── Subscription: verify with PayPal, then activate ──────────────────────
    if (flow === 'sub') {
      const subId = params.get('subscription_id')
      const tier = (params.get('tier') ?? 'basic') as PayPalTier
      const billing = params.get('billing') === 'annual' ? 'annual' : 'monthly'
      if (!subId) throw new Error('missing subscription_id')

      const sub = await paypalFetch(`/v1/billing/subscriptions/${subId}`)
      const status = String(sub?.status ?? '')
      const userId = String(sub?.custom_id ?? '')
      if (!userId) throw new Error('subscription missing custom_id')
      // APPROVED = buyer approved, activation still settling; ACTIVE = done.
      if (status !== 'ACTIVE' && status !== 'APPROVED') {
        throw new Error(`subscription not active: ${status}`)
      }

      if (await paypalClaimEvent(admin, `subact:${subId}`, 'sub_activate')) {
        await activateSubscription(admin, userId, tier, subId)
      }
      const cents = Math.round(
        parseFloat(billing === 'annual' ? PAYPAL_TIER_USD[tier].annual : PAYPAL_TIER_USD[tier].monthly) * 100
      )
      return NextResponse.redirect(
        `${appUrl()}/checkout/success?success=true&currency=usd&amount=${cents}&via=paypal`
      )
    }

    throw new Error(`unknown flow: ${flow}`)
  } catch (err) {
    console.error('[paypal/return] failed:', err)
    return NextResponse.redirect(
      `${appUrl()}/pricing?checkout_error=${encodeURIComponent(
        'PayPal payment could not be confirmed. If you were charged, contact support@usekineo.com — we will fix it fast.'
      )}`
    )
  }
}
