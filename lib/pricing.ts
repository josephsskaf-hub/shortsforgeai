// Push #191 — updated pricing.
// Basic = $4.90/month  (50 Fast Mode videos)
// Pro   = $9.90/month (100 Fast Mode videos + 1 Cinematic/month)
//
// All checkout buttons on every surface link to /api/stripe/checkout?tier=...
// The server route handles currency detection (BRL for BR users) and creates
// the Stripe session. No Stripe payment-link URLs live here.

export type PlanTier = 'free' | 'basic' | 'pro'

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
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  free: {
    tier: 'free',
    name: 'Free',
    price: 0,
    priceLabel: '$0',
    periodLabel: 'forever',
    credits: 1,
    cta: 'Run Free',
    href: '/signup',
  },
  basic: {
    tier: 'basic',
    name: 'Basic',
    price: 4.90,
    priceLabel: '$4.90',
    periodLabel: '/ month',
    credits: 50,
    cta: 'Automate Now',
    href: '/api/stripe/checkout?tier=basic',
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    price: 9.90,
    priceLabel: '$9.90',
    periodLabel: '/ month',
    credits: 100,
    cta: 'Deploy Full Pipeline',
    href: '/api/stripe/checkout?tier=pro',
    recommended: true,
  },
}

// Push #276 — remove free card from all surfaces. Only paid plans shown.
export const PLAN_LIST: PlanConfig[] = [PLANS.basic, PLANS.pro]
