// Push #050 — same-origin video proxy.
//
// Why: the in-app <video> player on the Done screen was spinning
// forever even though Download worked. The MP4 is hosted on
// Creatomate's CDN, which returns the file with a Content-Type that
// the browser accepts for download but refuses to feed into a
// <video> element from a different origin (no Access-Control-Allow-
// Origin header on media streams). Loading via a same-origin proxy
// fixes this — the browser sees the bytes coming from our own
// domain, so CORS is irrelevant.
//
// SSRF safety: only URLs whose host matches our allow-list (the two
// CDNs we actually produce) are forwarded. Anything else returns 400
// so this can't be abused as an open proxy.

import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const ALLOWED_HOST_SUFFIXES = [
  'creatomate.com', // Creatomate render CDN (cdn.creatomate.com, etc.)
  'supabase.co',    // Supabase storage public URLs
  'supabase.in',    // Supabase EU region
]

function isAllowed(urlStr: string): boolean {
  try {
    const u = new URL(urlStr)
    if (u.protocol !== 'https:') return false
    return ALLOWED_HOST_SUFFIXES.some(
      (suffix) => u.hostname === suffix || u.hostname.endsWith(`.${suffix}`),
    )
  } catch {
    return false
  }
}

async function handle(req: NextRequest, method: 'GET' | 'HEAD') {
  const target = req.nextUrl.searchParams.get('url')
  if (!target) {
    return NextResponse.json({ error: 'url parameter is required.' }, { status: 400 })
  }
  if (!isAllowed(target)) {
    return NextResponse.json({ error: 'URL not allowed.' }, { status: 400 })
  }

  // Forward the Range header so seek / partial requests still work — the
  // <video> element does range requests during scrubbing.
  const range = req.headers.get('range')
  const upstreamHeaders: Record<string, string> = {}
  if (range) upstreamHeaders.range = range

  let upstream: Response
  try {
    upstream = await fetch(target, {
      method,
      headers: upstreamHeaders,
      cache: 'no-store',
      redirect: 'follow',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[video-proxy] upstream fetch failed:', msg)
    return NextResponse.json({ error: 'Upstream unreachable.' }, { status: 502 })
  }

  // Pass through the useful headers; strip anything that could leak
  // upstream identity (e.g. server, set-cookie).
  const passThrough = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'last-modified',
    'etag',
  ]
  const responseHeaders = new Headers()
  for (const name of passThrough) {
    const value = upstream.headers.get(name)
    if (value) responseHeaders.set(name, value)
  }
  // Be explicit about caching: the underlying CDN already caches; we just
  // want the browser to cache short-term so the <video> element can replay
  // without re-fetching every byte.
  responseHeaders.set('cache-control', 'private, max-age=3600')
  if (!responseHeaders.has('content-type')) {
    responseHeaders.set('content-type', 'video/mp4')
  }

  return new NextResponse(method === 'HEAD' ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export async function GET(req: NextRequest) {
  return handle(req, 'GET')
}

export async function HEAD(req: NextRequest) {
  return handle(req, 'HEAD')
}
