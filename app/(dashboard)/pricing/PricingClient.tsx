'use client'

// Push #078 — full /pricing redesign. Now reads from lib/pricing.ts so
// numbers and Stripe links cannot drift from the homepage / paywall.
// Three-card layout (Free / Basic / Pro), Pro selected by default with
// the "Recommended" badge, selection swaps the CTA to "Continue with X".

import { useEffect, useState } from 'react'
import { PLANS, PLAN_LIST, type PlanTier } from '@/lib/pricing'

interface PricingClientProps {
  isPro: boolean
  generationsUsed: number
  hasStripeCustomer: boolean
  userId: string
}

const FREE_FEATURES = [
  `${PLANS.free.credits} credits`,
  'Analyze ideas before rendering',
  'Try AI video generation',
  'Credits charged only on successful video',
]

const BASIC_FEATURES = [
  `${PLANS.basic.credits} credits/month`,
  `≈9 Basic videos/month (${PLANS.basic.videoCredits} credits each)`,
  'Voiceover + captions',
  'Download MP4',
  'My Videos history',
]

const PRO_FEATURES = [
  `${PLANS.pro.credits} credits/month`,
  `≈17 Pro videos/month (${PLANS.pro.videoCredits} credits each)`,
  'Better generation settings',
  'Voiceover + captions',
  'Download MP4',
  'My Videos history',
]

function featuresFor(tier: PlanTier): string[] {
  if (tier === 'free') return FREE_FEATURES
  if (tier === 'basic') return BASIC_FEATURES
  return PRO_FEATURES
}

const FAQS = [
  {
    q: 'How do credits work?',
    a: `Each Short uses credits based on the quality mode you pick: Basic = ${PLANS.basic.videoCredits} credits, Pro = ${PLANS.pro.videoCredits} credits. Failed generations do not consume credits. Credits reset every month based on your plan.`,
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
  const [purchasing, setPurchasing] = useState<PlanTier | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  // Pro is selected by default — matches homepage Recommended cue.
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro' | null>('pro')

  useEffect(() => {
    try {
      void fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'pricing_view' }),
        keepalive: true,
      }).catch(() => {})
    } catch {
      // ignore
    }
  }, [])

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

  function handleBuy(tier: 'basic' | 'pro') {
    if (!userId) {
      window.location.href = '/login?redirect=/pricing'
      return
    }
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
    setPurchasing(tier)
    window.location.href = PLANS[tier].href
  }

  function handleFreeCta() {
    if (userId) {
      showToast('You already have access — start creating!')
      return
    }
    window.location.href = PLANS.free.href
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
          <div className="font-black uppercase tracking-widest mb-2" style={{ fontSize: '0.62rem', color: '#22D3EE' }}>
            Pricing
          </div>
          <h1 className="font-black tracking-tight mb-3" style={{ fontSize: '2rem', color: 'var(--text)' }}>
            Choose a plan
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--muted)', maxWidth: 560, margin: '0 auto' }}>
            Start creating AI Shorts with credits. Upgrade when you need more videos.
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
            Basic = {PLANS.basic.videoCredits}cr · Pro = {PLANS.pro.videoCredits}cr per video · charged only on successful videos
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

      {/* 3 plans — driven by PLAN_LIST so copy can't drift from the homepage. */}
      <div
        className="grid mx-auto gap-5 grid-cols-1 md:grid-cols-3"
        style={{ maxWidth: '64rem' }}
      >
        {PLAN_LIST.map((plan) => {
          const isPaid = plan.tier === 'basic' || plan.tier === 'pro'
          const isSelected = isPaid && selectedPlan === plan.tier
          const isRecommended = !!plan.recommended
          const period = plan.tier === 'free' ? '/ month' : 'first month'
          const renewNote = plan.regularPrice ? `then ${plan.regularPrice}` : undefined

          let cta:
            | { label: string; onClick: () => void; loading?: boolean }
            | null = null
          if (plan.tier === 'free') {
            cta = userId
              ? null
              : { label: 'Start Free', onClick: handleFreeCta }
          } else if (plan.tier === 'basic') {
            cta = {
              label:
                purchasing === 'basic'
                  ? 'Loading...'
                  : selectedPlan === 'basic'
                    ? 'Continue with Basic'
                    : plan.cta,
              onClick: () => handleBuy('basic'),
              loading: purchasing === 'basic',
            }
          } else {
            cta = {
              label:
                purchasing === 'pro'
                  ? 'Loading...'
                  : selectedPlan === 'pro'
                    ? 'Continue with Pro'
                    : plan.cta,
              onClick: () => handleBuy('pro'),
              loading: purchasing === 'pro',
            }
          }

          return (
            <PlanCard
              key={plan.tier}
              tier={plan.tier}
              name={plan.name}
              price={plan.priceLabel}
              period={period}
              renewNote={renewNote}
              features={featuresFor(plan.tier)}
              badge={isRecommended ? { label: 'Recommended', color: '#3B82F6' } : undefined}
              highlight={isRecommended}
              selected={isSelected}
              onSelect={isPaid ? () => setSelectedPlan(plan.tier as 'basic' | 'pro') : undefined}
              cta={cta}
            />
          )
        })}
      </div>

      <p className="max-w-3xl mx-auto text-center text-xs mt-6" style={{ color: 'var(--muted)' }}>
        50% off applies to the first month only. Plans renew at the regular monthly price.
      </p>
      <p className="max-w-3xl mx-auto text-center text-xs mt-2" style={{ color: 'var(--muted)' }}>
        Credits are charged only when your final video is successfully generated.
      </p>

      {/* How credits work */}
      <div className="max-w-3xl mx-auto mt-12">
        <h2 className="font-black text-center mb-5 tracking-tight" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>
          How credits work
        </h2>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <CreditTier name="Basic" cost={`${PLANS.basic.videoCredits} credits`} desc="Standard video generation for short-form creators." />
          <CreditTier name="Pro" cost={`${PLANS.pro.videoCredits} credits`} desc="Better cinematic prompting and higher-quality generation settings." />
        </div>
        <ul
          className="mt-5 text-xs space-y-2"
          style={{ color: 'var(--muted2)', paddingLeft: 20 }}
        >
          <li>Basic video = <strong style={{ color: 'var(--text)' }}>{PLANS.basic.videoCredits} credits</strong></li>
          <li>Pro video = <strong style={{ color: 'var(--text)' }}>{PLANS.pro.videoCredits} credits</strong></li>
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
  tier,
  name,
  price,
  period,
  renewNote,
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
  features: string[]
  badge?: { label: string; color: string }
  highlight?: boolean
  selected?: boolean
  onSelect?: () => void
  cta: { label: string; onClick: () => void; loading?: boolean } | null
}) {
  const isPaid = tier === 'basic' || tier === 'pro'
  const isSelected = !!selected

  function background(): string {
    if (isSelected) return '#0D1830'
    if (highlight) return 'linear-gradient(135deg, rgba(59, 130, 246,.10), rgba(96, 165, 250,.05))'
    return 'rgba(15,15,30,0.85)'
  }
  function border(): string {
    if (isSelected) return '2px solid #3B82F6'
    if (highlight) return '2px solid rgba(59, 130, 246,.55)'
    return '1px solid var(--border2)'
  }
  function shadow(): string {
    if (isSelected) return '0 0 28px rgba(59,130,246,0.3)'
    if (highlight) return '0 0 60px rgba(59, 130, 246,.18)'
    return '0 0 30px rgba(59, 130, 246,.06)'
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
      className="rounded-[20px] p-7 relative overflow-hidden transition-all duration-200 flex flex-col"
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
          style={{ background: badge.color, color: '#FFFFFF' }}
        >
          {badge.label}
        </div>
      )}
      {isSelected && (
        <div
          className="absolute top-4 right-4 flex items-center justify-center rounded-full"
          style={{
            width: 28, height: 28,
            background: '#22C55E',
            color: '#FFFFFF',
            boxShadow: '0 4px 14px rgba(34,197,94,.45)',
          }}
          aria-label="Selected"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      <div className="mb-5">
        <div
          className="text-xs font-black uppercase tracking-widest mb-2"
          style={{ color: highlight ? '#22D3EE' : 'var(--muted)' }}
        >
          {name}
        </div>
        <div className="flex items-end gap-1 mb-1">
          <span className="font-black" style={{ fontSize: '2.5rem', color: 'var(--text)', lineHeight: 1 }}>{price}</span>
          <span className="text-sm pb-1" style={{ color: 'var(--muted)' }}>{period}</span>
        </div>
        {renewNote && (
          <p className="text-xs mb-1" style={{ color: '#22D3EE', fontWeight: 700 }}>{renewNote}</p>
        )}
      </div>

      <div className="flex flex-col gap-2.5 mb-7 flex-1">
        {features.map((f) => (
          <div key={f} className="flex items-start gap-2.5 text-sm">
            <span style={{ color: '#22D3EE', fontSize: '0.8rem', marginTop: 2 }}>✓</span>
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
          className="w-full rounded-xl py-3.5 text-sm font-black transition-all"
          style={{
            background: highlight || isSelected
              ? '#3B82F6'
              : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            boxShadow: highlight || isSelected
              ? '0 4px 22px rgba(59, 130, 246,.35)'
              : '0 4px 22px rgba(37,99,235,.32)',
            border: 'none',
            color: '#FFFFFF',
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
      <div className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: '#22D3EE' }}>
        {name}
      </div>
      <div className="font-black text-lg mb-1" style={{ color: 'var(--text)' }}>{cost}</div>
      <div className="text-xs" style={{ color: 'var(--muted)' }}>{desc}</div>
    </div>
  )
}
