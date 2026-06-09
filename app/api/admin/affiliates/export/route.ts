// Admin — export all affiliate commissions as CSV.
// GET, admin-gated, service-role. Joins each commission to its affiliate's
// code + email and streams a downloadable CSV. Amounts are converted from
// CENTS to DOLLARS (2 decimals). Fields containing commas/quotes/newlines are
// quoted+escaped per RFC 4180.

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

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  // Quote if it contains a comma, double-quote, or newline; escape quotes by doubling.
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function dollars(cents: number | null): string {
  return ((cents ?? 0) / 100).toFixed(2)
}

interface CommissionRow {
  created_at: string | null
  affiliate_id: string | null
  type: string | null
  provider: string | null
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

    const email = user?.email?.toLowerCase() ?? ''
    if (!user || !ADMIN_EMAILS.has(email)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }

    const admin = createSupabaseAdmin(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Build an affiliate_id → { code, email } lookup, then the commissions.
    const [{ data: affiliates }, { data: commissions }] = await Promise.all([
      admin.from('affiliates').select('id, code, email'),
      admin
        .from('affiliate_commissions')
        .select('created_at, affiliate_id, type, provider, amount_gross, commission_amount, currency, status')
        .order('created_at', { ascending: false }),
    ])

    const affMap = new Map<string, { code: string | null; email: string | null }>()
    for (const a of (affiliates ?? []) as Array<{ id: string; code: string | null; email: string | null }>) {
      affMap.set(a.id, { code: a.code, email: a.email })
    }

    const header = [
      'date',
      'affiliate_code',
      'affiliate_email',
      'type',
      'provider',
      'amount_gross',
      'commission_amount',
      'currency',
      'status',
    ].join(',')

    const lines = [header]
    for (const c of (commissions ?? []) as CommissionRow[]) {
      const aff = c.affiliate_id ? affMap.get(c.affiliate_id) : undefined
      lines.push(
        [
          csvCell(c.created_at ?? ''),
          csvCell(aff?.code ?? ''),
          csvCell(aff?.email ?? ''),
          csvCell(c.type ?? ''),
          csvCell(c.provider ?? ''),
          csvCell(dollars(c.amount_gross)),
          csvCell(dollars(c.commission_amount)),
          csvCell(c.currency ?? ''),
          csvCell(c.status ?? ''),
        ].join(',')
      )
    }

    const csv = lines.join('\r\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="affiliate_commissions.csv"',
      },
    })
  } catch (err) {
    console.error('[admin/affiliates/export] unexpected:', err)
    return NextResponse.json({ error: 'Failed to export' }, { status: 500 })
  }
}
