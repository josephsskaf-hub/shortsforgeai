import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const PUSH50_FACELESS_CAMPAIGN = 'push50_faceless_decision_guide'
const PUSH50_LAUNCHED_AT_MS = Date.parse('2026-07-22T01:30:00.000Z')
const PUSH52_QUSO_CAMPAIGN = 'push52_vidyo_quso_pricing_decision'
const PUSH52_LAUNCHED_AT_MS = Date.parse('2026-07-22T03:00:00.000Z')
const PUSH53_HOME_CAMPAIGN = 'push53_home_prompt_first'
// Deliberate post-deploy measurement boundary. The unique event/campaign names
// cannot exist before PUSH #53, and the 00:15 BRT boundary avoids counting any
// deployment or smoke-test traffic in the experiment cohort.
const PUSH53_LAUNCHED_AT_MS = Date.parse('2026-07-22T03:15:00.000Z')
const PUSH55_YOUTUBE_CAMPAIGN = 'push55_youtube_related_bridge'
// The landing deploy and production smoke happen before this boundary. The
// public YouTube bridge must not inherit internal release traffic, so the
// campaign clock starts with the scheduled public video at 17:00 BRT on
// 22 July 2026. Landing smoke tests before then stay outside the cohort.
const PUSH55_LAUNCHED_AT_MS = Date.parse('2026-07-22T20:00:00.000Z')
const PUSH58_TEXT_TO_VIDEO_CAMPAIGN = 'push58_text_to_video_shorts'
// PUSH #58 was deployed and smoke-tested before this boundary. Start after the
// production URL, sitemap, llms.txt, and IndexNow verification to keep internal
// release traffic out of the acquisition cohort.
const PUSH58_LAUNCHED_AT_MS = Date.parse('2026-07-23T13:30:00.000Z')
const PUSH60_FREE_GENERATOR_CAMPAIGN = 'push60_free_ai_shorts_generator'
const PUSH60_LAUNCHED_AT_MS = Date.parse('2026-07-23T14:00:00.000Z')
const PUSH63_NICHE_CAMPAIGN_PREFIX = 'push63_niche_'
const PUSH63_LAUNCHED_AT_MS = Date.parse('2026-07-23T14:10:00.000Z')
const PUSH65_SAASHUB_CAMPAIGN = 'push65_saashub_directory_bridge'
// Start after the production deploy and smoke test. The public SaaSHub listing
// will use /from-saashub, so internal release traffic before this boundary is
// excluded from the acquisition cohort.
const PUSH65_LAUNCHED_AT_MS = Date.parse('2026-07-23T14:20:00.000Z')
const EXPERIMENT_RETENTION_MS = 21 * 24 * 60 * 60 * 1000

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

  const nowMs = Date.now()
  const cutoffMs = nowMs - days * 24 * 60 * 60 * 1000
  const cutoff = new Date(cutoffMs).toISOString()
  const activeExperimentCutoffs = [
    PUSH50_LAUNCHED_AT_MS,
    PUSH52_LAUNCHED_AT_MS,
    PUSH53_LAUNCHED_AT_MS,
    PUSH55_LAUNCHED_AT_MS,
    PUSH58_LAUNCHED_AT_MS,
    PUSH60_LAUNCHED_AT_MS,
    PUSH63_LAUNCHED_AT_MS,
    PUSH65_LAUNCHED_AT_MS,
  ].filter((launchedAt) => nowMs - launchedAt <= EXPERIMENT_RETENTION_MS)
  const dataCutoffMs = Math.min(cutoffMs, ...activeExperimentCutoffs)
  const dataCutoff = new Date(dataCutoffMs).toISOString()
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
    .gte('created_at', dataCutoff)
    .order('created_at', { ascending: true }))
  const experimentEvents = events.filter((row) => !row.user_id || !internalIds.has(row.user_id))
  const externalEvents = experimentEvents.filter(
    (row) => new Date(row.created_at || 0).getTime() >= cutoffMs,
  )

  const videos = await fetchAll(() => supabase
    .from('videos')
    .select('user_id,status,created_at')
    .gte('created_at', dataCutoff)
    .order('created_at', { ascending: true }))
  const experimentVideos = videos.filter((video) => video.user_id && !internalIds.has(video.user_id))
  const externalVideos = experimentVideos.filter(
    (video) => new Date(video.created_at || 0).getTime() >= cutoffMs,
  )
  const completedVideoUsers = new Set(
    externalVideos.filter((video) => video.status === 'completed').map((video) => video.user_id)
  )
  const completedBySignupCohort = new Set(
    externalVideos
      .filter((video) => video.status === 'completed' && signupCohortIds.has(video.user_id))
      .map((video) => video.user_id)
  )

  const stripeSessions = await stripeListAll((startingAfter) => stripe.checkout.sessions.list({
    created: { gte: Math.floor(dataCutoffMs / 1000) },
    limit: 100,
    ...(startingAfter ? { starting_after: startingAfter } : {}),
  }))
  const experimentRecurringSessions = stripeSessions.filter((session) => {
    if (session.mode !== 'subscription') return false
    const userId = session.metadata?.supabase_user_id
    const email = session.customer_details?.email || session.customer_email || session.metadata?.email
    if (userId && internalIds.has(userId)) return false
    return !isInternalEmail(email)
  })
  const recurringSessions = experimentRecurringSessions.filter(
    (session) => (session.created || 0) * 1000 >= cutoffMs,
  )

  const subscriptions = await stripeListAll((startingAfter) => stripe.subscriptions.list({
    status: 'all',
    created: { gte: Math.floor(dataCutoffMs / 1000) },
    limit: 100,
    ...(startingAfter ? { starting_after: startingAfter } : {}),
  }))
  const experimentActiveSubscriptions = []
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
    experimentActiveSubscriptions.push({ subscription, profile })
  }
  const newActiveSubscriptions = experimentActiveSubscriptions.filter(
    ({ subscription }) => (subscription.created || 0) * 1000 >= cutoffMs,
  )

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
  const activationAutostartRecoveryEligible = stage(externalEvents, 'activation_autostart_recovery_eligible')
  const activationAutostartRecoveryDispatched = stage(externalEvents, 'activation_autostart_recovery_dispatched')
  const activationAutostartCheckpointed = stage(externalEvents, 'activation_autostart_checkpointed')
  const activationAutostartAttemptIds = new Set(
    externalEvents
      .filter((row) => row.name === 'activation_autostart_dispatched')
      .map((row) => row.metadata?.attempt_id)
      .filter((attemptId) => typeof attemptId === 'string' && attemptId.length > 0),
  )
  const activationAutostartFailed = stage(
    externalEvents,
    'video_generation_failed',
    (row) => typeof row.metadata?.attempt_id === 'string' &&
      activationAutostartAttemptIds.has(row.metadata.attempt_id),
  )
  const checkoutResumeViewed = stage(externalEvents, 'checkout_resume_banner_viewed')
  const checkoutResumeClicked = stage(externalEvents, 'checkout_resume_banner_clicked')
  const checkoutResumeDismissed = stage(externalEvents, 'checkout_resume_banner_dismissed')
  const checkoutRecoveryStarted = stage(
    externalEvents,
    'checkout_started',
    (row) => row.metadata?.checkout_recovery === true || row.metadata?.checkout_recovery === '1',
  )
  const push50HomeNoCameraClicked = stage(
    experimentEvents,
    'organic_cta_clicked',
    (row) => row.metadata?.source === 'push50_home_no_camera',
  )
  const push50HomeAlternativesClicked = stage(
    experimentEvents,
    'organic_cta_clicked',
    (row) => row.metadata?.source === 'push50_home_alternatives',
  )
  const push50FacelessCtaClicked = stage(
    experimentEvents,
    'organic_cta_clicked',
    (row) => row.metadata?.source === 'push50_faceless_decision_guide',
  )
  const push50FacelessTopicSubmitted = stage(
    experimentEvents,
    'organic_topic_submitted',
    (row) => row.metadata?.source === PUSH50_FACELESS_CAMPAIGN,
  )
  const push50FacelessPricingViewed = stage(
    experimentEvents,
    'pricing_view',
    (row) => row.metadata?.source === PUSH50_FACELESS_CAMPAIGN,
  )
  const push50FacelessLandingSessions = stage(
    experimentEvents,
    'landing_session_started',
    (row) => row.path === '/faceless-channel-ideas' &&
      new Date(row.created_at || 0).getTime() >= PUSH50_LAUNCHED_AT_MS,
  )
  const push50IntentUserIds = new Set(
    experimentEvents
      .filter((row) => row.user_id && (
        row.metadata?.campaign === PUSH50_FACELESS_CAMPAIGN ||
        row.metadata?.intent_campaign === PUSH50_FACELESS_CAMPAIGN ||
        row.metadata?.source === PUSH50_FACELESS_CAMPAIGN
      ))
      .map((row) => row.user_id),
  )
  const push50SignupProfiles = externalProfiles.filter(
    (profile) => new Date(profile.created_at || 0).getTime() >= PUSH50_LAUNCHED_AT_MS && (
      attributionForProfile(profile).campaign === PUSH50_FACELESS_CAMPAIGN ||
      push50IntentUserIds.has(profile.id)
    ),
  )
  const push50SignupIds = new Set(push50SignupProfiles.map((profile) => profile.id))
  const push50CompletedVideoUsers = new Set(
    experimentVideos
      .filter((video) => video.status === 'completed' &&
        push50SignupIds.has(video.user_id) &&
        new Date(video.created_at || 0).getTime() >= PUSH50_LAUNCHED_AT_MS)
      .map((video) => video.user_id),
  )
  const push50RecurringSessions = experimentRecurringSessions.filter((session) => {
    if ((session.created || 0) * 1000 < PUSH50_LAUNCHED_AT_MS) return false
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
  const push50ActiveSubscriptions = experimentActiveSubscriptions.filter(
    ({ subscription, profile }) => (subscription.created || 0) * 1000 >= PUSH50_LAUNCHED_AT_MS && (
      subscription.metadata?.intent_campaign === PUSH50_FACELESS_CAMPAIGN ||
      attributionForProfile(profile).campaign === PUSH50_FACELESS_CAMPAIGN ||
      (Boolean(subscription.metadata?.supabase_user_id) &&
        push50IntentUserIds.has(subscription.metadata.supabase_user_id))
    ),
  )
  const push52QusoLandingSessions = stage(
    experimentEvents,
    'landing_session_started',
    (row) => row.path === '/alternatives/quso' &&
      new Date(row.created_at || 0).getTime() >= PUSH52_LAUNCHED_AT_MS,
  )
  const push52QusoCtaClicked = stage(
    experimentEvents,
    'organic_cta_clicked',
    (row) => row.metadata?.source === PUSH52_QUSO_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH52_LAUNCHED_AT_MS,
  )
  const push52QusoTopicSubmitted = stage(
    experimentEvents,
    'organic_topic_submitted',
    (row) => row.metadata?.source === PUSH52_QUSO_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH52_LAUNCHED_AT_MS,
  )
  const push52QusoPricingViewed = stage(
    experimentEvents,
    'pricing_view',
    (row) => row.metadata?.source === PUSH52_QUSO_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH52_LAUNCHED_AT_MS,
  )
  const push52IntentUserIds = new Set(
    experimentEvents
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
    new Date(profile.created_at || 0).getTime() >= PUSH52_LAUNCHED_AT_MS && (
      attributionForProfile(profile).campaign === PUSH52_QUSO_CAMPAIGN ||
      push52IntentUserIds.has(profile.id)
    ),
  )
  const push52SignupIds = new Set(push52SignupProfiles.map((profile) => profile.id))
  const push52CompletedVideoUsers = new Set(
    experimentVideos
      .filter((video) => video.status === 'completed' &&
        push52SignupIds.has(video.user_id) &&
        new Date(video.created_at || 0).getTime() >= PUSH52_LAUNCHED_AT_MS)
      .map((video) => video.user_id),
  )
  const push52RecurringSessions = experimentRecurringSessions.filter((session) => {
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
  const push52ActiveSubscriptions = experimentActiveSubscriptions.filter(({ subscription, profile }) => {
    if ((subscription.created || 0) * 1000 < PUSH52_LAUNCHED_AT_MS) return false
    const explicitIntent = subscription.metadata?.intent_campaign
    if (explicitIntent) return explicitIntent === PUSH52_QUSO_CAMPAIGN
    const userId = subscription.metadata?.supabase_user_id
    return attributionForProfile(profile).campaign === PUSH52_QUSO_CAMPAIGN ||
      (Boolean(userId) && push52SignupIds.has(userId))
  })
  const push53HomeViewed = stage(
    experimentEvents,
    'home_prompt_first_viewed',
    (row) => row.metadata?.source === PUSH53_HOME_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH53_LAUNCHED_AT_MS,
  )
  const push53SignedOutViewed = stage(
    experimentEvents,
    'home_prompt_first_viewed',
    (row) => row.metadata?.source === PUSH53_HOME_CAMPAIGN &&
      row.metadata?.signed_in === false &&
      new Date(row.created_at || 0).getTime() >= PUSH53_LAUNCHED_AT_MS,
  )
  const push53TopicSubmitted = stage(
    experimentEvents,
    'organic_topic_submitted',
    (row) => row.metadata?.source === PUSH53_HOME_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH53_LAUNCHED_AT_MS,
  )
  const push53SignedOutTopicSubmitted = stage(
    experimentEvents,
    'organic_topic_submitted',
    (row) => row.metadata?.source === PUSH53_HOME_CAMPAIGN &&
      row.metadata?.signed_in === false &&
      new Date(row.created_at || 0).getTime() >= PUSH53_LAUNCHED_AT_MS,
  )
  const push53AllIntentActivationEligible = stage(
    experimentEvents,
    'activation_autostart_eligible',
    (row) => row.metadata?.campaign === PUSH53_HOME_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH53_LAUNCHED_AT_MS,
  )
  const push53AllIntentActivationDispatched = stage(
    experimentEvents,
    'activation_autostart_dispatched',
    (row) => row.metadata?.campaign === PUSH53_HOME_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH53_LAUNCHED_AT_MS,
  )
  const push53AllIntentActivationSkipped = stage(
    experimentEvents,
    'activation_autostart_skipped',
    (row) => row.metadata?.campaign === PUSH53_HOME_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH53_LAUNCHED_AT_MS,
  )
  const push53AuthUserIds = new Set(
    experimentEvents
      .filter((row) => row.user_id &&
        ['email_signup_completed', 'auth_callback_completed'].includes(row.name) &&
        new Date(row.created_at || 0).getTime() >= PUSH53_LAUNCHED_AT_MS && (
          row.metadata?.campaign === PUSH53_HOME_CAMPAIGN ||
          row.metadata?.intent_campaign === PUSH53_HOME_CAMPAIGN ||
          row.metadata?.source === PUSH53_HOME_CAMPAIGN
        ))
      .map((row) => row.user_id),
  )
  const push53SignupProfiles = externalProfiles.filter((profile) =>
    new Date(profile.created_at || 0).getTime() >= PUSH53_LAUNCHED_AT_MS && (
      attributionForProfile(profile).campaign === PUSH53_HOME_CAMPAIGN ||
      push53AuthUserIds.has(profile.id)
    ),
  )
  const push53SignupIds = new Set(push53SignupProfiles.map((profile) => profile.id))
  const push53ActivationEligible = stage(
    experimentEvents,
    'activation_autostart_eligible',
    (row) => Boolean(row.user_id) && push53SignupIds.has(row.user_id) &&
      row.metadata?.campaign === PUSH53_HOME_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH53_LAUNCHED_AT_MS,
  )
  const push53ActivationDispatched = stage(
    experimentEvents,
    'activation_autostart_dispatched',
    (row) => Boolean(row.user_id) && push53SignupIds.has(row.user_id) &&
      row.metadata?.campaign === PUSH53_HOME_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH53_LAUNCHED_AT_MS,
  )
  const push53ActivationSkipped = stage(
    experimentEvents,
    'activation_autostart_skipped',
    (row) => Boolean(row.user_id) && push53SignupIds.has(row.user_id) &&
      row.metadata?.campaign === PUSH53_HOME_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH53_LAUNCHED_AT_MS,
  )
  const push53GenerateStarted = stage(
    experimentEvents,
    'generate_started',
    (row) => Boolean(row.user_id) && push53SignupIds.has(row.user_id) &&
      new Date(row.created_at || 0).getTime() >= PUSH53_LAUNCHED_AT_MS,
  )
  const push53CompletedVideoUsers = new Set(
    experimentVideos
      .filter((video) => video.status === 'completed' &&
        push53SignupIds.has(video.user_id) &&
        new Date(video.created_at || 0).getTime() >= PUSH53_LAUNCHED_AT_MS)
      .map((video) => video.user_id),
  )
  const push53CheckpointSaved = stage(
    experimentEvents,
    'generation_checkpoint_saved',
    (row) => Boolean(row.user_id) && push53SignupIds.has(row.user_id) &&
      new Date(row.created_at || 0).getTime() >= PUSH53_LAUNCHED_AT_MS,
  )
  const push53RenderResumed = stage(
    experimentEvents,
    'generation_render_resumed',
    (row) => Boolean(row.user_id) && push53SignupIds.has(row.user_id) &&
      new Date(row.created_at || 0).getTime() >= PUSH53_LAUNCHED_AT_MS,
  )
  const push53PricingViewed = stage(
    experimentEvents,
    'pricing_view',
    (row) => Boolean(row.user_id) && push53SignupIds.has(row.user_id) &&
      new Date(row.created_at || 0).getTime() >= PUSH53_LAUNCHED_AT_MS,
  )
  const push53CheckoutAttempted = stage(
    experimentEvents,
    'checkout_attempted',
    (row) => Boolean(row.user_id) && push53SignupIds.has(row.user_id) &&
      new Date(row.created_at || 0).getTime() >= PUSH53_LAUNCHED_AT_MS,
  )
  const push53AllIntentRecurringSessions = experimentRecurringSessions.filter((session) => {
    if ((session.created || 0) * 1000 < PUSH53_LAUNCHED_AT_MS) return false
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
    const profile = resolveExternalProfile({
      userId: session.metadata?.supabase_user_id,
      customerId,
      subscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
      email: session.customer_details?.email || session.customer_email || session.metadata?.email,
    })
    const explicitIntent = session.metadata?.intent_campaign
    if (explicitIntent) return explicitIntent === PUSH53_HOME_CAMPAIGN
    const userId = session.metadata?.supabase_user_id
    return attributionForProfile(profile).campaign === PUSH53_HOME_CAMPAIGN ||
      (Boolean(userId) && push53SignupIds.has(userId))
  })
  const push53AllIntentActiveSubscriptions = experimentActiveSubscriptions.filter(({ subscription, profile }) => {
    if ((subscription.created || 0) * 1000 < PUSH53_LAUNCHED_AT_MS) return false
    const explicitIntent = subscription.metadata?.intent_campaign
    if (explicitIntent) return explicitIntent === PUSH53_HOME_CAMPAIGN
    const userId = subscription.metadata?.supabase_user_id
    return attributionForProfile(profile).campaign === PUSH53_HOME_CAMPAIGN ||
      (Boolean(userId) && push53SignupIds.has(userId))
  })
  const push53RecurringSessions = push53AllIntentRecurringSessions.filter((session) => {
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
    const profile = resolveExternalProfile({
      userId: session.metadata?.supabase_user_id,
      customerId,
      subscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
      email: session.customer_details?.email || session.customer_email || session.metadata?.email,
    })
    return push53SignupIds.has(session.metadata?.supabase_user_id) ||
      (Boolean(profile?.id) && push53SignupIds.has(profile.id))
  })
  const push53ActiveSubscriptions = push53AllIntentActiveSubscriptions.filter(({ subscription, profile }) =>
    push53SignupIds.has(subscription.metadata?.supabase_user_id) ||
      (Boolean(profile?.id) && push53SignupIds.has(profile.id)),
  )
  const push53ActiveSubscriptionIds = new Set(
    push53ActiveSubscriptions.map(({ subscription }) => subscription.id),
  )
  const push53PaidRecurringCustomers = new Set(
    push53RecurringSessions
      .filter((session) => {
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id
        return session.status === 'complete' &&
          session.payment_status === 'paid' &&
          Boolean(subscriptionId) &&
          push53ActiveSubscriptionIds.has(subscriptionId)
      })
      .map((session) => {
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
        return session.metadata?.supabase_user_id || customerId || session.customer_details?.email || session.id
      }),
  )
  const push53AllIntentActiveSubscriptionIds = new Set(
    push53AllIntentActiveSubscriptions.map(({ subscription }) => subscription.id),
  )
  const push53AllIntentPaidRecurringCustomers = new Set(
    push53AllIntentRecurringSessions
      .filter((session) => {
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id
        return session.status === 'complete' &&
          session.payment_status === 'paid' &&
          Boolean(subscriptionId) &&
          push53AllIntentActiveSubscriptionIds.has(subscriptionId)
      })
      .map((session) => {
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
        return session.metadata?.supabase_user_id || customerId || session.customer_details?.email || session.id
      }),
  )

  const push55LandingSessions = stage(
    experimentEvents,
    'landing_session_started',
    (row) => row.path === '/from-youtube' &&
      new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS,
  )
  const push55BridgeViewed = stage(
    experimentEvents,
    'youtube_related_bridge_viewed',
    (row) => row.metadata?.source === PUSH55_YOUTUBE_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS,
  )
  const push55SignedOutViewed = stage(
    experimentEvents,
    'youtube_related_bridge_viewed',
    (row) => row.metadata?.source === PUSH55_YOUTUBE_CAMPAIGN &&
      row.metadata?.signed_in === false &&
      new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS,
  )
  const push55ExamplePlayed = stage(
    experimentEvents,
    'example_video_play',
    (row) => row.metadata?.version === 'push55' &&
      row.metadata?.placement === 'screen_demo_bridge' &&
      new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS,
  )
  const push55TopicSubmitted = stage(
    experimentEvents,
    'organic_topic_submitted',
    (row) => row.metadata?.source === PUSH55_YOUTUBE_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS,
  )
  const push55SignedOutTopicSubmitted = stage(
    experimentEvents,
    'organic_topic_submitted',
    (row) => row.metadata?.source === PUSH55_YOUTUBE_CAMPAIGN &&
      row.metadata?.signed_in === false &&
      new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS,
  )
  const push55IntentUserIds = new Set(
    experimentEvents
      .filter((row) => row.user_id &&
        new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS && (
          row.metadata?.campaign === PUSH55_YOUTUBE_CAMPAIGN ||
          row.metadata?.intent_campaign === PUSH55_YOUTUBE_CAMPAIGN ||
          row.metadata?.source === PUSH55_YOUTUBE_CAMPAIGN
        ))
      .map((row) => row.user_id),
  )
  const push55AuthoritativeSignupIds = new Set(
    experimentEvents
      .filter((row) => row.user_id &&
        row.metadata?.intent_campaign === PUSH55_YOUTUBE_CAMPAIGN &&
        new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS && (
          (row.name === 'email_signup_completed' && row.metadata?.is_recent_signup === true) ||
          (row.name === 'auth_callback_completed' && row.metadata?.is_new_user === true)
        ))
      .map((row) => row.user_id),
  )
  const push55SignupProfiles = externalProfiles.filter((profile) =>
    new Date(profile.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS && (
      attributionForProfile(profile).campaign === PUSH55_YOUTUBE_CAMPAIGN ||
      push55AuthoritativeSignupIds.has(profile.id)
    ),
  )
  const push55SignupIds = new Set(push55SignupProfiles.map((profile) => profile.id))
  const push55ActivationEligible = stage(
    experimentEvents,
    'activation_autostart_eligible',
    (row) => Boolean(row.user_id) && push55SignupIds.has(row.user_id) &&
      row.metadata?.campaign === PUSH55_YOUTUBE_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS,
  )
  const push55ActivationDispatched = stage(
    experimentEvents,
    'activation_autostart_dispatched',
    (row) => Boolean(row.user_id) && push55SignupIds.has(row.user_id) &&
      row.metadata?.campaign === PUSH55_YOUTUBE_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS,
  )
  const push55ActivationSkipped = stage(
    experimentEvents,
    'activation_autostart_skipped',
    (row) => Boolean(row.user_id) && push55SignupIds.has(row.user_id) &&
      row.metadata?.campaign === PUSH55_YOUTUBE_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS,
  )
  const push55AllIntentActivationEligible = stage(
    experimentEvents,
    'activation_autostart_eligible',
    (row) => row.metadata?.campaign === PUSH55_YOUTUBE_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS,
  )
  const push55AllIntentActivationDispatched = stage(
    experimentEvents,
    'activation_autostart_dispatched',
    (row) => row.metadata?.campaign === PUSH55_YOUTUBE_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS,
  )
  const push55AllIntentActivationSkipped = stage(
    experimentEvents,
    'activation_autostart_skipped',
    (row) => row.metadata?.campaign === PUSH55_YOUTUBE_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS,
  )
  const push55GenerateStarted = stage(
    experimentEvents,
    'generate_started',
    (row) => Boolean(row.user_id) && push55SignupIds.has(row.user_id) &&
      new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS,
  )
  const push55CompletedVideoUsers = new Set(
    experimentVideos
      .filter((video) => video.status === 'completed' &&
        push55SignupIds.has(video.user_id) &&
        new Date(video.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS)
      .map((video) => video.user_id),
  )
  const push55AllIntentGenerateStarted = stage(
    experimentEvents,
    'generate_started',
    (row) => Boolean(row.user_id) && push55IntentUserIds.has(row.user_id) &&
      new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS,
  )
  const push55AllIntentCompletedVideoUsers = new Set(
    experimentVideos
      .filter((video) => video.status === 'completed' &&
        push55IntentUserIds.has(video.user_id) &&
        new Date(video.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS)
      .map((video) => video.user_id),
  )
  const push55PricingViewed = stage(
    experimentEvents,
    'pricing_view',
    (row) => row.metadata?.source === PUSH55_YOUTUBE_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS,
  )
  const push55CheckoutAttempted = stage(
    experimentEvents,
    'checkout_attempted',
    (row) => row.metadata?.intent_campaign === PUSH55_YOUTUBE_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS,
  )
  const push55PostVideoOfferViewed = stage(
    experimentEvents,
    'post_video_offer_viewed',
    (row) => row.metadata?.intent_campaign === PUSH55_YOUTUBE_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS,
  )
  const push55PostVideoCleanExportClicked = stage(
    experimentEvents,
    'post_video_clean_export_clicked',
    (row) => row.metadata?.intent_campaign === PUSH55_YOUTUBE_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS,
  )
  const push55CheckoutStarted = stage(
    experimentEvents,
    'checkout_started',
    (row) => row.metadata?.intent_campaign === PUSH55_YOUTUBE_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH55_LAUNCHED_AT_MS,
  )
  const push55AllIntentRecurringSessions = experimentRecurringSessions.filter((session) => {
    return (session.created || 0) * 1000 >= PUSH55_LAUNCHED_AT_MS &&
      session.metadata?.intent_campaign === PUSH55_YOUTUBE_CAMPAIGN
  })
  const push55AllIntentActiveSubscriptions = experimentActiveSubscriptions.filter(({ subscription }) =>
    (subscription.created || 0) * 1000 >= PUSH55_LAUNCHED_AT_MS &&
      subscription.metadata?.intent_campaign === PUSH55_YOUTUBE_CAMPAIGN,
  )
  const push55RecurringSessions = push55AllIntentRecurringSessions.filter((session) => {
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
    const profile = resolveExternalProfile({
      userId: session.metadata?.supabase_user_id,
      customerId,
      subscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
      email: session.customer_details?.email || session.customer_email || session.metadata?.email,
    })
    return push55SignupIds.has(session.metadata?.supabase_user_id) ||
      (Boolean(profile?.id) && push55SignupIds.has(profile.id))
  })
  const push55ActiveSubscriptions = push55AllIntentActiveSubscriptions.filter(({ subscription, profile }) =>
    push55SignupIds.has(subscription.metadata?.supabase_user_id) ||
      (Boolean(profile?.id) && push55SignupIds.has(profile.id)),
  )
  const push55ActiveSubscriptionIds = new Set(
    push55ActiveSubscriptions.map(({ subscription }) => subscription.id),
  )
  const push55PaidRecurringCustomers = new Set(
    push55RecurringSessions
      .filter((session) => {
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id
        return session.status === 'complete' &&
          session.payment_status === 'paid' &&
          Boolean(subscriptionId) &&
          push55ActiveSubscriptionIds.has(subscriptionId)
      })
      .map((session) => {
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
        return session.metadata?.supabase_user_id || customerId || session.customer_details?.email || session.id
      }),
  )
  const push55AllIntentActiveSubscriptionIds = new Set(
    push55AllIntentActiveSubscriptions.map(({ subscription }) => subscription.id),
  )
  const push55AllIntentPaidRecurringCustomers = new Set(
    push55AllIntentRecurringSessions
      .filter((session) => {
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id
        return session.status === 'complete' &&
          session.payment_status === 'paid' &&
          Boolean(subscriptionId) &&
          push55AllIntentActiveSubscriptionIds.has(subscriptionId)
      })
      .map((session) => {
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
        return session.metadata?.supabase_user_id || customerId || session.customer_details?.email || session.id
      }),
  )

  const push58LandingSessions = stage(
    experimentEvents,
    'landing_session_started',
    (row) => row.path === '/text-to-video-shorts' &&
      new Date(row.created_at || 0).getTime() >= PUSH58_LAUNCHED_AT_MS,
  )
  const push58CtaClicked = stage(
    experimentEvents,
    'organic_cta_clicked',
    (row) => row.metadata?.source === PUSH58_TEXT_TO_VIDEO_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH58_LAUNCHED_AT_MS,
  )
  const push58TopicSubmitted = stage(
    experimentEvents,
    'organic_topic_submitted',
    (row) => row.metadata?.source === PUSH58_TEXT_TO_VIDEO_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH58_LAUNCHED_AT_MS,
  )
  const push58IntentUserIds = new Set(
    experimentEvents
      .filter((row) => row.user_id &&
        new Date(row.created_at || 0).getTime() >= PUSH58_LAUNCHED_AT_MS && (
          row.metadata?.campaign === PUSH58_TEXT_TO_VIDEO_CAMPAIGN ||
          row.metadata?.intent_campaign === PUSH58_TEXT_TO_VIDEO_CAMPAIGN ||
          row.metadata?.source === PUSH58_TEXT_TO_VIDEO_CAMPAIGN
        ))
      .map((row) => row.user_id),
  )
  const push58AuthoritativeSignupIds = new Set(
    experimentEvents
      .filter((row) => row.user_id &&
        row.metadata?.intent_campaign === PUSH58_TEXT_TO_VIDEO_CAMPAIGN &&
        new Date(row.created_at || 0).getTime() >= PUSH58_LAUNCHED_AT_MS && (
          (row.name === 'email_signup_completed' && row.metadata?.is_recent_signup === true) ||
          (row.name === 'auth_callback_completed' && row.metadata?.is_new_user === true)
        ))
      .map((row) => row.user_id),
  )
  const push58SignupProfiles = externalProfiles.filter((profile) =>
    new Date(profile.created_at || 0).getTime() >= PUSH58_LAUNCHED_AT_MS && (
      attributionForProfile(profile).campaign === PUSH58_TEXT_TO_VIDEO_CAMPAIGN ||
      push58AuthoritativeSignupIds.has(profile.id)
    ),
  )
  const push58SignupIds = new Set(push58SignupProfiles.map((profile) => profile.id))
  const push58ActivationEligible = stage(
    experimentEvents,
    'activation_autostart_eligible',
    (row) => Boolean(row.user_id) && push58SignupIds.has(row.user_id) &&
      row.metadata?.campaign === PUSH58_TEXT_TO_VIDEO_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH58_LAUNCHED_AT_MS,
  )
  const push58ActivationDispatched = stage(
    experimentEvents,
    'activation_autostart_dispatched',
    (row) => Boolean(row.user_id) && push58SignupIds.has(row.user_id) &&
      row.metadata?.campaign === PUSH58_TEXT_TO_VIDEO_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH58_LAUNCHED_AT_MS,
  )
  const push58GenerateStarted = stage(
    experimentEvents,
    'generate_started',
    (row) => Boolean(row.user_id) && push58SignupIds.has(row.user_id) &&
      new Date(row.created_at || 0).getTime() >= PUSH58_LAUNCHED_AT_MS,
  )
  const push58CompletedVideoUsers = new Set(
    experimentVideos
      .filter((video) => video.status === 'completed' &&
        push58SignupIds.has(video.user_id) &&
        new Date(video.created_at || 0).getTime() >= PUSH58_LAUNCHED_AT_MS)
      .map((video) => video.user_id),
  )
  const push58PricingViewed = stage(
    experimentEvents,
    'pricing_view',
    (row) => row.metadata?.source === PUSH58_TEXT_TO_VIDEO_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH58_LAUNCHED_AT_MS,
  )
  const push58CheckoutAttempted = stage(
    experimentEvents,
    'checkout_attempted',
    (row) => row.metadata?.intent_campaign === PUSH58_TEXT_TO_VIDEO_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH58_LAUNCHED_AT_MS,
  )
  const push58CheckoutStarted = stage(
    experimentEvents,
    'checkout_started',
    (row) => row.metadata?.intent_campaign === PUSH58_TEXT_TO_VIDEO_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH58_LAUNCHED_AT_MS,
  )
  const push58AllIntentRecurringSessions = experimentRecurringSessions.filter((session) =>
    (session.created || 0) * 1000 >= PUSH58_LAUNCHED_AT_MS &&
      session.metadata?.intent_campaign === PUSH58_TEXT_TO_VIDEO_CAMPAIGN,
  )
  const push58AllIntentActiveSubscriptions = experimentActiveSubscriptions.filter(({ subscription }) =>
    (subscription.created || 0) * 1000 >= PUSH58_LAUNCHED_AT_MS &&
      subscription.metadata?.intent_campaign === PUSH58_TEXT_TO_VIDEO_CAMPAIGN,
  )
  const push58AllIntentActiveSubscriptionIds = new Set(
    push58AllIntentActiveSubscriptions.map(({ subscription }) => subscription.id),
  )
  const push58AllIntentPaidRecurringCustomers = new Set(
    push58AllIntentRecurringSessions
      .filter((session) => {
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id
        return session.status === 'complete' &&
          session.payment_status === 'paid' &&
          Boolean(subscriptionId) &&
          push58AllIntentActiveSubscriptionIds.has(subscriptionId)
      })
      .map((session) => {
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
        return session.metadata?.supabase_user_id || customerId || session.customer_details?.email || session.id
      }),
  )

  const push60LandingSessions = stage(
    experimentEvents,
    'landing_session_started',
    (row) => row.path === '/free-ai-shorts-generator' &&
      new Date(row.created_at || 0).getTime() >= PUSH60_LAUNCHED_AT_MS,
  )
  const push60CtaClicked = stage(
    experimentEvents,
    'organic_cta_clicked',
    (row) => row.metadata?.source === PUSH60_FREE_GENERATOR_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH60_LAUNCHED_AT_MS,
  )
  const push60TopicSubmitted = stage(
    experimentEvents,
    'organic_topic_submitted',
    (row) => row.metadata?.source === PUSH60_FREE_GENERATOR_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH60_LAUNCHED_AT_MS,
  )
  const push60AuthoritativeSignupIds = new Set(
    experimentEvents
      .filter((row) => row.user_id &&
        row.metadata?.intent_campaign === PUSH60_FREE_GENERATOR_CAMPAIGN &&
        new Date(row.created_at || 0).getTime() >= PUSH60_LAUNCHED_AT_MS && (
          (row.name === 'email_signup_completed' && row.metadata?.is_recent_signup === true) ||
          (row.name === 'auth_callback_completed' && row.metadata?.is_new_user === true)
        ))
      .map((row) => row.user_id),
  )
  const push60SignupProfiles = externalProfiles.filter((profile) =>
    new Date(profile.created_at || 0).getTime() >= PUSH60_LAUNCHED_AT_MS && (
      attributionForProfile(profile).campaign === PUSH60_FREE_GENERATOR_CAMPAIGN ||
      push60AuthoritativeSignupIds.has(profile.id)
    ),
  )
  const push60SignupIds = new Set(push60SignupProfiles.map((profile) => profile.id))
  const push60ActivationEligible = stage(
    experimentEvents,
    'activation_autostart_eligible',
    (row) => Boolean(row.user_id) && push60SignupIds.has(row.user_id) &&
      row.metadata?.campaign === PUSH60_FREE_GENERATOR_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH60_LAUNCHED_AT_MS,
  )
  const push60ActivationDispatched = stage(
    experimentEvents,
    'activation_autostart_dispatched',
    (row) => Boolean(row.user_id) && push60SignupIds.has(row.user_id) &&
      row.metadata?.campaign === PUSH60_FREE_GENERATOR_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH60_LAUNCHED_AT_MS,
  )
  const push60GenerateStarted = stage(
    experimentEvents,
    'generate_started',
    (row) => Boolean(row.user_id) && push60SignupIds.has(row.user_id) &&
      new Date(row.created_at || 0).getTime() >= PUSH60_LAUNCHED_AT_MS,
  )
  const push60CompletedVideoUsers = new Set(
    experimentVideos
      .filter((video) => video.status === 'completed' &&
        push60SignupIds.has(video.user_id) &&
        new Date(video.created_at || 0).getTime() >= PUSH60_LAUNCHED_AT_MS)
      .map((video) => video.user_id),
  )
  const push60PricingViewed = stage(
    experimentEvents,
    'pricing_view',
    (row) => row.metadata?.source === PUSH60_FREE_GENERATOR_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH60_LAUNCHED_AT_MS,
  )
  const push60CheckoutAttempted = stage(
    experimentEvents,
    'checkout_attempted',
    (row) => row.metadata?.intent_campaign === PUSH60_FREE_GENERATOR_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH60_LAUNCHED_AT_MS,
  )
  const push60CheckoutStarted = stage(
    experimentEvents,
    'checkout_started',
    (row) => row.metadata?.intent_campaign === PUSH60_FREE_GENERATOR_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH60_LAUNCHED_AT_MS,
  )
  const push60AllIntentRecurringSessions = experimentRecurringSessions.filter((session) =>
    (session.created || 0) * 1000 >= PUSH60_LAUNCHED_AT_MS &&
      session.metadata?.intent_campaign === PUSH60_FREE_GENERATOR_CAMPAIGN,
  )
  const push60AllIntentActiveSubscriptions = experimentActiveSubscriptions.filter(({ subscription }) =>
    (subscription.created || 0) * 1000 >= PUSH60_LAUNCHED_AT_MS &&
      subscription.metadata?.intent_campaign === PUSH60_FREE_GENERATOR_CAMPAIGN,
  )
  const push60AllIntentActiveSubscriptionIds = new Set(
    push60AllIntentActiveSubscriptions.map(({ subscription }) => subscription.id),
  )
  const push60AllIntentPaidRecurringCustomers = new Set(
    push60AllIntentRecurringSessions
      .filter((session) => {
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id
        return session.status === 'complete' &&
          session.payment_status === 'paid' &&
          Boolean(subscriptionId) &&
          push60AllIntentActiveSubscriptionIds.has(subscriptionId)
      })
      .map((session) => {
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
        return session.metadata?.supabase_user_id || customerId || session.customer_details?.email || session.id
      }),
  )

  const isPush63Campaign = (value) =>
    String(value || '').startsWith(PUSH63_NICHE_CAMPAIGN_PREFIX)
  const push63LandingSessions = stage(
    experimentEvents,
    'landing_session_started',
    (row) => (row.path === '/free-ai-shorts' || String(row.path || '').startsWith('/free-ai-shorts/')) &&
      new Date(row.created_at || 0).getTime() >= PUSH63_LAUNCHED_AT_MS,
  )
  const push63CtaClicked = stage(
    experimentEvents,
    'organic_cta_clicked',
    (row) => isPush63Campaign(row.metadata?.source) &&
      new Date(row.created_at || 0).getTime() >= PUSH63_LAUNCHED_AT_MS,
  )
  const push63AuthoritativeSignupIds = new Set(
    experimentEvents
      .filter((row) => row.user_id &&
        isPush63Campaign(row.metadata?.intent_campaign) &&
        new Date(row.created_at || 0).getTime() >= PUSH63_LAUNCHED_AT_MS && (
          (row.name === 'email_signup_completed' && row.metadata?.is_recent_signup === true) ||
          (row.name === 'auth_callback_completed' && row.metadata?.is_new_user === true)
        ))
      .map((row) => row.user_id),
  )
  const push63SignupProfiles = externalProfiles.filter((profile) =>
    new Date(profile.created_at || 0).getTime() >= PUSH63_LAUNCHED_AT_MS && (
      isPush63Campaign(attributionForProfile(profile).campaign) ||
      push63AuthoritativeSignupIds.has(profile.id)
    ),
  )
  const push63SignupIds = new Set(push63SignupProfiles.map((profile) => profile.id))
  const push63ActivationEligible = stage(
    experimentEvents,
    'activation_autostart_eligible',
    (row) => Boolean(row.user_id) && push63SignupIds.has(row.user_id) &&
      isPush63Campaign(row.metadata?.campaign) &&
      new Date(row.created_at || 0).getTime() >= PUSH63_LAUNCHED_AT_MS,
  )
  const push63ActivationDispatched = stage(
    experimentEvents,
    'activation_autostart_dispatched',
    (row) => Boolean(row.user_id) && push63SignupIds.has(row.user_id) &&
      isPush63Campaign(row.metadata?.campaign) &&
      new Date(row.created_at || 0).getTime() >= PUSH63_LAUNCHED_AT_MS,
  )
  const push63GenerateStarted = stage(
    experimentEvents,
    'generate_started',
    (row) => Boolean(row.user_id) && push63SignupIds.has(row.user_id) &&
      new Date(row.created_at || 0).getTime() >= PUSH63_LAUNCHED_AT_MS,
  )
  const push63CompletedVideoUsers = new Set(
    experimentVideos
      .filter((video) => video.status === 'completed' &&
        push63SignupIds.has(video.user_id) &&
        new Date(video.created_at || 0).getTime() >= PUSH63_LAUNCHED_AT_MS)
      .map((video) => video.user_id),
  )
  const push63PricingViewed = stage(
    experimentEvents,
    'pricing_view',
    (row) => isPush63Campaign(row.metadata?.source) &&
      new Date(row.created_at || 0).getTime() >= PUSH63_LAUNCHED_AT_MS,
  )
  const push63CheckoutAttempted = stage(
    experimentEvents,
    'checkout_attempted',
    (row) => isPush63Campaign(row.metadata?.intent_campaign) &&
      new Date(row.created_at || 0).getTime() >= PUSH63_LAUNCHED_AT_MS,
  )
  const push63CheckoutStarted = stage(
    experimentEvents,
    'checkout_started',
    (row) => isPush63Campaign(row.metadata?.intent_campaign) &&
      new Date(row.created_at || 0).getTime() >= PUSH63_LAUNCHED_AT_MS,
  )
  const push63AllIntentRecurringSessions = experimentRecurringSessions.filter((session) =>
    (session.created || 0) * 1000 >= PUSH63_LAUNCHED_AT_MS &&
      isPush63Campaign(session.metadata?.intent_campaign),
  )
  const push63AllIntentActiveSubscriptions = experimentActiveSubscriptions.filter(({ subscription }) =>
    (subscription.created || 0) * 1000 >= PUSH63_LAUNCHED_AT_MS &&
      isPush63Campaign(subscription.metadata?.intent_campaign),
  )
  const push63AllIntentActiveSubscriptionIds = new Set(
    push63AllIntentActiveSubscriptions.map(({ subscription }) => subscription.id),
  )
  const push63AllIntentPaidRecurringCustomers = new Set(
    push63AllIntentRecurringSessions
      .filter((session) => {
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id
        return session.status === 'complete' &&
          session.payment_status === 'paid' &&
          Boolean(subscriptionId) &&
          push63AllIntentActiveSubscriptionIds.has(subscriptionId)
      })
      .map((session) => {
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
        return session.metadata?.supabase_user_id || customerId || session.customer_details?.email || session.id
      }),
  )

  const push65LandingSessions = stage(
    experimentEvents,
    'landing_session_started',
    (row) => row.path === '/from-saashub' &&
      new Date(row.created_at || 0).getTime() >= PUSH65_LAUNCHED_AT_MS,
  )
  const push65BridgeViewed = stage(
    experimentEvents,
    'directory_bridge_viewed',
    (row) => row.path === '/from-saashub' &&
      row.metadata?.source === PUSH65_SAASHUB_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH65_LAUNCHED_AT_MS,
  )
  const push65TopicSubmitted = stage(
    experimentEvents,
    'organic_topic_submitted',
    (row) => row.metadata?.source === PUSH65_SAASHUB_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH65_LAUNCHED_AT_MS,
  )
  const push65AuthoritativeSignupIds = new Set(
    experimentEvents
      .filter((row) => row.user_id &&
        row.metadata?.intent_campaign === PUSH65_SAASHUB_CAMPAIGN &&
        new Date(row.created_at || 0).getTime() >= PUSH65_LAUNCHED_AT_MS && (
          (row.name === 'email_signup_completed' && row.metadata?.is_recent_signup === true) ||
          (row.name === 'auth_callback_completed' && row.metadata?.is_new_user === true)
        ))
      .map((row) => row.user_id),
  )
  const push65SignupProfiles = externalProfiles.filter((profile) =>
    new Date(profile.created_at || 0).getTime() >= PUSH65_LAUNCHED_AT_MS && (
      attributionForProfile(profile).campaign === PUSH65_SAASHUB_CAMPAIGN ||
      push65AuthoritativeSignupIds.has(profile.id)
    ),
  )
  const push65SignupIds = new Set(push65SignupProfiles.map((profile) => profile.id))
  const push65ActivationEligible = stage(
    experimentEvents,
    'activation_autostart_eligible',
    (row) => Boolean(row.user_id) && push65SignupIds.has(row.user_id) &&
      row.metadata?.campaign === PUSH65_SAASHUB_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH65_LAUNCHED_AT_MS,
  )
  const push65ActivationDispatched = stage(
    experimentEvents,
    'activation_autostart_dispatched',
    (row) => Boolean(row.user_id) && push65SignupIds.has(row.user_id) &&
      row.metadata?.campaign === PUSH65_SAASHUB_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH65_LAUNCHED_AT_MS,
  )
  const push65CompletedVideoUsers = new Set(
    experimentVideos
      .filter((video) => video.status === 'completed' &&
        push65SignupIds.has(video.user_id) &&
        new Date(video.created_at || 0).getTime() >= PUSH65_LAUNCHED_AT_MS)
      .map((video) => video.user_id),
  )
  const push65PricingViewed = stage(
    experimentEvents,
    'pricing_view',
    (row) => row.metadata?.source === PUSH65_SAASHUB_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH65_LAUNCHED_AT_MS,
  )
  const push65CheckoutAttempted = stage(
    experimentEvents,
    'checkout_attempted',
    (row) => row.metadata?.intent_campaign === PUSH65_SAASHUB_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH65_LAUNCHED_AT_MS,
  )
  const push65CheckoutStarted = stage(
    experimentEvents,
    'checkout_started',
    (row) => row.metadata?.intent_campaign === PUSH65_SAASHUB_CAMPAIGN &&
      new Date(row.created_at || 0).getTime() >= PUSH65_LAUNCHED_AT_MS,
  )
  const push65RecurringSessions = experimentRecurringSessions.filter((session) =>
    (session.created || 0) * 1000 >= PUSH65_LAUNCHED_AT_MS &&
      session.metadata?.intent_campaign === PUSH65_SAASHUB_CAMPAIGN,
  )
  const push65ActiveSubscriptions = experimentActiveSubscriptions.filter(({ subscription }) =>
    (subscription.created || 0) * 1000 >= PUSH65_LAUNCHED_AT_MS &&
      subscription.metadata?.intent_campaign === PUSH65_SAASHUB_CAMPAIGN,
  )
  const push65ActiveSubscriptionIds = new Set(
    push65ActiveSubscriptions.map(({ subscription }) => subscription.id),
  )
  const push65PaidRecurringCustomers = new Set(
    push65RecurringSessions
      .filter((session) => {
        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id
        return session.status === 'complete' &&
          session.payment_status === 'paid' &&
          Boolean(subscriptionId) &&
          push65ActiveSubscriptionIds.has(subscriptionId)
      })
      .map((session) => {
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
        return session.metadata?.supabase_user_id || customerId || session.customer_details?.email || session.id
      }),
  )

  const report = {
    generatedAt: new Date().toISOString(),
    window: { days, cutoff, experimentDataCutoff: dataCutoff },
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
        checkpointed: activationAutostartCheckpointed,
        failed: activationAutostartFailed,
        skipped: activationAutostartSkipped,
        recovery: {
          eligible: activationAutostartRecoveryEligible,
          dispatched: activationAutostartRecoveryDispatched,
        },
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
      push53HomePromptFirst: {
        measurementStartsAt: new Date(PUSH53_LAUNCHED_AT_MS).toISOString(),
        viewed: push53HomeViewed,
        signedOutViewed: push53SignedOutViewed,
        topicSubmitted: push53TopicSubmitted,
        signedOutTopicSubmitted: push53SignedOutTopicSubmitted,
        activationAutostart: {
          eligible: push53ActivationEligible,
          dispatched: push53ActivationDispatched,
          skipped: push53ActivationSkipped,
        },
        allIntentActivationAutostart: {
          eligible: push53AllIntentActivationEligible,
          dispatched: push53AllIntentActivationDispatched,
          skipped: push53AllIntentActivationSkipped,
        },
        signups: push53SignupProfiles.length,
        generateStarted: push53GenerateStarted,
        signupCohortWithCompletedVideo: push53CompletedVideoUsers.size,
        renderRecovery: {
          checkpointSaved: push53CheckpointSaved,
          renderResumed: push53RenderResumed,
        },
        pricingViewed: push53PricingViewed,
        checkoutAttempted: push53CheckoutAttempted,
        recurringStripeSessions: {
          total: push53RecurringSessions.length,
          open: push53RecurringSessions.filter((session) => session.status === 'open').length,
          complete: push53RecurringSessions.filter((session) => session.status === 'complete').length,
          expired: push53RecurringSessions.filter((session) => session.status === 'expired').length,
          paid: push53RecurringSessions.filter((session) => session.payment_status === 'paid').length,
        },
        activeSubscriptions: push53ActiveSubscriptions.filter(({ subscription }) => subscription.status === 'active').length,
        trialingSubscriptions: push53ActiveSubscriptions.filter(({ subscription }) => subscription.status === 'trialing').length,
        paidRecurringCustomers: push53PaidRecurringCustomers.size,
        allIntentMonetization: {
          recurringStripeSessions: {
            total: push53AllIntentRecurringSessions.length,
            paid: push53AllIntentRecurringSessions.filter((session) => session.payment_status === 'paid').length,
          },
          activeSubscriptions: push53AllIntentActiveSubscriptions.filter(({ subscription }) => subscription.status === 'active').length,
          trialingSubscriptions: push53AllIntentActiveSubscriptions.filter(({ subscription }) => subscription.status === 'trialing').length,
          paidRecurringCustomers: push53AllIntentPaidRecurringCustomers.size,
        },
      },
      push55YouTubeRelatedBridge: {
        measurementStartsAt: new Date(PUSH55_LAUNCHED_AT_MS).toISOString(),
        landingSessions: push55LandingSessions,
        bridgeViewed: push55BridgeViewed,
        signedOutViewed: push55SignedOutViewed,
        examplePlayed: push55ExamplePlayed,
        topicSubmitted: push55TopicSubmitted,
        signedOutTopicSubmitted: push55SignedOutTopicSubmitted,
        newSignupCohort: {
          signups: push55SignupProfiles.length,
          activationAutostart: {
            eligible: push55ActivationEligible,
            dispatched: push55ActivationDispatched,
            skipped: push55ActivationSkipped,
          },
          generateStarted: push55GenerateStarted,
          completedFirstVideoUsers: push55CompletedVideoUsers.size,
          recurringStripeSessions: {
            total: push55RecurringSessions.length,
            open: push55RecurringSessions.filter((session) => session.status === 'open').length,
            complete: push55RecurringSessions.filter((session) => session.status === 'complete').length,
            expired: push55RecurringSessions.filter((session) => session.status === 'expired').length,
            paid: push55RecurringSessions.filter((session) => session.payment_status === 'paid').length,
          },
          activeSubscriptions: push55ActiveSubscriptions.filter(({ subscription }) => subscription.status === 'active').length,
          trialingSubscriptions: push55ActiveSubscriptions.filter(({ subscription }) => subscription.status === 'trialing').length,
          paidRecurringCustomers: push55PaidRecurringCustomers.size,
        },
        allIntentActivationAutostart: {
          eligible: push55AllIntentActivationEligible,
          dispatched: push55AllIntentActivationDispatched,
          skipped: push55AllIntentActivationSkipped,
        },
        allIntentActivation: {
          generateStarted: push55AllIntentGenerateStarted,
          completedVideoUsers: push55AllIntentCompletedVideoUsers.size,
        },
        allIntentMonetization: {
          attribution: 'direct_intent_campaign_only',
          pricingViewed: push55PricingViewed,
          postVideoOfferViewed: push55PostVideoOfferViewed,
          postVideoCleanExportClicked: push55PostVideoCleanExportClicked,
          checkoutAttempted: push55CheckoutAttempted,
          checkoutStarted: push55CheckoutStarted,
          recurringStripeSessions: {
            total: push55AllIntentRecurringSessions.length,
            open: push55AllIntentRecurringSessions.filter((session) => session.status === 'open').length,
            complete: push55AllIntentRecurringSessions.filter((session) => session.status === 'complete').length,
            expired: push55AllIntentRecurringSessions.filter((session) => session.status === 'expired').length,
            paid: push55AllIntentRecurringSessions.filter((session) => session.payment_status === 'paid').length,
          },
          activeSubscriptions: push55AllIntentActiveSubscriptions.filter(({ subscription }) => subscription.status === 'active').length,
          trialingSubscriptions: push55AllIntentActiveSubscriptions.filter(({ subscription }) => subscription.status === 'trialing').length,
          paidRecurringCustomers: push55AllIntentPaidRecurringCustomers.size,
        },
      },
      push58TextToVideoShorts: {
        measurementStartsAt: new Date(PUSH58_LAUNCHED_AT_MS).toISOString(),
        landingSessions: push58LandingSessions,
        ctaClicked: push58CtaClicked,
        topicSubmitted: push58TopicSubmitted,
        newSignupCohort: {
          signups: push58SignupProfiles.length,
          activationAutostart: {
            eligible: push58ActivationEligible,
            dispatched: push58ActivationDispatched,
          },
          generateStarted: push58GenerateStarted,
          completedFirstVideoUsers: push58CompletedVideoUsers.size,
        },
        monetization: {
          pricingViewed: push58PricingViewed,
          checkoutAttempted: push58CheckoutAttempted,
          checkoutStarted: push58CheckoutStarted,
          recurringStripeSessions: {
            total: push58AllIntentRecurringSessions.length,
            open: push58AllIntentRecurringSessions.filter((session) => session.status === 'open').length,
            complete: push58AllIntentRecurringSessions.filter((session) => session.status === 'complete').length,
            expired: push58AllIntentRecurringSessions.filter((session) => session.status === 'expired').length,
            paid: push58AllIntentRecurringSessions.filter((session) => session.payment_status === 'paid').length,
          },
          activeSubscriptions: push58AllIntentActiveSubscriptions.filter(({ subscription }) => subscription.status === 'active').length,
          trialingSubscriptions: push58AllIntentActiveSubscriptions.filter(({ subscription }) => subscription.status === 'trialing').length,
          paidRecurringCustomers: push58AllIntentPaidRecurringCustomers.size,
        },
      },
      push60FreeAiShortsGenerator: {
        measurementStartsAt: new Date(PUSH60_LAUNCHED_AT_MS).toISOString(),
        landingSessions: push60LandingSessions,
        ctaClicked: push60CtaClicked,
        topicSubmitted: push60TopicSubmitted,
        newSignupCohort: {
          signups: push60SignupProfiles.length,
          activationAutostart: {
            eligible: push60ActivationEligible,
            dispatched: push60ActivationDispatched,
          },
          generateStarted: push60GenerateStarted,
          completedFirstVideoUsers: push60CompletedVideoUsers.size,
        },
        monetization: {
          pricingViewed: push60PricingViewed,
          checkoutAttempted: push60CheckoutAttempted,
          checkoutStarted: push60CheckoutStarted,
          recurringStripeSessions: {
            total: push60AllIntentRecurringSessions.length,
            open: push60AllIntentRecurringSessions.filter((session) => session.status === 'open').length,
            complete: push60AllIntentRecurringSessions.filter((session) => session.status === 'complete').length,
            expired: push60AllIntentRecurringSessions.filter((session) => session.status === 'expired').length,
            paid: push60AllIntentRecurringSessions.filter((session) => session.payment_status === 'paid').length,
          },
          activeSubscriptions: push60AllIntentActiveSubscriptions.filter(({ subscription }) => subscription.status === 'active').length,
          trialingSubscriptions: push60AllIntentActiveSubscriptions.filter(({ subscription }) => subscription.status === 'trialing').length,
          paidRecurringCustomers: push60AllIntentPaidRecurringCustomers.size,
        },
      },
      push63NicheActivationIntent: {
        measurementStartsAt: new Date(PUSH63_LAUNCHED_AT_MS).toISOString(),
        landingSessions: push63LandingSessions,
        ctaClicked: push63CtaClicked,
        newSignupCohort: {
          signups: push63SignupProfiles.length,
          activationAutostart: {
            eligible: push63ActivationEligible,
            dispatched: push63ActivationDispatched,
          },
          generateStarted: push63GenerateStarted,
          completedFirstVideoUsers: push63CompletedVideoUsers.size,
        },
        monetization: {
          pricingViewed: push63PricingViewed,
          checkoutAttempted: push63CheckoutAttempted,
          checkoutStarted: push63CheckoutStarted,
          recurringStripeSessions: {
            total: push63AllIntentRecurringSessions.length,
            open: push63AllIntentRecurringSessions.filter((session) => session.status === 'open').length,
            complete: push63AllIntentRecurringSessions.filter((session) => session.status === 'complete').length,
            expired: push63AllIntentRecurringSessions.filter((session) => session.status === 'expired').length,
            paid: push63AllIntentRecurringSessions.filter((session) => session.payment_status === 'paid').length,
          },
          activeSubscriptions: push63AllIntentActiveSubscriptions.filter(({ subscription }) => subscription.status === 'active').length,
          trialingSubscriptions: push63AllIntentActiveSubscriptions.filter(({ subscription }) => subscription.status === 'trialing').length,
          paidRecurringCustomers: push63AllIntentPaidRecurringCustomers.size,
        },
      },
      push65SaaSHubDirectoryBridge: {
        measurementStartsAt: new Date(PUSH65_LAUNCHED_AT_MS).toISOString(),
        landingSessions: push65LandingSessions,
        bridgeViewed: push65BridgeViewed,
        topicSubmitted: push65TopicSubmitted,
        newSignupCohort: {
          signups: push65SignupProfiles.length,
          activationAutostart: {
            eligible: push65ActivationEligible,
            dispatched: push65ActivationDispatched,
          },
          completedFirstVideoUsers: push65CompletedVideoUsers.size,
        },
        monetization: {
          pricingViewed: push65PricingViewed,
          checkoutAttempted: push65CheckoutAttempted,
          checkoutStarted: push65CheckoutStarted,
          recurringStripeSessions: {
            total: push65RecurringSessions.length,
            open: push65RecurringSessions.filter((session) => session.status === 'open').length,
            complete: push65RecurringSessions.filter((session) => session.status === 'complete').length,
            expired: push65RecurringSessions.filter((session) => session.status === 'expired').length,
            paid: push65RecurringSessions.filter((session) => session.payment_status === 'paid').length,
          },
          activeSubscriptions: push65ActiveSubscriptions.filter(({ subscription }) => subscription.status === 'active').length,
          trialingSubscriptions: push65ActiveSubscriptions.filter(({ subscription }) => subscription.status === 'trialing').length,
          paidRecurringCustomers: push65PaidRecurringCustomers.size,
        },
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
