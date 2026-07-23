import { NextRequest, NextResponse } from 'next/server'

// Display-only geo lookup, kept aligned with /api/stripe/checkout:
// BR → BRL, IN → INR, all other countries → USD. Checkout repeats the
// resolution server-side and never trusts a currency supplied by the browser.
export async function GET(req: NextRequest) {
  const country = (req.headers.get('x-vercel-ip-country') ?? 'US').toUpperCase()
  const currency: 'usd' | 'brl' | 'inr' =
    country === 'BR' ? 'brl' : country === 'IN' ? 'inr' : 'usd'

  return NextResponse.json(
    { country, currency },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
  )
}
