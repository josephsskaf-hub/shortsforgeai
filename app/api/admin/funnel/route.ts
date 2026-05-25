// Push #254 — Admin Funnel API rebuilt around real table data.
// The public.events table doesn't exist yet, so the old funnel showed all
// zeros. This version pulls from auth.users + profiles + videos — tables
// that already have live data — and computes meaningful conversion rates.

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

export interface FunnelData {
  eventsAvailable: boolean
  // Real stats from DB tables
  realStats: {
    totalUsers: number
    newThisWeek: number
    newThisMonth: number
    proUsers: number
    basicUsers: number
    freeUsers: number
    usersWithVideos: number
    totalVideos: number
    videosThisWeek: number
    paidNoCredits: number // paid users with 0 credits
  }
  // Derived conversion rates
  rates: {
    signupToVideo: string        // users who made ≥1 video / total users
    signupToPaid: string         // paid users / total users
    videoToPaid: string          // paid users / users with videos
    basicToPro: string           // pro / (basic + pro)
  }
  // Push #258 — Stripe checkout funnel (real data from Stripe API)
  stripePayments: {
    checkoutCreated: number    // sessions that reached the Stripe checkout page
    checkoutCompleted: number  // successfully paid
    checkoutAbandoned: number  // expired without payment
    checkoutOpen: number       // still on the page right now
    conversionRate: string     // completed / (completed + abandoned)
    recentFailedPayments: number // invoice.payment_failed in last 30 days
  }
  // Legacy event counts (kept for type compat, shown only if available)
  counts: {
    homepage_view: number
    generate_page_view: number
    analyze_idea_clicked: number
    video_generation_started: number
    video_generation_completed: number
    video_generation_failed: number
    pricing_view: number
    basic_checkout_clicked: number
    pro_checkout_clicked: number
    payment_success: number
    checkout_cancelled: number
  }
}

function pct(num: number, denom: number): string {
  if (!denom || denom <= 0) return '—'
  const r = (num / denom) * 100
  if (!Number.isFinite(r)) return '—'
  return `${r.toFixed(1)}%`
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
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }

    const admin = createServiceClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ── 1. auth.users ──────────────────────────────────────────────────────
    const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const authUsers = authData?.users ?? []
    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000
    let newThisWeek = 0
    let newThisMonth = 0
    for (const u of authUsers) {
      const t = u.created_at ? new Date(u.created_at).getTime() : 0
      if (t >= weekAgo) newThisWeek++
      if (t >= monthAgo) newThisMonth++
    }
    const totalUsers = authUsers.length

    // ── 2. profiles (plan + credits) ───────────────────────────────────────
    let proUsers = 0
    let basicUsers = 0
    let paidNoCredits = 0
    try {
      const { data: profs } = await admin
        .from('profiles')
        .select('id, plan, is_pro, video_credits')
      if (Array.isArray(profs)) {
        for (const row of profs as Array<{ id: string; plan?: string | null; is_pro?: boolean | null; video_credits?: number | null }>) {
          const p = (row.plan ?? (row.is_pro ? 'pro' : null) ?? '').toLowerCase()
          if (p === 'pro') proUsers++
          else if (p === 'basic') basicUsers++
          if ((p === 'pro' || p === 'basic') && (!row.video_credits || row.video_credits <= 0)) {
            paidNoCredits++
          }
        }
      }
    } catch { /* ignore */ }
    const freeUsers = totalUsers - proUsers - basicUsers

    // ── 3. videos ──────────────────────────────────────────────────────────
    let totalVideos = 0
    let videosThisWeek = 0
    const userWithVideoSet = new Set<string>()
    try {
      const { data: vids } = await admin
        .from('videos')
        .select('user_id, created_at')
      if (Array.isArray(vids)) {
        for (const row of vids as Array<{ user_id?: string | null; created_at?: string | null }>) {
          totalVideos++
          if (row.user_id) userWithVideoSet.add(row.user_id)
          if (row.created_at && new Date(row.created_at).getTime() >= weekAgo) videosThisWeek++
        }
      }
    } catch { /* ignore */ }
    const usersWithVideos = userWithVideoSet.size
    const paidUsers = proUsers + basicUsers

    // ── 4. Conversion rates ────────────────────────────────────────────────
    const rates = {
      signupToVideo: pct(usersWithVideos, totalUsers),
      signupToPaid:  pct(paidUsers,       totalUsers),
      videoToPaid:   pct(paidUsers,       usersWithVideos),
      basicToPro:    pct(proUsers,        paidUsers),
    }

    // ── 5. Stripe checkout funnel ─────────────────────────────────────────
    // Query all checkout sessions to show how many users reached checkout,
    // how many completed payment, and how many abandoned (to detect issues).
    let checkoutCreated = 0
    let checkoutCompleted = 0
    let checkoutAbandoned = 0
    let checkoutOpen = 0
    let recentFailedPayments = 0
    try {
      if (process.env.STRIPE_SECRET_KEY) {
        // List up to 100 most recent checkout sessions
        const sessions = await stripe.checkout.sessions.list({ limit: 100 })
        for (const s of sessions.data) {
          checkoutCreated++
          if (s.status === 'complete') checkoutCompleted++
          else if (s.status === 'expired') checkoutAbandoned++
          else if (s.status === 'open') checkoutOpen++
        }
        // Count recent payment failures from stripe_events or Stripe API
        // Use invoice.payment_failed events from stripe_events table if available
        try {
          const thirtyDaysAgoISO = new Date(monthAgo).toISOString()
          const { data: failEvents } = await admin
            .from('stripe_events')
            .select('id')
            .like('id', 'evt_%')
            .gte('received_at', thirtyDaysAgoISO)
            .limit(500)
          // Count via Stripe API: list recent failed payment intents as proxy
          const failedInvoices = await stripe.invoices.list({
            limit: 100,
            status: 'uncollectible',
          })
          recentFailedPayments = failedInvoices.data.filter(
            (inv) => inv.created * 1000 >= monthAgo
          ).length
          // suppress unused warning
          void failEvents
        } catch { /* ignore if stripe_events table missing */ }
      }
    } catch (stripeErr) {
      console.warn('[admin/funnel] Stripe query failed:', stripeErr instanceof Error ? stripeErr.message : String(stripeErr))
    }

    const stripePayments = {
      checkoutCreated,
      checkoutCompleted,
      checkoutAbandoned,
      checkoutOpen,
      conversionRate: pct(checkoutCompleted, checkoutCompleted + checkoutAbandoned),
      recentFailedPayments,
    }

    const zeroCounts = {
      homepage_view: 0, generate_page_view: 0, analyze_idea_clicked: 0,
      video_generation_started: 0, video_generation_completed: 0,
      video_generation_failed: 0, pricing_view: 0, basic_checkout_clicked: 0,
      pro_checkout_clicked: 0, payment_success: 0, checkout_cancelled: 0,
    }

    const data: FunnelData = {
      eventsAvailable: false,
      realStats: {
        totalUsers,
        newThisWeek,
        newThisMonth,
        proUsers,
        basicUsers,
        freeUsers,
        usersWithVideos,
        totalVideos,
        videosThisWeek,
        paidNoCredits,
      },
      rates,
      stripePayments,
      counts: zeroCounts,
    }

    return NextResponse.json({ data, updatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[admin/funnel] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
