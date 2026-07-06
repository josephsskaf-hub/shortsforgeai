// Push #404 — current 3-tier pricing.
// Starter = $11.90/month (50 credits, Fast/stock engine, 1 credit/video)
// Creator = $24.90/month (240 credits, Seedance AI engine, 40 credits/video → 6 videos)
// Studio  = $37.90/month (400 credits, Kling premium engine, 60 credits/video → 6 videos,
//           falls back to Seedance → 10 videos; 1080p; priority queue)
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
  // cheap entry to compete with InVideo/AutoShorts. 1 credit/video → 50 videos.
  starter: {
    tier: 'starter',
    name: 'Starter',
    price: 11.90,
    priceLabel: '$11.90',
    periodLabel: '/ month',
    credits: 50,
    cta: 'Start for $11.90',
    href: '/api/stripe/checkout?tier=starter',
    annualPriceLabel: '$119',
    annualPerMonthLabel: '$9.92',
    annualHref: '/api/stripe/checkout?tier=starter&billing=annual',
  },
  // Push #404 — CREATOR: Seedance AI engine. 40 credits/video → 6 videos.
  basic: {
    tier: 'basic',
    name: 'Creator',
    price: 24.90,
    priceLabel: '$24.90',
    periodLabel: '/ month',
    credits: 240,
    cta: 'Go Creator',
    href: '/api/stripe/checkout?tier=basic',
    annualPriceLabel: '$249',
    annualPerMonthLabel: '$20.75',
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
    // Stripe/PayPal webhooks). Aligned to 400 everywhere: ~10 Seedance videos
    // or ~6 Kling, keeps Studio margin safe (break-even ~$0.54/clip, matches
    // Creator) while still reading as generous. No credit rollover between months.
    credits: 400,
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
