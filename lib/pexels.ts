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
//
// Push #210 — Space/rocket override: scrub Pexels-incompatible terms.
// Push #211 — stockSearchQuery as primary premium query.
// Push #212 — Verified Visual Asset Whitelist: category-based multi-query
// search with URL slug rejection filtering. Never accept toy rockets,
// cartoon pyramids, or music studios. Fallback hierarchy: exact clip →
// fallback query clip → no result (stockLibrary handles the rest).

import {
  VISUAL_CATEGORIES,
  detectVisualCategory,
  isSlugRejected,
  FIREWORKS_NEGATIVE_TERMS,
  type VisualCategory,
} from './visualAssetCategories'

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
  url: string          // Pexels page URL — slug is used for filtering
  video_files: PexelsVideoFile[]
}

/**
 * Search Pexels Videos for a query.
 * Returns the full PexelsVideo objects so callers can inspect URLs for filtering.
 * Returns [] when PEXELS_API_KEY is missing or the search fails — never throws.
 */
async function searchPexelsVideoObjects(query: string, perPage = 5): Promise<PexelsVideo[]> {
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

  return data.videos ?? []
}

/**
 * Pick the best MP4 file from a PexelsVideo — HD portrait preferred.
 * Returns null if no valid MP4 found.
 */
function pickBestFile(video: PexelsVideo): string | null {
  const files = (video.video_files ?? [])
    .filter((f) => f.file_type === 'video/mp4' && f.quality !== 'hls')
    .slice()
    .sort((a, b) => b.width - a.width)
  if (files.length === 0) return null
  const hd = files.find((f) => f.quality === 'hd') ?? files[0]
  return hd?.link ?? null
}

/**
 * Search Pexels, filter by negative terms via URL slug, return the first
 * acceptable clip URL. Returns null if nothing passes the filter.
 */
async function searchAndFilter(
  query: string,
  category: VisualCategory | null,
  sceneLabel: string,
  extraNegTerms: string[] = [],
): Promise<string | null> {
  const videos = await searchPexelsVideoObjects(query, 5)
  if (videos.length === 0) return null

  for (const video of videos) {
    const pageUrl = video.url ?? ''
    // Push #244 — always reject fireworks/celebration footage globally.
    // Previously FIREWORKS_NEGATIVE_TERMS were only applied to space queries,
    // letting fireworks clips slip through on "New York skyline", "golden hour",
    // "celebration" etc. Apply them as a universal baseline so no query ever
    // returns fireworks regardless of topic.
    const negTerms = [...FIREWORKS_NEGATIVE_TERMS, ...(category?.negativeTerms ?? []), ...extraNegTerms]

    const rejected = pageUrl
      ? isSlugRejected(pageUrl, negTerms, category?.id)
      : false

    if (rejected) {
      const slug = pageUrl.match(/\/video\/([^/]+?)(?:-\d+)?\/?$/)?.[1] ?? pageUrl.slice(-60)
      console.log(`[visual] ${sceneLabel} rejected slug="${slug}" reason=negative_term`)
      continue
    }

    const link = pickBestFile(video)
    if (link) {
      const slug = pageUrl.match(/\/video\/([^/]+?)(?:-\d+)?\/?$/)?.[1] ?? ''
      console.log(`[visual] ${sceneLabel} ACCEPTED slug="${slug}" url="${link.slice(0, 80)}"`)
      return link
    }
  }

  return null
}

// Push #210 — Space/rocket override. Kept for non-category queries as a
// second safety net. Category system is the primary guard.
const SPACE_TRIGGER_WORDS = new Set([
  'rocket', 'launch', 'spacex', 'falcon', 'booster', 'starship', 'nasa',
  'orbit', 'spacecraft', 'astronaut', 'reusable', 'elon', 'musk', 'raptor',
  'merlin', 'pad', 'liftoff', 'reentry', 'exhaust',
])
const SPACE_BANNED_TERMS = [
  'screens', 'engineers', 'mission control', 'monitors', 'control room',
  'people watching', 'team', 'technicians',
]
const SPACE_BOOST_TERM = 'rocket launch fire night'

// Push #243 — slug rejection list for the EXACT-query (verbatim) space path.
// That path searches with category=null, so the global strict terms ('toy',
// 'model', 'cartoon', …) are NOT applied — only FIREWORKS_NEGATIVE_TERMS were.
// A test surfaced a toy-rocket clip (id 7106747) and a desert clip (id 7106862)
// for "rocket launch night sky" / "SpaceX Starship launch closeup" because
// neither slug hit a fireworks term. Reuse the rocket_launch category's full
// negative list (toy/model/candle/fireworks/…) and add the desert terms so a
// sandy landscape can never stand in for a launch.
const SPACE_EXACT_NEGATIVE_TERMS = [
  ...VISUAL_CATEGORIES.rocket_launch.negativeTerms,
  'desert', 'sand', 'dune', 'dunes', 'sahara',
]

// Push #242 — progressive semantic fallbacks for verbatim (exact) queries.
// Pexels has no footage for many over-specific subjects (SpaceX/Starship are
// licensed, so "SpaceX Starship launch closeup" returns 0), and a 3-word
// broadening of the SAME words ("SpaceX Starship launch") still misses. Rather
// than fall straight through to the curated Cloudinary clip (the elephants.mp4
// mismatch), step DOWN to progressively more generic queries within the SAME
// semantic topic so the viewer still sees on-topic footage. The chain is tried
// in order and stops at the first query that returns an accepted clip.
const SEMANTIC_FALLBACK_GROUPS: ReadonlyArray<{ triggers: RegExp; queries: string[] }> = [
  {
    // Rockets / spaceflight — covers "rocket launch night sky" and
    // "SpaceX Starship launch closeup".
    triggers: /\b(rocket|spacex|starship|falcon|booster|liftoff|blast-?off|launch\s*pad)\b/i,
    queries: ['rocket launch', 'space rocket', 'spacecraft', 'space launch'],
  },
  {
    // Spacecraft / orbital hardware (no launch keyword).
    triggers: /\b(spacecraft|satellite|orbit|space\s*station|astronaut|capsule)\b/i,
    queries: ['spacecraft', 'satellite orbit', 'earth from space'],
  },
  {
    // Private jets / aviation — covers "private jets on tarmac sunset".
    // Push #243 — the old chain ('private jet' → 'luxury aircraft' →
    // 'airplane runway' → 'airplane') still missed: Pexels has plenty of plane
    // footage but almost nothing tagged "private jet" / "luxury aircraft" in
    // portrait, so the chain fell through to the curated Cloudinary clip (the
    // elephants.mp4 mismatch). Step DOWN to broad, high-inventory terms Pexels
    // actually has so the viewer still sees on-topic footage:
    //   original → private jet → airplane → airport → flight → travel → …
    triggers: /\b(jet|jets|plane|planes|aircraft|airplane|aeroplane|airliner|tarmac|aviation|cockpit|runway|airport|flight)\b/i,
    queries: [
      'private jet', 'airplane', 'airport', 'flight',
      'plane takeoff', 'aircraft runway', 'travel',
      'luxury travel', 'business travel', 'sky travel',
    ],
  },
]

/**
 * Resolve a single best-match Pexels clip URL for a scene.
 *
 * Push #212 — uses visual category system:
 *   1. Detect category from stockSearchQuery + voiceover
 *   2. Try category's allowedQueries in sequence (filtered by slug)
 *   3. Fall through to stockSearchQuery (filtered)
 *   4. Fall through to searchKeywords (filtered)
 *   5. Fallback queries from category
 *   6. Returns null if nothing passes (stockLibrary handles it)
 */
export async function getPexelsVideoForScene(
  searchKeywords: string,
  fallbackDescription?: string,
  stockSearchQuery?: string,
  voiceoverHint?: string,
): Promise<string | null> {
  const primaryQuery = (stockSearchQuery ?? searchKeywords ?? '').trim()
  const sceneHint = voiceoverHint ?? primaryQuery

  // Detect visual category
  const categoryId = detectVisualCategory(primaryQuery, sceneHint)
  const category = categoryId ? (VISUAL_CATEGORIES[categoryId] ?? null) : null

  console.log(
    `[visual] category="${categoryId ?? 'none'}" primaryQuery="${primaryQuery.slice(0, 60)}"`,
  )

  // ── Step 1: try each allowedQuery from the category (ordered, filtered) ──
  if (category) {
    for (const q of category.allowedQueries) {
      const url = await searchAndFilter(q, category, `cat=${categoryId}`)
      if (url) return url
      console.log(`[visual] cat query MISS: "${q}"`)
    }
  }

  // ── Step 2: try the stockSearchQuery (premium query from gpt-4o) ──
  if (primaryQuery) {
    // Push #210 safety net: scrub bad space terms from the raw query
    let safeQuery = primaryQuery
    const qLower = primaryQuery.toLowerCase()
    const isSpace = Array.from(SPACE_TRIGGER_WORDS).some((w) => qLower.includes(w))
    if (isSpace) {
      let cleaned = primaryQuery
      for (const banned of SPACE_BANNED_TERMS) {
        cleaned = cleaned.replace(new RegExp(banned, 'gi'), '').replace(/\s+/g, ' ').trim()
      }
      if (!cleaned || cleaned.split(/\s+/).filter((w) => w.length > 2).length < 2) {
        cleaned = SPACE_BOOST_TERM
      }
      safeQuery = cleaned
      if (safeQuery !== primaryQuery) {
        console.log(`[visual] space-scrubbed query: "${safeQuery}"`)
      }
    }

    const url = await searchAndFilter(
      safeQuery,
      category,
      'primary',
      isSpace ? FIREWORKS_NEGATIVE_TERMS : [],
    )
    if (url) return url
    console.log(`[visual] primary query MISS: "${safeQuery.slice(0, 60)}"`)
  }

  // ── Step 3: try searchKeywords (legacy fallback) ──
  const kw = (searchKeywords ?? '').trim()
  if (kw && kw !== primaryQuery) {
    const url = await searchAndFilter(kw, category, 'keywords')
    if (url) return url
    console.log(`[visual] keywords MISS: "${kw}"`)
  }

  // ── Step 4: try category fallback queries ──
  if (category && category.allowedQueries.length > 0) {
    // Try broader single-word variants of each allowed query
    const broadFallbacks = [
      category.allowedQueries[0].split(' ').slice(0, 3).join(' '),
      category.allowedQueries[1]?.split(' ').slice(0, 3).join(' ') ?? '',
    ].filter(Boolean)

    for (const q of broadFallbacks) {
      const url = await searchAndFilter(q, category, 'broad_fallback')
      if (url) return url
    }
  }

  // ── Step 5: description-derived keywords as last resort ──
  if (fallbackDescription) {
    const STOP = new Set([
      'a', 'an', 'the', 'this', 'that', 'in', 'on', 'at', 'of', 'is', 'are',
      'with', 'and', 'or', 'to', 'into', 'from', 'by', 'for', 'as', 'its',
      'lone', 'soft', 'golden', 'slow', 'gentle', 'cinematic', 'dramatic',
    ])
    const derived = fallbackDescription
      .replace(/[^a-zA-Z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()))
      .slice(0, 4)
      .join(' ')
      .trim()

    if (derived) {
      const url = await searchAndFilter(derived, category, 'description_derived')
      if (url) return url
      console.log(`[visual] description-derived MISS: "${derived}"`)
    }
  }

  console.log(`[visual] ALL queries exhausted — returning null for fallback`)
  return null
}

/**
 * Push #235 — Resolve a clip URL for an EXACT user-supplied query.
 *
 * When a user writes `[Pexels: SpaceX Starship launch closeup]`, they have
 * already done the work of choosing the perfect footage. This path searches
 * that query DIRECTLY and deliberately skips the category `allowedQueries`
 * override that `getPexelsVideoForScene` applies first — that override is what
 * replaced specific user queries with generic ones like "rocket launch fire
 * night" and surfaced a candle clip. We only fall back to a 3-word broadening
 * of the user's own query, never to a different topic.
 *
 * Returns null when nothing is found so the caller can fall back to the
 * curated stockLibrary.
 */
export async function getPexelsVideoForExactQuery(query: string): Promise<string | null> {
  const q = (query ?? '').replace(/\s{2,}/g, ' ').trim()
  if (!q) return null

  // Push #239 — rocket/space queries pull in fireworks footage (bright sparks
  // on a dark sky). The exact-query path skips the category override, so apply
  // the fireworks rejection list directly when the query is space-related. We
  // recompute this per candidate below so generic rocket fallbacks are guarded too.
  const isSpaceQuery = (s: string): boolean => {
    const lower = s.toLowerCase()
    return lower.includes('space') || Array.from(SPACE_TRIGGER_WORDS).some((w) => lower.includes(w))
  }

  // Single attempt against Pexels, deduped so we never re-search the same query
  // twice as the chain narrows. Returns the accepted clip URL or null.
  const tried = new Set<string>()
  const attempt = async (candidate: string, label: string): Promise<string | null> => {
    const c = candidate.replace(/\s{2,}/g, ' ').trim()
    if (!c