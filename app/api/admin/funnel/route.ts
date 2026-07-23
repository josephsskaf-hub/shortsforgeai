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
import { acquisitionSource, hasCorrectableSelfReferral } from '@/lib/acquisitionSource'
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
    auth_callback_completed?: number
    auth_callback_failed?: number
    email_signup_completed?: number
    generate_arrived_server?: number
    generate_activation_auth_missing?: number
    analyze_idea_clicked: number
    video_generation_started: number
    video_generation_completed: number
    video_generation_failed: number
    pricing_view: number
    basic_checkout_clicked: number
    pro_checkout_clicked: number
    starter_checkout_clicked?: number
    checkout_attempted?: number
    checkout_attempted_raw?: number
    checkout_authenticated_attempted?: number
    checkout_auth_required?: number
    checkout_auth_required_raw?: number
    checkout_auth_page_view?: number
    checkout_auth_method_selected?: number
    checkout_auth_confirmation_required?: number
    checkout_auth_completed?: number
    checkout_auth_callback_completed?: number
    checkout_unidentified_requests?: number
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
  acquisitionAttribution: {
    attributedSignups: number
    attributedActivated: number
    attributedPaid: number
    directOrUnknownSignups: number
    correctedSelfReferrals: number
    topSource: string | null
    topSourceSignups: number
  }
  firstVideoOnboarding: {
    views: number
    primaryClicks: number
    skips: number
    dispatched: number
    completed: number
    failed: number
    viewToClickRate: string
    clickToDispatchRate: string
    dispatchToCompleteRate: string
  }
  repeatCreatorOffer: {
    views: number
    clicks: number
    checkoutStarts: number
    activeSubscribers: number
    viewToClickRate: string
    clickToCheckoutRate: string
    checkoutToPaidRate: string
  }
  organicRecovery: {
    landingSessions: number
    ctaClicks: number
    ctaRate: string
    viralNowViews: number
    viralNowClicks: number
    viralNowViewToClickRate: string
    signups: number
    signupRate: string
    activated: number
    activationRate: string
    paid: number
    topLandingPages: Array<{ path: string; sessions: number }>
  }
  postVideoOffer: {
    offerViews: number
    watermarkedDownloads: number
    cleanExportClicks: number
    checkoutStarts: number
    payments: number
    viewToClickRate: string
    clickToCheckoutRate: string
    checkoutToPaidRate: string
  }
  creatorLoop: {
    completedVideos: number
    completedCreators: number
    deliveryPromptActors: number
    deliveryClickActors: number
    deliveryShareActors: number
    deliveryPromptToClickRate: string
    deliveryClickToShareRate: string
    deliveryPublicLandings: number
    deliveryPublicCtaClicks: number
    shareClicks: number
    shareUsers: number
    shareRate: string
    sharesCompleted: number
    publicVideoLandings: number
    publicVideoCtaClicks: number
    landingToCtaRate: string
    referredSignups: number
    ctaToSignupRate: string
    qualifiedReferrals: number
    referredPaid: number
    signupToPaidRate: string
  }
  retentionLoop: {
    completedCreators: number
    oneAndDoneCreators: number
    repeatCreators: number
    secondVideoRate: string
    repeatWithin7dCreators: number
    laterDayReturnCreators: number
    laterDayReturnRate: string
    continuationClicks: number
    continuationLandings: number
    continuationStarts: number
    continuationCompletes: number
    clickToStartRate: string
    startToCompleteRate: string
  }
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

const ORGANIC_EXACT_PATHS = new Set([
  '/youtube-shorts-from-topic',
  '/cheapest-ai-shorts-maker',
  '/ai-shorts-without-filming',
  '/faceless-channel-ideas',
  '/free-ai-shorts-generator',
  '/faceless-video-generator',
  '/text-to-video-shorts',
  '/from-saashub',
  '/free-ai-shorts',
  '/alternatives',
  '/free-script-generator',
  '/free-hook-generator',
  '/viral-score',
  '/viral-now',
  '/ai-avatar',
  '/facts',
  '/pt',
])

function isOrganicLandingPath(path: string | null | undefined): path is string {
  if (!path) return false
  return ORGANIC_EXACT_PATHS.has(path) ||
    path.startsWith('/free-ai-shorts/') ||
    path.startsWith('/alternatives/') ||
    path.startsWith('/pt/')
}

type ProfileRow = {
  id: string; email: string | null; created_at: string | null; is_pro: boolean | null
  plan: string | null; stripe_subscription_id: string | null; stripe_customer_id: string | null
  video_credits: number | null; utm_source: string | null; signup_utm_source: string | null
  signup_utm_medium: string | null; signup_utm_campaign: string | null
  signup_referrer: string | null; signup_country: string | null
  referred_by: string | null; referral_reward_granted: boolean | null; referral_count: number | null
}
type VideoRow = { user_id: string | null; status: string | null; quality_mode: string | null; topic: string | null; niche: string | null; created_at: string | null }
type EventRow = {
  name: string
  user_id: string | null
  created_at: string | null
  session_id: string | null
  metadata: Record<string, unknown> | null
  path?: string | null
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
  return acquisitionSource({
    utmSource: profile.signup_utm_source,
    legacyUtmSource: profile.utm_source,
    referrer: profile.signup_referrer,
  })
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
        .select('id,email,created_at,is_pro,plan,stripe_subscription_id,stripe_customer_id,video_credits,utm_source,signup_utm_source,signup_utm_medium,signup_utm_campaign,signup_referrer,signup_country,referred_by,referral_reward_granted,referral_count')
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
      'landing_session_started', 'organic_cta_clicked', 'organic_topic_submitted',
      'viral_now_viewed', 'viral_now_topic_clicked',
      'video_share_clicked', 'video_shared', 'video_share_channel_opened',
      'public_video_cta_clicked',
      'series_continue_clicked', 'series_continuation_landed',
      'auth_callback_completed', 'auth_callback_failed', 'email_signup_completed',
      'generate_arrived_server', 'generate_activation_auth_missing',
      'viral_onboarding_viewed', 'viral_onboarding_primary_clicked',
      'viral_onboarding_skipped', 'first_video_started_from_viral_onboarding',
      'first_video_generation_dispatched_from_viral_onboarding',
      'first_video_generation_completed_from_viral_onboarding',
      'first_video_generation_failed_from_viral_onboarding',
      'history_repeat_offer_viewed', 'history_repeat_offer_clicked',
      'generate_started', 'video_generation_started',
      'generate_completed', 'video_generation_completed',
      'generate_failed', 'video_generation_failed',
      'pricing_view', 'basic_checkout_clicked', 'checkout_basic_click',
      'pro_checkout_clicked', 'checkout_pro_click', 'starter_checkout_clicked',
      'starter_pack_checkout_clicked', 'checkout_attempted', 'checkout_auth_required',
      'checkout_auth_page_view', 'checkout_auth_method_selected',
      'checkout_auth_confirmation_required', 'checkout_auth_completed',
      'checkout_started',
      'payment_success', 'checkout_cancelled', 'checkout_canceled',
    ]
    const identityEventNames = [
      'basic_checkout_clicked', 'checkout_basic_click', 'pro_checkout_clicked',
      'checkout_pro_click', 'starter_checkout_clicked', 'starter_pack_checkout_clicked',
      'checkout_attempted', 'checkout_auth_required',
      'checkout_auth_page_view', 'checkout_auth_method_selected',
      'checkout_auth_confirmation_required', 'checkout_auth_completed',
      'auth_callback_completed', 'auth_callback_failed',
      'checkout_started', 'payment_success',
    ]
    let eventsAvailable = false
    let eventRows: EventRow[] = []
    let organicEventRows: EventRow[] = []
    let retentionEventRows: EventRow[] = []
    let postVideoEventRows: EventRow[] = []
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

        let postVideoQuery = admin
          .from('events')
          .select('name,user_id,created_at,session_id,metadata,path')
          .in('name', [
            'post_video_offer_viewed', 'post_video_clean_export_clicked',
            'video_downloaded',
            'checkout_started', 'payment_success',
          ])
          .order('created_at', { ascending: false })
          .limit(5000)
        if (periodIso) postVideoQuery = postVideoQuery.gte('created_at', periodIso)
        if (externalEventFilter) postVideoQuery = postVideoQuery.or(externalEventFilter)
        const postVideoEvents = await postVideoQuery
        if (!postVideoEvents.error && Array.isArray(postVideoEvents.data)) {
          postVideoEventRows = (postVideoEvents.data as unknown as EventRow[])
            .filter((row) => !row.user_id || !internalUserIds.has(row.user_id))
        }

        let organicQuery = admin
          .from('events')
          .select('name,user_id,created_at,session_id,metadata,path')
          .in('name', [
            'landing_session_started', 'organic_cta_clicked', 'organic_topic_submitted',
            'viral_now_viewed', 'viral_now_topic_clicked',
            'video_share_prompt_viewed', 'video_share_clicked', 'video_shared',
            'video_share_channel_opened', 'video_share_cancelled',
            'public_video_cta_clicked',
          ])
          .order('created_at', { ascending: false })
          .limit(5000)
        if (periodIso) organicQuery = organicQuery.gte('created_at', periodIso)
        if (externalEventFilter) organicQuery = organicQuery.or(externalEventFilter)
        const organicEvents = await organicQuery
        if (!organicEvents.error && Array.isArray(organicEvents.data)) {
          organicEventRows = (organicEvents.data as unknown as EventRow[])
            .filter((row) => !row.user_id || !internalUserIds.has(row.user_id))
        }

        let retentionQuery = admin
          .from('events')
          .select('name,user_id,created_at,session_id,metadata,path')
          .in('name', [
            'series_continue_clicked', 'series_continuation_landed',
            'generate_started', 'generate_completed',
            'viral_onboarding_viewed', 'viral_onboarding_primary_clicked',
            'viral_onboarding_skipped', 'first_video_started_from_viral_onboarding',
            'first_video_generation_dispatched_from_viral_onboarding',
            'first_video_generation_completed_from_viral_onboarding',
            'first_video_generation_failed_from_viral_onboarding',
            'history_repeat_offer_viewed', 'history_repeat_offer_clicked',
          ])
          .order('created_at', { ascending: false })
          .limit(5000)
        if (periodIso) retentionQuery = retentionQuery.gte('created_at', periodIso)
        if (externalEventFilter) retentionQuery = retentionQuery.or(externalEventFilter)
        const retentionEvents = await retentionQuery
        if (!retentionEvents.error && Array.isArray(retentionEvents.data)) {
          retentionEventRows = (retentionEvents.data as unknown as EventRow[])
            .filter((row) => !row.user_id || !internalUserIds.has(row.user_id))
        }
      }
    } catch {
      eventsAvailable = false
    }

    // Checkout requests made without either an authenticated user or the
    // browser event-session cookie cannot be tied to a visitor. Public link
    // checkers and QA probes routinely hit every plan URL, so raw row counts
    // are useful as diagnostics but must never be presented as buyer actors.
    const checkoutActorKey = (event: EventRow): string | null => {
      if (event.user_id) return `user:${event.user_id}`
      if (event.session_id) return `session:${event.session_id}`
      return null
    }
    const uniqueCheckoutActors = (
      name: string,
      predicate?: (event: EventRow) => boolean,
    ): number => new Set(
      eventRows
        .filter((event) => event.name === name && (!predicate || predicate(event)))
        .map(checkoutActorKey)
        .filter((actor): actor is string => actor !== null)
    ).size
    const checkoutUnidentifiedRequests = eventRows.filter((event) =>
      event.name === 'checkout_auth_required' && checkoutActorKey(event) === null
    ).length
    const checkoutAuthCallbackCompleted = new Set(
      eventRows
        .filter((event) =>
          event.name === 'auth_callback_completed' && event.metadata?.is_checkout_destination === true
        )
        .map(checkoutActorKey)
        .filter((actor): actor is string => actor !== null)
    ).size

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
    const checkoutIntentEvents = new Set([
      'basic_checkout_clicked', 'checkout_basic_click', 'pro_checkout_clicked',
      'checkout_pro_click', 'starter_checkout_clicked', 'starter_pack_checkout_clicked',
      'checkout_attempted', 'checkout_auth_required', 'checkout_auth_page_view',
      'checkout_auth_method_selected', 'checkout_auth_confirmation_required',
      'checkout_auth_completed', 'checkout_started',
    ])
    for (const event of eventRows) {
      if (!checkoutIntentEvents.has(event.name)) continue
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
    const attributedSources = sourceQuality.filter((source) => source.source !== 'direct')
    const topAttributedSource = attributedSources[0] ?? null
    const acquisitionAttribution = {
      attributedSignups: attributedSources.reduce((sum, source) => sum + source.signups, 0),
      attributedActivated: attributedSources.reduce((sum, source) => sum + source.activated, 0),
      attributedPaid: attributedSources.reduce((sum, source) => sum + source.paid, 0),
      directOrUnknownSignups: sourceQuality.find((source) => source.source === 'direct')?.signups ?? 0,
      correctedSelfReferrals: cohort.filter((profile) => hasCorrectableSelfReferral(profile.signup_referrer)).length,
      topSource: topAttributedSource?.source ?? null,
      topSourceSignups: topAttributedSource?.signups ?? 0,
    }

    const organicLandingRows = organicEventRows.filter((event) =>
      event.name === 'landing_session_started' && isOrganicLandingPath(event.path)
    )
    // PUSH #32 — a completed topic form is a stronger organic intent action
    // than a generic CTA click. Count both paths so the Search Console-led
    // experiment is visible without changing the established dashboard shape.
    const organicCtaRows = organicEventRows.filter((event) =>
      event.name === 'organic_cta_clicked' || event.name === 'organic_topic_submitted' ||
      event.name === 'viral_now_topic_clicked'
    )
    const viralNowEventRows = organicEventRows.filter((event) => {
      const campaign = event.metadata?.campaign
      return typeof campaign === 'string' && campaign.toLowerCase() === 'push39_viral_now'
    })
    const uniqueViralNowActors = (name: 'viral_now_viewed' | 'viral_now_topic_clicked'): number => {
      const rows = viralNowEventRows.filter((event) => event.name === name)
      return new Set(rows.map((event, index) =>
        event.user_id || event.session_id || `${event.created_at ?? 'unknown'}:${index}`
      )).size
    }
    const viralNowViews = uniqueViralNowActors('viral_now_viewed')
    const viralNowClicks = uniqueViralNowActors('viral_now_topic_clicked')
    const organicPageMap = new Map<string, number>()
    for (const event of organicLandingRows) {
      const path = event.path as string
      organicPageMap.set(path, (organicPageMap.get(path) ?? 0) + 1)
    }
    const organicCohort = cohort.filter((profile) => {
      const campaign = (profile.signup_utm_campaign ?? '').toLowerCase()
      const source = (profile.signup_utm_source ?? profile.utm_source ?? '').toLowerCase()
      const medium = (profile.signup_utm_medium ?? '').toLowerCase()
      return campaign.startsWith('push22_') || campaign.startsWith('push32_') ||
        campaign.startsWith('push39_') ||
        (source === 'seo' && medium === 'organic')
    })
    const organicActivated = organicCohort.filter((profile) => (videoCountByUser.get(profile.id) ?? 0) >= 1).length
    const organicPaid = organicCohort.filter((profile) => paidUserSet.has(profile.id)).length
    const organicRecovery = {
      landingSessions: organicLandingRows.length,
      ctaClicks: organicCtaRows.length,
      ctaRate: pct(organicCtaRows.length, organicLandingRows.length),
      viralNowViews,
      viralNowClicks,
      viralNowViewToClickRate: pct(viralNowClicks, viralNowViews),
      signups: organicCohort.length,
      signupRate: pct(organicCohort.length, organicCtaRows.length),
      activated: organicActivated,
      activationRate: pct(organicActivated, organicCohort.length),
      paid: organicPaid,
      topLandingPages: Array.from(organicPageMap.entries())
        .map(([path, sessions]) => ({ path, sessions }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 10),
    }

    // PUSH #27 — unique authenticated actors through the compact first-video
    // handoff. User id wins; session id is the anonymous-safe fallback. A
    // generated fallback key keeps rows measurable if an older beacon lacks
    // both without joining on prompt, email or other personal data.
    const uniqueOnboardingActors = (name: string): number => {
      const rows = retentionEventRows.filter((event) =>
        event.name === name && event.metadata?.version === 'push27_single_choice'
      )
      return new Set(rows.map((event, index) =>
        event.user_id || event.session_id || `${event.created_at ?? 'unknown'}:${index}`
      )).size
    }
    const firstVideoOnboarding = {
      views: uniqueOnboardingActors('viral_onboarding_viewed'),
      primaryClicks: uniqueOnboardingActors('viral_onboarding_primary_clicked'),
      skips: uniqueOnboardingActors('viral_onboarding_skipped'),
      dispatched: uniqueOnboardingActors('first_video_generation_dispatched_from_viral_onboarding'),
      completed: uniqueOnboardingActors('first_video_generation_completed_from_viral_onboarding'),
      failed: uniqueOnboardingActors('first_video_generation_failed_from_viral_onboarding'),
      viewToClickRate: pct(
        uniqueOnboardingActors('viral_onboarding_primary_clicked'),
        uniqueOnboardingActors('viral_onboarding_viewed'),
      ),
      clickToDispatchRate: pct(
        uniqueOnboardingActors('first_video_generation_dispatched_from_viral_onboarding'),
        uniqueOnboardingActors('viral_onboarding_primary_clicked'),
      ),
      dispatchToCompleteRate: pct(
        uniqueOnboardingActors('first_video_generation_completed_from_viral_onboarding'),
        uniqueOnboardingActors('first_video_generation_dispatched_from_viral_onboarding'),
      ),
    }

    // PUSH #28 — monetization at the point where a free user has already
    // completed at least two videos. The browser event and server checkout
    // share the authenticated user id (or the browser session as fallback),
    // so a generic checkout elsewhere is never credited to this offer.
    const repeatOfferVersionRows = retentionEventRows.filter((event) =>
      event.metadata?.version === 'push28_repeat_creator'
    )
    const repeatActorKey = (event: EventRow, index = 0): string =>
      event.user_id || event.session_id || `${event.created_at ?? 'unknown'}:${index}`
    const repeatOfferViewRows = repeatOfferVersionRows.filter((event) =>
      event.name === 'history_repeat_offer_viewed'
    )
    const repeatOfferClickRows = repeatOfferVersionRows.filter((event) =>
      event.name === 'history_repeat_offer_clicked' && event.metadata?.source === 'history_repeat_offer'
    )
    const repeatOfferViewActors = new Set(
      repeatOfferViewRows.map((event, index) => repeatActorKey(event, index))
    )
    const repeatOfferClickActors = new Set(
      repeatOfferClickRows.map((event, index) => repeatActorKey(event, index))
    )
    const firstRepeatClickAt = new Map<string, number>()
    for (const [index, event] of repeatOfferClickRows.entries()) {
      const actor = repeatActorKey(event, index)
      const at = event.created_at ? new Date(event.created_at).getTime() : 0
      const prior = firstRepeatClickAt.get(actor)
      if (prior === undefined || at < prior) firstRepeatClickAt.set(actor, at)
    }
    const repeatCheckoutActors = new Set<string>()
    for (const [index, event] of eventRows.entries()) {
      if (event.name !== 'checkout_started') continue
      const actor = repeatActorKey(event, index)
      const clickedAt = firstRepeatClickAt.get(actor)
      if (clickedAt === undefined) continue
      const checkoutAt = event.created_at ? new Date(event.created_at).getTime() : 0
      // The click beacon and checkout request are concurrent. Stripe can win
      // that race by a few milliseconds, so tolerate a two-minute ordering
      // skew while still requiring the same authenticated actor/session.
      if (checkoutAt >= clickedAt - 2 * 60 * 1000) repeatCheckoutActors.add(actor)
    }
    const repeatClickedUserIds = new Set(
      repeatOfferClickRows
        .map((event) => event.user_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
    const repeatActiveSubscribers = Array.from(repeatClickedUserIds)
      .filter((userId) => activePaidUserSet.has(userId)).length
    const repeatCreatorOffer = {
      views: repeatOfferViewActors.size,
      clicks: repeatOfferClickActors.size,
      checkoutStarts: repeatCheckoutActors.size,
      activeSubscribers: repeatActiveSubscribers,
      viewToClickRate: pct(repeatOfferClickActors.size, repeatOfferViewActors.size),
      clickToCheckoutRate: pct(repeatCheckoutActors.size, repeatOfferClickActors.size),
      checkoutToPaidRate: pct(repeatActiveSubscribers, repeatCheckoutActors.size),
    }

    // PUSH #25 — the export decision directly below a finished free video.
    // A browser impression is counted only after the card is actually visible;
    // checkout and payment remain server/Stripe-authoritative. Session and
    // Stripe IDs connect the payment even when an older webhook lacks the new
    // explicit checkout_origin metadata.
    const postVideoOfferViewRows = postVideoEventRows.filter((event) => event.name === 'post_video_offer_viewed')
    const postVideoWatermarkedDownloadRows = postVideoEventRows.filter((event) =>
      event.name === 'video_downloaded' && event.metadata?.export_type === 'watermarked'
    )
    const postVideoCleanClickRows = postVideoEventRows.filter((event) => event.name === 'post_video_clean_export_clicked')
    const postVideoCheckoutRows = postVideoEventRows.filter((event) =>
      event.name === 'checkout_started' && (
        event.metadata?.checkout_origin === 'post_video_clean_export' ||
        event.metadata?.return_to === 'watermark_moment'
      )
    )
    const postVideoStripeSessionIds = new Set(
      postVideoCheckoutRows
        .map((event) => event.metadata?.stripe_session_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
    const postVideoBrowserSessionIds = new Set(
      postVideoCheckoutRows
        .map((event) => event.session_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
    const postVideoPaymentRows = postVideoEventRows.filter((event) => {
      if (event.name !== 'payment_success') return false
      if (event.metadata?.checkout_origin === 'post_video_clean_export') return true
      const stripeSessionId = event.metadata?.stripe_session_id
      if (typeof stripeSessionId === 'string' && postVideoStripeSessionIds.has(stripeSessionId)) return true
      return typeof event.session_id === 'string' && postVideoBrowserSessionIds.has(event.session_id)
    })
    const postVideoOffer = {
      offerViews: postVideoOfferViewRows.length,
      watermarkedDownloads: postVideoWatermarkedDownloadRows.length,
      cleanExportClicks: postVideoCleanClickRows.length,
      checkoutStarts: postVideoCheckoutRows.length,
      payments: postVideoPaymentRows.length,
      viewToClickRate: pct(postVideoCleanClickRows.length, postVideoOfferViewRows.length),
      clickToCheckoutRate: pct(postVideoCheckoutRows.length, postVideoCleanClickRows.length),
      checkoutToPaidRate: pct(postVideoPaymentRows.length, postVideoCheckoutRows.length),
    }

    // PUSH #23 — creator distribution loop. A completed video only becomes an
    // acquisition asset when the creator shares its public page, a visitor
    // clicks the CTA, signs up and eventually pays. Every stage is measured
    // independently so a zero can be acted on instead of hidden in "referrals".
    const periodVideos = allVideos.filter((video) => {
      if (days === 'all') return true
      const createdAt = video.created_at ? new Date(video.created_at).getTime() : 0
      return createdAt >= cohortCutoff
    })
    const completedPeriodVideos = periodVideos.filter((video) => video.status === 'completed')
    const completedCreatorIds = new Set(
      completedPeriodVideos.map((video) => video.user_id).filter((id): id is string => Boolean(id))
    )
    const creatorShareClickRows = organicEventRows.filter((event) => event.name === 'video_share_clicked')
    const creatorSharedRows = organicEventRows.filter((event) => event.name === 'video_shared')
    const creatorShareUserIds = new Set<string>()
    for (const event of creatorSharedRows) {
      if (event.user_id && completedCreatorIds.has(event.user_id)) {
        creatorShareUserIds.add(event.user_id)
      }
    }
    const publicVideoLandingRows = organicEventRows.filter((event) =>
      event.name === 'landing_session_started' && Boolean(event.path?.startsWith('/v/'))
    )
    const publicVideoCtaRows = organicEventRows.filter((event) => event.name === 'public_video_cta_clicked')
    const deliveryRows = organicEventRows.filter((event) =>
      event.metadata?.version === 'push29_share_delivery' ||
      event.metadata?.utm_content === 'push29_share_delivery'
    )
    const deliveryActorKey = (event: EventRow, index: number): string =>
      event.user_id || event.session_id || `${event.created_at ?? 'unknown'}:${index}`
    const deliveryActors = (name: string): Set<string> => new Set(
      deliveryRows
        .filter((event) => event.name === name)
        .map((event, index) => deliveryActorKey(event, index))
    )
    const deliveryPromptActors = deliveryActors('video_share_prompt_viewed')
    const deliveryClickActors = deliveryActors('video_share_clicked')
    const deliveryShareActors = new Set([
      ...deliveryActors('video_shared'),
      ...deliveryActors('video_share_channel_opened'),
    ])
    const deliveryPublicLandings = deliveryRows.filter((event) =>
      event.name === 'landing_session_started' && Boolean(event.path?.startsWith('/v/'))
    ).length
    const deliveryPublicCtaClicks = deliveryRows.filter((event) =>
      event.name === 'public_video_cta_clicked'
    ).length
    const referredProfiles = cohort.filter((profile) => {
      const source = (profile.signup_utm_source || '').trim().toLowerCase()
      const campaign = (profile.signup_utm_campaign || '').trim().toLowerCase()
      return Boolean(profile.referred_by) ||
        source === 'kineo_user' || source === 'public_video' ||
        campaign === 'referral' || campaign === 'make_one_like_this'
    })
    const qualifiedReferrals = referredProfiles.filter((profile) => profile.referral_reward_granted === true).length
    const referredPaid = referredProfiles.filter((profile) => paidUserSet.has(profile.id)).length
    const creatorLoop = {
      completedVideos: completedPeriodVideos.length,
      completedCreators: completedCreatorIds.size,
      deliveryPromptActors: deliveryPromptActors.size,
      deliveryClickActors: deliveryClickActors.size,
      deliveryShareActors: deliveryShareActors.size,
      deliveryPromptToClickRate: pct(deliveryClickActors.size, deliveryPromptActors.size),
      deliveryClickToShareRate: pct(deliveryShareActors.size, deliveryClickActors.size),
      deliveryPublicLandings,
      deliveryPublicCtaClicks,
      shareClicks: creatorShareClickRows.length,
      shareUsers: creatorShareUserIds.size,
      shareRate: pct(creatorShareUserIds.size, completedCreatorIds.size),
      sharesCompleted: creatorSharedRows.length,
      publicVideoLandings: publicVideoLandingRows.length,
      publicVideoCtaClicks: publicVideoCtaRows.length,
      landingToCtaRate: pct(publicVideoCtaRows.length, publicVideoLandingRows.length),
      referredSignups: referredProfiles.length,
      ctaToSignupRate: pct(referredProfiles.length, publicVideoCtaRows.length),
      qualifiedReferrals,
      referredPaid,
      signupToPaidRate: pct(referredPaid, referredProfiles.length),
    }

    // PUSH #24 — second-video and later-day retention. The selected period is
    // applied to completed-video activity so this answers whether creators who
    // produced value in the window repeated it, independent of signup date.
    const completedTimesByCreator = new Map<string, number[]>()
    for (const video of completedPeriodVideos) {
      if (!video.user_id || !video.created_at) continue
      const timestamp = new Date(video.created_at).getTime()
      if (!Number.isFinite(timestamp)) continue
      const times = completedTimesByCreator.get(video.user_id) ?? []
      times.push(timestamp)
      completedTimesByCreator.set(video.user_id, times)
    }
    let repeatCreators = 0
    let repeatWithin7dCreators = 0
    let laterDayReturnCreators = 0
    for (const times of completedTimesByCreator.values()) {
      times.sort((a, b) => a - b)
      if (times.length < 2) continue
      repeatCreators++
      if (times[1] - times[0] <= 7 * 24 * 60 * 60 * 1000) repeatWithin7dCreators++
      const firstDay = new Date(times[0]).toISOString().slice(0, 10)
      const returnedLaterDay = times.slice(1).some((timestamp) => {
        const within7d = timestamp - times[0] <= 7 * 24 * 60 * 60 * 1000
        return within7d && new Date(timestamp).toISOString().slice(0, 10) !== firstDay
      })
      if (returnedLaterDay) laterDayReturnCreators++
    }
    const continuationClicks = retentionEventRows.filter((event) => event.name === 'series_continue_clicked').length
    const continuationLandings = retentionEventRows.filter((event) => event.name === 'series_continuation_landed').length
    const continuationStarts = retentionEventRows.filter((event) =>
      event.name === 'generate_started' && event.metadata?.series_continuation === true
    ).length
    const continuationCompletes = retentionEventRows.filter((event) =>
      event.name === 'generate_completed' && event.metadata?.series_continuation === true
    ).length
    const retentionLoop = {
      completedCreators: completedTimesByCreator.size,
      oneAndDoneCreators: Math.max(0, completedTimesByCreator.size - repeatCreators),
      repeatCreators,
      secondVideoRate: pct(repeatCreators, completedTimesByCreator.size),
      repeatWithin7dCreators,
      laterDayReturnCreators,
      laterDayReturnRate: pct(laterDayReturnCreators, completedTimesByCreator.size),
      continuationClicks,
      continuationLandings,
      continuationStarts,
      continuationCompletes,
      clickToStartRate: pct(continuationStarts, continuationClicks),
      startToCompleteRate: pct(continuationCompletes, continuationStarts),
    }

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
        auth_callback_completed: eventCounts.get('auth_callback_completed') ?? 0,
        auth_callback_failed: eventCounts.get('auth_callback_failed') ?? 0,
        email_signup_completed: eventCounts.get('email_signup_completed') ?? 0,
        generate_arrived_server: eventCounts.get('generate_arrived_server') ?? 0,
        generate_activation_auth_missing: eventCounts.get('generate_activation_auth_missing') ?? 0,
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
        // Buyer-intent stages are unique identifiable actors. Keep raw totals
        // alongside them so crawler/QA pressure remains visible but cannot be
        // mistaken for human checkout abandonment.
        checkout_attempted: uniqueCheckoutActors('checkout_attempted'),
        checkout_attempted_raw: eventCounts.get('checkout_attempted') ?? 0,
        checkout_authenticated_attempted: uniqueCheckoutActors(
          'checkout_attempted',
          (event) => Boolean(event.user_id),
        ),
        checkout_auth_required: uniqueCheckoutActors('checkout_auth_required'),
        checkout_auth_required_raw: eventCounts.get('checkout_auth_required') ?? 0,
        checkout_auth_page_view: uniqueCheckoutActors('checkout_auth_page_view'),
        checkout_auth_method_selected: uniqueCheckoutActors('checkout_auth_method_selected'),
        checkout_auth_confirmation_required: uniqueCheckoutActors('checkout_auth_confirmation_required'),
        checkout_auth_completed: uniqueCheckoutActors('checkout_auth_completed'),
        checkout_auth_callback_completed: checkoutAuthCallbackCompleted,
        checkout_unidentified_requests: checkoutUnidentifiedRequests,
        checkout_started: uniqueCheckoutActors('checkout_started'),
        payment_success: stripeSessionsAvailable ? checkoutCompleted : (eventCounts.get('payment_success') ?? 0),
        checkout_cancelled: (eventCounts.get('checkout_cancelled') ?? 0) + (eventCounts.get('checkout_canceled') ?? 0),
      },
      cohort: { signups, createdVideo, completedVideo, checkoutClicked, abandoned, paid: paidCohort },
      funnelSteps, biggestLeak, revenueLeaks, hotLeads, sourceQuality, acquisitionAttribution, firstVideoOnboarding, repeatCreatorOffer, organicRecovery, postVideoOffer, creatorLoop, retentionLoop, topicPerformance, renderHealth, trackingHealth,
    }

    return NextResponse.json({ data, updatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[admin/funnel] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
