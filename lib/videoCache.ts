// lib/videoCache.ts — Push #216
//
// Problem: Pexels CDN (videos.pexels.com) blocks cloud-provider IPs used by
// Creatomate's rendering infrastructure. Giving Creatomate a raw Pexels URL
// always results in HTTP 403. The Pexels API key does not help because Creatomate
// fetches the video file without any auth header.
//
// Solution: Our Vercel server can download from Pexels server-side (authorized
// API user). We upload the file to Supabase Storage (public bucket). We give
// Creatomate the Supabase URL instead — always accessible, no 403.
//
// Cache key: stable hash derived from the Pexels video file URL.
// On cache HIT: returns the Supabase URL immediately (fast path).
// On any failure: returns the original URL (graceful degradation).
//
// Setup required:
//   1. Supabase Storage → create bucket "stock-videos" (Public = true)
//   2. Add SUPABASE_SERVICE_ROLE_KEY to Vercel env vars (Settings → API → service_role)

import { createClient } from '@supabase/supabase-js'

const BUCKET = 'stock-videos'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.log('[videoCache] Supabase env vars not configured')
    return null
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

/** Stable cache key from a Pexels video file URL. */
function urlToCacheKey(url: string): string {
  // Use the filename portion: "2098405-hd_1280_720_25fps.mp4"
  const match = url.match(/\/(\d+[-_][^/?#]+\.mp4)/)
  if (match) return `pexels/${match[1]}`
  // Fallback: last 40 chars of URL
  return `pexels/${url.slice(-40).replace(/[^a-z0-9._-]/gi, '_')}`
}

/**
 * Ensures a Pexels video URL is accessible by Creatomate.
 *
 * - If the URL is not from Pexels (e.g. Cloudinary), returns it unchanged.
 * - Downloads the video from Pexels server-side (our Vercel → Pexels is allowed).
 * - Uploads to Supabase Storage and returns a public Supabase URL.
 * - On any error, returns `fallbackUrl` if provided, else the original URL.
 *
 * @param pexelsUrl   The video URL from the Pexels API
 * @param fallbackUrl Cloudinary/archive.org URL to use if caching fails
 */
export async function ensureAccessibleUrl(
  pexelsUrl: string,
  fallbackUrl?: string,
): Promise<string> {
  // Non-Pexels URLs (Cloudinary demo, archive.org) are already accessible.
  if (!pexelsUrl || !pexelsUrl.includes('pexels.com')) {
    return pexelsUrl
  }

  const supabase = getServiceClient()
  if (!supabase) {
    // No Supabase → can't cache → return fallback (Cloudinary) or original
    console.log('[videoCache] No Supabase client — returning fallback')
    return fallbackUrl ?? pexelsUrl
  }

  const cacheKey = urlToCacheKey(pexelsUrl)
  const { data: pubData } = supabase.storage.from(BUCKET).getPublicUrl(cacheKey)
  const publicUrl = pubData.publicUrl

  // Fast path: check if already cached in Supabase
  try {
    const check = await fetch(publicUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    })
    if (check.ok) {
      console.log(`[videoCache] HIT cacheKey=${cacheKey}`)
      return publicUrl
    }
  } catch {
    // Not cached yet — fall through to download
  }

  // Download from Pexels server-side (our server → authorized API user)
  const apiKey = process.env.PEXELS_API_KEY
  let videoBuffer: ArrayBuffer
  try {
    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (compatible; ShortsForge/1.0; +https://shortsforgeai.vercel.app)',
    }
    if (apiKey) headers['Authorization'] = apiKey

    const res = await fetch(pexelsUrl, {
      headers,
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      console.log(`[videoCache] Pexels download failed: HTTP ${res.status} for ${pexelsUrl.slice(0, 80)}`)
      return fallbackUrl ?? pexelsUrl
    }

    videoBuffer = await res.arrayBuffer()
    console.log(`[videoCache] downloaded ${videoBuffer.byteLength} bytes from Pexels`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`[videoCache] download error: ${msg}`)
    return fallbackUrl ?? pexelsUrl
  }

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(cacheKey, videoBuffer, {
      contentType: 'video/mp4',
      upsert: true,
    })

  if (uploadError) {
    console.log(`[videoCache] Supabase upload failed: ${uploadError.message}`)
    return fallbackUrl ?? pexelsUrl
  }

  console.log(`[videoCache] CACHED → ${publicUrl}`)
  return publicUrl
}
