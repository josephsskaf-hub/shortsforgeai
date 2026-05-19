import { NextRequest, NextResponse } from 'next/server'

// Push #165 — lightweight geo endpoint.
// Reads the Vercel edge header x-vercel-ip-country and returns the
// detected country + the currency we'll use for that user:
//   BR  → brl  (R$9 / R$19 per month)
//   all others → usd  ($4.90 / $9.90 per month)
export async function GET(req: NextRequest) {
  const country = req.headers.get('x-vercel-ip-country') ?? 'US'
  const currency: 'usd' | 'brl' = country === 'BR' ? 'brl' : 'usd'
  return NextResponse.json({ country, currency })
}
