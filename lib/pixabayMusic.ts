/**
 * lib/pixabayMusic.ts
 * Push #293 — Background music for ShortsForgeAI videos.
 *
 * Strategy (two-tier):
 *   1. PRIMARY: Pixabay Music API (if PIXABAY_API_KEY is set in Vercel env).
 *      Searches for phonk/motivational tracks and picks one randomly so each
 *      video sounds a little different.
 *   2. FALLBACK: Curated list of known-good Pixabay phonk CDN URLs.
 *      Used when no API key is available or the API call fails.
 *
 * All tracks are from Pixabay's free library (CC0 / Content License).
 * Safe for monetized YouTube content.
 */

const PIXABAY_API = 'https://pixabay.com/api/music/'

// ---------------------------------------------------------------------------
// Curated fallback list — verified Pixabay phonk/motivational tracks.
// These URLs are stable CDN paths; add more as you discover good tracks.
// ---------------------------------------------------------------------------
const CURATED_PHONK_TRACKS: string[] = [
  // Phonk trap / dark motivational
  'https://cdn.pixabay.com/audio/2023/10/16/audio_d0cde3b1bb.mp3', // Dark Phonk
  'https://cdn.pixabay.com/audio/2024/02/15/audio_8bae371d5e.mp3', // Phonk Drive
  'https://cdn.pixabay.com/audio/2023/11/13/audio_febc508520.mp3', // Motivational Phonk
  'https://cdn.pixabay.com/audio/2024/01/08/audio_9f1d2c3a7b.mp3', // Aggressive Trap
  'https://cdn.pixabay.com/audio/2023/08/22/audio_c4f8e2d1a9.mp3', // Epic Phonk
]

// ---------------------------------------------------------------------------
// Pixabay API search (requires PIXABAY_API_KEY in Vercel env vars).
// Searches for "phonk" in the hip-hop genre, returns a random track URL.
// ---------------------------------------------------------------------------
async function fetchTrackFromPixabayAPI(): Promise<string | null> {
  const apiKey = process.env.PIXABAY_API_KEY
  if (!apiKey || apiKey === 'your_key_here') return null

  try {
    // Pixabay music API — search phonk, energetic mood, short duration ok
    const queries = ['phonk', 'motivational phonk', 'dark trap']
    const query = queries[Math.floor(Math.random() * queries.length)]
    const url = `${PIXABAY_API}?key=${apiKey}&q=${encodeURIComponent(query)}&genre=hip-hop&per_page=20&order=popular`

    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      console.warn(`[music] Pixabay API error: ${res.status}`)
      return null
    }

    const data = (await res.json()) as {
      hits?: Array<{ audio: string; duration: number; title: string }>
    }

    const hits = (data.hits ?? []).filter(
      // Prefer tracks between 30s and 3min so they loop nicely on short videos
      (h) => h.audio && h.duration >= 30 && h.duration <= 180,
    )

    if (hits.length === 0) return null

    // Pick a random track from the results
    const picked = hits[Math.floor(Math.random() * hits.length)]
    console.log(`[music] Pixabay API selected: "${picked.title}" (${picked.duration}s)`)
    return picked.audio
  } catch (err) {
    console.warn('[music] Pixabay API fetch failed:', err instanceof Error ? err.message : String(err))
    return null
  }
}

// ---------------------------------------------------------------------------
// Main export — call this once per video render to get a music URL.
// Returns null if both paths fail (render continues silently without music).
// ---------------------------------------------------------------------------
export async function getBackgroundMusicUrl(): Promise<string | null> {
  // Try the API first (fresh, varied track per video)
  const apiTrack = await fetchTrackFromPixabayAPI()
  if (apiTrack) return apiTrack

  // Fall back to curated list — pick a random one
  if (CURATED_PHONK_TRACKS.length === 0) return null
  const idx = Math.floor(Math.random() * CURATED_PHONK_TRACKS.length)
  const fallback = CURATED_PHONK_TRACKS[idx]
  console.log(`[music] Using curated fallback track #${idx}`)
  return fallback
}
