import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  tierForPrice,
  creditsForTier,
  cinematicTokensForTier,
  verifyPaddleSignature,
} from '@/lib/paddle'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(req: NextRequest) {
  const raw = await req.text()
  const sig = req.headers.get('paddle-signature')
  const secret = process.env.PADDLE_WEBHOOK_SECRET ?? ''

  if (!verifyPaddleSignature(raw, sig, secret)) {
    console.error('[paddle webhook] invalid or missing signature')
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let evt: any
  try {
    evt = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const eventId: string = evt?.event_id ?? evt?.notification_id ?? ''
  const eventType: string = evt?.event_type ?? ''
  const supabase = admin()

  // Idempotency — Paddle retries on non-2xx. Dedupe on event_id.
  if (eventId) {
    const { error: dErr } = await supabase
      .from('paddle_events')
      .insert({ id: eventId, event_type: eventType })
    if (dErr) {
      const code = (dErr as { code?: string }).code
      if (code === '23505') return NextResponse.json({ received: true, duplicate: true })
      if (code !== '42P01') console.error('[paddle webhook] dedupe error:', code, dErr.message)
    }
  }

  try {
    const data = evt?.data ?? {}
    const userId: string | undefined = data?.custom_data?.user_id
    const customerId: string | undefined = data?.customer_id
    const subscriptionId: string | undefined = data?.id // subscription.* -> data.id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = Array.isArray(data?.items) ? data.items : []
    const priceId: string | undefined = items[0]?.price?.id ?? items[0]?.price_id
    const tier = tierForPrice(priceId)

    if (eventType === 'subscription.created' || eventType === 'subscription.updated') {
      const status: string | undefined = data?.status
      const isActive = status === 'active' || status === 'trialing'
      if (userId && tier && isActive) {
        await supabase
          .from('profiles')
          .update({
            is_pro: true,
            plan: tier,
            video_credits: creditsForTier(tier),
            cinematic_tokens: cinematicTokensForTier(tier),
            paddle_customer_id: customerId ?? null,
            paddle_subscription_id: subscriptionId ?? null,
            billing_provider: 'paddle',
          })
          .eq('id', userId)
        console.log(`[paddle webhook] ${eventType} ${tier} active -> user ${userId} (+${creditsForTier(tier)} credits)`)
      } else if (userId && !isActive) {
        await supabase
          .from('profiles')
          .update({ is_pro: false, plan: 'free', cinematic_tokens: 0 })
          .eq('id', userId)
        console.log(`[paddle webhook] ${eventType} status=${status} -> revoked user ${userId}`)
      } else {
        console.warn('[paddle webhook] sub event missing user_id/tier', { hasUser: !!userId, tier, priceId })
      }
    } else if (eventType === 'subscription.canceled') {
      if (userId) {
        await supabase
          .from('profiles')
          .update({ is_pro: false, plan: 'free', cinematic_tokens: 0, paddle_subscription_id: null })
          .eq('id', userId)
        console.log(`[paddle webhook] canceled -> user ${userId}`)
      }
    } else if (eventType === 'transaction.completed') {
      // Recurring charge / renewal — refill credits to the plan amount.
      if (userId && tier) {
        await supabase
          .from('profiles')
          .update({
            video_credits: creditsForTier(tier),
            is_pro: true,
            plan: tier,
            cinematic_tokens: cinematicTokensForTier(tier),
          })
          .eq('id', userId)
        console.log(`[paddle webhook] transaction.completed refill ${tier} -> user ${userId}`)
      }
    } else {
      console.log('[paddle webhook] unhandled event:', eventType)
    }

    return NextResponse.json({ received: true })
  } catch (e) {
    console.error('[paddle webhook] handler error:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ error: 'handler failed' }, { status: 500 })
  }
}
