// NOTE: do NOT statically `import { openai } from '@/lib/openai'` here.
// The compose-status route only needs the Creatomate helpers and we don't
// want to trigger OpenAI client instantiation (which reads OPENAI_API_KEY at
// module load) when it isn't needed. The TTS / script-scaling functions
// dynamically import it below.

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildCaptionSegments, isHighlightWord, pickHighlightWord, type CaptionSegment } from '@/lib/openai'

const CREATOMATE_BASE = 'https://api.creatomate.com/v1'
const CTA_TEXT = 'shortsforgeai.com'
const CTA_TAIL_SECONDS = 2.5
// Push #064 — yellow used for the per-caption highlight word overlay.
const HIGHLIGHT_COLOR = '#FFD700'
// Push #180 — minimum on-screen time per word. Whisper occasionally
// returns sub-100ms durations for fast filler words ("the", "a", "of"),
// which strobes the caption strip. We pad each word out to this floor so
// the eye can register it without the duration leaking into the next
// word's slot (we cap at the next word's start).
const WORD_MIN_DURATION = 0.18
// Push #049 — bucket name lives here so we never typo it across the
// upload + URL-build code paths. If we ever rename the bucket, change
// this single constant.
export const VOICEOVER_BUCKET = 'voiceovers'

/**
 * Push #180 — word-level timing returned by Whisper. The renderer turns
 * each entry into a Creatomate text element with precise time/duration so
 * the caption strip syncs to the actual voiceover instead of guessing
 * from word count alone.
 */
export interface WordTiming {
  word: string
  start: number
  end: number
}

export interface ComposeInputs {
  clipUrls: string[]
  voiceoverUrl: string
  /**
   * The narration text that the captions should be derived from. Push #031
   * fixed caption sync — captions are now segments of the actual spoken
   * script (one sentence per segment) rather than the visual scene
   * descriptions, so what the viewer reads matches what the narrator says.
   */
  voiceoverScript: string
  /**
   * Legacy: short caption strings (typically derived from scene visual
   * prompts). Used ONLY as a fallback when `voiceoverScript` is empty or
   * cannot be segmented.
   */
  sceneCaptions: string[]
  duration: number
  /**
   * Push #180 — word-level timings from Whisper. When present, captions
   * render one-word-at-a-time synced to the actual voiceover audio (TikTok
   * viral style). When absent, we fall back to the existing segment-based
   * caption strip so the render never fails for caption reasons.
   */
  wordTimings?: WordTiming[] | null
  /**
   * Push #180 — viewer-facing toggle. When `false` the renderer ships the
   * video without ANY caption strip (word- or segment-level). Default is
   * `true` (captions on) because captions are the single biggest driver of
   * retention on Shorts.
   */
  captionsEnabled?: boolean
}

export interface CreatomateRenderState {
  status: 'planned' | 'waiting' | 'transcribing' | 'rendering' | 'succeeded' | 'failed' | 'cancelled' | 'unknown'
  progress: number
  url: string | null
  error: string | null
}

// Push #180 — OpenAI's `onyx` voice on `tts-1` reads at roughly 2.7 words/sec
// at speed=1.0. We size the script to ~2.6 wps so audio comfortably fills the
// duration without the TTS audio overrunning the Creatomate timeline (which
// would cut the last word). For the audio-too-short case we lean on TTS
// `speed` (see `generateTTS`) rather than padding the script.
const WORDS_PER_SECOND_BASE = 2.6

export function targetWordCount(duration: number): number {
  const seconds = Math.max(5, Math.min(120, Math.round(duration)))
  return Math.round(seconds * WORDS_PER_SECOND_BASE)
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
  // Push #180 — tighter ±10% window. The wider ±15% window let too many
  // off-target scripts pass through unchanged, so 30s videos sometimes
  // narrated a 95-word script (≈37s of audio cut at 30s) while 60s
  // videos narrated a 130-word script with 12s of trailing silence.
  const lo = Math.floor(targetWords * 0.9)
  const hi = Math.ceil(targetWords * 1.1)
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
              'You are a viral short-form scriptwriter. You rewrite scripts to a precise word count while keeping the hook and the core idea. Reply with the script text only — no quotes, no markdown.',
          },
          {
            role: 'user',
            content: `Rewrite this voiceover script so it reads as ${targetWords} words (±5%). Keep the hook in the first sentence and the payoff in the middle. Plain prose only — no scene labels, no stage directions.\n\nSCRIPT:\n${cleanInput}`,
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

// Push #180 — duration-aware TTS pacing.
//
// onyx@tts-1 reads at roughly 2.7 wps at speed=1.0. After `scaleVoiceoverScript`
// the script should be at ~2.6 wps of duration, but the model occasionally
// over/undershoots. We compute a small TTS speed adjustment so the rendered
// audio fits the user's chosen duration:
//
//   speed = scriptWords / (targetSeconds * 2.7)
//
// Clamped to [0.92, 1.18] so the voice never sounds chipmunked or sluggish —
// these bounds match what we tested manually as imperceptible to most listeners.
// If `targetSeconds` is missing, we keep the default speed=1.0 (legacy behavior).
const TTS_BASELINE_WPS = 2.7
const TTS_SPEED_MIN = 0.92
const TTS_SPEED_MAX = 1.18

export function computeTTSSpeed(scriptWords: number, targetSeconds?: number): number {
  if (!targetSeconds || targetSeconds <= 0) return 1.0
  if (scriptWords <= 0) return 1.0
  const raw = scriptWords / (targetSeconds * TTS_BASELINE_WPS)
  return Math.max(TTS_SPEED_MIN, Math.min(TTS_SPEED_MAX, raw))
}

export async function generateTTS(
  script: string,
  opts: { targetSeconds?: number } = {},
): Promise<Buffer> {
  const input = script.length > 3800 ? script.slice(0, 3800) : script
  const wordCount = input.split(/\s+/).filter(Boolean).length
  const speed = computeTTSSpeed(wordCount, opts.targetSeconds)
  const { openai } = await import('@/lib/openai')
  console.log(
    `[compose] TTS request: words=${wordCount} targetSeconds=${opts.targetSeconds ?? 'none'} speed=${speed.toFixed(3)}`,
  )
  const speech = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'onyx',
    input,
    speed,
  })
  return Buffer.from(await speech.arrayBuffer())
}

/**
 * Push #180 — transcribe the freshly-generated voiceover with Whisper to
 * recover word-level timestamps. Output drives the word-by-word caption
 * highlight effect downstream.
 *
 * Cost: whisper-1 is $0.006/min, so a 45s short costs <$0.005 — well below
 * the noise floor of a credit. We still call this lazily (only when
 * captions are enabled) so disabling captions saves the round-trip.
 *
 * Failure mode is deliberately soft: if Whisper rate-limits, errors, or
 * returns no word array, we return `null`. The caller falls back to the
 * existing segment-based caption strip. Captions are a polish layer — they
 * must never break the render.
 */
export async function transcribeWordTimings(audioBuffer: Buffer): Promise<WordTiming[] | null> {
  if (!audioBuffer || audioBuffer.length === 0) return null
  try {
    const { openai } = await import('@/lib/openai')
    const { toFile } = await import('openai')
    const file = await toFile(audioBuffer, 'voiceover.mp3', { type: 'audio/mpeg' })
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    })
    const raw = (transcription as unknown as { words?: Array<{ word?: unknown; start?: unknown; end?: unknown }> }).words
    if (!Array.isArray(raw) || raw.length === 0) return null

    const words: WordTiming[] = []
    for (const entry of raw) {
      const w = typeof entry.word === 'string' ? entry.word.trim() : ''
      const start = typeof entry.start === 'number' ? entry.start : NaN
      const end = typeof entry.end === 'number' ? entry.end : NaN
      if (!w) continue
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue
      if (end <= start) continue
      words.push({ word: w, start, end })
    }
    if (words.length === 0) return null

    // Whisper output is already in playback order, but defend against
    // out-of-order edge cases — a single jumbled timestamp would make the
    // captions blink backwards on screen.
    words.sort((a, b) => a.start - b.start)
    return words
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[compose] transcribeWordTimings failed (captions will fall back to segments):', msg)
    return null
  }
}

// Push #049 — fix voiceover storage on staging.
//
// Root cause of the prior "Could not store the voiceover" failure:
//   1. The raw-fetch upload was missing the `apikey` header that the
//      Supabase Storage REST API requires alongside the Authorization
//      bearer. Supabase rejects auth-bearer-only Storage uploads.
//   2. Node's `Buffer` is not officially a fetch `BodyInit` (TypeScript
//      flags this), and in some Vercel runtimes the body was getting
//      serialised in an unexpected way, producing a 400 from Storage.
//   3. The error was swallowed — only res.status + first 200 chars were
//      surfaced, hiding the actual Supabase error.body the engineer
//      needed to fix the bucket / policy.
//
// Fix: route the upload through @supabase/supabase-js with the service-
// role key. The library sets the correct headers (apikey + Authorization),
// wraps the binary in a Blob, and returns a typed error object we log in
// full. We also auto-create the bucket on first upload if it doesn't
// exist (idempotent — repeat creates return a known error we ignore).
//
// Returns a public URL (the bucket is created as public, matching how
// Creatomate consumes the audio source — it must be reachable without
// auth headers).
let cachedAdminClient: SupabaseClient | null = null
function getAdminClient(): SupabaseClient {
  if (cachedAdminClient) return cachedAdminClient
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured.')
  }
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.')
  }
  cachedAdminClient = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedAdminClient
}

/**
 * Best-effort bucket bootstrap. If the bucket already exists we ignore
 * the "Bucket already exists" / 409 response. Any other error is
 * surfaced so the caller can see what's wrong.
 */
async function ensureVoiceoverBucket(admin: SupabaseClient): Promise<void> {
  const { error } = await admin.storage.createBucket(VOICEOVER_BUCKET, {
    public: true,
    fileSizeLimit: 25 * 1024 * 1024, // 25 MB is more than enough for ~3min mp3
    allowedMimeTypes: ['audio/mpeg', 'audio/mp3'],
  })
  if (!error) {
    console.log(`[compose] created storage bucket "${VOICEOVER_BUCKET}"`)
    return
  }
  const msg = (error.message ?? '').toLowerCase()
  // Supabase returns 409 / "already exists" / "duplicate" — all benign.
  if (
    msg.includes('already exists') ||
    msg.includes('duplicate') ||
    msg.includes('resource already')
  ) {
    return
  }
  // Anything else is an actual problem — log the full error and rethrow.
  console.error('[compose] ensureVoiceoverBucket error:', JSON.stringify(error))
  throw new Error(`Could not ensure storage bucket: ${error.message}`)
}

export async function uploadVoiceoverToSupabase(userId: string, buffer: Buffer): Promise<string> {
  console.log(
    `[compose] uploadVoiceoverToSupabase: user=${userId.slice(0, 8)} size=${buffer.length} bytes mime=audio/mpeg bucket=${VOICEOVER_BUCKET}`,
  )

  // Service-role admin client. Throws if env vars are missing — caller
  // converts that into the user-facing "service not configured" error.
  const admin = getAdminClient()

  // 1) Make sure the bucket exists. First upload of the deployment pays
  //    the bucket-create cost; subsequent uploads see "already exists"
  //    and skip.
  try {
    await ensureVoiceoverBucket(admin)
  } catch (bucketErr) {
    // ensureVoiceoverBucket already logged the full error — re-throw the
    // message verbatim so compose/route.ts can put it into its response.
    throw bucketErr
  }

  // 2) Upload. We wrap the Buffer in a Uint8Array view so the storage
  //    SDK serialises it correctly (Buffer is a subclass but the typing
  //    is happier with Uint8Array, which removes the pre-existing
  //    `BodyInit` TypeScript warning).
  const fileName = `vo-${userId.slice(0, 8)}-${Date.now()}.mp3`
  const filePath = fileName
  console.log(`[compose] storage upload path: ${VOICEOVER_BUCKET}/${filePath}`)

  const audioBytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const { data: uploadData, error: uploadError } = await admin.storage
    .from(VOICEOVER_BUCKET)
    .upload(filePath, audioBytes, {
      contentType: 'audio/mpeg',
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    // Surface the full Supabase error object so the operator sees the
    // root cause in logs (status / details / hint / code). We keep
    // SECRETS out — only the response from Supabase, never the service
    // key itself.
    console.error('[compose] supabase storage upload failed:', JSON.stringify({
      name: uploadError.name,
      message: uploadError.message,
      ...('statusCode' in uploadError ? { statusCode: (uploadError as { statusCode?: unknown }).statusCode } : {}),
      ...('error' in uploadError ? { error: (uploadError as { error?: unknown }).error } : {}),
    }))
    throw new Error(`Voiceover upload failed: ${uploadError.message}`)
  }

  console.log('[compose] supabase storage upload ok:', JSON.stringify(uploadData))

  // 3) Build the public URL. The bucket is created public above; the
  //    SDK returns the canonical public URL for the object.
  const { data: pub } = admin.storage.from(VOICEOVER_BUCKET).getPublicUrl(filePath)
  if (!pub?.publicUrl) {
    throw new Error('Voiceover upload succeeded but no public URL was returned.')
  }
  console.log(`[compose] voiceover public URL: ${pub.publicUrl}`)
  return pub.publicUrl
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
 * Measure the real playback length (seconds) of an MP3 buffer.
 *
 * Why this exists: OpenAI TTS returns MP3 whose actual length is almost
 * always a bit longer (or shorter) than the duration we asked the script to
 * fit. `computeTTSSpeed` nudges the pace toward the target but is clamped, so
 * the audio still over/undershoots. Driving the Creatomate render off the
 * fixed target then either cuts the voiceover off OR (because the word-by-word
 * caption strip is gated on `totalDuration - CTA tail`) drops the last few
 * seconds of captions. Measuring the audio and rendering to its true length
 * fixes both at once.
 *
 * Implementation: walk the MPEG audio frame headers and sum each frame's
 * (samplesPerFrame / sampleRate). Dependency-free and correct for both CBR
 * and VBR streams; a leading ID3v2 tag is skipped. Returns null if the buffer
 * doesn't parse as MP3 so the caller can fall back to the target duration.
 */
export function getMp3DurationSeconds(buffer: Buffer): number | null {
  if (!buffer || buffer.length < 4) return null

  let offset = 0

  // Skip a leading ID3v2 tag: 'ID3' + 2 version bytes + 1 flags byte + a
  // 4-byte synchsafe size (7 significant bits per byte).
  if (
    buffer.length > 10 &&
    buffer[0] === 0x49 && // 'I'
    buffer[1] === 0x44 && // 'D'
    buffer[2] === 0x33 // '3'
  ) {
    const tagSize =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
      (buffer[9] & 0x7f)
    offset = 10 + tagSize
  }

  // version bits: 00=MPEG2.5, 10=MPEG2, 11=MPEG1 (01 reserved).
  const MPEG1 = 3
  // Bitrate tables (kbps) keyed by "<versionGroup>-<layer>". versionGroup is
  // 1 for MPEG1, 2 for MPEG2/2.5. layer is 1/2/3.
  const BITRATES: Record<string, number[]> = {
    '1-1': [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 0],
    '1-2': [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 0],
    '1-3': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
    '2-1': [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256, 0],
    '2-2': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
    '2-3': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
  }
  const SAMPLE_RATES: Record<number, number[]> = {
    3: [44100, 48000, 32000, 0], // MPEG1
    2: [22050, 24000, 16000, 0], // MPEG2
    0: [11025, 12000, 8000, 0], // MPEG2.5
  }

  let duration = 0
  let frames = 0

  while (offset + 4 <= buffer.length) {
    // Frame sync = 11 set bits.
    if (buffer[offset] !== 0xff || (buffer[offset + 1] & 0xe0) !== 0xe0) {
      offset += 1
      continue
    }

    const b1 = buffer[offset + 1]
    const b2 = buffer[offset + 2]
    const versionBits = (b1 >> 3) & 0x03
    const layerBits = (b1 >> 1) & 0x03
    if (versionBits === 1 || layerBits === 0) {
      offset += 1
      continue
    }

    const bitrateIndex = (b2 >> 4) & 0x0f
    const sampleRateIndex = (b2 >> 2) & 0x03
    const padding = (b2 >> 1) & 0x01
    if (bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
      offset += 1
      continue
    }

    // layerBits: 01=Layer III, 10=Layer II, 11=Layer I.
    const layerNum = layerBits === 3 ? 1 : layerBits === 2 ? 2 : 3
    const versionGroup = versionBits === MPEG1 ? '1' : '2'
    const bitrate = (BITRATES[`${versionGroup}-${layerNum}`]?.[bitrateIndex] ?? 0) * 1000
    const sampleRate = SAMPLE_RATES[versionBits]?.[sampleRateIndex] ?? 0
    if (!bitrate || !sampleRate) {
      offset += 1
      continue
    }

    let samplesPerFrame: number
    if (layerNum === 1) samplesPerFrame = 384
    else if (layerNum === 3 && versionBits !== MPEG1) samplesPerFrame = 576
    else samplesPerFrame = 1152

    let frameLength: number
    if (layerNum === 1) {
      frameLength = (Math.floor((12 * bitrate) / sampleRate) + padding) * 4
    } else {
      frameLength = Math.floor((samplesPerFrame / 8) * (bitrate / sampleRate)) + padding
    }
    if (frameLength <= 0) {
      offset += 1
      continue
    }

    duration += samplesPerFrame / sampleRate
    frames += 1
    offset += frameLength
  }

  if (frames === 0 || duration <= 0) return null
  return round3(duration)
}

/**
 * Push #066 — build the Creatomate text element(s) for a single caption
 * slot. Renders ONE text element so captions never stack on screen.
 *
 * Visual rule (guided captions):
 *   - If the segment carries a highlight word, the whole caption is
 *     rendered in yellow (#FFD700). The viewer's eye locks onto
 *     high-impact moments without us doing fragile per-word positioning.
 *   - Otherwise the caption renders in white.
 *
 * Why not two layers / inline rich text:
 *   Push #064 used a separate floating yellow accent word above the
 *   white caption. In practice this read as two stacked subtitle lines
 *   and the positioning never landed cleanly on top of the matching
 *   word in the white caption. Per-word inline color via Creatomate
 *   rich-text markup is feature-gated across versions, so a malformed
 *   tag would render as literal `[color]` text — unacceptable.
 *   Whole-line color is the simplest path that's guaranteed to render
 *   correctly on every Creatomate template.
 *
 * Safety: the build is wrapped in try/catch and ALWAYS returns at least
 * the plain white caption element — a failed highlight decision can
 * never break the render.
 */
export function buildCaptionElements({
  text,
  time,
  duration,
  highlight,
}: {
  text: string
  time: number
  duration: number
  highlight?: string | null
}): CreatomateElement[] {
  const baseCaption: CreatomateElement = {
    type: 'text',
    track: 5,
    time,
    duration,
    text,
    x: '50%',
    y: '68%',
    width: '86%',
    font_family: 'Montserrat',
    font_size: 58,
    font_weight: '800',
    fill_color: '#ffffff',
    stroke_color: 'rgba(0,0,0,0.9)',
    stroke_width: 3,
  }

  try {
    const candidate = (highlight && highlight.trim()) || pickHighlightWord(text)
    if (candidate && candidate.trim().length > 0) {
      return [{ ...baseCaption, fill_color: HIGHLIGHT_COLOR }]
    }
    return [baseCaption]
  } catch {
    // Any failure picking the highlight falls back to plain white —
    // the render must never depend on the highlight decision.
    return [baseCaption]
  }
}

/**
 * Push #180 — word-by-word caption strip. Renders ONE Creatomate text
 * element per word, time-synced to the actual voiceover via Whisper word
 * timings. The visible word is the word currently being spoken, big and
 * centered low — the TikTok / viral-Shorts caption style.
 *
 * Color rule:
 *   - White (#ffffff) by default — the reader's baseline.
 *   - Yellow (#FFD700) for words in HIGHLIGHT_CANDIDATES (strange, hidden,
 *     forbidden, secret, etc.) — high-impact words pop.
 *
 * Timing rule:
 *   - Each word renders from its Whisper `start` to the next word's
 *     `start` (so words never overlap or leave a gap). The last word
 *     extends to its own `end` (capped at totalDuration - CTA tail so it
 *     never collides with the call-to-action).
 *   - Words shorter than WORD_MIN_DURATION are stretched up to that
 *     minimum, again clamped to the next word's start.
 *   - Words that start inside the CTA tail (last 2.5s) are dropped so the
 *     CTA reads cleanly.
 */
export function buildWordCaptionElements({
  words,
  totalDuration,
}: {
  words: WordTiming[]
  totalDuration: number
}): CreatomateElement[] {
  const ctaCutoff = Math.max(0, totalDuration - CTA_TAIL_SECONDS)
  const elements: CreatomateElement[] = []

  for (let i = 0; i < words.length; i++) {
    const w = words[i]
    const display = w.word.replace(/^\s+|\s+$/g, '')
    if (!display) continue
    if (w.start >= ctaCutoff) break

    const nextStart = i + 1 < words.length ? words[i + 1].start : w.end
    const naturalEnd = Math.max(w.end, w.start + WORD_MIN_DURATION)
    const cappedEnd = Math.min(naturalEnd, nextStart, ctaCutoff)
    const duration = cappedEnd - w.start
    if (duration <= 0) continue

    const color = isHighlightWord(display) ? HIGHLIGHT_COLOR : '#ffffff'
    elements.push({
      type: 'text',
      track: 5,
      time: round3(w.start),
      duration: round3(duration),
      text: display.toUpperCase(),
      x: '50%',
      y: '70%',
      width: '86%',
      font_family: 'Montserrat',
      font_size: 96,
      font_weight: '900',
      fill_color: color,
      stroke_color: 'rgba(0,0,0,0.95)',
      stroke_width: 6,
    })
  }

  return elements
}

/**
 * Build a Creatomate source JSON: video clips tiled to fill `duration`,
 * voiceover audio across the full timeline, captions evenly distributed,
 * and a CTA in the last 2.5 seconds.
 */
export function buildCreatomateSource({
  clipUrls,
  voiceoverUrl,
  voiceoverScript,
  sceneCaptions,
  duration,
  wordTimings,
  captionsEnabled = true,
}: ComposeInputs): Record<string, unknown> {
  // Keep the duration fractional — the caller passes the measured TTS audio
  // length (e.g. 47.3s). Rounding it down would clip the final word of the
  // voiceover and pull the word-caption CTA cutoff in by up to a second.
  // Clamp only as a sanity guard against a bogus parse.
  const totalDuration = round3(clamp(duration, 5, 120))
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
  //
  // fit: 'cover' is the right default for a 9:16 output canvas. Most clips
  // are already vertical 9:16 (Runway 720x1280, Pexels portrait HD), where
  // 'cover' and 'contain' produce identical output. The case that matters
  // is the curated stock-library fallback, which contains landscape clips
  // (Cloudinary 1280x720 etc.) — 'contain' would render those as a small
  // strip on a black canvas (the black-screen bug); 'cover' fills the
  // frame with a centered crop. Track 1 still paints a dark background as
  // a safety net for any decode failure.
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

  // Track 5 — captions.
  //
  // Push #180 — prefer word-by-word captions when Whisper word timings are
  // available. Each word becomes its own Creatomate text element, time-
  // synced to the actual voiceover, with high-impact words painted yellow
  // (#FFD700) and the rest white. Matches the viral TikTok/Shorts style.
  //
  // Fallback hierarchy (any layer breaking falls through to the next):
  //   1. word timings  → buildWordCaptionElements  (preferred, audio-accurate)
  //   2. voiceoverScript → 7-word segments via buildCaptionSegments
  //   3. sceneCaptions   → one caption per scene, evenly distributed
  //
  // `captionsEnabled = false` skips the strip entirely (viewer opted out).
  if (captionsEnabled) {
    let wordElementsAdded = 0
    if (Array.isArray(wordTimings) && wordTimings.length > 0) {
      const wordElements = buildWordCaptionElements({ words: wordTimings, totalDuration })
      elements.push(...wordElements)
      wordElementsAdded = wordElements.length
    }

    // Only fall back to segment captions when the word-level path produced
    // nothing — otherwise we'd double-stack two caption strips on screen.
    if (wordElementsAdded === 0) {
      const scriptSegments = buildCaptionSegments(voiceoverScript, 7)
      const captionsClean: CaptionSegment[] = scriptSegments.length > 0
        ? scriptSegments
        : sceneCaptions
            .map((c) => (c ?? '').toString().trim())
            .filter((c) => c.length > 0)
            .map((text) => ({ text, highlight: pickHighlightWord(text) }))
      if (captionsClean.length > 0) {
        const captionWindow = Math.max(2, totalDuration - CTA_TAIL_SECONDS)
        const perCaption = round3(captionWindow / captionsClean.length)
        captionsClean.forEach((segment, idx) => {
          const elementsForCaption = buildCaptionElements({
            text: segment.text,
            time: round3(idx * perCaption),
            duration: perCaption,
            highlight: segment.highlight,
          })
          elements.push(...elementsForCaption)
        })
      }
    }
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
