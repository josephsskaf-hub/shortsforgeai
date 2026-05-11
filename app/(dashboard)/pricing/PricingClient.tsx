'use client'

import { useEffect, useState } from 'react'

interface PricingClientProps {
  isPro: boolean
  generationsUsed: number
  hasStripeCustomer: boolean
  userId: string
}

// Stripe Payment Links (one-time credit packs).
// Override at build time with NEXT_PUBLIC_STRIPE_STARTER_URL / NEXT_PUBLIC_STRIPE_PRO_URL.
const CREATOR_URL =
  process.env.NEXT_PUBLIC_STRIPE_STARTER_URL ||
  'https://buy.stripe.com/eVqdR95gFdLV4M3cF8gjC0l'
const PRO_URL =
  process.env.NEXT_PUBLIC_STRIPE_PRO_URL ||
  'https://buy.stripe.com/28E6oH7oNePZ92j20ugjC0m'

const FREE_FEATURES = [
  '2 credits',
  'Basic generation only',
  'MP4 ready to post',
  'Community support',
]

const CREATOR_FEATURES = [
  '300 credits / month',
  'Up to 300 Basic / 150 Pro / 75 Ultra generations',
  'Priority render queue',
  'Email support',
]

const PRO_FEATURES = [
  '900 credits / month',
  'Up to 900 Basic / 450 Pro / 225 Ultra generations',
  'Pro AI models (Veo / Sora-class)',
  'Top priority render queue',
  'Early access to new niches',
  'Priority support',
]

const FAQS = [
  {
    q: 'How do credits work?',
    a: 'Each Short uses credits based on the quality mode you pick: Basic = 1 credit, Pro = 2 credits, Ultra = 4 credits.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'Yes. You can upgrade at any time. Manage billing from the portal once subscribed.',
  },
  {
    q: 'Is this a subscription?',
    a: 'Creator and Pro are monthly plans. Cancel anytime.',
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

  function handleBuy(pack: 'creator' | 'pro') {
    if (!userId) {
      window.location.href = '/login?redirect=/pricing'
      return
    }
    setPurchasing(pack)
    const base = pack === 'creator' ? CREATOR_URL : PRO_URL
    const url = `${base}${base.includes('?') ? '&' : '?'}client_reference_id=${encodeURIComponent(userId)}`
    window.location.href = url
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
              Pay for what you use.
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
            Basic = 1cr · Pro = 2cr · Ultra = 4cr
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
            ⚙️ Billing
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
          tagline="2 credits to try it out."
          features={FREE_FEATURES}
          cta={null}
        />

        {/* Creator — Most Popular */}
        <PlanCard
          name="Creator"
          price="$9"
          period="/ month"
          tagline="300 credits / month."
          features={CREATOR_FEATURES}
          badge={{ label: 'Most Popular', color: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}
          highlight
          cta={{
            label: purchasing === 'creator' ? 'Loading…' : 'Get Creator — $9/mo',
            onClick: () => handleBuy('creator'),
            loading: purchasing === 'creator',
          }}
        />

        {/* Pro — Best Value */}
        <PlanCard
          name="Pro"
          price="$19"
          period="/ month"
          tagline="900 credits / month."
          features={PRO_FEATURES}
          badge={{ label: 'Best Value', color: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}
          cta={{
            label: purchasing === 'pro' ? 'Loading…' : 'Get Pro — $19/mo',
            onClick: () => handleBuy('pro'),
            loading: purchasing === 'pro',
          }}
        />
      </div>

      <p className="max-w-3xl mx-auto text-center text-xs mt-4" style={{ color: 'var(--muted)' }}>
        Cancel anytime. Refund within 7 days if unused.
      </p>

      {/* How credits work */}
      <div className="max-w-3xl mx-auto mt-12">
        <h2 className="font-black text-center mb-5 tracking-tight" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>
          How credits work
        </h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <CreditTier name="Basic" cost="1 credit" desc="Fast and efficient for simple Shorts." />
          <CreditTier name="Pro" cost="2 credits" desc="Better hooks, better structure, stronger viral script." />
          <CreditTier name="Ultra" cost="4 credits" desc="Best quality for premium Shorts, deeper storytelling and stronger retention." />
        </div>
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
  tagline,
  features,
  badge,
  highlight,
  cta,
}: {
  name: string
  price: string
  period: string
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
  