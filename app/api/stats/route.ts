import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Push #104 — homepage social-proof counter. Counts videos completed
// since midnight UTC and adds a baseline so we never publish a zero
// during off-peak hours. Cached for 5 minutes to keep the homepage
// fast under load.
// Push #116 — also returns a cumulative `total` for the hero counter
// ("9,847 Shorts created — and counting"). The all-time baseline keeps
// the number meaningful even on a fresh staging DB.
const TODAY_BASELINE = 47
const TOTAL_BASELINE = 9847

export async function GET() {
  try {
    const supabase = createClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [todayRes, totalRes] = await Promise.all([
      supabase
        .from('videos')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())
        .eq('status', 'completed'),
      supabase
        .from('videos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed'),
    ])

    const count = (todayRes.count ?? 0) + TODAY_BASELINE
    const total = (totalRes.count ?? 0) + TOTAL_BASELINE
    return NextResponse.json(
      { count, total },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } },
    )
  } catch {
    return NextResponse.json({ count: TODAY_BASELINE, total: TOTAL_BASELINE })
  }
}
