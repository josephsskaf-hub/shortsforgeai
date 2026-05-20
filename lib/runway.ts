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

// Runway model. The team's account is on Gen-4.5 — reverting to gen4_turbo
// will get the request rejected. Keep this in sync with the model the API
// key actually has access to.
const VALID_MODELS = ['gen4.5'] as const
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
 * Push #021 added snake_case identifiers from the platform selector
 * ("youtube_shorts", "tiktok", "instagram_reels") alongside the legacy
 * display labels — keep both forms so future client renames don't silently
 * fall back to the default vertical ratio.
 */
export function mapPlatformToRatio(platform: string): ValidRatio {
  switch ((platform ?? '').toLowerCase().trim()) {
    case 'youtube shorts':
    case 'youtube_shorts':
    case 'tiktok':
    case 'instagram reels':
    case 'instagram_reels':
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

// Runway's text_to_video endpoint hard-rejects promptText over 500 chars.
// Every visual prompt that touches the provider MUST go through
// clampToProviderLimit() before the API call — this is the single source
// of truth for that limit.
export const PROVIDER_PROMPT_MAX = 500

/**
 * Hard-clamp a string to `max` chars, preferring sentence / comma / word
 * boundaries when there's a clean break in the back half of the window.
 * Whitespace is collapsed first so the count is honest. Push #041
 * centralized this here so /api/generate-video and any future caller
 * share one well-tested clamp.
 */
export function clampToProviderLimit(raw: string, max: number = PROVIDER_PROMPT_MAX): string {
  const trimmed = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''
  if (trimmed.length <= max) return trimmed
  const window = trimmed.slice(0, max)
  // Sentence boundary (anywhere in the back 40% of the window).
  const lastSentence = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('! '),
    window.lastIndexOf('? '),
  )
  if (lastSentence > max * 0.6) return window.slice(0, lastSentence + 1).trim()
  const lastComma = window.lastIndexOf(', ')
  if (lastComma > max * 0.6) return window.slice(0, lastComma).trim()
  const lastSpace = window.lastIndexOf(' ')
  if (lastSpace > max * 0.6) return window.slice(0, lastSpace).trim()
  return window.trim()
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
 *
 * `quality` controls the prompt enhancement:
 *  - 'basic': sanitized prompt only, standard settings.
 *  - 'pro':   appends a cinematic-quality enhancer so Runway leans into
 *             depth, lighting, and film-grade composition. This is the
 *             paid differentiator for the Pro tier.
 */
export type Quality = 'basic' | 'pro'

const PRO_ENHANCER =
  'cinematic film grade, 35mm motion picture lighting, shallow depth of field, ' +
  'volumetric atmosphere, ultra-detailed textures, smooth gimbal camera motion, ' +
  'high dynamic range, vertical 9:16 framing'

export function buildRunwayPayload(
  rawPrompt: string,
  platform = 'YouTube Shorts',
  durationSeconds = 10,
  quality: Quality = 'basic'
): RunwayTextToVideoPayload {
  const sanitized = sanitizePromptForRunway(rawPrompt)
  if (!sanitized) throw new Error('promptText is empty after sanitization — cannot send to Runway.')

  // For Pro, fold in the cinematic enhancer but never overflow the 500-char cap.
  // We keep ~4 chars of breathing room for the " — " separator.
  let promptText = sanitized
  if (quality === 'pro') {
    const budget = PROVIDER_PROMPT_MAX - PRO_ENHANCER.length - 4
    const base = sanitized.length > budget ? sanitized.slice(0, budget).trim() : sanitized
    promptText = `${base} — ${PRO_ENHANCER}`
  }

  // Final safety clamp — sentence-aware, hard cap at PROVIDER_PROMPT_MAX.
  promptText = clampToProviderLimit(promptText)
  console.log(`[provider_prompt] length: ${promptText.length}`)
  console.log(`[provider_prompt] preview: ${promptText.slice(0, 120)}`)

  const model: ValidModel = 'gen4.5'
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

// Push #128 — Scene now carries both the cinematic Runway description AND
// explicit Pexels search keywords so the two uses are cleanly separated.
// Push #132 — Scene also carries the per-scene `voiceover` (full narration
// line) and `caption` (≤8 word readable version of that voiceover). The
// voiceover sent to TTS and the caption shown on screen come from the
// SAME source string, so captions can never disconnect from the narration.
export interface Scene {
  description: string    // cinematic prose for Runway image/video AI
  searchKeywords: string // 2-4 concrete nouns for Pexels stock search
  voiceover: string      // the narration line the TTS will speak for this scene
  caption: string        // ≤8-word readable on-screen caption derived from voiceover
}

// Trim a narration line down to a punchy ≤maxWords caption. Strips
// markdown asterisks, collapses whitespace, drops trailing punctuation.
// The on-screen caption format is fragment-style — no period, no quote.
export function shortCaptionFromVoiceover(text: string, maxWords = 8): string {
  const cleaned = (text ?? '')
    .replace(/[*"_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  const words = cleaned.split(' ').filter(Boolean)
  const sliced = words.length <= maxWords ? words : words.slice(0, maxWords)
  return sliced.join(' ').replace(/[.!?,;:]+$/, '')
}

// Push #180 — duration-aware per-scene word sizing.
//
// When the caller passes `targetTotalWords`, we ask GPT to size each
// scene's voiceover so the SUM lands near that target. This keeps the
// raw script length matched to the user's chosen duration (30s/45s/60s)
// instead of always producing 10-22 words per scene regardless. The
// downstream `scaleVoiceoverScript` is still the final guarantor, but
// starting closer to target means fewer extra GPT rewrites.
export interface GenerateScenesOptions {
  /**
   * Approximate total voiceover word count across all scenes. When set,
   * per-scene voiceover length is computed as `targetTotalWords / count`
   * with a ±20% tolerance, instructed in the GPT prompt directly so the
   * model writes longer or shorter lines as needed.
   */
  targetTotalWords?: number
}

export async function generateScenes(
  prompt: string,
  count = 4,
  opts: GenerateScenesOptions = {},
): Promise<Scene[]> {
  const safeCount = Math.max(1, Math.min(8, Math.floor(count)))

  // Push #180 — derive a per-scene word range from the total target so the
  // SUM of voiceovers lands at the user's chosen duration. Fallback range
  // (used when no target is supplied) preserves prior behavior.
  let perSceneWordHint = '10-22 words'
  if (typeof opts.targetTotalWords === 'number' && opts.targetTotalWords > 0) {
    const perScene = Math.max(6, Math.round(opts.targetTotalWords / safeCount))
    const lo = Math.max(6, Math.round(perScene * 0.8))
    const hi = Math.max(lo + 4, Math.round(perScene * 1.2))
    perSceneWordHint = `${lo}-${hi} words (so the ${safeCount} scenes together total ~${opts.targetTotalWords} words)`
  }

  const exampleScene = `{"description":"Ancient Egyptian pyramid at golden hour, aerial drone shot pulling back to reveal desert vastness, warm cinematic light","searchKeywords":"pyramid egypt desert","voiceover":"The Great Pyramid of Giza is older than written history itself.","caption":"Older than written history itself"}`
  const exampleArr = Array.from({ length: safeCount }, () => exampleScene).join(',\n  ')

  const userPrompt = `You break a Short-form video idea into ${safeCount} scenes for a YouTube Short.

Idea: "${prompt}"

Return ONLY a valid JSON array of exactly ${safeCount} objects — no markdown, no preamble.
Each object must have exactly four fields:
1. "description": A cinematic shot description for an AI video model (~15-25 words). Visual, specific, concrete — subject + setting + lighting + camera motion + mood. Vertical 9:16 framing.
2. "searchKeywords": 2-4 concrete nouns or short phrases that describe WHAT IS VISUALLY IN THIS SCENE, directly related to the video topic. These are used to search stock footage. NEVER use abstract words like "cinematic", "footage", "video", "shot". NEVER start with "a", "the", "lone", "soft". Use the actual topic: e.g. for pyramids → "ancient pyramid egypt desert"; for money → "gold coins cash dollar bills".
3. "voiceover": One real narration line that delivers a concrete fact, escalation, or payoff about the topic (${perSceneWordHint}). This is the EXACT text the TTS will read for this scene. No filler like "imagine…", "what if…". No stage directions.
4. "caption": A ≤8-word readable on-screen caption that paraphrases the same voiceover line. Punchy fragment, no period, must match what the narrator says in meaning.

The "searchKeywords" MUST match the topic of the video idea, not describe filming style.
The "caption" MUST come from the same idea as "voiceover" — they describe the same moment in the narration.

Example output:
[
  ${exampleArr}
]`

  const completion = await openai.chat.completions.create(
    {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a video production expert. You always respond with a valid JSON array only — no markdown, no code fences, no commentary.',
        },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 800,
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

  const scenes: Scene[] = parsed
    .map((item: unknown): Scene | null => {
      if (typeof item === 'string') {
        // Legacy fallback: plain string → use as description, derive keywords
        // from prompt, and let voiceover/caption fall back to the description.
        const description = item.trim()
        const voiceover = description
        return {
          description,
          searchKeywords: prompt.slice(0, 40),
          voiceover,
          caption: shortCaptionFromVoiceover(voiceover),
        }
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>
        const description = (typeof obj.description === 'string' ? obj.description : '').trim()
        const searchKeywords = (typeof obj.searchKeywords === 'string' ? obj.searchKeywords : '').trim()
        const rawVoiceover = (typeof obj.voiceover === 'string' ? obj.voiceover : '').trim()
        const rawCaption = (typeof obj.caption === 'string' ? obj.caption : '').trim()
        if (description) {
          // The cinematic `description` can double as voiceover when the
          // model doesn't supply one (e.g. older callers / legacy
          // responses). Caption is always derived from the voiceover so
          // both come from the same source string.
          const voiceover = rawVoiceover || description
          const caption = shortCaptionFromVoiceover(rawCaption || voiceover)
          return {
            description,
            searchKeywords: searchKeywords || prompt.slice(0, 40),
            voiceover,
            caption,
          }
        }
      }
      return null
    })
    .filter((s): s is Scene => s !== null)
    .slice(0, safeCount)

  while (scenes.length < safeCount) {
    const description = `Cinematic vertical 9:16 shot inspired by: ${prompt}`
    const voiceover = `Here is something most people do not know about ${prompt}.`
    scenes.push({
      description,
      searchKeywords: prompt.slice(0, 40),
      voiceover,
      caption: shortCaptionFromVoiceover(voiceover),
    })
  }
  return scenes
}

/**
 * Start a Runway text-to-video task.
 * @param rawPromptText  Raw scene description (will be sanitized before sending).
 * @param platform       Platform name for ratio mapping (default: "YouTube Shorts").
 * @param durationSeconds  Desired duration — only 5 or 10 will be sent to Runway.
 * @param quality        'basic' (default) or 'pro' (appends cinematic enhancer).
 */
export async function startRunwayTask(
  rawPromptText: string,
  platform = 'YouTube Shorts',
  durationSeconds = 10,
  quality: Quality = 'basic'
): Promise<RunwayTaskHandle> {
  // Build and validate payload BEFORE calling Runway (no credits charged yet)
  const payload = buildRunwayPayload(rawPromptText, platform, durationSeconds, quality)

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
