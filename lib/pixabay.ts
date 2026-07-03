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
  // 02/07 (validação com vídeo Fast real, logs de prod) — sufixos de ESTILO que o
  // BrollPlan anexa às queries ("golden hour", "close-up macro", "wide establishing",
  // "POV", "low angle") estavam contando como matches de RELEVÂNCIA: um clipe
  // "ocean palm golden hour" (matches=2 em golden+hour) venceu o clipe real de
  // cratera de enxofre (matches=1 em volcano) na cena do Danakil. Palavras de
  // enquadramento/luz não são TÓPICO — fora do score; a busca do Pixabay ainda
  // as usa na query normal.
  'golden', 'hour', 'macro', 'establishing', 'pov', 'medium', 'wide', 'angle',
  'low', 'slow', 'motion', 'timelapse', '4k', 'uhd',
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

// Push #483 (02/07) — count HOW MANY meaningful query tokens the clip's tags
// share with the query. tagsRelevantToQuery is a pass/fail gate (≥1 token);
// this count feeds the candidate RANKING so a clip matching "volcano"+"lava"
// +"eruption" beats one matching only "volcano".
function tagMatchCount(video: PixabayVideo, query: string): number {
  const qTokens = meaningfulTokens(query)
  if (qTokens.length === 0) return 0
  const tagBlob = video.tags.toLowerCase()
  return qTokens.filter((t) => tagBlob.includes(t)).length
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
// Runs one Pixabay search, rejects lifestyle-polluted clips, RANKS the clean
// candidates and returns the best one.
//
// Push #483 (02/07) — candidate RANKING replaces "first clean clip wins".
// Before: we returned the first portrait clip that passed the gates, even if it
// was 3s long (freeze/loop on an 8s scene) and matched only 1 query word, while
// a 15s strong-match clip sat 2 positions later. Now every clean candidate is
// scored and the best wins:
//   +4 per query token found in the clip's tags   (topic strength dominates)
//   +3 if clip duration covers the scene           (no freeze/loop padding)
//   +2 if portrait/vertical                        (native 9:16 — nice-to-have,
//        NOT a trump card: compose center-crops landscape fine, see #438)
// Ties break toward Pixabay's own relevance order. Same inputs, same fallback
// behavior (null on no clean candidate) — only the pick among survivors changed.

// Fast Mode v2 (02/07) — candidate type shared by searchAndFilter (best-of-pool
// single pick) and getPixabayClipsForScene (multi-clip scene pools for rhythm cuts).
type PixabayCandidate = { url: string; score: number; order: number; id: number }

// Fast Mode v2 (02/07) — collection extracted from searchAndFilter so the new
// multi-clip scene pool reuses the EXACT same gates + scoring (#483/#484).
// searchAndFilter's observable behavior is unchanged.
async function collectCandidates(
  query: string,
  sceneNeedsPeople: boolean,
  category: string | undefined,
  label: string,
  exclude?: Set<string>,
  minDurationSec?: number,
): Promise<PixabayCandidate[]> {
  // Push #484 (02/07) — pool 7 → 20. The #483 ranker only beats "first clean
  // clip wins" if it has real candidates to rank; 7 hits often left 1-2 clean
  // survivors after the lifestyle/relevance gates. Same single API call.
  const hits = await searchPixabay(query, 20, category)

  // Scene coverage target: planned scene duration when known (BrollPlan),
  // else 6s — a sane floor for Shorts pacing.
  const neededSec = typeof minDurationSec === 'number' && minDurationSec > 0
    ? Math.min(minDurationSec, 15)
    : 6

  const candidates: PixabayCandidate[] = []

  for (let order = 0; order < hits.length; order++) {
    const video = hits[order]
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
    if (!url) continue

    const rez = video.videos?.large
    const portrait = !!rez && rez.height >= rez.width
    const coversScene = typeof video.duration === 'number' && video.duration >= neededSec
    // Push #484 — clips under 3s force a visible freeze/loop on any Short scene;
    // losing the +3 coverage bonus wasn't enough (a 2s strong-tag clip still won).
    // Explicit penalty, NOT a reject: on thin queries a short on-topic clip still
    // beats FALLBACK-A/B repetition.
    const tooShort = typeof video.duration === 'number' && video.duration > 0 && video.duration < 3
    const matches = tagMatchCount(video, query)
    const score = matches * 4 + (coversScene ? 3 : 0) + (portrait ? 2 : 0) - (tooShort ? 2 : 0)
    candidates.push({ url, score, order, id: video.id })
    console.log(
      `[pixabay] ${label} candidate id=${video.id} score=${score} (matches=${matches} dur=${video.duration ?? '?'}s/${neededSec}s portrait=${portrait} tooShort=${tooShort}) tags="${video.tags.slice(0, 60)}"`,
    )
  }

  return candidates
}

async function searchAndFilter(
  query: string,
  sceneNeedsPeople: boolean,
  category: string | undefined,
  label: string,
  exclude?: Set<string>,
  minDurationSec?: number,
): Promise<string | null> {
  const candidates = await collectCandidates(query, sceneNeedsPeople, category, label, exclude, minDurationSec)

  if (candidates.length === 0) return null

  candidates.sort((a, b) => b.score - a.score || a.order - b.order)
  const best = candidates[0]
  console.log(
    `[pixabay] ${label} ACCEPTED id=${best.id} score=${best.score} of ${candidates.length} candidate(s) url="${best.url.slice(0, 60)}"`,
  )
  return best.url
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
  minDurationSec?: number, // Push #483 — planned scene duration for ranking
): Promise<string | null> {
  const q = (query ?? '').trim()
  if (!q) return null

  const category = inferCategory(q)

  // 1) Exact query with inferred category
  const direct = await searchAndFilter(q, sceneNeedsPeople, category, 'exact', exclude, minDurationSec)
  if (direct) return direct

  // 2) First 3 tokens (broadened) — same semantic topic
  const broad = q.split(/\s+/).slice(0, 3).join(' ')
  if (broad.length > 0 && broad !== q) {
    const broadUrl = await searchAndFilter(broad, sceneNeedsPeople, category, 'broad', exclude, minDurationSec)
    if (broadUrl) return broadUrl
  }

  // 2b) First 2 tokens — last semantic broadening before giving up (helps
  // 4-word hand-picked queries like "man reading book penthouse" → "man reading").
  const broad2 = q.split(/\s+/).slice(0, 2).join(' ')
  if (broad2.length > 0 && broad2 !== broad && broad2 !== q) {
    const broad2Url = await searchAndFilter(broad2, sceneNeedsPeople, category, 'broad2', exclude, minDurationSec)
    if (broad2Url) return broad2Url
  }

  // 3) Remove category constraint — may have been over-narrowing
  if (category) {
    const noCat = await searchAndFilter(q, sceneNeedsPeople, undefined, 'no_cat', exclude, minDurationSec)
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
  // Push #482 (02/07) — GEO/EXTREME-PLACES concept map. The channel's strongest
  // vertical (extreme places / geography / mystery) had ZERO entries here, so
  // niche proper-noun queries ("La Rinconada Peru", "Oymyakon village") missed
  // Pixabay and the scene fell to FALLBACK-A/B (repeated clip / off-topic
  // library clip). These map extreme-place concepts to concrete, filmable
  // queries Pixabay has deep inventory for. Purely additive: boosted queries
  // are APPENDED after the original ones (see concretizeQueries), so specific
  // queries still win when they hit.
  { test: /\b(volcano|volcanic|lava|eruption|magma|crater)/i,
    queries: ['volcano lava eruption', 'lava flow night', 'volcanic crater aerial'] },
  { test: /\b(glacier|frozen|arctic|siberia|permafrost|coldest|blizzard|subzero|icy|iceberg)/i,
    queries: ['glacier aerial', 'frozen landscape winter', 'snowstorm blizzard village', 'ice cave'] },
  { test: /\b(desert|dunes?|sahara|arid|salt flat|wasteland)/i,
    queries: ['desert dunes aerial', 'salt flat landscape', 'desert heat haze'] },
  { test: /\b(mountain|peak|summit|altitude|everest|andes|himalaya|climber|climbing)/i,
    queries: ['mountain peak aerial', 'snowy mountain summit clouds', 'mountaineer climbing snow'] },
  { test: /\b(mine|miner|mining|tunnel|cave|cavern|underground)/i,
    queries: ['mine tunnel underground', 'cave interior dark', 'miner headlamp dark'] },
  { test: /\b(deep sea|trench|abyss|underwater|seabed|submarine|diver)/i,
    queries: ['deep ocean underwater dark', 'underwater diver', 'ocean waves storm aerial'] },
  { test: /\b(jungle|rainforest|amazon|swamp|canopy)/i,
    queries: ['rainforest aerial', 'jungle canopy mist', 'tropical river aerial'] },
  { test: /\b(island|archipelago|isolated|remote|uninhabited)/i,
    queries: ['remote island aerial', 'rocky island ocean waves', 'coastline cliffs aerial'] },
  { test: /\b(abandoned|ruins?|ghost town|derelict|ancient city|lost city)/i,
    queries: ['abandoned building interior decay', 'ancient ruins stone', 'empty street fog'] },
  { test: /\b(mystery|mysterious|unexplained|eerie|haunted|creepy|vanish|disappear)/i,
    queries: ['dark foggy forest', 'fog night empty street', 'abandoned house eerie'] },
  { test: /\b(storm|lightning|hurricane|tornado|monsoon|flood)/i,
    queries: ['lightning storm night', 'storm clouds timelapse', 'huge waves storm ocean'] },
  { test: /\b(village|town|settlement|inhabitants?|locals)/i,
    queries: ['mountain village aerial', 'remote village houses', 'small town aerial drone'] },
  { test: /\b(acid|acidic|toxic|sulfur|sulphur|geothermal|hot spring|geyser)/i,
    queries: ['geothermal hot spring aerial', 'sulfur volcanic vent steam', 'colorful mineral lake aerial'] },
  { test: /\b(cliff|ravine|canyon|gorge|dangerous road|winding road)/i,
    queries: ['mountain road winding aerial', 'cliff edge ocean', 'canyon aerial drone'] },
  { test: /\b(snake|spider|scorpion|crocodile|shark|predator|venom)/i,
    queries: ['snake close up', 'crocodile water', 'shark underwater'] },
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
    /** Push #483 — planned scene duration (s); clips covering it rank higher. */
    minDurationSec?: number
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
    const url = await getPixabayVideoForExactQuery(q, sceneNeedsPeople, opts?.exclude, opts?.minDurationSec)
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

// ── Fast Mode v2 (02/07) — multi-clip scene pools ──────────────────────────

// Max queries pooled per scene — each pool query is exactly ONE Pixabay API call
// (no broadening tiers), so a scene costs at most 3 calls before falling back.
const SCENE_POOL_QUERY_CAP = 3
// Earlier queries are more SPECIFIC (BrollPlan orders them that way) — a small
// score bonus keeps a specific query's clip ahead of a generic query's on ties.
const SCENE_POOL_PRIORITY_BONUS = 2

/**
 * Fast Mode v2 (02/07) — return up to `maxClips` RANKED clip URLs for one scene,
 * strongest first, pooled across the scene's query list.
 *
 * Why: one clip per scene forced compose to hold a single static clip for 6-9s.
 * With 2+ ranked clips per scene, compose can cut every ~2.5-4s INSIDE the scene
 * (rhythm) — and because the pool is score-sorted, the scene's LEAD clip is the
 * strongest of its whole candidate pool (the visual hook for scene 1).
 *
 * Fallback: if the pooled searches find nothing, delegates to the classic
 * single-clip chain (getPixabayVideoForQueries, with query broadening) so v2
 * never sources FEWER clips than v1 did. Never throws.
 */
export async function getPixabayClipsForScene(
  queries: string[],
  sceneNeedsPeople = false,
  hint?: string,
  opts?: {
    /** true → user hand-picked queries (verbatim mode): never concretize. */
    exact?: boolean
    /** URLs already used by other scenes of this video — skip them. */
    exclude?: Set<string>
    /** Planned scene duration (s); clips covering it rank higher (#483). */
    minDurationSec?: number
    /** How many ranked clips to return (default 2). */
    maxClips?: number
  },
): Promise<string[]> {
  const rawCleaned = (queries ?? [])
    .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
    .map((q) => q.trim())
  const cleaned = opts?.exact ? rawCleaned : concretizeQueries(rawCleaned, hint)
  if (cleaned.length === 0) return []

  const maxClips = Math.max(1, opts?.maxClips ?? 2)
  const hintLabel = (hint ?? '').slice(0, 50)

  const pool: PixabayCandidate[] = []
  // Superset of the caller's exclude set: also blocks intra-pool duplicates.
  const seenUrls = new Set<string>(opts?.exclude ?? [])

  for (let i = 0; i < Math.min(cleaned.length, SCENE_POOL_QUERY_CAP); i++) {
    const q = cleaned[i]
    const cands = await collectCandidates(
      q,
      sceneNeedsPeople,
      inferCategory(q),
      `pool${i + 1}`,
      seenUrls,
      opts?.minDurationSec,
    )
    for (const c of cands) {
      if (seenUrls.has(c.url)) continue
      seenUrls.add(c.url)
      pool.push({ ...c, score: c.score + Math.max(0, SCENE_POOL_PRIORITY_BONUS - i) })
    }
    // HOTFIX (02/07) — SHORT-CIRCUIT: once the pool already holds enough
    // eligible candidates to fill the scene (>= maxClips, i.e. pool1 alone
    // when it's healthy), take the top picks from what we have and SKIP the
    // remaining pool queries. The previous threshold (maxClips + 2) kept
    // fetching pool2+pool3 per scene even when pool1 returned 19 eligible
    // candidates — 3x the Pixabay round-trips on 60s scripts (6-9 scenes),
    // which blew the route's 60s Vercel budget (504). Fallbacks are intact:
    // pool2/pool3 still run when pool1 comes back thin (< maxClips), and the
    // classic single-clip chain below still covers a fully dry pool.
    if (pool.length >= maxClips) {
      if (i + 1 < Math.min(cleaned.length, SCENE_POOL_QUERY_CAP)) {
        console.log(
          `[pixabay-pool] short-circuit after pool${i + 1}: ${pool.length} eligible >= ${maxClips} — skipping remaining pool queries`,
        )
      }
      break
    }
  }

  if (pool.length === 0) {
    // Pool dry (niche query) — classic chain with broadening finds SOMETHING.
    const single = await getPixabayVideoForQueries(queries, sceneNeedsPeople, hint, opts)
    return single ? [single] : []
  }

  pool.sort((a, b) => b.score - a.score || a.order - b.order)
  const picked = pool.slice(0, maxClips).map((c) => c.url)
  console.log(
    `[pixabay-pool] ${pool.length} candidate(s) → ${picked.length} clip(s), top score=${pool[0].score}` +
      (hintLabel ? ` for="${hintLabel}"` : ''),
  )
  return picked
}
