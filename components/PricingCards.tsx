'use client'

// Push #036 — 3-card pricing grid (Free / Basic / Pro) for embedding on
// Step 1 of /generate. Visual style matches /pricing exactly so the user
// sees the same brand. The /pricing route still owns the canonical billing
// experience (current credits, FAQ, billing portal) — this is just the
// in-flow nudge below the prompt textarea.
//
// Push #046 — CTAs now redirect directly to Stripe-hosted launch-offer
// payment links instead of hitting /api/stripe/checkout. This bypasses
// the server-side price-id lookup (the link itself encodes the price)
// and works for guests too — Stripe handles account / email collection.
//   - Free  → static "Current plan" label (no action)
//   - Basic → buy.stripe.com basic launch link
//   - Pro   → buy.stripe.com pro launch link

import { useState } from 'react'

const STRIPE_LINKS: Record<'basic' | 'pro', string> = {
  basic: 'https://buy.stripe.com/fZu8wP24tePZbareNggjC0n',
  pro: 'https://buy.stripe.com/8x214nbF323ddizcF8gjC0o',
}

// Push #033: keep this in lockstep with the matching FREE_FEATURES /
// BASIC_FEATURES / PRO_FEATURES arrays in
// app/(dashboard)/pricing/PricingClient.tsx — the homepage embeds this
// component side-by-side with that page's copy.
const FREE_FEATURES = [
  '2 credits',
  'Try the platform',
  'MP4 ready to post',
  'Community support',
]

const BASIC_FEATURES = [
  '140 credits / month',
  '≈9 videos / month',
  '15 credits per Basic video',
  'Launch offer: 50% off first month',
  'Email support',
]

const PRO_FEATURES = [
  '350 credits / month',
  '≈17 videos / month',
  '20 credits per Pro video',
  'Launch offer: 50% off first month',
  'Better cinematic prompting',
  'Priority support',
]

export default function PricingCards() {
  const [purchasing, setPurchasing] = useState<'basic' | 'pro' | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Push #077 — pricing card selected state. Pro is the recommended
  // default. Card click selects (does NOT trigger Stripe); CTA button
  // click navigates to Stripe.
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro' | null>('pro')

  function handleBuy(tier: 'basic' | 'pro') {
    setError(null)
    setPurchasing(tier)
    // Push #061 — fire-and-forget tracking before redirect. Both the
    // legacy name (kept for /admin/metrics) and the new spec name are
    // emitted so the funnel + metrics dashboards stay in sync.
    try {
      void fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: tier === 'basic' ? 'basic_checkout_clicked' : 'pro_checkout_clicked',
          name: tier === 'basic' ? 'checkout_basic_click' : 'checkout_pro_click',
        }),
        keepalive: true,
      }).catch(() => {})
    } catch {
      // ignore
    }
    // Direct Stripe-hosted launch-offer link — no server round-trip.
    window.location.href = STRIPE_LINKS[tier]
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

      {/* Push #050 — explicit 1-col on mobile, 3-col from md up. The old
          `auto-fit minmax(240px, 1fr)` could leave 2 cards side-by-side on
          narrow tablets and was reported as crammed on iPhone widths in
          some browsers; explicit responsive cols make the breakpoint
          predictable. */}
      <div className="grid mx-auto gap-4 grid-cols-1 md:grid-cols-3" style={{ maxWidth: '64rem' }}>
        <PlanCard
          tier="free"
          name="Free"
          price="$0"
          period="/ month"
          tagline="Try the platform."
          features={FREE_FEATURES}
          cta={null}
        />

        <PlanCard
          tier="basic"
          name="Basic"
          price="$4.50"
          period="first month"
          renewNote="then $9/month"
          tagline="140 credits / month. ≈9 videos."
          features={BASIC_FEATURES}
          badge="Most Popular"
          highlight
          selected={selectedPlan === 'basic'}
          onSelect={() => setSelectedPlan('basic')}
          cta={{
            label:
              purchasing === 'basic'
                ? 'Loading…'
                : selectedPlan === 'basic'
                  ? 'Continue with Basic'
                  : 'Get Basic — $4.50',
            onClick: () => handleBuy('basic'),
            loading: purchasing === 'basic',
          }}
        />

        <PlanCard
          tier="pro"
          name="Pro"
          price="$9.50"
          period="first month"
          renewNote="then $19/month"
          tagline="350 credits / month. ≈17 videos."
          features={PRO_FEATURES}
          badge="Best Value"
          selected={selectedPlan === 'pro'}
          onSelect={() => setSelectedPlan('pro')}
          cta={{
            label:
              purchasing === 'pro'
                ? 'Loading…'
                : selectedPlan === 'pro'
                  ? 'Continue with Pro'
                  : 'Get Pro — $9.50',
            onClick: () => handleBuy('pro'),
            loading: purchasing === 'pro',
          }}
        />
      </div>
    </section>
  )
}

function PlanCard({
  tier,
  name,
  price,
  period,
  renewNote,
  tagline,
  features,
  badge,
  highlight,
  selected,
  onSelect,
  cta,
}: {
  tier: 'free' | 'basic' | 'pro'
  name: string
  price: string
  period: string
  renewNote?: string
  tagline: string
  features: string[]
  badge?: string
  highlight?: boolean
  selected?: boolean
  onSelect?: () => void
  cta: { label: string; onClick: () => void; loading?: boolean } | null
}) {
  const isPaid = tier === 'basic' || tier === 'pro'
  const isSelected = !!selected

  function background(): string {
    if (isSelected) return '#0D1830'
    if (highlight) return 'linear-gradient(135deg, rgba(37,99,235,.10), rgba(29,78,216,.06))'
    return 'rgba(15,15,30,0.85)'
  }
  function border(): string {
    if (isSelected) return '2px solid #3B82F6'
    if (highlight) return '2px solid rgba(37,99,235,.45)'
    return '1px solid var(--border)'
  }
  function shadow(): string {
    if (isSelected) return '0 0 28px rgba(59,130,246,0.3)'
    if (highlight) return '0 0 40px rgba(37,99,235,.18)'
    return '0 0 20px rgba(37,99,235,.04)'
  }

  return (
    <div
      role={isPaid ? 'button' : undefined}
      tabIndex={isPaid ? 0 : undefined}
      aria-pressed={isPaid ? isSelected : undefined}
      onClick={() => {
        if (isPaid && onSelect) onSelect()
      }}
      onKeyDown={(e) => {
        if (!isPaid || !onSelect) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className="rounded-2xl p-6 relative overflow-hidden flex flex-col transition-all duration-200"
      style={{
        background: background(),
        border: border(),
        boxShadow: shadow(),
        cursor: isPaid ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => {
        if (!isPaid || isSelected) return
        e.currentTarget.style.borderColor = '#3B82F6'
        e.currentTarget.style.background = 'rgba(34, 211, 238, 0.06)'
        e.currentTarget.style.boxShadow = '0 0 20px rgba(34,211,238,0.18)'
      }}
      onMouseLeave={(e) => {
        if (!isPaid || isSelected) return
        e.currentTarget.style.background = background()
        e.currentTarget.style.border = border()
        e.currentTarget.style.boxShadow = shadow()
      }}
    >
      {badge && !isSelected && (
        <div
          className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-xs font-black"
          style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', color: '#fff' }}
        >
          {badge}
        </div>
      )}
      {isSelected && (
        <div
          className="absolute top-4 right-4 flex items-center justify-center rounded-full"
          style={{
            width: 26, height: 26,
            background: '#22C55E',
            color: '#FFFFFF',
            boxShadow: '0 4px 14px rgba(34,197,94,.45)',
          }}
          aria-label="Selected"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
          onClick={(e) => {
            e.stopPropagation()
            if (isPaid && onSelect) onSelect()
            cta.onClick()
          }}
          disabled={cta.loading}
          // Push #052 — bump mobile tap-target above the 44px minimum
          // (py-3.5 → ~46px tall) without changing desktop density.
          className="w-full rounded-xl py-3.5 sm:py-3 text-sm font-black text-white"
          style={{
            background: isSelected
              ? '#3B82F6'
              : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            boxShadow: isSelected
              ? '0 4px 22px rgba(59, 130, 246,.35)'
              : '0 4px 18px rgba(37,99,235,.28)',
            border: 'none',
            cursor: cta.loading ? 'wait' : 'pointer',
            opacity: cta.loading ? 0.7 : 1,
          }}
        >
          {cta.label}
        </button>
      ) : (
        <div
          className="w-full text-center rounded-xl py-3.5 sm:py-3 text-sm font-bold"
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
