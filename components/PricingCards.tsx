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

import { useEffect, useState } from 'react'
import { PLANS } from '@/lib/pricing'
import {
  CURRENCY_DISPLAY,
  INTRO_PRICES,
  TIER_PRICES,
  formatCheckoutMoney,
  type CheckoutCurrency,
  type CheckoutTier,
} from '@/lib/checkoutPricing'
import { trackEvent } from '@/lib/analytics'

// Push #078 — feature copy now derives from lib/pricing.ts so credit
// counts can't drift between the homepage, /pricing, and this in-flow
// upgrade card.
const FREE_FEATURES = [
  '3 Fast Mode renders included',
  'Stock footage + AI voiceover',
  'Auto-captions',
  'Watermark-free MP4 output',
]

const STARTER_FEATURES = [
  `${PLANS.starter.credits} Fast Mode renders/month`,
  'AI writes script + voiceover',
  'Auto-captions pipeline',
  'Download watermark-free MP4',
  'My Videos history',
]

// KINEO-PRICING-V3B-2026-07-10 — Creator $24.90/150cr: 1 Hollywood film every
// month included (150 cr), or ~7 AI-generated videos (20 cr each).
const BASIC_FEATURES = [
  '1 Hollywood film every month — included',
  'Or ~7 AI-generated videos/month',
  'Seedance AI engine (great quality)',
  'AI writes script + voiceover',
  'Auto-captions pipeline',
  'Download watermark-free MP4',
  'My Videos history',
]

// KINEO-REBASE-2026-07-10 — 2:1 credit rebase: Studio 200 credits → ~4 Kling
// (50 cr — KINEO-PRICING-V3B-2026-07-10) or ~10 Seedance (20 cr) videos.
const PRO_FEATURES = [
  '~4 cinematic AI videos/month (or ~10 Seedance)',
  'Kling 2.5 engine (top-tier cinematic)',
  'AI writes script + voiceover',
  'Auto-captions pipeline',
  'Download watermark-free MP4',
  'My Videos history',
]

export default function PricingCards({
  intentCampaign,
}: {
  intentCampaign?: string | null
}) {
  const [purchasing, setPurchasing] = useState<'starter' | 'basic' | 'pro' | null>(null)
  const [displayCurrency, setDisplayCurrency] = useState<CheckoutCurrency | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Push #171 — show a clear "already subscribed" banner instead of
  // silently redirecting to /generate on duplicate purchase attempts.
  const [alreadySubscribed, setAlreadySubscribed] = useState(false)
  // Push #077 — pricing card selected state. Card click selects (does NOT
  // trigger Stripe); CTA button click navigates to Stripe.
  // KINEO-SPRINT-OFFER-2026-07-14 — default selection moved Pro → Creator so
  // this in-flow grid agrees with /pricing and the 0-credit modal (Creator =
  // the one primary plan everywhere).
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'basic' | 'pro' | null>('basic')

  // PUSH #74 — display the same server-selected currency the customer will
  // see in Stripe. Checkout still resolves currency independently and never
  // trusts the browser. Keeping this null until /api/geo responds prevents a
  // misleading USD flash for Brazilian and Indian visitors.
  useEffect(() => {
    let cancelled = false

    void fetch('/api/geo', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('geo_lookup_failed')
        const data = await response.json() as { currency?: string }
        const currency: CheckoutCurrency =
          data.currency === 'brl' || data.currency === 'inr' ? data.currency : 'usd'
        if (cancelled) return
        setDisplayCurrency(currency)
        void trackEvent('inline_pricing_currency_resolved', {
          display_currency: currency,
          currency_label: CURRENCY_DISPLAY[currency].label,
          pricing_surface: 'generate_step_1',
        })
      })
      .catch(() => {
        if (!cancelled) setDisplayCurrency('usd')
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Push #173 — use direct GET navigation to bypass iOS Safari async block.
  // The server-side GET handler creates the Stripe session and issues a 302
  // redirect, so no fetch/await is needed here and the user gesture is
  // preserved across all browsers including mobile Safari.
  function handleBuy(tier: CheckoutTier) {
    setPurchasing(tier)
    // KINEO-INTRO-MONTH-2026-07-13 — Starter/Creator levam o 1º mês com
    // desconto ($4.90/$9.90); o servidor valida elegibilidade (1 por conta).
    const introParam = tier === 'starter' || tier === 'basic' ? '&intro=1' : ''
    const campaignParam = intentCampaign
      ? `&intent_campaign=${encodeURIComponent(intentCampaign)}`
      : ''
    void trackEvent('inline_pricing_checkout_clicked', {
      tier,
      display_currency: displayCurrency ?? 'resolving',
      displayed_price_minor: displayCurrency ? TIER_PRICES[tier][displayCurrency] : null,
      displayed_intro_price_minor:
        displayCurrency && (tier === 'starter' || tier === 'basic')
          ? INTRO_PRICES[tier][displayCurrency]
          : null,
      intro: tier === 'starter' || tier === 'basic',
      pricing_surface: 'generate_step_1',
    })
    window.location.href = `/api/stripe/checkout?tier=${tier}${introParam}${campaignParam}`
  }

  function priceFor(tier: CheckoutTier): string {
    return displayCurrency
      ? formatCheckoutMoney(displayCurrency, TIER_PRICES[tier][displayCurrency])
      : '—'
  }

  function introNoteFor(tier: 'starter' | 'basic'): string {
    if (!displayCurrency) return 'Checking your local first-month price…'
    const intro = formatCheckoutMoney(displayCurrency, INTRO_PRICES[tier][displayCurrency])
    const renewal = formatCheckoutMoney(displayCurrency, TIER_PRICES[tier][displayCurrency])
    return `First month ${intro} — renews at ${renewal}/mo in 30 days, cancel anytime`
  }

  return (
    <section className="mt-8">
      <div className="text-center mb-5">
        <div
          className="font-black uppercase tracking-widest mb-1"
          style={{ fontSize: '0.62rem', color: 'var(--blue, #2997ff)' }}
        >
          Pricing
        </div>
        <h2
          className="font-black tracking-tight"
          style={{ fontSize: '1.35rem', color: 'var(--text)' }}
        >
          Choose your plan
        </h2>
        <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
          {displayCurrency
            ? `Prices shown in ${CURRENCY_DISPLAY[displayCurrency].label}. Stripe checkout uses the same currency.`
            : 'Checking your local price…'}
        </p>
      </div>

      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm mb-4 mx-auto"
          style={{
            maxWidth: 720,
            background: 'rgba(245,245,247,.05)',
            border: '1px solid #3a3a3d',
            color: '#f5f5f7',
          }}
        >
          {error}
        </div>
      )}

      {/* Push #171 — already subscribed info banner */}
      {alreadySubscribed && (
        <div
          className="rounded-xl px-4 py-4 text-sm mb-4 mx-auto text-center"
          style={{
            maxWidth: 720,
            background: 'rgba(41,151,255,.06)',
            border: '1px solid rgba(41,151,255,.25)',
          }}
        >
          <p style={{ color: 'var(--blue, #2997ff)', fontWeight: 800 }}>✅ You already have an active subscription!</p>
          <p style={{ color: '#86868b', marginTop: 4, fontSize: '0.75rem' }}>
            Your plan is active. Credits may still be syncing.
          </p>
          <a
            href="/generate"
            style={{
              display: 'inline-block',
              marginTop: 10,
              background: '#f5f5f7',
              color: '#000',
              borderRadius: 980,
              padding: '6px 16px',
              fontWeight: 800,
              fontSize: '0.8rem',
              textDecoration: 'none',
            }}
          >
            Go to Dashboard →
          </a>
        </div>
      )}

      {/* Push #339 — 3-card layout: Spark + Basic + Pro. */}
      <div className="grid mx-auto gap-4 grid-cols-1 md:grid-cols-3" style={{ maxWidth: '62rem' }}>

        {/* KINEO-SPRINT-OFFER-2026-07-14 — Starter tagline was 2 pricing
            generations stale ("50 Fast-Mode Shorts"); synced to V3C (25
            credits). Intro renewal spelled out via renewNote. */}
        <PlanCard
          tier="starter"
          name={PLANS.starter.name}
          price={priceFor('starter')}
          period="/ month"
          renewNote={introNoteFor('starter')}
          tagline="25 credits/month — up to 25 Fast videos from smart stock footage + AI voiceover."
          features={STARTER_FEATURES}
          selected={selectedPlan === 'starter'}
          onSelect={() => setSelectedPlan('starter')}
          cta={{
            label:
              purchasing === 'starter'
                ? 'Loading…'
                : selectedPlan === 'starter'
                  ? 'Continue with Starter'
                  : PLANS.starter.cta,
            onClick: () => handleBuy('starter'),
            loading: purchasing === 'starter',
          }}
        />

        {/* KINEO-PRICING-V3B-2026-07-10 — $24.90/150cr, 1 Hollywood film included. */}
        {/* KINEO-SPRINT-OFFER-2026-07-14 — Creator is the highlighted primary
            ("Most Popular", matching /pricing); intro renewal explicit. */}
        <PlanCard
          tier="basic"
          name={PLANS.basic.name}
          price={priceFor('basic')}
          period="/ month"
          renewNote={introNoteFor('basic')}
          tagline="150 credits/month — 1 Hollywood film every month included."
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
                  ? 'Continue with Creator'
                  : PLANS.basic.cta,
            onClick: () => handleBuy('basic'),
            loading: purchasing === 'basic',
          }}
        />

        {/* KINEO-REBASE-2026-07-10 — 360/400 → 200 credits (2:1 rebase, USD unchanged). */}
        {/* KINEO-SPRINT-OFFER-2026-07-14 — badge/highlight moved to Creator. */}
        <PlanCard
          tier="pro"
          name={PLANS.pro.name}
          price={priceFor('pro')}
          period="/ month"
          tagline="Premium Kling engine + 200 credits — up to 10 AI or ~4 cinematic Shorts/month."
          features={PRO_FEATURES}
          selected={selectedPlan === 'pro'}
          onSelect={() => setSelectedPlan('pro')}
          cta={{
            label:
              purchasing === 'pro'
                ? 'Loading…'
                : selectedPlan === 'pro'
                  ? 'Continue with Studio'
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
  tier: 'free' | 'starter' | 'basic' | 'pro'
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
  const isPaid = tier === 'starter' || tier === 'basic' || tier === 'pro'
  const isSelected = !!selected

  function background(): string {
    if (isSelected) return '#1d1d1f'
    if (highlight) return '#1d1d1f'
    return '#161618'
  }
  function border(): string {
    if (isSelected) return '2px solid #2997ff'
    if (highlight) return '2px solid #48484a'
    return '1px solid #2a2a2d'
  }
  function shadow(): string {
    if (isSelected) return '0 0 28px rgba(41,151,255,0.18)'
    if (highlight) return 'none'
    return 'none'
  }

  return (
    <div
      role={isPaid ? 'button' : undefined}
      tabIndex={isPaid ? 0 : undefined}
      aria-pressed={isPaid ? isSelected : undefined}
      onClick={() => {
        // Push #261 — card click goes directly to checkout (1-click flow).
        // Previously clicking the card only selected it visually; the user
        // had to click the CTA button separately. Now both the card and the
        // button trigger checkout immediately.
        if (isPaid && cta) cta.onClick()
      }}
      onKeyDown={(e) => {
        if (!isPaid || !cta) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          cta.onClick()
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
        e.currentTarget.style.borderColor = '#48484a'
        e.currentTarget.style.background = '#1d1d1f'
        e.currentTarget.style.boxShadow = 'none'
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
          style={{ background: '#2997ff', color: '#fff' }}
        >
          {badge}
        </div>
      )}
      {isSelected && (
        <div
          className="absolute top-4 right-4 flex items-center justify-center rounded-full"
          style={{
            width: 26, height: 26,
            background: '#2997ff',
            color: '#FFFFFF',
            boxShadow: 'none',
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
          style={{ color: highlight ? 'var(--blue, #2997ff)' : 'var(--muted)' }}
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
          <p className="text-xs mb-1" style={{ color: 'var(--blue, #2997ff)', fontWeight: 700 }}>
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
            <span style={{ color: 'var(--blue, #2997ff)', fontSize: '0.75rem', marginTop: 2 }}>✓</span>
            <span style={{ color: 'var(--text2)' }}>{f}</span>
          </div>
        ))}
      </div>

      {cta ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            cta.onClick()
          }}
          disabled={cta.loading}
          // Push #052 — bump mobile tap-target above the 44px minimum
          // (py-3.5 → ~46px tall) without changing desktop density.
          className="w-full rounded-xl py-3.5 sm:py-3 text-sm font-black"
          style={{
            background: '#f5f5f7',
            color: '#000',
            boxShadow: 'none',
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
