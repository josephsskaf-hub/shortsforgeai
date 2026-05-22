// Push #066 — Admin Metrics API route.
// Returns the same data as /admin/metrics/page.tsx but as JSON, so the
// client component can poll every 30 s without a full page reload.
// Gated to the admin emails; everything else gets 403.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { MetricsData } from '@/app/(dashboard)/admin/metrics/MetricsClient'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = new Set([
  'josephsskaf@gmail.com',
  'josephskaf@gmail.com',
  'joseph-test@shortsforgeai.com',
])

function startOfTodayUtcIso(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

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

    const todayIso = startOfTodayUtcIso()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const admin =
      supabaseUrl && serviceKey
        ? createServiceClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null

    // auth.users via service role
    let totalUsers: number | null = null
    let newUsersToday: number | null = null
    if (admin) {
      try {
        const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
        if (!error && data?.users) {
          totalUsers = data.users.length
          const todayTs = new Date(todayIso).getTime()
          newUsersToday = data.users.filter((u) => {
            const t = u.created_at ? new Date(u.created_at).getTime() : 0
            return t >= todayTs
          }).length
        }
      } catch {
        // service role unreachable — keep nulls
      }
    }

    // public.videos counts
    const completedVideos = await safeCount(() =>
      supabase
        .from('videos')
        .select('id', { head: true, count: 'exact' })
        .eq('status', 'completed')
    )
    const completedVideosFallback = await safeCount(() =>
      supabase
        .from('videos')
        .select('id', { head: true, count: 'exact' })
        .not('final_video_url', 'is', null)
    )
    const totalCompleted = completedVideos ?? completedVideosFallback ?? null

    const videosToday = await safeCount(() =>
      supabase
        .from('videos')
        .select('id', { head: true, count: 'exact' })
        .gte('created_at', todayIso)
    )

    const failedVideos = await safeCount(() =>
      supabase
        .from('videos')
        .select('id', { head: true, count: 'exact' })
        .eq('status', 'failed')
    )

    let successRate: number | null = null
    if (typeof totalCompleted === 'number' && typeof failedVideos === 'number') {
      const denom = totalCompleted + failedVideos
      successRate = denom > 0 ? Math.round((totalCompleted / denom) * 100) : null
    }

    // public.events
    let eventsAvailable = true
    let pricingViews: number | null = null
    let checkoutBasicClicks: number | null = null
    let checkoutProClicks: number | null = null
    let generateStarted: number | null = null
    let generateCompleted: number | null = null
    let generateFailed: number | null = null
    let videosDownloaded: number | null = null

    try {
      const probe = await supabase
        .from('events')
        .select('id', { head: true, count: 'exact' })
        .limit(1)
      if (probe.error) {
        const code = (probe.error as { code?: string }).code ?? ''
        if (code === '42P01' || /does not exist|relation/.test(probe.error.message ?? '')) {
          eventsAvailable = false
        }
      }
      if (eventsAvailable) {
        const counts = await Promise.all(
          [
            'pricing_view',
            'checkout_basic_click',
            'checkout_pro_click',
            'generate_started',
            'generate_completed',
            'generate_failed',
            'video_downloaded',
          ].map((name) =>
            safeCount(() =>
              supabase
                .from('events')
                .select('id', { head: true, count: 'exact' })
                .eq('name', name)
            )
          )
        )
        pricingViews = counts[0]
        checkoutBasicClicks = counts[1]
        checkoutProClicks = counts[2]
        generateStarted = counts[3]
        generateCompleted = counts[4]
        generateFailed = counts[5]
        videosDownloaded = counts[6]
      }
    } catch {
      eventsAvailable = false
    }

    const metrics: MetricsData = {
      totalUsers,
      newUsersToday,
      totalCompleted,
      videosToday,
      failedVideos,
      successRate,
      eventsAvailable,
      pricingViews,
      checkoutBasicClicks,
      checkoutProClicks,
      generateStarted,
      generateCompleted,
      generateFailed,
      videosDownloaded,
    }

    return NextResponse.json({ data: metrics, updatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[admin/metrics] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
