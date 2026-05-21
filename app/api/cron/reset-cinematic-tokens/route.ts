import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Push #088 — Monthly fallback cron that resets cinematic_tokens to 1 for
// every Pro user. Stripe webhooks are the primary mechanism (renewal sets
// the token directly), but real subscriptions don't always land on the
// 1st of the month — and we want every Pro user to have at least one
// Cinematic video available at the start of each month, regardless of
// their renewal date.
//
// Configured by vercel.json:
//   { path: '/api/cron/reset-cinematic-tokens', schedule: '0 0 1 * *' }
//
// Protected by the `CRON_SECRET` env var. Vercel Cron automatically sends
// `Authorization: Bearer <secret>` when configured in the project.

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[cron] CRON_SECRET is not configured — refusing to run.')
    return NextResponse.json({ error: 'Cron not configured.' }, { status: 500 })
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('[cron] Supabase service-role env missing.')
    return NextResponse.json(
      { error: 'Supabase service-role env missing.' },
      { status: 500 },
    )
  }

  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Try the SECURITY DEFINER function first (defined in migration 006).
  // Falls back to a direct UPDATE if the function doesn't exist yet on
  // this environment — the result is identical.
  const rpc = await admin.rpc('reset_cinematic_tokens_for_pro')
  if (!rpc.error) {
    console.log('[cron] reset_cinematic_tokens_for_pro RPC OK')
    return NextResponse.json({ success: true, mechanism: 'rpc' })
  }
  console.warn(
    '[cron] RPC failed, falling back to direct update:',
    rpc.error.message,
  )

  const { error: updateErr, count } = await admin
    .from('profiles')
    .update({ cinematic_tokens: 1 }, { count: 'exact' })
    .or('is_pro.eq.true,plan.eq.pro')

  if (updateErr) {
    console.error('[cron] direct update failed:', updateErr.message)
    return NextResponse.json(
      { error: updateErr.message, mechanism: 'direct' },
      { status: 500 },
    )
  }

  console.log(`[cron] direct update OK, rows=${count ?? 'unknown'}`)
  return NextResponse.json({
    success: true,
    mechanism: 'direct',
    rows: count ?? null,
  })
}
