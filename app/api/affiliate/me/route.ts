// Affiliate self-serve — "my dashboard" data.
// GET, auth required. Looks up the affiliate row owned by the signed-in user
// (service-role, since RLS on the affiliate_* tables is deny-all) and returns
// their share link, lifetime stats and commission earnings. Amounts are in
// CENTS straight from the DB — the client divides by 100 for display.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface CommissionRow {
  created_at: string | null
  type: string | null
  amount_gross: number | null
  commission_amount: number | null
  currency: string | null
  status: string | null
}

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }

    const admin = createSupabaseAdmin(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Find the affiliate owned by this user.
    const { data: affiliate } = await admin
      .from('affiliates')
      .select('id, code, status, commission_rate, coupon_code')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!affiliate) {
      return NextResponse.json({ isAffiliate: false })
    }

    const affiliateId = affiliate.id

    // Lifetime click + referral counts.
    const [{ count: clicks }, { count: signups }, { count: paid }] = await Promise.all([
      admin
        .from('affiliate_clicks')
        .select('id', { count: 'exact', head: true })
        .eq('affiliate_id', affiliateId),
      admin
        .from('affiliate_referrals')
        .select('id', { count: 'exact', head: true })
        .eq('affiliate_id', affiliateId),
      admin
        .from('affiliate_referrals')
        .select('id', { count: 'exact', head: true })
        .eq('affiliate_id', affiliateId)
        .eq('status', 'paid'),
    ])

    // All commissions for this affiliate — used for earnings sums + recent list.
    const { data: commissions } = await admin
      .from('affiliate_commissions')
      .select('created_at, type, amount_gross, commission_amount, currency, status')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false })

    const rows = (commissions ?? []) as CommissionRow[]

    const earnings = { pending: 0, approved: 0, paid: 0, total: 0 }
    for (const c of rows) {
      const amt = c.commission_amount ?? 0
      if (c.status === 'pending') earnings.pending += amt
      else if (c.status === 'approved') earnings.approved += amt
      else if (c.status === 'paid') earnings.paid += amt
      // total = everything not clawed back
      if (c.status !== 'clawed_back') earnings.total += amt
    }

    const recent = rows.slice(0, 20).map((c) => ({
      created_at: c.created_at,
      type: c.type,
      amount_gross: c.amount_gross ?? 0,
      commission_amount: c.commission_amount ?? 0,
      currency: c.currency ?? 'usd',
      status: c.status,
    }))

    return NextResponse.json({
      isAffiliate: true,
      affiliate: {
        code: affiliate.code,
        status: affiliate.status,
        commission_rate: affiliate.commission_rate,
        coupon_code: affiliate.coupon_code,
      },
      link: 'https://www.usekineo.com/a/' + affiliate.code,
      stats: {
        clicks: clicks ?? 0,
        signups: signups ?? 0,
        paid: paid ?? 0,
      },
      earnings,
      recent,
    })
  } catch (err) {
    console.error('[affiliate/me] unexpected:', err)
    return NextResponse.json({ error: 'Failed to load affiliate' }, { status: 500 })
  }
}
