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
  // Push #437 — generic lifestyle clips that leaked into a finance video.
  'couch', 'sofa', 'walking', 'pedestrian', 'casual', 'relaxing', 'vlog', 'vlogger',
])

// Push #437 — HARD lifestyle tags: rejected for EVERY scene, even ones that do
// reference a person. "Mark Cuban lived like a broke student" should never pull
// a kid doing homework in a classroom. These are never the right subject for a
// billionaire / money / mystery / facts channel.
const HARD_LIFESTYLE_TAGS = new Set([
  'homework', 'classroom', 'school', 'student', 'students', 'pupil',
  'child', 'children', 'kid', 'kids', 'baby', 'toddler', 'kindergarten',
])

// Push #451 — HARD off-topic / kitsch blacklist. Pixabay surfaces these for
// money/wealth/fortune queries (the recurring "lucky cat" / maneki-neko that
// ruined money videos), plus generic non-photoreal junk. NONE of these fit a
// finance / geography / mystery / learning channel, so they're rejected for
// EVERY scene — even when the clip ALSO carries a 'money' tag.
const HARD_OFFTOPIC_TAGS = new Set([
  'cat', 'kitten', 'kitty', 'figurine', 'ornament', 'talisman', 'amulet',
  'trinket', 'doll', 'toy', 'plastic', 'clipart', 'cartoon', 'illustration',
  'animation', 'animated', 'vector', 'graphic', 'render', 'drawing', 'emoji',
])
// Multi-word kitsch that appears as a single Pixabay tag (Set exact-match misses these).
const HARD_OFFTOPIC_SUBSTRINGS = ['maneki', 'feng shui', 'lucky cat', 'fortune cat', '3d render']

function hasLifestylePollution(video: PixabayVideo, sceneNeedsPeople: boolean): boolean {
  const tags = video.tags
    .toLowerCase()
    .split(',')
    .map((t) => t.trim())
  // Push #451 — kitsch / off-topic offenders are ALWAYS rejected (lucky cat etc.).
  if (tags.some((t) => HARD_OFFTOPIC_TAGS.has(t))) return true
  const blob = video.tags.toLowerCase()
  if (HARD_OFFTOPIC_SUBSTRINGS.some((s) => blob.includes(s))) return true
  // Hard offenders are always rejected.
  if (tags.some((t) => HARD_LIFESTYLE_TAGS.has(t))) return true
  // Soft lifestyle tags only matter when the scene isn't about people.
  if (sceneNeedsPeople) return false
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

  // Push #438 — DROP the hard orientation=vertical filter. It was starving the
  // results: most premium stock (stock-market charts, bank vaults, Wall Street,
  // gold) is shot HORIZONTAL, so a vertical-only search MISSED ~90% of the good
  // footage → the pipeline fell back to the same clip over and over (the "same
  // guy held for 35 seconds" bug) and to generic/off-topic clips. Compose renders
  // every clip with fit:'cover' (center-crop to 9:16), so landscape footage looks
  // great vertical. Searching ALL orientations multiplies the on-topic hit rate.
  let url =
    `${PIXABAY_API}?key=${apiKey}` +
    `&q=${encodeURIComponent(query)}` +
    `&video_type=film` +
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
  exclude?: Set<string>,
): Promise<string | null> {
  const hits = await searchPixabay(query, 7, category)

  let landscapeFallback: string | null = null
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
    // Dedup (12/06): never hand back a clip another scene already used — this
    // is what made the same Dubai aerial carry 4+ scenes of one video.
    if (url && exclude?.has(url)) {
      console.log(`[pixabay] ${label} rejected id=${video.id} reason=already_used_in_video`)
      continue
    }
    if (url) {
      console.log(
        `[pixabay] ${label} ACCEPTED id=${video.id} tags="${video.tags.slice(0, 60)}" url="${url.slice(0, 60)}"`,
      )
      const rez = video.videos?.large
      if (rez && rez.height >= rez.width) return url
      if (!landscapeFallback) landscapeFallback = url
    }
  }

  return landscapeFallback
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Resolve a Pixabay clip for a single query.
 * Tries: exact query → first-3-tokens broadening → no-category fallback.
 */
export async function getPixabayVideoForExactQuery(
  query: string,
  sceneNeedsPeople = false,
  exclude?: Set<string>,
): Promise<string | null> {
  const q = (query ?? '').trim()
  if (!q) return null

  const category = inferCategory(q)

  // 1) Exact query with inferred category
  const direct = await searchAndFilter(q, sceneNeedsPeople, category, 'exact', exclude)
  if (direct) return direct

  // 2) First 3 tokens (broadened) — same semantic topic
  const broad = q.split(/\s+/).slice(0, 3).join(' ')
  if (broad.length > 0 && broad !== q) {
    const broadUrl = await searchAndFilter(broad, sceneNeedsPeople, category, 'broad', exclude)
    if (broadUrl) return broadUrl
  }

  // 2b) First 2 tokens — last semantic broadening before giving up (helps
  // 4-word hand-picked queries like "man reading book penthouse" → "man reading").
  const broad2 = q.split(/\s+/).slice(0, 2).join(' ')
  if (broad2.length > 0 && broad2 !== broad && broad2 !== q) {
    const broad2Url = await searchAndFilter(broad2, sceneNeedsPeople, category, 'broad2', exclude)
    if (broad2Url) return broad2Url
  }

  // 3) Remove category constraint — may have been over-narrowing
  if (category) {
    const noCat = await searchAndFilter(q, sceneNeedsPeople, undefined, 'no_cat', exclude)
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
// Push #437 — CONCEPT → CONCRETE VISUAL MAP (ported to the REAL B-roll source).
// Abstract finance/wealth narration has no literal stock footage, so the search
// fell to random lifestyle clips (kid doing homework) or the library (fish!).
// This maps each abstract concept to concrete, FILMABLE, cinematic queries that
// Pixabay has real inventory for, tried FIRST so a scene about "assets" shows a
// rising market chart, not a kid studying.
const CONCEPT_VISUAL_MAP: ReadonlyArray<{ test: RegExp; queries: string[] }> = [
  { test: /\b(asset|assets|invest|investing|investment|portfolio|stocks?|shares|equit)/i,
    queries: ['stock market chart', 'trading floor', 'financial graph'] },
  { test: /\b(luxur|mansion|penthouse|yacht|supercar|opulent|dubai|skyline|city)/i,
    // #450b — Joseph: add aspirational luxury cities (Dubai etc.) — Pixabay has
    // deep inventory of Dubai/skyline/skyscraper aerials, great for wealth-mindset vibe.
    queries: ['Dubai skyline aerial', 'luxury city skyline night', 'penthouse city view night', 'luxury mansion', 'supercar'] },
  { test: /\b(wealth|wealthy|rich|fortune|billionaire|millionaire|affluent)/i,
    // (12/06) LUXURY-first, aligned with the wealth aesthetic pack: Joseph's
    // audience-tested verdict is that coins/cash closeups read as cheap clichés
    // in billionaire content ("nao teve jatinho... moeda ficou ruim"). Cash is
    // kept only as the last-resort tail.
    queries: ['private jet', 'Dubai skyline aerial', 'luxury city skyline night', 'luxury mansion', 'penthouse city view night', 'dollar bills cash'] },
  { test: /\b(debt|loan|loans|borrow|borrowing|mortgage|credit|lending|leverage)/i,
    queries: ['bank building', 'bank vault', 'counting money'] },
  { test: /\b(save|saving|savings|budget|frugal)/i,
    queries: ['coins stacking', 'savings jar coins', 'piggy bank'] },
  { test: /\b(bank|banking|vault)/i,
    queries: ['bank vault', 'gold bars', 'bank building'] },
  { test: /\b(tax|taxes|irs)/i,
    queries: ['financial documents', 'calculator money', 'paperwork desk'] },
  { test: /\b(automat|payday|paycheck|salary|income|deposit)/i,
    queries: ['mobile banking app', 'online payment phone', 'money transfer'] },
  { test: /\b(retire|retirement|401k|401\(k\)|pension|nest egg|ira|fund|funds)/i,
    // #451 — "401k / the retirement" was hitting a lucky cat; anchor it on real money.
    queries: ['retirement savings money', 'coins jar savings', 'financial chart growth', 'dollar bills cash'] },
  { test: /\b(cash|money|dollars?|currency|coins)/i,
    queries: ['counting money cash', 'dollar bills', 'money stack'] },
  { test: /\b(car|cars|vehicle|automobile)/i,
    queries: ['luxury car', 'car showroom', 'sports car'] },
  { test: /\b(student|broke|poor|cheap|ramen)/i,
    queries: ['instant noodles', 'small apartment', 'desk lamp night'] },
  { test: /\b(success|discipline|habit|mindset|grind|focus|productiv|control|limit|spend|overspend)/i,
    // (12/06) Aligned with the aesthetic packs: aspirational visuals first
    // (skyline, businessman, watch), coin-stacking demoted to last resort —
    // it was landing as the cliché shot in billionaire-mindset videos.
    queries: ['city skyline sunrise', 'businessman walking city', 'luxury watch', 'stacking coins money'] },
  { test: /\b(wall street|stock exchange|nasdaq|nyse|market crash)/i,
    queries: ['wall street', 'stock exchange', 'financial district'] },
]

function concretizeQueries(originalQueries: string[], hint?: string): string[] {
  const haystack = `${originalQueries.join(' ')} ${hint ?? ''}`.toLowerCase()
  const boosted: string[] = []
  for (const entry of CONCEPT_VISUAL_MAP) {
    if (entry.test.test(haystack)) for (const q of entry.queries) boosted.push(q)
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const q of [...originalQueries, ...boosted]) {
    const k = q.toLowerCase().trim()
    if (k && !seen.has(k)) { seen.add(k); out.push(q) }
  }
  return out
}

export async function getPixabayVideoForQueries(
  queries: string[],
  sceneNeedsPeople = false,
  hint?: string,
  opts?: {
    /** true → user hand-picked these queries ([Pexels: ...] verbatim mode).
     *  NEVER concretize: the concept map was prepending its own queries
     *  ("Dubai skyline aerial", "dollar bills cash") BEFORE the user's, so
     *  every hand-picked scene rendered the same map clip (12/06 gift video). */
    exact?: boolean
    /** URLs already used by other scenes of this video — skip them. */
    exclude?: Set<string>
  },
): Promise<string | null> {
  const rawCleaned = (queries ?? [])
    .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
    .map((q) => q.trim())

  // Push #437 — prepend concrete cinematic queries for any abstract concept
  // detected in the scene, so the search reaches a premium on-topic clip first.
  // (12/06) Skipped entirely in exact mode — the user's query is sovereign.
  const cleaned = opts?.exact ? rawCleaned : concretizeQueries(rawCleaned, hint)

  if (cleaned.length === 0) return null

  const hintLabel = (hint ?? '').slice(0, 50)
  const failed: string[] = []

  for (let i = 0; i < cleaned.length; i++) {
    const q = cleaned[i]
    const url = await getPixabayVideoForExactQuery(q, sceneNeedsPeople, opts?.exclude)
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
