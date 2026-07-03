/**
 * lib/pixabayMusic.ts
 * Push #487 — Background music, now actually working.
 *
 * HISTORY: Push #294 pointed at `pixabay.com/api/music/`, an endpoint that
 * DOES NOT EXIST (Pixabay's public API covers images/videos only — confirmed
 * 03/07/2026: returns HTML 404 even with a valid key). Background music has
 * therefore never played since #294 shipped ("[music] Pixabay API error: 404"
 * on every render).
 *
 * NEW STRATEGY:
 *   PRIMARY: Openverse Audio API (api.openverse.org) — open API, no key
 *   needed (anon limits: 20/min, 200/day; we do 1 call per render).
 *   CC0-only + mp3-only + 30s-4min so tracks are attribution-free and
 *   Creatomate-compatible. Random query + random pick keeps videos varied.
 *
 *   FALLBACK: curated CC0 mp3 tracks (Freesound CDN, hotlink-friendly,
 *   verified live 03/07/2026) so music still plays if Openverse is down
 *   or rate-limited.
 *
 * All tracks are CC0 (public domain) — safe for monetized YouTube content,
 * no attribution required.
 */

const OPENVERSE_API = 'https://api.openverse.org/v1/audio/'

// Dark/cinematic/phonk-adjacent searches matching the channel's style.
const SEARCH_QUERIES = [
  'phonk',
  'dark beat',
  'dark trap beat',
  'cinematic tension',
  'dark ambient loop',
]

// Verified CC0 mp3 tracks (Freesound CDN previews — public, hotlinkable).
// Checked 03/07/2026 via Openverse; all 30s+ and loop-friendly.
const FALLBACK_TRACKS = [
  // "Phonk Song [preview]" by Seth_Makes_Sounds — 81s
  'https://cdn.freesound.org/previews/704/704410_13228046-hq.mp3',
  // "Dark Beat Synth Electro Atmo... Cinematic" by szegvari — 48s
  'https://cdn.freesound.org/previews/611/611374_2282212-hq.mp3',
  // "Dark Beat Synth Electro Atmo... Slow Cinematic" by szegvari — 48s
  'https://cdn.freesound.org/previews/611/611373_2282212-hq.mp3',
  // "Dark Beat Loop" by BenDerhover — 48s
  'https://cdn.freesound.org/previews/686/686772_14802701-hq.mp3',
  // "Black Magick Voodoo Tribal" by memz — 53s
  'https://cdn.freesound.org/previews/325/325143_819355-hq.mp3',
]

type OpenverseHit = {
  url?: string
  duration?: number // milliseconds
  category?: string | null
  title?: string
}

// ---------------------------------------------------------------------------
// Openverse Audio API search — CC0 only, mp3 only, 30s-4min.
// ---------------------------------------------------------------------------
async function fetchTrackFromOpenverse(): Promise<string | null> {
  try {
    const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)]
    const url = `${OPENVERSE_API}?q=${encodeURIComponent(query)}&license=cc0&page_size=20`

    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      console.warn(`[music] Openverse API error: ${res.status}`)
      return null
    }

    const data = (await res.json()) as { results?: OpenverseHit[] }

    const hits = (data.results ?? []).filter(
      (h) =>
        typeof h.url === 'string' &&
        /\.mp3(\?|$)/i.test(h.url) && // Creatomate-safe format
        typeof h.duration === 'number' &&
        h.duration >= 30_000 &&
        h.duration <= 240_000 &&
        h.category !== 'pronunciation', // Openverse indexes speech clips too
    )

    if (hits.length === 0) return null

    const picked = hits[Math.floor(Math.random() * hits.length)]
    console.log(
      `[music] Openverse selected: "${picked.title}" (${Math.round((picked.duration ?? 0) / 1000)}s, query "${query}")`,
    )
    return picked.url ?? null
  } catch (err) {
    console.warn('[music] Openverse fetch failed:', err instanceof Error ? err.message : String(err))
    return null
  }
}

// ---------------------------------------------------------------------------
// Main export — call this once per video render to get a music URL.
// Never returns null in practice: falls back to a curated CC0 track.
// ---------------------------------------------------------------------------
export async function getBackgroundMusicUrl(): Promise<string | null> {
  const fromApi = await fetchTrackFromOpenverse()
  if (fromApi) return fromApi

  const fallback = FALLBACK_TRACKS[Math.floor(Math.random() * FALLBACK_TRACKS.length)]
  console.log(`[music] Using curated CC0 fallback track: ${fallback}`)
  return fallback
}
