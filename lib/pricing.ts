// Push #404 — current 3-tier pricing.
// KINEO-REBASE-2026-07-10 — CREDIT REBASE 2:1: USD prices UNCHANGED, every
// credit number divided by 2 (1 new credit = 2 old credits). Engine costs
// halved in lockstep (Seedance 20, Kling 45, Veo 90, Hollywood 150, Avatar 110)
// so plan purchasing power is identical — just smaller, simpler numbers.
// Starter = $9.90/month (25 credits)
// Creator = $19.90/month (120 credits, Seedance AI engine, 20 credits/video → 6 videos)
// Studio  = $37.90/month (200 credits, premium engines, ~10 Seedance or ~4 Kling videos;
//           1080p; priority queue)
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
  // Push #404 — STARTER: Fast engine (stock, relevance-gated). High volume,
  // cheap entry to compete with InVideo/AutoShorts.
  // KINEO-REBASE-2026-07-10 — 50 → 25 credits (2:1 rebase, USD unchanged).
  starter: {
    tier: 'starter',
    name: 'Starter',
    price: 9.90,
    priceLabel: '$9.90',
    periodLabel: '/ month',
    credits: 25,
    cta: 'Start for $9.90',
    href: '/api/stripe/checkout?tier=starter',
    annualPriceLabel: '$99',
    annualPerMonthLabel: '$8.25',
    annualHref: '/api/stripe/checkout?tier=starter&billing=annual',
  },
  // Push #404 — CREATOR: Seedance AI engine. 20 credits/video → 6 videos.
  // KINEO-REBASE-2026-07-10 — 240 → 120 credits (2:1 rebase, USD unchanged).
  basic: {
    tier: 'basic',
    name: 'Creator',
    price: 19.90,
    priceLabel: '$19.90',
    periodLabel: '/ month',
    credits: 120,
    cta: 'Go Creator',
    href: '/api/stripe/checkout?tier=basic',
    annualPriceLabel: '$199',
    annualPerMonthLabel: '$16.58',
    annualHref: '/api/stripe/checkout?tier=basic&billing=annual',
  },
  // Push #404 — STUDIO: Kling premium engine (fallback Seedance). 60 cr/video → 6 videos (or 9 on Seedance).
  pro: {
    tier: 'pro',
    name: 'Studio',
    price: 37.90,
    priceLabel: '$37.90',
    periodLabel: '/ month',
    // KINEO-STUDIO-400-2026-07-06 — was inconsistent (360 here vs 600 in the
    // Stripe/PayPal webhooks). Aligned everywhere.
    // KINEO-REBASE-2026-07-10 — 400 → 200 credits (2:1 rebase, USD unchanged):
    // ~10 Seedance videos or ~4 Kling. No credit rollover between months.
    credits: 200,
    cta: 'Go Studio',
    href: '/api/stripe/checkout?tier=pro',
    recommended: true,
    annualPriceLabel: '$379',
    annualPerMonthLabel: '$31.58',
    annualHref: '/api/stripe/checkout?tier=pro&billing=annual',
  },
}

// Push #276 — remove free card from all surfaces. Only paid plans shown.
// Push #401 — 2-plan structure: Basic (Seedance) + Pro (Kling). Spark/starter
// is retired from all surfaces but kept in PLANS for back-compat so existing
// Spark subscribers are grandfathered (their webhook/portal still resolve).
// Push #404 — 3-tier structure: Starter (Fast) · Creator (Seedance) · Studio (Kling).
export const PLAN_LIST: PlanConfig[] = [PLANS.starter, PLANS.basic, PLANS.pro]
