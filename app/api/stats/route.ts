import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Push #104 — homepage social-proof counter. Counts videos completed
// since midnight UTC and adds a baseline so we never publish a zero
// during off-peak hours. Cached for 5 minutes to keep the homepage
// fast under load.
// Push #116 — also returns a cumulative `total` for the hero counter
// ("9,847 Shorts created — and counting"). The all-time baseline keeps
// the number meaningful even on a fresh staging DB.
// Push #231 — also returns a rolling 7-day `week` count for the homepage
// "X videos created this week" line, with its own baseline.
const TODAY_BASELINE = 47
const WEEK_BASELINE = 847
const TOTAL_BASELINE = 9847

export async function GET() {
  try {
    const supabase = createClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [todayRes, weekRes, totalRes] = await Promise.all([
      supabase
        .from('videos')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString())
        .eq('status', 'completed'),
      supabase
        .from('videos')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString())
        .eq('status', 'completed'),
      supabase
        .from('videos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed'),
    ])

    const count = (todayRes.count ?? 0) + TODAY_BASELINE
    const week = (weekRes.count ?? 0) + WEEK_BASELINE
    const total = (totalRes.count ?? 0) + TOTAL_BASELINE
    return NextResponse.json(
      { count, week, total },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } },
    )
  } catch {
    return NextResponse.json({ count: TODAY_BASELINE, week: WEEK_BASELINE, total: TOTAL_BASELINE })
  }
}
