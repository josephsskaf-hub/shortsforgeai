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

interface PexelsPhoto {
  id: number
  width: number
  height: number
  src: {
    original: string
    large2x: string
    large: string
    portrait: string
  }
}

interface PexelsPhotosResponse {
  photos?: PexelsPhoto[]
}

// Curated Pexels photo IDs for cinematic dark backgrounds
// These are publicly accessible without API key
const MOCK_PHOTO_IDS = [3408744, 1089842, 1252500, 256541, 3109807, 1169754, 1624600, 949587]

function mockUrl(id: number): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1080&h=1920&fit=crop`
}

function buildMock(): StockClip[] {
  return MOCK_PHOTO_IDS.slice(0, 4).map((id) => ({
    id: `mock-${id}`,
    url: mockUrl(id),
    thumbnail: mockUrl(id),
    duration: 5,
    width: 1080,
    height: 1920,
  }))
}

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
    if (!q) {
      return NextResponse.json({ error: 'Query is required.' }, { status: 400 })
    }

    const apiKey = process.env.PEXELS_API_KEY
    if (!apiKey) {
      console.log('[stock] No PEXELS_API_KEY — using curated mock images')
      return NextResponse.json({ videos: buildMock(), mock: true })
    }

    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(
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
      return NextResponse.json({ videos: buildMock(), mock: true })
    }

    if (!res.ok) {
      console.error('[stock] Pexels non-ok status:', res.status)
      return NextResponse.json({ videos: buildMock(), mock: true })
    }

    const data = (await res.json()) as PexelsPhotosResponse
    const photos = data.photos ?? []

    if (photos.length === 0) {
      return NextResponse.json({ videos: buildMock(), mock: true })
    }

    const videos: StockClip[] = photos.map((p) => ({
      id: p.id,
      // Use portrait src for best 9:16 fit, fallback to large2x
      url: p.src.portrait || p.src.large2x || p.src.large || p.src.original,
      thumbnail: p.src.portrait || p.src.large2x,
      duration: 5,
      width: p.width,
      height: p.height,
    }))

    return NextResponse.json({ videos })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stock] unexpected error:', msg)
    return NextResponse.json({ videos: buildMock(), mock: true })
  }
}
