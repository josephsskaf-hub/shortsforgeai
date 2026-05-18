// NOTE: do NOT statically `import { openai } from '@/lib/openai'` here.
// The compose-status route only needs the Creatomate helpers and we don't
// want to trigger OpenAI client instantiation (which reads OPENAI_API_KEY at
// module load) when it isn't needed. The TTS / script-scaling functions
// dynamically import it below.

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

const CREATOMATE_BASE = 'https://api.creatomate.com/v1'
const CTA_TEXT = 'shortsforgeai.com'
const CTA_TAIL_SECONDS = 2.5
// Push #143 — yellow used to paint the currently-spoken word during the
// karaoke caption effect. Creatomate's `transcript_color` controls the
// active-word color; the static line color stays white.
const HIGHLIGHT_COLOR = '#FFD700'
// Push #143 — stable id we attach to the voiceover audio element so the
// transcript text element can reference it via `transcript_source`. Must
// match `VOICEOVER_TRACK_NAME` literally — Creatomate links the two by
// string equality on the audio element's `name`.
const VOICEOVER_TRACK_NAME = 'voiceover_audio'
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

// Push #143 — Creatomate element shape. The transcript_* fields drive
// karaoke-style auto-captions: Creatomate transcribes the referenced
// audio server-side (the "transcribing" status in pollCreatomateRender
// surfaces this) and renders one word at a time, painting the active
// word in `transcript_color` so the caption follows the narrator in
// real time.
interface CreatomateElement {
  type: 'video' | 'audio' | 'text' | 'shape'
  /** Stable id used by transcript_source links. Creatomate uses `name` as
   *  the reference key — not `id` — so we mirror that field name. */
  name?: string
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
  /** When true, a video clip shorter than its slot loops within the slot
   *  instead of freezing on the last frame / going black. */
  loop?: boolean
  volume?: string
  fill_color?: string
  stroke_color?: string
  stroke_width?: number
  font_family?: string
  font_size?: number
  font_weight?: string
  y_alignment?: string
  // Auto-transcript karaoke caption fields. Only the text element with
  // transcript_source set uses these — everything else leaves them
  // undefined and Creatomate ignores them.
  transcript_source?: string
  transcript_effect?: 'karaoke' | 'color'
  transcript_split?: 'word' | 'line'
  transcript_placement?: 'static' | 'animate'
  transcript_color?: string
  transcript_maximum_length?: number
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


function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000
}

/**
 * Push #143 — Karaoke caption element.
 *
 * Creatomate transcribes the voiceover audio server-side and exposes it
 * via the `transcript_source` field on a text element. We attach a
 * stable `name` to the audio element (VOICEOVER_TRACK_NAME) and point a
 * single text element at it. Creatomate then:
 *   - splits the transcript per-word (`transcript_split: 'word'`)
 *   - shows one short slot at a time (`transcript_maximum_length`)
 *   - paints the word being spoken in `transcript_color` (yellow)
 *   - timing comes from the audio itself, NOT from a pre-distributed
 *     timeline, so captions always follow the narrator
 *
 * Why this replaces the old per-segment text loop:
 *   The previous implementation chunked the script into 7-word slots
 *   and distributed them evenly across the timeline. The TTS audio
 *   does not pace itself evenly, so captions drifted out of sync with
 *   the voiceover. The transcript_source path delegates timing to
 *   Creatomate's transcriber, which is word-accurate.
 *
 * The text element's `duration` stops before the CTA tail so the
 * karaoke line never overlaps the final shortsforgeai.com call-to-action.
 */
function buildKaraokeCaptionElement(totalDuration: number): CreatomateElement {
  const captionWindow = Math.max(2, totalDuration - CTA_TAIL_SECONDS)
  return {
    type: 'text',
    track: 5,
    time: 0,
    duration: round3(captionWindow),
    // Creatomate replaces this placeholder with the live transcript as
    // soon as transcript_source resolves; the field is required by the
    // schema but its value is not shown when transcription succeeds.
    text: ' ',
    x: '50%',
    y: '72%',
    y_alignment: '50%',
    width: '86%',
    font_family: 'Montserrat',
    font_size: 64,
    font_weight: '800',
    fill_color: '#ffffff',
    stroke_color: 'rgba(0,0,0,0.95)',
    stroke_width: 4,
    transcript_source: VOICEOVER_TRACK_NAME,
    transcript_effect: 'karaoke',
    transcript_split: 'word',
    transcript_placement: 'animate',
    transcript_color: HIGHLIGHT_COLOR,
    // ~18 characters per slot ≈ 2-3 short words on screen at once;
    // tight enough to read fast, wide enough not to flicker constantly.
    transcript_maximum_length: 18,
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
  //
  // Push #143 — `loop: true` ensures any clip shorter than its allotted
  // slot loops back to the start instead of freezing on the last frame
  // (which read as a blank/static screen mid-video). Some Pexels portrait
  // assets come in at 7-9s and would otherwise hold black for 1-3s.
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
      loop: true,
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

  // Track 4 — voiceover for the full duration. The `name` field is what
  // the karaoke text element below references via `transcript_source`,
  // so Creatomate knows which audio to transcribe and time the
  // word-by-word highlight against. The name must stay in sync with
  // VOICEOVER_TRACK_NAME.
  elements.push({
    type: 'audio',
    name: VOICEOVER_TRACK_NAME,
    track: 4,
    time: 0,
    duration: totalDuration,
    source: voiceoverUrl,
    volume: '100%',
  })

  // Track 5 — karaoke captions auto-synced to the voiceover audio.
  //
  // Push #143 — switched from pre-distributed text slots (chunked by
  // word count) to Creatomate's transcript_source feature. Captions
  // now timestamp themselves against the actual TTS audio, so they
  // follow the narrator word-for-word with the active word painted
  // yellow. The voiceover_script / sceneCaptions arguments are no
  // longer needed for caption rendering — they remain in the public
  // function signature for backward compatibility but are not consumed
  // here. We intentionally void-read them so eslint stays quiet.
  void voiceoverScript
  void sceneCaptions
  elements.push(buildKaraokeCaptionElement(totalDuration))

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
