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

// Push #052 (QA fix B) — Creatomate's render CDN serves the actual MP4
// from Backblaze B2 buckets (host f00X.backblazeb2.com), not from a
// creatomate.com subdomain. The original allow-list rejected every
// real video URL and the proxy returned 400, leaving the player
// spinning. Adding both Backblaze host suffixes here so the proxy can
// stream the file back. Keeping creatomate.com / supabase.* in case
// Creatomate ever migrates the CDN or we host voiceovers via the same
// proxy.
const ALLOWED_HOST_SUFFIXES = [
  'creatomate.com',  // Creatomate's own host (rarely the final video host)
  'backblazeb2.com', // Default Creatomate output bucket (f00X.backblazeb2.com)
  'backblaze.com',   // Other Backblaze hosts
  'supabase.co',     // Supabase storage public URLs (voiceovers, future use)
  'supabase.in',     // Supabase EU region
]

function safeHost(urlStr: string): string {
  try {
    return new URL(urlStr).host
  } catch {
    return 'invalid-url'
  }
}

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
    console.warn('[video-proxy] missing url parameter')
    return NextResponse.json({ error: 'url parameter is required.' }, { status: 400 })
  }
  // Push #052 — surface the requested host in logs so we can spot any
  // new CDN domains that need to be added to the allow-list.
  const host = safeHost(target)
  console.log(`[video-proxy] ${method} target host=${host}`)

  if (!isAllowed(target)) {
    console.warn(`[video-proxy] rejected host=${host} — add it to ALLOWED_HOST_SUFFIXES if it's a legitimate CDN`)
    return NextResponse.json({ error: 'URL not allowed.', host }, { status: 400 })
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
