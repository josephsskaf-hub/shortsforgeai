import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const LEGACY_PUBLIC_HOSTS = new Set([
  'shortsforgeai.com',
  'www.shortsforgeai.com',
  'shortsforgeai.vercel.app',
])

export async function middleware(request: NextRequest) {
  // Keep one permanent public origin. The production Vercel hostname was
  // serving a full 200 copy of every page, while the former brand domains
  // were configured as temporary redirects. This application-level 308
  // consolidates any legacy host request that reaches Next.js and preserves
  // the original path and query string.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const rawHost = (forwardedHost ?? request.headers.get('host') ?? '')
    .split(',')[0]
    .trim()
    .toLowerCase()
  const hostname = rawHost.split(':')[0]

  if (LEGACY_PUBLIC_HOSTS.has(hostname)) {
    const canonicalUrl = request.nextUrl.clone()
    canonicalUrl.protocol = 'https:'
    canonicalUrl.host = 'www.usekineo.com'
    return NextResponse.redirect(canonicalUrl, 308)
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
