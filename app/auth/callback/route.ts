import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Activation-first: new users go straight to /generate to make their first
// free Short (3 free credits) — product value BEFORE the paywall. The Google
// Ads registration conversion still fires via ?signup=1 (handled in
// GenerateClient). Returning users go to /generate (or an explicit `next`).
function resolveDestination(rawNext: string | null, isNewUser: boolean): string {
  if (isNewUser) return '/generate'
  if (!rawNext || !rawNext.startsWith('/') || rawNext.startsWith('//')) return '/generate'
  return rawNext
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next')

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Push #188 — detect new signup vs returning login so the client can
      // fire the Google Ads conversion only on first-time registrations.
      // Push #281 — new users are routed to /pricing so they see plans immediately.
      let isNewUser = false
      try {
        const createdAt = data.user?.created_at
        const lastSignIn = data.user?.last_sign_in_at
        if (createdAt && lastSignIn) {
          const diffMs = Math.abs(new Date(lastSignIn).getTime() - new Date(createdAt).getTime())
          isNewUser = diffMs < 10_000 // within 10 s → brand-new account
        }
      } catch {
        /* ignore */
      }
      // KINEO-CHECKOUT-RESUME-2026-07-07 — a NEW user whose `next` points at a
      // checkout endpoint came from a buy click that bounced on auth. Resuming
      // the purchase beats the activation flow (they're about to PAY); every
      // other new user keeps the /generate?signup=1 onboarding.
      const isCheckoutNext =
        !!rawNext &&
        rawNext.startsWith('/') &&
        !rawNext.startsWith('//') &&
        (rawNext.startsWith('/api/stripe/checkout') || rawNext.startsWith('/api/paypal/checkout'))
      const dest = isNewUser
        ? `${origin}${isCheckoutNext ? rawNext : '/generate?signup=1'}`
        : `${origin}${resolveDestination(rawNext, false)}`
      return NextResponse.redirect(dest)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
}
