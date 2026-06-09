// Admin Funnel API — real-data growth dashboard.
//
// public.events does NOT exist in production, so everything here is computed
// from live tables: auth.users + profiles + videos + click_events +
// checkout_abandoned + the Stripe API.
//
// #475 — extended the original Push #254 dashboard (realStats / rates /
// stripePayments — kept intact, the existing FunnelClient still consumes them)
// with COHORT analytics gated by ?days= : a visual funnel with per-step loss +
// biggest-leak detection, Revenue Leaks buckets, PQL Hot Leads, Source/UTM
// quality, Topic performance, Render health, and a tracking-health note.
// Returns { data: FunnelData, updatedAt }.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ADMIN_EMAILS = new Set([
  'josephsskaf@gmail.com',
  'josephskaf@gmail.com',
  'joseph-test@shortsforgeai.com',
])

export interface FunnelData {
  eventsAvailable: boolean
  period: string
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
    paidNoCredits: number
  }
  rates: {
    signupToVideo: string
    signupToPaid: string
    videoToPaid: string
    basicToPro: string
  }
  stripePayments: {
    checkoutCreated: number
    checkoutCompleted: number
    checkoutAbandoned: number
    checkoutOpen: number
    conversionRate: string
    recentFailedPayments: number
  }
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
  // ── #475 cohort analytics (gated by ?days=) ──────────────────────────────
  cohort: {
    signups: number
    createdVideo: number
    completedVideo: number
    checkoutClicked: number
    abandoned: number
    paid: number
  }
  funnelSteps: Array<{
    label: string
    count: number
    pctOfPrev: number
    pctOfSignups: number
    lossAbs: number
    lossPct: number
  }>
  biggestLeak: { label: string; stepLabel: string; lossPct: number; lossAbs: number } | null
  revenueLeaks: Array<{ label: string; count: number; action: string }>
  hotLeads: Array<{
    email: string
    score: number
    status: string
    videos: number
    checkoutClicked: boolean
    abandoned: boolean
    source: string
    country: string
  }>
  sourceQuality: Array<{
    source: string
    signups: number
    activated: number
    paid: number
    activationRate: string
    signupToPaid: string
  }>
  topicPerformance: Array<{ topic: string; videos: number; users: number }>
  renderHealth: Array<{ engine: string; total: number; completed: number; failed: number; completionRate: string }>
  trackingHealth: { eventsTableMissing: boolean; note: string; lastVideoAt: string | null; lastClickAt: string | null; lastAbandonedAt: string | null }
}

function pct(num: number, denom: number): string {
  if (!denom || denom <= 0) return '—'
  const r = (num / denom) * 100
  if (!Number.isFinite(r)) return '—'
  return `${r.toFixed(1)}%`
}
function ratio(num: number, denom: number): number {
  if (!denom || denom <= 0) return 0
  const r = num / denom
  return Number.isFinite(r) ? r : 0
}
function maxIso(rows: Array<string | null | undefined>): string | null {
  let best: number | null = null
  let bestIso: string | null = null
  for (const iso of rows) {
    if (!iso) continue
    const t = new Date(iso).getTime()
    if (!Number.isFinite(t)) continue
    if (best === null || t > best) { best = t; bestIso = iso }
  }
  return bestIso
}

type ProfileRow = {
  id: string; email: string | null; created_at: string | null; is_pro: boolean | null
  plan: string | null; stripe_subscription_id: string | null; video_credits: number | null
  utm_source: string | null; signup_country: string | null
}
type VideoRow = { user_id: string | null; status: string | null; quality_mode: string | null; topic: string | null; niche: string | null; created_at: string | null }

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url)
    const daysParam = searchParams.get('days') ?? '30'
    const days = new Set(['1', '7', '14', '30', 'all']).has(daysParam) ? daysParam : '30'

    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000
    const cohortCutoff = days === 'all' ? 0 : now - Number(days) * 24 * 60 * 60 * 1000

    // ── auth.users (all-time growth counters) ──────────────────────────────
    const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const authUsers = authData?.users ?? []
    let newThisWeek = 0, newThisMonth = 0
    for (const u of authUsers) {
      const t = u.created_at ? new Date(u.created_at).getTime() : 0
      if (t >= weekAgo) newThisWeek++
      if (t >= monthAgo) newThisMonth++
    }
    const totalUsers = authUsers.length

    // ── profiles (plans + cohort) ──────────────────────────────────────────
    let proUsers = 0, basicUsers = 0, paidNoCredits = 0
    let allProfiles: ProfileRow[] = []
    try {
      const { data: profs } = await admin
        .from('profiles')
        .select('id,email,created_at,is_pro,plan,stripe_subscription_id,video_credits,utm_source,signup_country')
        .limit(5000)
      if (Array.isArray(profs)) {
        allProfiles = profs as ProfileRow[]
        for (const row of allProfiles) {
          const p = (row.plan ?? (row.is_pro ? 'pro' : null) ?? '').toLowerCase()
          if (p === 'pro') proUsers++
          else if (p === 'basic') basicUsers++
          if ((p === 'pro' || p === 'basic') && (!row.video_credits || row.video_credits <= 0)) paidNoCredits++
        }
      }
    } catch { /* ignore */ }
    const freeUsers = totalUsers - proUsers - basicUsers
    const paidUsers = proUsers + basicUsers

    // ── videos ──────────────────────────────────────────────────────────────
    let totalVideos = 0, videosThisWeek = 0
    const userWithVideoSet = new Set<string>()
    let allVideos: VideoRow[] = []
    try {
      const { data: vids } = await admin
        .from('videos')
        .select('user_id,status,quality_mode,topic,niche,created_at')
        .limit(5000)
      if (Array.isArray(vids)) {
        allVideos = vids as VideoRow[]
        for (const row of allVideos) {
          totalVideos++
          if (row.user_id) userWithVideoSet.add(row.user_id)
          if (row.created_at && new Date(row.created_at).getTime() >= weekAgo) videosThisWeek++
        }
      }
    } catch { /* ignore */ }
    const usersWithVideos = userWithVideoSet.size

    const rates = {
      signupToVideo: pct(usersWithVideos, totalUsers),
      signupToPaid: pct(paidUsers, totalUsers),
      videoToPaid: pct(paidUsers, usersWithVideos),
      basicToPro: pct(proUsers, paidUsers),
    }

    // ── click_events + checkout_abandoned (cohort signals) ──────────────────
    let allClicks: Array<{ user_id: string | null; created_at: string | null }> = []
    let allAbandoned: Array<{ user_id: string | null; expired_at: string | null }> = []
    try {
      const { data } = await admin.from('click_events').select('user_id,created_at').limit(5000)
      if (Array.isArray(data)) allClicks = data as typeof allClicks
    } catch { /* ignore */ }
    try {
      const { data } = await admin.from('checkout_abandoned').select('user_id,expired_at').limit(5000)
      if (Array.isArray(data)) allAbandoned = data as typeof allAbandoned
    } catch { /* ignore */ }

    // ── COHORT (signups in period, excluding admin/test) ────────────────────
    const cohort = allProfiles.filter((p) => {
      const e = (p.email ?? '').toLowerCase()
      if (ADMIN_EMAILS.has(e)) return false
      if (days === 'all') return true
      const t = p.created_at ? new Date(p.created_at).getTime() : 0
      return t >= cohortCutoff
    })
    const cohortIds = new Set(cohort.map((p) => p.id))

    const videoCountByUser = new Map<string, number>()
    const completedByUser = new Map<string, number>()
    for (const v of allVideos) {
      if (!v.user_id || !cohortIds.has(v.user_id)) continue
      videoCountByUser.set(v.user_id, (videoCountByUser.get(v.user_id) ?? 0) + 1)
      if (v.status === 'completed') completedByUser.set(v.user_id, (completedByUser.get(v.user_id) ?? 0) + 1)
    }
    const clickUserSet = new Set<string>()
    for (const c of allClicks) if (c.user_id && cohortIds.has(c.user_id)) clickUserSet.add(c.user_id)
    const abandonedUserSet = new Set<string>()
    for (const a of allAbandoned) if (a.user_id && cohortIds.has(a.user_id)) abandonedUserSet.add(a.user_id)
    const isPaid = (p: ProfileRow) => p.is_pro === true || (p.plan != null && p.plan !== 'free') || p.stripe_subscription_id != null
    const paidUserSet = new Set<string>()
    for (const p of cohort) if (isPaid(p)) paidUserSet.add(p.id)

    const signups = cohort.length
    let createdVideo = 0, completedVideo = 0
    for (const id of cohortIds) {
      if ((videoCountByUser.get(id) ?? 0) >= 1) createdVideo++
      if ((completedByUser.get(id) ?? 0) >= 1) completedVideo++
    }
    const checkoutClicked = clickUserSet.size
    const abandoned = abandonedUserSet.size
    const paidCohort = paidUserSet.size

    const stepDefs = [
      { label: 'Signup', count: signups },
      { label: 'Created Video', count: createdVideo },
      { label: 'Completed Video', count: completedVideo },
      { label: 'Checkout Clicked', count: checkoutClicked },
      { label: 'Paid', count: paidCohort },
    ]
    const funnelSteps = stepDefs.map((step, i) => {
      const prev = i === 0 ? step.count : stepDefs[i - 1].count
      const lossAbs = i === 0 ? 0 : Math.max(0, prev - step.count)
      return {
        label: step.label,
        count: step.count,
        pctOfPrev: i === 0 ? 1 : ratio(step.count, prev),
        pctOfSignups: ratio(step.count, signups),
        lossAbs,
        lossPct: i === 0 ? 0 : ratio(lossAbs, prev),
      }
    })
    let leakIdx = -1, leakPct = -1
    for (let i = 1; i < funnelSteps.length; i++) {
      if (funnelSteps[i].lossPct > leakPct) { leakPct = funnelSteps[i].lossPct; leakIdx = i }
    }
    const biggestLeak = leakIdx > 0 ? {
      label: `${funnelSteps[leakIdx - 1].label} → ${funnelSteps[leakIdx].label}`,
      stepLabel: funnelSteps[leakIdx].label,
      lossPct: funnelSteps[leakIdx].lossPct,
      lossAbs: funnelSteps[leakIdx].lossAbs,
    } : null

    let signedNoVideo = 0, createdNoCheckout = 0, clickedNotPaid = 0, abandonedNotPaid = 0, powerNotPaid = 0
    for (const id of cohortIds) {
      const vids = videoCountByUser.get(id) ?? 0
      const hasClick = clickUserSet.has(id)
      const isAban = abandonedUserSet.has(id)
      const paidU = paidUserSet.has(id)
      if (vids === 0) signedNoVideo++
      if (vids >= 1 && !hasClick && !paidU) createdNoCheckout++
      if (hasClick && !paidU) clickedNotPaid++
      if (isAban && !paidU) abandonedNotPaid++
      if (vids >= 2 && !paidU) powerNotPaid++
    }
    const revenueLeaks = [
      { label: 'Signed up, no video', count: signedNoVideo, action: 'Send activation email' },
      { label: 'Created video, no checkout click', count: createdNoCheckout, action: 'Show stronger post-video paywall' },
      { label: 'Checkout clicked, not paid', count: clickedNotPaid, action: 'Send FOUNDING50 offer' },
      { label: 'Abandoned checkout, not paid', count: abandonedNotPaid, action: 'Send checkout recovery' },
      { label: 'Created 2+ videos, not paid', count: powerNotPaid, action: 'Manual founder message' },
    ]

    const classify = (s: number) => (s >= 100 ? 'Very Hot' : s >= 60 ? 'Hot' : s >= 30 ? 'Warm' : 'Cold')
    const hotLeads = cohort
      .filter((p) => !paidUserSet.has(p.id))
      .map((p) => {
        const vids = videoCountByUser.get(p.id) ?? 0
        const hasClick = clickUserSet.has(p.id)
        const isAban = abandonedUserSet.has(p.id)
        const score = 5 + (vids >= 1 ? 20 : 0) + (vids >= 2 ? 40 : 0) + (hasClick ? 30 : 0) + (isAban ? 50 : 0)
        return {
          email: p.email ?? '—', score, status: classify(score), videos: vids,
          checkoutClicked: hasClick, abandoned: isAban,
          source: p.utm_source || 'direct', country: p.signup_country || '—',
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 25)

    const srcMap = new Map<string, { source: string; signups: number; activated: number; paid: number }>()
    for (const p of cohort) {
      const src = p.utm_source || 'direct'
      let agg = srcMap.get(src)
      if (!agg) { agg = { source: src, signups: 0, activated: 0, paid: 0 }; srcMap.set(src, agg) }
      agg.signups++
      if ((videoCountByUser.get(p.id) ?? 0) >= 1) agg.activated++
      if (paidUserSet.has(p.id)) agg.paid++
    }
    const sourceQuality = Array.from(srcMap.values())
      .map((s) => ({ ...s, activationRate: pct(s.activated, s.signups), signupToPaid: pct(s.paid, s.signups) }))
      .sort((a, b) => b.signups - a.signups)

    const topicMap = new Map<string, { topic: string; videos: number; users: Set<string> }>()
    for (const v of allVideos) {
      if (!v.user_id || !cohortIds.has(v.user_id)) continue
      const topic = v.topic || v.niche || '—'
      let agg = topicMap.get(topic)
      if (!agg) { agg = { topic, videos: 0, users: new Set() }; topicMap.set(topic, agg) }
      agg.videos++; agg.users.add(v.user_id)
    }
    const topicPerformance = Array.from(topicMap.values())
      .map((t) => ({ topic: t.topic, videos: t.videos, users: t.users.size }))
      .sort((a, b) => b.videos - a.videos)
      .slice(0, 15)

    const engMap = new Map<string, { engine: string; total: number; completed: number; failed: number }>()
    for (const v of allVideos) {
      if (!v.user_id || !cohortIds.has(v.user_id)) continue
      const engine = v.quality_mode || 'fast'
      let agg = engMap.get(engine)
      if (!agg) { agg = { engine, total: 0, completed: 0, failed: 0 }; engMap.set(engine, agg) }
      agg.total++
      if (v.status === 'completed') { agg.completed++ } else { agg.failed++ }
    }
    const renderHealth = Array.from(engMap.values())
      .map((e) => ({ ...e, completionRate: pct(e.completed, e.total) }))
      .sort((a, b) => b.total - a.total)

    const trackingHealth = {
      eventsTableMissing: true,
      note: 'public.events is not in production — granular event steps (onboarding viewed, paywall viewed) are not tracked yet. This dashboard is computed from profiles/videos/click_events/checkout_abandoned.',
      lastVideoAt: maxIso(allVideos.map((v) => v.created_at)),
      lastClickAt: maxIso(allClicks.map((c) => c.created_at)),
      lastAbandonedAt: maxIso(allAbandoned.map((a) => a.expired_at)),
    }

    // ── Stripe checkout funnel (all-time, real Stripe API) ──────────────────
    let checkoutCreated = 0, checkoutCompleted = 0, checkoutAbandoned = 0, checkoutOpen = 0, recentFailedPayments = 0
    try {
      if (process.env.STRIPE_SECRET_KEY) {
        const sessions = await stripe.checkout.sessions.list({ limit: 100 })
        for (const s of sessions.data) {
          checkoutCreated++
          if (s.status === 'complete') checkoutCompleted++
          else if (s.status === 'expired') checkoutAbandoned++
          else if (s.status === 'open') checkoutOpen++
        }
        try {
          const failedInvoices = await stripe.invoices.list({ limit: 100, status: 'uncollectible' })
          recentFailedPayments = failedInvoices.data.filter((inv) => inv.created * 1000 >= monthAgo).length
        } catch { /* ignore */ }
      }
    } catch (stripeErr) {
      console.warn('[admin/funnel] Stripe query failed:', stripeErr instanceof Error ? stripeErr.message : String(stripeErr))
    }
    const stripePayments = {
      checkoutCreated, checkoutCompleted, checkoutAbandoned, checkoutOpen,
      conversionRate: pct(checkoutCompleted, checkoutCompleted + checkoutAbandoned),
      recentFailedPayments,
    }

    const data: FunnelData = {
      eventsAvailable: false,
      period: days,
      realStats: { totalUsers, newThisWeek, newThisMonth, proUsers, basicUsers, freeUsers, usersWithVideos, totalVideos, videosThisWeek, paidNoCredits },
      rates,
      stripePayments,
      counts: {
        homepage_view: 0, generate_page_view: 0, analyze_idea_clicked: 0,
        video_generation_started: 0, video_generation_completed: 0, video_generation_failed: 0,
        pricing_view: 0, basic_checkout_clicked: 0, pro_checkout_clicked: 0, payment_success: 0, checkout_cancelled: 0,
      },
      cohort: { signups, createdVideo, completedVideo, checkoutClicked, abandoned, paid: paidCohort },
      funnelSteps, biggestLeak, revenueLeaks, hotLeads, sourceQuality, topicPerformance, renderHealth, trackingHealth,
    }

    return NextResponse.json({ data, updatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[admin/funnel] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
