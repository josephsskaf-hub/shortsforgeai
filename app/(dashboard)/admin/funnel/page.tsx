// Push #254 — Funnel page rebuilt. Queries auth.users + profiles + videos
// directly (same logic as the API route) so SSR always shows real data.

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import FunnelClient from './FunnelClient'
import type { FunnelData } from '@/app/api/admin/funnel/route'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = new Set([
  'josephsskaf@gmail.com',
  'josephskaf@gmail.com',
  'joseph-test@shortsforgeai.com',
])

function pct(n: number, d: number): string {
  return d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—'
}

export default async function AdminFunnelPage() {
  const cookieClient = createClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  const email = user?.email?.toLowerCase() ?? ''
  if (!user || !ADMIN_EMAILS.has(email)) {
    return <FunnelClient denied />
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const admin = createServiceClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const now = Date.now()
  const weekAgo  = now - 7  * 24 * 60 * 60 * 1000
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000

  // auth.users
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const authUsers = authData?.users ?? []
  let newThisWeek = 0, newThisMonth = 0
  for (const u of authUsers) {
    const t = u.created_at ? new Date(u.created_at).getTime() : 0
    if (t >= weekAgo)  newThisWeek++
    if (t >= monthAgo) newThisMonth++
  }

  // profiles
  let proUsers = 0, basicUsers = 0, paidNoCredits = 0
  try {
    const { data: profs } = await admin.from('profiles').select('id, plan, is_pro, video_credits')
    if (Array.isArray(profs)) {
      for (const row of profs as Array<{ id: string; plan?: string | null; is_pro?: boolean | null; video_credits?: number | null }>) {
        const p = (row.plan ?? (row.is_pro ? 'pro' : null) ?? '').toLowerCase()
        if (p === 'pro')   proUsers++
        else if (p === 'basic') basicUsers++
        if ((p === 'pro' || p === 'basic') && (!row.video_credits || row.video_credits <= 0)) paidNoCredits++
      }
    }
  } catch { /* ignore */ }

  // videos
  let totalVideos = 0, videosThisWeek = 0
  const uWithVideo = new Set<string>()
  try {
    const { data: vids } = await admin.from('videos').select('user_id, created_at')
    if (Array.isArray(vids)) {
      for (const row of vids as Array<{ user_id?: string | null; created_at?: string | null }>) {
        totalVideos++
        if (row.user_id) uWithVideo.add(row.user_id)
        if (row.created_at && new Date(row.created_at).getTime() >= weekAgo) videosThisWeek++
      }
    }
  } catch { /* ignore */ }

  const freeUsers  = authUsers.length - proUsers - basicUsers
  const paidUsers  = proUsers + basicUsers

  const data: FunnelData = {
    eventsAvailable: false,
    realStats: {
      totalUsers:     authUsers.length,
      newThisWeek,
      newThisMonth,
      proUsers,
      basicUsers,
      freeUsers,
      usersWithVideos: uWithVideo.size,
      totalVideos,
      videosThisWeek,
      paidNoCredits,
    },
    rates: {
      signupToVideo: pct(uWithVideo.size, authUsers.length),
      signupToPaid:  pct(paidUsers,       authUsers.length),
      videoToPaid:   pct(paidUsers,       uWithVideo.size),
      basicToPro:    pct(proUsers,        paidUsers),
    },
    counts: {
      homepage_view: 0, generate_page_view: 0, analyze_idea_clicked: 0,
      video_generation_started: 0, video_generation_completed: 0,
      video_generation_failed: 0, pricing_view: 0, basic_checkout_clicked: 0,
      pro_checkout_clicked: 0, payment_success: 0, checkout_cancelled: 0,
    },
  }

  return <FunnelClient data={data} viewerEmail={email} />
}
