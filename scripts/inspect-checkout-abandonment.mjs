import fs from 'node:fs'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

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

function increment(map, key) {
  const normalized = String(key || 'unknown').toLowerCase()
  map.set(normalized, (map.get(normalized) || 0) + 1)
}

function sortedCounts(map) {
  return [...map.entries()]
    .map(([key, sessions]) => ({ key, sessions }))
    .sort((a, b) => b.sessions - a.sessions || a.key.localeCompare(b.key))
}

function safeDiagnostic(session) {
  return {
    createdAt: new Date(session.created * 1000).toISOString(),
    expiresAt: new Date(session.expires_at * 1000).toISOString(),
    status: session.status || 'unknown',
    paymentStatus: session.payment_status || 'unknown',
    tier: session.metadata?.tier || 'unknown',
    currency: session.currency || 'unknown',
    amountTotal: session.amount_total,
    introApplied: session.metadata?.intro === '1',
    checkoutOrigin: session.metadata?.checkout_origin || 'unknown',
    intentCampaign: session.metadata?.intent_campaign || 'unknown',
    paymentMethodTypes: session.payment_method_types || [],
    locale: session.locale || 'auto',
    recoveryEnabled: session.after_expiration?.recovery?.enabled === true,
    recoveryUrlAvailable: Boolean(session.after_expiration?.recovery?.url),
    recoveredFromPriorSession: Boolean(session.recovered_from),
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

const daysArg = process.argv.find((arg) => arg.startsWith('--days='))
const days = Number(daysArg?.split('=')[1] || 30)
const detailsArg = process.argv.find((arg) => arg.startsWith('--details='))
const details = Number(detailsArg?.split('=')[1] || 5)
const includeInternal = process.argv.includes('--include-internal')
if (!Number.isFinite(days) || days <= 0 || days > 365) {
  throw new Error('--days must be between 1 and 365')
}
if (!Number.isInteger(details) || details < 0 || details > 20) {
  throw new Error('--details must be an integer between 0 and 20')
}

const env = loadEnv('.env.local')
if (!env.STRIPE_SECRET_KEY || !env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Stripe or Supabase credentials in .env.local')
}

const stripe = new Stripe(env.STRIPE_SECRET_KEY)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const nowSeconds = Math.floor(Date.now() / 1000)
const cutoffSeconds = nowSeconds - days * 24 * 60 * 60

const { data: profiles, error: profileError } = await db
  .from('profiles')
  .select('id,email,stripe_customer_id')
if (profileError) throw profileError

const externalProfiles = (profiles || []).filter((profile) => !isInternalEmail(profile.email))
const externalUserIds = new Set(externalProfiles.map((profile) => profile.id).filter(Boolean))
const externalCustomerIds = new Set(externalProfiles.map((profile) => profile.stripe_customer_id).filter(Boolean))

const listed = await stripeListAll((startingAfter) => stripe.checkout.sessions.list({
  limit: 100,
  created: { gte: cutoffSeconds },
  ...(startingAfter ? { starting_after: startingAfter } : {}),
}))

const recurring = listed.filter((session) => {
  if (session.mode !== 'subscription') return false
  if (includeInternal) return true
  const userId = session.metadata?.supabase_user_id
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
  const email = session.customer_details?.email || session.customer_email || ''
  if (userId && externalUserIds.has(userId)) return true
  if (customerId && externalCustomerIds.has(customerId)) return true
  return Boolean(email) && !isInternalEmail(email)
})

const counts = {
  status: new Map(),
  payment: new Map(),
  tier: new Map(),
  currency: new Map(),
  origin: new Map(),
  campaign: new Map(),
}
for (const session of recurring) {
  increment(counts.status, session.status)
  increment(counts.payment, session.payment_status)
  increment(counts.tier, session.metadata?.tier)
  increment(counts.currency, session.currency)
  increment(counts.origin, session.metadata?.checkout_origin)
  increment(counts.campaign, session.metadata?.intent_campaign)
}

const expired = recurring
  .filter((session) => session.status === 'expired')
  .sort((a, b) => b.created - a.created)

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  window: { days, cutoff: new Date(cutoffSeconds * 1000).toISOString(), includeInternal },
  recurringSessions: recurring.length,
  counts: Object.fromEntries(
    Object.entries(counts).map(([key, value]) => [key, sortedCounts(value)]),
  ),
  paid: recurring.filter((session) => session.payment_status === 'paid').length,
  completed: recurring.filter((session) => session.status === 'complete').length,
  expired: expired.length,
  latestDiagnostics: recurring
    .slice()
    .sort((a, b) => b.created - a.created)
    .slice(0, details)
    .map(safeDiagnostic),
  expiredDiagnostics: expired.slice(0, details).map(safeDiagnostic),
}, null, 2))
