// PAYPAL-2026-07-06 — webhook backup/renewal path. Signature-verified against
// webhook_id stored in paypal_config (created by /api/paypal/setup).
// Handled events:
//   PAYMENT.CAPTURE.COMPLETED        → pack credits (if return route missed it)
//   BILLING.SUBSCRIPTION.ACTIVATED   → plan activation (backup)
//   PAYMENT.SALE.COMPLETED           → recurring renewals (credits reset)
//   BILLING.SUBSCRIPTION.CANCELLED / SUSPENDED / EXPIRED → downgrade to free
// All grants idempotent via paypal_events claims shared with /api/paypal/return.

import { NextRequest, NextResponse } from 'next/server'
import {
  paypalAdminClient,
  paypalFetch,
  verifyPaypalWebhook,
  paypalClaimEvent,
  grantPackCredits,
  activateSubscription,
  renewSubscriptionCredits,
  tierFromPlanId,
  PAYPAL_PACK,
  type PayPalTier,
} from '@/lib/paypal'

export const dynamic = 'force-dynamic'

// Mirrors the Stripe webhook's PROTECTED_EMAILS behavior for plan-changing events.
const PROTECTED_EMAILS = new Set([
  'josephsskaf@gmail.com',
  'josephskaf@gmail.com',
  'josephskaf@hotmail.com',
  'joseph-test@shortsforgeai.com',
])

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const admin = paypalAdminClient()

  const valid = await verifyPaypalWebhook(admin, req.headers, rawBody)
  if (!valid) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  let event: Record<string, unknown>
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const eventId = String(event.id ?? '')
  const eventType = String(event.event_type ?? '')
  const resource = (event.resource ?? {}) as Record<string, unknown>

  // Event-level dedupe (PayPal retries on non-2xx / slow responses).
  if (eventId && !(await paypalClaimEvent(admin, `evt:${eventId}`, eventType))) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  try {
    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        // One-time pack capture. supplementary_data carries the order id.
        const captureId = String(resource.id ?? '')
        const userId = String(resource.custom_id ?? '')
        const orderId = String(
          ((resource.supplementary_data as Record<string, unknown> | undefined)?.related_ids as
            | Record<string, unknown>
            | undefined)?.order_id ?? ''
        )
        const amount = (resource.amount ?? {}) as { value?: string }
        if (!userId) break
        // Ignore subscription charges here (those come as PAYMENT.SALE.COMPLETED).
        if (amount.value !== PAYPAL_PACK.usd) break
        const claimKey = orderId ? `order:${orderId}` : `capture:${captureId}`
        if (await paypalClaimEvent(admin, claimKey, 'pack_capture')) {
          await grantPackCredits(admin, userId, PAYPAL_PACK.credits)
        }
        break
      }

      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        const subId = String(resource.id ?? '')
        const userId = String(resource.custom_id ?? '')
        const planId = String(resource.plan_id ?? '')
        if (!subId || !userId) break
        const mapped = await tierFromPlanId(admin, planId)
        const tier: PayPalTier = mapped?.tier ?? 'basic'
        if (await paypalClaimEvent(admin, `subact:${subId}`, 'sub_activate')) {
          await activateSubscription(admin, userId, tier, subId)
        }
        break
      }

      case 'PAYMENT.SALE.COMPLETED': {
        // Subscription charge. First sale = activation charge (already credited
        // by subact). Later sales = renewals → reset credits to plan allowance.
        const saleId = String(resource.id ?? '')
        const subId = String(resource.billing_agreement_id ?? '')
        if (!saleId || !subId) break
        if (!(await paypalClaimEvent(admin, `sale:${subId}:${saleId}`, 'sub_sale'))) break

        const { count } = await admin
          .from('paypal_events')
          .select('id', { count: 'exact', head: true })
          .like('id', `sale:${subId}:%`)
        const isFirstSale = (count ?? 1) <= 1
        if (isFirstSale) break // activation grant already handled

        const sub = await paypalFetch(`/v1/billing/subscriptions/${subId}`)
        const userId = String(sub?.custom_id ?? '')
        const planId = String(sub?.plan_id ?? '')
        if (!userId) break
        const { data: prof } = await admin.from('profiles').select('email').eq('id', userId).single()
        if (PROTECTED_EMAILS.has(String(prof?.email ?? '').toLowerCase())) break
        const mapped = await tierFromPlanId(admin, planId)
        await renewSubscriptionCredits(admin, userId, mapped?.tier ?? 'basic')
        break
      }

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
      case 'BILLING.SUBSCRIPTION.EXPIRED': {
        const subId = String(resource.id ?? '')
        if (!subId) break
        const { data: prof } = await admin
          .from('profiles')
          .select('id,email')
          .eq('paypal_subscription_id', subId)
          .maybeSingle()
        if (!prof?.id) break
        if (PROTECTED_EMAILS.has(String(prof.email ?? '').toLowerCase())) break
        const { error } = await admin
          .from('profiles')
          .update({ is_pro: false, plan: 'free', paypal_subscription_id: null })
          .eq('id', prof.id)
        if (error) console.error('[paypal webhook] downgrade failed:', error.message)
        else console.log(`[paypal webhook] ${eventType} → user ${prof.id} downgraded to free`)
        break
      }

      default:
        // Unhandled event types are fine — we subscribed narrowly in setup.
        break
    }
  } catch (err) {
    console.error('[paypal webhook] handler error:', eventType, err)
    // Return 200 anyway: grants are idempotent and PayPal hammer-retries 5xx.
  }

  return NextResponse.json({ received: true })
}
