import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

export const maxDuration = 60

interface FinalizeRequestBody {
  visualUrls?: string[]
  title?: string
  summary?: string
  prompt?: string
  duration?: number
}

const SUPPORTED_DURATIONS = [10, 30, 50]

interface NarrationSegment {
  text: string
}

async function generateNarration(
  prompt: string,
  totalDuration: number
): Promise<NarrationSegment[]> {
  // ~2.5 words per second of cinematic narration
  const targetWords = Math.round(totalDuration * 2.5)
  const targetSegments = totalDuration <= 10 ? 3 : totalDuration <= 30 ? 6 : 10

  const userMsg = `You write the spoken narration for a vertical AI Short on YouTube Shorts.

Topic: """${prompt}"""

Constraints:
- Total spoken length must fit ${totalDuration} seconds at a clear, cinematic pace (~${targetWords} words total).
- Break the narration into EXACTLY ${targetSegments} short caption segments.
- Each segment is one punchy phrase (3-9 words) suitable as a burned-in caption.
- Sequence the segments to flow as ONE coherent narration: hook → body → quick payoff.
- No emojis. No hashtags. No quotes. English only.

Return JSON only:
{ "segments": [{ "text": string }, ...] }`

  const completion = await openai.chat.completions.create(
    {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You write tight cinematic narration for short videos. Always return valid JSON only.',
        },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.75,
      max_tokens: 700,
      response_format: { type: 'json_object' },
    },
    { timeout: 25000 }
  )

  const raw = completion.choices[0]?.message?.content?.trim() ?? ''
  if (!raw) throw new Error('Empty narration response')
  const data = JSON.parse(raw) as { segments?: { text?: string }[] }
  const segs = Array.isArray(data.segments) ? data.segments : []
  const cleaned: NarrationSegment[] = segs
    .map((s) => (s.text ?? '').trim())
    .filter((t) => t.length > 0)
    .map((text) => ({ text }))

  if (cleaned.length === 0) throw new Error('Narration came back empty')
  return cleaned
}

async function uploadVoiceover(userId: string, buffer: Buffer): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null
  const fileName = `vo-${userId.slice(0, 8)}-${Date.now()}.mp3`
  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/voiceovers/${fileName}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'audio/mpeg' },
      body: buffer,
    })
    if (!res.ok) {
      console.error(
        '[finalize-video] voiceover upload failed:',
        res.status,
        await res.text().catch(() => '')
      )
      return null
    }
    return `${supabaseUrl}/storage/v1/object/public/voiceovers/${fileName}`
  } catch (err) {
    console.error('[finalize-video] voiceover upload error:', err)
    return null
  }
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

    let body: FinalizeRequestBody
    try {
      body = (await req.json()) as FinalizeRequestBody
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const visualUrls = (body.visualUrls ?? []).filter(
      (u): u is string => typeof u === 'string' && /^https?:\/\//.test(u)
    )
    if (visualUrls.length === 0) {
      return NextResponse.json(
        { error: 'No visuals available to compose.' },
        { status: 400 }
      )
    }

    const requestedDuration = Number(body.duration) || 10
    const duration = SUPPORTED_DURATIONS.includes(requestedDuration)
      ? requestedDuration
      : 10

    const topic = ((body.prompt || body.summary || body.title) ?? '').trim()
    if (!topic) {
      return NextResponse.json(
        { error: 'Missing topic for narration.' },
        { status: 400 }
      )
    }

    // ── 1. Narration script + caption segments ──────────────────────────────
    let segments: NarrationSegment[]
    try {
      segments = await generateNarration(topic, duration)
    } catch (err: unknown) {
      console.error('[finalize-video] narration failed:', err)
      return NextResponse.json(
        { error: 'Failed to write narration.' },
        { status: 500 }
      )
    }
    const script = segments.map((s) => s.text).join(' ')

    // ── 2. TTS voiceover ────────────────────────────────────────────────────
    let voiceoverUrl: string | null = null
    try {
      const speech = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'onyx',
        input: script.length > 3800 ? script.slice(0, 3800) : script,
      })
      const buf = Buffer.from(await speech.arrayBuffer())
      voiceoverUrl = await uploadVoiceover(user.id, buf)
    } catch (err: unknown) {
      console.error('[finalize-video] TTS failed:', err)
    }
    if (!voiceoverUrl) {
      return NextResponse.json(
        { error: 'Voiceover generation failed.' },
        { status: 500 }
      )
    }

    // ── 3. Creatomate composition ───────────────────────────────────────────
    const creatomateKey = process.env.CREATOMATE_API_KEY
    if (!creatomateKey) {
      return NextResponse.json(
        {
          error:
            'Render service is not configured. CREATOMATE_API_KEY is required to compose the final MP4.',
        },
        { status: 500 }
      )
    }

    // Runway clips are 10s each. Tile/loop them across the target duration.
    const visualClipDur = 10
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const elements: Record<string, any>[] = []

    let cursor = 0
    let visualIdx = 0
    while (cursor < duration) {
      const remaining = duration - cursor
      const segDur = Math.min(visualClipDur, remaining)
      const url = visualUrls[visualIdx % visualUrls.length]
      elements.push({
        type: 'video',
        track: 1,
        time: Math.round(cursor * 1000) / 1000,
        duration: Math.round(segDur * 1000) / 1000,
        source: url,
        fit: 'cover',
        x: '50%',
        y: '50%',
        width: '100%',
        height: '100%',
        volume: '0%',
      })
      cursor += segDur
      visualIdx++
    }

    // Subtle dark overlay so captions stay readable
    elements.push({
      type: 'shape',
      track: 2,
      time: 0,
      duration,
      x: '50%',
      y: '50%',
      width: '100%',
      height: '100%',
      fill_color: 'rgba(0,0,0,0.35)',
    })

    // Caption segments — distributed evenly across the duration
    const segDur = duration / segments.length
    let capCursor = 0
    for (const seg of segments) {
      elements.push({
        type: 'text',
        track: 3,
        time: Math.round(capCursor * 1000) / 1000,
        duration: Math.round(segDur * 1000) / 1000,
        text: seg.text,
        x: '50%',
        y: '78%',
        width: '86%',
        font_family: 'Montserrat',
        font_size: 62,
        font_weight: '800',
        fill_color: '#ffffff',
        stroke_color: 'rgba(0,0,0,0.9)',
        stroke_width: 4,
      })
      capCursor += segDur
    }

    // Voiceover audio (full duration)
    elements.push({
      type: 'audio',
      track: 4,
      time: 0,
      duration,
      source: voiceoverUrl,
      volume: '100%',
    })

    // CTA at the end (last 2.5s)
    const ctaDur = Math.min(2.5, duration)
    elements.push({
      type: 'text',
      track: 5,
      time: Math.max(0, duration - ctaDur),
      duration: ctaDur,
      text: 'www.shortsforge.com',
      x: '50%',
      y: '92%',
      width: '80%',
      font_family: 'Montserrat',
      font_size: 34,
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
      duration,
      elements,
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
    } catch (err) {
      console.error('[finalize-video] Creatomate network error:', err)
      return NextResponse.json(
        { error: 'Render service unreachable.' },
        { status: 502 }
      )
    }

    const responseText = await creatomateRes.text().catch(() => '')
    if (!creatomateRes.ok) {
      console.error(
        '[finalize-video] Creatomate rejected:',
        creatomateRes.status,
        responseText.slice(0, 600)
      )
      return NextResponse.json(
        { error: `Render rejected: ${responseText.slice(0, 200)}` },
        { status: 502 }
      )
    }

    let data: { id?: string } | Array<{ id?: string }>
    try {
      data = JSON.parse(responseText)
    } catch {
      return NextResponse.json(
        { error: 'Invalid response from render service.' },
        { status: 502 }
      )
    }
    const first = Array.isArray(data) ? data[0] : data
    const renderId = first?.id
    if (!renderId) {
      return NextResponse.json(
        { error: 'Render service returned no job id.' },
        { status: 502 }
      )
    }

    console.log(
      `[finalize-video] composition queued — renderId=${renderId} duration=${duration}s segments=${segments.length} visuals=${visualUrls.length}`
    )

    return NextResponse.json({
      renderId,
      status: 'rendering',
      duration,
      voiceoverUrl,
      script,
      segments: segments.map((s) => s.text),
    })
  } catch (err) {
    console.error('[finalize-video] unexpected error:', err)
    return NextResponse.json(
      { error: 'Something went wrong while composing the final video.' },
      { status: 500 }
    )
  }
}
