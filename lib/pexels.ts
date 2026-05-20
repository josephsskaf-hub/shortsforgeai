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
 * A resolved Pexels clip: the hotlink-friendly MP4 URL plus the clip's real
 * playback duration in seconds (from the Pexels API). `duration` is 0 only
 * when the API omits it — callers treat 0 as "unknown".
 */
export interface PexelsClip {
  url: string
  duration: number
}

/**
 * Search Pexels Videos for a query and return up to `perPage` portrait MP4
 * clips (URL + real duration), HD preferred. Returns an empty array when
 * PEXELS_API_KEY is missing or the search fails — never throws.
 */
export async function searchPexelsVideosWithDuration(query: string, perPage = 3): Promise<PexelsClip[]> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return []

  const url = `${PEXELS_API}/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=portrait&size=medium`
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

  const out: PexelsClip[] = []
  for (const v of data.videos ?? []) {
    const files = (v.video_files ?? [])
      .filter((f) => f.file_type === 'video/mp4' && f.quality !== 'hls')
      .slice()
      .sort((a, b) => b.width - a.width)
    if (files.length === 0) continue
    const hd = files.find((f) => f.quality === 'hd') ?? files[0]
    if (hd?.link) {
      out.push({ url: hd.link, duration: typeof v.duration === 'number' && v.duration > 0 ? v.duration : 0 })
    }
  }
  return out
}

/**
 * Backward-compatible URL-only search. Thin wrapper over
 * `searchPexelsVideosWithDuration` for callers that don't need durations
 * (e.g. the showcase-clips route).
 */
export async function searchPexelsVideos(query: string, perPage = 3): Promise<string[]> {
  const clips = await searchPexelsVideosWithDuration(query, perPage)
  return clips.map((c) => c.url)
}

/**
 * Build the Pexels search query for a scene.
 *
 * Push #128 — prefers explicit `searchKeywords` (topic-specific, e.g.
 * "pyramid egypt desert") so Pexels gets the actual subject matter instead
 * of the first 3 words of a cinematic Runway description. Falls back to
 * stopword-filtered extraction from the description if keywords are empty.
 * Returns '' when nothing usable can be derived.
 */
function buildSceneQuery(searchKeywords: string, fallbackDescription?: string): string {
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

  return query
}

/**
 * Resolve a single best-match Pexels clip (URL + real duration) for a scene.
 * Push #160 — the duration travels with the URL so the compose pipeline can
 * tile clips to their true length instead of assuming a fixed 10s.
 */
export async function getPexelsClipForScene(
  searchKeywords: string,
  fallbackDescription?: string,
): Promise<PexelsClip | null> {
  const query = buildSceneQuery(searchKeywords, fallbackDescription)
  if (!query) return null

  const clips = await searchPexelsVideosWithDuration(query, 1)
  return clips[0] ?? null
}

/**
 * Backward-compatible URL-only scene resolver. Thin wrapper over
 * `getPexelsClipForScene`.
 */
export async function getPexelsVideoForScene(
  searchKeywords: string,
  fallbackDescription?: string,
): Promise<string | null> {
  const clip = await getPexelsClipForScene(searchKeywords, fallbackDescription)
  return clip?.url ?? null
}
