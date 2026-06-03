'use client'

// Push #410 — Admin Overview: one-page dashboard.
// Top KPIs + recent logins + purchase-intent leads, all from a single
// /api/admin/overview call. Auto-refreshes every 60s. Admin-gated
// server-side (the API returns 403 for non-admins).

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Overview = {
  kpis: {
    totalUsers: number
    newUsers7d: number
    logins24h: number
    payingTotal: number
    payingByPlan: Record<string, number>
    mrrUsd: number
    videosTotal: number
    videos7d: number
    purchaseIntent: number
  }
  logins: Array<{ email: string; last_sign_in_at: string | null; plan: string; signed_up_at: string | null }>
  intent: Array<{ email: string; kind: string; tier: string | null; amount: string | null; at: string | null }>
}

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter',
  starter_trial: 'Starter (trial)',
  basic: 'Creator',
  basic_trial: 'Creator (trial)',
  pro: 'Studio',
  pro_trial: 'Studio (trial)',
  free: 'Free',
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function PlanChip({ plan }: { plan: string }) {
  const p = plan.replace('_trial', '')
  const color =
    p === 'pro' ? '168,85,247' : p === 'basic' ? '245,158,11' : p === 'starter' ? '37,99,235' : '148,163,184'
  return (
    <span
      className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
      style={{
        background: `rgba(${color},.14)`,
        color: `rgb(${color})`,
        border: `1px solid rgba(${color},.3)`,
      }}
    >
      {PLAN_LABEL[plan] ?? plan}
    </span>
  )
}

function Kpi({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
  return (
    <div
      className="relative rounded-2xl p-4 overflow-hidden"
      style={{ background: 'rgba(255,255,255,.03)', border: '1.5px solid var(--border)' }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent 5%, rgba(${accent ?? '34,211,238'},.6) 50%, transparent 95%)`,
        }}
      />
      <div className="text-[10px] font-extrabold uppercase tracking-[.14em]" style={{ color: 'var(--muted)' }}>
        {label}
      </div>
      <div className="mt-1 text-2xl font-black" style={{ color: 'var(--text)' }}>
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 text-[11px] font-semibold" style={{ color: 'var(--muted2)' }}>
          {sub}
        </div>
      ) : null}
    </div>
  )
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/admin/overview', { cache: 'no-store' })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          if (!cancelled) setError(j?.error ?? `Error ${res.status}`)
          return
        }
        const j = (await res.json()) as Overview
        if (!cancelled) {
          setData(j)
          setError(null)
          setUpdatedAt(new Date())
        }
      } catch {
        if (!cancelled) setError('Failed to load')
      }
    }
    load()
    const t = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12 text-center">
        <div className="text-lg font-black" style={{ color: 'var(--text)' }}>Admin</div>
        <p className="mt-2 text-sm" style={{ color: 'var(--muted2)' }}>{error}</p>
      </div>
    )
  }

  const k = data?.kpis

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[.16em] text-cyan-400">Admin</div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text)' }}>
            Overview
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold" style={{ color: 'var(--muted)' }}>
            {updatedAt ? `updated ${updatedAt.toLocaleTimeString()}` : 'loading…'}
          </span>
          <nav className="flex gap-2 text-[12px] font-bold">
            <Link href="/admin/users" className="rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,.05)', color: 'var(--muted2)', border: '1px solid var(--border)' }}>Users</Link>
            <Link href="/admin/funnel" className="rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,.05)', color: 'var(--muted2)', border: '1px solid var(--border)' }}>Funnel</Link>
            <Link href="/admin/metrics" className="rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,.05)', color: 'var(--muted2)', border: '1px solid var(--border)' }}>Metrics</Link>
          </nav>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total users" value={k ? String(k.totalUsers) : '…'} accent="34,211,238" sub={k ? `+${k.newUsers7d} last 7d` : undefined} />
        <Kpi label="Logins · 24h" value={k ? String(k.logins24h) : '…'} accent="16,185,129" />
        <Kpi
          label="Paying users"
          value={k ? String(k.payingTotal) : '…'}
          accent="245,158,11"
          sub={
            k
              ? `S ${k.payingByPlan.starter ?? 0} · C ${k.payingByPlan.basic ?? 0} · St ${k.payingByPlan.pro ?? 0}`
              : undefined
          }
        />
        <Kpi label="MRR (est.)" value={k ? `$${k.mrrUsd.toFixed(2)}` : '…'} accent="168,85,247" />
        <Kpi label="Videos · total" value={k ? String(k.videosTotal) : '…'} accent="34,211,238" sub={k ? `+${k.videos7d} last 7d` : undefined} />
        <Kpi label="Purchase intent" value={k ? String(k.purchaseIntent) : '…'} accent="239,68,68" sub="checkout started / warm" />
        <Kpi label="New users · 7d" value={k ? String(k.newUsers7d) : '…'} accent="16,185,129" />
        <Kpi label="Videos · 7d" value={k ? String(k.videos7d) : '…'} accent="245,158,11" />
      </div>

      {/* Two columns: logins + intent */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent logins */}
        <section
          className="rounded-2xl p-4"
          style={{ background: 'rgba(255,255,255,.02)', border: '1.5px solid var(--border)' }}
        >
          <h2 className="mb-3 text-sm font-black" style={{ color: 'var(--text)' }}>
            🔑 Recent logins
          </h2>
          <div className="space-y-1.5">
            {(data?.logins ?? []).map((l) => (
              <div
                key={l.email + (l.last_sign_in_at ?? '')}
                className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2"
                style={{ background: 'rgba(255,255,255,.03)' }}
              >
                <span className="truncate text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
                  {l.email}
                </span>
                <span className="flex flex-shrink-0 items-center gap-2">
                  <PlanChip plan={l.plan} />
                  <span className="w-14 text-right text-[11px] font-bold" style={{ color: 'var(--muted2)' }}>
                    {timeAgo(l.last_sign_in_at)}
                  </span>
                </span>
              </div>
            ))}
            {data && data.logins.length === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--muted2)' }}>No logins yet.</p>
            ) : null}
          </div>
        </section>

        {/* Purchase intent */}
        <section
          className="rounded-2xl p-4"
          style={{ background: 'rgba(255,255,255,.02)', border: '1.5px solid var(--border)' }}
        >
          <h2 className="mb-3 text-sm font-black" style={{ color: 'var(--text)' }}>
            💳 Purchase intent (didn&apos;t pay yet)
          </h2>
          <div className="space-y-1.5">
            {(data?.intent ?? []).map((r, i) => (
              <div
                key={r.email + i}
                className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2"
                style={{ background: 'rgba(255,255,255,.03)' }}
              >
                <span className="truncate text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
                  {r.email}
                </span>
                <span className="flex flex-shrink-0 items-center gap-2">
                  <span
                    className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={
                      r.kind === 'abandoned_checkout'
                        ? { background: 'rgba(239,68,68,.14)', color: '#f87171', border: '1px solid rgba(239,68,68,.3)' }
                        : { background: 'rgba(245,158,11,.14)', color: '#fcd34d', border: '1px solid rgba(245,158,11,.3)' }
                    }
                  >
                    {r.kind === 'abandoned_checkout' ? `checkout${r.tier ? ` · ${r.tier}` : ''}` : 'warm lead'}
                  </span>
                  <span className="w-14 text-right text-[11px] font-bold" style={{ color: 'var(--muted2)' }}>
                    {timeAgo(r.at)}
                  </span>
                </span>
              </div>
            ))}
            {data && data.intent.length === 0 ? (
              <p className="text-[12px]" style={{ color: 'var(--muted2)' }}>No leads right now.</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}
