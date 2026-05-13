'use client'

// Push #036 — 3-card pricing grid (Free / Basic / Pro) for embedding on
// Step 1 of /generate. Visual style matches /pricing exactly so the user
// sees the same brand. The /pricing route still owns the canonical billing
// experience (current credits, FAQ, billing portal) — this is just the
// in-flow nudge below the prompt textarea.
//
// CTAs:
//   - Free  → static "Current plan" label (no action)
//   - Basic → POST /api/stripe/checkout { tier: 'basic' } → redirect
//   - Pro   → POST /api/stripe/checkout { tier: 'pro'   } → redirect
//
// On 401 from checkout, we bounce to /login?redirect=/generate so the user
// can sign in and come back.

import { useState } from 'react'

const FREE_FEATURES = [
  '2 credits',
  'Try ShortsForgeAI before upgrading',
  'MP4 ready to post',
  'Community support',
]

const BASIC_FEATURES = [
  '140 credits / month',
  '≈9 Shorts of 30–35s',
  '15 credits per Basic Short',
  'Launch offer: 50% off first month',
  'Email support',
]

const PRO_FEATURES = [
  '350 credits / month',
  '≈17 Shorts of 30–35s',
  '20 credits per Pro Short',
  'Launch offer: 50% off first month',
  'Better cinematic prompting',
  'Priority support',
]

export default function PricingCards() {
  const [purchasing, setPurchasing] = useState<'basic' | 'pro' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleBuy(tier: 'basic' | 'pro') {
    setError(null)
    setPurchasing(tier)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      if (res.status === 401) {
        window.location.href = '/login?redirect=/generate'
        return
      }
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.url) {
        window.location.href = data.url
        return
      }
      setError(typeof data?.error === 'string' ? data.error : 'Could not start checkout. Please retry.')
    } catch {
      setError('Could not start checkout. Please retry.')
    } finally {
      setPurchasing(null)
    }
  }

  return (
    <section className="mt-8">
      <div className="text-center mb-5">
        <div
          className="font-black uppercase tracking-widest mb-1"
          style={{ fontSize: '0.62rem', color: '#93C5FD' }}
        >
          Pricing
        </div>
        <h2
          className="font-black tracking-tight"
          style={{ fontSize: '1.35rem', color: 'var(--text)' }}
        >
          Choose your plan — launch offer 50% off
        </h2>
      </div>

      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm mb-4 mx-auto"
          style={{
            maxWidth: 720,
            background: 'rgba(239,68,68,.07)',
            border: '1px solid rgba(239,68,68,.25)',
            color: '#f87171',
          }}
        >
          {error}
        </div>
      )}

      <div
        className="grid mx-auto gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}
      >
        <PlanCard
          name="Free"
          price="$0"
          period="/ month"
          tagline="Try ShortsForgeAI before upgrading."
          features={FREE_FEATURES}
          cta={null}
        />

        <PlanCard
          name="Basic"
          price="$4.50"
          period="first month"
          renewNote="then $9/month"
          tagline="140 credits / month. ≈9 Shorts."
          features={BASIC_FEATURES}
          badge="Most Popular"
          highlight
          cta={{
            label: purchasing === 'basic' ? 'Loading…' : 'Get Basic — $4.50',
            onClick: () => handleBuy('basic'),
            loading: purchasing === 'basic',
          }}
        />

        <PlanCard
          name="Pro"
          price="$9.50"
          period="first month"
          renewNote="then $19/month"
          tagline="350 credits / month. ≈17 Shorts."
          features={PRO_FEATURES}
          badge="Best Value"
          cta={{
            label: purchasing === 'pro' ? 'Loading…' : 'Get Pro — $9.50',
            onClick: () => handleBuy('pro'),
            loading: purchasing === 'pro',
          }}
        />
      </div>
    </section>
  )
}

function PlanCard({
  name,
  price,
  period,
  renewNote,
  tagline,
  features,
  badge,
  highlight,
  cta,
}: {
  name: string
  price: string
  period: string
  renewNote?: string
  tagline: string
  features: string[]
  badge?: string
  highlight?: boolean
  cta: { label: string; onClick: () => void; loading?: boolean } | null
}) {
  return (
    <div
      className="rounded-2xl p-6 relative overflow-hidden flex flex-col"
      style={{
        background: highlight
          ? 'linear-gradient(135deg, rgba(37,99,235,.10), rgba(29,78,216,.06))'
          : 'rgba(15,15,30,0.85)',
        border: highlight ? '2px solid rgba(37,99,235,.45)' : '1px solid var(--border)',
        boxShadow: highlight ? '0 0 40px rgba(37,99,235,.18)' : '0 0 20px rgba(37,99,235,.04)',
      }}
    >
      {badge && (
        <div
          className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-xs font-black"
          style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', color: '#fff' }}
        >
          {badge}
        </div>
      )}

      <div className="mb-4">
        <div
          className="text-xs font-black uppercase tracking-widest mb-2"
          style={{ color: highlight ? '#93C5FD' : 'var(--muted)' }}
        >
          {name}
        </div>
        <div className="flex items-end gap-1 mb-1">
          <span className="font-black" style={{ fontSize: '2.1rem', color: 'var(--text)', lineHeight: 1 }}>
            {price}
          </span>
          <span className="text-xs pb-1" style={{ color: 'var(--muted)' }}>
            {period}
          </span>
        </div>
        {renewNote && (
          <p className="text-xs mb-1" style={{ color: '#93C5FD', fontWeight: 700 }}>
            {renewNote}
          </p>
        )}
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          {tagline}
        </p>
      </div>

      <div className="flex flex-col gap-2 mb-5 flex-1">
        {features.map((f) => (
          <div key={f} className="flex items-start gap-2 text-xs">
            <span style={{ color: '#34d399', fontSize: '0.75rem', marginTop: 2 }}>✓</span>
            <span style={{ color: 'var(--text2)' }}>{f}</span>
          </div>
        ))}
      </div>

      {cta ? (
        <button
          onClick={cta.onClick}
          disabled={cta.loading}
          className="w-full rounded-xl py-3 text-sm font-black text-white"
          style={{
            background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            boxShadow: '0 4px 18px rgba(37,99,235,.28)',
            border: 'none',
            cursor: cta.loading ? 'wait' : 'pointer',
            opacity: cta.loading ? 0.7 : 1,
          }}
        >
          {cta.label}
        </button>
      ) : (
        <div
          className="w-full text-center rounded-xl py-3 text-sm font-bold"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            color: 'var(--muted2)',
          }}
        >
          Current plan
        </div>
      )}
    </div>
  )
}
