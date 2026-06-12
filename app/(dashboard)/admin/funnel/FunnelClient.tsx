'use client'

// Push #254 — Funnel rebuilt on real DB data (auth.users + profiles + videos).
// #475 — added a cohort growth funnel (period filter), biggest-leak detection,
// Revenue Leaks, PQL Hot Leads, Source/UTM quality, Topic performance and a
// tracking-health note. Existing real-stats / rates / Stripe sections kept.

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { FunnelData } from '@/app/api/admin/funnel/route'

export type { FunnelData }

interface Props {
  data?: FunnelData
  viewerEmail?: string
  denied?: boolean
}

function fmt(v: number): string {
  return v.toLocaleString('en-US')
}
function pct1(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

const POLL_MS = 30_000
const PERIODS: Array<{ label: string; days: string }> = [
  { label: '24h', days: '1' },
  { label: '7d', days: '7' },
  { label: '14d', days: '14' },
  { label: '30d', days: '30' },
  { label: 'All', days: 'all' },
]
const STATUS_COLOR: Record<string, string> = {
  Cold: '#94a3b8', Warm: '#fbbf24', Hot: '#f97316', 'Very Hot': '#ef4444',
}

export default function FunnelClient({ data: initialData, viewerEmail, denied }: Props) {
  const [data, setData] = useState<FunnelData | undefined>(initialData)
  const [days, setDays] = useState<string>('30')
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(initialData ? new Date() : null)
  const [secondsAgo, setSecondsAgo] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    clockRef.current = setInterval(() => {
      if (lastUpdated) setSecondsAgo(Math.round((Date.now() - lastUpdated.getTime()) / 1000))
    }, 1000)
    return () => { if (clockRef.current) clearInterval(clockRef.current) }
  }, [lastUpdated])

  // #475 — fetch immediately on mount and whenever the period changes, then poll.
  useEffect(() => {
    if (denied) return
    let cancelled = false
    async function load() {
      setRefreshing(true)
      try {
        const res = await fetch(`/api/admin/funnel?days=${days}`, { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled && json?.data) {
          setData(json.data as FunnelData)
          setLastUpdated(new Date())
          setSecondsAgo(0)
        }
      } catch { /* silent */ } finally {
        if (!cancelled) setRefreshing(false)
      }
    }
    load()
    timerRef.current = setInterval(load, POLL_MS)
    return () => { cancelled = true; if (timerRef.current) clearInterval(timerRef.current) }
  }, [denied, days])

  if (denied || !data) {
    return (
      <div className="px-4 sm:px-6 py-10 pb-20 max-w-3xl mx-auto">
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-xl font-black mb-2" style={{ color: 'var(--text)' }}>Access denied.</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Admin only.</p>
        </div>
      </div>
    )
  }

  const s = data.realStats
  const r = data.rates
  const steps = data.funnelSteps ?? []
  const leak = data.biggestLeak ?? null
  const maxCount = steps.length ? Math.max(...steps.map((x) => x.count), 1) : 1

  return (
    <div className="px-4 sm:px-6 py-7 pb-20 max-w-5xl mx-auto">
      <header className="mb-6">
        <div className="font-black uppercase tracking-widest mb-1" style={{ fontSize: '0.62rem', color: '#6ee7b7' }}>
          Admin · Live
        </div>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-black tracking-tight mb-1" style={{ fontSize: '1.6rem', color: 'var(--text)' }}>
              Growth Funnel
            </h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Live from profiles + videos + click_events + checkout. Signed in as {viewerEmail}.
            </p>
          </div>
          <RefreshIndicator refreshing={refreshing} secondsAgo={secondsAgo} lastUpdated={lastUpdated} />
        </div>
        <AdminNav active="funnel" />
        {/* #475 — cohort period filter */}
        <div className="flex gap-1.5 mt-4">
          {PERIODS.map((p) => {
            const active = days === p.days
            return (
              <button
                key={p.days}
                type="button"
                onClick={() => setDays(p.days)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                style={{
                  background: active ? '#22d3ee' : 'rgba(255,255,255,0.04)',
                  color: active ? '#020D0A' : 'var(--muted)',
                  border: `1px solid ${active ? '#22d3ee' : 'var(--border)'}`,
                }}
              >
                {p.label}
              </button>
            )
          })}
          <span className="ml-2 self-center text-[11px]" style={{ color: 'var(--muted)' }}>
            cohort = signups in period
          </span>
        </div>
      </header>

      {/* ── #475 — Cohort funnel visual + biggest leak ────────────────────── */}
      {steps.length > 0 && (
        <section className="mb-7">
          <h2 className="font-black tracking-tight mb-3" style={{ fontSize: '0.88rem', color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Funnel (cohort)
          </h2>
          {leak && (
            <div className="rounded-xl px-4 py-3 mb-3 text-sm font-bold" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}>
              🩸 Biggest leak: {leak.label} — lost {fmt(leak.lossAbs)} ({pct1(leak.lossPct)})
            </div>
          )}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(11,17,32,0.85)', border: '1px solid var(--border)' }}>
            {steps.map((st, i) => {
              const isLeak = leak ? st.label === leak.stepLabel : false
              const widthPct = Math.max(3, Math.round((st.count / maxCount) * 100))
              return (
                <div key={st.label} className="mb-2.5 last:mb-0">
                  <div className="flex items-center justify-between mb-1 text-xs">
                    <span className="font-bold" style={{ color: 'var(--text)' }}>{st.label}</span>
                    <span style={{ color: 'var(--muted)' }}>
                      <b style={{ color: 'var(--text)' }}>{fmt(st.count)}</b>
                      {i > 0 && <> · {pct1(st.pctOfPrev)} of prev · {pct1(st.pctOfSignups)} of signups</>}
                      {i > 0 && st.lossAbs > 0 && <span style={{ color: '#f87171' }}> · −{fmt(st.lossAbs)}</span>}
                    </span>
                  </div>
                  <div className="rounded-md h-7 overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: isLeak ? '1.5px solid #ef4444' : '1px solid var(--border)' }}>
                    <div className="h-full rounded-md" style={{ width: `${widthPct}%`, background: isLeak ? 'linear-gradient(90deg,#ef4444,#b91c1c)' : 'linear-gradient(90deg,#22d3ee,#10b981)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── #475 — Revenue leaks ──────────────────────────────────────────── */}
      {data.revenueLeaks && data.revenueLeaks.length > 0 && (
        <Section title="Revenue leaks">
          <div className="col-span-full flex flex-col gap-2">
            {data.revenueLeaks.map((l) => (
              <div key={l.label} className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: 'rgba(11,17,32,0.85)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  <span className="font-black" style={{ fontSize: '1.3rem', color: l.count > 0 ? '#fbbf24' : 'var(--muted)' }}>{fmt(l.count)}</span>
                  <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>{l.label}</span>
                </div>
                <span className="text-xs font-semibold" style={{ color: '#22d3ee' }}>→ {l.action}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── #475 — Hot leads (PQL) ────────────────────────────────────────── */}
      {data.hotLeads && data.hotLeads.length > 0 && (
        <section className="mb-7">
          <h2 className="font-black tracking-tight mb-3" style={{ fontSize: '0.88rem', color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Hot leads · closest to paying
          </h2>
          <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(11,17,32,0.85)', border: '1px solid var(--border)' }}>
            <table className="w-full text-left text-xs" style={{ minWidth: 640 }}>
              <thead>
                <tr style={{ color: 'var(--muted)' }}>
                  <th className="px-3 py-2 font-bold">Email</th>
                  <th className="px-3 py-2 font-bold">Score</th>
                  <th className="px-3 py-2 font-bold">Status</th>
                  <th className="px-3 py-2 font-bold">Videos</th>
                  <th className="px-3 py-2 font-bold">Checkout</th>
                  <th className="px-3 py-2 font-bold">Abandoned</th>
                  <th className="px-3 py-2 font-bold">Source</th>
                </tr>
              </thead>
              <tbody>
                {data.hotLeads.map((h, i) => (
                  <tr key={h.email + i} style={{ borderTop: '1px solid var(--border)', color: 'var(--text2)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--text)' }}>{h.email}</td>
                    <td className="px-3 py-2 font-black" style={{ color: STATUS_COLOR[h.status] }}>{h.score}</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-[10px] font-black" style={{ background: STATUS_COLOR[h.status] + '22', color: STATUS_COLOR[h.status] }}>{h.status}</span></td>
                    <td className="px-3 py-2">{h.videos}</td>
                    <td className="px-3 py-2">{h.checkoutClicked ? '✅' : '—'}</td>
                    <td className="px-3 py-2">{h.abandoned ? '🔴' : '—'}</td>
                    <td className="px-3 py-2">{h.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── #475 — Source quality ─────────────────────────────────────────── */}
      {data.sourceQuality && data.sourceQuality.length > 0 && (
        <section className="mb-7">
          <h2 className="font-black tracking-tight mb-3" style={{ fontSize: '0.88rem', color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Source / UTM quality
          </h2>
          <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(11,17,32,0.85)', border: '1px solid var(--border)' }}>
            <table className="w-full text-left text-xs" style={{ minWidth: 560 }}>
              <thead>
                <tr style={{ color: 'var(--muted)' }}>
                  <th className="px-3 py-2 font-bold">Source</th>
                  <th className="px-3 py-2 font-bold">Signups</th>
                  <th className="px-3 py-2 font-bold">Activated</th>
                  <th className="px-3 py-2 font-bold">Paid</th>
                  <th className="px-3 py-2 font-bold">Activation</th>
                  <th className="px-3 py-2 font-bold">Signup→Paid</th>
                </tr>
              </thead>
              <tbody>
                {data.sourceQuality.map((src) => (
                  <tr key={src.source} style={{ borderTop: '1px solid var(--border)', color: 'var(--text2)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--text)' }}>{src.source}</td>
                    <td className="px-3 py-2">{fmt(src.signups)}</td>
                    <td className="px-3 py-2">{fmt(src.activated)}</td>
                    <td className="px-3 py-2" style={{ color: src.paid > 0 ? '#34d399' : 'var(--muted)' }}>{fmt(src.paid)}</td>
                    <td className="px-3 py-2">{src.activationRate}</td>
                    <td className="px-3 py-2">{src.signupToPaid}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── #475 — Topic performance ──────────────────────────────────────── */}
      {data.topicPerformance && data.topicPerformance.length > 0 && (
        <section className="mb-7">
          <h2 className="font-black tracking-tight mb-3" style={{ fontSize: '0.88rem', color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Topic performance · what gets made
          </h2>
          <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(11,17,32,0.85)', border: '1px solid var(--border)' }}>
            <table className="w-full text-left text-xs" style={{ minWidth: 480 }}>
              <thead>
                <tr style={{ color: 'var(--muted)' }}>
                  <th className="px-3 py-2 font-bold">Topic / niche</th>
                  <th className="px-3 py-2 font-bold">Videos</th>
                  <th className="px-3 py-2 font-bold">Users</th>
                </tr>
              </thead>
              <tbody>
                {data.topicPerformance.map((t, i) => (
                  <tr key={t.topic + i} style={{ borderTop: '1px solid var(--border)', color: 'var(--text2)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--text)' }}>{t.topic}</td>
                    <td className="px-3 py-2">{fmt(t.videos)}</td>
                    <td className="px-3 py-2">{fmt(t.users)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Existing real-stats sections ──────────────────────────────────── */}
      <Section title="Growth (all-time)">
        <Card label="Total users"      value={fmt(s.totalUsers)}    hint="all signups"   accent="#22d3ee" />
        <Card label="New this week"    value={fmt(s.newThisWeek)}   hint="last 7 days"   accent="#34d399" />
        <Card label="New this month"   value={fmt(s.newThisMonth)}  hint="last 30 days"  accent="#34d399" />
        <Card label="Videos this week" value={fmt(s.videosThisWeek)} hint="last 7 days"  accent="#34d399" />
      </Section>

      <Section title="Subscribers">
        <Card label="Pro"   value={fmt(s.proUsers)}   hint="plan = pro"   accent="#34d399" />
        <Card label="Basic" value={fmt(s.basicUsers)} hint="plan = basic" accent="#34d399" />
        <Card label="Free"  value={fmt(s.freeUsers)}  hint="no paid plan" accent="#94a3b8" />
        <Card label="Paid · 0 credits ⚠️" value={fmt(s.paidNoCredits)} hint="check Stripe webhook" accent={s.paidNoCredits > 0 ? '#f87171' : '#34d399'} />
      </Section>

      <Section title="Conversion rates (all-time)">
        <RateCard label="Signup → Video"  value={r.signupToVideo} sub={`${s.usersWithVideos} / ${s.totalUsers}`} />
        <RateCard label="Signup → Paid"   value={r.signupToPaid}  sub={`${s.proUsers + s.basicUsers} / ${s.totalUsers}`} />
        <RateCard label="Video → Paid"    value={r.videoToPaid}   sub={`${s.proUsers + s.basicUsers} / ${s.usersWithVideos}`} />
        <RateCard label="Basic → Pro"     value={r.basicToPro}    sub={`${s.proUsers} / ${s.proUsers + s.basicUsers}`} />
      </Section>

      {data.stripePayments && (
        <Section title="💳 Payment funnel · Stripe">
          <Card label="Checkout initiated" value={fmt(data.stripePayments.checkoutCreated)}   hint="reached Stripe checkout" accent="#34d399" />
          <Card label="Completed ✅"        value={fmt(data.stripePayments.checkoutCompleted)} hint="payment succeeded"       accent="#34d399" />
          <Card label="Abandoned ❌"        value={fmt(data.stripePayments.checkoutAbandoned)} hint="expired without paying"  accent={data.stripePayments.checkoutAbandoned > 0 ? '#f87171' : '#34d399'} />
          <Card label="Still open ⏳"       value={fmt(data.stripePayments.checkoutOpen)}      hint="on checkout page now"    accent="#fbbf24" />
          <RateCard label="Checkout → Payment" value={data.stripePayments.conversionRate} sub={`${data.stripePayments.checkoutCompleted} / ${data.stripePayments.checkoutCompleted + data.stripePayments.checkoutAbandoned}`} />
          <Card label="Failed payments (30d)" value={fmt(data.stripePayments.recentFailedPayments)} hint="invoice.payment_failed" accent={data.stripePayments.recentFailedPayments > 0 ? '#f87171' : '#34d399'} />
        </Section>
      )}

      {/* ── #475 — Tracking health note ───────────────────────────────────── */}
      {data.trackingHealth?.eventsTableMissing && (
        <div className="rounded-xl px-4 py-3 mt-2 text-xs" style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.35)', color: '#fbbf24' }}>
          ⚠️ <b>Tracking note:</b> {data.trackingHealth.note}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="font-black tracking-tight mb-3" style={{ fontSize: '0.88rem', color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {title}
      </h2>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {children}
      </div>
    </section>
  )
}

function Card({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(11,17,32,0.85)', border: `1px solid ${accent ? accent + '33' : 'var(--border)'}` }}>
      <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: accent ?? 'var(--muted)' }}>
        {label}
      </div>
      <div className="font-black" style={{ fontSize: '1.7rem', lineHeight: 1.1, color: accent ?? 'var(--text)' }}>
        {value}
      </div>
      {hint && <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>{hint}</p>}
    </div>
  )
}

function RateCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  const isGood = value !== '—' && parseFloat(value) >= 10
  const accent = value === '—' ? '#94a3b8' : isGood ? '#34d399' : '#f59e0b'
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(11,17,32,0.85)', border: `1px solid ${accent}33` }}>
      <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
        {label}
      </div>
      <div className="font-black" style={{ fontSize: '1.9rem', lineHeight: 1.1, color: accent }}>
        {value}
      </div>
      <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>{sub}</p>
    </div>
  )
}

function RefreshIndicator({ refreshing, secondsAgo, lastUpdated }: { refreshing: boolean; secondsAgo: number; lastUpdated: Date | null }) {
  if (!lastUpdated) return null
  return (
    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
      {refreshing && <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: '#22d3ee' }} />}
      <span>Updated {secondsAgo}s ago</span>
    </div>
  )
}

function AdminNav({ active }: { active: string }) {
  const tabs = [
    { label: 'CEO', href: '/admin/ceo', key: 'ceo' },
    { label: 'Metrics', href: '/admin/metrics', key: 'metrics' },
    { label: 'Funnel', href: '/admin/funnel', key: 'funnel' },
    { label: 'Users', href: '/admin/users', key: 'users' },
  ]
  return (
    <nav className="flex gap-1 mt-4">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          style={{ background: active === t.key ? 'var(--accent)' : 'transparent', color: active === t.key ? '#fff' : 'var(--muted)' }}>
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
