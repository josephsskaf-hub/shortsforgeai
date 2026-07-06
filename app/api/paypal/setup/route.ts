// PAYPAL-2026-07-06 — one-shot setup, admin-gated by CRON_SECRET.
// Run once in the browser after PAYPAL_CLIENT_ID/SECRET are set on Vercel:
//   https://www.usekineo.com/api/paypal/setup?key=<CRON_SECRET>
// Creates (idempotently): 3 products, 6 plans (monthly+annual), 1 webhook —
// and persists every id in paypal_config. Re-running is safe (no duplicates).

import { NextRequest, NextResponse } from 'next/server'
import {
  paypalAdminClient,
  paypalFetch,
  ensurePlan,
  getPaypalConfig,
  setPaypalConfig,
} from '@/lib/paypal'

export const dynamic = 'force-dynamic'
// KINEO-PAYPAL-MAXDUR-2026-07-06 — the setup makes ~10 sequential PayPal API
// calls; give it room so it finishes in one shot instead of timing out midway.
export const maxDuration = 60

const WEBHOOK_EVENTS = [
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.SALE.COMPLETED',
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.EXPIRED',
]

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return NextResponse.json(
      { error: 'PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not set on Vercel yet' },
      { status: 500 }
    )
  }

  const admin = paypalAdminClient()
  // KINEO-PAYPAL-FIRSTRUN-2026-07-06 — the ONE-TIME initial setup may run WITHOUT
  // a key while no webhook is configured yet, so it can be triggered right after
  // deploy. Once the webhook exists, subsequent runs require CRON_SECRET. First-run
  // only creates OUR own PayPal products/plans/webhook and is fully idempotent.
  const existingWebhook = await getPaypalConfig(admin, 'webhook_id')
  const keyOk = !!process.env.CRON_SECRET && key === process.env.CRON_SECRET
  if (existingWebhook && !keyOk) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.usekineo.com'
  const summary: Record<string, string> = {}

  try {
    // 1) Webhook FIRST — the critical piece (it credits users after a payment).
    // Created before plans so a plan hiccup can never block it. Idempotent.
    let webhookId = await getPaypalConfig(admin, 'webhook_id')
    if (!webhookId) {
      const webhookUrl = `${appUrl}/api/paypal/webhook`
      const list = await paypalFetch('/v1/notifications/webhooks')
      const found = ((list?.webhooks ?? []) as Array<Record<string, unknown>>).find(
        (w) => w.url === webhookUrl
      )
      if (found) {
        webhookId = String(found.id)
      } else {
        const created = await paypalFetch('/v1/notifications/webhooks', {
          method: 'POST',
          body: JSON.stringify({
            url: webhookUrl,
            event_types: WEBHOOK_EVENTS.map((name) => ({ name })),
          }),
        })
        webhookId = String(created?.id)
      }
      await setPaypalConfig(admin, 'webhook_id', webhookId)
    }
    summary.webhook_id = webhookId

    // 2) Plans — RESILIENT: each in its own try so one failing plan never blocks
    // the others or the webhook. Products are auto-created inside ensurePlan.
    for (const tier of ['starter', 'basic', 'pro'] as const) {
      for (const billing of ['monthly', 'annual'] as const) {
        try {
          summary[`plan_${tier}_${billing}`] = await ensurePlan(admin, tier, billing)
        } catch (e) {
          summary[`plan_${tier}_${billing}`] = 'ERR: ' + String((e as Error)?.message ?? e).slice(0, 140)
        }
      }
    }

    return NextResponse.json({
      ok: true,
      env: process.env.PAYPAL_ENV === 'sandbox' ? 'sandbox' : 'live',
      ...summary,
      next: 'PayPal is live. Test: /api/paypal/checkout?pack=starter (logged in).',
    })
  } catch (err) {
    console.error('[paypal/setup] failed:', err)
    return NextResponse.json({ error: String(err).slice(0, 600), ...summary }, { status: 500 })
  }
}
