/**
 * lib/pixabayMusic.ts
 * Push #294 — Background music for ShortsForgeAI videos.
 *
 * Strategy:
 *   PRIMARY: Pixabay Music API (requires PIXABAY_API_KEY in Vercel env vars).
 *   Searches for phonk/motivational tracks and picks one randomly so each
 *   video sounds a little different.
 *
 *   NOTE: Direct CDN hotlinks (cdn.pixabay.com/audio/...) return 403 when
 *   fetched by Creatomate. Only URLs returned by the Pixabay Music API are
 *   authorized for playback. Without a PIXABAY_API_KEY the function returns
 *   null and the video renders without music.
 *
 * All tracks are from Pixabay's free library (CC0 / Content License).
 * Safe for monetized YouTube content.
 */

const PIXABAY_API = 'https://pixabay.com/api/music/'

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
// Returns null when no API key is configured (render continues without music).
// ---------------------------------------------------------------------------
export async function getBackgroundMusicUrl(): Promise<string | null> {
  return await fetchTrackFromPixabayAPI()
}
