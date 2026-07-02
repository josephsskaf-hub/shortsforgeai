// Push #482 — Admin Tier-1 Overview (server component).
//
// Replaces the client-side /admin (Push #410/#433). Everything is now
// computed on the server with the service role — no /api round-trip — and
// EVERY number excludes internal accounts via lib/internalAccounts (the old
// dashboard counted the founder's + his sister's test subscriptions as MRR).
//
// Sections: Revenue · Growth (14-day chart) · Activation · Retention ·
// Compact funnel (links to /admin/funnel) · Health (failed renders, refunds,
// last external signups). Metrics with no real data render "—" with a
// title-attribute tooltip explaining why — numbers are never invented.
//
// Access gate: identical to the /api/admin/* routes — cookie session +
// ADMIN_EMAILS allowlist, checked server-side before any data is fetched.

import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { isInternalEmail, INTERNAL_ACCOUNTS_LABEL } from '@/lib/internalAccounts'
import { PLANS } from '@/lib/pricing'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ADMIN_EMAILS = new Set([
  'josephsskaf@gmail.com',
  'josephskaf@gmail.com',
  'joseph-test@shortsforgeai.com',
])

// Monthly USD per plan — sourced from lib/pricing so a price change there
// updates the MRR math automatically. Trials count at full price (card on file).
const PLAN_PRICE_USD: Record<string, number> = {
  starter: PLANS.starter.price,
  starter_trial: PLANS.starter.price,
  basic: PLANS.basic.price,
  basic_trial: PLANS.basic.price,
  pro: PLANS.pro.price,
  pro_trial: PLANS.pro.price,
}
const PAID_PLANS = new Set(Object.keys(PLAN_PRICE_USD))

const DAY_MS = 24 * 60 * 60 * 1000

// ── formatting helpers ──────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return `$${n.toFixed(2)}`
}
function fmtPct(num: number, denom: number): string {
  if (!denom || denom <= 0) return '—'
  return `${((num / denom) * 100).toFixed(1)}%`
}
function fmtMinutes(mins: number | null): string {
  if (mins == null) return '—'
  if (mins < 60) return `${Math.round(mins)} min`
  if (mins < 48 * 60) return `${(mins / 60).toFixed(1)} h`
  return `${(mins / (24 * 60)).toFixed(1)} d`
}
function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
// j***@gmail.com — enough to recognise a signup without exposing the address.
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  return `${(local ?? '').slice(0, 1)}***@${domain}`
}

// ── data layer ──────────────────────────────────────────────────────────────

type Metrics = {
  internalCount: number
  externalUsers: number
  // revenue
  payingTotal: number
  payingByPlan: { starter: number; creator: number; studio: number }
  mrrUsd: number
  arpuUsd: number | null
  oneTimePurchases: number
  // growth
  signupsToday: number
  signups7d: number
  signupsPrev7d: number
  signups30d: number
  wowPct: number | null
  days14: Array<{ date: string; count: number }>
  // activation
  activatedAll: number
  activated7d: number
  avgFirstVideoMins: number | null
  videosToday: number
  videos7d: number
  // retention
  activeUsers7d: number
  week2CohortSize: number
  week2Returned: number
  creditsSpent7d: number
  // funnel
  triedCheckout: number
  // health
  failedRenders7d: number
  refunds7d: number
  recentSignups: Array<{ masked: string; at: string | null; utm: string | null }>
}

async function loadMetrics(): Promise<Metrics | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null

  const admin = createServiceClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Small tables (≤ a few hundred rows each as of #482); the explicit limits
  // are just headroom before pagination is ever needed.
  const [profilesQ, videosQ, debitsQ, abandQ, clicksQ, eventsQ] = await Promise.all([
    admin.from('profiles').select('id, email, plan, created_at, utm_source').limit(5000),
    admin.from('videos').select('user_id, created_at, status, credits_used').limit(5000),
    admin.from('credit_debits').select('user_id, refunded_at').limit(5000),
    admin.from('checkout_abandoned').select('user_id').limit(5000),
    admin.from('click_events').select('user_id, event').limit(5000),
    admin
      .from('events')
      .select('name, user_id')
      .in('name', [
        'payment_success',
        'starter_checkout_clicked',
        'basic_checkout_clicked',
        'pro_checkout_clicked',
        'starter_pack_checkout_clicked',
      ])
      .limit(5000),
  ])

  type ProfileRow = { id: string; email: string | null; plan: string | null; created_at: string | null; utm_source: string | null }
  type VideoRow = { user_id: string | null; created_at: string | null; status: string | null; credits_used: number | null }

  const profiles = (profilesQ.data ?? []) as ProfileRow[]
  if (profilesQ.error || profiles.length === 0) return null

  // ── internal-account exclusion (the whole point of #482) ──────────────────
  const external = profiles.filter((p) => !isInternalEmail(p.email))
  const internalCount = profiles.length - external.length
  const extIds = new Set(external.map((p) => p.id))
  const createdMsById = new Map<string, number>()
  for (const p of external) createdMsById.set(p.id, p.created_at ? new Date(p.created_at).getTime() : 0)

  const now = Date.now()
  const todayStart = new Date(new Date(now).toISOString().slice(0, 10) + 'T00:00:00.000Z').getTime()
  const since7d = now - 7 * DAY_MS
  const since14d = now - 14 * DAY_MS
  const since30d = now - 30 * DAY_MS

  // ── revenue ────────────────────────────────────────────────────────────────
  const payingByPlan = { starter: 0, creator: 0, studio: 0 }
  let mrrUsd = 0
  for (const p of external) {
    const plan = (p.plan ?? 'free').toLowerCase()
    if (!PAID_PLANS.has(plan)) continue
    const key = plan.replace('_trial', '')
    if (key === 'starter') payingByPlan.starter += 1
    else if (key === 'basic') payingByPlan.creator += 1
    else if (key === 'pro') payingByPlan.studio += 1
    mrrUsd += PLAN_PRICE_USD[plan] ?? 0
  }
  const payingTotal = payingByPlan.starter + payingByPlan.creator + payingByPlan.studio
  const arpuUsd = payingTotal > 0 ? mrrUsd / payingTotal : null

  const eventRows = (eventsQ.data ?? []) as Array<{ name: string; user_id: string | null }>
  const oneTimePurchases = eventRows.filter(
    (e) => e.name === 'payment_success' && e.user_id != null && extIds.has(e.user_id)
  ).length

  // ── growth ────────────────────────────────────────────────────────────────
  let signupsToday = 0
  let signups7d = 0
  let signupsPrev7d = 0
  let signups30d = 0
  const dayBuckets = new Map<string, number>()
  for (let i = 13; i >= 0; i--) dayBuckets.set(new Date(now - i * DAY_MS).toISOString().slice(0, 10), 0)
  for (const p of external) {
    const ms = createdMsById.get(p.id) ?? 0
    if (ms >= todayStart) signupsToday += 1
    if (ms >= since7d) signups7d += 1
    else if (ms >= since14d) signupsPrev7d += 1
    if (ms >= since30d) signups30d += 1
    const day = (p.created_at ?? '').slice(0, 10)
    if (dayBuckets.has(day)) dayBuckets.set(day, (dayBuckets.get(day) ?? 0) + 1)
  }
  const wowPct = signupsPrev7d > 0 ? ((signups7d - signupsPrev7d) / signupsPrev7d) * 100 : null
  const days14: Array<{ date: string; count: number }> = []
  dayBuckets.forEach((count, date) => days14.push({ date, count }))

  // ── activation / retention / health from videos ───────────────────────────
  const videos = (videosQ.data ?? []) as VideoRow[]
  const firstVideoMs = new Map<string, number>()
  const activeUserIds7d = new Set<string>()
  const videosByUser = new Map<string, number[]>() // created_at ms per ext user
  let videosToday = 0
  let videos7d = 0
  let creditsSpent7d = 0
  let failedRenders7d = 0
  for (const v of videos) {
    if (!v.user_id || !extIds.has(v.user_id)) continue
    const ms = v.created_at ? new Date(v.created_at).getTime() : 0
    if (ms >= todayStart) videosToday += 1
    if (ms >= since7d) {
      videos7d += 1
      creditsSpent7d += v.credits_used ?? 0
      activeUserIds7d.add(v.user_id)
      if ((v.status ?? '') === 'failed') failedRenders7d += 1
    }
    const prev = firstVideoMs.get(v.user_id)
    if (prev == null || ms < prev) firstVideoMs.set(v.user_id, ms)
    const list = videosByUser.get(v.user_id) ?? []
    list.push(ms)
    videosByUser.set(v.user_id, list)
  }

  const activatedAll = firstVideoMs.size
  let activated7d = 0
  for (const p of external) {
    const ms = createdMsById.get(p.id) ?? 0
    if (ms >= since7d && firstVideoMs.has(p.id)) activated7d += 1
  }

  let firstVideoDeltaSum = 0
  let firstVideoDeltaN = 0
  firstVideoMs.forEach((vMs, userId) => {
    const cMs = createdMsById.get(userId) ?? 0
    if (cMs > 0 && vMs >= cMs) {
      firstVideoDeltaSum += vMs - cMs
      firstVideoDeltaN += 1
    }
  })
  const avgFirstVideoMins = firstVideoDeltaN > 0 ? firstVideoDeltaSum / firstVideoDeltaN / 60000 : null

  // Week-2 retention: signed up 7–14 days ago AND generated a video in their
  // second week (signup+7d … signup+14d).
  let week2CohortSize = 0
  let week2Returned = 0
  for (const p of external) {
    const cMs = createdMsById.get(p.id) ?? 0
    if (cMs < since14d || cMs >= since7d) continue
    week2CohortSize += 1
    const list = videosByUser.get(p.id) ?? []
    if (list.some((ms) => ms >= cMs + 7 * DAY_MS && ms < cMs + 14 * DAY_MS)) week2Returned += 1
  }

  // ── funnel: tried checkout = abandoned session ∪ checkout click ───────────
  const tried = new Set<string>()
  for (const r of (abandQ.data ?? []) as Array<{ user_id: string | null }>) {
    if (r.user_id && extIds.has(r.user_id)) tried.add(r.user_id)
  }
  for (const r of (clicksQ.data ?? []) as Array<{ user_id: string | null; event: string | null }>) {
    if (r.event === 'checkout_click' && r.user_id && extIds.has(r.user_id)) tried.add(r.user_id)
  }
  for (const e of eventRows) {
    if (e.name.endsWith('checkout_clicked') && e.user_id && extIds.has(e.user_id)) tried.add(e.user_id)
  }

  // ── health: automatic refunds + last external signups ─────────────────────
  let refunds7d = 0
  for (const d of (debitsQ.data ?? []) as Array<{ user_id: string | null; refunded_at: string | null }>) {
    if (!d.refunded_at || !d.user_id || !extIds.has(d.user_id)) continue
    if (new Date(d.refunded_at).getTime() >= since7d) refunds7d += 1
  }

  const recentSignups = [...external]
    .sort((a, b) => ((a.created_at ?? '') < (b.created_at ?? '') ? 1 : -1))
    .slice(0, 5)
    .map((p) => ({ masked: maskEmail(p.email ?? ''), at: p.created_at, utm: p.utm_source }))

  return {
    internalCount,
    externalUsers: external.length,
    payingTotal,
    payingByPlan,
    mrrUsd: Math.round(mrrUsd * 100) / 100,
    arpuUsd,
    oneTimePurchases,
    signupsToday,
    signups7d,
    signupsPrev7d,
    signups30d,
    wowPct,
    days14,
    activatedAll,
    activated7d,
    avgFirstVideoMins,
    videosToday,
    videos7d,
    activeUsers7d: activeUserIds7d.size,
    week2CohortSize,
    week2Returned,
    creditsSpent7d,
    triedCheckout: tried.size,
    failedRenders7d,
    refunds7d,
    recentSignups,
  }
}

// ── UI atoms (server-safe, no handlers) ─────────────────────────────────────

const CARD: CSSProperties = { background: '#161618', border: '1px solid #2a2a2d', borderRadius: 20 }

function Kpi({
  label,
  value,
  sub,
  accent,
  tooltip,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
  tooltip?: string
}) {
  return (
    <div className="relative overflow-hidden p-4" style={CARD} title={tooltip}>
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent 5%, rgba(${accent ?? '41,151,255'},.6) 50%, transparent 95%)`,
        }}
      />
      <div className="text-[10px] font-extrabold uppercase tracking-[.14em]" style={{ color: '#86868b' }}>
        {label}
        {tooltip ? <span style={{ color: '#6e6e73' }}> ⓘ</span> : null}
      </div>
      <div className="mt-1 text-2xl font-semibold" style={{ color: '#f5f5f7' }}>
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 text-[11px] font-semibold" style={{ color: '#6e6e73' }}>
          {sub}
        </div>
      ) : null}
    </div>
  )
}

function Section({ emoji, title, right, children }: { emoji: string; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-bold" style={{ color: '#f5f5f7' }}>
          {emoji} {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  )
}

// ── page ────────────────────────────────────────────────────────────────────

export default async function AdminOverviewPage() {
  // Gate first — identical check to /api/admin/* (cookie session + allowlist).
  const cookieClient = createClient()
  const {
    data: { user },
  } = await cookieClient.auth.getUser()
  const email = user?.email?.toLowerCase() ?? ''

  if (!user || !ADMIN_EMAILS.has(email)) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center" style={{ background: '#000', minHeight: '100vh' }}>
        <div className="text-lg font-semibold" style={{ color: '#f5f5f7' }}>Admin</div>
        <p className="mt-2 text-sm" style={{ color: '#86868b' }}>Forbidden</p>
        <Link href="/login?next=/admin" className="mt-4 inline-block text-sm font-bold" style={{ color: '#2997ff' }}>
          Sign in →
        </Link>
      </div>
    )
  }

  const m = await loadMetrics()

  if (!m) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center" style={{ background: '#000', minHeight: '100vh' }}>
        <div className="text-lg font-semibold" style={{ color: '#f5f5f7' }}>Admin</div>
        <p className="mt-2 text-sm" style={{ color: '#86868b' }}>Failed to load metrics (service role / profiles query).</p>
      </div>
    )
  }

  const maxDay = Math.max(1, ...m.days14.map((d) => d.count))
  const funnelSteps = [
    { label: 'Signups', count: m.externalUsers },
    { label: 'Activated (≥1 video)', count: m.activatedAll },
    { label: 'Tried checkout', count: m.triedCheckout },
    { label: 'Paying', count: m.payingTotal },
  ]

  return (
    <div style={{ background: '#000', minHeight: '100vh' }}>
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[.16em]" style={{ color: '#2997ff' }}>Admin</div>
            <h1
              className="text-2xl font-semibold tracking-tight"
              style={{
                background: 'linear-gradient(180deg,#fff 35%,#a1a1a6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Overview
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
              style={{ background: 'rgba(41,151,255,.12)', color: '#2997ff', border: '1px solid rgba(41,151,255,.3)' }}
              title={`${m.internalCount} founder/test accounts are excluded from every number on this page (lib/internalAccounts.ts)`}
            >
              {INTERNAL_ACCOUNTS_LABEL} · {m.internalCount}
            </span>
            <nav className="flex flex-wrap gap-2 text-[12px] font-bold">
              {[
                ['/admin/users', 'Users'],
                ['/admin/funnel', 'Funnel'],
                ['/admin/metrics', 'Metrics'],
                ['/admin/ceo', 'CEO'],
                ['/admin/affiliates', 'Affiliates'],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="rounded-lg px-2.5 py-1.5" style={{ color: '#86868b', background: 'rgba(255,255,255,.05)', border: '1px solid #2a2a2d' }}>
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* 💰 Revenue */}
        <Section emoji="💰" title="Revenue">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="MRR" value={fmtMoney(m.mrrUsd)} sub={`${m.payingTotal} active external subs`} accent="245,245,247" />
            <Kpi
              label="Paying by plan"
              value={String(m.payingTotal)}
              sub={`Starter ${m.payingByPlan.starter} · Creator ${m.payingByPlan.creator} · Studio ${m.payingByPlan.studio}`}
            />
            <Kpi
              label="One-time revenue"
              value="—"
              sub={`${m.oneTimePurchases} external one-time purchases`}
              tooltip="Starter Pack amounts are not stored in the events table (payment_success has no amount). Shows — until Stripe amounts are persisted."
            />
            <Kpi
              label="ARPU"
              value={m.arpuUsd != null ? fmtMoney(m.arpuUsd) : '—'}
              tooltip={m.arpuUsd == null ? 'No external paying users yet — ARPU is undefined (MRR ÷ 0).' : undefined}
            />
          </div>
        </Section>

        {/* 📈 Growth */}
        <Section emoji="📈" title="Growth">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Signups · today" value={String(m.signupsToday)} />
            <Kpi
              label="Signups · 7d"
              value={String(m.signups7d)}
              sub={m.wowPct != null ? `${m.wowPct >= 0 ? '+' : ''}${m.wowPct.toFixed(0)}% WoW (prev ${m.signupsPrev7d})` : `prev week ${m.signupsPrev7d}`}
            />
            <Kpi label="Signups · 30d" value={String(m.signups30d)} />
            <Kpi
              label="WoW"
              value={m.wowPct != null ? `${m.wowPct >= 0 ? '+' : ''}${m.wowPct.toFixed(0)}%` : '—'}
              tooltip={m.wowPct == null ? 'Previous week had 0 signups — week-over-week % is undefined.' : undefined}
            />
          </div>
          <div className="mt-3 p-4" style={CARD}>
            <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[.14em]" style={{ color: '#86868b' }}>
              External signups · last 14 days
            </div>
            <div className="flex items-end gap-1.5" style={{ height: 90 }}>
              {m.days14.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.count} signup${d.count === 1 ? '' : 's'}`}>
                  <div className="flex w-full items-end justify-center" style={{ height: 70 }}>
                    <div
                      style={{
                        width: '60%',
                        height: d.count > 0 ? `${Math.max(6, Math.round((d.count / maxDay) * 100))}%` : 2,
                        background: d.count > 0 ? 'rgba(41,151,255,.85)' : 'rgba(134,134,139,.35)',
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <span className="text-[8px] font-bold" style={{ color: '#6e6e73' }}>{d.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ⚡ Activation */}
        <Section emoji="⚡" title="Activation">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi
              label="Activation · all-time"
              value={fmtPct(m.activatedAll, m.externalUsers)}
              sub={`${m.activatedAll} of ${m.externalUsers} made ≥1 video`}
            />
            <Kpi
              label="Activation · 7d cohort"
              value={fmtPct(m.activated7d, m.signups7d)}
              sub={`${m.activated7d} of ${m.signups7d} new signups`}
              tooltip={m.signups7d === 0 ? 'No external signups in the last 7 days.' : undefined}
            />
            <Kpi
              label="Signup → 1st video"
              value={fmtMinutes(m.avgFirstVideoMins)}
              sub="average, activated users"
              tooltip={m.avgFirstVideoMins == null ? 'No activated external users yet.' : undefined}
            />
            <Kpi label="Videos" value={String(m.videosToday)} sub={`today · ${m.videos7d} last 7d`} />
          </div>
        </Section>

        {/* 🔁 Retention */}
        <Section emoji="🔁" title="Retention & engagement">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Active users · 7d" value={String(m.activeUsers7d)} sub="generated ≥1 video" />
            <Kpi
              label="Week-2 return"
              value={fmtPct(m.week2Returned, m.week2CohortSize)}
              sub={`${m.week2Returned} of ${m.week2CohortSize} (signed up 7–14d ago)`}
              tooltip={m.week2CohortSize === 0 ? 'No external signups 7–14 days ago — cohort is empty.' : 'Made a video in their 2nd week after signup.'}
            />
            <Kpi label="Credits spent · 7d" value={String(m.creditsSpent7d)} />
            <Kpi label="External users" value={String(m.externalUsers)} sub={`${m.internalCount} internal excluded`} />
          </div>
        </Section>

        {/* 🎯 Funnel */}
        <Section
          emoji="🎯"
          title="Funnel"
          right={
            <Link href="/admin/funnel" className="text-[12px] font-bold" style={{ color: '#2997ff' }}>
              ver completo →
            </Link>
          }
        >
          <div className="p-4" style={CARD}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {funnelSteps.map((s, i) => (
                <div key={s.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,.03)' }}>
                  <div className="text-[10px] font-extrabold uppercase tracking-[.12em]" style={{ color: '#86868b' }}>
                    {i > 0 ? '↳ ' : ''}{s.label}
                  </div>
                  <div className="mt-1 text-xl font-semibold" style={{ color: i === funnelSteps.length - 1 ? '#2997ff' : '#f5f5f7' }}>
                    {s.count}
                  </div>
                  <div className="text-[11px] font-semibold" style={{ color: '#6e6e73' }}>
                    {i === 0 ? 'external, all-time' : `${fmtPct(s.count, funnelSteps[i - 1].count)} of prev`}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10.5px]" style={{ color: '#6e6e73' }}>
              Tried checkout = abandoned Stripe session ∪ checkout click (click_events + events).
            </p>
          </div>
        </Section>

        {/* 🚨 Health */}
        <Section emoji="🚨" title="Health">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="grid grid-cols-2 gap-3">
              <Kpi
                label="Failed renders · 7d"
                value={String(m.failedRenders7d)}
                accent={m.failedRenders7d > 0 ? '239,68,68' : '41,151,255'}
                sub="videos.status = failed"
              />
              <Kpi
                label="Auto refunds · 7d"
                value={String(m.refunds7d)}
                accent={m.refunds7d > 0 ? '239,68,68' : '41,151,255'}
                sub="credit_debits refunded"
              />
            </div>
            <div className="p-4" style={CARD}>
              <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[.14em]" style={{ color: '#86868b' }}>
                Last external signups
              </div>
              <div className="space-y-1.5">
                {m.recentSignups.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,.03)' }}>
                    <span className="truncate text-[12.5px] font-semibold" style={{ color: '#f5f5f7' }}>{s.masked}</span>
                    <span className="flex flex-shrink-0 items-center gap-2 text-[11px] font-bold" style={{ color: '#6e6e73' }}>
                      {s.utm ? (
                        <span className="rounded px-1.5 py-0.5" style={{ background: 'rgba(41,151,255,.12)', color: '#2997ff' }}>{s.utm}</span>
                      ) : null}
                      {timeAgo(s.at)}
                    </span>
                  </div>
                ))}
                {m.recentSignups.length === 0 ? (
                  <p className="text-[12px]" style={{ color: '#6e6e73' }}>No external signups yet.</p>
                ) : null}
              </div>
            </div>
          </div>
        </Section>

        <p className="mt-6 text-[10.5px]" style={{ color: '#48484a' }}>
          Server-rendered on request · {INTERNAL_ACCOUNTS_LABEL} ({m.internalCount}) · sources: profiles, videos, events,
          credit_debits, checkout_abandoned, click_events.
        </p>
      </div>
    </div>
  )
}
