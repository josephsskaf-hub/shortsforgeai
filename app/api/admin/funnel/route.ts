// Admin Funnel API — real-data growth dashboard.
//
// Everything here is computed from live tables plus verified Stripe state:
// auth.users + profiles + videos + events + click_events +
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
import { INTERNAL_ACCOUNTS_LABEL, isInternalEmail } from '@/lib/internalAccounts'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ADMIN_EMAILS = new Set([
  'josephsskaf@gmail.com',
  'josephskaf@gmail.com',
  'joseph-test@shortsforgeai.com',
])

export interface FunnelData {
  scopeLabel: string
  eventsAvailable: boolean
  period: string
  realStats: {
    totalUsers: number
    newThisWeek: number
    newThisMonth: number
    proUsers: number
    basicUsers: number
    starterUsers?: number
    unknownPaidUsers?: number
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
    starter_checkout_clicked?: number
    checkout_attempted?: number
    checkout_started?: number
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
  plan: string | null; stripe_subscription_id: string | null; stripe_customer_id: string | null
  video_credits: number | null; utm_source: string | null; signup_utm_source: string | null
  signup_referrer: string | null; signup_country: string | null
}
type VideoRow = { user_id: string | null; status: string | null; quality_mode: string | null; topic: string | null; niche: string | null; created_at: string | null }
type EventRow = {
  name: string
  user_id: string | null
  created_at: string | null
  session_id: string | null
  metadata: Record<string, unknown> | null
}

type PaidTier = 'starter' | 'basic' | 'pro' | 'unknown'

function normalizeTier(raw: unknown): PaidTier {
  const value = typeof raw === 'string' ? raw.toLowerCase().replace(/_trial$/, '') : ''
  if (value === 'starter') return 'starter'
  if (value === 'basic' || value === 'creator') return 'basic'
  if (value === 'pro' || value === 'studio') return 'pro'
  return 'unknown'
}

function sourceForProfile(profile: ProfileRow): string {
  const explicit = (profile.signup_utm_source || profile.utm_source || '').trim().toLowerCase()
  if (explicit) return explicit

  const referrer = (profile.signup_referrer || '').trim()
  if (!referrer) return 'direct'
  try {
    return new URL(referrer).hostname.replace(/^www\./, '').toLowerCase() || 'direct'
  } catch {
    return referrer.slice(0, 80).toLowerCase()
  }
}

function objectId(value: string | { id: string } | null): string | null {
  if (typeof value === 'string') return value
  return value?.id ?? null
}

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
    const rawAuthUsers = authData?.users ?? []

    // ── profiles (plans + cohort) ──────────────────────────────────────────
    let allProfiles: ProfileRow[] = []
    try {
      const { data: profs } = await admin
        .from('profiles')
        .select('id,email,created_at,is_pro,plan,stripe_subscription_id,stripe_customer_id,video_credits,utm_source,signup_utm_source,signup_referrer,signup_country')
        .limit(5000)
      if (Array.isArray(profs)) {
        allProfiles = profs as ProfileRow[]
      }
    } catch { /* ignore */ }

    // One shared exclusion list protects every metric below. Auth catches
    // internal accounts even when their profile e-mail is missing; profiles
    // catch legacy/test rows whose auth e-mail is unavailable.
    const internalUserIds = new Set<string>()
    for (const userRow of rawAuthUsers) {
      if (isInternalEmail(userRow.email)) internalUserIds.add(userRow.id)
    }
    for (const profile of allProfiles) {
      if (isInternalEmail(profile.email)) internalUserIds.add(profile.id)
    }
    const authUsers = rawAuthUsers.filter((userRow) => !internalUserIds.has(userRow.id))
    const externalProfiles = allProfiles.filter((profile) => !internalUserIds.has(profile.id))
    const externalKnownUserIds = new Set<string>([
      ...authUsers.map((userRow) => userRow.id),
      ...externalProfiles.map((profile) => profile.id),
    ])

    let newThisWeek = 0, newThisMonth = 0
    for (const userRow of authUsers) {
      const t = userRow.created_at ? new Date(userRow.created_at).getTime() : 0
      if (t >= weekAgo) newThisWeek++
      if (t >= monthAgo) newThisMonth++
    }
    const totalUsers = authUsers.length

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
        allVideos = (vids as VideoRow[]).filter((row) => Boolean(row.user_id && externalKnownUserIds.has(row.user_id)))
        for (const row of allVideos) {
          totalVideos++
          if (row.user_id) userWithVideoSet.add(row.user_id)
          if (row.created_at && new Date(row.created_at).getTime() >= weekAgo) videosThisWeek++
        }
      }
    } catch { /* ignore */ }
    const usersWithVideos = userWithVideoSet.size

    // ── click_events + checkout_abandoned (cohort signals) ──────────────────
    let allClicks: Array<{ user_id: string | null; created_at: string | null; plan: string | null }> = []
    let allAbandoned: Array<{ user_id: string | null; expired_at: string | null; tier: string | null }> = []
    try {
      const { data } = await admin.from('click_events').select('user_id,created_at,plan').limit(5000)
      if (Array.isArray(data)) {
        // Legacy one-time Starter Pack clicks had plan=null. Current recurring
        // Starter attempts are recorded server-side in public.events.
        allClicks = (data as typeof allClicks).filter((row) =>
          (!row.user_id || !internalUserIds.has(row.user_id)) &&
          (row.plan === 'basic' || row.plan === 'pro')
        )
      }
    } catch { /* ignore */ }
    try {
      const { data } = await admin.from('checkout_abandoned').select('user_id,expired_at,tier').limit(5000)
      if (Array.isArray(data)) {
        allAbandoned = (data as typeof allAbandoned).filter((row) =>
          (!row.user_id || !internalUserIds.has(row.user_id)) &&
          (row.tier === 'starter' || row.tier === 'basic' || row.tier === 'pro')
        )
      }
    } catch { /* ignore */ }

    // public.events is live in production. Exact per-name counts avoid the
    // PostgREST 1,000-row response cap, while the smaller identity query is
    // used to join checkout/payment activity back to cohort users.
    const trackedEventNames = [
      'homepage_view', 'generate_page_view', 'analyze_idea_clicked',
      'generate_started', 'video_generation_started',
      'generate_completed', 'video_generation_completed',
      'generate_failed', 'video_generation_failed',
      'pricing_view', 'basic_checkout_clicked', 'checkout_basic_click',
      'pro_checkout_clicked', 'checkout_pro_click', 'starter_checkout_clicked',
      'starter_pack_checkout_clicked', 'checkout_attempted', 'checkout_started',
      'payment_success', 'checkout_cancelled', 'checkout_canceled',
    ]
    const identityEventNames = [
      'basic_checkout_clicked', 'checkout_basic_click', 'pro_checkout_clicked',
      'checkout_pro_click', 'starter_checkout_clicked', 'starter_pack_checkout_clicked',
      'checkout_attempted', 'checkout_started', 'payment_success',
    ]
    let eventsAvailable = false
    let eventRows: EventRow[] = []
    const eventCounts = new Map<string, number>()
    try {
      const probe = await admin.from('events').select('id', { head: true, count: 'exact' }).limit(1)
      eventsAvailable = !probe.error
      if (eventsAvailable) {
        const periodIso = days === 'all' ? null : new Date(cohortCutoff).toISOString()
        const externalEventFilter = internalUserIds.size > 0
          ? `user_id.is.null,user_id.not.in.(${Array.from(internalUserIds).join(',')})`
          : null
        const countResults = await Promise.all(trackedEventNames.map(async (name) => {
          let query = admin.from('events').select('id', { head: true, count: 'exact' }).eq('name', name)
          if (periodIso) query = query.gte('created_at', periodIso)
          if (externalEventFilter) query = query.or(externalEventFilter)
          const result = await query
          return { name, count: result.error ? 0 : (result.count ?? 0) }
        }))
        for (const row of countResults) eventCounts.set(row.name, row.count)

        let identityQuery = admin
          .from('events')
          .select('name,user_id,created_at,session_id,metadata')
          .in('name', identityEventNames)
          .order('created_at', { ascending: false })
          .limit(5000)
        if (periodIso) identityQuery = identityQuery.gte('created_at', periodIso)
        if (externalEventFilter) identityQuery = identityQuery.or(externalEventFilter)
        const identities = await identityQuery
        if (!identities.error && Array.isArray(identities.data)) {
          eventRows = (identities.data as unknown as EventRow[])
            .filter((row) => !row.user_id || !internalUserIds.has(row.user_id))
        }
      }
    } catch {
      eventsAvailable = false
    }

    const profileById = new Map(allProfiles.map((p) => [p.id, p]))
    const profileBySubscriptionId = new Map(
      allProfiles.filter((p) => p.stripe_subscription_id).map((p) => [p.stripe_subscription_id as string, p])
    )
    const profileByCustomerId = new Map(
      allProfiles.filter((p) => p.stripe_customer_id).map((p) => [p.stripe_customer_id as string, p])
    )

    // Stripe is the source of truth for current subscribers and completed
    // checkouts. A profile flag or a stored subscription id is never enough.
    let stripeSessionsAvailable = false
    let stripeSubscriptionsAvailable = false
    let stripeSessions: Stripe.Checkout.Session[] = []
    let stripeSubscriptions: Stripe.Subscription[] = []
    let recentFailedInvoices: Stripe.Invoice[] = []
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        let startingAfter: string | undefined
        for (let page = 0; page < 50; page++) {
          const params: Stripe.Checkout.SessionListParams = { limit: 100 }
          if (days !== 'all') params.created = { gte: Math.floor(cohortCutoff / 1000) }
          if (startingAfter) params.starting_after = startingAfter
          const batch = await stripe.checkout.sessions.list(params)
          stripeSessions.push(...batch.data)
          if (!batch.has_more || batch.data.length === 0) break
          startingAfter = batch.data[batch.data.length - 1].id
        }
        stripeSessionsAvailable = true
      } catch (stripeErr) {
        console.warn('[admin/funnel] Stripe sessions query failed:', stripeErr instanceof Error ? stripeErr.message : String(stripeErr))
      }
      try {
        let startingAfter: string | undefined
        for (let page = 0; page < 50; page++) {
          const batch = await stripe.subscriptions.list({ status: 'all', limit: 100, ...(startingAfter ? { starting_after: startingAfter } : {}) })
          stripeSubscriptions.push(...batch.data)
          if (!batch.has_more || batch.data.length === 0) break
          startingAfter = batch.data[batch.data.length - 1].id
        }
        stripeSubscriptionsAvailable = true
      } catch (stripeErr) {
        console.warn('[admin/funnel] Stripe subscriptions query failed:', stripeErr instanceof Error ? stripeErr.message : String(stripeErr))
      }
      try {
        const failedInvoices = await stripe.invoices.list({ limit: 100, status: 'uncollectible' })
        recentFailedInvoices = failedInvoices.data.filter((inv) => inv.created * 1000 >= monthAgo)
      } catch { /* ignore */ }
    }

    const userIdForSession = (session: Stripe.Checkout.Session): string | null => {
      const metadataId = session.metadata?.supabase_user_id
      if (metadataId && profileById.has(metadataId)) return metadataId
      const customerId = objectId(session.customer)
      return customerId ? profileByCustomerId.get(customerId)?.id ?? null : null
    }
    const externalSubscriptionSessions = stripeSessions.filter((session) => {
      if (session.mode !== 'subscription') return false
      const sessionUserId = userIdForSession(session)
      const sessionEmail = session.customer_details?.email || session.customer_email || null
      if (sessionUserId && internalUserIds.has(sessionUserId)) return false
      if (isInternalEmail(sessionEmail)) return false
      return Boolean(
        (sessionUserId && externalKnownUserIds.has(sessionUserId)) ||
        sessionEmail
      )
    })
    const recentFailedPayments = recentFailedInvoices.filter((invoice) => {
      const customerId = objectId(invoice.customer)
      const profile = customerId ? profileByCustomerId.get(customerId) : undefined
      const invoiceEmail = invoice.customer_email || profile?.email || null
      if (profile && internalUserIds.has(profile.id)) return false
      return !isInternalEmail(invoiceEmail)
    }).length

    const activeTierByUser = new Map<string, PaidTier>()
    const tierRank: Record<PaidTier, number> = { unknown: 0, starter: 1, basic: 2, pro: 3 }
    for (const subscription of stripeSubscriptions) {
      if (subscription.status !== 'active' && subscription.status !== 'trialing') continue
      const customerId = objectId(subscription.customer)
      const profile = profileBySubscriptionId.get(subscription.id) || (customerId ? profileByCustomerId.get(customerId) : undefined)
      const userId = subscription.metadata?.supabase_user_id || profile?.id || null
      if (!userId || !externalKnownUserIds.has(userId) || internalUserIds.has(userId)) continue
      const verifiedProfile = profileById.get(userId)
      if (isInternalEmail(verifiedProfile?.email)) continue
      const tier = normalizeTier(subscription.metadata?.tier || verifiedProfile?.plan || profile?.plan)
      const previous = activeTierByUser.get(userId)
      if (!previous || tierRank[tier] > tierRank[previous]) activeTierByUser.set(userId, tier)
    }
    const activePaidUserSet = new Set(activeTierByUser.keys())
    let starterUsers = 0, basicUsers = 0, proUsers = 0, unknownPaidUsers = 0, paidNoCredits = 0
    for (const [userId, tier] of activeTierByUser) {
      if (tier === 'starter') starterUsers++
      else if (tier === 'basic') basicUsers++
      else if (tier === 'pro') proUsers++
      else unknownPaidUsers++
      const profile = profileById.get(userId)
      if (!profile?.video_credits || profile.video_credits <= 0) paidNoCredits++
    }
    const paidUsers = activePaidUserSet.size
    const freeUsers = Math.max(0, totalUsers - paidUsers)
    const rates = {
      signupToVideo: pct(usersWithVideos, totalUsers),
      signupToPaid: pct(paidUsers, totalUsers),
      videoToPaid: pct(paidUsers, usersWithVideos),
      basicToPro: pct(proUsers, proUsers + basicUsers),
    }

    let checkoutCreated = 0, checkoutCompleted = 0, checkoutAbandoned = 0, checkoutOpen = 0
    for (const session of externalSubscriptionSessions) {
      checkoutCreated++
      if (session.status === 'complete') checkoutCompleted++
      else if (session.status === 'expired') checkoutAbandoned++
      else if (session.status === 'open') checkoutOpen++
    }
    const stripePayments = {
      checkoutCreated, checkoutCompleted, checkoutAbandoned, checkoutOpen,
      conversionRate: pct(checkoutCompleted, checkoutCompleted + checkoutAbandoned),
      recentFailedPayments,
    }

    // ── COHORT (signups in period, excluding admin/test) ────────────────────
    const cohort = externalProfiles.filter((p) => {
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
    for (const event of eventRows) {
      if (event.name === 'payment_success') continue
      if (event.user_id && cohortIds.has(event.user_id)) clickUserSet.add(event.user_id)
    }
    const abandonedUserSet = new Set<string>()
    for (const a of allAbandoned) if (a.user_id && cohortIds.has(a.user_id)) abandonedUserSet.add(a.user_id)
    const paidUserSet = new Set<string>()
    for (const id of activePaidUserSet) if (cohortIds.has(id)) paidUserSet.add(id)
    for (const event of eventRows) {
      if (event.name !== 'payment_success') continue
      const metadata = event.metadata ?? {}
      const isSubscription = metadata.checkout_mode === 'subscription' ||
        (typeof metadata.stripe_subscription_id === 'string' && metadata.stripe_subscription_id.length > 0) ||
        (typeof metadata.tier === 'string' && !metadata.pack)
      if (!isSubscription) continue
      const eventUserId = event.user_id || (typeof metadata.supabase_user_id === 'string' ? metadata.supabase_user_id : null)
      if (eventUserId && cohortIds.has(eventUserId)) paidUserSet.add(eventUserId)
    }
    for (const session of externalSubscriptionSessions) {
      if (session.status !== 'complete') continue
      if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') continue
      const sessionUserId = userIdForSession(session)
      if (sessionUserId && cohortIds.has(sessionUserId)) paidUserSet.add(sessionUserId)
    }
    // A verified payment necessarily reached checkout, even if an older
    // client-side click beacon was lost during navigation.
    for (const id of paidUserSet) clickUserSet.add(id)

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
      { label: 'Checkout clicked, not paid', count: clickedNotPaid, action: 'Send transparent checkout recovery' },
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
          source: sourceForProfile(p), country: p.signup_country || '—',
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 25)

    const srcMap = new Map<string, { source: string; signups: number; activated: number; paid: number }>()
    for (const p of cohort) {
      const src = sourceForProfile(p)
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
      eventsTableMissing: !eventsAvailable,
      note: eventsAvailable
        ? (stripeSubscriptionsAvailable
            ? 'Events are live; subscriber counts are verified against active/trialing Stripe subscriptions.'
            : 'Events are live, but Stripe subscription verification is temporarily unavailable.')
        : 'public.events could not be queried; granular event counts are temporarily unavailable.',
      lastVideoAt: maxIso(allVideos.map((v) => v.created_at)),
      lastClickAt: maxIso([...allClicks.map((c) => c.created_at), ...eventRows.map((event) => event.created_at)]),
      lastAbandonedAt: maxIso(allAbandoned.map((a) => a.expired_at)),
    }

    // Stripe checkout funnel is already range-filtered by the selected period.
    const data: FunnelData = {
      scopeLabel: INTERNAL_ACCOUNTS_LABEL,
      eventsAvailable,
      period: days,
      realStats: { totalUsers, newThisWeek, newThisMonth, proUsers, basicUsers, starterUsers, unknownPaidUsers, freeUsers, usersWithVideos, totalVideos, videosThisWeek, paidNoCredits },
      rates,
      stripePayments,
      counts: {
        homepage_view: eventCounts.get('homepage_view') ?? 0,
        generate_page_view: eventCounts.get('generate_page_view') ?? 0,
        analyze_idea_clicked: eventCounts.get('analyze_idea_clicked') ?? 0,
        // Both aliases are emitted together today; max avoids double-counting
        // while retaining history from either instrumentation generation.
        video_generation_started: Math.max(eventCounts.get('generate_started') ?? 0, eventCounts.get('video_generation_started') ?? 0),
        video_generation_completed: Math.max(eventCounts.get('generate_completed') ?? 0, eventCounts.get('video_generation_completed') ?? 0),
        video_generation_failed: Math.max(eventCounts.get('generate_failed') ?? 0, eventCounts.get('video_generation_failed') ?? 0),
        pricing_view: eventCounts.get('pricing_view') ?? 0,
        basic_checkout_clicked: (eventCounts.get('basic_checkout_clicked') ?? 0) + (eventCounts.get('checkout_basic_click') ?? 0),
        pro_checkout_clicked: (eventCounts.get('pro_checkout_clicked') ?? 0) + (eventCounts.get('checkout_pro_click') ?? 0),
        starter_checkout_clicked: (eventCounts.get('starter_checkout_clicked') ?? 0) + (eventCounts.get('starter_pack_checkout_clicked') ?? 0),
        checkout_attempted: eventCounts.get('checkout_attempted') ?? 0,
        checkout_started: eventCounts.get('checkout_started') ?? 0,
        payment_success: stripeSessionsAvailable ? checkoutCompleted : (eventCounts.get('payment_success') ?? 0),
        checkout_cancelled: (eventCounts.get('checkout_cancelled') ?? 0) + (eventCounts.get('checkout_canceled') ?? 0),
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
