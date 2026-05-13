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
  videoUrl: string | null
  failure: string | null
}

// ─── Validation helpers ───────────────────────────────────────────────────────

const VALID_MODELS = ['gen4_turbo'] as const
const VALID_DURATIONS = [5, 10] as const
const VALID_RATIOS = ['720:1280', '1280:720', '960:960'] as const

type ValidModel = (typeof VALID_MODELS)[number]
type ValidDuration = (typeof VALID_DURATIONS)[number]
type ValidRatio = (typeof VALID_RATIOS)[number]

interface RunwayTextToVideoPayload {
  model: ValidModel
  promptText: string
  ratio: ValidRatio
  duration: ValidDuration
}

/**
 * Map platform name → Runway pixel-based ratio.
 * Runway does NOT accept "9:16" — must use pixel dimensions.
 */
export function mapPlatformToRatio(platform: string): ValidRatio {
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
      return '720:1280' // safe default: vertical 9:16
  }
}

/**
 * Sanitize a raw user / AI-generated prompt for Runway.
 * Strips hashtags, platform instructions, URLs, CTAs — leaves only
 * the cinematic visual description that Runway expects.
 */
export function sanitizePromptForRunway(raw: string): string {
  const cleaned = raw
    .split('\n')
    .filter((line) => {
      const t = line.trim()
      if (!t) return false
      // Drop pure-hashtag lines
      if (t.startsWith('#')) return false
      // Drop CTA / platform-instruction lines
      if (/\b(subscribe|follow|like|comment|share|youtube|tiktok|instagram|shorts|www\.)\b/i.test(t)) return false
      // Drop lines that are mostly hashtags (3+ tags)
      if ((t.match(/#\w+/g) ?? []).length >= 3) return false
      return true
    })
    .join(' ')
    // Remove inline hashtags
    .replace(/#\w+/g, '')
    // Remove URLs
    .replace(/https?:\/\/\S+/g, '')
    // Collapse whitespace
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 500)

  return cleaned
}

/**
 * Build a strictly-typed Runway text-to-video payload and validate every field.
 * Throws a descriptive error if any field would fail Runway validation.
 */
export function buildRunwayPayload(
  rawPrompt: string,
  platform = 'YouTube Shorts',
  durationSeconds = 10
): RunwayTextToVideoPayload {
  const promptText = sanitizePromptForRunway(rawPrompt)
  if (!promptText) throw new Error('promptText is empty after sanitization — cannot send to Runway.')
  if (promptText.length > 500) throw new Error(`promptText is too long (${promptText.length} chars, max 500).`)

  const model: ValidModel = 'gen4_turbo'
  const ratio = mapPlatformToRatio(platform)

  // Runway only accepts 5 or 10 — clamp
  const duration: ValidDuration = durationSeconds <= 5 ? 5 : 10

  return { model, promptText, ratio, duration }
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

/**
 * Extract the most human-readable error detail from a Runway error response.
 * Runway returns: { error, docUrl, issues: [{ path, message }] }
 */
function extractRunwayError(data: Record<string, unknown>, rawText: string, httpStatus: number): string {
  // Log full structure for server-side debugging
  console.error('[runway] full error body:', JSON.stringify(data).slice(0, 1200))

  // Try issues[] first — most specific
  if (Array.isArray(data.issues) && data.issues.length > 0) {
    const firstIssue = data.issues[0] as Record<string, unknown>
    const path = Array.isArray(firstIssue.path) ? firstIssue.path.join('.') : String(firstIssue.path ?? '')
    const message = typeof firstIssue.message === 'string' ? firstIssue.message : ''
    if (path && message) return `${path}: ${message}`
    if (message) return message
  }

  // Fall back to top-level error / message
  if (typeof data.error === 'string' && data.error) return data.error
  if (typeof data.message === 'string' && data.message) return data.message

  return rawText.slice(0, 300) || `HTTP ${httpStatus}`
}

export async function generateScenes(prompt: string, count = 4): Promise<string[]> {
  const safeCount = Math.max(1, Math.min(8, Math.floor(count)))
  const exampleArr = Array.from({ length: safeCount }, (_, i) => `"scene ${i + 1} description"`).join(', ')

  const userPrompt = `You break a Short-form video idea into ${safeCount} vivid, cinematic shot descriptions for an AI text-to-video model (RunwayML Gen-4 Turbo).

Idea: "${prompt}"

Return ONLY a valid JSON array of exactly ${safeCount} strings — no markdown, no preamble. Each string must:
- Be one sentence, ~15-25 words
- Be visual, specific, concrete (subject + setting + lighting + camera motion + mood)
- Stay coherent across the ${safeCount} shots so they tell one short story
- Avoid text overlays, logos, or watermarks
- Be optimized for vertical 9:16 framing (tall composition)

Example output format:
[${exampleArr}]`

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
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('Failed to parse scenes JSON from OpenAI.')
  }

  if (!Array.isArray(parsed)) throw new Error('Scenes response was not an array.')
  const scenes = parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, safeCount)
  while (scenes.length < safeCount) {
    scenes.push(`Cinematic vertical 9:16 shot inspired by: ${prompt}`)
  }
  return scenes
}

/**
 * Start a Runway text-to-video task.
 * @param rawPromptText  Raw scene description (will be sanitized before sending).
 * @param platform       Platform name for ratio mapping (default: "YouTube Shorts").
 * @param durationSeconds  Desired duration — only 5 or 10 will be sent to Runway.
 */
export async function startRunwayTask(
  rawPromptText: string,
  platform = 'YouTube Shorts',
  durationSeconds = 10
): Promise<RunwayTaskHandle> {
  // Build and validate payload BEFORE calling Runway (no credits charged yet)
  const payload = buildRunwayPayload(rawPromptText, platform, durationSeconds)

  const bodyStr = JSON.stringify(payload)
  console.log(`[runway] sending to /text_to_video — model=${payload.model} ratio=${payload.ratio} duration=${payload.duration} promptText="${payload.promptText.slice(0, 120)}..."`)

  let res: Response
  try {
    res = await fetch(`${RUNWAY_BASE}/text_to_video`, {
      method: 'POST',
      headers: authHeaders(),
      body: bodyStr,
    })
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
    console.error('[runway] network error:', msg)
    throw new Error(`Runway network error: ${msg}`)
  }

  const rawText = await res.text()
  console.log(`[runway] response status=${res.status} body=${rawText.slice(0, 600)}`)

  let data: Record<string, unknown> = {}
  try { data = JSON.parse(rawText) } catch { /* non-JSON response */ }

  if (!res.ok) {
    const detail = extractRunwayError(data, rawText, res.status)
    throw new Error(`Runway rejected the request: ${detail}`)
  }

  const id =
    (typeof data.id === 'string' ? data.id : null) ||
    (typeof data.taskId === 'string' ? data.taskId : null)

  if (!id) throw new Error(`Runway returned no task id. Response: ${rawText.slice(0, 200)}`)

  return { id, promptText: payload.promptText }
}

export async function getRunwayTask(id: string): Promise<RunwayTaskState> {
  const res = await fetch(`${RUNWAY_BASE}/tasks/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: authHeaders(),
    cache: 'no-store',
  })

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>

  if (!res.ok) {
    const detail =
      (typeof data.error === 'string' ? data.error : null) ||
      (typeof data.message === 'string' ? data.message : null) ||
      `Runway task lookup failed (${res.status})`
    throw new Error(detail)
  }

  const status = (typeof data.status === 'string' ? data.status : 'PENDING') as RunwayTaskStatus
  const progress = typeof data.progress === 'number' ? data.progress : null

  let videoUrl: string | null = null
  const output = data.output
  if (Array.isArray(output) && output.length > 0) {
    const first = output[0]
    if (typeof first === 'string') videoUrl = first
    else if (first && typeof first === 'object' && typeof (first as { url?: unknown }).url === 'string') {
      videoUrl = (first as { url: string }).url
    }
  } else if (typeof output === 'string') {
    videoUrl = output
  } else if (output && typeof output === 'object' && typeof (output as { url?: unknown }).url === 'string') {
    videoUrl = (output as { url: string }).url
  }

  const failure =
    typeof data.failure === 'string'
      ? data.failure
      : typeof (data as { failureCode?: unknown }).failureCode === 'string'
      ? ((data as { failureCode: string }).failureCode)
      : null

  return { id, status, progress, videoUrl, failure }
}
