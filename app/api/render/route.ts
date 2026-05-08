import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

export const maxDuration = 300

interface Scene {
  sceneNumber: number
  duration: number
  narration: string
  visualDescription: string
  searchQuery: string
  emotionalTone: string
}

interface StockClipInput {
  sceneNumber: number
  videoUrl: string
}

interface RenderRequestBody {
  script?: string
  scenes?: Scene[]
  stockClips?: StockClipInput[]
  title?: string
  niche?: string
  tone?: string
}

interface CreatomateElement {
  type: string
  id?: string
  track?: number
  time?: number | string
  duration?: number | string
  source?: string
  fill_color?: string
  x?: string
  y?: string
  width?: string
  height?: string
  fit?: string
  volume?: string
  audio_fade_in?: number
  audio_fade_out?: number
  font_family?: string
  font_weight?: string
  font_size?: string
  stroke_color?: string
  stroke_width?: string
  text?: string
  background_color?: string
  background_x_padding?: string
  background_y_padding?: string
  background_border_radius?: string
  transcript_source?: string
  transcript_effect?: string
  transcript_maximum_length?: number
  transcript_color?: string
  animations?: Array<Record<string, unknown>>
  border_radius?: string
}

interface CreatomateSource {
  output_format: string
  width: number
  height: number
  frame_rate: number
  duration?: number
  elements: CreatomateElement[]
}

const MUSIC_LIBRARY: Record<string, string[]> = {
  dark: [
    'https://cdn.pixabay.com/download/audio/2022/10/30/audio_946bc6c659.mp3',
    'https://cdn.pixabay.com/download/audio/2022/03/15/audio_1718e49cfe.mp3',
    'https://cdn.pixabay.com/download/audio/2023/06/09/audio_f4a3d2e1f9.mp3',
    'https://cdn.pixabay.com/download/audio/2022/08/02/audio_2dde668d05.mp3',
  ],
  suspense: [
    'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
    'https://cdn.pixabay.com/download/audio/2023/02/28/audio_550d815d8f.mp3',
    'https://cdn.pixabay.com/download/audio/2022/03/15/audio_1718e49cfe.mp3',
    'https://cdn.pixabay.com/download/audio/2022/10/25/audio_30b58c75c7.mp3',
  ],
  mysterious: [
    'https://cdn.pixabay.com/download/audio/2022/10/30/audio_946bc6c659.mp3',
    'https://cdn.pixabay.com/download/audio/2023/05/22/audio_1d2e3f4a5b.mp3',
    'https://cdn.pixabay.com/download/audio/2022/11/22/audio_febc508520.mp3',
    'https://cdn.pixabay.com/download/audio/2022/08/02/audio_2dde668d05.mp3',
  ],
  uplifting: [
    'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3',
    'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0c6ff1bdd.mp3',
    'https://cdn.pixabay.com/download/audio/2023/04/13/audio_fbe51f48c9.mp3',
  ],
  energetic: [
    'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3',
    'https://cdn.pixabay.com/download/audio/2023/04/13/audio_fbe51f48c9.mp3',
    'https://cdn.pixabay.com/download/audio/2022/08/03/audio_2eaf0d6ce8.mp3',
  ],
}

function pickMusic(tone: string): string {
  const t = (tone || '').toLowerCase()
  let bucket: string[]
  if (t.includes('dark') || t.includes('cinematic')) bucket = MUSIC_LIBRARY.dark
  else if (t.includes('suspen') || t.includes('tense')) bucket = MUSIC_LIBRARY.suspense
  else if (t.includes('myster') || t.includes('eerie')) bucket = MUSIC_LIBRARY.mysterious
  else if (t.includes('uplift') || t.includes('inspir') || t.includes('motivat'))
    bucket = MUSIC_LIBRARY.uplifting
  else if (t.includes('energ') || t.includes('hype') || t.includes('fast'))
    bucket = MUSIC_LIBRARY.energetic
  else bucket = MUSIC_LIBRARY.dark
  return bucket[Math.floor(Math.random() * bucket.length)]
}

function distributeDurations(scenes: Scene[], totalSeconds: number): number[] {
  const lengths = scenes.map((s) => Math.max(1, (s.narration || '').length))
  const totalLen = lengths.reduce((a, b) => a + b, 0) || 1
  const raw = lengths.map((l) => (l / totalLen) * totalSeconds)
  return raw.map((d) => Math.max(1.5, Math.round(d * 100) / 100))
}

function findStockUrl(stockClips: StockClipInput[], sceneNumber: number): string | null {
  const hit = stockClips.find((c) => c.sceneNumber === sceneNumber)
  return hit?.videoUrl ?? null
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service is not configured.' },
        { status: 500 }
      )
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: RenderRequestBody
    try {
      body = (await req.json()) as RenderRequestBody
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const script = (body.script ?? '').trim()
    const scenes = Array.isArray(body.scenes) ? body.scenes : []
    const stockClips = Array.isArray(body.stockClips) ? body.stockClips : []
    const tone = (body.tone ?? '').trim() || 'dark'

    if (!script) {
      return NextResponse.json({ error: 'Script is required.' }, { status: 400 })
    }
    if (scenes.length === 0) {
      return NextResponse.json({ error: 'Scenes are required.' }, { status: 400 })
    }

    // Generate voiceover and upload to Supabase Storage (Creatomate needs a public URL, not base64)
    const ttsInput = script.length > 3800 ? script.slice(0, 3800) : script
    let voiceoverUrl: string | null = null
    try {
      const speech = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'onyx',
        input: ttsInput,
      })
      const buffer = Buffer.from(await speech.arrayBuffer())
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (supabaseUrl && serviceKey) {
        const fileName = 'render-' + user.id + '-' + Date.now() + '.mp3'
        const uploadRes = await fetch(supabaseUrl + '/storage/v1/object/voiceovers/' + fileName, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'audio/mpeg' },
          body: buffer,
        })
        if (uploadRes.ok) {
          voiceoverUrl = supabaseUrl + '/storage/v1/object/public/voiceovers/' + fileName
        } else {
          console.warn('[render] voiceover upload failed:', uploadRes.status)
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[render] TTS/upload error:', msg)
      // Non-fatal — continue without voiceover
    }

    // Build scene timings — distribute ~35s proportional to narration length
    const totalDuration = Math.min(
      40,
      Math.max(20, scenes.reduce((acc, s) => acc + (s.duration || 0), 0) || 35)
    )
    const sceneDurations = distributeDurations(scenes, totalDuration)
    const finalDuration = sceneDurations.reduce((a, b) => a + b, 0)

    const musicUrl = pickMusic(tone)

    // Build elements
    const elements: CreatomateElement[] = []

    // Background fill
    elements.push({
      type: 'shape',
      track: 1,
      fill_color: '#000000',
      x: '50%',
      y: '50%',
      width: '100%',
      height: '100%',
      time: 0,
      duration: finalDuration,
    })

    // Scene clips
    let cursor = 0
    scenes.forEach((scene, i) => {
      const dur = sceneDurations[i]
      const clipUrl = findStockUrl(stockClips, scene.sceneNumber)
      if (clipUrl) {
        const zoomDir = i % 2 === 0 ? 'subtle-zoom-in' : 'subtle-zoom-out'
        elements.push({
          type: 'video',
          track: 2,
          time: cursor,
          duration: dur,
          source: clipUrl,
          fit: 'cover',
          x: '50%',
          y: '50%',
          width: '100%',
          height: '100%',
          animations: [
            {
              type: 'scale',
              easing: 'linear',
              start_scale: zoomDir === 'subtle-zoom-in' ? '100%' : '110%',
              end_scale: zoomDir === 'subtle-zoom-in' ? '110%' : '100%',
            },
          ],
        })
      }
      cursor += dur
    })

    // Voiceover audio (only if upload succeeded)
    if (voiceoverUrl) {
      elements.push({
        type: 'audio',
        id: 'voiceover',
        track: 3,
        time: 0,
        duration: finalDuration,
        source: voiceoverUrl,
        volume: '100%',
      })
    }

    // Background music
    elements.push({
      type: 'audio',
      track: 4,
      time: 0,
      duration: finalDuration,
      source: musicUrl,
      volume: voiceoverUrl ? '12%' : '25%',
      audio_fade_in: 1,
      audio_fade_out: 2,
    })

    // Animated transcript captions (only when voiceover is available)
    if (voiceoverUrl) {
    elements.push({
      type: 'text',
      track: 5,
      time: 0,
      duration: finalDuration,
      transcript_source: 'voiceover',
      transcript_effect: 'highlight',
      transcript_maximum_length: 18,
      transcript_color: '#FFD700',
      x: '50%',
      y: '72%',
      width: '85%',
      font_family: 'Montserrat',
      font_weight: '800',
      font_size: '8 vmin',
      fill_color: 'white',
      stroke_color: 'black',
      stroke_width: '1.5 vmin',
    })
    }

    // CTA pill at end (last 2 seconds)
    const ctaTime = Math.max(0, finalDuration - 2)
    elements.push({
      type: 'text',
      track: 6,
      time: ctaTime,
      duration: Math.min(2, finalDuration),
      text: 'www.shortsforge.com',
      x: '50%',
      y: '88%',
      width: '70%',
      font_family: 'Montserrat',
      font_weight: '700',
      font_size: '4.2 vmin',
      fill_color: 'white',
      background_color: 'rgba(0,0,0,0.55)',
      background_x_padding: '4 vmin',
      background_y_padding: '2 vmin',
      background_border_radius: '4 vmin',
    })

    const source: CreatomateSource = {
      output_format: 'mp4',
      width: 1080,
      height: 1920,
      frame_rate: 30,
      duration: finalDuration,
      elements,
    }

    // No Creatomate key → mock response
    const creatomateKey = process.env.CREATOMATE_API_KEY
    if (!creatomateKey) {
      const mockId = `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      return NextResponse.json({
        renderId: mockId,
        status: 'rendering',
        isMock: true,
      })
    }

    let creatomateRes: Response
    try {
      creatomateRes = await fetch('https://api.creatomate.com/v1/renders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creatomateKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source }),
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[render] Creatomate fetch error:', msg)
      return NextResponse.json(
        { error: 'Render service unreachable. Please try again.' },
        { status: 502 }
      )
    }

    if (!creatomateRes.ok) {
      let detail = ''
      try {
        detail = await creatomateRes.text()
      } catch {}
      console.error('[render] Creatomate non-ok:', creatomateRes.status, detail)
      return NextResponse.json(
        { error: 'Render service rejected the job. Please try again.' },
        { status: 502 }
      )
    }

    const data = (await creatomateRes.json()) as
      | { id?: string; status?: string }
      | Array<{ id?: string; status?: string }>
    const first = Array.isArray(data) ? data[0] : data
    const renderId = first?.id
    if (!renderId) {
      return NextResponse.json(
        { error: 'Render service returned no job id.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ renderId, status: 'planned' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[render] unexpected error:', msg)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
