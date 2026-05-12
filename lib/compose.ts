// Push #026 — final-video composition pipeline.
//
// After Runway finishes its 10s silent visual clip(s) we still don't have a
// shippable video. This module takes those clips plus the brief's
// voiceover_script + scene captions and produces a single composed MP4 with
// audio and burned-in captions, with the correct total duration.
//
// Steps:
//   1. Generate TTS audio from voiceover_script (OpenAI TTS, voice "onyx").
//   2. Upload the mp3 to Supabase Storage (public `voiceovers` bucket).
//   3. Submit a Creatomate composition that:
//        - concats the Runway clip URLs on the video track
//        - adds the TTS audio on the audio track
//        - burns scene captions on a text track
//        - appends the www.shortsforge.com CTA in the last ~2s
//   4. Caller polls Creatomate via /api/render/[id] (existing endpoint) to
//      get the final MP4 URL.
//
// Honesty rules (from the push #026 spec):
//   - Credits are charged only after `final_video_url` exists.
//   - If CREATOMATE_API_KEY is missing OR composition fails, the caller MUST
//     refund/skip credit deduction. We never claim "complete with audio" for
//     a silent clip.

import { openai } from './openai'

export interface ComposeInput {
  userId: string
  clipUrls: string[]            // sequence of Runway clip URLs (each ~10s)
  voiceoverScript: string       // full narration
  sceneCaptions: string[]       // one short caption per Runway clip
  totalDurationSec: number      // 10 / 30 / 50
}

export interface ComposeStartResult {
  renderId: string
  voiceoverUrl: string | null   // sidecar mp3 (null if TTS or upload failed)
  composedDurationSec: number   // duration written into the Creatomate source
}

const RUNWAY_CLIP_SECONDS = 10
const CTA_TAIL_SECONDS = 2.5

// ─── TTS ───────────────────────────────────────────────────────────────────
async function generateTTS(script: string): Promise<Buffer | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[compose] OPENAI_API_KEY missing — skipping TTS')
    return null
  }
  const input = script.trim().slice(0, 4000)
  if (!input) return null
  try {
    const speech = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'onyx',
      input,
    })
    return Buffer.from(await speech.arrayBuffer())
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[compose] TTS generation failed:', msg)
    return null
  }
}

async function uploadVoiceover(userId: string, buffer: Buffer): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.warn('[compose] supabase storage creds missing — skipping VO upload')
    return null
  }
  const fileName = `vo-${userId.slice(0, 8)}-${Date.now()}.mp3`
  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/voiceovers/${fileName}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'audio/mpeg',
      },
      body: new Uint8Array(buffer),
    })
    if (!res.ok) {
      console.error('[compose] VO upload failed:', res.status, await res.text().catch(() => ''))
      return null
    }
    return `${supabaseUrl}/storage/v1/object/public/voiceovers/${fileName}`
  } catch (err) {
    console.error('[compose] VO upload threw:', err)
    return null
  }
}

// ─── Captions ──────────────────────────────────────────────────────────────
// Split a long caption into ~3-4 word sub-chunks so each on-screen line stays
// readable. Each clip gets its 10 seconds divided evenly across its sub-chunks.
function splitCaption(text: string, maxWords = 4): string[] {
  const words = text.trim().replace(/[.!?]+$/g, '').split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  if (words.length <= maxWords) return [words.join(' ')]
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(' '))
  }
  return chunks
}

// ─── Creatomate source builder ─────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCreatomateSource(input: {
  clipUrls: string[]
  voiceoverUrl: string | null
  sceneCaptions: string[]
  totalDurationSec: number
}): { source: Record<string, unknown>; duration: number } {
  const { clipUrls, voiceoverUrl, sceneCaptions, totalDurationSec } = input

  // Each Runway clip is RUNWAY_CLIP_SECONDS long. The composed duration is
  // either the requested duration or the actual covered seconds — pick the
  // smaller so we never trim a clip mid-frame.
  const coveredByClips = clipUrls.length * RUNWAY_CLIP_SECONDS
  const finalDur = Math.max(RUNWAY_CLIP_SECONDS, Math.min(totalDurationSec, coveredByClips))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elements: any[] = []

  // Track 1 — dark background under everything (covers any letterboxing on
  // off-ratio clips Runway might hand back).
  elements.push({
    type: 'shape',
    track: 1,
    time: 0,
    duration: finalDur,
    x: '50%', y: '50%',
    width: '100%', height: '100%',
    fill_color: '#08080f',
  })

  // Track 2 — Runway clips, concatenated. Each clip is muted because the
  // visuals are silent and we put TTS on a dedicated audio track.
  let cursor = 0
  clipUrls.forEach((url) => {
    if (cursor >= finalDur) return
    const clipDur = Math.min(RUNWAY_CLIP_SECONDS, finalDur - cursor)
    elements.push({
      type: 'video',
      track: 2,
      time: cursor,
      duration: clipDur,
      source: url,
      fit: 'cover',
      x: '50%', y: '50%',
      width: '100%', height: '100%',
      volume: '0%',
    })
    cursor += clipDur
  })

  // Track 3 — TTS audio. Spans the whole video; Creatomate clamps it to
  // `finalDur` when the track is longer than the composition.
  if (voiceoverUrl) {
    elements.push({
      type: 'audio',
      track: 3,
      time: 0,
      duration: finalDur,
      source: voiceoverUrl,
      volume: '100%',
    })
  }

  // Track 4 — caption overlays, one window per Runway clip (with the
  // caption split into ~4-word sub-chunks for legibility).
  let captionCursor = 0
  for (let i = 0; i < clipUrls.length; i++) {
    if (captionCursor >= finalDur) break
    const slot = Math.min(RUNWAY_CLIP_SECONDS, finalDur - captionCursor)
    const raw = (sceneCaptions[i] ?? '').trim()
    const chunks = raw ? splitCaption(raw, 4) : []
    if (chunks.length > 0) {
      const each = slot / chunks.length
      chunks.forEach((chunk, ci) => {
        elements.push({
          type: 'text',
          track: 4,
          time: Math.round((captionCursor + ci * each) * 1000) / 1000,
          duration: Math.round(each * 1000) / 1000,
          text: chunk,
          x: '50%', y: '72%',
          width: '86%',
          font_family: 'Montserrat',
          font_size: 64,
          font_weight: '900',
          fill_color: '#ffffff',
          stroke_color: 'rgba(0,0,0,0.95)',
          stroke_width: 4,
        })
      })
    }
    captionCursor += slot
  }

  // Track 5 — CTA at the end. We pin it to the last ~2.5s so it always lands
  // in the final beat regardless of the requested duration.
  const ctaTime = Math.max(0, finalDur - CTA_TAIL_SECONDS)
  elements.push({
    type: 'text',
    track: 5,
    time: Math.round(ctaTime * 1000) / 1000,
    duration: Math.min(CTA_TAIL_SECONDS, finalDur),
    text: 'www.shortsforge.com',
    x: '50%', y: '92%',
    width: '80%',
    font_family: 'Montserrat',
    font_size: 32,
    font_weight: '800',
    fill_color: '#ffffff',
    stroke_color: 'rgba(99,102,241,0.95)',
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

  return { source, duration: finalDur }
}

// ─── Public entry point ────────────────────────────────────────────────────
// Generates TTS, uploads it, submits the Creatomate render, and returns the
// render id. Throws on hard failures so the caller can leave credits intact.
export async function startComposition(input: ComposeInput): Promise<ComposeStartResult> {
  const { userId, clipUrls, voiceoverScript, sceneCaptions, totalDurationSec } = input

  if (!clipUrls.length) {
    throw new Error('No Runway clips to compose from.')
  }
  if (!process.env.CREATOMATE_API_KEY) {
    // The caller logs + refunds; we surface this as a hard error so we never
    // silently mark a silent-clip generation as "completed with audio".
    throw new Error('CREATOMATE_API_KEY is not configured.')
  }

  console.log(
    `[compose] starting — user=${userId.slice(0, 8)} clips=${clipUrls.length} ` +
    `duration=${totalDurationSec}s vo_chars=${voiceoverScript.length} captions=${sceneCaptions.length}`,
  )

  // Step 1+2: TTS + upload. Both are best-effort — if either fails we still
  // submit the composition without an audio track so we at least get captions
  // and correct duration. The caller's credit-charge rule (only on success)
  // covers the case where the final output is unsatisfactory.
  let voiceoverUrl: string | null = null
  if (voiceoverScript.trim().length > 0) {
    const buf = await generateTTS(voiceoverScript)
    if (buf) {
      voiceoverUrl = await uploadVoiceover(userId, buf)
      console.log(`[compose] voiceover ${voiceoverUrl ? 'uploaded' : 'upload failed'} (${buf.length} bytes)`)
    }
  } else {
    console.warn('[compose] voiceover_script is empty')
  }

  // Step 3: build + submit Creatomate composition.
  const { source, duration } = buildCreatomateSource({
    clipUrls,
    voiceoverUrl,
    sceneCaptions,
    totalDurationSec,
  })

  let res: Response
  try {
    res = await fetch('https://api.creatomate.com/v1/renders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CREATOMATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source }),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Creatomate unreachable: ${msg}`)
  }

  const responseText = await res.text().catch(() => '')
  if (!res.ok) {
    console.error('[compose] Creatomate rejected:', res.status, responseText.slice(0, 400))
    throw new Error(`Creatomate rejected: ${responseText.slice(0, 200)}`)
  }

  let data: { id?: string; status?: string } | Array<{ id?: string; status?: string }>
  try {
    data = JSON.parse(responseText)
  } catch {
    throw new Error('Creatomate returned invalid JSON.')
  }
  const first = Array.isArray(data) ? data[0] : data
  const renderId = first?.id
  if (!renderId) {
    console.error('[compose] no render id in response:', responseText.slice(0, 400))
    throw new Error('Creatomate returned no render id.')
  }

  console.log(`[compose] submitted — renderId=${renderId} duration=${duration}s voiceover=${!!voiceoverUrl}`)

  return {
    renderId,
    voiceoverUrl,
    composedDurationSec: duration,
  }
}

// ─── Status check ─────────────────────────────────────────────────────────
export type ComposeStatus =
  | { kind: 'rendering'; progress: number }
  | { kind: 'succeeded'; url: string }
  | { kind: 'failed'; reason: string }

export async function checkComposition(renderId: string): Promise<ComposeStatus> {
  if (!process.env.CREATOMATE_API_KEY) {
    return { kind: 'failed', reason: 'CREATOMATE_API_KEY is not configured.' }
  }
  let res: Response
  try {
    res = await fetch(`https://api.creatomate.com/v1/renders/${encodeURIComponent(renderId)}`, {
      headers: { Authorization: `Bearer ${process.env.CREATOMATE_API_KEY}` },
      cache: 'no-store',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { kind: 'failed', reason: `Creatomate unreachable: ${msg}` }
  }
  if (!res.ok) {
    return { kind: 'failed', reason: `Creatomate ${res.status}` }
  }
  const data = (await res.json().catch(() => ({}))) as {
    status?: string
    url?: string
    error_message?: string
    progress?: number
  }
  const status = (data.status ?? '').toLowerCase()
  if (status === 'succeeded') {
    if (!data.url) return { kind: 'failed', reason: 'No URL on succeeded render.' }
    return { kind: 'succeeded', url: data.url }
  }
  if (status === 'failed' || status === 'cancelled') {
    return { kind: 'failed', reason: data.error_message ?? `Render ${status}.` }
  }
  const rawProgress = typeof data.progress === 'number' ? data.progress : null
  const progressFromStatus: Record<string, number> = {
    planned: 5, waiting: 10, transcribing: 25, rendering: 60,
  }
  const progress = rawProgress ?? progressFromStatus[status] ?? 15
  return { kind: 'rendering', progress: Math.max(0, Math.min(100, Math.round(progress))) }
}
