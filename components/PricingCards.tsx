'use client'

// Push #036 — 3-card pricing grid (Free / Basic / Pro) for embedding on
// Step 1 of /generate. Visual style matches /pricing exactly so the user
// sees the same brand. The /pricing route still owns the canonical billing
// experience (current credits, FAQ, billing portal) — this is just the
// in-flow nudge below the prompt textarea.
//
// Push #114 — CTAs now POST to /api/stripe/checkout instead of redirecting
// to hardcoded buy.stripe.com payment links. The hosted links were USD-
// only and Brazilian cards were getting rejected with "Seu cartão não
// aceita essa moeda". Going through the API lets the server pick BRL via
// x-vercel-ip-country (Push #112) and attach boleto for BR cohorts. The
// component is only rendered for signed-in users (inside /generate), so a
// 401 just means the session expired — we fall back to /login.

import { useState } from 'react'
import { PLANS } from '@/lib/pricing'

// Push #078 — feature copy now derives from lib/pricing.ts so credit
// counts can't drift between the homepage, /pricing, and this in-flow
// upgrade card.
const FREE_FEATURES = [
  `${PLANS.free.credits} Fast Mode videos`,
  'Pexels footage + AI voiceover',
  'Watermark-free MP4',
  'Try the platform',
]

const BASIC_FEATURES = [
  `${PLANS.basic.credits} Fast Mode videos/month`,
  'Pexels footage + AI voiceover',
  'Voiceover + captions',
  'Download MP4',
  'My Videos history',
]

const PRO_FEATURES = [
  `${PLANS.pro.credits} Fast Mode videos/month`,
  '1 Cinematic (Runway AI) video/month',
  'Better generation settings',
  'Voiceover + captions',
  'Download MP4',
  'My Videos history',
]

export default function PricingCards() {
  const [purchasing, setPurchasing] = useState<'basic' | 'pro' | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Push #077 — pricing card selected state. Pro is the recommended
  // default. Card click selects (does NOT trigger Stripe); CTA button
  // click navigates to Stripe.
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro' | null>('pro')

  async function handleBuy(tier: 'basic' | 'pro') {
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

    // Push #114 — server-side checkout so x-vercel-ip-country can route
    // BR users into BRL pricing.
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      const data = await res.json().catch(() => ({}))
      // Session timed out / not signed in — bounce through /login and
      // come back to /generate (this card lives on /generate).
      if (res.status === 401) {
        window.location.href = `/login?redirect=${encodeURIComponent('/generate')}`
        return
      }
      // Already subscribed — skip the error toast and just take the user
      // back to the generator where their plan is already active.
      if (res.status === 400 && typeof data?.error === 'string' && data.error.toLowerCase().includes('already have an active subscription')) {
        window.location.href = '/generate'
        return
      }
      if (!res.ok || !data?.url) {
        setError(data?.error ?? 'Could not start checkout. Please try again.')
        setPurchasing(null)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Could not start checkout. Please try again.')
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

      {/* Push #050 — explicit 1-col on mobile, 3-col from md up. The old
          `auto-fit minmax(240px, 1fr)` could leave 2 cards side-by-side on
          narrow tablets and was reported as crammed on iPhone widths in
          some browsers; explicit responsive cols make the breakpoint
          predictable. */}
      <div className="grid mx-auto gap-4 grid-cols-1 md:grid-cols-3" style={{ maxWidth: '64rem' }}>
        <PlanCard
          tier="free"
          name={PLANS.free.name}
          price={PLANS.free.priceLabel}
          period="/ month"
          tagline="Try the platform."
          features={FREE_FEATURES}
          cta={null}
        />

        <PlanCard
          tier="basic"
          name={PLANS.basic.name}
          price={PLANS.basic.priceLabel}
          period="first month"
          renewNote={`then ${PLANS.basic.regularPrice}`}
          tagline={`${PLANS.basic.credits} Fast Mode videos/month.`}
          features={BASIC_FEATURES}
          selected={selectedPlan === 'basic'}
          onSelect={() => setSelectedPlan('basic')}
          cta={{
            label:
              purchasing === 'basic'
                ? 'Loading…'
                : selectedPlan === 'basic'
                  ? 'Continue with Basic'
                  : PLANS.basic.cta,
            onClick: () => handleBuy('basic'),
            loading: purchasing === 'basic',
          }}
        />

        <PlanCard
          tier="pro"
          name={PLANS.pro.name}
          price={PLANS.pro.priceLabel}
          period="first month"
          renewNote={`then ${PLANS.pro.regularPrice}`}
          tagline={`${PLANS.pro.credits} Fast Mode + 1 Cinematic/month.`}
          features={PRO_FEATURES}
          badge="Recommended"
          highlight
          selected={selectedPlan === 'pro'}
          onSelect={() => setSelectedPlan('pro')}
          cta={{
            label:
              purchasing === 'pro'
                ? 'Loading…'
                : selectedPlan === 'pro'
                  ? 'Continue with Pro'
                  : PLANS.pro.cta,
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
