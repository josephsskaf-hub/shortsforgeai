'use client'

// Push #410 — Admin Overview: one-page dashboard (replaces the legacy
// server-rendered /admin that still showed the $4.90/$9.90 era).
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
    activatedTotal?: number
    activationRate?: number
  }
  logins: Array<{
    email: string
    last_sign_in_at: string | null
    plan: string
    signed_up_at: string | null
    // Push #433 — credit X-ray per user
    credits?: number
    videosCount?: number
    creditsSpent?: number
    engines?: { fast: number; ai: number; kling: number; other: number }
    videos?: Array<{ title: string; engine: string; credits: number; at: string | null }>
  }>
  intent: Array<{ email: string; kind: string; tier: string | null; amount: string | null; at: string | null }>
  subscribers: Array<{ email: string; plan: string; credits: number; signed_up_at: string | null; last_sign_in_at: string | null }>
  funnel?: Array<{ date: string; signups: number; activated: number; paying: number }>
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
      style={{ background: 'rgba(255,255,255,.03)', border: '1.5px solid rgba(255,255,255,.08)' }}
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
      <div className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#94A3B8]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-black text-[#F1F5F9]">
        {value}
      </div>
      {sub ? (
        <div className="mt-0.5 text-[11px] font-semibold text-[#64748B]">
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
      <div className="mx-auto max-w-5xl px-4 py-12 text-center" style={{ background: '#0A0A0F', minHeight: '100vh' }}>
        <div className="text-lg font-black text-[#F1F5F9]">Admin</div>
        <p className="mt-2 text-sm text-[#94A3B8]">{error}</p>
        <Link href="/login?next=/admin" className="mt-4 inline-block text-sm font-bold text-cyan-400">
          Sign in →
        </Link>
      </div>
    )
  }

  const k = data?.kpis

  return (
    <div style={{ background: '#0A0A0F', minHeight: '100vh' }}>
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[.16em] text-cyan-400">Admin</div>
          <h1 className="text-2xl font-black tracking-tight text-[#F1F5F9]">
            Overview
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-[#64748B]">
            {updatedAt ? `updated ${updatedAt.toLocaleTimeString()}` : 'loading…'}
          </span>
          <nav className="flex gap-2 text-[12px] font-bold">
            <Link href="/admin/users" className="rounded-lg px-2.5 py-1.5 text-[#94A3B8]" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}>Users</Link>
            <Link href="/admin/funnel" className="rounded-lg px-2.5 py-1.5 text-[#94A3B8]" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}>Funnel</Link>
            <Link href="/admin/metrics" className="rounded-lg px-2.5 py-1.5 text-[#94A3B8]" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}>Metrics</Link>
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
        <Kpi
          label="Activation"
          value={k?.activationRate != null ? `${k.activationRate}%` : '…'}
          accent="34,211,238"
          sub={k?.activatedTotal != null ? `${k.activatedTotal} users made ≥1 video` : undefined}
        />
      </div>

      {/* Push #426 — 14-day activation funnel: per signup-day cohort, how many
          signed up vs how many of those ever generated a video vs now paying.
          The fastest answer to "is the green gift banner working?" */}
      <section
        className="mt-6 rounded-2xl p-4"
        style={{ background: 'rgba(34,211,238,.04)', border: '1.5px solid rgba(34,211,238,.25)' }}
      >
        <h2 className="mb-1 text-sm font-black text-[#F1F5F9]">🎯 Activation funnel · last 14 days</h2>
        <p className="mb-3 text-[11px] font-semibold text-[#64748B]">
          per signup day: <span className="text-[#64748B]">▮ signups</span>{' '}
          <span className="text-cyan-400">▮ made a video</span>{' '}
          <span className="text-amber-400">▮ paying</span>
        </p>
        <div className="flex items-end gap-1.5" style={{ height: 120 }}>
          {(data?.funnel ?? []).map((d) => {
            const max = Math.max(1, ...(data?.funnel ?? []).map((x) => x.signups))
            const h = (n: number) => Math.max(n > 0 ? 4 : 0, Math.round((n / max) * 100))
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.signups} signups · ${d.activated} activated · ${d.paying} paying`}>
                <div className="flex w-full items-end justify-center gap-[2px]" style={{ height: 100 }}>
                  <div style={{ width: '30%', height: `${h(d.signups)}%`, background: 'rgba(148,163,184,.45)', borderRadius: 2 }} />
                  <div style={{ width: '30%', height: `${h(d.activated)}%`, background: 'rgba(34,211,238,.85)', borderRadius: 2 }} />
                  <div style={{ width: '30%', height: `${h(d.paying)}%`, background: 'rgba(245,158,11,.9)', borderRadius: 2 }} />
                </div>
                <span className="text-[8px] font-bold text-[#64748B]">{d.date.slice(5)}</span>
              </div>
            )
          })}
          {data && (data.funnel?.length ?? 0) === 0 ? (
            <p className="text-[12px] text-[#64748B]">No data yet.</p>
          ) : null}
        </div>
      </section>

      {/* Push #418 — Subscribers: who's paying and on which plan */}
      <section
        className="mt-6 rounded-2xl p-4"
        style={{ background: 'rgba(168,85,247,.04)', border: '1.5px solid rgba(168,85,247,.25)' }}
      >
        <h2 className="mb-3 text-sm font-black text-[#F1F5F9]">
          💎 Subscribers ({data?.subscribers?.length ?? 0})
        </h2>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {(data?.subscribers ?? []).map((s) => (
            <div
              key={s.email}
              className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2"
              style={{ background: 'rgba(255,255,255,.03)' }}
            >
              <span className="truncate text-[12.5px] font-semibold text-[#F1F5F9]">
                {s.email}
              </span>
              <span className="flex flex-shrink-0 items-center gap-2">
                <span className="text-[11px] font-bold text-[#64748B]">{s.credits} cr</span>
                <PlanChip plan={s.plan} />
                <span className="w-14 text-right text-[11px] font-bold text-[#64748B]">
                  {timeAgo(s.last_sign_in_at)}
                </span>
              </span>
            </div>
          ))}
          {data && (data.subscribers?.length ?? 0) === 0 ? (
            <p className="text-[12px] text-[#64748B]">No paying subscribers yet.</p>
          ) : null}
        </div>
      </section>

      {/* Two columns: logins + intent */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent logins */}
        <section
          className="rounded-2xl p-4"
          style={{ background: 'rgba(255,255,255,.02)', border: '1.5px solid rgba(255,255,255,.08)' }}
        >
          <h2 className="mb-3 text-sm font-black text-[#F1F5F9]">
            🔑 Recent logins · credit X-ray
          </h2>
          <div className="space-y-1.5">
            {(data?.logins ?? []).map((l) => (
              /* Push #433 — each login row is now expandable: balance, spend
                 by engine, and the user's 5 most recent videos. */
              <details
                key={l.email + (l.last_sign_in_at ?? '')}
                className="rounded-lg"
                style={{ background: 'rgba(255,255,255,.03)' }}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold text-[#F1F5F9]">
                      {l.email}
                    </span>
                    <span className="block text-[10.5px] font-bold text-[#64748B]">
                      💳 {l.credits ?? 0} cr left
                      {(l.videosCount ?? 0) > 0 ? (
                        <>
                          {' '}· spent <span className="text-[#FBBF24]">{l.creditsSpent ?? 0} cr</span> on {l.videosCount} video{(l.videosCount ?? 0) > 1 ? 's' : ''}
                          {' '}({[
                            (l.engines?.fast ?? 0) > 0 ? `${l.engines?.fast} Fast` : null,
                            (l.engines?.ai ?? 0) > 0 ? `${l.engines?.ai} AI` : null,
                            (l.engines?.kling ?? 0) > 0 ? `${l.engines?.kling} Kling` : null,
                            (l.engines?.other ?? 0) > 0 ? `${l.engines?.other} legacy` : null,
                          ].filter(Boolean).join(' · ')})
                        </>
                      ) : (
                        <span className="text-[#64748B]"> · no videos yet</span>
                      )}
                    </span>
                  </span>
                  <span className="flex flex-shrink-0 items-center gap-2">
                    <PlanChip plan={l.plan} />
                    <span className="w-14 text-right text-[11px] font-bold text-[#64748B]">
                      {timeAgo(l.last_sign_in_at)}
                    </span>
                  </span>
                </summary>
                {(l.videos ?? []).length > 0 ? (
                  <div className="space-y-1 px-2.5 pb-2">
                    {(l.videos ?? []).map((v, vi) => (
                      <div
                        key={vi}
                        className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5"
                        style={{ background: 'rgba(255,255,255,.03)' }}
                      >
                        <span className="truncate text-[11px] text-[#94A3B8]">
                          {v.engine === 'fast' ? '⚡' : v.engine === 'ai' ? '✨' : v.engine === 'kling' ? '🎬' : '📼'} {v.title}
                        </span>
                        <span className="flex-shrink-0 text-[10.5px] font-bold text-[#FBBF24]">
                          {v.credits} cr · <span className="text-[#64748B]">{timeAgo(v.at)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-2.5 pb-2 text-[11px] text-[#64748B]">
                    No videos generated yet — credits untouched.
                  </p>
                )}
              </details>
            ))}
            {data && data.logins.length === 0 ? (
              <p className="text-[12px] text-[#64748B]">No logins yet.</p>
            ) : null}
          </div>
        </section>

        {/* Purchase intent */}
        <section
          className="rounded-2xl p-4"
          style={{ background: 'rgba(255,255,255,.02)', border: '1.5px solid rgba(255,255,255,.08)' }}
        >
          <h2 className="mb-3 text-sm font-black text-[#F1F5F9]">
            💳 Purchase intent (didn&apos;t pay yet)
          </h2>
          <div className="space-y-1.5">
            {(data?.intent ?? []).map((r, i) => (
              <div
                key={r.email + i}
                className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2"
                style={{ background: 'rgba(255,255,255,.03)' }}
              >
                <span className="truncate text-[12.5px] font-semibold text-[#F1F5F9]">
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
                  <span className="w-14 text-right text-[11px] font-bold text-[#64748B]">
                    {timeAgo(r.at)}
                  </span>
                </span>
              </div>
            ))}
            {data && data.intent.length === 0 ? (
              <p className="text-[12px] text-[#64748B]">No leads right now.</p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
    </div>
  )
}
