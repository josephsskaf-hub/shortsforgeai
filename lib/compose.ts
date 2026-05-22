// NOTE: do NOT statically `import { openai } from '@/lib/openai'` here.
// The compose-status route only needs the Creatomate helpers and we don't
// want to trigger OpenAI client instantiation (which reads OPENAI_API_KEY at
// module load) when it isn't needed. The TTS / script-scaling functions
// dynamically import it below.

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildCaptionSegments, pickHighlightWord, type CaptionSegment } from '@/lib/openai'

const CREATOMATE_BASE = 'https://api.creatomate.com/v1'
const CTA_TEXT = 'shortsforgeai.com'
const CTA_TAIL_SECONDS = 2.5
// Push #064 — yellow used for the per-caption highlight word overlay.
const HIGHLIGHT_COLOR = '#FFD700'
// Push #049 — bucket name lives here so we never typo it across the
// upload + URL-build code paths. If we ever rename the bucket, change
// this single constant.
export const VOICEOVER_BUCKET = 'voiceovers'

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
   * Push #158 — real measured duration (seconds) of the generated TTS mp3.
   * The caption window is sized to this instead of the requested duration,
   * which assumed a fixed 2.5 words/sec pace the real audio never matched.
   * Optional: when absent the window falls back to the requested duration.
   */
  realAudioDuration?: number
  /**
   * Push #175 — optional pre-computed word-level timing from Whisper
   * transcription. Each entry aligns with the corresponding caption segment
   * produced by buildCaptionSegments(voiceoverScript, 7). When present, the
   * caption builder uses these exact timestamps instead of the proportional
   * word-count approximation, eliminating caption/narrator desync.
   */
  whisperTimings?: Array<{ time: number; duration: number }>
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
            content: `Rewrite this voiceover script so it reads as ${targetWords} words (±5%). Keep the hook in the first sentence, the payoff in the middle, and end with a strong payoff line. Plain prose only — no scene labels, no stage directions.\n\nSCRIPT:\n${cleanInput}`,
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

// OpenAI tts-1 emits constant-bitrate MP3 at ~128 kbps.
const TTS_MP3_BITRATE_BPS = 128_000

/**
 * Push #158 — estimate the real playback duration (seconds) of a TTS mp3
 * buffer without any external dependency. `music-metadata` is not installed,
 * so we use the size/bitrate relationship: at CBR, duration ≈ bytes * 8 /
 * bitrate. OpenAI tts-1 returns ~128 kbps mp3, so duration ≈ bytes / 16000.
 *
 * Returns 0 when the buffer is empty/unparseable — callers MUST treat 0 as
 * "unknown" and fall back to the requested-duration window.
 */
export function estimateMp3DurationSeconds(buffer: Buffer): number {
  if (!buffer || buffer.length === 0) return 0
  const bytesPerSecond = TTS_MP3_BITRATE_BPS / 8
  const seconds = buffer.length / bytesPerSecond
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0
}

// ---------------------------------------------------------------------------
// Push #175 — Whisper-based caption sync helpers
// ---------------------------------------------------------------------------

export interface WhisperWord {
  word: string
  start: number
  end: number
}

/**
 * Call OpenAI Whisper on the TTS audio buffer to obtain word-level timestamps.
 * Returns an empty array if the call fails so a Whisper outage never blocks
 * the render — proportional distribution is the fallback.
 */
export async function transcribeTTSWithTimestamps(buffer: Buffer): Promise<WhisperWord[]> {
  try {
    const { openai } = await import('@/lib/openai')
    const blob = new Blob(
      [new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)],
      { type: 'audio/mpeg' },
    )
    const file = new File([blob], 'voiceover.mp3', { type: 'audio/mpeg' })
    // verbose_json + word granularity returns {word, start, end} per token.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transcription: any = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: file as unknown as Parameters<typeof openai.audio.transcriptions.create>[0]['file'],
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    } as Parameters<typeof openai.audio.transcriptions.create>[0])
    const words: WhisperWord[] = transcription?.words ?? []
    console.log(`[compose] Whisper transcribed ${words.length} words`)
    return words
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[compose] Whisper transcription failed, using proportional fallback:', msg)
    return []
  }
}

/**
 * Map Whisper word-level timestamps to caption segment boundaries.
 *
 * Strategy: sequential word-count assignment.  Each caption segment owns
 * the next N words from the Whisper transcript (N = word count of that
 * segment's text).  The segment starts when its first word starts and ends
 * when the next segment starts (or at the caption-window end for the last).
 *
 * Returns [{time, duration}] aligned 1:1 with `segments`, or [] on failure.
 */
export function mapWhisperTimingsToSegments(
  words: WhisperWord[],
  segments: Array<{ text: string }>,
  totalAudioDuration: number,
  ctaTailSeconds: number,
): Array<{ time: number; duration: number }> {
  if (words.length === 0 || segments.length === 0) return []

  const result: Array<{ time: number; duration: number }> = []
  let wIdx = 0

  for (let i = 0; i < segments.length; i++) {
    const nWords = Math.max(1, (segments[i].text ?? '').trim().split(/\s+/).filter(Boolean).length)

    if (wIdx >= words.length) {
      console.warn('[compose] mapWhisperTimings: ran out of words at segment', i)
      return []
    }

    const segStartWord = words[wIdx]
    const captionWindowEnd = Math.max(0, totalAudioDuration - ctaTailSeconds)
    const isLast = i === segments.length - 1
    const nextWordStart =
      !isLast && wIdx + nWords < words.length
        ? words[wIdx + nWords].start
        : captionWindowEnd
    const duration = Math.max(0.1, nextWordStart - segStartWord.start)

    result.push({
      time: Math.round(segStartWord.start * 1000) / 1000,
      duration: Math.round(duration * 1000) / 1000,
    })
    wIdx += nWords
  }

  return result
}

function wordCount(s: string): number {
  const t = (s ?? '').trim()
  if (!t) return 0
  return t.split(/\s+/).length
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
  enter_transition?: { type: string; duration: number }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000
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
    enter_transition: { type: 'fade', duration: 0.15 },
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
  realAudioDuration,
  whisperTimings,
}: ComposeInputs): Record<string, unknown> {
  // Push #199 — use the REAL TTS audio duration as the master timeline length
  // instead of the user-requested duration. This eliminates both the "black
  // screen at the end" (TTS shorter than requested) and the "narration cut off"
  // (TTS longer than requested) problems. The user-selected duration still
  // influences the word-count target in scaleVoiceoverScript, so "45s" still
  // produces a ~45s video — but the exact length is now always driven by the
  // actual audio, never by an arbitrary integer. We cap at 90s and floor at 5s
  // as a sanity guard, and fall back to the requested duration if the TTS
  // measurement failed or returned an implausible value.
  const masterDuration =
    realAudioDuration && realAudioDuration > 4 && realAudioDuration < 120
      ? realAudioDuration
      : duration
  const totalDuration = clamp(Math.ceil(masterDuration * 10) / 10, 5, 90)
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
  // Push #202 — cross-dissolve between clips: every clip after the first
  // gets enter_transition fade (0.4s) so there is never a hard cut/gap at
  // clip boundaries. Creatomate blends adjacent clips on the same track
  // at their shared boundary, producing a smooth dissolve at zero extra cost.
  const CLIP_LEN = 10
  const TRANSITION_LEN = 0.4
  let cursor = 0
  let i = 0
  while (cursor < totalDuration) {
    const remaining = totalDuration - cursor
    const segLen = round3(Math.min(CLIP_LEN, remaining))
    const url = cleanClips[i % cleanClips.length]
    const elem: CreatomateElement = {
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
    }
    if (i > 0) {
      elem.enter_transition = { type: 'fade', duration: TRANSITION_LEN }
    }
    elements.push(elem)
    cursor = round3(cursor + segLen)
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

  // Track 4 — voiceover. Duration = actual audio length so Creatomate
  // doesn't pad or truncate the audio file. totalDuration already equals
  // realAudioDuration (see master-duration logic above), so this is a
  // no-op in normal operation; it acts as an explicit guard for edge cases.
  const audioDuration = round3(
    masterDuration && masterDuration > 4 ? masterDuration : totalDuration
  )
  elements.push({
    type: 'audio',
    track: 4,
    time: 0,
    duration: audioDuration,
    source: voiceoverUrl,
    volume: '100%',
  })

  // Track 5 — captions. Push #066 — ≤7-word viral-style segments with a
  // per-segment highlight word so the renderer can paint the line yellow
  // when an impactful keyword is present. Caption text comes from the
  // voiceover script first so it matches what the narrator says; falls back
  // to scene descriptions only when no script is available.
  //
  // Push #158 — two desync fixes:
  //   1. The window is sized to the REAL measured audio duration
  //      (realAudioDuration - CTA tail), not the requested duration. The
  //      old code assumed a fixed 2.5 wps pace the TTS never actually hit.
  //   2. Slots are word-count-proportional, not equal width — a 2-word
  //      caption no longer holds the screen as long as a 7-word one, so
  //      captions track the narration cadence instead of drifting.
  const scriptSegments = buildCaptionSegments(voiceoverScript, 7)
  const captionsClean: CaptionSegment[] = scriptSegments.length > 0
    ? scriptSegments
    : sceneCaptions
        .map((c) => (c ?? '').toString().trim())
        .filter((c) => c.length > 0)
        .map((text) => ({ text, highlight: pickHighlightWord(text) }))
  if (captionsClean.length > 0) {
    // Real audio is usually shorter than the requested duration; cap at
    // totalDuration so a long take can't push captions past the video end.
    const measured = realAudioDuration && realAudioDuration > 0 ? realAudioDuration : totalDuration
    const captionWindow = Math.max(2, Math.min(measured, totalDuration) - CTA_TAIL_SECONDS)
    const totalWords = captionsClean.reduce((sum, c) => sum + wordCount(c.text), 0) || captionsClean.length
    // Push #175 — use Whisper word-level timestamps when available. Fall back
    // to proportional word-count distribution only when transcription was
    // absent, failed, or returned a different segment count.
    const hasWhisperTimings =
      Array.isArray(whisperTimings) && whisperTimings.length === captionsClean.length
    let elapsed = 0
    captionsClean.forEach((segment, idx) => {
      let time: number
      let slot: number
      if (hasWhisperTimings) {
        // Exact timings from Whisper — captions key to the narrator's actual
        // speech; no elapsed tracking needed.
        time = whisperTimings![idx].time
        slot = whisperTimings![idx].duration
      } else {
        // Proportional fallback: each segment gets a slice proportional to
        // word count. Last slot absorbs rounding drift.
        const portion = (wordCount(segment.text) || 1) / totalWords
        const isLast = idx === captionsClean.length - 1
        slot = isLast ? Math.max(0.1, captionWindow - elapsed) : portion * captionWindow
        time = elapsed
        elapsed += slot
      }
      const elementsForCaption = buildCaptionElements({
        text: segment.text,
        time: round3(time),
        duration: round3(slot),
        highlight: segment.highlight,
      })
      elements.push(...elementsForCaption)
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
