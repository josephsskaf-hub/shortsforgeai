// Paddle Billing config + helpers. SANDBOX-first; flip env vars to go live.
// Set in Vercel: NEXT_PUBLIC_PADDLE_ENV (sandbox|production),
// NEXT_PUBLIC_PADDLE_CLIENT_TOKEN, NEXT_PUBLIC_PADDLE_PRICE_{SPARK,BASIC,PRO},
// and server-only: PADDLE_WEBHOOK_SECRET, PADDLE_API_KEY.
import crypto from 'crypto'

export type Tier = 'starter' | 'basic' | 'pro'

const SPARK = process.env.NEXT_PUBLIC_PADDLE_PRICE_SPARK ?? ''
const BASIC = process.env.NEXT_PUBLIC_PADDLE_PRICE_BASIC ?? ''
const PRO = process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO ?? ''

export function tierForPrice(priceId: string | null | undefined): Tier | null {
  if (!priceId) return null
  if (priceId === SPARK) return 'starter'
  if (priceId === BASIC) return 'basic'
  if (priceId === PRO) return 'pro'
  return null
}

export function priceIdForTier(tier: Tier): string {
  return tier === 'starter' ? SPARK : tier === 'basic' ? BASIC : PRO
}

// Mirrors the Stripe tier->credits mapping already used in the app.
export function creditsForTier(tier: Tier): number {
  return tier === 'pro' ? 100 : tier === 'starter' ? 15 : 50
}
export function cinematicTokensForTier(tier: Tier): number {
  return tier === 'pro' ? 1 : 0
}

// Verify Paddle Billing webhook signature.
// Header "Paddle-Signature: ts=<unix>;h1=<hmac>" — HMAC-SHA256 over
// `${ts}:${rawBody}` keyed with the destination's webhook secret.
export function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false
  const parts: Record<string, string> = {}
  for (const kv of signatureHeader.split(';')) {
    const [k, v] = kv.split('=')
    if (k && v) parts[k.trim()] = v.trim()
  }
  if (!parts.ts || !parts.h1) return false
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${parts.ts}:${rawBody}`)
    .digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.h1))
  } catch {
    return false
  }
}
