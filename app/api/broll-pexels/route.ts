import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 30

// ---------------------------------------------------------------------------
// Pexels API types
// ---------------------------------------------------------------------------

interface PexelsVideoFile {
  id: number
  quality: 'sd' | 'hd' | 'hls' | string
  file_type: string
  width: number
  height: number
  link: string
}

interface PexelsVideoPicture {
  id: number
  picture: string
}

interface PexelsVideo {
  id: number
  width: number
  height: number
  duration: number
  video_files: PexelsVideoFile[]
  video_pictures?: PexelsVideoPicture[]
}

interface PexelsVideosResponse {
  videos?: PexelsVideo[]
}

export interface PexelsClip {
  id: number
  url: string
  thumbnail: string
  duration: number
  width: number
  height: number
  quality: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Pick the best portrait MP4 file from a Pexels video.
 * Mirrors the selection logic used in /api/stock for consistency.
 *   - must be video/mp4 (no HLS)
 *   - true portrait (height > width)
 *   - 720 ≤ height ≤ 1920
 *   - https link only
 */
function pickFile(video: PexelsVideo): PexelsVideoFile | null {
  const usable = video.video_files.filter(
    (f) =>
      f.file_type === 'video/mp4' &&
      f.quality !== 'hls' &&
      f.height > f.width &&
      f.height >= 720 &&
      f.height <= 1920 &&
      typeof f.link === 'string' &&
      f.link.startsWith('https://'),
  )
  if (usable.length === 0) return null
  // Prefer closest to 1920 height, then largest
  return usable.sort((a, b) => {
    const aDist = Math.abs(a.height - 1920)
    const bDist = Math.abs(b.height - 1920)
    if (aDist !== bDist) return aDist - bDist
    return b.height - a.height
  })[0] ?? null
}

/**
 * Fetch portrait video clips from Pexels for a given search query.
 * Returns an empty array on error — never throws.
 */
async function fetchPexelsClips(
  query: string,
  apiKey: string,
  count: number,
): Promise<PexelsClip[]> {
  const perPage = Math.max(1, Math.min(20, count * 3)) // fetch extra to allow filtering
  const url = new URL('https://api.pexels.com/videos/search')
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', String(perPage))
  url.searchParams.set('orientation', 'portrait')
  url.searchParams.set('size', 'large')
  url.searchParams.set('min_duration', '3')

  console.log(`[broll-pexels] querying Pexels: "${query}" (want ${count} clips)`)

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: apiKey },
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error(`[broll-pexels] Pexels non-ok status=${res.status} for query="${query}"`)
      return []
    }

    const data = (await res.json()) as PexelsVideosResponse
    const videos = data.videos ?? []
    const clips: PexelsClip[] = []

    for (const v of videos) {
      const file = pickFile(v)
      if (!file) continue
      clips.push({
        id: v.id,
        url: file.link,
        thumbnail: v.video_pictures?.[0]?.picture ?? '',
        duration: v.duration,
        width: file.width,
        height: file.height,
        quality: file.quality,
      })
      if (clips.length >= count) break
    }

    return clips
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[broll-pexels] fetch error for query="${query}":`, msg)
    return []
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * POST /api/broll-pexels
 *
 * Body: { pexelsQuery: string, count?: number }
 *
 * Uses the `pexelsQuery` field from a BrollScene directly (not the old
 * multi-keyword fallback approach). Returns an array of PexelsClip objects.
 *
 * Requires authentication and PEXELS_API_KEY env variable.
 */
export async function POST(req: NextRequest) {
  try {
    const pexelsApiKey = process.env.PEXELS_API_KEY
    if (!pexelsApiKey) {
      console.error('[broll-pexels] PEXELS_API_KEY is not configured')
      return NextResponse.json({ error: 'Stock footage service is not configured.' }, { status: 500 })
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: { pexelsQuery?: unknown; count?: unknown }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const pexelsQuery =
      typeof body.pexelsQuery === 'string' ? body.pexelsQuery.trim() : ''
    if (!pexelsQuery) {
      return NextResponse.json({ error: 'pexelsQuery is required.' }, { status: 400 })
    }

    const count =
      typeof body.count === 'number' && body.count > 0
        ? Math.min(body.count, 10)
        : 4

    const clips = await fetchPexelsClips(pexelsQuery, pexelsApiKey, count)

    return NextResponse.json({ clips, query: pexelsQuery, count: clips.length })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[broll-pexels] unexpected error:', msg)
    return NextResponse.json({ error: 'Failed to fetch stock footage. Please try again.' }, { status: 500 })
  }
}
