'use client'

import { useEffect, useState } from 'react'

interface PricingClientProps {
  isPro: boolean
  generationsUsed: number
  hasStripeCustomer: boolean
  userId: string
}

// Push #046: Basic / Pro CTAs redirect straight to Stripe-hosted
// launch-offer payment links (the links themselves carry the price ID).
// /api/stripe/checkout is still in the tree but no longer called from
// this page or from components/PricingCards.tsx — keep both maps in sync.
const STRIPE_LINKS: Record<'basic' | 'pro', string> = {
  basic: 'https://buy.stripe.com/fZu8wP24tePZbareNggjC0n',
  pro: 'https://buy.stripe.com/8x214nbF323ddizcF8gjC0o',
}

// Push #033: feature copy aligned with the unified video-first model.
// One credit cost per video (15 Basic / 20 Pro), no per-Short / per-script
// split, no Ultra or Creator tiers. Numbers and CTA copy must stay in
// lockstep with components/PricingCards.tsx — the homepage embeds that
// component side-by-side with this page's text.
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

const FAQS = [
  {
    q: 'How do credits work?',
    a: 'Each Short uses credits based on the quality mode you pick: Basic = 15 credits, Pro = 20 credits. Failed generations do not consume credits. Credits reset every month based on your plan.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'Yes. You can upgrade at any time. Manage billing from the portal once subscribed.',
  },
  {
    q: 'How does the launch offer work?',
    a: '50% off applies to the first month only. Plans renew at the regular monthly price ($9 Basic, $19 Pro).',
  },
  {
    q: 'Can I get a refund?',
    a: 'Yes, within 7 days of purchase if no credits have been used. Email josephsskaf@gmail.com.',
  },
]

export default function PricingClient(props: PricingClientProps) {
  const { isPro, userId } = props
  const [credits, setCredits] = useState<number | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    if (!userId) { setCredits(null); setCreditsLoading(false); return }
    let cancelled = false
    fetch('/api/credits', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setCredits(typeof data.credits === 'number' ? data.credits : 0)
        }
      })
      .catch(() => {
        if (!cancelled) setCredits(0)
      })
      .finally(() => {
        if (!cancelled) setCreditsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }

  // Push #046 — go straight to the Stripe-hosted launch-offer payment
  // link rather than calling /api/stripe/checkout. The link encodes the
  // price; Stripe handles the rest. Keep the unauthenticated bounce so
  // returning customers always have a session attached before payment.
  function handleBuy(tier: 'basic' | 'pro') {
    if (!userId) {
      window.location.href = '/login?redirect=/pricing'
      return
    }
    setPurchasing(tier)
    window.location.href = STRIPE_LINKS[tier]
  }

  async function handlePortal() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data?.url) window.location.href = data.url
    } catch {
      // ignore
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <div
      className="px-4 md:px-6 py-7 pb-20 mx-auto"
      style={{ width: '100%', maxWidth: 'min(72rem, 100%)', boxSizing: 'border-box' }}
    >
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 px-5 py-3 rounded-xl text-sm font-bold text-white"
          style={{
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            boxShadow: '0 4px 24px rgba(37,99,235,.4)',
          }}
        >
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-8 text-center relative">
        <div
          className="absolute pointer-events-none"
          style={{
            width: 700, height: 400,
            background: 'radial-gradient(ellipse at 50% 50%, rgba(37,99,235,.12) 0%, transparent 70%)',
            top: -100, left: '50%', transform: 'translateX(-50%)',
          }}
        />
        <div className="relative z-10">
          <div className="font-black uppercase tracking-widest mb-2" style={{ fontSize: '0.62rem', color: '#93C5FD' }}>
            Pricing
          </div>
          <h1 className="font-black tracking-tight mb-2" style={{ fontSize: '1.9rem', color: 'var(--text)' }}>
            Choose your plan.{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #60A5FA, #3B82F6, #2563EB)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Launch offer — 50% off.
            </span>
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', maxWidth: 520, margin: '0 auto' }}>
            Free to start. Upgrade when you&apos;re ready to scale.
          </p>
        </div>
      </div>

      {/* Current credits */}
      <div
        className="max-w-lg mx-auto mb-8 flex items-center gap-4 rounded-xl px-5 py-4"
        style={{
          background: 'rgba(37,99,235,.06)',
          border: '1px solid rgba(37,99,235,.18)',
        }}
      >
        <div className="text-2xl">⚡</div>
        <div className="flex-1">
          <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
            {!userId ? 'Sign in to see your balance' : creditsLoading ? 'Loading balance...' : `You have ${credits ?? 0} credit${credits === 1 ? '' : 's'}`}
          </p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Basic = 15cr · Pro = 20cr per Short
          </p>
        </div>
        {isPro && (
          <button
            onClick={handlePortal}
            disabled={portalLoading}
            className="rounded-lg px-3 py-2 text-xs font-bold"
            style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid var(--border2)',
              color: 'var(--muted2)',
              cursor: portalLoading ? 'not-allowed' : 'pointer',
              opacity: portalLoading ? 0.6 : 1,
            }}
          >
            Billing
          </button>
        )}
      </div>

      {/* 3 plans */}
      <div
        className="grid mx-auto gap-5"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', maxWidth: '64rem' }}
      >
        {/* Free */}
        <PlanCard
          name="Free"
          price="$0"
          period="/ month"
          tagline="Try the platform."
          features={FREE_FEATURES}
          cta={null}
        />

        {/* Basic - Most Popular */}
        <PlanCard
          name="Basic"
          price="$4.50"
          period="first month"
          renewNote="then $9/month"
          tagline="140 credits / month. ≈9 videos."
          features={BASIC_FEATURES}
          badge={{ label: 'Most Popular', color: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}
          highlight
          cta={{
            label: purchasing === 'basic' ? 'Loading...' : 'Get Basic — $4.50',
            onClick: () => handleBuy('basic'),
            loading: purchasing === 'basic',
          }}
        />

        {/* Pro - Best Value */}
        <PlanCard
          name="Pro"
          price="$9.50"
          period="first month"
          renewNote="then $19/month"
          tagline="350 credits / month. ≈17 videos."
          features={PRO_FEATURES}
          badge={{ label: 'Best Value', color: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}
          cta={{
            label: purchasing === 'pro' ? 'Loading...' : 'Get Pro — $9.50',
            onClick: () => handleBuy('pro'),
            loading: purchasing === 'pro',
          }}
        />
      </div>

      <p className="max-w-3xl mx-auto text-center text-xs mt-4" style={{ color: 'var(--muted)' }}>
        50% off applies to the first month only. Plans renew at the regular monthly price.
        Failed generations do not consume credits. Refund within 7 days if unused.
      </p>

      {/* How credits work */}
      <div className="max-w-3xl mx-auto mt-12">
        <h2 className="font-black text-center mb-5 tracking-tight" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>
          How credits work
        </h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <CreditTier name="Basic" cost="15 credits" desc="Standard video generation for short-form creators." />
          <CreditTier name="Pro" cost="20 credits" desc="Better cinematic prompting and higher-quality generation settings." />
        </div>
        <ul
          className="mt-5 text-xs space-y-2"
          style={{ color: 'var(--muted2)', paddingLeft: 20 }}
        >
          <li>Basic video = <strong style={{ color: 'var(--text)' }}>15 credits</strong></li>
          <li>Pro video = <strong style={{ color: 'var(--text)' }}>20 credits</strong></li>
          <li>Failed generations do not consume credits</li>
          <li>Credits reset every month based on your plan</li>
        </ul>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto mt-12">
        <h2 className="font-black text-center mb-6 tracking-tight" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>
          Frequently Asked Questions
        </h2>
        <div className="flex flex-col gap-3">
          {FAQS.map((faq) => (
            <div
              key={faq.q}
              className="rounded-xl px-5 py-4"
              style={{
                background: 'rgba(15,15,30,0.85)',
                border: '1px solid var(--border)',
              }}
            >
              <p className="font-bold text-sm mb-1.5" style={{ color: 'var(--text)' }}>{faq.q}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
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
  badge?: { label: string; color: string }
  highlight?: boolean
  cta: { label: string; onClick: () => void; loading?: boolean } | null
}) {
  return (
    <div
      className="rounded-[20px] p-7 relative overflow-hidden transition-all flex flex-col"
      style={{
        background: highlight
          ? 'linear-gradient(135deg, rgba(37,99,235,.10), rgba(29,78,216,.06))'
          : 'rgba(15,15,30,0.85)',
        border: highlight ? '2px solid rgba(37,99,235,.45)' : '1px solid var(--border2)',
        boxShadow: highlight ? '0 0 60px rgba(37,99,235,.2)' : '0 0 30px rgba(37,99,235,.06)',
      }}
    >
      {badge && (
        <div
          className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-xs font-black"
          style={{ background: badge.color, color: 'white' }}
        >
          {badge.label}
        </div>
      )}

      <div className="mb-5">
        <div
          className="text-xs font-black uppercase tracking-widest mb-2"
          style={{ color: highlight ? '#93C5FD' : 'var(--muted)' }}
        >
          {name}
        </div>
        <div className="flex items-end gap-1 mb-1">
          <span className="font-black" style={{ fontSize: '2.5rem', color: 'var(--text)', lineHeight: 1 }}>{price}</span>
          <span className="text-sm pb-1" style={{ color: 'var(--muted)' }}>{period}</span>
        </div>
        {renewNote && (
          <p className="text-xs mb-1" style={{ color: '#93C5FD', fontWeight: 700 }}>{renewNote}</p>
        )}
        <p className="text-xs" style={{ color: 'var(--muted)' }}>{tagline}</p>
      </div>

      <div className="flex flex-col gap-2.5 mb-7 flex-1">
        {features.map((f) => (
          <div key={f} className="flex items-start gap-2.5 text-sm">
            <span style={{ color: '#34d399', fontSize: '0.8rem', marginTop: 2 }}>✓</span>
            <span style={{ color: 'var(--text2)' }}>{f}</span>
          </div>
        ))}
      </div>

      {cta ? (
        <button
          onClick={cta.onClick}
          disabled={cta.loading}
          className="w-full rounded-xl py-3.5 text-sm font-black text-white transition-all"
          style={{
            background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            boxShadow: '0 4px 22px rgba(37,99,235,.32)',
            border: 'none',
            cursor: cta.loading ? 'wait' : 'pointer',
            opacity: cta.loading ? 0.7 : 1,
          }}
        >
          {cta.label}
        </button>
      ) : (
        <div
          className="w-full text-center rounded-xl py-3.5 text-sm font-bold"
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

function CreditTier({ name, cost, desc }: { name: string; cost: string; desc: string }) {
  return (
    <div
      className="rounded-xl p-4 text-center"
      style={{
        background: 'rgba(15,15,30,0.7)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: '#93C5FD' }}>
        {name}
      </div>
      <div className="font-black text-lg mb-1" style={{ color: 'var(--text)' }}>{cost}</div>
      <div className="text-xs" style={{ color: 'var(--muted)' }}>{desc}</div>
    </div>
  )
}
