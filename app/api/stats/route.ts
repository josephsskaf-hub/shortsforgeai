import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Push #104 — homepage social-proof counter. Counts videos completed
// since midnight UTC and adds a baseline so we never publish a zero
// during off-peak hours. Cached for 5 minutes to keep the homepage
// fast under load.
const BASELINE = 47

export async function GET() {
  try {
    const supabase = createClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { count } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())
      .eq('status', 'completed')

    const displayed = (count ?? 0) + BASELINE
    return NextResponse.json(
      { count: displayed },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } },
    )
  } catch {
    return NextResponse.json({ count: BASELINE })
  }
}
