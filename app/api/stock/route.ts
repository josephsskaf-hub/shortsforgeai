import { NextRequest, NextResponse } from 'next/server'
import { pickLibraryClips, LibraryClip } from '@/lib/stockLibrary'

export const maxDuration = 30

interface StockClip {
  id: string | number
  url: string
  thumbnail: string
  duration: number
  width: number
  height: number
}

// Pexels Videos API (https://www.pexels.com/api/documentation/#videos)
interface PexelsVideoFile {
  id: number
  quality: 'sd' | 'hd' | 'hls' | string
  file_type: string
  width: number
  height: number
  link: string
}

interface PexelsVideoPicture {
  id: number
  picture: string
}

interface PexelsVideo {
  id: number
  width: number
  height: number
  duration: number
  video_files: PexelsVideoFile[]
  video_pictures?: PexelsVideoPicture[]
}

interface PexelsVideosResponse {
  videos?: PexelsVideo[]
}

function pickFile(video: PexelsVideo): PexelsVideoFile | null {
  const usable = video.video_files.filter(
    (f) => f.file_type === 'video/mp4' && f.quality !== 'hls'
  )
  if (usable.length === 0) return null
  const portrait = usable.filter((f) => f.height > f.width)
  const pool = portrait.length > 0 ? portrait : usable
  const sorted = pool.slice().sort((a, b) => {
    const aGood = a.height <= 1920 ? 0 : 1
    const bGood = b.height <= 1920 ? 0 : 1
    if (aGood !== bGood) return aGood - bGood
    return b.height - a.height
  })
  return sorted[0] ?? null
}

function broadenQuery(q: string): string {
  const stop = new Set([
    'a','an','the','of','in','on','to','at','for','with','by','from','as',
    'is','are','was','were','be','been','being','this','that','these','those',
    'it','its','and','or','but','scene','shot','clip','video',
  ])
  const kept = q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !stop.has(w))
    .slice(0, 4)
  return kept.join(' ').trim()
}

async function fetchPexelsVideos(query: string, apiKey: string): Promise<StockClip[]> {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(
    query
  )}&per_page=4&orientation=portrait&size=medium`
  console.log(`[stock] querying Pexels videos: "${query}"`)
  const res = await fetch(url, {
    headers: { Authorization: apiKey },
    cache: 'no-store',
  })
  if (!res.ok) {
    console.error(`[stock] Pexels videos non-ok status=${res.status}`)
    return []
  }
  const data = (await res.json()) as PexelsVideosResponse
  const videos = data.videos ?? []
  const clips: StockClip[] = []
  for (const v of videos) {
    const file = pickFile(v)
    if (!file) continue
    clips.push({
      id: v.id,
      url: file.link,
      thumbnail: v.video_pictures?.[0]?.picture ?? '',
      duration: v.duration,
      width: file.width,
      height: file.height,
    })
  }
  return clips
}

function libraryToStockClips(query: string, sceneIndex: number): StockClip[] {
  const lib = pickLibraryClips(query, 4, sceneIndex)
  return lib.map((c: LibraryClip, n: number) => ({
    id: `lib-${sceneIndex}-${n}-${encodeURIComponent(c.url.slice(-40))}`,
    url: c.url,
    thumbnail: '',
    duration: c.duration,
    width: c.width,
    height: c.height,
  }))
}

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
    if (!q) {
      return NextResponse.json({ error: 'Query is required.', videos: [] }, { status: 400 })
    }

    // Scene index passed by the client so the curated-library path can rotate
    // clips across scenes that hit the same tag bucket.
    const iParam = req.nextUrl.searchParams.get('i')
    const sceneIndex = iParam != null && /^\d+$/.test(iParam) ? parseInt(iParam, 10) : 0

    const apiKey = process.env.PEXELS_API_KEY

    // Try Pexels first if the API key is configured.
    if (apiKey) {
      let clips = await fetchPexelsVideos(q, apiKey)
      if (clips.length === 0) {
        const broad = broadenQuery(q)
        if (broad && broad !== q.toLowerCase()) {
          console.log(`[stock] no Pexels matches for "${q}" — retrying with "${broad}"`)
          clips = await fetchPexelsVideos(broad, apiKey)
        }
      }
      if (clips.length > 0) {
        console.log(`[stock] Pexels: returning ${clips.length} clip(s) for "${q}"`)
        return NextResponse.json({ videos: clips, source: 'pexels' })
      }
      console.warn(`[stock] Pexels returned nothing — falling back to curated library for "${q}"`)
    } else {
      console.log('[stock] PEXELS_API_KEY not configured — using curated library')
    }

    // Curated library fallback. Always returns a clip (no silent placeholder).
    const libClips = libraryToStockClips(q, sceneIndex)
    if (libClips.length === 0) {
      console.error(`[stock] curated library returned nothing for "${q}" (unexpected)`)
      return NextResponse.json(
        { error: 'Could not prepare visuals. Please try again.', videos: [] },
        { status: 500 }
      )
    }
    console.log(`[stock] library: returning ${libClips.length} clip(s) for "${q}" sceneIndex=${sceneIndex}`)
    return NextResponse.json({ videos: libClips, source: 'library' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stock] unexpected error:', msg)
    return NextResponse.json(
      { error: 'Stock video fetch failed.', videos: [] },
      { status: 500 }
    )
  }
}
