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
 * Push #128 — `searchKeywords` is now the primary input: the AI scene
 * generator returns an explicit 2-4 word subject phrase that matches the
 * user's topic (e.g., "pyramids egypt"), separate from the cinematic
 * description ("A lone photographer crouches…"). Searching Pexels with
 * the latter was producing wildly wrong footage (photographer instead of
 * pyramid), which is the bug this signature change fixes.
 *
 * `fallbackDescription` keeps backward compatibility: when keywords are
 * absent or empty (older callers, missing GPT field), we fall back to the
 * legacy 3-word extraction over the description so the function still
 * returns something rather than null.
 */
export async function getPexelsVideoForScene(
  searchKeywords: string | null | undefined,
  fallbackDescription?: string
): Promise<string | null> {
  const cleanedExplicit = (searchKeywords ?? '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(' ')
    .trim()

  const fallback = (fallbackDescription ?? '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(' ')
    .trim()

  const keywords = cleanedExplicit || fallback
  if (!keywords) return null

  const urls = await searchPexelsVideos(keywords, 1)
  return urls[0] ?? null
}
