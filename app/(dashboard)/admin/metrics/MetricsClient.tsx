'use client'

// Push #066 — Conversion Metrics Dashboard (client).
// Now auto-polls /api/admin/metrics every 30 s — no manual refresh needed.
// Shows a "Last updated X s ago" indicator and a spinning dot while
// refreshing. Also adds a "Videos Downloaded" metric card.
// The page server component still seeds the initial data on first render
// so there's no loading flash.

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

export interface MetricsData {
  totalUsers: number | null
  newUsersToday: number | null
  totalCompleted: number | null
  videosToday: number | null
  failedVideos: number | null
  successRate: number | null
  eventsAvailable: boolean
  pricingViews: number | null
  checkoutBasicClicks: number | null
  checkoutProClicks: number | null
  generateStarted: number | null
  generateCompleted: number | null
  generateFailed: number | null
  videosDownloaded: number | null
}

interface Props {
  metrics?: MetricsData
  viewerEmail?: string
  denied?: boolean
}

function fmt(v: number | null): string {
  if (v === null || v === undefined) return '—'
  return v.toLocaleString('en-US')
}

const POLL_MS = 30_000

export default function MetricsClient({ metrics: initialMetrics, viewerEmail, denied }: Props) {
  const [metrics, setMetrics] = useState<MetricsData | undefined>(initialMetrics)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(initialMetrics ? new Date() : null)
  const [secondsAgo, setSecondsAgo] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Push #233 — Basic/Pro checkout-button clicks from public.click_events,
  // fetched from /api/admin/click-stats and polled alongside the metrics.
  const [clickStats, setClickStats] = useState<{
    basic: number | null
    pro: number | null
    available: boolean
  } | null>(null)

  // Tick the "X s ago" clock every second
  useEffect(() => {
    clockRef.current = setInterval(() => {
      if (lastUpdated) {
        setSecondsAgo(Math.round((Date.now() - lastUpdated.getTime()) / 1000))
      }
    }, 1000)
    return () => { if (clockRef.current) clearInterval(clockRef.current) }
  }, [lastUpdated])

  // Poll every 30 s
  useEffect(() => {
    if (denied) return

    async function poll() {
      setRefreshing(true)
      try {
        const res = await fetch('/api/admin/metrics', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (json?.data) {
          setMetrics(json.data as MetricsData)
          setLastUpdated(new Date())
          setSecondsAgo(0)
        }
      } catch {
        // silent — keep showing stale data
      } finally {
        setRefreshing(false)
      }
    }

    timerRef.current = setInterval(poll, POLL_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [denied])

  // Push #233 — load + poll click_events totals for the two new cards.
  useEffect(() => {
    if (denied) return
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/admin/click-stats', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled && json) {
          setClickStats({
            basic: typeof json.basic === 'number' ? json.basic : null,
            pro: typeof json.pro === 'number' ? json.pro : null,
            available: !!json.available,
          })
        }
      } catch {
        // silent — keep showing whatever we already have
      }
    }
    load()
    const id = setInterval(load, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [denied])

  if (denied || !metrics) {
    return (
      <div className="px-4 sm:px-6 py-10 pb-20 max-w-3xl mx-auto">
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-xl font-black mb-2" style={{ color: 'var(--text)' }}>
            Access denied.
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            This page is only available to staging admins.
          </p>
        </div>
      </div>
    )
  }

  const userCards: Card[] = [
    {
      label: 'Total users',
      value: metrics.totalUsers,
      hint:
        metrics.totalUsers === null
          ? 'Service role not configured'
          : 'auth.users count',
    },
    {
      label: 'New users today',
      value: metrics.newUsersToday,
      hint:
        metrics.newUsersToday === null
          ? 'Service role not configured'
          : 'since 00:00 UTC',
    },
  ]

  const videoCards: Card[] = [
    {
      label: 'Completed videos',
      value: metrics.totalCompleted,
      hint: 'status = completed',
    },
    {
      label: 'Videos today',
      value: metrics.videosToday,
      hint: 'created since 00:00 UTC',
    },
    {
      label: 'Failed generations',
      value: metrics.failedVideos,
      hint: metrics.failedVideos === null ? 'status column not available' : 'status = failed',
    },
    {
      label: 'Generation success rate',
      value:
        metrics.successRate === null ? null : `${metrics.successRate}%`,
      hint:
        metrics.successRate === null
          ? 'Need both completed + failed counts'
          : 'completed / (completed + failed)',
    },
  ]

  const eventCards: Card[] = [
    { label: 'Pricing views', value: metrics.pricingViews, eventName: 'pricing_view' },
    { label: 'Checkout · Basic clicks', value: metrics.checkoutBasicClicks, eventName: 'checkout_basic_click' },
    { label: 'Checkout · Pro clicks', value: metrics.checkoutProClicks, eventName: 'checkout_pro_click' },
    { label: 'Generate started', value: metrics.generateStarted, eventName: 'generate_started' },
    { label: 'Generate completed', value: metrics.generateCompleted, eventName: 'generate_completed' },
    { label: 'Generate failed', value: metrics.generateFailed, eventName: 'generate_failed' },
    { label: 'Videos downloaded', value: metrics.videosDownloaded, eventName: 'video_downloaded' },
  ]

  return (
    <div className="px-4 sm:px-6 py-7 pb-20 max-w-5xl mx-auto">
      <header className="mb-6">
        <div
          className="font-black uppercase tracking-widest mb-1"
          style={{ fontSize: '0.62rem', color: '#6ee7b7' }}
        >
          Admin · Staging
        </div>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-black tracking-tight mb-1" style={{ fontSize: '1.6rem', color: 'var(--text)' }}>
              Conversion Metrics
            </h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Live counts from the staging Supabase project. Signed in as {viewerEmail}.
            </p>
          </div>
          <RefreshIndicator refreshing={refreshing} secondsAgo={secondsAgo} lastUpdated={lastUpdated} />
        </div>

        <AdminNav active="metrics" />
      </header>

      <Section title="Users">
        <Grid>
          {userCards.map((c) => (
            <MetricCard key={c.label} card={c} />
          ))}
        </Grid>
      </Section>

      <Section title="Videos">
        <Grid>
          {videoCards.map((c) => (
            <MetricCard key={c.label} card={c} />
          ))}
        </Grid>
      </Section>

      <Section
        title="Checkout clicks"
        subtitle={
          clickStats?.available === false
            ? 'public.click_events table not present — run migration 008.'
            : 'Tracked via public.click_events (POST /api/track-click).'
        }
      >
        <Grid>
          <MetricCard
            card={{
              label: 'Basic Clicks',
              value: clickStats?.basic ?? null,
              hint: clickStats?.available === false ? 'Run migration 008' : 'plan = basic',
            }}
          />
          <MetricCard
            card={{
              label: 'Pro Clicks',
              value: clickStats?.pro ?? null,
              hint: clickStats?.available === false ? 'Run migration 008' : 'plan = pro',
            }}
          />
        </Grid>
      </Section>

      <Section
        title="Funnel events"
        subtitle={
          metrics.eventsAvailable
            ? 'Tracked via public.events (event name + created_at).'
            : 'public.events table not present in this database.'
        }
      >
        <Grid>
          {eventCards.map((c) => (
            <MetricCard
              key={c.label}
              card={{
                ...c,
                value: metrics.eventsAvailable ? c.value : null,
                hint: metrics.eventsAvailable
                  ? c.eventName
                  : 'Not tracked yet',
              }}
            />
          ))}
        </Grid>
      </Section>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface Card {
  label: string
  value: number | string | null
  hint?: string
  eventName?: string
}

function RefreshIndicator({
  refreshing,
  secondsAgo,
  lastUpdated,
}: {
  refreshing: boolean
  secondsAgo: number
  lastUpdated: Date | null
}) {
  if (!lastUpdated) return null
  return (
    <div
      className="flex items-center gap-1.5 text-[11px]"
      style={{ color: 'var(--muted)' }}
    >
      {refreshing ? (
        <span
          style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#22D3EE',
            animation: 'pulse 1s ease-in-out infinite',
          }}
        />
      ) : (
        <span
          style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'rgba(52,211,153,0.7)',
          }}
        />
      )}
      {refreshing ? 'Refreshing…' : `Updated ${secondsAgo}s ago`}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  )
}

function AdminNav({ active }: { active: 'metrics' | 'funnel' | 'users' | 'ceo' }) {
  const tabs: Array<{ key: 'metrics' | 'funnel' | 'users' | 'ceo'; label: string; href: string }> = [
    { key: 'ceo', label: 'CEO', href: '/admin/ceo' },
    { key: 'metrics', label: 'Metrics', href: '/admin/metrics' },
    { key: 'funnel', label: 'Funnel', href: '/admin/funnel' },
    { key: 'users', label: 'Users', href: '/admin/users' },
  ]
  return (
    <nav className="mt-4 flex items-center gap-2 flex-wrap">
      {tabs.map((t) => {
        const isActive = t.key === active
        return (
          <Link
            key={t.key}
            href={t.href}
            className="text-xs font-bold rounded-lg px-3 py-1.5"
            style={{
              background: isActive ? 'rgba(5, 150, 105,.18)' : 'rgba(255,255,255,.04)',
              border: `1px solid ${isActive ? 'rgba(5, 150, 105,.45)' : 'var(--border)'}`,
              color: isActive ? '#22D3EE' : 'var(--muted2)',
              textDecoration: 'none',
            }}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-7">
      <div className="mb-3">
        <h2
          className="font-black tracking-tight mb-0.5"
          style={{ fontSize: '0.95rem', color: 'var(--text)' }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      }}
    >
      {children}
    </div>
  )
}

function MetricCard({ card }: { card: Card }) {
  const isString = typeof card.value === 'string'
  const isAvailable = card.value !== null && card.value !== undefined
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'rgba(11,17,32,0.85)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        className="text-[10px] font-black uppercase tracking-widest mb-2"
        style={{ color: 'var(--muted)' }}
      >
        {card.label}
      </div>
      <div
        className="font-black"
        style={{
          fontSize: '1.7rem',
          lineHeight: 1.1,
          color: isAvailable ? 'var(--text)' : 'var(--muted2)',
        }}
      >
        {isAvailable ? (isString ? (card.value as string) : fmt(card.value as number)) : '—'}
      </div>
      {card.hint && (
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>
          {card.hint}
        </p>
      )}
    </div>
  )
}
