import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

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
    .select('id,email,created_at,utm_source,signup_utm_source,signup_referrer'))
  const internalIds = new Set()
  for (const user of authUsers) if (isInternalEmail(user.email)) internalIds.add(user.id)
  for (const profile of profiles) if (isInternalEmail(profile.email)) internalIds.add(profile.id)

  const externalProfiles = profiles.filter((profile) => !internalIds.has(profile.id))
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
    newActiveSubscriptions.push(subscription)
  }

  const landingRows = externalEvents.filter((row) => row.name === 'landing_session_started')
  const landingPaths = {}
  for (const row of landingRows) {
    const path = row.path || '(none)'
    landingPaths[path] = (landingPaths[path] || 0) + 1
  }

  const signupSources = {}
  for (const profile of signupCohort) {
    const source = sourceForProfile(profile)
    signupSources[source] = (signupSources[source] || 0) + 1
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
    acquisition: {
      signupSources,
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
