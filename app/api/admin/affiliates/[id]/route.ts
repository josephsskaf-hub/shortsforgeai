// Admin — update a single affiliate.
// POST, admin-gated, service-role. Body: { action?, commission_rate?, coupon_code? }.
//   action 'approve'  → status='active' + approved_at=now()
//   action 'suspend'  → status='suspended'
//   action 'activate' → status='active'
// commission_rate is stored as the fraction given (e.g. 0.40). coupon_code, if
// present, is set (empty string clears it to null).

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ADMIN_EMAILS = new Set([
  'josephsskaf@gmail.com',
  'josephskaf@gmail.com',
  'joseph-test@shortsforgeai.com',
])

interface Body {
  action?: 'approve' | 'suspend' | 'activate'
  commission_rate?: number
  coupon_code?: string
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const email = user?.email?.toLowerCase() ?? ''
    if (!user || !ADMIN_EMAILS.has(email)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const id = params?.id
    if (!id) {
      return NextResponse.json({ error: 'Missing affiliate id' }, { status: 400 })
    }

    let body: Body = {}
    try {
      body = (await req.json()) as Body
    } catch {
      body = {}
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }

    const admin = createSupabaseAdmin(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const update: Record<string, unknown> = {}

    if (body.action === 'approve') {
      update.status = 'active'
      update.approved_at = new Date().toISOString()
    } else if (body.action === 'suspend') {
      update.status = 'suspended'
    } else if (body.action === 'activate') {
      update.status = 'active'
    }

    if (typeof body.commission_rate === 'number' && !Number.isNaN(body.commission_rate)) {
      update.commission_rate = body.commission_rate
    }

    if (typeof body.coupon_code === 'string') {
      const trimmed = body.coupon_code.trim()
      update.coupon_code = trimmed.length ? trimmed : null
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const { error } = await admin.from('affiliates').update(update).eq('id', id)
    if (error) {
      console.error('[admin/affiliates/:id] update error:', error.message)
      return NextResponse.json({ error: 'Failed to update affiliate' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/affiliates/:id] unexpected:', err)
    return NextResponse.json({ error: 'Failed to update affiliate' }, { status: 500 })
  }
}
