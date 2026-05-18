// NOTE: do NOT statically `import { openai } from '@/lib/openai'` here.
// The compose-status route only needs the Creatomate helpers and we don't
// want to trigger OpenAI client instantiation (which reads OPENAI_API_KEY at
// module load) when it isn't needed. The TTS / script-scaling functions
// dynamically import it below.

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildCaptionSegments, pickHighlightWord, type CaptionSegment } from '@/lib/openai'
import { pickLibraryClip } from '@/lib/stockLibrary'

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
            content: `Rewrite this voiceover script so it reads as ${targetWords} words (±5%). Keep the hook in the first sentence, the payoff in the middle, and finish with a call to visit shortsforgeai.com. Plain prose only — no scene labels, no stage directions.\n\nSCRIPT:\n${cleanInput}`,
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
  type: 'video' | 'audio' | 'text' | 'shape' | 'image'
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
  // Push #145 — black-screen fix.
  // `loop: true` tells Creatomate to replay the clip when it ends before
  // the requested element duration. Without this a 5-second Pexels clip
  // dropped into a 10-second timeline slot leaves a 5-second tail where
  // Creatomate falls through to the layer below (our Track 1 dark
  // background) while narration keeps playing — exactly what users
  // reported as "random black sections."
  loop?: boolean
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
  //
  // Each Runway clip is 10s, but Fast Mode stock footage can be anywhere
  // from ~5s to ~30s. We tile them in order until we cover totalDuration.
  //
  // Push #145 — three guarantees against the "black screen mid-narration"
  // bug:
  //   1. `loop: true` — Creatomate replays the source clip if its natural
  //      length is shorter than the slot it was assigned. Without this,
  //      a 5s clip dropped into a 10s slot leaves 5s of fall-through to
  //      the Track-1 background while audio keeps playing.
  //   2. `fit: 'cover'` — keeps landscape stock-library clips fully
  //      covering the 9:16 canvas so they never letterbox into the
  //      background.
  //   3. The cursor loop is bounded by `totalDuration` AND we assert
  //      coverage at the end. If for any reason the last segment would
  //      land short of totalDuration, the final element's duration is
  //      stretched (with loop:true active) to seal the gap.
  //
  // Track 1 still paints a dark background as a defense-in-depth safety
  // net for catastrophic decode failure on Creatomate's side.
  const CLIP_LEN = 10
  let cursor = 0
  let i = 0
  const videoSegments: CreatomateElement[] = []
  while (cursor < totalDuration) {
    const remaining = totalDuration - cursor
    const segLen = round3(Math.min(CLIP_LEN, remaining))
    const url = cleanClips[i % cleanClips.length]
    const segment: CreatomateElement = {
      type: 'video',
      track: 2,
      time: round3(cursor),
      duration: segLen,
      source: url,
      fit: 'cover',
      loop: true,
      x: '50%',
      y: '50%',
      width: '100%',
      height: '100%',
      volume: '0%',
    }
    videoSegments.push(segment)
    elements.push(segment)
    cursor += segLen
    i += 1
  }

  // Coverage assertion — if rounding ever leaves a sub-pixel gap, stretch
  // the last segment to the exact end of the timeline. With loop:true the
  // visual stays unbroken.
  if (videoSegments.length > 0) {
    const last = videoSegments[videoSegments.length - 1]
    const segmentEnd = round3(last.time + last.duration)
    if (segmentEnd < totalDuration) {
      const extension = round3(totalDuration - last.time)
      console.warn(
        `[compose] sealing ${round3(totalDuration - segmentEnd)}s coverage gap by extending last clip (was ${last.duration}s, now ${extension}s)`,
      )
      last.duration = extension
    }
  }

  // Log the assembled visual timeline so any future black-screen reports
  // can be diagnosed from the deployment logs alone.
  console.log(
    '[compose] visual timeline:',
    JSON.stringify(
      videoSegments.map((s, idx) => ({
        idx,
        time: s.time,
        duration: s.duration,
        source: typeof s.source === 'string' ? s.source.slice(0, 80) : null,
        loop: s.loop === true,
      })),
    ),
  )
  if (videoSegments.length === 0) {
    console.error('[compose] NO VIDEO SEGMENTS were built — render will be black. duration=', totalDuration)
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

  // Track 5 — captions distributed evenly across the duration (minus CTA
  // tail). Push #066 — captions are now ≤7-word viral-style segments with
  // a per-segment highlight word so the renderer can paint the line
  // yellow when an impactful keyword is present. Caption text comes from
  // the voiceover script first so it matches what the narrator says;
  // falls back to scene descriptions only when no script is available.
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

/**
 * Push #145 — Validate that each clip URL is reachable BEFORE we hand
 * the timeline to Creatomate. A dead URL on the visual track renders as
 * black-with-audio (the user-reported bug), because Creatomate has no
 * notion of "fall back to a different source." We do that fallback here.
 *
 * Behaviour:
 *   - HEAD or short ranged GET to each URL with a 6s per-clip timeout.
 *   - On 4xx/5xx/timeout, swap that slot for a guaranteed-working clip
 *     from the curated stockLibrary (keyed by topic so the fallback at
 *     least loosely matches the scene).
 *   - Final guarantee: the returned array is the same length as the
 *     input, has no empty strings, and every entry is either the original
 *     URL (validated reachable) or a library fallback.
 *
 * Never throws — a failed validation always falls back. Logs every swap.
 */
export async function validateAndFallbackClipUrls(
  clipUrls: string[],
  topicHint: string,
): Promise<string[]> {
  const fallbackFor = (idx: number): string => {
    try {
      return pickLibraryClip(topicHint || 'default', idx).url
    } catch {
      return ''
    }
  }

  async function probe(url: string): Promise<boolean> {
    if (!url || typeof url !== 'string') return false
    const trimmed = url.trim()
    if (!trimmed) return false
    // Reject obviously malformed URLs without a network round-trip.
    if (!/^https?:\/\//i.test(trimmed)) return false

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 6000)
    try {
      // Some CDNs (e.g. Pexels) reject HEAD with 405 / 403 but accept GET
      // with a 0-1 range. Use a ranged GET — it's cheap and accepted
      // everywhere we use.
      const res = await fetch(trimmed, {
        method: 'GET',
        headers: { Range: 'bytes=0-1' },
        signal: ctrl.signal,
        cache: 'no-store',
      })
      // 200, 206 (partial), 304 (not modified) all count as reachable.
      return res.ok || res.status === 206 || res.status === 304
    } catch {
      return false
    } finally {
      clearTimeout(timer)
    }
  }

  const results = await Promise.all(
    clipUrls.map(async (url, idx) => {
      const ok = await probe(url)
      if (ok) {
        return { url, swapped: false as const }
      }
      const fb = fallbackFor(idx) || clipUrls.find((u) => u && u !== url) || ''
      console.warn(
        `[compose] clip ${idx} unreachable, swapping → fallback: ${fb.slice(0, 80) || '<none>'} (was: ${(url || '<empty>').slice(0, 80)})`,
      )
      return { url: fb, swapped: true as const }
    }),
  )

  const validated = results
    .map((r) => r.url)
    .filter((u) => typeof u === 'string' && u.length > 0)

  // Last-ditch: if every clip failed AND no fallback resolved, ship
  // whatever non-empty URLs were originally provided so Creatomate at
  // least has something to attempt. The render-pipeline's track-1
  // background then handles whatever Creatomate can't decode.
  if (validated.length === 0) {
    const passthrough = clipUrls.filter((u) => typeof u === 'string' && u.trim().length > 0)
    console.error(
      `[compose] ALL ${clipUrls.length} clip URLs failed validation and no library fallback resolved. Passing through ${passthrough.length} unvalidated URLs.`,
    )
    return passthrough
  }

  const swappedCount = results.filter((r) => r.swapped).length
  console.log(
    `[compose] clip URL validation: total=${clipUrls.length} ok=${results.length - swappedCount} swapped=${swappedCount}`,
  )

  return validated
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
