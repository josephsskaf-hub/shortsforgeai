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

function distributeDurations(scenes: Scene[], totalSeconds: number): number[] {
  const lengths = scenes.map((s) => Math.max(1, (s.narration || '').length))
  const totalLen = lengths.reduce((a, b) => a + b, 0) || 1
  const raw = lengths.map((l) => (l / totalLen) * totalSeconds)
  return raw.map((d) => Math.max(2, Math.round(d * 100) / 100))
}

function findStockUrl(stockClips: StockClipInput[], sceneNumber: number): string | null {
  const hit = stockClips.find((c) => c.sceneNumber === sceneNumber)
  const url = hit?.videoUrl ?? null
  if (!url || url.includes('placeholder') || url.includes('example.com') || url.includes('mock')) return null
  // Only allow http/https URLs
  if (!url.startsWith('http')) return null
  // Reject the legacy hardcoded mock photo bucket so a regression there can
  // never leak the same snow/aurora-toned image into every render again.
  if (/pexels-photo-(3408744|1089842|1252500|256541|3109807|1169754|1624600|949587)\.jpe?g/i.test(url)) {
    console.warn('[render] rejecting legacy mock stock URL:', url)
    return null
  }
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
      body: new Uint8Array(buffer),
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

const RENDER_COST = 1 // legacy Creatomate render path costs 1 credit per render

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

    // Credit gate. Without this, anyone with a session can hammer Creatomate
    // for free. Check the balance before any expensive upstream calls (TTS,
    // Creatomate). We deduct atomically below once the render has actually
    // been queued, so a Creatomate rejection doesn't burn a credit.
    {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('video_credits')
        .eq('id', user.id)
        .single()
      if (profileErr && profileErr.code !== 'PGRST116') {
        console.error('[render] credit lookup failed:', profileErr.message)
        return NextResponse.json({ error: 'Could not verify your credit balance.' }, { status: 500 })
      }
      const balance = profile?.video_credits ?? 0
      if (balance < RENDER_COST) {
        return NextResponse.json(
          { error: 'Not enough credits.', needed: RENDER_COST, balance },
          { status: 402 }
        )
      }
    }

    const script = (body.script ?? '').trim()
    const scenes = Array.isArray(body.scenes) ? body.scenes : []
    const stockClips = Array.isArray(body.stockClips) ? body.stockClips : []

    if (!script) return NextResponse.json({ error: 'Script is required.' }, { status: 400 })
    if (!scenes.length) return NextResponse.json({ error: 'Scenes are required.' }, { status: 400 })

    // Reject the render if no scene has a real, query-relevant stock URL.
    // The old silent-mock fallback in /api/stock used to paper over a missing
    // PEXELS_API_KEY with the same 4 hardcoded photos for every video. That's
    // exactly the "snow/aurora on every render" bug. Surface a clean error
    // instead of rendering a video with no real visuals.
    const usableStockCount = scenes.filter((s) => findStockUrl(stockClips, s.sceneNumber)).length
    if (usableStockCount === 0) {
      console.error('[render] rejecting: no usable stock URL on any scene')
      return NextResponse.json(
        { error: 'Could not prepare visuals. Please try again.' },
        { status: 502 }
      )
    }

    // — Voiceover (non-fatal) —
    let voiceoverUrl: string | null = null
    if (process.env.OPENAI_API_KEY) {
      try {
        const ttsInput = script.length > 4000 ? script.slice(0, 4000) : script
        const speech = await openai.audio.speech.create({ model: 'tts-1', voice: 'onyx', input: ttsInput })
        const buf = Buffer.from(await speech.arrayBuffer())
        voiceoverUrl = await uploadVoiceover(user.id, buf)
        console.log('[render] voiceover:', voiceoverUrl ? 'uploaded ok' : 'null')
      } catch (err) {
        console.error('[render] TTS error:', err)
      }
    }

    // — Timing —
    const totalDuration = Math.min(45, Math.max(20, scenes.reduce((a, s) => a + (s.duration || 0), 0) || 35))
    const durations = distributeDurations(scenes, totalDuration)
    const finalDur = Math.round(durations.reduce((a, b) => a + b, 0) * 100) / 100

    // — Build Creatomate composition —
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const elements: any[] = []

    // Track 1: solid dark background
    elements.push({
      type: 'shape',
      track: 1,
      time: 0,
      duration: finalDur,
      x: '50%',
      y: '50%',
      width: '100%',
      height: '100%',
      fill_color: '#08080f',
    })

    // Tracks 2-3: stock video clip + dark overlay (if real URL available)
    let cursor = 0
    scenes.forEach((scene, i) => {
      const dur = durations[i]
      const url = findStockUrl(stockClips, scene.sceneNumber)
      if (url) {
        elements.push({
          type: 'video',
          track: 2,
          time: cursor,
          duration: dur,
          source: url,
          fit: 'cover',
          x: '50%',
          y: '50%',
          width: '100%',
          height: '100%',
          volume: '0%',
        })
        elements.push({
          type: 'shape',
          track: 3,
          time: cursor,
          duration: dur,
          x: '50%',
          y: '50%',
          width: '100%',
          height: '100%',
          fill_color: 'rgba(0,0,0,0.55)',
        })
      }
      cursor += dur
    })

    // Track 4: narration text per scene — plain white, bold, with stroke for readability
    cursor = 0
    scenes.forEach((scene, i) => {
      const dur = durations[i]
      const narration = (scene.narration || '').trim()
      if (narration) {
        const chunks = splitNarration(narration, 80)
        const chunkDur = Math.max(1, dur / chunks.length)
        chunks.forEach((chunk, ci) => {
          elements.push({
            type: 'text',
            track: 4,
            time: Math.round((cursor + ci * chunkDur) * 1000) / 1000,
            duration: Math.round(chunkDur * 1000) / 1000,
            text: chunk,
            x: '50%',
            y: '68%',
            width: '86%',
            font_family: 'Montserrat',
            font_size: 58,
            font_weight: '800',
            fill_color: '#ffffff',
            stroke_color: 'rgba(0,0,0,0.9)',
            stroke_width: 3,
          })
        })
      }
      cursor += dur
    })

    // Track 5: voiceover
    if (voiceoverUrl) {
      elements.push({
        type: 'audio',
        track: 5,
        time: 0,
        duration: finalDur,
        source: voiceoverUrl,
        volume: '100%',
      })
    }

    // Track 6: CTA at end
    const ctaTime = Math.max(0, finalDur - 2.5)
    elements.push({
      type: 'text',
      track: 6,
      time: Math.round(ctaTime * 1000) / 1000,
      duration: Math.min(2.5, finalDur),
      text: 'shortsforgeai.com',
      x: '50%',
      y: '90%',
      width: '80%',
      font_family: 'Montserrat',
      font_size: 30,
      font_weight: '700',
      fill_color: '#ffffff',
      stroke_color: 'rgba(99,102,241,0.9)',
      stroke_width: 2,
    })

    const source = {
      output_format: 'mp4',
      width: 1080,
      height: 1920,
      frame_rate: 30,
      duration: finalDur,
      elements,
    }

    const creatomateKey = process.env.CREATOMATE_API_KEY
    if (!creatomateKey) {
      return NextResponse.json({ renderId: 'mock-' + Date.now().toString(36), status: 'rendering', isMock: true })
    }

    console.log('[render] submitting — elements:', elements.length, 'dur:', finalDur, 'voiceover:', !!voiceoverUrl)
    console.log('[render] source JSON:', JSON.stringify(source).slice(0, 500))

    let creatomateRes: Response
    try {
      creatomateRes = await fetch('https://api.creatomate.com/v1/renders', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + creatomateKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      })
    } catch (err) {
      console.error('[render] Creatomate network error:', err)
      return NextResponse.json({ error: 'Render service unreachable.' }, { status: 502 })
    }

    const responseText = await creatomateRes.text().catch(() => '')
    if (!creatomateRes.ok) {
      console.error('[render] Creatomate rejected:', creatomateRes.status, responseText)
      return NextResponse.json({ error: 'Render rejected: ' + responseText.slice(0, 300) }, { status: 502 })
    }

    let data: { id?: string; status?: string } | Array<{ id?: string; status?: string }>
    try {
      data = JSON.parse(responseText)
    } catch {
      console.error('[render] Could not parse Creatomate response:', responseText)
      return NextResponse.json({ error: 'Invalid response from render service.' }, { status: 502 })
    }

    const first = Array.isArray(data) ? data[0] : data
    const renderId = first?.id
    if (!renderId) {
      console.error('[render] No render ID returned:', responseText)
      return NextResponse.json({ error: 'Render service returned no job id.' }, { status: 502 })
    }

    // Deduct credits now that the render is queued. Guarded by `.gte` so
    // concurrent requests can't drive the balance negative; if the guard
    // rejects, we still let the render proceed (the user already had enough
    // credits when the gate above ran), but we log loudly so we can audit.
    try {
      const { data: profileNow } = await supabase
        .from('profiles')
        .select('video_credits')
        .eq('id', user.id)
        .single()
      const balance = profileNow?.video_credits ?? 0
      const next = Math.max(0, balance - RENDER_COST)
      const { error: dedErr, data: rows } = await supabase
        .from('profiles')
        .update({ video_credits: next })
        .eq('id', user.id)
        .gte('video_credits', RENDER_COST)
        .select('id')
      if (dedErr) {
        console.error('[render] credit deduction error:', dedErr.message)
      } else if (!rows || rows.length === 0) {
        console.warn('[render] credit deduction skipped — balance moved out from under us', user.id)
      }
    } catch (err) {
      console.error('[render] credit deduction threw:', err)
    }

    console.log('[render] started, renderId:', renderId)
    return NextResponse.json({ renderId, status: 'planned' })
  } catch (err) {
    console.error('[render] unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
