'use client'

// Push #060 — smart paywall shown right after a successful generation,
// only when the user's remaining credit balance is at or below 30. Two
// Stripe-hosted launch-offer links (same as PricingCards) for Basic and
// Pro. Dismiss link keeps the result page usable for users who don't
// want to upgrade yet.

import { useState } from 'react'

interface PostVideoPaywallProps {
  // Current credit balance after the most recent generation. The parent
  // gates rendering on credits ≤ 30; we still re-check here as a safety
  // net so the card never shows for healthy balances.
  credits: number
}

const STRIPE_LINKS = {
  basic: 'https://buy.stripe.com/fZu8wP24tePZbareNggjC0n',
  pro: 'https://buy.stripe.com/8x214nbF323ddizcF8gjC0o',
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
          name="Basic"
          price="$4.50 first month"
          renew="then $9/month"
          features={['140 credits / month', '15 credits per Basic video']}
          href={STRIPE_LINKS.basic}
          ctaLabel="Start Basic →"
          onClick={() => trackCheckoutClick('basic')}
        />
        <PlanCard
          name="Pro"
          price="$9.50 first month"
          renew="then $19/month"
          features={['350 credits / month', '20 credits per Pro video']}
          href={STRIPE_LINKS.pro}
          ctaLabel="Start Pro →"
          onClick={() => trackCheckoutClick('pro')}
          highlight
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
  name,
  price,
  renew,
  features,
  href,
  ctaLabel,
  highlight,
  onClick,
}: {
  name: string
  price: string
  renew: string
  features: string[]
  href: string
  ctaLabel: string
  highlight?: boolean
  onClick?: () => void
}) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col"
      style={{
        background: highlight
          ? 'linear-gradient(135deg, rgba(37,99,235,.10), rgba(29,78,216,.06))'
          : 'rgba(15,15,30,0.85)',
        border: highlight
          ? '2px solid rgba(37, 99, 235,.55)'
          : '1px solid var(--border)',
        boxShadow: highlight ? '0 0 24px rgba(37, 99, 235,.18)' : 'none',
      }}
    >
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
        onClick={onClick}
        className="rounded-xl py-2.5 text-sm font-black text-center text-white"
        style={{
          background: 'linear-gradient(135deg, #2563EB, #2563EB)',
          boxShadow: '0 6px 22px rgba(37, 99, 235,.32)',
          textDecoration: 'none',
        }}
      >
        {ctaLabel}
      </a>
    </div>
  )
}
