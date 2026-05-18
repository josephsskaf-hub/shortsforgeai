import { NextResponse } from 'next/server'
import { searchPexelsVideos } from '@/lib/pexels'

// Push #132 — Showcase video clips fetched server-side from Pexels so the
// homepage never hard-codes a CDN URL that can go private (like the Google
// sample bucket did). Each query maps to one of the 9 showcase / PhoneCardRow
// cards. Results are cached for 1 hour via Next.js data cache so the page
// stays fast and we don't hammer the Pexels API.
export const revalidate = 3600 // 1 hour ISR cache

// Each entry has a primary query and fallback queries tried in order.
// Portrait-specific queries fail often on Pexels when the topic is niche —
// fallbacks use broader terms guaranteed to have portrait results.
const SHOWCASE_QUERIES = [
  { id: 'space',   queries: ['space galaxy stars', 'night sky stars', 'galaxy space'] },
  { id: 'history', queries: ['ancient ruins architecture', 'historical architecture', 'ancient city'] },
  { id: 'hidden',  queries: ['city skyline night', 'urban city street', 'city buildings'] },
  { id: 'crime',   queries: ['city night rain', 'rain street night', 'dark city street'] },
  { id: 'facts',   queries: ['science technology', 'technology digital', 'science nature'] },
  { id: 'money',   queries: ['money finance business', 'business success', 'finance city'] },
  // PhoneCardRow extras
  { id: 'finance', queries: ['finance money wealth', 'business city office', 'stock market'] },
  { id: 'mystery', queries: ['history mystery ancient', 'ancient history', 'historical mystery'] },
  { id: 'travel',  queries: ['travel nature landscape', 'travel adventure', 'nature landscape'] },
]

export async function GET() {
  try {
    const results = await Promise.all(
      SHOWCASE_QUERIES.map(async ({ id, queries }) => {
        // Try each query in order until we get a result
        for (const query of queries) {
          const urls = await searchPexelsVideos(query, 3)
          if (urls[0]) return { id, url: urls[0] }
        }
        return { id, url: null }
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
