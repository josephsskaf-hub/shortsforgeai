// Push #353 — Pixabay Video API integration as primary B-roll source.
//
// Pixabay replaces Pexels as the live stock footage provider. Key advantages
// over the old Pexels integration:
//   1. Category filter (nature/places/business/science) tightens results at
//      the API level, reducing lifestyle pollution before it reaches our code.
//   2. Tag-based post-filter rejects lifestyle/portrait clips using the
//      structured tags Pixabay returns — more reliable than Pexels slug inspection.
//   3. Free tier supports 100 req/min, more than enough for the pipeline.
//
// Fallback hierarchy (unchanged from #351):
//   Pixabay HIT  →  use it
//   Pixabay MISS →  FALLBACK-A (cycling, #352) → FALLBACK-B (stockLibrary)
//
// Toggle: set ENABLE_PIXABAY=false to disable and fall straight to FALLBACK-A/B.
// Never throws — all helpers return null/[] on error so the pipeline stays alive.

const PIXABAY_API = 'https://pixabay.com/api/videos/'

// ── Types ──────────────────────────────────────────────────────────────────

interface PixabayResolution {
  url: string
  width: number
  height: number
  size: number
  thumbnail: string
}

interface PixabayVideo {
  id: number
  pageURL: string
  type: string
  /** Comma-separated tags from Pixabay */
  tags: string
  duration: number
  videos: {
    large: PixabayResolution
    medium: PixabayResolution
    small: PixabayResolution
    tiny: PixabayResolution
  }
}

// ── Category inference ─────────────────────────────────────────────────────
// Maps query keywords → Pixabay category param.
// Category narrows Pixabay's index for tighter results; omit for generic queries.

const KEYWORD_TO_CATEGORY: ReadonlyArray<[RegExp, string]> = [
  [/\b(mountain|volcano|glacier|desert|ocean|forest|river|waterfall|landscape|nature|wildlife|animal)\b/i, 'nature'],
  [/\b(city|cities|skyline|street|building|monument|landmark|temple|mosque|cathedral|architecture)\b/i, 'places'],
  [/\b(travel|tourism|country|village|town|destination|explore)\b/i, 'travel'],
  [/\b(money|finance|stock|market|bank|economy|wealth|business|office|corporate|luxury|jet)\b/i, 'business'],
  [/\b(science|history|ancient|medieval|artifact|museum|lab|experiment|space|cosmos|universe)\b/i, 'science'],
]

function inferCategory(query: string): string | undefined {
  for (const [pattern, cat] of KEYWORD_TO_CATEGORY) {
    if (pattern.test(query)) return cat
  }
  return undefined
}

// ── Lifestyle tag filter ───────────────────────────────────────────────────
// Pixabay returns comma-separated tags per video. We reject any clip whose
// tags match lifestyle/portrait vocabulary when the scene doesn't need people.

const LIFESTYLE_TAG_SET = new Set([
  'lifestyle', 'portrait', 'fashion', 'model', 'influencer', 'selfie',
  'dancing', 'dance', 'party', 'celebration', 'fitness', 'yoga', 'gym',
  'workout', 'teenager', 'teen', 'couple', 'romance', 'wedding',
  'street fashion', 'urban lifestyle', 'content creator',
])

function hasLifestylePollution(video: PixabayVideo, sceneNeedsPeople: boolean): boolean {
  if (sceneNeedsPeople) return false
  const tags = video.tags
    .toLowerCase()
    .split(',')
    .map((t) => t.trim())
  return tags.some((t) => LIFESTYLE_TAG_SET.has(t))
}

// ── Positive relevance gate (Push #403 — kill the "cat video") ──────────────
// Pixabay's search can return loosely-related clips, especially after we
// broaden the query (first-3-tokens / no-category). Without a positive check we
// accepted the first non-lifestyle clip even if its tags had NOTHING to do with
// the narration (e.g. a cat clip for an "ocean search" beat). This gate requires
// at least one meaningful query word to appear in the clip's tags; otherwise the
// clip is rejected and the pipeline tries the next query / repeats a relevant
// prior clip instead of showing something off-topic.
const RELEVANCE_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'over', 'under',
  'video', 'footage', 'clip', 'shot', 'scene', 'cinematic', 'closeup', 'close',
  'aerial', 'drone', 'background', 'vertical', 'style',
])

function meaningfulTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !RELEVANCE_STOPWORDS.has(t))
}

function tagsRelevantToQuery(video: PixabayVideo, query: string): boolean {
  const qTokens = meaningfulTokens(query)
  // If the query has no judge-able tokens, don't block (can't assess relevance).
  if (qTokens.length === 0) return true
  const tagBlob = video.tags.toLowerCase()
  // Accept if any meaningful query token appears in the clip's tags. Substring
  // match (not exact token) so "ocean" matches "ocean wave", "plane" matches
  // "airplane", etc.
  return qTokens.some((t) => tagBlob.includes(t))
}

// ── URL picker ─────────────────────────────────────────────────────────────
// Prefer large (1080p+); fall back down. Returns null if no URL exists.

function pickBestUrl(video: PixabayVideo): string | null {
  return (
    video.videos?.large?.url ||
    video.videos?.medium?.url ||
    video.videos?.small?.url ||
    video.videos?.tiny?.url ||
    null
  )
}

// ── Core search ───────────────────────────────────────────────────────────

async function searchPixabay(
  query: string,
  perPage = 5,
  category?: string,
): Promise<PixabayVideo[]> {
  const apiKey = process.env.PIXABAY_API_KEY
  if (!apiKey) {
    console.warn('[pixabay] PIXABAY_API_KEY not set — skipping')
    return []
  }

  let url =
    `${PIXABAY_API}?key=${apiKey}` +
    `&q=${encodeURIComponent(query)}` +
    `&video_type=film` +
    `&orientation=vertical` +
    `&safesearch=true` +
    `&per_page=${perPage}`

  if (category) url += `&category=${encodeURIComponent(category)}`

  let res: Response
  try {
    res = await fetch(url, { cache: 'no-store' })
  } catch (err) {
    console.error('[pixabay] fetch threw:', err instanceof Error ? err.message : String(err))
    return []
  }

  if (!res.ok) {
    console.error(`[pixabay] non-ok status=${res.status} for query="${query}"`)
    return []
  }

  let data: { hits?: PixabayVideo[] }
  try {
    data = (await res.json()) as { hits?: PixabayVideo[] }
  } catch {
    return []
  }

  return data.hits ?? []
}

// ── searchAndFilter ────────────────────────────────────────────────────────
// Runs one Pixabay search, rejects lifestyle-polluted clips, returns first clean URL.

async function searchAndFilter(
  query: string,
  sceneNeedsPeople: boolean,
  category: string | undefined,
  label: string,
): Promise<string | null> {
  const hits = await searchPixabay(query, 7, category)

  for (const video of hits) {
    if (hasLifestylePollution(video, sceneNeedsPeople)) {
      console.log(
        `[pixabay] ${label} rejected id=${video.id} tags="${video.tags.slice(0, 60)}" reason=lifestyle`,
      )
      continue
    }
    // Push #403 — positive relevance gate: the clip's tags must share a word
    // with the query, else it's off-topic ("cat video") → reject.
    if (!tagsRelevantToQuery(video, query)) {
      console.log(
        `[pixabay] ${label} rejected id=${video.id} tags="${video.tags.slice(0, 60)}" reason=irrelevant query="${query.slice(0, 50)}"`,
      )
      continue
    }
    const url = pickBestUrl(video)
    if (url) {
      console.log(
        `[pixabay] ${label} ACCEPTED id=${video.id} tags="${video.tags.slice(0, 60)}" url="${url.slice(0, 60)}"`,
      )
      return url
    }
  }

  return null
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Resolve a Pixabay clip for a single query.
 * Tries: exact query → first-3-tokens broadening → no-category fallback.
 */
export async function getPixabayVideoForExactQuery(
  query: string,
  sceneNeedsPeople = false,
): Promise<string | null> {
  const q = (query ?? '').trim()
  if (!q) return null

  const category = inferCategory(q)

  // 1) Exact query with inferred category
  const direct = await searchAndFilter(q, sceneNeedsPeople, category, 'exact')
  if (direct) return direct

  // 2) First 3 tokens (broadened) — same semantic topic
  const broad = q.split(/\s+/).slice(0, 3).join(' ')
  if (broad.length > 0 && broad !== q) {
    const broadUrl = await searchAndFilter(broad, sceneNeedsPeople, category, 'broad')
    if (broadUrl) return broadUrl
  }

  // 3) Remove category constraint — may have been over-narrowing
  if (category) {
    const noCat = await searchAndFilter(q, sceneNeedsPeople, undefined, 'no_cat')
    if (noCat) return noCat
  }

  console.log(`[pixabay] ALL attempts failed for query="${q.slice(0, 60)}"`)
  return null
}

/**
 * Try a list of queries in order and return the first Pixabay hit.
 * Primary entry point for the generate-video-fast pipeline.
 *
 * @param queries         Ordered queries (most specific first — from BrollPlan).
 * @param sceneNeedsPeople True when the scene's narration/description references people.
 * @param hint            Short narration snippet for log context only.
 */
export async function getPixabayVideoForQueries(
  queries: string[],
  sceneNeedsPeople = false,
  hint?: string,
): Promise<string | null> {
  const cleaned = (queries ?? [])
    .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
    .map((q) => q.trim())

  if (cleaned.length === 0) return null

  const hintLabel = (hint ?? '').slice(0, 50)
  const failed: string[] = []

  for (let i = 0; i < cleaned.length; i++) {
    const q = cleaned[i]
    const url = await getPixabayVideoForExactQuery(q, sceneNeedsPeople)
    if (url) {
      console.log(
        `[pixabay-multi] HIT query[${i + 1}/${cleaned.length}]="${q}"` +
          (failed.length ? ` (after misses: ${failed.slice(0, 3).map((f) => `"${f}"`).join(', ')})` : '') +
          (hintLabel ? ` for="${hintLabel}"` : ''),
      )
      return url
    }
    failed.push(q)
    console.log(`[pixabay-multi] MISS query[${i + 1}/${cleaned.length}]="${q}"`)
  }

  console.log(
    `[pixabay-multi] ALL ${cleaned.length} queries exhausted` +
      (hintLabel ? ` for="${hintLabel}"` : '') +
      ' — caller uses FALLBACK-A/B',
  )
  return null
}
