import { openai } from '@/lib/openai'

const RUNWAY_BASE = 'https://api.dev.runwayml.com/v1'
const RUNWAY_VERSION = '2024-11-06'
// Fallback base if dev subdomain fails
const RUNWAY_BASE_PROD = 'https://api.runwayml.com/v1'

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

function authHeaders() {
  const key = process.env.RUNWAY_API_KEY
  if (!key) throw new Error('RUNWAY_API_KEY is not configured.')
  return {
    Authorization: `Bearer ${key}`,
    'X-Runway-Version': RUNWAY_VERSION,
    'Content-Type': 'application/json',
  }
}

export async function generateScenes(prompt: string): Promise<string[]> {
  const userPrompt = `You break a Short-form video idea into 4 vivid, cinematic shot descriptions for an AI text-to-video model (RunwayML Gen-4 Turbo).

Idea: "${prompt}"

Return ONLY a valid JSON array of exactly 4 strings — no markdown, no preamble. Each string must:
- Be one sentence, ~15-25 words
- Be visual, specific, concrete (subject + setting + lighting + camera motion + mood)
- Stay coherent across the 4 shots so they tell one short story
- Avoid text overlays, logos, or watermarks
- Be optimized for vertical 9:16 framing (tall composition)

Example output format:
["scene 1 description", "scene 2 description", "scene 3 description", "scene 4 description"]`

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
  const scenes = parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).slice(0, 4)
  if (scenes.length < 4) {
    while (scenes.length < 4) {
      scenes.push(`Cinematic vertical 9:16 shot inspired by: ${prompt}`)
    }
  }
  return scenes
}

export async function startRunwayTask(promptText: string): Promise<RunwayTaskHandle> {
  const body = JSON.stringify({
    model: 'gen4_turbo',
    promptText,
    duration: 5,
    ratio: '720:1280',
  })

  console.log('[runway] sending body:', body.slice(0, 300))

  // Try production endpoint first, fall back to dev
  let res: Response | null = null
  let lastError = ''
  for (const base of [RUNWAY_BASE_PROD, RUNWAY_BASE]) {
    try {
      res = await fetch(`${base}/text_to_video`, {
        method: 'POST',
        headers: authHeaders(),
        body,
      })
      console.log(`[runway] got response from ${base}: status=${res.status}`)
      break
    } catch (fetchErr) {
      lastError = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      console.error(`[runway] fetch failed for ${base}:`, lastError)
    }
  }

  if (!res) throw new Error(`Runway unreachable: ${lastError}`)

  const rawText = await res.text()
  console.log(`[runway] POST text_to_video status=${res.status} body=${rawText.slice(0, 800)}`)

  let data: Record<string, unknown> = {}
  try { data = JSON.parse(rawText) } catch { /* non-json */ }

  if (!res.ok) {
    // Extract as much detail as possible from the validation error
    const errMsg = typeof data.error === 'string' ? data.error : null
    const errMessage = typeof data.message === 'string' ? data.message : null
    const errDetail = typeof (data as {detail?: unknown}).detail === 'string'
      ? (data as {detail: string}).detail : null
    const errErrors = Array.isArray(data.errors)
      ? ' | details: ' + JSON.stringify(data.errors).slice(0, 300)
      : ''
    const errValidation = Array.isArray((data as {validation?: unknown}).validation)
      ? ' | validation: ' + JSON.stringify((data as {validation: unknown[]}).validation).slice(0, 300)
      : ''
    const detail =
      (errMsg ? errMsg + errErrors + errValidation : null) ||
      (errMessage ? errMessage + errErrors + errValidation : null) ||
      errDetail ||
      rawText.slice(0, 400) ||
      `Runway HTTP ${res.status}`
    throw new Error(detail)
  }

  const id =
    (typeof data.id === 'string' ? data.id : null) ||
    (typeof data.taskId === 'string' ? data.taskId : null)

  if (!id) throw new Error(`Runway returned no task id. Response: ${rawText.slice(0, 200)}`)

  return { id, promptText }
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
