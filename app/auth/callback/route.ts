import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function safeNext(raw: string | null): string {
  if (!raw) return '/generate'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/generate'
  return raw
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Push #188 — detect new signup vs returning login so the client can
      // fire the Google Ads conversion only on first-time registrations.
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
      const dest = isNewUser ? `${origin}${next}?signup=1` : `${origin}${next}`
      return NextResponse.redirect(dest)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
}
