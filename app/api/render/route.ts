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

const MUSIC_URLS = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
]

function pickMusic(): string {
  return MUSIC_URLS[Math.floor(Math.random() * MUSIC_URLS.length)]
}

function distributeDurations(scenes: Scene[], totalSeconds: number): number[] {
  const lengths = scenes.map((s) => Math.max(1, (s.narration || '').length))
  const totalLen = lengths.reduce((a, b) => a + b, 0) || 1
  const raw = lengths.map((l) => (l / totalLen) * totalSeconds)
  return raw.map((d) => Math.max(2, Math.round(d * 100) / 100))
}

function findStockUrl(stockClips: StockClipInput[], sceneNumber: number): string | null {
  const hit = stockClips.find((c) => c.sceneNumber === sceneNumber)
  const url = hit?.videoUrl ?? null
  // Filter out mock/placeholder URLs
  if (!url || url.includes('placeholder')) return null
  return url
}

function splitNarration(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/)
  const chunks: string[] = []
  let current = ''
  for (const word of words) {
    if (current.length + word.length + 1 > maxChars && current) {
      chunks.push(current.trim())
      current = word
    } else {
      current += (current ? ' ' : '') + word
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.length > 0 ? chunks : [text.trim()]
}

async function uploadVoiceover(userId: string, buffer: Buffer): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null
  const fileName = 'vo-' + userId.slice(0, 8) + '-' + Date.now() + '.mp3'
  try {
    const res = await fetch(supabaseUrl + '/storage/v1/object/voiceovers/' + fileName, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'audio/mpeg' },
      body: buffer,
    })
    if (!res.ok) {
      console.error('[render] upload failed:', res.status, await res.text().catch(() => ''))
      return null
    }
    return supabaseUrl + '/storage/v1/object/public/voiceovers/' + fileName
  } catch (err) {
    console.error('[render] upload error:', err)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
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

    if (!script) return NextResponse.json({ error: 'Script is required.' }, { status: 400 })
    if (!scenes.length) return NextResponse.json({ error: 'Scenes are required.' }, { status: 400 })

    // — Voiceover (non-fatal if it fails) —
    let voiceoverUrl: string | null = null
    if (process.env.OPENAI_API_KEY) {
      try {
        const ttsInput = script.length > 4000 ? script.slice(0, 4000) : script
        const speech = await openai.audio.speech.create({ model: 'tts-1', voice: 'onyx', input: ttsInput })
        const buf = Buffer.from(await speech.arrayBuffer())
        voiceoverUrl = await uploadVoiceover(user.id, buf)
        console.log('[render] voiceover url:', voiceoverUrl ? 'ok' : 'null')
      } catch (err) {
        console.error('[render] TTS error:', err)
      }
    }

    // — Timing —
    const totalDuration = Math.min(45, Math.max(20, scenes.reduce((a, s) => a + (s.duration || 0), 0) || 35))
    const durations = distributeDurations(scenes, totalDuration)
    const finalDur = durations.reduce((a, b) => a + b, 0)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const elements: any[] = []

    // Dark gradient background
    elements.push({
      type: 'shape', track: 1, time: 0, duration: finalDur,
      fill_color: '#0a0a0f', x: '50%', y: '50%', width: '100%', height: '100%',
    })

    // Video clips + narration text per scene
    let cursor = 0
    scenes.forEach((scene, i) => {
      const dur = durations[i]
      const url = findStockUrl(stockClips, scene.sceneNumber)

      if (url) {
        elements.push({
          type: 'video', track: 2, time: cursor, duration: dur,
          source: url, fit: 'cover', x: '50%', y: '50%', width: '100%', height: '100%',
          volume: '0%',
        })
        // Dark overlay on top of video for readability
        elements.push({
          type: 'shape', track: 3, time: cursor, duration: dur,
          fill_color: 'rgba(0,0,0,0.45)', x: '50%', y: '50%', width: '100%', height: '100%',
        })
      }

      // Narration text — split into chunks so it fits on screen
      const narration = (scene.narration || '').trim()
      if (narration) {
        const chunks = splitNarration(narration, 100)
        const chunkDur = Math.max(1, dur / chunks.length)
        chunks.forEach((chunk, ci) => {
          elements.push({
            type: 'text', track: 4,
            time: cursor + ci * chunkDur,
            duration: chunkDur,
            text: chunk,
            x: '50%', y: '72%',
            width: '88%',
            font_family: 'Montserrat',
            font_weight: '700',
            font_size: '52px',
            fill_color: '#ffffff',
            background_color: 'rgba(0,0,0,0.7)',
            background_x_padding: '24px',
            background_y_padding: '14px',
            background_border_radius: '14px',
          })
        })
      }

      cursor += dur
    })

    // Voiceover
    if (voiceoverUrl) {
      elements.push({ type: 'audio', track: 5, time: 0, duration: finalDur, source: voiceoverUrl, volume: '100%' })
    }

    // Background music
    elements.push({
      type: 'audio', track: 6, time: 0, duration: finalDur,
      source: pickMusic(), volume: voiceoverUrl ? '8%' : '25%',
      audio_fade_in: 1, audio_fade_out: 2,
    })

    // CTA at end
    const ctaTime = Math.max(0, finalDur - 2.5)
    elements.push({
      type: 'text', track: 7, time: ctaTime, duration: Math.min(2.5, finalDur),
      text: 'www.shortsforge.com',
      x: '50%', y: '90%', width: '80%',
      font_family: 'Montserrat', font_weight: '700',
      font_size: '30px',
      fill_color: '#ffffff',
      background_color: 'rgba(99,102,241,0.85)',
      background_x_padding: '22px', background_y_padding: '10px',
      background_border_radius: '10px',
    })

    const source = {
      output_format: 'mp4',
      width: 1080, height: 1920, frame_rate: 30,
      duration: finalDur,
      elements,
    }

    const creatomateKey = process.env.CREATOMATE_API_KEY
    if (!creatomateKey) {
      return NextResponse.json({ renderId: 'mock-' + Date.now().toString(36), status: 'rendering', isMock: true })
    }

    console.log('[render] sending to Creatomate, elements:', elements.length, 'dur:', finalDur)

    let creatomateRes: Response
    try {
      creatomateRes = await fetch('https://api.creatomate.com/v1/renders', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + creatomateKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      })
    } catch (err) {
      console.error('[render] Creatomate fetch error:', err)
      return NextResponse.json({ error: 'Render service unreachable.' }, { status: 502 })
    }

    if (!creatomateRes.ok) {
      const detail = await creatomateRes.text().catch(() => '')
      console.error('[render] Creatomate rejected:', creatomateRes.status, detail)
      return NextResponse.json({ error: 'Render service rejected the job.' }, { status: 502 })
    }

    const data = (await creatomateRes.json()) as { id?: string; status?: string } | Array<{ id?: string; status?: string }>
    const first = Array.isArray(data) ? data[0] : data
    const renderId = first?.id
    if (!renderId) return NextResponse.json({ error: 'Render service returned no job id.' }, { status: 502 })

    console.log('[render] started, renderId:', renderId)
    return NextResponse.json({ renderId, status: 'planned' })
  } catch (err) {
    console.error('[render] unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
