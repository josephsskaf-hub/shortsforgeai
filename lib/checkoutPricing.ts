export type CheckoutTier = 'starter' | 'basic' | 'pro'
export type CheckoutIntroTier = 'starter' | 'basic'
export type CheckoutCurrency = 'usd' | 'brl' | 'inr'

// Single price source for the server-authoritative Stripe route and every
// checkout-facing display. Amounts are in cents, centavos, or paise.
export const TIER_PRICES: Record<CheckoutTier, Record<CheckoutCurrency, number>> = {
  starter: { usd: 990, brl: 4990, inr: 79900 },
  basic: { usd: 2490, brl: 9990, inr: 159900 },
  pro: { usd: 3790, brl: 18990, inr: 299900 },
}

export const ANNUAL_PRICES: Record<CheckoutTier, Record<CheckoutCurrency, number>> = {
  starter: { usd: 9900, brl: 49900, inr: 799000 },
  basic: { usd: 19900, brl: 99900, inr: 1599000 },
  pro: { usd: 37900, brl: 189900, inr: 2999000 },
}

export const INTRO_PRICES: Record<CheckoutIntroTier, Record<CheckoutCurrency, number>> = {
  starter: { usd: 490, brl: 2490, inr: 39900 },
  basic: { usd: 990, brl: 4990, inr: 79900 },
}

export const CURRENCY_DISPLAY: Record<CheckoutCurrency, {
  locale: string
  currencyCode: string
  label: string
}> = {
  usd: { locale: 'en-US', currencyCode: 'USD', label: 'USD' },
  brl: { locale: 'pt-BR', currencyCode: 'BRL', label: 'BRL' },
  inr: { locale: 'en-IN', currencyCode: 'INR', label: 'INR' },
}

export function resolveCheckoutCurrency(country: string | null | undefined): CheckoutCurrency {
  const normalized = String(country || '').toUpperCase()
  return normalized === 'BR' ? 'brl' : normalized === 'IN' ? 'inr' : 'usd'
}

export function formatCheckoutMoney(currency: CheckoutCurrency, amountMinor: number): string {
  const config = CURRENCY_DISPLAY[currency]
  const fractionDigits = currency === 'inr' ? 0 : 2
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currencyCode,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amountMinor / 100).replace(/\u00a0/g, ' ')
}
