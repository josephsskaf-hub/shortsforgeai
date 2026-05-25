'use client'

// Push #254 — Funnel rebuilt on real DB data (auth.users + profiles + videos).
// Old version showed all-zeros because public.events table doesn't exist.
// New version pulls live counts and computes real conversion rates.

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

const POLL_MS = 30_000

export default function FunnelClient({ data: initialData, viewerEmail, denied }: Props) {
  const [data, setData] = useState<FunnelData | undefined>(initialData)
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

  useEffect(() => {
    if (denied) return
    async function poll() {
      setRefreshing(true)
      try {
        const res = await fetch('/api/admin/funnel', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (json?.data) {
          setData(json.data as FunnelData)
          setLastUpdated(new Date())
          setSecondsAgo(0)
        }
      } catch { /* silent */ } finally {
        setRefreshing(false)
      }
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

  const s = data.realStats
  const r = data.rates

  return (
    <div className="px-4 sm:px-6 py-7 pb-20 max-w-5xl mx-auto">
      <header className="mb-6">
        <div className="font-black uppercase tracking-widest mb-1" style={{ fontSize: '0.62rem', color: '#93c5fd' }}>
          Admin · Live
        </div>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-black tracking-tight mb-1" style={{ fontSize: '1.6rem', color: 'var(--text)' }}>
              Conversion Funnel
            </h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Live from auth.users + profiles + videos. Signed in as {viewerEmail}.
            </p>
          </div>
          <RefreshIndicator refreshing={refreshing} secondsAgo={secondsAgo} lastUpdated={lastUpdated} />
        </div>
        <AdminNav active="funnel" />
      </header>

      {/* ── Row 1: Growth ─────────────────────────────────────────────────── */}
      <Section title="Growth">
        <Card label="Total users"      value={fmt(s.totalUsers)}    hint="all signups"         accent="#22d3ee" />
        <Card label="New this week"    value={fmt(s.newThisWeek)}   hint="last 7 days"         accent="#34d399" />
        <Card label="New this month"   value={fmt(s.newThisMonth)}  hint="last 30 days"        accent="#60a5fa" />
        <Card label="Videos this week" value={fmt(s.videosThisWeek)} hint="last 7 days"        accent="#a78bfa" />
      </Section>

      {/* ── Row 2: Plans ──────────────────────────────────────────────────── */}
      <Section title="Subscribers">
        <Card label="Pro"   value={fmt(s.proUsers)}   hint="plan = pro"   accent="#34d399" />
        <Card label="Basic" value={fmt(s.basicUsers)} hint="plan = basic" accent="#60a5fa" />
        <Card label="Free"  value={fmt(s.freeUsers)}  hint="no paid plan" accent="#94a3b8" />
        <Card
          label="Paid · 0 credits ⚠️"
          value={fmt(s.paidNoCredits)}
          hint="check Stripe webhook"
          accent={s.paidNoCredits > 0 ? '#f87171' : '#34d399'}
        />
      </Section>

      {/* ── Row 3: Video activity ─────────────────────────────────────────── */}
      <Section title="Video activity">
        <Card label="Total videos"      value={fmt(s.totalVideos)}    hint="all time"             accent="#f59e0b" />
        <Card label="Users w/ videos"   value={fmt(s.usersWithVideos)} hint="made ≥ 1 video"      accent="#f59e0b" />
        <Card label="Avg per user"
          value={s.usersWithVideos > 0 ? (s.totalVideos / s.usersWithVideos).toFixed(1) : '—'}
          hint="videos / active users"
          accent="#fbbf24"
        />
        <Card label="Activation rate"   value={r.signupToVideo}       hint="signed up → video"    accent="#fbbf24" />
      </Section>

      {/* ── Row 4: Conversion rates ───────────────────────────────────────── */}
      <Section title="Conversion rates">
        <RateCard label="Signup → Video"  value={r.signupToVideo} sub={`${s.usersWithVideos} / ${s.totalUsers}`} />
        <RateCard label="Signup → Paid"   value={r.signupToPaid}  sub={`${s.proUsers + s.basicUsers} / ${s.totalUsers}`} />
        <RateCard label="Video → Paid"    value={r.videoToPaid}   sub={`${s.proUsers + s.basicUsers} / ${s.usersWithVideos}`} />
        <RateCard label="Basic → Pro"     value={r.basicToPro}    sub={`${s.proUsers} / ${s.proUsers + s.basicUsers}`} />
      </Section>
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
