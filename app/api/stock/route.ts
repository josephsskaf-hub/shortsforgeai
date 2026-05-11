import { NextRequest, NextResponse } from 'next/server'

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

// Pick the best vertical/portrait file from a Pexels video's file list.
function pickFile(video: PexelsVideo): PexelsVideoFile | null {
  const usable = video.video_files.filter(
    (f) => f.file_type === 'video/mp4' && f.quality !== 'hls'
  )
  if (usable.length === 0) return null
  // Prefer 9:16-ish portrait files
  const portrait = usable.filter((f) => f.height > f.width)
  const pool = portrait.length > 0 ? portrait : usable
  // Prefer HD over SD, but cap at 1080p height to keep download time sane.
  const sorted = pool.slice().sort((a, b) => {
    const aGood = a.height <= 1920 ? 0 : 1
    const bGood = b.height <= 1920 ? 0 : 1
    if (aGood !== bGood) return aGood - bGood
    return b.height - a.height
  })
  return sorted[0] ?? null
}

function broadenQuery(q: string): string {
  // Strip filler words and keep the most concrete keywords so a too-specific
  // scene query like "scientists detected a strange signal from deep ocean"
  // still finds matches if the long version returned nothing.
  const stop = new Set([
    'a','an','the','of','in','on','to','at','for','with','by','from','as',
    'is','are','was','were','be','been','being',
    'this','that','these','those','it','its',
    'and','or','but',
    'scene','shot','clip','video',
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

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
    if (!q) {
      return NextResponse.json({ error: 'Query is required.', videos: [] }, { status: 400 })
    }

    const apiKey = process.env.PEXELS_API_KEY
    if (!apiKey) {
      console.error('[stock] PEXELS_API_KEY is not configured')
      return NextResponse.json(
        {
          error: 'Stock video service is not configured.',
          videos: [],
        },
        { status: 503 }
      )
    }

    // First attempt: original query
    let clips = await fetchPexelsVideos(q, apiKey)

    // Second attempt: broadened keywords if nothing matched
    if (clips.length === 0) {
      const broad = broadenQuery(q)
      if (broad && broad !== q.toLowerCase()) {
        console.log(`[stock] no matches for "${q}" — retrying with "${broad}"`)
        clips = await fetchPexelsVideos(broad, apiKey)
      }
    }

    if (clips.length === 0) {
      console.error(`[stock] no Pexels videos matched query="${q}"`)
      return NextResponse.json(
        {
          error: `No matching stock footage for "${q}".`,
          videos: [],
        },
        { status: 404 }
      )
    }

    console.log(`[stock] returning ${clips.length} clip(s) for "${q}"`)
    return NextResponse.json({ videos: clips })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stock] unexpected error:', msg)
    return NextResponse.json(
      { error: 'Stock video fetch failed.', videos: [] },
      { status: 500 }
    )
  }
}
