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

interface PexelsVideoFile {
  link: string
  width: number
  height: number
  quality?: string
  file_type?: string
}

interface PexelsVideo {
  id: number
  duration: number
  width: number
  height: number
  image: string
  video_files: PexelsVideoFile[]
}

interface PexelsResponse {
  videos?: PexelsVideo[]
}

const MOCK: StockClip[] = [
  {
    id: 'mock-1',
    url: 'https://videos.pexels.com/video-files/placeholder/1.mp4',
    thumbnail: 'https://images.pexels.com/videos/placeholder/1.jpg',
    duration: 8,
    width: 1080,
    height: 1920,
  },
  {
    id: 'mock-2',
    url: 'https://videos.pexels.com/video-files/placeholder/2.mp4',
    thumbnail: 'https://images.pexels.com/videos/placeholder/2.jpg',
    duration: 10,
    width: 1080,
    height: 1920,
  },
  {
    id: 'mock-3',
    url: 'https://videos.pexels.com/video-files/placeholder/3.mp4',
    thumbnail: 'https://images.pexels.com/videos/placeholder/3.jpg',
    duration: 6,
    width: 1080,
    height: 1920,
  },
]

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
    if (!q) {
      return NextResponse.json({ error: 'Query is required.' }, { status: 400 })
    }

    const apiKey = process.env.PEXELS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ videos: MOCK, mock: true })
    }

    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(
      q
    )}&per_page=4&orientation=portrait`

    let res: Response
    try {
      res = await fetch(url, {
        headers: { Authorization: apiKey },
        cache: 'no-store',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[stock] fetch error:', msg)
      return NextResponse.json({ videos: MOCK, mock: true })
    }

    if (!res.ok) {
      console.error('[stock] Pexels non-ok status:', res.status)
      return NextResponse.json({ videos: MOCK, mock: true })
    }

    const data = (await res.json()) as PexelsResponse
    const videos: StockClip[] = (data.videos ?? []).map((v) => {
      const portraitFile =
        v.video_files.find((f) => f.height >= f.width && f.quality === 'hd') ||
        v.video_files.find((f) => f.height >= f.width) ||
        v.video_files[0]
      return {
        id: v.id,
        url: portraitFile?.link ?? '',
        thumbnail: v.image,
        duration: v.duration,
        width: portraitFile?.width ?? v.width,
        height: portraitFile?.height ?? v.height,
      }
    })

    return NextResponse.json({ videos })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stock] unexpected error:', msg)
    return NextResponse.json({ videos: MOCK, mock: true })
  }
}
