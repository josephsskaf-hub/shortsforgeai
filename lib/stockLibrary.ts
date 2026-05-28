// Curated fallback library of stock videos for the /create render flow.
//
// Why this exists: the Pexels Videos API requires PEXELS_API_KEY. When that key
// is not set in production (the common case), we still need to ship Creatomate
// a real, hotlink-friendly MP4 URL for every scene — otherwise the render
// either fails or (worse, prior to push #011) falls back to the same 4
// hardcoded "snow/aurora" photos for every video.
//
// URL discipline:
//   Every URL in this file has been verified to return 200/206 to a direct
//   GET with no auth and no Referer (curl -A "Mozilla/5.0" -r 0-1024). DO NOT
//   add URLs that 403/404 in such a test — they will break Creatomate renders.
//   Mixkit, Pixabay direct CDN, and most Pexels CDN URLs DO 403 on hotlink.
//
// Sources used:
//   - Cloudinary demo account public videos (res.cloudinary.com/demo)
//   - Pexels CDN — only specific IDs whose ACL permits hotlinking
//   - test-videos.co.uk / Blender peach project / archive.org sample MP4s
//   - mdn.github.io/shared-assets (CC0 sample videos, GitHub Pages hotlink-friendly)
//
// Diversity guarantee: even with low topic match, scene-index rotation across
// the pool ensures different scenes within one render get different clips.

export interface LibraryClip {
  url: string
  width: number
  height: number
  duration: number
  // Loose theme tags for keyword routing. A clip can carry multiple themes.
  tags: string[]
}

// ─── Verified-working clip pool ──────────────────────────────────────────────

const CLIPS: LibraryClip[] = [
  // — Cloudinary demo (verified 206 on direct GET) —
  { url: 'https://res.cloudinary.com/demo/video/upload/sea_turtle.mp4',                  width: 1280, height: 720,  duration: 17, tags: ['ocean', 'water', 'sea', 'underwater', 'nature', 'animal', 'mystery'] },
  { url: 'https://res.cloudinary.com/demo/video/upload/samples/sea-turtle.mp4',          width: 1280, height: 720,  duration: 17, tags: ['ocean', 'water', 'sea', 'underwater', 'nature', 'animal'] },
  { url: 'https://res.cloudinary.com/demo/video/upload/elephants.mp4',                   width: 1280, height: 720,  duration: 19, tags: ['nature', 'animal', 'wildlife', 'history', 'ancient'] },
  { url: 'https://res.cloudinary.com/demo/video/upload/samples/elephants.mp4',           width: 1280, height: 720,  duration: 19, tags: ['nature', 'animal', 'wildlife'] },
  { url: 'https://res.cloudinary.com/demo/video/upload/dog.mp4',                         width: 1280, height: 720,  duration:  8, tags: ['animal', 'nature'] },
  { url: 'https://res.cloudinary.com/demo/video/upload/samples/cld-sample-video.mp4',    width: 1280, height: 720,  duration: 14, tags: ['city', 'luxury', 'business', 'money', 'technology'] },
  // dance-2.mp4 removed (Push: stock-fallback fix) — a generic dancing-person clip
  // tagged 'lifestyle' (a NEUTRAL_FALLBACK_TAG), so it leaked into the fallback pool
  // and kept landing on the final PAYOFF scene. No relevance to any of the 5 verticals.

  // — Pexels CDN REMOVED in Push #215 —
  // videos.pexels.com/video-files/... returns HTTP 403 when Creatomate fetches
  // server-side (Pexels CDN blocks cloud provider IPs without browser headers).
  // Real Pexels footage now comes exclusively via the PEXELS_API_KEY search path
  // in pexels.ts → URLs returned by the API are session-authorized and work.

  // — Archive.org / Blender / test-videos.co.uk (verified 206 on direct GET) —
  { url: 'https://archive.org/download/SampleVideo1280x7205mb/SampleVideo_1280x720_5mb.mp4', width: 1280, height: 720, duration: 13, tags: ['nature', 'wildlife', 'animal'] },
  { url: 'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4', width: 1280, height: 720, duration: 596, tags: ['default'] },
  { url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_5MB.mp4', width: 1280, height: 720, duration: 10, tags: ['default'] },
  // Clean underwater jellyfish — professional B-roll for deep-ocean / mystery topics.
  { url: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_5MB.mp4', width: 1280, height: 720, duration: 10, tags: ['ocean', 'water', 'sea', 'underwater', 'nature', 'mystery'] },

  // — MDN shared-assets (CC0, verified 206 on direct GET) —
  // Abstract blooming-flower time-lapse on a black background. Non-jarring, premium
  // look. 'lifestyle' tag removed — Push #350 hard-negative blacklist system.
  { url: 'https://mdn.github.io/shared-assets/videos/flower.mp4', width: 960, height: 540, duration: 17, tags: ['abstract', 'nature'] },

  // — NASA / SpaceX rocket footage (archive.org, Public Domain) — Push #217, revised #219 —
  // Fix: CLIPS had zero clips tagged rocket/space, so rocket topics fell back to sea turtle.
  // Every clip below visually shows a rocket lifting off / ascending. Ground-level
  // static-fire and ambiguous "resource reel" clips were removed in #219 because they
  // looked like a candle flame / capsule graphics rather than a launch.
  { url: 'https://archive.org/download/504233main_ksc_120810_spacex_launch/504233main_ksc_120810_spacex_launch_512kb.mp4', width: 1280, height: 720, duration: 30, tags: ['rocket', 'rocket_launch', 'launch', 'space', 'nasa', 'spacex'] },
  { url: 'https://archive.org/download/launch-maxt/4-Launch-MaxT-OP-854x480-24-1200kbps.mp4',                             width:  854, height: 480, duration: 17, tags: ['rocket', 'rocket_launch', 'launch', 'space', 'nasa'] },
  // Added #219 — verified 206 on direct GET, all show a rocket ascending.
  { url: 'https://archive.org/download/Ares1-xTestRocketLaunches/ksc_102909_aresIx_launch_1080.mp4',                      width:  854, height: 480, duration:186, tags: ['rocket', 'rocket_launch', 'launch', 'space', 'nasa'] },
  { url: 'https://archive.org/download/NASAKennedy-4vkqBfv8OMM/NASAKennedy-4vkqBfv8OMM.mp4',                              width: 1280, height: 720, duration:110, tags: ['rocket', 'rocket_launch', 'launch', 'space', 'nasa', 'spacex'] },
  { url: 'https://archive.org/download/NASAKennedy-RxFwUG9PiYM/NASAKennedy-RxFwUG9PiYM.mp4',                              width: 1280, height: 720, duration:152, tags: ['rocket', 'rocket_launch', 'launch', 'space', 'nasa'] },
]

// ─── Keyword → tag routing ───────────────────────────────────────────────────

// Maps free-text keywords from a scene's searchQuery onto the tag vocabulary
// used by the clip pool. The map is intentionally generous: a scene query like
// "mysterious deep ocean signal" should hit both "mystery" and "ocean" tags.
// Push #210 — added 'rocket' and 'launch' as first-class tags alongside 'space'.
const KEYWORD_TO_TAGS: Record<string, string[]> = {
  // Ocean / water
  ocean: ['ocean', 'water', 'sea'], sea: ['ocean', 'water', 'sea'], water: ['water', 'ocean'],
  wave: ['ocean', 'water'], waves: ['ocean', 'water'], underwater: ['underwater', 'ocean'],
  deep: ['ocean', 'dark', 'mystery'], sonar: ['ocean', 'mystery'],

  // Space / cosmic / rocket
  space: ['space', 'cosmic', 'stars'], cosmic: ['space', 'cosmic'], star: ['space', 'stars'],
  stars: ['space', 'stars'], universe: ['space'], galaxy: ['space'], planet: ['space'],
  alien: ['space', 'mystery'], ufo: ['space', 'mystery', 'dark'], signal: ['space', 'mystery', 'technology'],
  satellite: ['space', 'technology'], telescope: ['space', 'technology'],
  // Push #210 — rocket/launch/SpaceX keywords → space tag so these always hit the space clip pool
  // Push #213 — added rocket_launch, booster_landing, earth_orbit, spacecraft, mission_control
  //             as direct category names so route.ts priority mode resolves correctly.
  rocket: ['rocket', 'rocket_launch', 'space', 'launch'],
  launch: ['rocket', 'rocket_launch', 'launch', 'space'],
  booster: ['rocket', 'rocket_launch', 'booster_landing', 'launch'],
  falcon: ['rocket', 'rocket_launch', 'launch'],
  spacex: ['rocket', 'rocket_launch', 'space', 'launch'],
  starship: ['rocket', 'rocket_launch', 'launch'],
  nasa: ['rocket', 'rocket_launch', 'space', 'nasa', 'mission_control'],
  astronaut: ['space', 'rocket', 'earth_orbit', 'spacecraft'],
  orbit: ['space', 'rocket', 'earth_orbit'],
  reusable: ['rocket', 'rocket_launch', 'booster_landing', 'launch'],
  exhaust: ['rocket', 'rocket_launch', 'launch'],
  elon: ['rocket', 'rocket_launch', 'space'], musk: ['rocket', 'rocket_launch', 'space'],
  pad: ['rocket', 'rocket_launch', 'launch'], engine: ['rocket', 'rocket_launch', 'launch'],
  flames: ['rocket', 'rocket_launch', 'launch'],
  // category name keywords (for direct route.ts libQuery lookup)
  'rocket launch': ['rocket', 'rocket_launch', 'launch', 'nasa'],
  'booster landing': ['rocket', 'booster_landing', 'launch', 'nasa'],
  'earth orbit': ['space', 'earth_orbit', 'spacecraft', 'nasa'],
  spacecraft: ['space', 'spacecraft', 'earth_orbit', 'nasa'],
  'mission control': ['rocket', 'mission_control', 'nasa'],

  // Money / business / luxury
  money: ['money', 'business', 'luxury'], wealth: ['money', 'luxury'], rich: ['money', 'luxury'],
  billionaire: ['money', 'luxury', 'business'], luxury: ['luxury', 'money'], business: ['business', 'money', 'city'],
  finance: ['money', 'business'], stock: ['money', 'business'], investment: ['money', 'business'],
  bank: ['money', 'business'],

  // Mystery / dark / horror
  mystery: ['mystery', 'dark'], dark: ['dark', 'mystery'], secret: ['mystery', 'dark'],
  hidden: ['mystery', 'dark'], forbidden: ['mystery', 'dark'], unknown: ['mystery', 'dark'],
  unexplained: ['mystery', 'dark'], paranormal: ['mystery', 'dark'], creepy: ['horror', 'dark', 'mystery'],
  horror: ['horror', 'dark'], scary: ['horror', 'dark'], abandoned: ['mystery', 'dark', 'horror'],
  conspiracy: ['mystery', 'dark'], cover: ['mystery', 'dark'],

  // Technology / AI / futuristic
  technology: ['technology'], tech: ['technology'], ai: ['technology'], artificial: ['technology'],
  robot: ['technology'], future: ['technology'], futuristic: ['technology'],
  computer: ['technology'], digital: ['technology'], code: ['technology'], data: ['technology'],

  // Nature
  nature: ['nature'], forest: ['nature', 'forest'], mountain: ['nature'], river: ['nature'],
  jungle: ['nature'], wildlife: ['nature', 'wildlife', 'animal'], animal: ['animal', 'nature'],

  // Psychology / people / lifestyle
  psychology: ['psychology', 'people'], mind: ['psychology'], brain: ['psychology'],
  human: ['people', 'psychology'], people: ['people'], person: ['people'],
  emotion: ['psychology', 'people'], lifestyle: ['lifestyle', 'people'], celebrity: ['celebrity', 'people'],

  // History / ancient
  history: ['history', 'ancient'], ancient: ['ancient', 'history'], temple: ['ancient', 'history'],
  ruin: ['ancient', 'history'], ruins: ['ancient', 'history'], pyramid: ['ancient', 'history'],
  civilization: ['ancient', 'history'], empire: ['history', 'ancient'], war: ['history'],

  // City / urban
  city: ['city', 'urban'], urban: ['city', 'urban'], street: ['city', 'urban'],
  building: ['city', 'urban'], skyscraper: ['city', 'urban'],

  // Aviation / travel — Push #243. There is no plane clip in the pool, so route
  // aviation/travel queries to the professional city/business/luxury clip
  // (cld-sample-video) instead of letting them fall through to the animal demo
  // clips (the elephants.mp4 mismatch). On-brand for the finance channel.
  jet: ['luxury', 'business', 'city'], jets: ['luxury', 'business', 'city'],
  plane: ['city', 'business'], airplane: ['city', 'business'], aircraft: ['city', 'business'],
  aviation: ['luxury', 'business'], tarmac: ['luxury', 'business'], cockpit: ['luxury', 'business'],
  flight: ['city', 'business'], airport: ['city', 'business'], runway: ['luxury', 'business'],
  travel: ['city', 'luxury'],
}

// Push #243 — neutral, professional pool for queries that match no specific
// tag. The channel is finance / billionaire / knowledge, so a city/business/
// luxury clip reads as on-brand; the animal demo clips (elephants, sea turtle,
// dog) and Big Buck Bunny never should. Before this, an unmatched query like
// "private jets on tarmac sunset" rotated into elephants.mp4.
// Push #350 — removed 'lifestyle' from neutral fallback tags so lifestyle-tagged
// queries never route unrelated content topics to people/lifestyle clips.
const NEUTRAL_FALLBACK_TAGS = ['city', 'business', 'money', 'luxury', 'technology']

const STOP_WORDS = new Set([
  'a','an','the','of','in','on','to','at','for','with','by','from','as','about',
  'is','are','was','were','be','been','being','this','that','these','those','it',
  'its','and','or','but','scene','shot','clip','video','viral','youtube','short',
  'shorts','create','make','build','generate',
])

function extractKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w))
}

// Returns the set of tags relevant to a search query, in priority order.
function tagsForQuery(query: string): string[] {
  const keywords = extractKeywords(query)
  const tags = new Set<string>()
  for (const k of keywords) {
    const mapped = KEYWORD_TO_TAGS[k]
    if (mapped) for (const t of mapped) tags.add(t)
  }
  return Array.from(tags)
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Pick a clip from the curated library for the given scene query and index.
 *
 * - Scenes with different queries naturally hit different tag buckets and get
 *   topically-varied clips.
 * - Scenes that share a tag bucket are rotated by `sceneIndex` so they still
 *   get different clips.
 * - When no tag matches, falls back to the full verified pool, still rotated.
 *
 * Never returns null — there is always a clip to render with.
 */
export function pickLibraryClip(query: string, sceneIndex = 0): LibraryClip {
  const tags = tagsForQuery(query)

  let pool: LibraryClip[] = []
  if (tags.length > 0) {
    pool = CLIPS.filter((c) => c.tags.some((t) => tags.includes(t)))
  }
  if (pool.length === 0) {
    // No tag match → prefer the neutral professional pool (city/business/luxury)
    // over the animal demo clips, which were the source of the elephants.mp4
    // mismatch on finance/aviation queries.
    pool = CLIPS.filter((c) => c.tags.some((t) => NEUTRAL_FALLBACK_TAGS.includes(t)))
  }
  if (pool.length === 0) {
    // Still nothing → entire pool minus the "default-only" Big Buck Bunny
    // entries (kept as a last resort).
    pool = CLIPS.filter((c) => !c.tags.includes('default'))
  }
  if (pool.length === 0) {
    pool = CLIPS
  }

  const idx = ((sceneIndex % pool.length) + pool.length) % pool.length
  return pool[idx]
}

/**
 * Return up to `count` clips for a query, rotated starting at sceneIndex. Used
 * by callers that want a list (e.g. the /api/stock JSON response).
 */
export function pickLibraryClips(query: string, count = 4, sceneIndex = 0): LibraryClip[] {
  const tags = tagsForQuery(query)
  let pool: LibraryClip[] = []
  if (tags.length > 0) pool = CLIPS.filter((c) => c.tags.some((t) => tags.includes(t)))
  // Push #243 — neutral professional pool before the broad animal-inclusive pool.
  if (pool.length === 0) pool = CLIPS.filter((c) => c.tags.some((t) => NEUTRAL_FALLBACK_TAGS.includes(t)))
  if (pool.length === 0) pool = CLIPS.filter((c) => !c.tags.includes('default'))
  if (pool.length === 0) pool = CLIPS

  const out: LibraryClip[] = []
  for (let n = 0; n < Math.min(count, pool.length); n++) {
    const idx = ((sceneIndex + n) % pool.length + pool.length) % pool.length
    out.push(pool[idx])
  }
  return out
}
