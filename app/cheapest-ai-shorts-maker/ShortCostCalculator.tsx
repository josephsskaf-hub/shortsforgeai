'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { trackEvent } from '@/lib/analytics'
import { PLANS as PRODUCT_PLANS } from '@/lib/pricing'
import {
  CURRENCY_DISPLAY,
  INTRO_PRICES,
  TIER_PRICES,
  formatCheckoutMoney,
  type CheckoutCurrency,
  type CheckoutTier,
} from '@/lib/checkoutPricing'

type EngineKey = 'fast' | 'ai' | 'cinematic'

const ENGINES: Record<EngineKey, {
  name: string
  creditCost: number
  detail: string
}> = {
  fast: {
    name: 'Fast Mode',
    creditCost: 1,
    detail: 'Matched stock footage + AI voiceover',
  },
  ai: {
    name: 'AI Generated',
    creditCost: 20,
    detail: 'Seedance-generated scenes',
  },
  cinematic: {
    name: 'Cinematic',
    creditCost: 50,
    detail: 'Premium Kling-generated scenes',
  },
}

const PLANS: Array<{
  tier: CheckoutTier
  name: string
  credits: number
  intro: boolean
}> = [
  { tier: 'starter', name: PRODUCT_PLANS.starter.name, credits: PRODUCT_PLANS.starter.credits, intro: true },
  { tier: 'basic', name: PRODUCT_PLANS.basic.name, credits: PRODUCT_PLANS.basic.credits, intro: true },
  { tier: 'pro', name: PRODUCT_PLANS.pro.name, credits: PRODUCT_PLANS.pro.credits, intro: false },
]

function clampVideos(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(200, Math.round(value)))
}

export default function ShortCostCalculator() {
  const [engineKey, setEngineKey] = useState<EngineKey>('fast')
  const [videos, setVideos] = useState(12)
  const [currency, setCurrency] = useState<CheckoutCurrency | null>(null)
  const engine = ENGINES[engineKey]
  const requiredCredits = videos * engine.creditCost

  const recommendation = useMemo(() => {
    const eligible = PLANS.filter((plan) => plan.credits >= requiredCredits)
    if (eligible.length === 0 || !currency) return null
    return eligible.reduce((best, plan) =>
      TIER_PRICES[plan.tier][currency] < TIER_PRICES[best.tier][currency] ? plan : best,
    )
  }, [requiredCredits, currency])

  useEffect(() => {
    let cancelled = false
    void fetch('/api/geo', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('geo_lookup_failed')
        const data = await response.json() as { currency?: string }
        const resolved: CheckoutCurrency =
          data.currency === 'brl' || data.currency === 'inr' ? data.currency : 'usd'
        if (cancelled) return
        setCurrency(resolved)
        void trackEvent('short_cost_calculator_viewed', {
          display_currency: resolved,
          default_engine: 'fast',
          default_videos: 12,
          intent_campaign: 'push77_short_cost_calculator',
        })
      })
      .catch(() => {
        if (!cancelled) setCurrency('usd')
      })
    return () => {
      cancelled = true
    }
  }, [])

  function recordChange(nextEngine: EngineKey, nextVideos: number) {
    const nextRequired = ENGINES[nextEngine].creditCost * nextVideos
    const nextPlan = PLANS.find((plan) => plan.credits >= nextRequired)
    void trackEvent('short_cost_calculator_changed', {
      engine: nextEngine,
      videos: nextVideos,
      required_credits: nextRequired,
      minimum_plan: nextPlan?.tier ?? 'above_studio',
      display_currency: currency ?? 'resolving',
      intent_campaign: 'push77_short_cost_calculator',
    })
  }

  function chooseEngine(next: EngineKey) {
    setEngineKey(next)
    recordChange(next, videos)
  }

  function commitVideos(raw: number) {
    const next = clampVideos(raw)
    setVideos(next)
    recordChange(engineKey, next)
  }

  const recommendationMonthly = recommendation && currency
    ? TIER_PRICES[recommendation.tier][currency]
    : null
  const recommendationIntro = recommendation && currency && recommendation.intro
    ? INTRO_PRICES[recommendation.tier as 'starter' | 'basic'][currency]
    : null

  return (
    <section
      aria-labelledby="short-cost-calculator-title"
      style={{
        marginTop: 36,
        padding: 'clamp(20px, 5vw, 30px)',
        background: '#101012',
        border: '1px solid #2a2a2d',
        borderRadius: 20,
      }}
    >
      <p style={{ margin: 0, color: '#2997ff', fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Free cost calculator
      </p>
      <h2 id="short-cost-calculator-title" style={{ margin: '8px 0 0', fontSize: 'clamp(1.45rem, 4vw, 2rem)', lineHeight: 1.2 }}>
        What would your Shorts actually cost?
      </h2>
      <p style={{ margin: '10px 0 0', color: '#86868b', lineHeight: 1.6 }}>
        Pick your monthly output and visual engine. We use the same credits and local prices as Checkout.
      </p>

      <div style={{ marginTop: 24 }}>
        <div style={{ color: '#d2d2d7', fontSize: 13, fontWeight: 800, marginBottom: 9 }}>1. Visual engine</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {(Object.keys(ENGINES) as EngineKey[]).map((key) => {
            const option = ENGINES[key]
            const selected = key === engineKey
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                onClick={() => chooseEngine(key)}
                style={{
                  textAlign: 'left',
                  padding: '14px 15px',
                  borderRadius: 13,
                  border: selected ? '2px solid #2997ff' : '1px solid #3a3a3d',
                  background: selected ? 'rgba(41,151,255,.10)' : '#161618',
                  color: '#f5f5f7',
                  cursor: 'pointer',
                }}
              >
                <span style={{ display: 'block', fontWeight: 800 }}>{option.name}</span>
                <span style={{ display: 'block', marginTop: 4, color: '#86868b', fontSize: 12, lineHeight: 1.4 }}>{option.detail}</span>
                <span style={{ display: 'block', marginTop: 7, color: '#2997ff', fontSize: 12, fontWeight: 800 }}>{option.creditCost} credit{option.creditCost === 1 ? '' : 's'} / video</span>
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <label htmlFor="shorts-per-month" style={{ display: 'block', color: '#d2d2d7', fontSize: 13, fontWeight: 800, marginBottom: 9 }}>
          2. Shorts per month
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            id="shorts-per-month"
            type="range"
            min={1}
            max={200}
            value={videos}
            onChange={(event) => setVideos(clampVideos(Number(event.target.value)))}
            onPointerUp={() => recordChange(engineKey, videos)}
            onKeyUp={() => recordChange(engineKey, videos)}
            style={{ flex: 1, accentColor: '#2997ff' }}
          />
          <input
            aria-label="Shorts per month"
            type="number"
            min={1}
            max={200}
            value={videos}
            onChange={(event) => setVideos(clampVideos(Number(event.target.value)))}
            onBlur={(event) => commitVideos(Number(event.target.value))}
            style={{ width: 76, padding: '10px 9px', borderRadius: 10, border: '1px solid #3a3a3d', background: '#161618', color: '#f5f5f7', fontWeight: 800, fontSize: 16 }}
          />
        </div>
      </div>

      <div style={{ marginTop: 24, padding: 18, borderRadius: 16, background: '#161618', border: recommendation ? '1px solid rgba(41,151,255,.45)' : '1px solid #3a3a3d' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#86868b', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>Credits required</div>
            <div style={{ marginTop: 4, fontSize: 26, fontWeight: 900 }}>{requiredCredits}</div>
          </div>
          <div style={{ minWidth: 220 }}>
            <div style={{ color: '#86868b', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>Lowest monthly plan that covers it</div>
            {!currency ? (
              <div style={{ marginTop: 6, color: '#d2d2d7', fontWeight: 800 }}>Checking local price…</div>
            ) : recommendation && recommendationMonthly != null ? (
              <div style={{ marginTop: 5 }}>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{recommendation.name} · {formatCheckoutMoney(currency, recommendationMonthly)}/mo</div>
                {recommendationIntro != null && (
                  <div style={{ marginTop: 4, color: '#2997ff', fontSize: 13, fontWeight: 800 }}>
                    First month {formatCheckoutMoney(currency, recommendationIntro)}
                  </div>
                )}
                <div style={{ marginTop: 5, color: '#86868b', fontSize: 13 }}>
                  {formatCheckoutMoney(currency, recommendationMonthly / videos)} per planned Short at renewal · {CURRENCY_DISPLAY[currency].label}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 6, color: '#f5f5f7', fontWeight: 800 }}>
                Above the 200 credits included in Studio. Start with a smaller target, then add credits after subscribing.
              </div>
            )}
          </div>
        </div>
        <p style={{ color: '#86868b', fontSize: 12, lineHeight: 1.5, margin: '14px 0 0' }}>
          Estimate assumes every planned video uses the selected engine. Credits refresh monthly and unused plan credits do not roll over. The server confirms currency and eligibility again in Checkout.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
        <Link
          href="#try-costed-workflow"
          onClick={() => {
            void trackEvent('short_cost_calculator_cta_clicked', {
              destination: 'topic_form',
              engine: engineKey,
              videos,
              required_credits: requiredCredits,
              recommended_plan: recommendation?.tier ?? 'above_studio',
              display_currency: currency ?? 'resolving',
              intent_campaign: 'push77_short_cost_calculator',
            })
          }}
          style={{ padding: '13px 22px', borderRadius: 980, background: '#f5f5f7', color: '#000', textDecoration: 'none', fontWeight: 900 }}
        >
          Test one Short free →
        </Link>
        <Link
          href="/pricing?intent_campaign=push77_short_cost_calculator"
          onClick={() => {
            void trackEvent('short_cost_calculator_cta_clicked', {
              destination: 'pricing',
              engine: engineKey,
              videos,
              required_credits: requiredCredits,
              recommended_plan: recommendation?.tier ?? 'above_studio',
              display_currency: currency ?? 'resolving',
              intent_campaign: 'push77_short_cost_calculator',
            })
          }}
          style={{ padding: '13px 20px', borderRadius: 980, border: '1px solid #48484a', color: '#f5f5f7', textDecoration: 'none', fontWeight: 800 }}
        >
          Compare plans
        </Link>
      </div>
    </section>
  )
}
