// Hotmart webhook — grants credits when a Hotmart purchase is approved.
// Auth: X-HOTMART-HOTTOK header (static token, constant-time compared). Buyer is
// matched to a ShortsForgeAI account by email; credits granted idempotently
// (keyed on the Hotmart transaction id). Always returns 200 so Hotmart stops
// retrying once handled. Mirrors the Mercado Pago webhook's crediting.
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  creditsForBRL,
  verifyHottok,
  HOTMART_APPROVED_EVENTS,
  HOTMART_REVERSED_EVENTS,
  type HotmartEvent,
} from '@/lib/hotmart'

export const dynamic = 'force-dynamic'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service env missing')
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function POST(req: NextRequest) {
  try {
    // 1) Authenticate the caller — Hotmart's static hottok in the header.
    if (!verifyHottok(req.headers.get('x-hotmart-hottok'))) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    let body: HotmartEvent
    try {
      body = (await req.json()) as HotmartEvent
    } catch {
      return NextResponse.json({ received: true })
    }

    const event = (body.event ?? '').toUpperCase()
    const purchase = body.data?.purchase
    const transaction = (purchase?.transaction ?? '').trim()
    const email = (body.data?.buyer?.email ?? '').trim().toLowerCase()

    // Reversals: log for manual handling (refunds are rare at this volume).
    if (HOTMART_REVERSED_EVENTS.has(event)) {
      console.log(`[hotmart/webhook] reversal ${event} tx=${transaction} email=${email}`)
      return NextResponse.json({ received: true })
    }

    if (!HOTMART_APPROVED_EVENTS.has(event) || !transaction) {
      return NextResponse.json({ received: true })
    }

    const credits = creditsForBRL(purchase?.price?.value)
    if (credits <= 0) {
      console.error(`[hotmart/webhook] zero credits for tx=${transaction} value=${purchase?.price?.value}`)
      return NextResponse.json({ received: true })
    }

    const db = admin()

    // Match the buyer to an existing account by email (may be null if they
    // haven't signed up yet — we still record the payment so it can be
    // reconciled when they create an account with the same email).
    let userId: string | null = null
    if (email) {
      const { data: prof } = await db.from('profiles').select('id').eq('email', email).maybeSingle()
      userId = (prof as { id?: string } | null)?.id ?? null
    }

    // Idempotency — insert first (transaction is the PK). If it already exists,
    // we've handled this purchase, so do nothing.
    const { error: insErr } = await db.from('hotmart_payments').insert({
      transaction,
      user_id: userId,
      email,
      credits,
      amount_brl: purchase?.price?.value ?? null,
      event,
    })
    if (insErr) {
      if ((insErr as { code?: string }).code !== '23505') {
        console.error('[hotmart/webhook] hotmart_payments insert error:', insErr.message)
      }
      return NextResponse.json({ received: true })
    }

    if (!userId) {
      // Paid, but no account yet — recorded for reconciliation on signup.
      console.log(`[hotmart/webhook] no account for ${email}; recorded tx=${transaction} (${credits} cr pending)`)
      return NextResponse.json({ received: true })
    }

    const { error: rpcErr } = await db.rpc('add_video_credits', { p_user: userId, p_amount: credits })
    if (rpcErr) {
      console.error('[hotmart/webhook] add_video_credits failed:', rpcErr.message)
    } else {
      console.log(`[hotmart/webhook] granted ${credits} credits to ${userId.slice(0, 8)} (tx ${transaction})`)
    }
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[hotmart/webhook] unexpected:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ received: true })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true })
}
