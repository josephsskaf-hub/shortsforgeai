// Push #175 — single source of truth for plan pricing.
// Basic = $9.90/month  (50 Fast Mode videos)
// Pro   = $19.90/month (100 Fast Mode videos + 1 Cinematic/month)
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
    credits: 2,
    cta: 'Run Free',
    href: '/signup',
  },
  basic: {
    tier: 'basic',
    name: 'Basic',
    price: 9.90,
    priceLabel: '$9.90',
    periodLabel: '/ month',
    credits: 50,
    cta: 'Automate Now',
    href: '/api/stripe/checkout?tier=basic',
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    price: 19.90,
    priceLabel: '$19.90',
    periodLabel: '/ month',
    credits: 100,
    cta: 'Deploy Full Pipeline',
    href: '/api/stripe/checkout?tier=pro',
    recommended: true,
  },
}

export const PLAN_LIST: PlanConfig[] = [PLANS.free, PLANS.basic, PLANS.pro]
