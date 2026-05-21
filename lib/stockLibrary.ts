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
  { url: 'https://res.cloudinary.com/demo/video/upload/samples/cld-sample-video.mp4',    width: 1280, height: 720,  duration: 14, tags: ['city', 'luxury', 'lifestyle', 'business', 'money', 'technology'] },
  { url: 'https://res.cloudinary.com/demo/video/upload/samples/dance-2.mp4',             width: 1280, height: 720,  duration: 12, tags: ['psychology', 'people', 'lifestyle', 'celebrity'] },

  // — Pexels CDN (only IDs verified to return 206 on direct GET) —
  { url: 'https://videos.pexels.com/video-files/2098989/2098989-uhd_2560_1440_30fps.mp4', width: 2560, height: 1440, duration: 15, tags: ['city', 'urban', 'technology', 'modern', 'business', 'money'] },
  { url: 'https://videos.pexels.com/video-files/857195/857195-hd_1280_720_25fps.mp4',     width: 1280, height: 720,  duration: 16, tags: ['space', 'cosmic', 'stars', 'sky', 'mystery', 'dark'] },
  { url: 'https://videos.pexels.com/video-files/3576378/3576378-hd_1280_720_25fps.mp4',   width: 1280, height: 720,  duration: 12, tags: ['nature', 'forest', 'mystery', 'dark', 'horror'] },
  { url: 'https://videos.pexels.com/video-files/1093662/1093662-hd_1920_1080_30fps.mp4',  width: 1920, height: 1080, duration: 14, tags: ['city', 'urban', 'street', 'lifestyle', 'luxury'] },

  // — Archive.org / Blender / test-videos.co.uk (verified 206 on direct GET) —
  { url: 'https://archive.org/download/SampleVideo1280x7205mb/SampleVideo_1280x720_5mb.mp4', width: 1280, height: 720, duration: 13, tags: ['nature', 'wildlife', 'animal'] },
  { url: 'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4', width: 1280, height: 720, duration: 596, tags: ['default'] },
  { url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_5MB.mp4', width: 1280, height: 720, duration: 10, tags: ['default'] },
]

// ─── Keyword → tag routing ───────────────────────────────────────────────────

// Maps free-text keywords from a scene's searchQuery onto the tag vocabulary
// used by the clip pool. The map is intentionally generous: a scene query like
// "mysterious deep ocean signal" should hit both "mystery" and "ocean" tags.
const KEYWORD_TO_TAGS: Record<string, string[]> = {
  // Ocean / water
  ocean: ['ocean', 'water', 'sea'], sea: ['ocean', 'water', 'sea'], water: ['water', 'ocean'],
  wave: ['ocean', 'water'], waves: ['ocean', 'water'], underwater: ['underwater', 'ocean'],
  deep: ['ocean', 'dark', 'mystery'], sonar: ['ocean', 'mystery'],

  // Space / cosmic
  space: ['space', 'cosmic', 'stars'], cosmic: ['space', 'cosmic'], star: ['space', 'stars'],
  stars: ['space', 'stars'], universe: ['space'], galaxy: ['space'], planet: ['space'],
  alien: ['space', 'mystery'], ufo: ['space', 'mystery', 'dark'], signal: ['space', 'mystery', 'technology'],
  satellite: ['space', 'technology'], telescope: ['space', 'technology'],

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
}

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
    // No tag match → use the entire pool minus the "default-only" Big Buck Bunny
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
  if (pool.length === 0) pool = CLIPS.filter((c) => !c.tags.includes('default'))
  if (pool.length === 0) pool = CLIPS

  const out: LibraryClip[] = []
  for (let n = 0; n < Math.min(count, pool.length); n++) {
    const idx = ((sceneIndex + n) % pool.length + pool.length) % pool.length
    out.push(pool[idx])
  }
  return out
}
