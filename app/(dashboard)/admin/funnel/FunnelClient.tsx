'use client'

// Push #061 — Conversion Funnel Dashboard (client).
// Pure presentation. Server hands us a flat counts object; we render
// the funnel as a sequence of step cards with the absolute count, plus
// a "Conversion rates" grid that derives ratios safely (division by
// zero shows as "—").

import Link from 'next/link'

export interface FunnelData {
  eventsAvailable: boolean
  counts: {
    homepage_view: number
    generate_page_view: number
    analyze_idea_clicked: number
    video_generation_started: number
    video_generation_completed: number
    video_generation_failed: number
    pricing_view: number
    basic_checkout_clicked: number
    pro_checkout_clicked: number
    payment_success: number
    checkout_cancelled: number
  }
}

interface Props {
  data?: FunnelData
  viewerEmail?: string
  denied?: boolean
}

function fmt(v: number): string {
  return v.toLocaleString('en-US')
}

function pct(num: number, denom: number): string {
  if (!denom || denom <= 0) return '—'
  const ratio = (num / denom) * 100
  if (!Number.isFinite(ratio)) return '—'
  return `${ratio.toFixed(1)}%`
}

export default function FunnelClient({ data, viewerEmail, denied }: Props) {
  if (denied || !data) {
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

  const c = data.counts
  const checkoutClicks = c.basic_checkout_clicked + c.pro_checkout_clicked

  const steps = [
    { label: 'Homepage views', value: c.homepage_view, hint: 'homepage_view' },
    { label: 'Generate page views', value: c.generate_page_view, hint: 'generate_page_view' },
    { label: 'Analyze clicks', value: c.analyze_idea_clicked, hint: 'analyze_idea_clicked' },
    { label: 'Videos started', value: c.video_generation_started, hint: 'video_generation_started' },
    { label: 'Videos completed', value: c.video_generation_completed, hint: 'video_generation_completed' },
    { label: 'Videos failed', value: c.video_generation_failed, hint: 'video_generation_failed' },
    { label: 'Pricing views', value: c.pricing_view, hint: 'pricing_view' },
    { label: 'Basic checkout clicks', value: c.basic_checkout_clicked, hint: 'basic_checkout_clicked' },
    { label: 'Pro checkout clicks', value: c.pro_checkout_clicked, hint: 'pro_checkout_clicked' },
    { label: 'Payment success', value: c.payment_success, hint: 'payment_success' },
  ]

  const rates = [
    { label: 'Homepage → Generate', value: pct(c.generate_page_view, c.homepage_view) },
    { label: 'Generate → Analyze', value: pct(c.analyze_idea_clicked, c.generate_page_view) },
    { label: 'Analyze → Completed', value: pct(c.video_generation_completed, c.analyze_idea_clicked) },
    { label: 'Completed → Pricing', value: pct(c.pricing_view, c.video_generation_completed) },
    { label: 'Pricing → Checkout', value: pct(checkoutClicks, c.pricing_view) },
    { label: 'Checkout → Payment', value: pct(c.payment_success, checkoutClicks) },
  ]

  return (
    <div className="px-4 sm:px-6 py-7 pb-20 max-w-5xl mx-auto">
      <header className="mb-6">
        <div
          className="font-black uppercase tracking-widest mb-1"
          style={{ fontSize: '0.62rem', color: '#93c5fd' }}
        >
          Admin · Staging
        </div>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-black tracking-tight mb-1" style={{ fontSize: '1.6rem', color: 'var(--text)' }}>
              Conversion Funnel
            </h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Live counts from public.events on the staging Supabase project. Signed in as {viewerEmail}.
            </p>
          </div>
        </div>

        <AdminNav active="funnel" />
      </header>

      {!data.eventsAvailable && (
        <div
          className="rounded-xl px-4 py-3 mb-6"
          style={{
            background: 'rgba(34, 211, 238,.08)',
            border: '1px solid rgba(34, 211, 238,.25)',
            color: '#22D3EE',
            fontSize: '0.82rem',
          }}
        >
          public.events table not found. All counts shown as 0. Run
          <code className="mx-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,.3)' }}>
            supabase/migrations/005_events_staging.sql
          </code>
          in the staging Supabase SQL editor to enable tracking.
        </div>
      )}

      <section className="mb-7">
        <h2
          className="font-black tracking-tight mb-3"
          style={{ fontSize: '0.95rem', color: 'var(--text)' }}
        >
          Funnel steps
        </h2>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
        >
          {steps.map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-4"
              style={{ background: 'rgba(11,17,32,0.85)', border: '1px solid var(--border)' }}
            >
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--muted)' }}
              >
                {s.label}
              </div>
              <div
                className="font-black"
                style={{ fontSize: '1.7rem', lineHeight: 1.1, color: 'var(--text)' }}
              >
                {fmt(s.value)}
              </div>
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>
                {s.hint}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-7">
        <h2
          className="font-black tracking-tight mb-3"
          style={{ fontSize: '0.95rem', color: 'var(--text)' }}
        >
          Conversion rates
        </h2>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
        >
          {rates.map((r) => (
            <div
              key={r.label}
              className="rounded-xl p-4"
              style={{ background: 'rgba(11,17,32,0.85)', border: '1px solid var(--border)' }}
            >
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--muted)' }}
              >
                {r.label}
              </div>
              <div
                className="font-black"
                style={{
                  fontSize: '1.7rem',
                  lineHeight: 1.1,
                  color: r.value === '—' ? 'var(--muted2)' : 'var(--text)',
                }}
              >
                {r.value}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function AdminNav({ active }: { active: 'metrics' | 'funnel' | 'users' }) {
  const tabs: Array<{ key: 'metrics' | 'funnel' | 'users'; label: string; href: string }> = [
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
              background: isActive ? 'rgba(37, 99, 235,.18)' : 'rgba(255,255,255,.04)',
              border: `1px solid ${isActive ? 'rgba(37, 99, 235,.45)' : 'var(--border)'}`,
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
