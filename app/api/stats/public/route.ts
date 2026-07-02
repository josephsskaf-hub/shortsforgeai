// PROVA-SOCIAL-REAL-2026-07-02 — public, non-sensitive live stats for the
// marketing funnel (LiveStatsBadge). Returns ONLY aggregate counts straight
// from the database — never invented numbers, never per-user data.
//
// Uses the service role key (same pattern as app/api/exit-feedback/route.ts)
// because the callers are anonymous visitors and RLS would otherwise hide
// other users' rows from the count. Only counts leave this route.
//
// Cached: revalidate = 3600 (ISR) + CDN Cache-Control so anonymous traffic
// never hammers the database — at most one real query set per hour.

import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const revalidate = 3600

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      // Config gap — the badge simply won't render. Never surface details.
      return NextResponse.json({ ok: false }, { headers: CACHE_HEADERS })
    }

    const admin = createServiceClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [videosRes, weeklyRes, creatorsRes] = await Promise.all([
      admin.from('videos').select('*', { count: 'exact', head: true }),
      admin
        .from('videos')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo),
      admin.from('profiles').select('*', { count: 'exact', head: true }),
    ])

    if (videosRes.error && creatorsRes.error) {
      return NextResponse.json({ ok: false }, { headers: CACHE_HEADERS })
    }

    return NextResponse.json(
      {
        ok: true,
        totalVideos: videosRes.count ?? 0,
        videosLast7Days: weeklyRes.count ?? 0,
        totalCreators: creatorsRes.count ?? 0,
      },
      { headers: CACHE_HEADERS }
    )
  } catch {
    return NextResponse.json({ ok: false }, { headers: CACHE_HEADERS })
  }
}
