// Push #298 — CEO Dashboard page (server component + SSR seed).

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import CeoClient from './CeoClient'
import type { CeoData } from '@/app/api/admin/ceo/route'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = new Set([
  'josephsskaf@gmail.com',
  'josephskaf@gmail.com',
  'joseph-test@shortsforgeai.com',
])

const PRO_PRICE   = 9.90
const BASIC_PRICE = 4.90

function pct(n: number, d: number): string {
  if (!d || d <= 0) return '—'
  return `${((n / d) * 100).toFixed(1)}%`
}

function daysAgoFn(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24))
}

export default async function AdminCeoPage() {
  const cookieClient = createClient()
  const { data: { user } } = await cookieClient.auth.getUser()
  const email = user?.email?.toLowerCase() ?? ''
  if (!user || !ADMIN_EMAILS.has(email)) {
    return <CeoClient denied />
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const admin = createServiceClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const now      = Date.now()
  const todayAgo = now - 24 * 60 * 60 * 1000
  const weekAgo  = now - 7  * 24 * 60 * 60 * 1000
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000

  // ── auth.users ──────────────────────────────────────────────────────────
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const authUsers = authData?.users ?? []
  let signupsToday = 0, signupsThisWeek = 0, signupsThisMonth = 0
  const newUserIdsThisWeek = new Set<string>()
  for (const u of authUsers) {
    const t = u.created_at ? new Date(u.created_at).getTime() : 0
    if (t >= todayAgo)  signupsToday++
    if (t >= weekAgo)  { signupsThisWeek++; newUserIdsThisWeek.add(u.id) }
    if (t >= monthAgo) signupsThisMonth++
  }
  const totalUsers = authUsers.length
  const userEmails = new Map(authUsers.map(u => [u.id, u.email ?? '']))

  // ── profiles ────────────────────────────────────────────────────────────
  let proUsers = 0, basicUsers = 0
  const atRiskUsers: CeoData['atRiskUsers'] = []
  try {
    const { data: profs } = await admin.from('profiles').select('id, plan, is_pro, video_credits')
    if (Array.isArray(profs)) {
      for (const row of profs as Array<{ id: string; plan?: string | null; is_pro?: boolean | null; video_credits?: number | null }>) {
        const p = (row.plan ?? (row.is_pro ? 'pro' : null) ?? '').toLowerCase()
        if (p === 'pro')        proUsers++
        else if (p === 'basic') basicUsers++
        if ((p === 'pro' || p === 'basic') && (row.video_credits ?? 999) <= 2) {
          atRiskUsers.push({ email: userEmails.get(row.id) ?? row.id, plan: p, credits: row.video_credits ?? 0 })
        }
      }
    }
  } catch { /* ignore */ }
  atRiskUsers.sort((a, b) => a.credits - b.credits)

  const paidTotal = proUsers + basicUsers
  const mrr       = proUsers * PRO_PRICE + basicUsers * BASIC_PRICE

  // ── videos ──────────────────────────────────────────────────────────────
  let videosToday = 0, videosThisWeek = 0
  const usersWithAnyVideo = new Set<string>()
  const newUsersActivated = new Set<string>()
  try {
    const { data: vids } = await admin.from('videos').select('user_id, created_at')
    if (Array.isArray(vids)) {
      for (const row of vids as Array<{ user_id?: string | null; created_at?: string | null }>) {
        if (row.user_id) usersWithAnyVideo.add(row.user_id)
        const t = row.created_at ? new Date(row.created_at).getTime() : 0
        if (t >= todayAgo) videosToday++
        if (t >= weekAgo)  {
          videosThisWeek++
          if (row.user_id && newUserIdsThisWeek.has(row.user_id)) newUsersActivated.add(row.user_id)
        }
      }
    }
  } catch { /* ignore */ }

  // ── Stripe ──────────────────────────────────────────────────────────────
  let checkoutCreated = 0, checkoutCompleted = 0, checkoutAbandoned = 0
  const abandonedLeads: CeoData['abandonedLeads'] = []
  try {
    if (process.env.STRIPE_SECRET_KEY) {
      const sessions = await stripe.checkout.sessions.list({ limit: 100 })
      for (const s of sessions.data) {
        checkoutCreated++
        if (s.status === 'complete') { checkoutCompleted++ }
        else if (s.status === 'expired') {
          checkoutAbandoned++
          const custEmail = s.customer_details?.email ?? ''
          const planHint  = (s.metadata?.plan ?? null) as string | null
          if (custEmail) {
            abandonedLeads.push({
              email:      custEmail,
              plan:       planHint,
              abandonedAt: new Date(s.expires_at * 1000).toISOString(),
              daysAgo:    daysAgoFn(new Date(s.expires_at * 1000).toISOString()),
            })
          }
        }
      }
    }
  } catch { /* ignore */ }

  const leadMap = new Map<string, CeoData['abandonedLeads'][0]>()
  for (const lead of abandonedLeads) {
    const ex = leadMap.get(lead.email)
    if (!ex || lead.daysAgo < ex.daysAgo) leadMap.set(lead.email, lead)
  }
  const deduped = Array.from(leadMap.values()).sort((a, b) => a.daysAgo - b.daysAgo)

  const data: CeoData = {
    mrr,
    proUsers,
    basicUsers,
    paidTotal,
    signupsToday,
    signupsThisWeek,
    signupsThisMonth,
    newUsersThisWeek:      newUserIdsThisWeek.size,
    newActivatedThisWeek:  newUsersActivated.size,
    activationRateWeek:    pct(newUsersActivated.size, newUserIdsThisWeek.size),
    videosToday,
    videosThisWeek,
    atRiskCount:   atRiskUsers.length,
    atRiskUsers:   atRiskUsers.slice(0, 10),
    abandonedCount: deduped.length,
    abandonedLeads: deduped.slice(0, 15),
    checkoutCreated,
    checkoutCompleted,
    checkoutAbandoned,
    checkoutConversionRate: pct(checkoutCompleted, checkoutCompleted + checkoutAbandoned),
    signupToPaidRate:  pct(paidTotal, totalUsers),
    signupToVideoRate: pct(usersWithAnyVideo.size, totalUsers),
  }

  return <CeoClient data={data} viewerEmail={email} />
}
