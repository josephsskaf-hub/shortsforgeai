import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Push #427 — store/remove the caller's Web Push subscription.
// RLS on push_subscriptions restricts rows to the authenticated user.

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const endpoint = (body.endpoint ?? '').toString()
    if (!endpoint.startsWith('https://')) {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh: body.keys?.p256dh ?? null,
        auth: body.keys?.auth ?? null,
      },
      { onConflict: 'endpoint' }
    )
    if (error) {
      console.error('[push/subscribe] upsert error:', error.message)
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push/subscribe] unexpected:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: { endpoint?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }
    const endpoint = (body.endpoint ?? '').toString()
    if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })

    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push/subscribe] unexpected:', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
