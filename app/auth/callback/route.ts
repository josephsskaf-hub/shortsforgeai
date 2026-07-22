import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveAuthRedirect } from '@/lib/authRedirect'
import { writeServerEvent } from '@/lib/serverEvents'

// Activation-first: new users go straight to /generate to make their first
// free Short (up to 3 watermarked Fast previews / 24h) — product value BEFORE
// the paywall. The Google
// Ads registration conversion still fires via ?signup=1 (handled in
// GenerateClient). Returning users go to /generate (or an explicit `next`).
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
      const safeNext = resolveAuthRedirect(rawNext)
      const isCheckoutNext =
        safeNext.startsWith('/api/stripe/checkout') || safeNext.startsWith('/api/paypal/checkout')
      let destinationPath = safeNext
      if (isNewUser && !isCheckoutNext) {
        // KINEO-RECOVERY-2026-07-15 — keep the exact homepage idea through a
        // brand-new Google/Apple OAuth account. The old branch discarded every
        // non-checkout `next`, turning a high-intent prompt into a blank screen.
        const destination = new URL(safeNext, origin)
        destination.searchParams.set('signup', '1')
        destinationPath = `${destination.pathname}${destination.search}`
      }
      const destinationUrl = new URL(destinationPath, origin)
      const rawIntentCampaign = (destinationUrl.searchParams.get('intent_campaign') ?? '').trim()
      const intentCampaign = /^[A-Za-z0-9._~-]{1,100}$/.test(rawIntentCampaign)
        ? rawIntentCampaign
        : null
      // PUSH #21 — client events can disappear when a user closes the tab
      // during the OAuth return. Persist the completed callback before the
      // redirect so signup -> destination is now an authoritative server fact.
      await writeServerEvent({
        name: 'auth_callback_completed',
        userId: data.user?.id ?? null,
        path: '/auth/callback',
        metadata: {
          is_new_user: isNewUser,
          is_checkout_destination: isCheckoutNext,
          destination_path: destinationUrl.pathname.slice(0, 128),
          has_prompt: destinationUrl.searchParams.has('prompt'),
          intent_campaign: intentCampaign,
          provider: typeof data.user?.app_metadata?.provider === 'string'
            ? data.user.app_metadata.provider.slice(0, 32)
            : 'unknown',
        },
      })
      const dest = `${origin}${destinationPath}`
      return NextResponse.redirect(dest)
    }
  }

  // Store no OAuth code or error detail. This only proves that the callback
  // failed to establish a session, which is enough to diagnose the broken hop.
  await writeServerEvent({
    name: 'auth_callback_failed',
    path: '/auth/callback',
    metadata: { had_code: Boolean(code) },
  })

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
}
