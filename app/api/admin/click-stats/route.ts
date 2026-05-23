// Push #233 — Admin click-stats API.
// Returns total Basic / Pro checkout-button clicks from public.click_events
// for the admin metrics dashboard. Gated to the admin emails; everyone else
// gets 403. Reads via the service role so it works regardless of RLS.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = new Set([
  'josephsskaf@gmail.com',
  'josephskaf@gmail.com',
  'joseph-test@shortsforgeai.com',
])

async function safeCount(
  fn: () => Promise<{ count: number | null; error: unknown }>
): Promise<number | null> {
  try {
    const { count, error } = await fn()
    if (error) return null
    return typeof count === 'number' ? count : null
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const email = user?.email?.toLowerCase() ?? ''
    if (!user || !ADMIN_EMAILS.has(email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ available: false, basic: null, pro: null })
    }

    const admin = createServiceClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Probe table existence so the dashboard can show "not tracked yet"
    // rather than a hard error when the migration hasn't been run.
    const probe = await admin
      .from('click_events')
      .select('id', { head: true, count: 'exact' })
      .limit(1)
    if (probe.error) {
      const code = (probe.error as { code?: string }).code ?? ''
      if (code === '42P01' || /does not exist|relation/.test(probe.error.message ?? '')) {
        return NextResponse.json({ available: false, basic: null, pro: null })
      }
    }

    const [basic, pro] = await Promise.all([
      safeCount(() =>
        admin.from('click_events').select('id', { head: true, count: 'exact' }).eq('plan', 'basic')
      ),
      safeCount(() =>
        admin.from('click_events').select('id', { head: true, count: 'exact' }).eq('plan', 'pro')
      ),
    ])

    return NextResponse.json({ available: true, basic, pro, updatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[admin/click-stats] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
