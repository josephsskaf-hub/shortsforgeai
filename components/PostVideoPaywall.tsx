'use client'

// Push #060 — smart paywall shown right after a successful generation,
// only when the user's remaining credit balance is at or below 30. Two
// Stripe-hosted launch-offer links (same as PricingCards) for Basic and
// Pro. Dismiss link keeps the result page usable for users who don't
// want to upgrade yet.

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
  if (dismissed) return null
  if (credits > 30) return null

  return (
    <section
      className="rounded-2xl p-5 sm:p-6 mb-6 relative overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, rgba(59, 130, 246,.10), rgba(37, 99, 235,.06))',
        border: '1px solid rgba(37, 99, 235,.45)',
        boxShadow:
          '0 0 32px rgba(37, 99, 235,.18), inset 0 1px 0 rgba(255,255,255,.04)',
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
          Your AI Short is ready. Want to create more?
        </h3>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          {credits} credit{credits === 1 ? '' : 's'} left — pick a plan to keep generating.
        </p>
      </div>

      <div
        className="grid gap-3 mb-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
      >
        <PlanCard
          tier="basic"
          name={PLANS.basic.name}
          price={`${PLANS.basic.priceLabel} first month`}
          renew={`then ${PLANS.basic.regularPrice}`}
          features={[
            `${PLANS.basic.credits} credits/month`,
            `${PLANS.basic.videoCredits} credits per Basic video`,
          ]}
          href={PLANS.basic.href}
          ctaLabel={selectedPlan === 'basic' ? 'Continue with Basic →' : 'Start Basic →'}
          onClick={() => trackCheckoutClick('basic')}
          selected={selectedPlan === 'basic'}
          onSelect={() => setSelectedPlan('basic')}
        />
        <PlanCard
          tier="pro"
          name={PLANS.pro.name}
          price={`${PLANS.pro.priceLabel} first month`}
          renew={`then ${PLANS.pro.regularPrice}`}
          features={[
            `${PLANS.pro.credits} credits/month`,
            `${PLANS.pro.videoCredits} credits per Pro video`,
          ]}
          href={PLANS.pro.href}
          ctaLabel={selectedPlan === 'pro' ? 'Continue with Pro →' : 'Start Pro →'}
          onClick={() => trackCheckoutClick('pro')}
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
  href,
  ctaLabel,
  highlight,
  onClick,
  selected,
  onSelect,
}: {
  tier: 'basic' | 'pro'
  name: string
  price: string
  renew: string
  features: string[]
  href: string
  ctaLabel: string
  highlight?: boolean
  onClick?: () => void
  selected?: boolean
  onSelect?: () => void
}) {
  const isSelected = !!selected

  function background(): string {
    if (isSelected) return '#0D1830'
    if (highlight) return 'linear-gradient(135deg, rgba(37,99,235,.10), rgba(29,78,216,.06))'
    return 'rgba(15,15,30,0.85)'
  }
  function border(): string {
    if (isSelected) return '2px solid #3B82F6'
    if (highlight) return '2px solid rgba(37, 99, 235,.55)'
    return '1px solid var(--border)'
  }
  function shadow(): string {
    if (isSelected) return '0 0 28px rgba(59,130,246,0.3)'
    if (highlight) return '0 0 24px rgba(37, 99, 235,.18)'
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
        e.currentTarget.style.borderColor = '#3B82F6'
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
      <p className="text-[11px] mt-0.5 mb-3" style={{ color: '#93c5fd', fontWeight: 700 }}>
        {renew}
      </p>
      <ul className="flex flex-col gap-1.5 mb-4 flex-1">
        {features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-xs"
            style={{ color: 'var(--text2)' }}
          >
            <span style={{ color: '#34d399', marginTop: 1 }}>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.stopPropagation()
          if (onSelect) onSelect()
          if (onClick) onClick()
        }}
        className="rounded-xl py-2.5 text-sm font-black text-center text-white"
        style={{
          background: isSelected ? '#3B82F6' : 'linear-gradient(135deg, #2563EB, #2563EB)',
          boxShadow: isSelected
            ? '0 4px 22px rgba(59, 130, 246,.35)'
            : '0 6px 22px rgba(37, 99, 235,.32)',
          textDecoration: 'none',
        }}
      >
        {ctaLabel}
      </a>
    </div>
  )
}
