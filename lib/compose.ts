// NOTE: do NOT statically `import { openai } from '@/lib/openai'` here.
// The compose-status route only needs the Creatomate helpers and we don't
// want to trigger OpenAI client instantiation (which reads OPENAI_API_KEY at
// module load) when it isn't needed. The TTS / script-scaling functions
// dynamically import it below.

const CREATOMATE_BASE = 'https://api.creatomate.com/v1'
const CTA_TEXT = 'www.shortsforge.com'
const CTA_TAIL_SECONDS = 2.5

export interface ComposeInputs {
  clipUrls: string[]
  voiceoverUrl: string
  sceneCaptions: string[]
  duration: number
}

export interface CreatomateRenderState {
  status: 'planned' | 'waiting' | 'transcribing' | 'rendering' | 'succeeded' | 'failed' | 'cancelled' | 'unknown'
  progress: number
  url: string | null
  error: string | null
}

// 2.5 words per second is a comfortable voiceover pace.
export function targetWordCount(duration: number): number {
  const seconds = Math.max(5, Math.min(120, Math.round(duration)))
  return Math.round(seconds * 2.5)
}

/**
 * Rewrite a voiceover script so it lands close to the target word count.
 * Falls back to a hard word-slice if the model call fails — we never want
 * compose to die because of a script-scaling step.
 */
export async function scaleVoiceoverScript(rawScript: string, targetWords: number): Promise<string> {
  const cleanInput = (rawScript ?? '').trim()
  if (!cleanInput) return ''

  const words = cleanInput.split(/\s+/).filter(Boolean)
  // If already close to target (±15%), don't bother round-tripping to OpenAI.
  const lo = Math.floor(targetWords * 0.85)
  const hi = Math.ceil(targetWords * 1.15)
  if (words.length >= lo && words.length <= hi) return cleanInput

  try {
    const { openai } = await import('@/lib/openai')
    const completion = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a viral short-form scriptwriter. You rewrite scripts to a precise word count while keeping the hook, the core idea, and a strong CTA. Reply with the script text only — no quotes, no markdown.',
          },
          {
            role: 'user',
            content: `Rewrite this voiceover script so it reads as ${targetWords} words (±5%). Keep the hook in the first sentence, the payoff in the middle, and finish with a call to visit www.shortsforge.com. Plain prose only — no scene labels, no stage directions.\n\nSCRIPT:\n${cleanInput}`,
          },
        ],
        temperature: 0.7,
        max_tokens: Math.min(800, Math.max(120, targetWords * 4)),
      },
      { timeout: 20000 }
    )
    const scaled = completion.choices[0]?.message?.content?.trim() ?? ''
    if (scaled) return scaled
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[compose] scaleVoiceoverScript failed, falling back:', msg)
  }

  // Fallback — naive truncate / pad.
  if (words.length > targetWords) return words.slice(0, targetWords).join(' ')
  return cleanInput
}

export async function generateTTS(script: string): Promise<Buffer> {
  const input = script.length > 3800 ? script.slice(0, 3800) : script
  const { openai } = await import('@/lib/openai')
  const speech = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'onyx',
    input,
  })
  return Buffer.from(await speech.arrayBuffer())
}

export async function uploadVoiceoverToSupabase(userId: string, buffer: Buffer): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase storage credentials are not configured.')
  }
  const fileName = `vo-${userId.slice(0, 8)}-${Date.now()}.mp3`
  const res = await fetch(`${supabaseUrl}/storage/v1/object/voiceovers/${fileName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'audio/mpeg',
    },
    body: buffer,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Voiceover upload failed (${res.status}): ${detail.slice(0, 200)}`)
  }
  return `${supabaseUrl}/storage/v1/object/public/voiceovers/${fileName}`
}

interface CreatomateElement {
  type: 'video' | 'audio' | 'text' | 'shape'
  track: number
  time: number
  duration: number
  source?: string
  text?: string
  x?: string
  y?: string
  width?: string
  height?: string
  fit?: string
  volume?: string
  fill_color?: string
  stroke_color?: string
  stroke_width?: number
  font_family?: string
  font_size?: number
  font_weight?: string
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000
}

/**
 * Build a Creatomate source JSON: video clips tiled to fill `duration`,
 * voiceover audio across the full timeline, captions evenly distributed,
 * and a CTA in the last 2.5 seconds.
 */
export function buildCreatomateSource({
  clipUrls,
  voiceoverUrl,
  sceneCaptions,
  duration,
}: ComposeInputs): Record<string, unknown> {
  const totalDuration = clamp(Math.round(duration), 5, 90)
  const cleanClips = clipUrls.filter((u) => typeof u === 'string' && u.trim().length > 0)
  if (cleanClips.length === 0) {
    throw new Error('No video clips provided to compose.')
  }

  const elements: CreatomateElement[] = []

  // Track 1 — solid background so the video never shows a transparent gap.
  elements.push({
    type: 'shape',
    track: 1,
    time: 0,
    duration: totalDuration,
    x: '50%',
    y: '50%',
    width: '100%',
    height: '100%',
    fill_color: '#08080f',
  })

  // Track 2 — tile / loop the clips to fill the full duration.
  // Each Runway clip is 10s. We loop them in order until we cover totalDuration.
  const CLIP_LEN = 10
  let cursor = 0
  let i = 0
  while (cursor < totalDuration) {
    const remaining = totalDuration - cursor
    const segLen = round3(Math.min(CLIP_LEN, remaining))
    const url = cleanClips[i % cleanClips.length]
    elements.push({
      type: 'video',
      track: 2,
      time: round3(cursor),
      duration: segLen,
      source: url,
      fit: 'cover',
      x: '50%',
      y: '50%',
      width: '100%',
      height: '100%',
      volume: '0%',
    })
    cursor += segLen
    i += 1
  }

  // Track 3 — soft dark overlay so caption text always reads on any clip.
  elements.push({
    type: 'shape',
    track: 3,
    time: 0,
    duration: totalDuration,
    x: '50%',
    y: '50%',
    width: '100%',
    height: '100%',
    fill_color: 'rgba(0,0,0,0.35)',
  })

  // Track 4 — voiceover for the full duration.
  elements.push({
    type: 'audio',
    track: 4,
    time: 0,
    duration: totalDuration,
    source: voiceoverUrl,
    volume: '100%',
  })

  // Track 5 — captions distributed evenly across the duration (minus CTA tail).
  const captionsClean = sceneCaptions
    .map((c) => (c ?? '').toString().trim())
    .filter((c) => c.length > 0)
  if (captionsClean.length > 0) {
    const captionWindow = Math.max(2, totalDuration - CTA_TAIL_SECONDS)
    const perCaption = round3(captionWindow / captionsClean.length)
    captionsClean.forEach((caption, idx) => {
      elements.push({
        type: 'text',
        track: 5,
        time: round3(idx * perCaption),
        duration: perCaption,
        text: caption,
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

  // Track 6 — CTA in the final 2.5s.
  const ctaTime = Math.max(0, totalDuration - CTA_TAIL_SECONDS)
  elements.push({
    type: 'text',
    track: 6,
    time: round3(ctaTime),
    duration: Math.min(CTA_TAIL_SECONDS, totalDuration),
    text: CTA_TEXT,
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

  return {
    output_format: 'mp4',
    width: 1080,
    height: 1920,
    frame_rate: 30,
    duration: totalDuration,
    elements,
  }
}

export async function submitCreatomateRender(source: Record<string, unknown>): Promise<string> {
  const key = process.env.CREATOMATE_API_KEY
  if (!key) throw new Error('CREATOMATE_API_KEY is not configured.')

  const res = await fetch(`${CREATOMATE_BASE}/renders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source }),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Creatomate rejected the render (${res.status}): ${text.slice(0, 300)}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Creatomate returned a non-JSON response.')
  }

  const first = Array.isArray(parsed) ? parsed[0] : parsed
  const obj = first as { id?: string } | null
  if (!obj || typeof obj.id !== 'string' || !obj.id) {
    throw new Error('Creatomate returned no render id.')
  }
  return obj.id
}

export async function pollCreatomateRender(renderId: string): Promise<CreatomateRenderState> {
  const key = process.env.CREATOMATE_API_KEY
  if (!key) throw new Error('CREATOMATE_API_KEY is not configured.')

  const res = await fetch(`${CREATOMATE_BASE}/renders/${encodeURIComponent(renderId)}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Creatomate lookup failed (${res.status})`)
  }

  const data = (await res.json()) as {
    status?: string
    url?: string
    error_message?: string
    progress?: number
  }

  const raw = (data.status ?? '').toLowerCase()
  let status: CreatomateRenderState['status']
  switch (raw) {
    case 'succeeded':
      status = 'succeeded'
      break
    case 'failed':
      status = 'failed'
      break
    case 'cancelled':
      status = 'cancelled'
      break
    case 'planned':
      status = 'planned'
      break
    case 'waiting':
      status = 'waiting'
      break
    case 'transcribing':
      status = 'transcribing'
      break
    case 'rendering':
      status = 'rendering'
      break
    default:
      status = 'unknown'
  }

  let progress: number
  if (typeof data.progress === 'number' && data.progress >= 0 && data.progress <= 100) {
    progress = Math.round(data.progress)
  } else {
    switch (status) {
      case 'planned':
        progress = 5
        break
      case 'waiting':
        progress = 10
        break
      case 'transcribing':
        progress = 25
        break
      case 'rendering':
        progress = 60
        break
      case 'succeeded':
        progress = 100
        break
      case 'failed':
      case 'cancelled':
        progress = 0
        break
      default:
        progress = 15
    }
  }

  return {
    status,
    progress,
    url: typeof data.url === 'string' ? data.url : null,
    error: typeof data.error_message === 'string' ? data.error_message : null,
  }
}
