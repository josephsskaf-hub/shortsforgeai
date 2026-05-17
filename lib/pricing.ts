// Push #078 — single source of truth for plan pricing, credits, and Stripe
// payment links. All marketing surfaces (homepage, /pricing, paywall card,
// in-flow upgrade cards) read from this so copy can't drift between pages.
//
// DO NOT change Stripe URLs or pricing values without also updating the
// matching Stripe products. Numbers below mirror what Stripe has on file.

export type PlanTier = 'free' | 'basic' | 'pro'

export interface PlanConfig {
  tier: PlanTier
  name: string
  price: number
  priceLabel: string
  regularPrice?: string
  credits: number
  videoCredits?: number
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
    credits: 2,
    cta: 'Start Free',
    href: '/signup',
  },
  basic: {
    tier: 'basic',
    name: 'Basic',
    price: 4.5,
    priceLabel: '$4.50',
    regularPrice: '$9/month',
    credits: 50,
    videoCredits: 1,
    // Push #104 — Stripe checkout now sets a 7-day trial, so we lead with
    // the trial framing on every paid-tier surface.
    cta: 'Start Free Trial',
    href: 'https://buy.stripe.com/fZu8wP24tePZbareNggjC0n',
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    price: 9.5,
    priceLabel: '$9.50',
    regularPrice: '$19/month',
    credits: 100,
    videoCredits: 1,
    cta: 'Start Free Trial',
    href: 'https://buy.stripe.com/8x214nbF323ddizcF8gjC0o',
    recommended: true,
  },
}

export const PLAN_LIST: PlanConfig[] = [PLANS.free, PLANS.basic, PLANS.pro]
