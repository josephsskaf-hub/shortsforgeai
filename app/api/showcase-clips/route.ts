import { NextResponse } from 'next/server'
import { searchPexelsVideos } from '@/lib/pexels'

// Push #132 — Showcase video clips fetched server-side from Pexels so the
// homepage never hard-codes a CDN URL that can go private (like the Google
// sample bucket did). Each query maps to one of the 9 showcase / PhoneCardRow
// cards. Results are cached for 1 hour via Next.js data cache so the page
// stays fast and we don't hammer the Pexels API.
export const revalidate = 3600 // 1 hour ISR cache

const SHOWCASE_QUERIES = [
  { id: 'space',   query: 'space galaxy cosmos' },
  { id: 'history', query: 'ancient rome ruins' },
  { id: 'hidden',  query: 'mysterious city underground' },
  { id: 'crime',   query: 'dark alley suspense' },
  { id: 'facts',   query: 'science laboratory experiment' },
  { id: 'money',   query: 'business money wealth' },
  // PhoneCardRow extras
  { id: 'finance', query: 'stock market trading finance' },
  { id: 'mystery', query: 'history mystery adventure' },
  { id: 'travel',  query: 'travel adventure landscape' },
]

export async function GET() {
  try {
    const results = await Promise.all(
      SHOWCASE_QUERIES.map(async ({ id, query }) => {
        const urls = await searchPexelsVideos(query, 3)
        // Pick first result; fall back to null so client can use gradient
        return { id, url: urls[0] ?? null }
      })
    )

    const clips: Record<string, string | null> = {}
    for (const r of results) {
      clips[r.id] = r.url
    }

    console.log('[showcase-clips] fetched', Object.keys(clips).length, 'clips from Pexels')
    return NextResponse.json({ clips })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[showcase-clips] error:', msg)
    // Return empty — client falls back to gradient placeholders gracefully
    return NextResponse.json({ clips: {} })
  }
}
