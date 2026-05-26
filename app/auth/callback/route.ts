import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Push #281 — new users go to /pricing; returning users go to /generate.
// Any explicit `next` query param is honoured for returning users only.
function resolveDestination(rawNext: string | null, isNewUser: boolean): string {
  if (isNewUser) return '/pricing'
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
      const dest = isNewUser
        ? `${origin}/pricing?signup=1`
        : `${origin}${resolveDestination(rawNext, false)}`
      return NextResponse.redirect(dest)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
}
