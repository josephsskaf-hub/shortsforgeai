// Mercado Pago webhook — receives payment notifications, verifies the payment
// is approved, and grants the credits (idempotent). Mirrors the Stripe webhook's
// crediting, for the Brazilian Pix/card packs.
//
// MP sends notifications in a few shapes:
//   query: ?type=payment&data.id=123   OR   ?topic=payment&id=123
//   body:  { type:'payment', data:{ id:'123' } }  OR  { action, data:{ id } }
// We always return 200 so MP stops retrying once handled.
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getMpPayment, MP_PACKS } from '@/lib/mercadopago'

export const dynamic = 'force-dynamic'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service env missing')
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function extractPaymentId(req: NextRequest): Promise<string | null> {
  const sp = req.nextUrl.searchParams
  const qId = sp.get('data.id') ?? sp.get('id')
  const topic = sp.get('type') ?? sp.get('topic')
  if (qId && (topic === 'payment' || !topic)) return qId
  try {
    const body = await req.json() as { type?: string; action?: string; data?: { id?: string | number } }
    const isPayment = body?.type === 'payment' || (body?.action ?? '').startsWith('payment')
    const id = body?.data?.id
    if (isPayment && id != null) return String(id)
  } catch { /* no body or invalid JSON — fall through */ }
  return qId ?? null
}

export async function POST(req: NextRequest) {
  try {
    const paymentId = await extractPaymentId(req)
    if (!paymentId) return NextResponse.json({ received: true })

    const payment = await getMpPayment(paymentId)
    if (!payment || payment.status !== 'approved') {
      // pending/rejected/unknown → nothing to grant (return 200 so MP stops).
      return NextResponse.json({ received: true })
    }

    // external_reference = `${userId}:${pack}` → resolve credits server-side.
    const ref = payment.externalReference ?? ''
    const sep = ref.lastIndexOf(':')
    const userId = sep > 0 ? ref.slice(0, sep) : ''
    const packId = sep > 0 ? ref.slice(sep + 1) : ''
    const pack = MP_PACKS[packId as keyof typeof MP_PACKS]
    if (!userId || !pack) {
      console.error('[mercadopago/webhook] bad external_reference:', ref)
      return NextResponse.json({ received: true })
    }

    const db = admin()

    // Idempotency — insert first; if the payment id already exists, we already
    // granted these credits, so do nothing.
    const { error: insErr } = await db
      .from('mp_payments')
      .insert({ payment_id: paymentId, user_id: userId, pack: packId, credits: pack.credits, amount_brl: pack.brl })
    if (insErr) {
      // 23505 = unique_violation → already processed. Any other error: log + stop.
      if ((insErr as { code?: string }).code !== '23505') {
        console.error('[mercadopago/webhook] mp_payments insert error:', insErr.message)
      }
      return NextResponse.json({ received: true })
    }

    // New payment → grant the credits atomically.
    const { error: rpcErr } = await db.rpc('add_video_credits', { p_user: userId, p_amount: pack.credits })
    if (rpcErr) {
      console.error('[mercadopago/webhook] add_video_credits failed:', rpcErr.message)
    } else {
      console.log(`[mercadopago/webhook] granted ${pack.credits} credits to ${userId.slice(0, 8)} (payment ${paymentId})`)
    }
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[mercadopago/webhook] unexpected:', err instanceof Error ? err.message : String(err))
    // Still 200 — a 500 makes MP retry forever; we log and move on.
    return NextResponse.json({ received: true })
  }
}

// MP sometimes probes the endpoint with GET — respond OK.
export async function GET() {
  return NextResponse.json({ ok: true })
}
