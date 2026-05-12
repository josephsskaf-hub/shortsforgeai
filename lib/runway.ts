import { openai } from '@/lib/openai'

const RUNWAY_BASE = 'https://api.dev.runwayml.com/v1'
const RUNWAY_VERSION = '2024-11-06'

export interface RunwayTaskHandle {
  id: string
  promptText: string
}

export type RunwayTaskStatus = 'PENDING' | 'THROTTLED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'

export interface RunwayTaskState {
  id: string
  status: RunwayTaskStatus
  progress: number | null
  outputUrl: string | null
  failure: string | null
}

// ─── Validation helpers ──────────────────────────────────────────────────────

const VALID_VIDEO_DURATIONS = [5, 10] as const
const VALID_VIDEO_RATIOS = ['720:1280', '1280:720', '960:960'] as const
// Runway gen4_image supports many ratios — we only need a 9:16 subset.
const VALID_IMAGE_RATIOS = ['720:1280', '1280:720', '1024:1024'] as const

type VideoRatio = (typeof VALID_VIDEO_RATIOS)[number]
type VideoDuration = (typeof VALID_VIDEO_DURATIONS)[number]
type ImageRatio = (typeof VALID_IMAGE_RATIOS)[number]

interface ImageToVideoPayload {
  model: 'gen4_turbo'
  promptImage: string
  promptText?: string
  ratio: VideoRatio
  duration: VideoDuration
}

interface TextToImagePayload {
  model: 'gen4_image'
  promptText: string
  ratio: ImageRatio
}

export function mapPlatformToRatio(platform: string): VideoRatio {
  switch ((platform ?? '').toLowerCase().trim()) {
    case 'youtube shorts':
    case 'tiktok':
    case 'instagram reels':
      return '720:1280'
    case 'youtube':
    case 'landscape youtube':
      return '1280:720'
    case 'square':
      return '960:960'
    default:
      return '720:1280'
  }
}

export function sanitizePromptForRunway(raw: string): string {
  const cleaned = raw
    .split('\n')
    .filter((line) => {
      const t = line.trim()
      if (!t) return false
      if (t.startsWith('#')) return false
      if (/\b(subscribe|follow|like|comment|share|youtube|tiktok|instagram|shorts|www\.)\b/i.test(t)) return false
      if ((t.match(/#\w+/g) ?? []).length >= 3) return false
      return true
    })
    .join(' ')
    .replace(/#\w+/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 500)
  return cleaned
}

function authHeaders() {
  const key = process.env.RUNWAY_API_KEY
  if (!key) throw new Error('RUNWAY_API_KEY is not configured.')
  return {
    Authorization: `Bearer ${key}`,
    'X-Runway-Version': RUNWAY_VERSION,
    'Content-Type': 'application/json',
  }
}

function extractRunwayError(data: Record<string, unknown>, rawText: string, httpStatus: number): string {
  console.error('[runway] full error body:', JSON.stringify(data).slice(0, 1200))
  if (Array.isArray(data.issues) && data.issues.length > 0) {
    const firstIssue = data.issues[0] as Record<string, unknown>
    const path = Array.isArray(firstIssue.path) ? firstIssue.path.join('.') : String(firstIssue.path ?? '')
    const message = typeof firstIssue.message === 'string' ? firstIssue.message : ''
    if (path && message) return `${path}: ${message}`
    if (message) return message
  }
  if (typeof data.error === 'string' && data.error) return data.error
  if (typeof data.message === 'string' && data.message) return data.message
  return rawText.slice(0, 300) || `HTTP ${httpStatus}`
}

// ─── Scene planning (OpenAI) ─────────────────────────────────────────────────

export async function generateScenes(prompt: string, count = 4): Promise<string[]> {
  const safeCount = Math.max(1, Math.min(8, Math.round(count)))
  const userPrompt = `You break a Short-form video idea into ${safeCount} vivid, cinematic shot descriptions for an AI text-to-video model (RunwayML Gen-4 Turbo).

Idea: "${prompt}"

Return ONLY a valid JSON array of exactly ${safeCount} string${safeCount === 1 ? '' : 's'} — no markdown, no preamble. Each string must:
- Be one sentence, ~15-25 words
- Be visual, specific, concrete (subject + setting + lighting + camera motion + mood)
- Stay coherent across the ${safeCount} shot${safeCount === 1 ? '' : 's'} so ${safeCount === 1 ? 'it tells a strong single beat' : 'they tell one short story'}
- Avoid text overlays, logos, or watermarks
- Be optimized for vertical 9:16 framing (tall composition)

Example output format for ${safeCount} shot${safeCount === 1 ? '' : 's'}:
${JSON.stringify(Array.from({ length: safeCount }, (_, i) => `scene ${i + 1} description`))}`

  const completion = await openai.chat.completions.create(
    {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert cinematic prompt engineer. You always respond with a valid JSON array of strings only — no markdown, no code fences, no commentary.',
        },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.85,
      max_tokens: 600,
    },
    { timeout: 25000 }
  )

  const raw = completion.choices[0]?.message?.content?.trim() ?? ''
  if (!raw) throw new Error('OpenAI returned no scenes.')

  let cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
  const m = cleaned.match(/\[[\s\S]*\]/)
  if (m) cleaned = m[0]

  let parsed: unknown
  try { parsed = JSON.parse(cleaned) } catch { throw new Error('Failed to parse scenes JSON from OpenAI.') }

  if (!Array.isArray(parsed)) throw new Error('Scenes response was not an array.')
  const scenes = parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, safeCount)
  while (scenes.length < safeCount) {
    scenes.push(`Cinematic vertical 9:16 shot inspired by: ${prompt}`)
  }
  return scenes
}

// ─── Runway: low-level POST ──────────────────────────────────────────────────

async function postRunway(path: string, payload: unknown): Promise<{ id: string }> {
  const bodyStr = JSON.stringify(payload)
  console.log(`[Runway] POST ${path} payload:`, bodyStr)

  let res: Response
  try {
    res = await fetch(`${RUNWAY_BASE}${path}`, {
      method: 'POST',
      headers: authHeaders(),
      body: bodyStr,
    })
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
    console.error(`[Runway] ${path} network error:`, msg)
    throw new Error(`Runway network error: ${msg}`)
  }

  const rawText = await res.text()
  console.error(`[Runway] ${path} response: status=${res.status} body=${rawText.slice(0, 800)}`)

  let data: Record<string, unknown> = {}
  try { data = JSON.parse(rawText) } catch { /* non-JSON */ }

  if (!res.ok) {
    const detail = extractRunwayError(data, rawText, res.status)
    throw new Error(`Runway rejected ${path}: ${detail}`)
  }

  const id =
    (typeof data.id === 'string' ? data.id : null) ||
    (typeof data.taskId === 'string' ? data.taskId : null)

  if (!id) throw new Error(`Runway ${path} returned no task id. Response: ${rawText.slice(0, 200)}`)
  console.log(`[Runway] ${path} task id=${id}`)
  return { id }
}

// ─── Runway: text_to_image (gen4_image) ──────────────────────────────────────

export async function startRunwayTextToImage(rawPromptText: string, ratio: ImageRatio = '720:1280'): Promise<RunwayTaskHandle> {
  const promptText = sanitizePromptForRunway(rawPromptText)
  if (!promptText) throw new Error('promptText is empty after sanitization.')
  if (!VALID_IMAGE_RATIOS.includes(ratio)) throw new Error(`Invalid image ratio: ${ratio}`)
  const payload: TextToImagePayload = { model: 'gen4_image', promptText, ratio }
  const { id } = await postRunway('/text_to_image', payload)
  return { id, promptText }
}

// ─── Runway: image_to_video (gen4_turbo) ─────────────────────────────────────

export async function startRunwayImageToVideo(
  promptImage: string,
  rawPromptText: string,
  platform = 'YouTube Shorts',
  durationSeconds = 10
): Promise<RunwayTaskHandle> {
  if (!promptImage || !/^https?:\/\//.test(promptImage)) {
    throw new Error('promptImage must be an https URL.')
  }
  const promptText = sanitizePromptForRunway(rawPromptText)
  const ratio = mapPlatformToRatio(platform)
  const duration: VideoDuration = durationSeconds <= 5 ? 5 : 10

  const payload: ImageToVideoPayload = {
    model: 'gen4_turbo',
    promptImage,
    ratio,
    duration,
  }
  if (promptText) payload.promptText = promptText

  const { id } = await postRunway('/image_to_video', payload)
  return { id, promptText }
}

// ─── Runway: GET /tasks/{id} ─────────────────────────────────────────────────

export async function getRunwayTask(id: string): Promise<RunwayTaskState> {
  const res = await fetch(`${RUNWAY_BASE}/tasks/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: authHeaders(),
    cache: 'no-store',
  })

  const rawText = await res.text()
  let data: Record<string, unknown> = {}
  try { data = JSON.parse(rawText) } catch { /* non-JSON */ }

  if (!res.ok) {
    const detail =
      (typeof data.error === 'string' ? data.error : null) ||
      (typeof data.message === 'string' ? data.message : null) ||
      `Runway task lookup failed (${res.status})`
    console.error(`[Runway] /tasks/${id} error: status=${res.status} body=${rawText.slice(0, 400)}`)
    throw new Error(detail)
  }

  const status = (typeof data.status === 'string' ? data.status : 'PENDING') as RunwayTaskStatus
  const progress = typeof data.progress === 'number' ? data.progress : null

  // Output can be: string url, [string], [{url}], {url}
  let outputUrl: string | null = null
  const output = data.output
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0]
    if (typeof first === 'string') outputUrl = first
    else if (first && typeof first === 'object' && typeof (first as { url?: unknown }).url === 'string') {
      outputUrl = (first as { url: string }).url
    }
  } else if (typeof output === 'string') {
    outputUrl = output
  } else if (output && typeof output === 'object' && typeof (output as { url?: unknown }).url === 'string') {
    outputUrl = (output as { url: string }).url
  }

  // NOTE: do not classify the URL as image-or-video here. Extension-sniffing on
  // Runway CDN URLs is unreliable (signed CDN URLs may not surface the file
  // extension cleanly, and a misclassification leaks the intermediate image URL
  // into the video result and breaks <video> playback on the client). Each
  // caller already knows which kind of task it polled — let them reason about
  // the output. We just hand back the raw URL.
  console.log(`[Runway] /tasks/${id} status=${status} progress=${progress} output=${outputUrl?.slice(0, 120) ?? 'null'}`)

  return {
    id,
    status,
    progress,
    outputUrl: outputUrl ?? null,
    failure: typeof data.failure === 'string'
      ? data.failure
      : typeof (data as { failureCode?: unknown }).failureCode === 'string'
      ? ((data as { failureCode: string }).failureCode)
      : null,
  }
}

// ─── Video-URL extraction (Rule 1 — push #012) ───────────────────────────────

const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|avif|tif?f|bmp)(\?|#|$)/i
const VIDEO_EXT_RE = /\.(mp4|mov|webm|m4v|mkv)(\?|#|$)/i
const VIDEO_HOST_RE = /(runwayml|dnznrvs|cloudfront|akamaized|videos\.pexels|res\.cloudinary|archive\.org|test-videos\.co\.uk|download\.blender\.org)/i

/**
 * Inspect a Runway task state and return a real video URL or null.
 *
 * Rules:
 *  - Must come from a SUCCEEDED task (callers should check first, but we
 *    also reject when there is no outputUrl at all).
 *  - URLs ending in image extensions (.png/.jpg/.jpeg/.webp/.gif/...) are
 *    rejected — these are intermediate text_to_image frames leaking through.
 *  - URLs with explicit video extensions (.mp4/.mov/.webm/...) are accepted.
 *  - URLs without an extension are accepted if the host belongs to a known
 *    video CDN (Runway / CloudFront / Akamai / Pexels videos / etc).
 *  - Everything else is rejected.
 */
export function extractVideoUrl(state: RunwayTaskState): string | null {
  const url = state.outputUrl
  if (!url) {
    console.log(`[extractVideoUrl] rejected: no outputUrl on task ${state.id}`)
    return null
  }

  const imgMatch = url.match(IMAGE_EXT_RE)
  if (imgMatch) {
    console.error(`[extractVideoUrl] rejected: ${url.slice(0, 160)} (extension: ${imgMatch[1]})`)
    return null
  }

  const vidMatch = url.match(VIDEO_EXT_RE)
  if (vidMatch) {
    console.log(`[extractVideoUrl] found: ${url.slice(0, 160)} (extension: ${vidMatch[1]})`)
    return url
  }

  if (VIDEO_HOST_RE.test(url)) {
    console.log(`[extractVideoUrl] found by host: ${url.slice(0, 160)}`)
    return url
  }

  console.error(`[extractVideoUrl] rejected: ${url.slice(0, 160)} (no video extension, unknown host)`)
  return null
}

// ─── Inline poller used during the synchronous request (image gen wait) ──────

export async function pollRunwayTaskUntilDone(
  id: string,
  opts: { maxMs?: number; intervalMs?: number } = {}
): Promise<RunwayTaskState> {
  const maxMs = opts.maxMs ?? 45_000
  const intervalMs = opts.intervalMs ?? 1500
  const deadline = Date.now() + maxMs

  while (Date.now() < deadline) {
    const state = await getRunwayTask(id)
    if (state.status === 'SUCCEEDED') return state
    if (state.status === 'FAILED' || state.status === 'CANCELLED') {
      throw new Error(`Runway task ${id} ${state.status.toLowerCase()}${state.failure ? ` — ${state.failure}` : ''}`)
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`Runway task ${id} did not complete within ${maxMs}ms (last poll still pending).`)
}

// ─── High-level: scene → image → video task handle ───────────────────────────

export async function startVideoForScene(
  sceneText: string,
  platform = 'YouTube Shorts'
): Promise<RunwayTaskHandle> {
  // 1) text → image
  const imgRatio: ImageRatio = '720:1280' // vertical 9:16
  console.log('[Runway] starting text_to_image for scene:', sceneText.slice(0, 100))
  const imgTask = await startRunwayTextToImage(sceneText, imgRatio)

  // 2) poll until image is ready
  const imgState = await pollRunwayTaskUntilDone(imgTask.id, { maxMs: 45_000, intervalMs: 1500 })
  if (!imgState.outputUrl) {
    throw new Error(`text_to_image succeeded but returned no output URL for task ${imgTask.id}`)
  }
  console.log('[Runway] image ready:', imgState.outputUrl.slice(0, 120))

  // 3) image → video (10s clips always — duration multiplied client-side by # of scenes)
  const videoTask = await startRunwayImageToVideo(imgState.outputUrl, sceneText, platform, 10)
  return videoTask
}
