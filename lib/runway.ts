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
  // Try models in order: gen4_turbo first, then gen3a_turbo as fallback
  const modelsToTry = ['gen4_turbo', 'gen3a_turbo']
  const bases = [RUNWAY_BASE_PROD, RUNWAY_BASE]

  let res: Response | null = null
  let lastError = ''
  let usedModel = modelsToTry[0]

  outer: for (const model of modelsToTry) {
    const body = JSON.stringify({
      model,
      promptText,
      duration: 5,
      ratio: '720:1280',
    })
    console.log(`[runway] trying model=${model} body=${body.slice(0, 300)}`)

    for (const base of bases) {
      try {
        const r = await fetch(`${base}/text_to_video`, {
          method: 'POST',
          headers: authHeaders(),
          body,
        })
        const rawT = await r.text()
        console.log(`[runway] ${model}@${base} status=${r.status} body=${rawT.slice(0, 800)}`)

        // If this is a validation error for the model, try next model
        if (r.status === 422) {
          lastError = `${model}: ${rawT.slice(0, 300)}`
          console.warn(`[runway] 422 for model ${model}, will try next`)
          break // break inner loop (try next model)
        }

        res = r
        usedModel = model
        // Attach parsed raw text for later use
        ;(res as Response & { _rawText?: string })._rawText = rawT
        break outer
      } catch (fetchErr) {
        lastError = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
        console.error(`[runway] fetch failed for ${base}:`, lastError)
      }
    }
  }

  if (!res) throw new Error(`Runway error: ${lastError}`)

  const rawText = (res as Response & { _rawText?: string })._rawText ?? await res.text()
  console.log(`[runway] final model=${usedModel} status=${res.status}`)

  let data: Record<string, unknown> = {}
  try { data = JSON.parse(rawText) } catch { /* non-json */ }

  if (!res.ok) {
    const errMsg = typeof data.error === 'string' ? data.error : null
    const errMessage = typeof data.message === 'string' ? data.message : null
    const errDetail = typeof (data as {detail?: unknown}).detail === 'string'
      ? (data as {detail: string}).detail : null
    const errErrors = Array.isArray(data.errors)
      ? ' | ' + JSON.stringify(data.errors).slice(0, 300)
      : ''
    const detail =
      (errMsg ? errMsg + errErrors : null) ||
      (errMessage ? errMessage + errErrors : null) ||
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
