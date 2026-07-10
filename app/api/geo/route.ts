import { NextRequest, NextResponse } from 'next/server'

// Push #165 — lightweight geo endpoint.
// Reads the Vercel edge header x-vercel-ip-country and returns the
// detected country + the currency we'll use for that user:
//   BR  → brl  (R$49.90 / R$99.90 per month)
//   all others → usd  ($9.90 / $24.90 per month — KINEO-PRICING-V3B-2026-07-10)
export async function GET(req: NextRequest) {
  const country = req.headers.get('x-vercel-ip-country') ?? 'US'
  const currency: 'usd' | 'brl' = country === 'BR' ? 'brl' : 'usd'
  return NextResponse.json({ country, currency })
}
