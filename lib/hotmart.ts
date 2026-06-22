// Hotmart integration (Brazil) — lets the huge Hotmart affiliate pool sell
// ShortsForgeAI credits to "canal dark" creators. Hotmart hosts the checkout
// (BRL, Pix, boleto, card); on an approved purchase it POSTs our webhook and we
// grant credits to the buyer's account (matched by email).
//
// Auth: Hotmart sends a STATIC per-account token in the `X-HOTMART-HOTTOK`
// header (NOT an HMAC of the body). We verify by constant-time string compare
// against process.env.HOTMART_HOTTOK. Set HOTMART_HOTTOK in Vercel from
// Hotmart → Ferramentas → Webhook → Authentication tab.
import crypto from 'crypto'

// Credits granted per BRL amount. Same régua as the Pix packs (R$50 = 90 cr,
// R$90 = 180 cr ≈ 1.8 cr/R$). Unknown amounts fall back to the ratio so any
// offer Joseph creates on Hotmart still credits sensibly.
const KNOWN_PACKS: Record<number, number> = { 50: 90, 90: 180 }

export function creditsForBRL(value: number | null | undefined): number {
  const v = typeof value === 'number' && value > 0 ? value : 0
  if (v === 0) return 0
  const rounded = Math.round(v)
  if (KNOWN_PACKS[rounded]) return KNOWN_PACKS[rounded]
  // Fallback: 1.8 credits per R$, floored to a multiple of 10, min 10.
  return Math.max(10, Math.round((v * 1.8) / 10) * 10)
}

/** Constant-time compare of the incoming hottok header to our stored secret. */
export function verifyHottok(header: string | null): boolean {
  const secret = process.env.HOTMART_HOTTOK
  if (!secret || !header) return false
  const a = Buffer.from(header)
  const b = Buffer.from(secret)
  if (a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

// Events that mean "money received → grant credits".
export const HOTMART_APPROVED_EVENTS = new Set(['PURCHASE_APPROVED', 'PURCHASE_COMPLETE'])
// Events that mean "reverse → revoke" (handled best-effort; logged for now).
export const HOTMART_REVERSED_EVENTS = new Set(['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK', 'PURCHASE_CANCELED'])

export interface HotmartEvent {
  event?: string
  data?: {
    buyer?: { email?: string; name?: string }
    purchase?: {
      transaction?: string
      status?: string
      price?: { value?: number; currency_value?: string }
      offer?: { code?: string }
    }
  }
}
