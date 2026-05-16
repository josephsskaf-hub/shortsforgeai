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

// Pick the best Pexels file for a 1080x1920 (9:16) Short.
//
// Black-screen bug fix: the previous version fell back to landscape clips
// when no portrait was available, which the Creatomate `fit: contain` path
// rendered as a tiny strip on a black canvas. The new version is strict —
// it ONLY accepts true portrait HD/FullHD MP4 files, and returns null
// otherwise so the caller drops to the next keyword or the curated library
// (which is verified hotlink-friendly).
//
// Rules:
//   - file_type must be video/mp4 (no HLS, no other containers)
//   - height > width (true portrait — square clips are rejected too)
//   - 720 <= height <= 1920 (SD looks awful on a 1920 canvas; 4K causes
//     Creatomate decoder timeouts and sporadic black-frame renders)
//   - https link only (no http to avoid mixed-content issues)
function pickFile(video: PexelsVideo): PexelsVideoFile | null {
  const usable = video.video_files.filter(
    (f) =>
      f.file_type === 'video/mp4' &&
      f.quality !== 'hls' &&
      f.height > f.width &&
      f.height >= 720 &&
      f.height <= 1920 &&
      typeof f.link === 'string' &&
      f.link.startsWith('https://')
  )
  if (usable.length === 0) return null
  const sorted = usable.slice().sort((a, b) => {
    // Smallest distance from the 1920-tall ideal first, then largest height.
    const aDist = Math.abs(a.height - 1920)
    const bDist = Math.abs(b.height - 1920)
    if (aDist !== bDist) return aDist - bDist
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
    // Accept either a single query (legacy: ?q=...) or an ordered comma-
    // separated keyword list (?ks=k1,k2,k3). The keyword-list path is what
    // /api/scenes now feeds us — see push #079: each scene gets 2-3 specific
    // visual phrases, most specific first, and we try each on Pexels until
    // one returns a real match. This stops "top 5 mountains" scenes from
    // landing on skateboard footage because the first keyword was generic.
    const ksParam = (req.nextUrl.searchParams.get('ks') ?? '').trim()
    const qParam = (req.nextUrl.searchParams.get('q') ?? '').trim()

    const keywords: string[] = (ksParam
      ? ksParam.split(',').map((k) => k.trim()).filter((k) => k.length > 0)
      : qParam
        ? [qParam]
        : [])

    if (keywords.length === 0) {
      return NextResponse.json({ error: 'Query is required.', videos: [] }, { status: 400 })
    }

    // Scene index passed by the client so the curated-library path can rotate
    // clips across scenes that hit the same tag bucket.
    const iParam = req.nextUrl.searchParams.get('i')
    const sceneIndex = iParam != null && /^\d+$/.test(iParam) ? parseInt(iParam, 10) : 0

    const apiKey = process.env.PEXELS_API_KEY

    // Try Pexels first if the API key is configured.
    if (apiKey) {
      // Walk the keyword list in priority order; first hit wins.
      for (const k of keywords) {
        const clips = await fetchPexelsVideos(k, apiKey)
        if (clips.length > 0) {
          console.log(`[stock] Pexels: returning ${clips.length} clip(s) for "${k}" (matched keyword ${keywords.indexOf(k) + 1}/${keywords.length})`)
          return NextResponse.json({ videos: clips, source: 'pexels', matchedKeyword: k })
        }
        console.log(`[stock] no Pexels match for "${k}", trying next keyword…`)
      }
      // Every keyword missed — try a broadened version of the FIRST keyword
      // (the one we ranked most specific) before falling through.
      const broad = broadenQuery(keywords[0])
      if (broad && broad !== keywords[0].toLowerCase()) {
        console.log(`[stock] retrying with broadened keyword "${broad}"`)
        const clips = await fetchPexelsVideos(broad, apiKey)
        if (clips.length > 0) {
          console.log(`[stock] Pexels: returning ${clips.length} clip(s) for broadened "${broad}"`)
          return NextResponse.json({ videos: clips, source: 'pexels', matchedKeyword: broad })
        }
      }
      console.warn(`[stock] Pexels returned nothing for any of [${keywords.join(', ')}] — falling back to curated library`)
    } else {
      console.log('[stock] PEXELS_API_KEY not configured — using curated library')
    }

    // Curated library fallback. Always returns a clip (no silent placeholder).
    // Feed the library all keywords joined so its tag mapper has the broadest
    // signal — the library is keyword-loose by design and benefits from more
    // context than Pexels would.
    const libraryQuery = keywords.join(' ')
    const libClips = libraryToStockClips(libraryQuery, sceneIndex)
    if (libClips.length === 0) {
      console.error(`[stock] curated library returned nothing for "${libraryQuery}" (unexpected)`)
      return NextResponse.json(
        { error: 'Could not prepare visuals. Please try again.', videos: [] },
        { status: 500 }
      )
    }
    console.log(`[stock] library: returning ${libClips.length} clip(s) for "${libraryQuery}" sceneIndex=${sceneIndex}`)
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
