'use client'

import { useState } from 'react'

interface PricingClientProps {
  isPro: boolean
  generationsUsed: number
  hasStripeCustomer: boolean
}

type Tier = 'creator' | 'pro'

const starterFeatures = [
  '2 free generations total',
  '5 retention-optimized scripts per pack',
  'Money Facts niche unlocked',
  'Scroll-stopping hooks & viral titles',
  'Hashtags + YouTube descriptions',
]

const creatorFeatures = [
  '100 generations every month',
  'All 26 viral niches unlocked',
  '⚡ Viral Hook Engine access',
  'Hooks, titles, scripts, hashtags & descriptions',
  'Copy-paste ready packages',
  'Cancel anytime',
]

const proFeatures = [
  'Unlimited generations',
  'Everything in Creator',
  '🖼️ Thumbnail text generator',
  '🚀 Priority support',
  'Beta access: AI Video Generator',
  'Early access to new niches',
]

export default function PricingClient({
  isPro,
  generationsUsed,
  hasStripeCustomer,
}: PricingClientProps) {
  const [checkoutLoading, setCheckoutLoading] = useState<Tier | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  async function handleCheckout(tier: Tier) {
    setCheckoutLoading(tier)
    setCheckoutError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      const data = await res.json()
      if (data.url) {
        window.open(data.url, '_blank') || (window.location.href = data.url)
        setTimeout(() => setCheckoutLoading(null), 5000)
      } else {
        const msg = data.error ?? 'Payment failed. Please try again.'
        console.error('Stripe checkout error:', msg)
        setCheckoutError(msg)
        setCheckoutLoading(null)
      }
    } catch (err) {
      console.error('Stripe checkout fetch error:', err)
      setCheckoutError('Network error. Please check your connection and try again.')
      setCheckoutLoading(null)
    }
  }

  async function handlePortal() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {
      setPortalLoading(false)
    }
  }

  const freeRemaining = Math.max(0, 2 - generationsUsed)

  return (
    <div className="px-4 md:px-6 py-7 pb-20">
      {/* Header */}
      <div className="mb-8 text-center relative">
        <div
          className="absolute pointer-events-none"
          style={{
            width: 700, height: 400,
            background: 'radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.12) 0%, transparent 70%)',
            top: -100, left: '50%', transform: 'translateX(-50%)',
          }}
        />
        <div className="relative z-10">
          <div className="font-black uppercase tracking-widest mb-2" style={{ fontSize: '0.62rem', color: 'var(--indigo-light)' }}>
            Simple Pricing
          </div>
          <h1 className="font-black tracking-tight mb-2" style={{ fontSize: '1.8rem', color: 'var(--text)' }}>
            Pick the plan that <span className="grad-text">matches your hustle.</span>
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)', maxWidth: 460, margin: '0 auto' }}>
            Start free, upgrade when you&apos;re posting daily. No hidden fees.
          </p>
        </div>
      </div>

      {/* Current status */}
      {isPro ? (
        <div
          className="max-w-lg mx-auto mb-8 flex items-center gap-4 rounded-xl px-5 py-4"
          style={{ background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.18)' }}
        >
          <div className="text-2xl">✅</div>
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>You&apos;re on a paid plan</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Manage your subscription anytime via the billing portal.</p>
          </div>
        </div>
      ) : (
        <div
          className="max-w-lg mx-auto mb-8 flex items-center gap-4 rounded-xl px-5 py-4"
          style={{ background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.14)' }}
        >
          <div className="text-2xl">⚡</div>
          <div>
            <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>
              Starter — {freeRemaining} generation{freeRemaining !== 1 ? 's' : ''} remaining
            </p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Upgrade to unlock all 26 niches & the Hook Engine.
            </p>
          </div>
        </div>
      )}

      {/* Pricing cards — 3 tiers */}
      <div className="grid max-w-5xl mx-auto gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {/* Starter (Free) */}
        <div
          className="rounded-2xl p-7 transition-all"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 0 30px rgba(139,92,246,.08)' }}
        >
          <div className="mb-6">
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>Starter</div>
            <div className="flex items-end gap-1 mb-1">
              <span className="font-black" style={{ fontSize: '2.4rem', color: 'var(--text)', lineHeight: 1 }}>$0</span>
              <span className="text-sm pb-1" style={{ color: 'var(--muted)' }}>/forever</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Try the engine, no card needed.</p>
          </div>

          <div className="flex flex-col gap-2.5 mb-7">
            {starterFeatures.map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-sm">
                <span style={{ color: '#34d399', fontSize: '0.8rem' }}>✓</span>
                <span style={{ color: 'var(--text2)' }}>{f}</span>
              </div>
            ))}
          </div>

          <div
            className="w-full text-center rounded-xl py-3 text-sm font-bold"
            style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid var(--border2)',
              color: isPro ? 'var(--muted)' : 'var(--text2)',
            }}
          >
            {isPro ? 'Previous plan' : freeRemaining > 0 ? 'Start For Free' : 'Limit reached'}
          </div>
        </div>

        {/* Creator ($9) — Most Popular */}
        <div
          className="rounded-2xl p-7 relative overflow-hidden transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,.10), rgba(124,58,237,.06))',
            border: '2px solid rgba(99,102,241,.40)',
            boxShadow: '0 0 60px rgba(99,102,241,.18)',
          }}
        >
          <div
            className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-xs font-black"
            style={{ background: 'linear-gradient(135deg, var(--indigo), var(--purple))', color: 'white' }}
          >
            Most Popular
          </div>

          <div className="mb-6">
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--indigo-light)' }}>
              Creator
            </div>
            <div className="flex items-end gap-1 mb-1">
              <span className="font-black" style={{ fontSize: '2.4rem', color: 'var(--text)', lineHeight: 1 }}>$9</span>
              <span className="text-sm pb-1" style={{ color: 'var(--muted)' }}>/month</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>For creators posting consistently.</p>
          </div>

          <div className="flex flex-col gap-2.5 mb-7">
            {creatorFeatures.map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-sm">
                <span style={{ color: '#34d399', fontSize: '0.8rem' }}>✓</span>
                <span style={{ color: 'var(--text2)' }}>{f}</span>
              </div>
            ))}
          </div>

          {isPro ? (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="w-full rounded-xl py-3.5 text-sm font-bold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow: '0 4px 22px rgba(16,185,129,.3)',
                opacity: portalLoading ? 0.7 : 1,
                cursor: portalLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {portalLoading ? 'Opening...' : '⚙️ Manage Billing'}
            </button>
          ) : (
            <button
              onClick={() => handleCheckout('creator')}
              disabled={checkoutLoading !== null}
              className="w-full rounded-xl py-3.5 text-sm font-black text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)',
                boxShadow: '0 4px 28px rgba(99,102,241,.45)',
                animation: checkoutLoading === 'creator' ? 'none' : 'btn-pulse 2.8s ease-in-out infinite',
                opacity: checkoutLoading !== null && checkoutLoading !== 'creator' ? 0.5 : checkoutLoading === 'creator' ? 0.7 : 1,
                cursor: checkoutLoading !== null ? 'not-allowed' : 'pointer',
              }}
            >
              {checkoutLoading === 'creator' ? 'Redirecting...' : 'Get Creator — $9/mo →'}
            </button>
          )}
        </div>

        {/* Pro ($19) */}
        <div
          className="rounded-2xl p-7 relative overflow-hidden transition-all"
          style={{
            background: 'linear-gradient(160deg, rgba(236,72,153,.08), rgba(168,85,247,.06))',
            border: '1px solid rgba(236,72,153,.32)',
            boxShadow: '0 0 50px rgba(236,72,153,.12)',
          }}
        >
          <div
            className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-xs font-black"
            style={{ background: 'linear-gradient(135deg, #ec4899, #a855f7)', color: 'white' }}
          >
            Unlimited
          </div>

          <div className="mb-6">
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: '#f0abfc' }}>
              Pro
            </div>
            <div className="flex items-end gap-1 mb-1">
              <span className="font-black" style={{ fontSize: '2.4rem', color: 'var(--text)', lineHeight: 1 }}>$19</span>
              <span className="text-sm pb-1" style={{ color: 'var(--muted)' }}>/month</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>For full-time faceless channels.</p>
          </div>

          <div className="flex flex-col gap-2.5 mb-7">
            {proFeatures.map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-sm">
                <span style={{ color: '#34d399', fontSize: '0.8rem' }}>✓</span>
                <span style={{ color: 'var(--text2)' }}>{f}</span>
              </div>
            ))}
          </div>

          {isPro ? (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="w-full rounded-xl py-3.5 text-sm font-bold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow: '0 4px 22px rgba(16,185,129,.3)',
                opacity: portalLoading ? 0.7 : 1,
                cursor: portalLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {portalLoading ? 'Opening...' : '⚙️ Manage Billing'}
            </button>
          ) : (
            <button
              onClick={() => handleCheckout('pro')}
              disabled={checkoutLoading !== null}
              className="w-full rounded-xl py-3.5 text-sm font-black text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 55%, #6366f1 100%)',
                boxShadow: '0 4px 28px rgba(236,72,153,.4)',
                opacity: checkoutLoading !== null && checkoutLoading !== 'pro' ? 0.5 : checkoutLoading === 'pro' ? 0.7 : 1,
                cursor: checkoutLoading !== null ? 'not-allowed' : 'pointer',
              }}
            >
              {checkoutLoading === 'pro' ? 'Redirecting...' : 'Get Pro — $19/mo →'}
            </button>
          )}
        </div>
      </div>

      {checkoutError && (
        <p className="max-w-3xl mx-auto text-center text-xs mt-4 font-semibold" style={{ color: '#f87171' }}>
          ⚠️ {checkoutError}
        </p>
      )}
      <p className="max-w-3xl mx-auto text-center text-xs mt-4" style={{ color: 'var(--muted)' }}>
        Cancel anytime. No hidden fees.
      </p>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto mt-12">
        <h2 className="font-black text-center mb-6 tracking-tight" style={{ fontSize: '1.1rem', color: 'var(--text)' }}>
          Frequently Asked Questions
        </h2>
        <div className="flex flex-col gap-3">
          {[
            { q: 'Can I cancel anytime?', a: 'Yes. Cancel directly from the billing portal. Your access continues until the end of your billing period.' },
            { q: 'What counts as a generation?', a: 'One click of "Generate 5 Viral Shorts" = 1 generation. Each generation produces 5 complete scripts.' },
            { q: "What's the difference between Creator and Pro?", a: 'Creator is $9/month with 100 generations/month and the Hook Engine. Pro is $19/month with unlimited generations, the Thumbnail Generator, priority support, and AI Video Generator beta.' },
            { q: 'Is the content unique every time?', a: 'Yes. GPT-4o generates fresh scripts on every request — no two generations are identical.' },
            { q: 'How many niches do I get?', a: 'Starter gets Money Facts. Creator and Pro both unlock all 26 viral niches.' },
          ].map((faq) => (
            <div
              key={faq.q}
              className="rounded-xl px-5 py-4"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 0 30px rgba(139,92,246,.06)' }}
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
