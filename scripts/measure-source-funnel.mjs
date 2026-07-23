import fs from 'node:fs'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

function loadEnv(path) {
  const values = {}
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
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

function sourceForProfile(profile) {
  const source = profile.signup_utm_source || profile.utm_source
  if (source) return String(source).trim().toLowerCase()
  const referrer = String(profile.signup_referrer || '').toLowerCase()
  if (referrer.includes('chatgpt.com') || referrer.includes('openai.com')) return 'chatgpt'
  if (referrer.includes('theresanaiforthat.com')) return 'taaft'
  if (referrer.includes('youtube.com') || referrer.includes('youtu.be')) return 'youtube'
  if (referrer.includes('google.')) return 'google'
  return 'direct_or_unknown'
}

function safeReferrerRoute(raw) {
  try {
    const url = new URL(String(raw || ''))
    return `${url.hostname.toLowerCase()}${url.pathname}`.slice(0, 240)
  } catch {
    return 'unknown'
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
    startingAfter = page.data.at(-1).id
  }
}

function percentage(numerator, denominator) {
  return denominator ? Number(((numerator / denominator) * 100).toFixed(1)) : 0
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1)
}

const daysArg = process.argv.find((arg) => arg.startsWith('--days='))
const days = Number(daysArg?.split('=')[1] || 7)
if (!Number.isFinite(days) || days <= 0 || days > 365) {
  throw new Error('--days must be between 1 and 365')
}

const env = loadEnv('.env.local')
if (!env.STRIPE_SECRET_KEY || !env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Stripe or Supabase credentials in .env.local')
}

const now = Date.now()
const cutoff = new Date(now - days * 24 * 60 * 60 * 1000).toISOString()
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const stripe = new Stripe(env.STRIPE_SECRET_KEY)

const profiles = await fetchAll(() => db
  .from('profiles')
  .select('id,email,created_at,utm_source,signup_utm_source,signup_referrer,stripe_customer_id,stripe_subscription_id')
  .gte('created_at', cutoff)
  .order('created_at', { ascending: true }))
const cohort = profiles.filter((profile) => !isInternalEmail(profile.email))
const profileById = new Map(cohort.map((profile) => [profile.id, profile]))
const profileByCustomer = new Map(cohort.filter((p) => p.stripe_customer_id).map((p) => [p.stripe_customer_id, p]))

const events = await fetchAll(() => db
  .from('events')
  .select('name,user_id,created_at,metadata')
  .gte('created_at', cutoff)
  .order('created_at', { ascending: true }))
const externalEvents = events.filter((event) => event.user_id && profileById.has(event.user_id))

const videos = await fetchAll(() => db
  .from('videos')
  .select('user_id,render_id,status,created_at')
  .gte('created_at', cutoff)
  .order('created_at', { ascending: true }))

const renderJobs = await fetchAll(() => db
  .from('render_jobs')
  .select('user_id,render_id,quality,created_at')
  .gte('created_at', cutoff)
  .order('created_at', { ascending: true }))

const sessions = await stripeListAll((startingAfter) => stripe.checkout.sessions.list({
  limit: 100,
  created: { gte: Math.floor(new Date(cutoff).getTime() / 1000) },
  ...(startingAfter ? { starting_after: startingAfter } : {}),
}))

const subscriptions = await stripeListAll((startingAfter) => stripe.subscriptions.list({
  limit: 100,
  created: { gte: Math.floor(new Date(cutoff).getTime() / 1000) },
  status: 'all',
  ...(startingAfter ? { starting_after: startingAfter } : {}),
}))

function resolveProfileForStripe(row) {
  const userId = row.metadata?.supabase_user_id
  if (userId && profileById.has(userId)) return profileById.get(userId)
  const customerId = typeof row.customer === 'string' ? row.customer : row.customer?.id
  return customerId ? profileByCustomer.get(customerId) : null
}

const sources = [...new Set(cohort.map(sourceForProfile))]
const sourceRows = sources.map((source) => {
  const members = cohort.filter((profile) => sourceForProfile(profile) === source)
  const ids = new Set(members.map((profile) => profile.id))
  const memberEvents = externalEvents.filter((event) => ids.has(event.user_id))
  const completedVideoUsers = new Set(videos
    .filter((video) => ids.has(video.user_id) && video.status === 'completed')
    .map((video) => video.user_id))
  const generatedUsers = new Set(memberEvents
    .filter((event) => event.name === 'generate_started')
    .map((event) => event.user_id))
  const pricingUsers = new Set(memberEvents
    .filter((event) => event.name === 'pricing_view')
    .map((event) => event.user_id))
  const checkoutAttemptUsers = new Set(memberEvents
    .filter((event) => event.name === 'checkout_attempted')
    .map((event) => event.user_id))
  const postVideoOfferUsers = new Set(memberEvents
    .filter((event) => event.name === 'post_video_offer_viewed')
    .map((event) => event.user_id))
  const postVideoCurrencyUsers = new Set(memberEvents
    .filter((event) => event.name === 'post_video_currency_resolved')
    .map((event) => event.user_id))
  const postVideoCleanExportUsers = new Set(memberEvents
    .filter((event) => event.name === 'post_video_clean_export_clicked')
    .map((event) => event.user_id))
  const inlinePricingCurrencyUsers = new Set(memberEvents
    .filter((event) => event.name === 'inline_pricing_currency_resolved')
    .map((event) => event.user_id))
  const inlinePricingCheckoutUsers = new Set(memberEvents
    .filter((event) => event.name === 'inline_pricing_checkout_clicked')
    .map((event) => event.user_id))
  const failedUsers = new Set(memberEvents
    .filter((event) => event.name === 'video_generation_failed')
    .map((event) => event.user_id))
  const checkpointUsers = new Set(memberEvents
    .filter((event) => event.name === 'generation_checkpoint_saved')
    .map((event) => event.user_id))
  const completionEventUsers = new Set(memberEvents
    .filter((event) => event.name === 'video_generation_completed')
    .map((event) => event.user_id))
  const renderJobUsers = new Set(renderJobs
    .filter((job) => ids.has(job.user_id))
    .map((job) => job.user_id))
  const sourceJobs = renderJobs.filter((job) => ids.has(job.user_id))
  const completedRenderIds = new Set(videos
    .filter((video) => ids.has(video.user_id) && video.status === 'completed' && video.render_id)
    .map((video) => video.render_id))
  const matureUnmatchedJobs = sourceJobs.filter((job) =>
    new Date(job.created_at || 0).getTime() < now - 20 * 60 * 1000 &&
    !completedRenderIds.has(job.render_id)
  )
  const jobQuality = new Map()
  const matureUnmatchedQuality = new Map()
  for (const job of sourceJobs) increment(jobQuality, String(job.quality || 'unknown'))
  for (const job of matureUnmatchedJobs) increment(matureUnmatchedQuality, String(job.quality || 'unknown'))
  const videoStatuses = new Map()
  for (const video of videos.filter((row) => ids.has(row.user_id))) {
    increment(videoStatuses, String(video.status || 'unknown'))
  }
  const sourceSessions = sessions.filter((session) => {
    const profile = resolveProfileForStripe(session)
    return profile && ids.has(profile.id) && session.mode === 'subscription'
  })
  const sourceSubscriptions = subscriptions.filter((subscription) => {
    const profile = resolveProfileForStripe(subscription)
    return profile && ids.has(profile.id) && ['active', 'trialing'].includes(subscription.status)
  })

  return {
    source,
    signups: members.length,
    generated: generatedUsers.size,
    checkpointed: checkpointUsers.size,
    renderJobCreated: renderJobUsers.size,
    renderJobs: sourceJobs.length,
    matureUnmatchedRenderJobs: matureUnmatchedJobs.length,
    renderJobsByQuality: Object.fromEntries([...jobQuality.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    matureUnmatchedByQuality: Object.fromEntries([...matureUnmatchedQuality.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    completionEvent: completionEventUsers.size,
    completedVideo: completedVideoUsers.size,
    postVideoOfferViewed: postVideoOfferUsers.size,
    postVideoCurrencyResolved: postVideoCurrencyUsers.size,
    postVideoCleanExportClicked: postVideoCleanExportUsers.size,
    inlinePricingCurrencyResolved: inlinePricingCurrencyUsers.size,
    inlinePricingCheckoutClicked: inlinePricingCheckoutUsers.size,
    pricing: pricingUsers.size,
    checkoutAttempted: checkoutAttemptUsers.size,
    recurringSessions: sourceSessions.length,
    paidSessions: sourceSessions.filter((session) => session.payment_status === 'paid').length,
    activeOrTrialingSubscriptions: sourceSubscriptions.length,
    generationFailures: failedUsers.size,
    videoStatuses: Object.fromEntries([...videoStatuses.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
    rates: {
      signupToGenerate: percentage(generatedUsers.size, members.length),
      signupToCompletedVideo: percentage(completedVideoUsers.size, members.length),
      completedVideoToOfferViewed: percentage(postVideoOfferUsers.size, completedVideoUsers.size),
      offerViewedToCleanExportClick: percentage(postVideoCleanExportUsers.size, postVideoOfferUsers.size),
      inlinePricingToCheckoutClick: percentage(inlinePricingCheckoutUsers.size, inlinePricingCurrencyUsers.size),
      signupToPricing: percentage(pricingUsers.size, members.length),
      signupToRecurringSession: percentage(sourceSessions.length, members.length),
      signupToPaidSubscription: percentage(sourceSubscriptions.length, members.length),
    },
  }
}).sort((a, b) => b.signups - a.signups || a.source.localeCompare(b.source))

const taaftRoutes = new Map()
for (const profile of cohort.filter((row) => sourceForProfile(row) === 'taaft')) {
  increment(taaftRoutes, safeReferrerRoute(profile.signup_referrer))
}

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  window: { days, cutoff },
  externalSignups: cohort.length,
  sources: sourceRows,
  taaftReferrerRoutes: [...taaftRoutes.entries()]
    .map(([route, signups]) => ({ route, signups }))
    .sort((a, b) => b.signups - a.signups || a.route.localeCompare(b.route)),
  privacy: 'No emails, user IDs, customer IDs, subscription IDs, or session IDs are printed.',
}, null, 2))
