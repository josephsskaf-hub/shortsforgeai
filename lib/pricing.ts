// Push #191 — updated pricing.
// Basic = $4.90/month  (50 Fast Mode videos)
// Pro   = $9.90/month (150 credits = up to 5 AI Generated videos OR 150 Fast)
//
// All checkout buttons on every surface link to /api/stripe/checkout?tier=...
// The server route handles currency detection (BRL for BR users) and creates
// the Stripe session. No Stripe payment-link URLs live here.

export type PlanTier = 'free' | 'starter' | 'basic' | 'pro'

export interface PlanConfig {
  tier: PlanTier
  name: string
  price: number         // numeric, for logic comparisons
  priceLabel: string    // display string shown in UI
  periodLabel: string   // e.g. "/ month" or "forever"
  credits: number
  cta: string
  href: string
  recommended?: boolean
  // #381 — annual billing (≈2 months free). Optional: only paid plans have it.
  annualPriceLabel?: string
  annualPerMonthLabel?: string
  annualHref?: string
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  free: {
    tier: 'free',
    name: 'Free',
    price: 0,
    priceLabel: '$0',
    periodLabel: 'forever',
    credits: 3,
    cta: 'Run Free',
    href: '/signup',
  },
  // Push #339 — Starter plan at $2.90/mo (15 credits). Entry-level for creators
  // who want to test the product before committing to Basic or Pro.
  starter: {
    tier: 'starter',
    name: 'Spark',
    price: 2.90,
    priceLabel: '$2.90',
    periodLabel: '/ month',
    credits: 15,
    cta: 'Ignite My Channel',
    href: '/api/stripe/checkout?tier=starter',
    annualPriceLabel: '$29',
    annualPerMonthLabel: '$2.42',
    annualHref: '/api/stripe/checkout?tier=starter&billing=annual',
  },
  // Push #401 — Entry plan. Seedance 1.5 Pro engine, 120 credits = 4 AI videos/mo.
  basic: {
    tier: 'basic',
    name: 'Basic',
    price: 12.90,
    priceLabel: '$12.90',
    periodLabel: '/ month',
    credits: 120,
    cta: 'Start Creating',
    href: '/api/stripe/checkout?tier=basic',
    annualPriceLabel: '$129',
    annualPerMonthLabel: '$10.75',
    annualHref: '/api/stripe/checkout?tier=basic&billing=annual',
  },
  // Push #401 — Premium plan. Kling 2.5 Turbo Pro (cinematic) engine, 240 credits
  // = 8 AI videos/mo. Kling + Seedance both available on this tier.
  pro: {
    tier: 'pro',
    name: 'Pro',
    price: 38.90,
    priceLabel: '$38.90',
    periodLabel: '/ month',
    credits: 240,
    cta: 'Go Cinematic',
    href: '/api/stripe/checkout?tier=pro',
    recommended: true,
    annualPriceLabel: '$389',
    annualPerMonthLabel: '$32.42',
    annualHref: '/api/stripe/checkout?tier=pro&billing=annual',
  },
}

// Push #276 — remove free card from all surfaces. Only paid plans shown.
// Push #401 — 2-plan structure: Basic (Seedance) + Pro (Kling). Spark/starter
// is retired from all surfaces but kept in PLANS for back-compat so existing
// Spark subscribers are grandfathered (their webhook/portal still resolve).
export const PLAN_LIST: PlanConfig[] = [PLANS.basic, PLANS.pro]
