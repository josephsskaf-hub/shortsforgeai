'use client'

// Push #298 — CEO Dashboard. One page with everything a CEO checks every morning:
// MRR, signups, activation, abandoned leads, at-risk paid users, videos today.

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { CeoData } from '@/app/api/admin/ceo/route'

export type { CeoData }

interface Props {
  data?: CeoData
  viewerEmail?: string
  denied?: boolean
}

const POLL_MS = 30_000

function fmt(v: number): string { return v.toLocaleString('en-US') }
function money(v: number): string {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

export default function CeoClient({ data: initialData, viewerEmail, denied }: Props) {
  const [data, setData]               = useState<CeoData | undefined>(initialData)
  const [refreshing, setRefreshing]   = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(initialData ? new Date() : null)
  const [secondsAgo, setSecondsAgo]   = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    clockRef.current = setInterval(() => {
      if (lastUpdated) setSecondsAgo(Math.round((Date.now() - lastUpdated.getTime()) / 1000))
    }, 1000)
    return () => { if (clockRef.current) clearInterval(clockRef.current) }
  }, [lastUpdated])

  useEffect(() => {
    if (denied) return
    async function poll() {
      setRefreshing(true)
      try {
        const res = await fetch('/api/admin/ceo', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (json?.data) { setData(json.data as CeoData); setLastUpdated(new Date()); setSecondsAgo(0) }
      } catch { /* silent */ } finally { setRefreshing(false) }
    }
    timerRef.current = setInterval(poll, POLL_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [denied])

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

  return (
    <div className="px-4 sm:px-6 py-7 pb-20 max-w-5xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="mb-6">
        <div className="font-black uppercase tracking-widest mb-1" style={{ fontSize: '0.62rem', color: '#f59e0b' }}>
          Admin · CEO View · Live
        </div>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-black tracking-tight mb-1" style={{ fontSize: '1.6rem', color: 'var(--text)' }}>
              Morning Briefing
            </h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Everything you need to check first thing. Signed in as {viewerEmail}.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            {refreshing && <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: '#f59e0b' }} />}
            {lastUpdated && <span>Updated {secondsAgo}s ago</span>}
          </div>
        </div>
        <AdminNav active="ceo" />
      </header>

      {/* ── Row 1: Revenue ─────────────────────────────────────────────── */}
      <Section title="💰 Revenue">
        <BigCard
          label="Monthly Recurring Revenue"
          value={money(data.mrr)}
          accent="#34d399"
          sub={`Pro ×${data.proUsers}  ·  Basic ×${data.basicUsers}`}
        />
        <Card label="Pro subscribers"   value={fmt(data.proUsers)}   accent="#34d399" hint="$9.90/mo each" />
        <Card label="Basic subscribers" value={fmt(data.basicUsers)} accent="#60a5fa" hint="$4.90/mo each" />
        <Card label="Total paid"        value={fmt(data.paidTotal)}  accent="#a78bfa" hint="active plans" />
      </Section>

      {/* ── Row 2: Growth ──────────────────────────────────────────────── */}
      <Section title="📈 Growth">
        <Card label="New today"       value={fmt(data.signupsToday)}     accent="#22d3ee" hint="last 24 h" />
        <Card label="New this week"   value={fmt(data.signupsThisWeek)}  accent="#22d3ee" hint="last 7 days" />
        <Card label="New this month"  value={fmt(data.signupsThisMonth)} accent="#60a5fa" hint="last 30 days" />
        <RateCard
          label="Signup → Paid"
          value={data.signupToPaidRate}
          sub={`${data.paidTotal} paid out of all users`}
        />
      </Section>

      {/* ── Row 3: Activation ──────────────────────────────────────────── */}
      <Section title="⚡ Activation this week">
        <Card label="New users (7d)"     value={fmt(data.newUsersThisWeek)}     accent="#fbbf24" hint="signed up" />
        <Card label="Made a video (7d)"  value={fmt(data.newActivatedThisWeek)} accent="#fbbf24" hint="of new users" />
        <RateCard
          label="Activation rate"
          value={data.activationRateWeek}
          sub={`${data.newActivatedThisWeek} / ${data.newUsersThisWeek} new users`}
        />
        <Card label="Signup → Video (all)" value={data.signupToVideoRate} accent="#94a3b8" hint="overall" />
      </Section>

      {/* ── Row 4: Daily pulse ─────────────────────────────────────────── */}
      <Section title="🎬 Product usage">
        <Card label="Videos today"      value={fmt(data.videosToday)}    accent="#f59e0b" hint="last 24 h" />
        <Card label="Videos this week"  value={fmt(data.videosThisWeek)} accent="#f59e0b" hint="last 7 days" />
        <RateCard label="Checkout → Payment" value={data.checkoutConversionRate}
          sub={`${data.checkoutCompleted} paid / ${data.checkoutCompleted + data.checkoutAbandoned} resolved`}
        />
        <Card label="Checkout abandoned" value={fmt(data.checkoutAbandoned)}
          accent={data.checkoutAbandoned > 0 ? '#f87171' : '#34d399'} hint="Stripe expired" />
      </Section>

      {/* ── Hot leads table ────────────────────────────────────────────── */}
      {data.abandonedLeads.length > 0 && (
        <section className="mb-6">
          <h2 className="font-black uppercase tracking-widest mb-3" style={{ fontSize: '0.88rem', color: '#f87171', letterSpacing: '0.08em' }}>
            🔥 Abandoned Checkouts — Hot Leads ({data.abandonedCount})
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #f8717133' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'rgba(248,113,113,0.08)' }}>
                  <th className="text-left px-4 py-2 font-black" style={{ color: '#f87171' }}>Email</th>
                  <th className="text-left px-4 py-2 font-black" style={{ color: '#f87171' }}>Plan tried</th>
                  <th className="text-left px-4 py-2 font-black" style={{ color: '#f87171' }}>Days ago</th>
                  <th className="text-left px-4 py-2 font-black" style={{ color: '#f87171' }}>Heat</th>
                </tr>
              </thead>
              <tbody>
                {data.abandonedLeads.map((lead, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(248,113,113,0.1)', background: i % 2 === 0 ? 'transparent' : 'rgba(11,17,32,0.4)' }}>
                    <td className="px-4 py-2 font-mono" style={{ color: 'var(--text)' }}>{lead.email}</td>
                    <td className="px-4 py-2" style={{ color: 'var(--muted)' }}>{lead.plan ?? '—'}</td>
                    <td className="px-4 py-2 font-black" style={{ color: lead.daysAgo <= 1 ? '#f87171' : lead.daysAgo <= 3 ? '#f59e0b' : 'var(--muted)' }}>
                      {lead.daysAgo === 0 ? 'today' : `${lead.daysAgo}d`}
                    </td>
                    <td className="px-4 py-2">
                      <span style={{ color: lead.daysAgo === 0 ? '#f87171' : lead.daysAgo <= 1 ? '#f87171' : lead.daysAgo <= 3 ? '#f59e0b' : '#94a3b8' }}>
                        {lead.daysAgo === 0 ? '🔥🔥🔥' : lead.daysAgo <= 1 ? '🔥🔥' : lead.daysAgo <= 3 ? '🔥' : '·'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
            Reach out within 24 h — that window has the highest recovery rate.
          </p>
        </section>
      )}

      {/* ── At-risk paid users ─────────────────────────────────────────── */}
      {data.atRiskUsers.length > 0 && (
        <section className="mb-6">
          <h2 className="font-black uppercase tracking-widest mb-3" style={{ fontSize: '0.88rem', color: '#f59e0b', letterSpacing: '0.08em' }}>
            ⚠️ At-Risk Paid Users — Low Credits ({data.atRiskCount})
          </h2>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #f59e0b33' }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'rgba(245,158,11,0.08)' }}>
                  <th className="text-left px-4 py-2 font-black" style={{ color: '#f59e0b' }}>Email</th>
                  <th className="text-left px-4 py-2 font-black" style={{ color: '#f59e0b' }}>Plan</th>
                  <th className="text-left px-4 py-2 font-black" style={{ color: '#f59e0b' }}>Credits left</th>
                </tr>
              </thead>
              <tbody>
                {data.atRiskUsers.map((u, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(245,158,11,0.1)', background: i % 2 === 0 ? 'transparent' : 'rgba(11,17,32,0.4)' }}>
                    <td className="px-4 py-2 font-mono" style={{ color: 'var(--text)' }}>{u.email}</td>
                    <td className="px-4 py-2 uppercase text-[10px] font-black" style={{ color: u.plan === 'pro' ? '#34d399' : '#60a5fa' }}>{u.plan}</td>
                    <td className="px-4 py-2 font-black" style={{ color: u.credits === 0 ? '#f87171' : '#f59e0b' }}>
                      {u.credits === 0 ? '0 ⚠️' : u.credits}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
            These paid users are about to run out — proactive outreach can prevent churn.
          </p>
        </section>
      )}
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────────

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

function Card({ label, value, hint, accent }: { label: string; value: string | number; hint?: string; accent?: string }) {
  const v = typeof value === 'number' ? value.toLocaleString('en-US') : value
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(11,17,32,0.85)', border: `1px solid ${accent ? accent + '33' : 'var(--border)'}` }}>
      <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: accent ?? 'var(--muted)' }}>{label}</div>
      <div className="font-black" style={{ fontSize: '1.7rem', lineHeight: 1.1, color: accent ?? 'var(--text)' }}>{v}</div>
      {hint && <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>{hint}</p>}
    </div>
  )
}

function BigCard({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div className="rounded-xl p-5 col-span-full sm:col-span-1" style={{ background: `linear-gradient(135deg, rgba(11,17,32,0.95), rgba(11,17,32,0.85))`, border: `1px solid ${accent ? accent + '55' : 'var(--border)'}`, gridColumn: 'span 2' }}>
      <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: accent ?? 'var(--muted)' }}>{label}</div>
      <div className="font-black mb-1" style={{ fontSize: '2.4rem', lineHeight: 1.1, color: accent ?? 'var(--text)' }}>{value}</div>
      {sub && <p className="text-xs" style={{ color: 'var(--muted)' }}>{sub}</p>}
    </div>
  )
}

function RateCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  const isGood = value !== '—' && parseFloat(value) >= 10
  const accent = value === '—' ? '#94a3b8' : isGood ? '#34d399' : '#f59e0b'
  return (
    <div className="rounded-xl p-4" style={{ background: 'rgba(11,17,32,0.85)', border: `1px solid ${accent}33` }}>
      <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className="font-black" style={{ fontSize: '1.9rem', lineHeight: 1.1, color: accent }}>{value}</div>
      <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>{sub}</p>
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
          style={{ background: active === t.key ? '#f59e0b' : 'transparent', color: active === t.key ? '#000' : 'var(--muted)' }}>
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
