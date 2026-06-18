import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ─── NO cloaking — same content for everyone, including Googlebot ───────────
  // The old "coming soon" gate (NEXT_PUBLIC_COMING_SOON) was removed on
  // 2026-06-18. It used to redirect logged-out visitors — which includes search
  // crawlers — to a /coming-soon splash while logged-in users saw the full app.
  // That divergence could be read as cloaking by Google Ads, so it is gone:
  // every visitor (anonymous, logged-in, or Googlebot) now receives the exact
  // same public site. Do NOT reintroduce any auth/user-agent-based content
  // switching on public marketing routes.

  // /pricing is public — anyone can browse plans.
  // Auth is enforced at the action level (checkout requires sign-in).
  const protectedPaths = ['/history', '/library']
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
