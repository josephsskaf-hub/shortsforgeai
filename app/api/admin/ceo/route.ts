// Push #298 — CEO Dashboard API.
// Single endpoint that aggregates the metrics a CEO checks every morning:
// MRR, signups, activation, abandoned leads, at-risk paid users, daily videos.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = new Set([
  'josephsskaf@gmail.com',
  'josephskaf@gmail.com',
  'joseph-test@shortsforgeai.com',
])

const PRO_PRICE  = 9.90
const BASIC_PRICE = 4.90

export interface CeoData {
  // ── Revenue ──────────────────────────────────────────────────────────────
  mrr: number                 // Pro×9.90 + Basic×4.90
  proUsers: number
  basicUsers: number
  paidTotal: number
  // ── Growth ───────────────────────────────────────────────────────────────
  signupsToday: number
  signupsThisWeek: number
  signupsThisMonth: number
  // ── Activation (new users who made ≥1 video, last 7 days) ───────────────
  newUsersThisWeek: number    // signed up in last 7 days
  newActivatedThisWeek: number // of those, made ≥1 video
  activationRateWeek: string  // "33.3%"
  // ── Daily pulse ──────────────────────────────────────────────────────────
  videosToday: number
  videosThisWeek: number
  // ── At-risk paid users (credits ≤ 2) ────────────────────────────────────
  atRiskCount: number
  atRiskUsers: Array<{ email: string; plan: string; credits: number }>
  // ── Abandoned checkouts (Stripe) ─────────────────────────────────────────
  abandonedCount: number
  abandonedLeads: Array<{
    email: string
    plan: string | null
    abandonedAt: string   // ISO
    daysAgo: number
  }>
  // ── Stripe checkout funnel ───────────────────────────────────────────────
  checkoutCreated: number
  checkoutCompleted: number
  checkoutAbandoned: number
  checkoutConversionRate: string
  // ── Conversion rates ─────────────────────────────────────────────────────
  signupToPaidRate: string
  signupToVideoRate: string
}

function pct(n: number, d: number): string {
  if (!d || d <= 0) return '—'
  return `${((n / d) * 100).toFixed(1)}%`
}

function daysAgo(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24))
}

export async function GET() {
  try {
    const cookieClient = createClient()
    const { data: { user } } = await cookieClient.auth.getUser()
    const email = user?.email?.toLowerCase() ?? ''
    if (!user || !ADMIN_EMAILS.has(email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }

    const admin = createServiceClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const now       = Date.now()
    const todayAgo  = now - 24 * 60 * 60 * 1000
    const weekAgo   = now - 7  * 24 * 60 * 60 * 1000
    const monthAgo  = now - 30 * 24 * 60 * 60 * 1000

    // ── 1. auth.users ───────────────────────────────────────────────────────
    const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const authUsers = authData?.users ?? []
    const authById  = new Map(authUsers.map(u => [u.id, u]))

    let signupsToday = 0, signupsThisWeek = 0, signupsThisMonth = 0
    const newUserIdsThisWeek = new Set<string>()
    for (const u of authUsers) {
      const t = u.created_at ? new Date(u.created_at).getTime() : 0
      if (t >= todayAgo)  signupsToday++
      if (t >= weekAgo)  { signupsThisWeek++; newUserIdsThisWeek.add(u.id) }
      if (t >= monthAgo) signupsThisMonth++
    }
    const totalUsers = authUsers.length

    // ── 2. profiles ─────────────────────────────────────────────────────────
    let proUsers = 0, basicUsers = 0
    const atRiskUsers: CeoData['atRiskUsers'] = []
    const userEmails = new Map<string, string>()
    authUsers.forEach(u => userEmails.set(u.id, u.email ?? ''))

    try {
      const { data: profs } = await admin
        .from('profiles')
        .select('id, plan, is_pro, video_credits')
      if (Array.isArray(profs)) {
        for (const row of profs as Array<{ id: string; plan?: string | null; is_pro?: boolean | null; video_credits?: number | null }>) {
          const p = (row.plan ?? (row.is_pro ? 'pro' : null) ?? '').toLowerCase()
          if (p === 'pro')        proUsers++
          else if (p === 'basic') basicUsers++
          // At-risk: paid with credits ≤ 2
          if ((p === 'pro' || p === 'basic') && (row.video_credits ?? 999) <= 2) {
            atRiskUsers.push({
              email:   userEmails.get(row.id) ?? row.id,
              plan:    p,
              credits: row.video_credits ?? 0,
            })
          }
        }
      }
    } catch { /* ignore */ }

    atRiskUsers.sort((a, b) => a.credits - b.credits)

    const paidTotal = proUsers + basicUsers
    const mrr       = proUsers * PRO_PRICE + basicUsers * BASIC_PRICE

    // ── 3. videos ───────────────────────────────────────────────────────────
    let videosToday = 0, videosThisWeek = 0
    const usersWithAnyVideo = new Set<string>()
    const newUsersActivatedThisWeek = new Set<string>()
    try {
      const { data: vids } = await admin.from('videos').select('user_id, created_at')
      if (Array.isArray(vids)) {
        for (const row of vids as Array<{ user_id?: string | null; created_at?: string | null }>) {
          if (row.user_id) usersWithAnyVideo.add(row.user_id)
          const t = row.created_at ? new Date(row.created_at).getTime() : 0
          if (t >= todayAgo)  videosToday++
          if (t >= weekAgo)  {
            videosThisWeek++
            if (row.user_id && newUserIdsThisWeek.has(row.user_id)) {
              newUsersActivatedThisWeek.add(row.user_id)
            }
          }
        }
      }
    } catch { /* ignore */ }

    const newUsersThisWeek      = newUserIdsThisWeek.size
    const newActivatedThisWeek  = newUsersActivatedThisWeek.size
    const activationRateWeek    = pct(newActivatedThisWeek, newUsersThisWeek)

    // ── 4. Stripe — abandoned checkouts + funnel ────────────────────────────
    let checkoutCreated = 0, checkoutCompleted = 0, checkoutAbandoned = 0
    const abandonedLeads: CeoData['abandonedLeads'] = []

    try {
      if (process.env.STRIPE_SECRET_KEY) {
        const sessions = await stripe.checkout.sessions.list({ limit: 100, expand: ['data.customer'] })
        for (const s of sessions.data) {
          checkoutCreated++
          if (s.status === 'complete')  { checkoutCompleted++ }
          else if (s.status === 'expired') {
            checkoutAbandoned++
            // Only surface as lead if the customer had no paid plan
            const custEmail = typeof s.customer_details?.email === 'string'
              ? s.customer_details.email
              : (typeof s.customer === 'object' && s.customer !== null && 'email' in s.customer
                  ? (s.customer as { email?: string }).email ?? ''
                  : '')
            // Match to profile plan
            const matchedUser = authUsers.find(u => u.email?.toLowerCase() === custEmail.toLowerCase())
            const matchedId   = matchedUser?.id
            // Determine plan hint from metadata or line items description
            const planHint = (s.metadata?.plan ?? null) as string | null
            // Only surface if the user is still free (no paid plan)
            const isStillFree = !matchedId || !['pro', 'basic'].includes(
              (matchedId ? '' : '').toLowerCase()
            )
            if (isStillFree && custEmail) {
              abandonedLeads.push({
                email:      custEmail,
                plan:       planHint,
                abandonedAt: new Date(s.expires_at * 1000).toISOString(),
                daysAgo:    daysAgo(new Date(s.expires_at * 1000).toISOString()),
              })
            }
          }
        }
      }
    } catch (e) {
      console.warn('[admin/ceo] Stripe query failed:', e instanceof Error ? e.message : String(e))
    }

    // Deduplicate leads by email, keep most recent
    const leadMap = new Map<string, CeoData['abandonedLeads'][0]>()
    for (const lead of abandonedLeads) {
      const existing = leadMap.get(lead.email)
      if (!existing || lead.daysAgo < existing.daysAgo) leadMap.set(lead.email, lead)
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
      newUsersThisWeek,
      newActivatedThisWeek,
      activationRateWeek,
      videosToday,
      videosThisWeek,
      atRiskCount: atRiskUsers.length,
      atRiskUsers: atRiskUsers.slice(0, 10),
      abandonedCount: deduped.length,
      abandonedLeads: deduped.slice(0, 15),
      checkoutCreated,
      checkoutCompleted,
      checkoutAbandoned,
      checkoutConversionRate: pct(checkoutCompleted, checkoutCompleted + checkoutAbandoned),
      signupToPaidRate:  pct(paidTotal, totalUsers),
      signupToVideoRate: pct(usersWithAnyVideo.size, totalUsers),
    }

    return NextResponse.json({ data, updatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[admin/ceo] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
