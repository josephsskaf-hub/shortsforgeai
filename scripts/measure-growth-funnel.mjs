import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const PUSH50_FACELESS_CAMPAIGN = 'push50_faceless_decision_guide'
const PUSH50_LAUNCHED_AT_MS = Date.parse('2026-07-22T01:30:00.000Z')
const PUSH52_QUSO_CAMPAIGN = 'push52_vidyo_quso_pricing_decision'
const PUSH52_LAUNCHED_AT_MS = Date.parse('2026-07-22T03:00:00.000Z')

function loadEnv(path) {
  const values = {}
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) value = value.slice(1, -1)
    values[match[1]] = value
  }
  return values
}

const exactInternal = new Set([
  'josephsskaf@gmail.com',
  'josephskaf@hotmail.com',
  'victoriaskaf96@gmail.com',
  'joseph+teste01@gmail.com',
  'teste01@shortsforgeai.com',
])
const internalPatterns = [
  /^josephsskaf\+.*@gmail\.com$/i,
  /^joseph\+.*@gmail\.com$/i,
  /@theresanaiforthat\.com$/i,
  /^josephsskaf/i,
  /^josephskaf/i,
  /@shortsforgeai\.com$/i,
  /^test/i,
  /mailinator/i,
  /^smoketest/i,
]

function isInternalEmail(raw) {
  const email = String(raw || '').trim().toLowerCase()
  return exactInternal.has(email) || internalPatterns.some((pattern) => pattern.test(email))
}

function actorKey(row) {
  if (row.user_id) return `user:${row.user_id}`
  if (row.session_id) return `session:${row.session_id}`
  return null
}

function stage(rows, name, predicate = () => true) {
  const selected = rows.filter((row) => row.name === name && predicate(row))
  return {
    rawEvents: selected.length,
    identifiableActors: new Set(selected.map(actorKey).filter(Boolean)).size,
    unidentifiedEvents: selected.filter((row) => !actorKey(row)).length,
  }
}

async function fetchAll(queryFactory, pageSize = 1000) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data || []))
    if (!data || data.length < pageSize) return rows
  }
}

async function stripeListAll(fetchPage) {
  const rows = []
  let startingAfter
  for (;;) {
    const page = await fetchPage(startingAfter)
    rows.push(...page.data)
    if (!page.has_more || page.data.length === 0) return rows
    startingAfter = page.data[page.data.length - 1].id
  }
}

function sourceForProfile(profile) {
  const source = profile.signup_utm_source || profile.utm_source
  if (source) return String(source).toLowerCase()
  const referrer = String(profile.signup_referrer || '').toLowerCase()
  if (referrer.includes('chatgpt.com') || referrer.includes('openai.com')) return 'chatgpt'
  if (referrer.includes('theresanaiforthat.com')) return 'taaft'
  if (referrer.includes('youtube.com') || referrer.includes('youtu.be')) return 'youtube'
  if (referrer.includes('google.')) return 'google'
  return 'direct_or_unknown'
}

function cleanAttributionPart(value, fallback) {
  const cleaned = String(value || '').trim().toLowerCase().slice(0, 160)
  return cleaned || fallback
}

function attributionForProfile(profile) {
  if (!profile) {
    return { source: 'unattributed', medium: 'unknown', campaign: 'unknown' }
  }
  return {
    source: sourceForProfile(profile),
    medium: cleanAttributionPart(profile.signup_utm_medium, 'none'),
    campaign: cleanAttributionPart(profile.signup_utm_campaign, 'none'),
  }
}

function attributionKey(attribution) {
  return `${attribution.source}\u0000${attribution.medium}\u0000${attribution.campaign}`
}

function sortedAttributionRows(map, countField = 'count') {
  return [...map.values()].sort((a, b) => (b[countField] || 0) - (a[countField] || 0))
}

async function main() {
  const daysArg = process.argv.find((arg) => arg.startsWith('--days='))
  const days = Number(daysArg?.split('=')[1] || 7)
  if (!Number.isFinite(days) || days <= 0 || days > 365) {
    throw new Error('--days must be between 1 and 365')
  }

  const env = loadEnv('.env.local')
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.STRIPE_SECRET_KEY) {
    throw new Error('Missing Supabase or Stripe credentials in .env.local')
  }

  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000
  const cutoff = new Date(cutoffMs).toISOString()
  const push52CohortCutoffMs = Math.max(cutoffMs, PUSH52_LAUNCHED_AT_MS)
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const stripe = new Stripe(env.STRIPE_SECRET_KEY)

  const authUsers = []
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    authUsers.push(...data.users)
    if (data.users.length < 1000) break
  }

  const profiles = await fetchAll(() => supabase
    .from('profiles')
    .select('id,email,created_at,utm_source,signup_utm_source,signup_utm_medium,signup_utm_campaign,signup_referrer,stripe_customer_id,stripe_subscription_id'))
  const internalIds = new Set()
  for (const user of authUsers) if (isInternalEmail(user.email)) internalIds.add(user.id)
  for (const profile of profiles) if (isInternalEmail(profile.email)) internalIds.add(profile.id)

  const externalProfiles = profiles.filter((profile) => !internalIds.has(profile.id))
  const profilesById = new Map(externalProfiles.map((profile) => [profile.id, profile]))
  const profilesByEmail = new Map(
    externalProfiles
      .filter((profile) => profile.email)
      .map((profile) => [String(profile.email).trim().toLowerCase(), profile]),
  )
  const profilesByStripeCustomer = new Map(
    externalProfiles
      .filter((profile) => profile.stripe_customer_id)
      .map((profile) => [profile.stripe_customer_id, profile]),
  )
  const profilesByStripeSubscription = new Map(
    externalProfiles
      .filter((profile) => profile.stripe_subscription_id)
      .map((profile) => [profile.stripe_subscription_id, profile]),
  )

  function resolveExternalProfile({ userId, customerId, subscriptionId, email }) {
    if (userId && profilesById.has(userId)) return profilesById.get(userId)
    if (subscriptionId && profilesByStripeSubscription.has(subscriptionId)) {
      return profilesByStripeSubscription.get(subscriptionId)
    }
    if (customerId && profilesByStripeCustomer.has(customerId)) {
      return profilesByStripeCustomer.get(customerId)
    }
    const normalizedEmail = String(email || '').trim().toLowerCase()
    return normalizedEmail ? (profilesByEmail.get(normalizedEmail) || null) : null
  }
  const signupCohort = externalProfiles.filter((profile) =>
    new Date(profile.created_at || 0).getTime() >= cutoffMs
  )
  const signupCohortIds = new Set(signupCohort.map((profile) => profile.id))

  const events = await fetchAll(() => supabase
    .from('events')
    .select('name,user_id,session_id,created_at,path,metadata')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: true }))
  const externalEvents = events.filter((row) => !row.user_id || !internalIds.has(row.user_id))

  const videos = await fetchAll(() => supabase
    .from('videos')
    .select('user_id,status,created_at')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: true }))
  const externalVideos = videos.filter((video) => video.user_id && !internalIds.has(video.user_id))
  const completedVideoUsers = new Set(
    externalVideos.filter((video) => video.status === 'completed').map((video) => video.user_id)
  )
  const completedBySignupCohort = new Set(
    externalVideos
      .filter((video) => video.status === 'completed' && signupCohortIds.has(video.user_id))
      .map((video) => video.user_id)
  )

  const stripeSessions = await stripeListAll((startingAfter) => stripe.checkout.sessions.list({
    created: { gte: Math.floor(cutoffMs / 1000) },
    limit: 100,
    ...(startingAfter ? { starting_after: startingAfter } : {}),
  }))
  const recurringSessions = stripeSessions.filter((session) => {
    if (session.mode !== 'subscription') return false
    const userId = session.metadata?.supabase_user_id
    const email = session.customer_details?.email || session.customer_email || session.metadata?.email
    if (userId && internalIds.has(userId)) return false
    return !isInternalEmail(email)
  })

  const subscriptions = await stripeListAll((startingAfter) => stripe.subscriptions.list({
    status: 'all',
    created: { gte: Math.floor(cutoffMs / 1000) },
    limit: 100,
    ...(startingAfter ? { starting_after: startingAfter } : {}),
  }))
  const newActiveSubscriptions = []
  for (const subscription of subscriptions) {
    if (!['active', 'trialing'].includes(subscription.status)) continue
    const userId = subscription.metadata?.supabase_user_id
    if (userId && internalIds.has(userId)) continue
    const customer = typeof subscription.customer === 'string'
      ? await stripe.customers.retrieve(subscription.customer)
      : subscription.customer
    if (!customer || customer.deleted || isInternalEmail(customer.email)) continue
    const profile = resolveExternalProfile({
      userId,
      customerId: customer.id,
      subscriptionId: subscription.id,
      email: customer.email,
    })
    newActiveSubscriptions.push({ subscription, profile })
  }

  const landingRows = externalEvents.filter((row) => row.name === 'landing_session_started')
  const landingPaths = {}
  for (const row of landingRows) {
    const path = row.path || '(none)'
    landingPaths[path] = (landingPaths[path] || 0) + 1
  }

  const signupSources = {}
  const signupCampaignMap = new Map()
  for (const profile of signupCohort) {
    const source = sourceForProfile(profile)
    signupSources[source] = (signupSources[source] || 0) + 1
    const attribution = attributionForProfile(profile)
    const key = attributionKey(attribution)
    const row = signupCampaignMap.get(key) || { ...attribution, signups: 0 }
    row.signups += 1
    signupCampaignMap.set(key, row)
  }

  const stripeSessionCampaignMap = new Map()
  for (const session of recurringSessions) {
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
    const profile = resolveExternalProfile({
      userId: session.metadata?.supabase_user_id,
      customerId,
      subscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
      email: session.customer_details?.email || session.customer_email || session.metadata?.email,
    })
    const attribution = attributionForProfile(profile)
    const key = attributionKey(attribution)
    const row = stripeSessionCampaignMap.get(key) || {
      ...attribution,
      sessions: 0,
      open: 0,
      complete: 0,
      expired: 0,
      paid: 0,
    }
    row.sessions += 1
    if (session.status === 'open') row.open += 1
    if (session.status === 'complete') row.complete += 1
    if (session.status === 'expired') row.expired += 1
    if (session.payment_status === 'paid') row.paid += 1
    stripeSessionCampaignMap.set(key, row)
  }

  const subscriptionCampaignMap = new Map()
  for (const { subscription, profile } of newActiveSubscriptions) {
    const attribution = attributionForProfile(profile)
    const key = attributionKey(attribution)
    const row = subscriptionCampaignMap.get(key) || {
      ...attribution,
      activeOrTrialingSubscriptions: 0,
      active: 0,
      trialing: 0,
    }
    row.activeOrTrialingSubscriptions += 1
    if (subscription.status === 'active') row.active += 1
    if (subscription.status === 'trialing') row.trialing += 1
    subscriptionCampaignMap.set(key, row)
  }

  const checkoutAttempted = stage(externalEvents, 'checkout_attempted')
  const checkoutAuthRequired = stage(externalEvents, 'checkout_auth_required')
  const checkoutAuthPageView = stage(externalEvents, 'checkout_auth_page_view')
  const checkoutAuthMethodSelected = stage(externalEvents, 'checkout_auth_method_selected')
  const checkoutAuthCompleted = stage(externalEvents, 'checkout_auth_completed')
  const checkoutCallbackCompleted = stage(
    externalEvents,
    'auth_callback_completed',
    (row) => row.metadata?.is_checkout_destination === true,
  )
  const authenticatedAttempted = stage(
    externalEvents,
    'checkout_attempted',
    (row) => Boolean(row.user_id),
  )
  const checkoutStarted = stage(externalEvents, 'checkout_started')
  const activationAutostartEligible = stage(externalEvents, 'activation_autostart_eligible')
  const activationAutostartDispatched = stage(externalEvents, 'activation_autostart_dispatched')
  const activationAutostartSkipped = stage(externalEvents, 'activation_autostart_skipped')
  const checkoutResumeViewed = stage(externalEvents, 'checkout_resume_banner_viewed')
  const checkoutResumeClicked = stage(externalEvents, 'checkout_resume_banner_clicked')
  const checkoutResumeDismissed = stage(externalEvents, 'checkout_resume_banner_dismissed')
  const checkoutRecoveryStarted = stage(
    externalEvents,
    'checkout_started',
    (row) => row.metadata?.checkout_recovery === true || row.metadata?.checkout_recovery === '1',
  )
  const push50HomeNoCameraClicked = stage(
    externalEvents,
    'organic_cta_clicked',
    (row) => row.metadata?.source === 'push50_home_no_camera',
  )
  const push50HomeAlternativesClicked = stage(
    externalEvents,
    'organic_cta_clicked',
    (row) => row.metadata?.source === 'push50_home_alternatives',
  )
  const push50FacelessCtaClicked = stage(
    externalEvents,
    'organic_cta_clicked',
    (row) => row.metadata?.source === 'push50_faceless_decision_guide',
  )
  const push50FacelessTopicSubmitted = stage(
    externalEvents,
    'organic_topic_submitted',
    (row) => row.metadata?.source === PUSH50_FACELESS_CAMPAIGN,
  )
  const push50FacelessPricingViewed = stage(
    externalEvents,
    'pricing_view',
    (row) => row.metadata?.source === PUSH50_FACELESS_CAMPAIGN,
  )
  const push50FacelessLandingSessions = stage(
    externalEvents,
    'landing_session_started',
    (row) => row.path === '/faceless-channel-ideas' &&
      new Date(row.created_at || 0).getTime() >= PUSH50_LAUNCHED_AT_MS,
  )
  const push50IntentUserIds = new Set(
    externalEvents
      .filter((row) => row.user_id && (
        row.metadata?.campaign === PUSH50_FACELESS_CAMPAIGN ||
        row.metadata?.intent_campaign === PUSH50_FACELESS_CAMPAIGN ||
        row.metadata?.source === PUSH50_FACELESS_CAMPAIGN
      ))
      .map((row) => row.user_id),
  )
  const push50SignupProfiles = signupCohort.filter(
    (profile) => attributionForProfile(profile).campaign === PUSH50_FACELESS_CAMPAIGN ||
      push50IntentUserIds.has(profile.id),
  )
  const push50SignupIds = new Set(push50SignupProfiles.map((profile) => profile.id))
  const push50CompletedVideoUsers = new Set(
    externalVideos
      .filter((video) => video.status === 'completed' && push50SignupIds.has(video.user_id))
      .map((video) => video.user_id),
  )
  const push50RecurringSessions = recurringSessions.filter((session) => {
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
    const profile = resolveExternalProfile({
      userId: session.metadata?.supabase_user_id,
      customerId,
      subscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
      email: session.customer_details?.email || session.customer_email || session.metadata?.email,
    })
    const userId = session.metadata?.supabase_user_id
    return session.metadata?.intent_campaign === PUSH50_FACELESS_CAMPAIGN ||
      attributionForProfile(profile).campaign === PUSH50_FACELESS_CAMPAIGN ||
      (Boolean(userId) && push50IntentUserIds.has(userId))
  })
  const push50ActiveSubscriptions = newActiveSubscriptions.filter(
    ({ subscription, profile }) => subscription.metadata?.intent_campaign === PUSH50_FACELESS_CAMPAIGN ||
      attributionForProfile(profile).campaign === PUSH50_FACELESS_CAMPAIGN ||
      (Boolean(subscription.metadata?.supabase_user_id) &&
        push50IntentUserIds.has(subscription.metadata.supabase_user_id)),
  )
  const push52QusoLandingSessions = stage(
    externalEvents,
    'landing_session_started',
    (row) => row.path === '/alternatives/quso' &&
      new Date(row.created_at || 0).getTime() >= PUSH52_LAUNCHED_AT_MS,
  )
  const push52QusoCtaClicked = stage(
    externalEvents,
    'organic_cta_clicked',
    (row) => row.metadata?.source === PUSH52_QUSO_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH52_LAUNCHED_AT_MS,
  )
  const push52QusoTopicSubmitted = stage(
    externalEvents,
    'organic_topic_submitted',
    (row) => row.metadata?.source === PUSH52_QUSO_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH52_LAUNCHED_AT_MS,
  )
  const push52QusoPricingViewed = stage(
    externalEvents,
    'pricing_view',
    (row) => row.metadata?.source === PUSH52_QUSO_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH52_LAUNCHED_AT_MS,
  )
  const push52IntentUserIds = new Set(
    externalEvents
      .filter((row) => row.user_id &&
        ['email_signup_completed', 'auth_callback_completed'].includes(row.name) &&
        new Date(row.created_at || 0).getTime() >= PUSH52_LAUNCHED_AT_MS && (
          row.metadata?.campaign === PUSH52_QUSO_CAMPAIGN ||
          row.metadata?.intent_campaign === PUSH52_QUSO_CAMPAIGN ||
          row.metadata?.source === PUSH52_QUSO_CAMPAIGN
        ))
      .map((row) => row.user_id),
  )
  const push52SignupProfiles = externalProfiles.filter((profile) =>
    new Date(profile.created_at || 0).getTime() >= push52CohortCutoffMs && (
      attributionForProfile(profile).campaign === PUSH52_QUSO_CAMPAIGN ||
      push52IntentUserIds.has(profile.id)
    ),
  )
  const push52SignupIds = new Set(push52SignupProfiles.map((profile) => profile.id))
  const push52CompletedVideoUsers = new Set(
    externalVideos
      .filter((video) => video.status === 'completed' &&
        push52SignupIds.has(video.user_id) &&
        new Date(video.created_at || 0).getTime() >= PUSH52_LAUNCHED_AT_MS)
      .map((video) => video.user_id),
  )
  const push52RecurringSessions = recurringSessions.filter((session) => {
    if ((session.created || 0) * 1000 < PUSH52_LAUNCHED_AT_MS) return false
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
    const profile = resolveExternalProfile({
      userId: session.metadata?.supabase_user_id,
      customerId,
      subscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
      email: session.customer_details?.email || session.customer_email || session.metadata?.email,
    })
    const explicitIntent = session.metadata?.intent_campaign
    if (explicitIntent) return explicitIntent === PUSH52_QUSO_CAMPAIGN
    const userId = session.metadata?.supabase_user_id
    return attributionForProfile(profile).campaign === PUSH52_QUSO_CAMPAIGN ||
      (Boolean(userId) && push52SignupIds.has(userId))
  })
  const push52ActiveSubscriptions = newActiveSubscriptions.filter(({ subscription, profile }) => {
    if ((subscription.created || 0) * 1000 < PUSH52_LAUNCHED_AT_MS) return false
    const explicitIntent = subscription.metadata?.intent_campaign
    if (explicitIntent) return explicitIntent === PUSH52_QUSO_CAMPAIGN
    const userId = subscription.metadata?.supabase_user_id
    return attributionForProfile(profile).campaign === PUSH52_QUSO_CAMPAIGN ||
      (Boolean(userId) && push52SignupIds.has(userId))
  })

  const report = {
    generatedAt: new Date().toISOString(),
    window: { days, cutoff },
    funnel: {
      qualifiedVisitors: new Set(landingRows.map(actorKey).filter(Boolean)).size,
      landingEvents: landingRows.length,
      externalSignups: signupCohort.length,
      completedVideoUsersInPeriod: completedVideoUsers.size,
      signupCohortWithCompletedVideo: completedBySignupCohort.size,
      pricingActors: stage(externalEvents, 'pricing_view').identifiableActors,
      checkout: {
        attempted: checkoutAttempted,
        authRequired: checkoutAuthRequired,
        authPageView: checkoutAuthPageView,
        authMethodSelected: checkoutAuthMethodSelected,
        authCompleted: checkoutAuthCompleted,
        checkoutCallbackCompleted,
        authenticatedAttempted,
        started: checkoutStarted,
      },
      recurringStripeSessions: {
        total: recurringSessions.length,
        open: recurringSessions.filter((session) => session.status === 'open').length,
        complete: recurringSessions.filter((session) => session.status === 'complete').length,
        expired: recurringSessions.filter((session) => session.status === 'expired').length,
        paid: recurringSessions.filter((session) => session.payment_status === 'paid').length,
      },
      newActiveOrTrialingSubscriptions: newActiveSubscriptions.length,
    },
    experiments: {
      activationAutostartFastV1: {
        eligible: activationAutostartEligible,
        dispatched: activationAutostartDispatched,
        skipped: activationAutostartSkipped,
      },
      checkoutResumeV1: {
        bannerViewed: checkoutResumeViewed,
        bannerClicked: checkoutResumeClicked,
        bannerDismissed: checkoutResumeDismissed,
        recoveryCheckoutStarted: checkoutRecoveryStarted,
      },
      push50OrganicDecisionGuide: {
        homeNoCameraClicked: push50HomeNoCameraClicked,
        homeAlternativesClicked: push50HomeAlternativesClicked,
        facelessGuideLandingSessions: push50FacelessLandingSessions,
        facelessGuideCtaClicked: push50FacelessCtaClicked,
        facelessGuideTopicSubmitted: push50FacelessTopicSubmitted,
        facelessGuidePricingViewed: push50FacelessPricingViewed,
        signups: push50SignupProfiles.length,
        signupCohortWithCompletedVideo: push50CompletedVideoUsers.size,
        recurringStripeSessions: {
          total: push50RecurringSessions.length,
          open: push50RecurringSessions.filter((session) => session.status === 'open').length,
          complete: push50RecurringSessions.filter((session) => session.status === 'complete').length,
          expired: push50RecurringSessions.filter((session) => session.status === 'expired').length,
          paid: push50RecurringSessions.filter((session) => session.payment_status === 'paid').length,
        },
        activeOrTrialingSubscriptions: push50ActiveSubscriptions.length,
      },
      push52VidyoQusoPricingDecision: {
        landingSessions: push52QusoLandingSessions,
        ctaClicked: push52QusoCtaClicked,
        topicSubmitted: push52QusoTopicSubmitted,
        pricingViewed: push52QusoPricingViewed,
        signups: push52SignupProfiles.length,
        signupCohortWithCompletedVideo: push52CompletedVideoUsers.size,
        recurringStripeSessions: {
          total: push52RecurringSessions.length,
          open: push52RecurringSessions.filter((session) => session.status === 'open').length,
          complete: push52RecurringSessions.filter((session) => session.status === 'complete').length,
          expired: push52RecurringSessions.filter((session) => session.status === 'expired').length,
          paid: push52RecurringSessions.filter((session) => session.payment_status === 'paid').length,
        },
        activeOrTrialingSubscriptions: push52ActiveSubscriptions.length,
      },
    },
    acquisition: {
      signupSources,
      signupCampaigns: sortedAttributionRows(signupCampaignMap, 'signups'),
      recurringStripeSessionsByCampaign: sortedAttributionRows(stripeSessionCampaignMap, 'sessions'),
      newSubscriptionsByCampaign: sortedAttributionRows(
        subscriptionCampaignMap,
        'activeOrTrialingSubscriptions',
      ),
      topLandingPaths: Object.entries(landingPaths)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([path, events]) => ({ path, events })),
    },
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
