'use client'

// Push #060 — smart paywall shown right after a successful generation,
// only when the user's remaining credit balance is at or below 30. Two
// Stripe-hosted launch-offer links (same as PricingCards) for Basic and
// Pro. Dismiss link keeps the result page usable for users who don't
// want to upgrade yet.
//
// Push #114 — CTAs now POST to /api/stripe/checkout instead of opening
// the hardcoded buy.stripe.com links. The hosted links were USD-only and
// BR cards were getting rejected ("Seu cartão não aceita essa moeda");
// the server route applies BRL via x-vercel-ip-country (#112).

import { useState } from 'react'
import { PLANS } from '@/lib/pricing'

interface PostVideoPaywallProps {
  // Current credit balance after the most recent generation. The parent
  // gates rendering on credits ≤ 30; we still re-check here as a safety
  // net so the card never shows for healthy balances.
  credits: number
}

// Push #063 — fire-and-forget checkout click tracking so the paywall feeds
// into /admin/funnel. Silently no-ops when public.events isn't present.
function trackCheckoutClick(tier: 'basic' | 'pro'): void {
  try {
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: tier === 'basic' ? 'basic_checkout_clicked' : 'pro_checkout_clicked',
        name: tier === 'basic' ? 'checkout_basic_click' : 'checkout_pro_click',
        path: typeof window !== 'undefined' ? window.location?.pathname : undefined,
      }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // ignore
  }
}

export default function PostVideoPaywall({ credits }: PostVideoPaywallProps) {
  const [dismissed, setDismissed] = useState(false)
  // Push #077 — Pro selected by default. Card click selects, CTA navigates.
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro' | null>('pro')
  // Push #114 — CTAs go through /api/stripe/checkout, so we need a busy
  // flag to disable the buttons + show a "Loading…" label while the
  // session is being created.
  const [purchasing, setPurchasing] = useState<'basic' | 'pro' | null>(null)

  // Push #175 — use direct GET navigation (same fix as PricingCards #173).
  // Avoids iOS Safari gesture-chain break from async fetch/await and
  // removes the broken /generate redirect on already-subscribed.
  function handleBuy(tier: 'basic' | 'pro') {
    setPurchasing(tier)
    trackCheckoutClick(tier)
    // #471 — carry the founding 50%-off promo (same as the wall modal) so the
    // inline post-video paywall converts at the same discount.
    window.location.href = `/api/stripe/checkout?tier=${tier}&promo=FOUNDING50`
  }

  if (dismissed) return null
  if (credits > 30) return null

  return (
    <section
      className="rounded-2xl p-5 sm:p-6 mb-6 relative overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, rgba(16, 185, 129,.10), rgba(5, 150, 105,.06))',
        border: '1px solid rgba(5, 150, 105,.45)',
        boxShadow:
          '0 0 32px rgba(5, 150, 105,.18), inset 0 1px 0 rgba(255,255,255,.04)',
      }}
    >
      <div className="text-center mb-5">
        <div
          className="text-[10px] font-black uppercase tracking-widest mb-1"
          style={{ color: '#22D3EE' }}
        >
          Keep creating
        </div>
        <h3
          className="font-black tracking-tight mb-1"
          style={{ fontSize: '1.25rem', color: 'var(--text)' }}
        >
          Your Short is ready. Unlock your Creator Pack.
        </h3>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          {credits} credit{credits === 1 ? '' : 's'} left.{' '}
          <span style={{ color: '#fbbf24', fontWeight: 800 }}>Founding offer: 50% off your first month</span>
          {' '}· cancel anytime · 7-day money-back.
        </p>
      </div>

      <div
        className="grid gap-3 mb-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
      >
        <PlanCard
          tier="basic"
          name={PLANS.basic.name}
          price={PLANS.basic.priceLabel}
          renew={PLANS.basic.periodLabel}
          features={[
            `${PLANS.basic.credits} Fast Mode videos / month`,
            'Email support',
          ]}
          ctaLabel={
            purchasing === 'basic'
              ? 'Loading…'
              : selectedPlan === 'basic'
                ? 'Continue with Basic →'
                : 'Start Basic →'
          }
          onClick={() => handleBuy('basic')}
          loading={purchasing === 'basic'}
          selected={selectedPlan === 'basic'}
          onSelect={() => setSelectedPlan('basic')}
        />
        <PlanCard
          tier="pro"
          name={PLANS.pro.name}
          price={PLANS.pro.priceLabel}
          renew={PLANS.pro.periodLabel}
          features={[
            `${PLANS.pro.credits} Fast Mode videos / month`,
            '1 Cinematic AI video / month',
            'Download without watermark',
          ]}
          ctaLabel={
            purchasing === 'pro'
              ? 'Loading…'
              : selectedPlan === 'pro'
                ? 'Continue with Pro →'
                : 'Start Pro →'
          }
          onClick={() => handleBuy('pro')}
          loading={purchasing === 'pro'}
          highlight
          selected={selectedPlan === 'pro'}
          onSelect={() => setSelectedPlan('pro')}
        />
      </div>

      <div className="text-center">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs font-bold"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--muted)',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Continue with current plan
        </button>
      </div>
    </section>
  )
}

function PlanCard({
  tier,
  name,
  price,
  renew,
  features,
  ctaLabel,
  highlight,
  onClick,
  loading,
  selected,
  onSelect,
}: {
  tier: 'basic' | 'pro'
  name: string
  price: string
  renew: string
  features: string[]
  ctaLabel: string
  highlight?: boolean
  onClick?: () => void
  loading?: boolean
  selected?: boolean
  onSelect?: () => void
}) {
  const isSelected = !!selected

  function background(): string {
    if (isSelected) return '#0D1830'
    if (highlight) return 'linear-gradient(135deg, rgba(5,150,105,.10), rgba(4,120,87,.06))'
    return 'rgba(11,17,32,0.85)'
  }
  function border(): string {
    if (isSelected) return '2px solid #8B5CF6'
    if (highlight) return '2px solid rgba(5, 150, 105,.55)'
    return '1px solid var(--border)'
  }
  function shadow(): string {
    if (isSelected) return '0 0 28px rgba(139,92,246,0.3)'
    if (highlight) return '0 0 24px rgba(5, 150, 105,.18)'
    return 'none'
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={() => {
        if (onSelect) onSelect()
      }}
      onKeyDown={(e) => {
        if (!onSelect) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className="rounded-xl p-4 flex flex-col relative transition-all duration-200"
      style={{
        background: background(),
        border: border(),
        boxShadow: shadow(),
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        if (isSelected) return
        e.currentTarget.style.borderColor = '#8B5CF6'
        e.currentTarget.style.background = 'rgba(34, 211, 238, 0.06)'
        e.currentTarget.style.boxShadow = '0 0 20px rgba(34,211,238,0.18)'
      }}
      onMouseLeave={(e) => {
        if (isSelected) return
        e.currentTarget.style.background = background()
        e.currentTarget.style.border = border()
        e.currentTarget.style.boxShadow = shadow()
      }}
    >
      {isSelected && (
        <div
          className="absolute top-3 right-3 flex items-center justify-center rounded-full"
          style={{
            width: 22, height: 22,
            background: '#22C55E',
            color: '#FFFFFF',
            boxShadow: '0 4px 14px rgba(34,197,94,.45)',
          }}
          aria-label="Selected"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      <div
        className="text-xs font-black uppercase tracking-widest mb-1"
        style={{ color: highlight ? '#22D3EE' : 'var(--muted)' }}
      >
        {name}
      </div>
      <div
        className="font-black"
        style={{ fontSize: '1.1rem', color: 'var(--text)', lineHeight: 1.15 }}
      >
        {price}
      </div>
      <p className="text-[11px] mt-0.5 mb-3" style={{ color: '#c4b5fd', fontWeight: 700 }}>
        {renew}
      </p>
      <ul className="flex flex-col gap-1.5 mb-4 flex-1">
        {features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-xs"
            style={{ color: 'var(--text2)' }}
          >
            <span style={{ color: '#a78bfa', marginTop: 1 }}>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={!!loading}
        onClick={(e) => {
          e.stopPropagation()
          if (onSelect) onSelect()
          if (onClick) onClick()
        }}
        className="rounded-xl py-2.5 text-sm font-black text-center text-white"
        style={{
          background: isSelected ? '#8B5CF6' : 'linear-gradient(135deg, #7C3AED, #7C3AED)',
          boxShadow: isSelected
            ? '0 4px 22px rgba(16, 185, 129,.35)'
            : '0 6px 22px rgba(5, 150, 105,.32)',
          border: 'none',
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {ctaLabel}
      </button>
    </div>
  )
}
