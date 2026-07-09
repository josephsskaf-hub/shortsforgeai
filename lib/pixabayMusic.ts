/**
 * lib/pixabayMusic.ts
 * Push #488 — Background music: layered fallback + deterministic rotation.
 *
 * ROOT CAUSE OF THE ORIGINAL BUG (push #294): the code called
 * `pixabay.com/api/music/?key=...`, an endpoint that DOES NOT EXIST.
 * Pixabay's public API only covers images and videos — re-confirmed live
 * 03/07/2026: `/api/music/` returns an HTML 404 with a key that returns
 * 200 on `/api/` (images). Music therefore never played since #294
 * shipped ("[music] Pixabay API error: 404" on every Fast Mode render).
 *
 * LAYERED STRATEGY (03/07/2026):
 *   LAYER 1 — Openverse Audio API (api.openverse.org). Open API, no key
 *   (anon limits 20/min, 200/day; we do 1 call per render). CC0-only +
 *   mp3-only + 30s-4min so tracks are attribution-free and
 *   Creatomate-compatible.
 *
 *   LAYER 2 — Curated CC0 tracks self-hosted on OUR Supabase Storage
 *   (public bucket `music`, project cqqukkvjjrguayiyjvhh). 8 phonk /
 *   dark-cinematic tracks originally from Freesound (CC0), downloaded,
 *   byte-verified against origin Content-Length, uploaded 03/07/2026 and
 *   validated anonymously (HEAD 200 + content-type audio/mpeg). These
 *   URLs are under our control — they cannot 404 unless we delete them.
 *
 *   LAYER 3 — no music (handled by the caller's try/catch in
 *   /api/compose), with a clear "[music]" warning in the logs.
 *
 * DETERMINISTIC ROTATION: pass a `seed` (any per-render string — compose
 * uses the voiceover upload URL, unique per render). The seed is FNV-1a
 * hashed to pick the query and the track, so the same render always gets
 * the same track while different renders rotate through the catalog.
 * Without a seed it falls back to Math.random() (old behavior).
 *
 * All tracks are CC0 (public domain) — safe for monetized YouTube
 * content, no attribution required.
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

// LAYER 2 — curated CC0 tracks on our own Supabase Storage (bucket `music`,
// public). Uploaded + validated 03/07/2026: every URL returned HTTP 200 with
// content-type audio/mpeg and a byte size matching the Freesound original.
const SUPABASE_MUSIC_BASE =
  'https://cqqukkvjjrguayiyjvhh.supabase.co/storage/v1/object/public/music'

const FALLBACK_TRACKS = [
  // "Phonk Song" by Seth_Makes_Sounds (Freesound 704410, CC0) — 81s
  `${SUPABASE_MUSIC_BASE}/phonk-song.mp3`,
  // "Dark Beat Synth Electro Atmo Cinematic" by szegvari (611374, CC0) — 48s
  `${SUPABASE_MUSIC_BASE}/dark-beat-cinematic-a.mp3`,
  // "Dark Beat Synth Electro Atmo Slow Cinematic" by szegvari (611373, CC0) — 48s
  `${SUPABASE_MUSIC_BASE}/dark-beat-cinematic-b.mp3`,
  // "Dark Beat Loop" by BenDerhover (686772, CC0) — 48s
  `${SUPABASE_MUSIC_BASE}/dark-beat-loop.mp3`,
  // "Black Magick Voodoo Tribal" by memz (325143, CC0) — 53s
  `${SUPABASE_MUSIC_BASE}/voodoo-tribal.mp3`,
  // "TRAP Type Beat - Dark Time" by Diamond_Tunes (703568, CC0) — 125s
  `${SUPABASE_MUSIC_BASE}/dark-trap-time.mp3`,
  // "Scary Dark Cinematic For Suspenseful Moments" (711663, CC0) — 73s
  `${SUPABASE_MUSIC_BASE}/scary-dark-cinematic.mp3`,
  // "Orchestral trap music" by Migfus20 (524313, CC0) — 46s
  `${SUPABASE_MUSIC_BASE}/orchestral-trap.mp3`,
]

type OpenverseHit = {
  url?: string
  duration?: number // milliseconds
  category?: string | null
  title?: string
}

// ---------------------------------------------------------------------------
// FNV-1a 32-bit hash — deterministic seed → index mapping.
// ---------------------------------------------------------------------------
function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Pick an index in [0, len). Seeded = deterministic; unseeded = random. */
function pickIndex(len: number, seed: string | undefined, salt: string): number {
  if (len <= 0) return 0
  if (seed && seed.length > 0) return fnv1a(`${salt}:${seed}`) % len
  return Math.floor(Math.random() * len)
}

// ---------------------------------------------------------------------------
// LAYER 1 — Openverse Audio API search. CC0 only, mp3 only, 30s-4min.
// ---------------------------------------------------------------------------
async function fetchTrackFromOpenverse(seed?: string): Promise<string | null> {
  try {
    const query = SEARCH_QUERIES[pickIndex(SEARCH_QUERIES.length, seed, 'query')]
    const url = `${OPENVERSE_API}?q=${encodeURIComponent(query)}&license=cc0&page_size=20`

    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      console.warn(`[music] Openverse API error: ${res.status} — falling back to curated tracks`)
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

    const picked = hits[pickIndex(hits.length, seed, 'track')]
    console.log(
      `[music] Openverse selected: "${picked.title}" (${Math.round((picked.duration ?? 0) / 1000)}s, query "${query}")`,
    )
    return picked.url ?? null
  } catch (err) {
    console.warn(
      '[music] Openverse fetch failed — falling back to curated tracks:',
      err instanceof Error ? err.message : String(err),
    )
    return null
  }
}

// ---------------------------------------------------------------------------
// Main export — call once per video render to get a music URL.
// `seed`: any per-render string (compose passes the voiceover upload URL) so
// track choice is deterministic per render but rotates across renders.
// Never returns null in practice: LAYER 2 is self-hosted and always resolves.
// ---------------------------------------------------------------------------
export async function getBackgroundMusicUrl(seed?: string): Promise<string | null> {
  // KINEO-MUSIC-CURATED-2026-07-09 — Openverse (LAYER 1) DISABLED by default.
  // Real-world failure 09/07: a random Openverse "phonk/dark beat" hit turned
  // out to be a track that flips into upbeat club music mid-file — the loop
  // put party music under the last 5s of a Battle of Waterloo video sent to a
  // client. Random CC0 search = quality roulette; the 8 curated tracks below
  // are hand-vetted dark/cinematic and always on-brand. Re-enable the live
  // search only via env flag after adding a genre-consistency check.
  if (process.env.MUSIC_OPENVERSE_ENABLED === '1') {
    const fromApi = await fetchTrackFromOpenverse(seed)
    if (fromApi) return fromApi
  }

  // LAYER 2 (now primary) — curated self-hosted CC0 tracks (deterministic rotation)
  const fallback = FALLBACK_TRACKS[pickIndex(FALLBACK_TRACKS.length, seed, 'fallback')]
  console.log(`[music] Using curated self-hosted CC0 track: ${fallback}`)
  return fallback

  // LAYER 3 (no music) is the caller's try/catch in /api/compose — it logs
  // "[compose] music fetch failed, continuing without music".
}
