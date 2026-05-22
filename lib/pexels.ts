// Push #084 — Pexels stock footage helper for the Fast Mode video pipeline.
//
// Fast Mode skips Runway entirely and assembles videos out of licensed
// Pexels clips + OpenAI TTS, keeping the unit cost at ~$0.01-0.05 per
// generation. The richer, slower Runway path stays available as Cinematic
// Mode (see /api/generate-video).
//
// All helpers fail soft: a missing PEXELS_API_KEY or a network error
// returns null/[] rather than throwing, so the caller can fall back to the
// curated stock library in `lib/stockLibrary.ts` and the user still gets a
// video.

const PEXELS_API = 'https://api.pexels.com/videos'

interface PexelsVideoFile {
  link: string
  quality: 'sd' | 'hd' | 'hls' | string
  width: number
  height: number
  file_type: string
}

interface PexelsVideo {
  id: number
  width: number
  height: number
  duration: number
  video_files: PexelsVideoFile[]
}

/**
 * Search Pexels Videos for a query and return up to `perPage` portrait MP4
 * URLs, HD preferred. Returns an empty array when PEXELS_API_KEY is missing
 * or the search fails — never throws.
 */
export async function searchPexelsVideos(query: string, perPage = 3): Promise<string[]> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return []

  const url = `${PEXELS_API}/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=portrait&size=large`
  let res: Response
  try {
    res = await fetch(url, {
      headers: { Authorization: apiKey },
      cache: 'no-store',
    })
  } catch (err) {
    console.error('[pexels] fetch threw:', err instanceof Error ? err.message : String(err))
    return []
  }
  if (!res.ok) {
    console.error(`[pexels] non-ok status=${res.status} for query="${query}"`)
    return []
  }

  let data: { videos?: PexelsVideo[] }
  try {
    data = (await res.json()) as { videos?: PexelsVideo[] }
  } catch {
    return []
  }

  const out: string[] = []
  for (const v of data.videos ?? []) {
    const files = (v.video_files ?? [])
      .filter((f) => f.file_type === 'video/mp4' && f.quality !== 'hls')
      .slice()
      .sort((a, b) => b.width - a.width)
    if (files.length === 0) continue
    const hd = files.find((f) => f.quality === 'hd') ?? files[0]
    if (hd?.link) out.push(hd.link)
  }
  return out
}

/**
 * Resolve a single best-match Pexels clip URL for a scene.
 *
 * Push #128 — accepts explicit `searchKeywords` (topic-specific, e.g.
 * "pyramid egypt desert") so Pexels gets the actual subject matter instead
 * of the first 3 words of a cinematic Runway description. Falls back to
 * stopword-filtered extraction from the description if keywords are empty.
 */
export async function getPexelsVideoForScene(
  searchKeywords: string,
  fallbackDescription?: string,
): Promise<string | null> {
  // Use the explicit topic keywords first
  let query = (searchKeywords ?? '').replace(/[^a-zA-Z0-9 ]/g, ' ').trim()

  // If no explicit keywords, fall back to extracting meaningful words from
  // the description — but skip leading stopwords ("a", "the", "lone", etc.)
  // so we don't search for "A lone photographer" on a pyramid video.
  if (!query && fallbackDescription) {
    const STOP = new Set([
      'a', 'an', 'the', 'this', 'that', 'in', 'on', 'at', 'of', 'is', 'are',
      'with', 'and', 'or', 'to', 'into', 'from', 'by', 'for', 'as', 'its',
      'lone', 'soft', 'golden', 'slow', 'gentle', 'cinematic', 'dramatic',
    ])
    query = (fallbackDescription)
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()))
      .slice(0, 3)
      .join(' ')
      .trim()
  }

  if (!query) return null

  const urls = await searchPexelsVideos(query, 1)
  return urls[0] ?? null
}
