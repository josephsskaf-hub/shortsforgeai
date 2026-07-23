import fs from 'node:fs'
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
  /@shortsforgeai\.com$/i,
  /^test/i,
  /mailinator/i,
  /^smoketest/i,
]

function isInternalEmail(raw) {
  const email = String(raw || '').trim().toLowerCase()
  return exactInternal.has(email) || internalPatterns.some((pattern) => pattern.test(email))
}

function parseDays() {
  const index = process.argv.indexOf('--days')
  const raw = index >= 0 ? Number(process.argv[index + 1]) : 30
  return Number.isFinite(raw) && raw > 0 ? Math.min(raw, 365) : 30
}

function actorKey(row) {
  if (row.user_id) return `user:${row.user_id}`
  if (row.session_id) return `session:${row.session_id}`
  return null
}

function eventStage(rows, name, predicate = () => true) {
  const selected = rows.filter((row) => row.name === name && predicate(row))
  return {
    rawEvents: selected.length,
    actors: new Set(selected.map(actorKey).filter(Boolean)).size,
  }
}

function unwrap(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.code ?? 'unknown'} ${result.error.message}`)
  return result.data ?? []
}

async function main() {
  const env = { ...loadEnv('.env.local'), ...process.env }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase service-role configuration is missing')
  }
  const days = parseDays()
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const [affiliateResult, clickResult, referralResult, commissionResult, eventResult, profileResult] = await Promise.all([
    supabase.from('affiliates').select('id,status,created_at'),
    supabase.from('affiliate_clicks').select('id,created_at').gte('created_at', cutoff),
    supabase.from('affiliate_referrals').select('id,status,first_touch_at,converted_at').gte('first_touch_at', cutoff),
    supabase.from('affiliate_commissions').select('id,status,commission_amount,currency,created_at').gte('created_at', cutoff),
    supabase.from('events').select('name,user_id,session_id,path,metadata,created_at').gte('created_at', cutoff),
    supabase.from('profiles').select('id,email,created_at,signup_utm_campaign').gte('created_at', cutoff),
  ])

  const affiliates = unwrap(affiliateResult, 'affiliates')
  const clicks = unwrap(clickResult, 'affiliate_clicks')
  const referrals = unwrap(referralResult, 'affiliate_referrals')
  const commissions = unwrap(commissionResult, 'affiliate_commissions')
  const events = unwrap(eventResult, 'events')
  const profiles = unwrap(profileResult, 'profiles').filter((profile) => !isInternalEmail(profile.email))
  const currencyTotals = {}
  for (const row of commissions) {
    const currency = String(row.currency || 'usd').toLowerCase()
    const bucket = currencyTotals[currency] ?? { pending: 0, approved: 0, paid: 0, total: 0 }
    const amount = Number(row.commission_amount || 0)
    const status = String(row.status || 'pending').toLowerCase()
    bucket.total += amount
    if (status === 'pending') bucket.pending += amount
    if (status === 'approved') bucket.approved += amount
    if (status === 'paid') bucket.paid += amount
    currencyTotals[currency] = bucket
  }

  const report = {
    generatedAt: new Date().toISOString(),
    window: { days, cutoff },
    publicPartnerFunnel: {
      landingSessions: eventStage(events, 'landing_session_started', (row) => row.path === '/partners'),
      ctaClicks: eventStage(events, 'organic_cta_clicked', (row) => row.metadata?.source === 'partners'),
      applications: eventStage(events, 'affiliate_application_submitted'),
      attributedSignups: profiles.filter((profile) => profile.signup_utm_campaign === 'push33_partner_program').length,
    },
    customAffiliateSystem: {
      affiliates: {
        total: affiliates.length,
        active: affiliates.filter((row) => row.status === 'active').length,
        pending: affiliates.filter((row) => row.status === 'pending').length,
        suspended: affiliates.filter((row) => row.status === 'suspended').length,
      },
      clicks: clicks.length,
      referrals: referrals.length,
      paidReferrals: referrals.filter((row) => row.status === 'paid').length,
      commissions: commissions.length,
      commissionCentsByCurrency: currencyTotals,
    },
    note: 'Custom Kineo affiliate tables only. Rewardful is an external system and is not counted here.',
  }
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
