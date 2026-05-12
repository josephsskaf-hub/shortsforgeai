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

  // ─── Coming-soon mode ──────────────────────────────────────────────────────
  // Toggled by NEXT_PUBLIC_COMING_SOON=true in Vercel env vars. When on,
  // logged-out visitors are redirected to /coming-soon. Logged-in users,
  // auth pages, API routes, dashboard, and /coming-soon itself stay reachable
  // so the team can still sign in and use the app while the marquee is up.
  const comingSoonOn = process.env.NEXT_PUBLIC_COMING_SOON === 'true'
  if (comingSoonOn && !user) {
    const isAllowed =
      pathname === '/coming-soon' ||
      pathname === '/login' ||
      pathname === '/signup' ||
      pathname === '/forgot-password' ||
      pathname === '/reset-password' ||
      pathname.startsWith('/api/') ||
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/auth/')

    if (!isAllowed) {
      const url = request.nextUrl.clone()
      url.pathname = '/coming-soon'
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

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

  // Don't keep a logged-in user stuck on the coming-soon page — bounce them
  // to the dashboard so they don't accidentally see the marketing splash when
  // they already have access.
  if (user && pathname === '/coming-soon') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
