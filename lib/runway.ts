import { openai } from '@/lib/openai'
import { detectVisualCategory } from '@/lib/visualAssetCategories'

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

// Push #128 — Scene carries cinematic description + explicit Pexels keywords.
// Push #132 — Scene carries per-scene voiceover + caption from the same source.
// Push #211 — Creative Director upgrade: 8-field schema with stockSearchQuery,
// negativeVisualPrompt, scenePurpose, and visualIntent.
// Push #212 — visualCategory added. Maps to lib/visualAssetCategories.ts for
// verified whitelist-based stock footage selection (no toy rockets, etc.).
export interface Scene {
  description: string          // cinematic prose for Runway image/video AI
  searchKeywords: string       // 2-4 concrete nouns for Pexels (legacy compat)
  stockSearchQuery: string     // full optimised Pexels search query (premium)
  negativeVisualPrompt: string // comma-separated list of visual elements to avoid
  scenePurpose: string         // HOOK | ESCALATION | DISCOVERY | EXPLANATION | PAYOFF | FINAL_LINE
  visualIntent: string         // documentary aesthetic directive for the visual engine
  visualCategory: string       // maps to VISUAL_CATEGORIES in visualAssetCategories.ts
  voiceover: string            // narration line TTS will speak for this scene
  caption: string              // ≤8-word on-screen caption derived from voiceover
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

export async function generateScenes(prompt: string, count = 4): Promise<Scene[]> {
  const safeCount = Math.max(1, Math.min(9, Math.floor(count)))

  // Push #211 — Creative Director Engine. gpt-4o with 9-field scene schema.
  // Push #212 — Added visualCategory field for verified whitelist selection.
  const systemPrompt = `You are a Creative Director for premium faceless YouTube Shorts. You plan scenes that feel like mini-documentaries — stunning real footage, no filler visuals.

Your job is to return a JSON array of scene objects. Each scene object must include EXACTLY these 9 fields:
1. "description" — cinematic shot description (~15-25 words), visual + specific + subject + setting + lighting + camera motion + mood. 9:16 vertical framing.
2. "searchKeywords" — 2-4 concrete nouns for Pexels stock search (legacy compat). NEVER abstract words.
3. "stockSearchQuery" — optimized Pexels search phrase (5-10 words). Full cinematic query like "Falcon 9 rocket launch fire night slow motion". This is the PRIMARY search — make it specific and vivid.
4. "negativeVisualPrompt" — comma-separated list of visual elements NOT to show for this topic. Be specific.
5. "scenePurpose" — exactly one of: HOOK | ESCALATION | DISCOVERY | EXPLANATION | PAYOFF | FINAL_LINE
6. "visualIntent" — documentary aesthetic directive in 1 sentence. How should the shot FEEL?
7. "visualCategory" — pick the SINGLE best matching category from this list:
   rocket_launch, booster_landing, mission_control, earth_orbit, spacecraft,
   pyramids, ancient_egypt, deep_ocean, underwater_science, underground_city,
   ancient_engineering, ancient_city, desert_ruins, dna_lab, mystery_document,
   library_archive, forensic_case,
   billionaire_wealth, money_finance,
   psychology_mindset, technology_ai, historical_war, nature_geography,
   health_body, crime_mystery, animal_wildlife,
   general_science, general_documentary
   Pick the most specific category that matches the scene content.
8. "voiceover" — one narration line (10-22 words). MUST include at least one SPECIFIC number, name, date, dollar amount, or comparison — no vague claims. Exact TTS text. No filler like "imagine…", "what if…", or "most people don't know…".
9. "caption" — ≤8-word on-screen caption paraphrasing the voiceover. Punchy fragment. No period.

You always respond with a valid JSON array ONLY — no markdown, no code fences, no commentary.`

  const userPrompt = `Plan ${safeCount} scenes for this YouTube Short idea:

"${prompt}"

TOPIC FIDELITY — the most important rule (read first):
- Every single scene must be specifically and literally about "${prompt}". Do NOT drift to a broader category, a different but related subject, or generic stock filler.
- Each scene's "voiceover" must state a concrete, verifiable fact about THIS exact topic — not about the genre in general.
- Each scene's "stockSearchQuery" MUST be derived from the LITERAL CONTENT of THAT SCENE'S OWN voiceover line. Read the voiceover sentence, identify the most visual noun phrase or action in it, and build the stockSearchQuery from those exact words. The footage shown on screen must match what is BEING SAID at that moment — not just the general topic.
  - voiceover "He crossed the Sahara with 60,000 soldiers" → stockSearchQuery "sahara desert caravan camel crossing" ✓ (NOT "ancient african king")
  - voiceover "K2 has a 29% fatality rate" → stockSearchQuery "k2 mountain summit steep dangerous" ✓ (NOT just "mountain climbing")
  - voiceover "The stock market lost 89% in 3 years" → stockSearchQuery "stock market crash graph falling 1929" ✓ (NOT "wall street general")
  - voiceover "Bezos earns $4,000 every second" → stockSearchQuery "dollar bills cash stacks wealth" ✓ (NOT "amazon logo")
- The examples below are FORMAT references only. Copy their structure and specificity, never their subject — unless the user's topic actually is rockets, pyramids, etc.

TOPIC-SPECIFIC VISUAL RULES — read carefully before writing stockSearchQuery, negativeVisualPrompt, and visualCategory:

ROCKETS / SPACE / ELON MUSK / SPACEX / NASA / STARSHIP / FALCON 9:
  stockSearchQuery MUST use real rocket/space nouns: "Falcon 9 rocket launch fire night", "rocket launchpad smoke", "rocket booster landing ocean", "Earth from space orbit", "rocket engine exhaust"
  negativeVisualPrompt MUST include: "toy rocket, cartoon rocket, model rocket, music studio, random office, lifestyle people, animation, children playground"
  visualCategory: use rocket_launch (for launch scenes), booster_landing (landing), mission_control (control room), earth_orbit (space view), spacecraft (orbiting vehicle)

ANCIENT HISTORY / PYRAMIDS / CIVILIZATIONS / ARCHAEOLOGY:
  stockSearchQuery: "Great Pyramid Giza aerial desert", "ancient Egypt hieroglyphics temple wall", "Roman Colosseum ancient ruins stone"
  negativeVisualPrompt: "modern buildings, CGI reconstruction, cartoon, animation, actors in costume"
  visualCategory: pyramids, ancient_egypt, ancient_city, ancient_engineering, desert_ruins

DEEP OCEAN / MARINE BIOLOGY / UNDERWATER:
  stockSearchQuery: "deep ocean submarine lights dark", "bioluminescent jellyfish dark water", "ocean floor dark footage"
  negativeVisualPrompt: "swimming pool, aquarium tank glass, snorkeling holiday, cartoon fish, animation, beach holiday"
  visualCategory: deep_ocean, underwater_science

MONEY / FINANCE / WEALTH / BITCOIN / INVESTING / STOCK MARKET:
  stockSearchQuery: "dollar bills cash hands counting close", "gold coins pile wealth", "stock market graph chart laptop", "wall street trading floor monitors", "bitcoin cryptocurrency coin gold shiny"
  negativeVisualPrompt: "cartoon money, clipart, piggy bank toy, abstract digital rain, green matrix code, portrait, headshot, smiling businessman, generic office handshake"
  visualCategory: money_finance

BILLIONAIRES / ENTREPRENEURS (Elon Musk, Jeff Bezos, Mark Zuckerberg, Warren Buffett, etc.):
  stockSearchQuery: AVOID portrait/face queries. Use cinematic location/object queries: "wall street trading floor screens", "gold bars vault bank luxury", "luxury penthouse interior city view night", "sports car driving city night", "private jet interior cabin luxury", "dollar bills cash stacks money close", "skyscraper aerial city skyline night"
  negativeVisualPrompt: "cartoon character, clipart, portrait, headshot, selfie, smiling man, businessman portrait, face close-up, beard man, generic office handshake, team meeting"
  visualCategory: billionaire_wealth
  NOTE: voiceover MUST name the specific person and cite a real dollar amount, year, or fact

COUNTRIES / PLACES / GEOGRAPHY / MOUNTAINS / CITIES:
  stockSearchQuery: use the EXACT place name: "Mount Everest Himalaya snow summit aerial", "Amazon river jungle aerial drone", "Tokyo city skyline night neon", "Dubai skyscraper aerial desert"
  negativeVisualPrompt: "cartoon map, animation, tourist selfie, generic city skyline, fake aerial render"
  visualCategory: general_documentary or desert_ruins (for historical sites)
  NOTE: each scene should show a DIFFERENT visual aspect of the place (aerial, street level, landmark, nature)

MYSTERIES / CONSPIRACIES / PARANORMAL / DISAPPEARANCES / UNSOLVED CASES:
  stockSearchQuery: "dark forest night fog", "abandoned building interior dark", "old newspaper archive", "classified document paper", "detective crime scene tape"
  negativeVisualPrompt: "cartoon alien, UFO clipart, cheap horror movie, animation, comedy sketch, daylight happy scene"
  visualCategory: mystery_document or library_archive or general_documentary

HISTORICAL EVENTS / WARS / EMPIRES / ANCIENT CIVILIZATIONS:
  stockSearchQuery: use specific historical nouns: "World War 2 vintage footage", "Roman Colosseum ruins stone", "medieval castle stone wall", "ancient manuscript parchment close-up"
  negativeVisualPrompt: "modern cartoon, CGI reconstruction, video game graphics, actors in bad costumes"
  visualCategory: ancient_city or ancient_engineering or library_archive or general_documentary

TECH / AI / SILICON VALLEY / COMPUTERS / ALGORITHMS:
  stockSearchQuery: "computer chip circuit board macro", "data center server racks dark glow", "code terminal dark screen", "neural network visualization digital"
  negativeVisualPrompt: "clipart robot, cartoon AI, generic office, people smiling at laptop, stock handshake, animation"
  visualCategory: technology_ai

PSYCHOLOGY / MINDSET / BEHAVIOR / HABITS / BRAIN SCIENCE:
  stockSearchQuery: "human brain neuron dark close", "mind silhouette shadow dramatic", "psychology experiment laboratory"
  negativeVisualPrompt: "portrait, headshot, smiling person, generic office, cartoon brain, clipart"
  visualCategory: psychology_mindset
  NOTE: voiceover MUST cite a specific study, percentage, or named psychological effect

HISTORICAL WARS / BATTLES / MILITARY SECRETS / WEAPONS:
  stockSearchQuery: "vintage war archive footage historical", "war memorial monument stone", "old military equipment museum"
  negativeVisualPrompt: "video game, cartoon, CGI, actors in bad costume, modern soldier movie"
  visualCategory: historical_war

GEOGRAPHY / MOUNTAINS / NATURE / LANDSCAPES:
  stockSearchQuery: use EXACT place name — "Mount Everest summit aerial drone", "Amazon jungle aerial", "volcano eruption lava night"
  negativeVisualPrompt: "tourist selfie, cartoon map, animation, holiday-people"
  visualCategory: nature_geography

ANIMALS / WILDLIFE / NATURE DOCUMENTARY:
  stockSearchQuery: use specific animal + behavior — "lion hunting savanna cinematic", "eagle flying aerial slow motion", "shark deep ocean dark"
  negativeVisualPrompt: "cartoon, animation, zoo-enclosure glass, pet playing, kids"
  visualCategory: animal_wildlife

HEALTH / HUMAN BODY / BIOLOGY / MEDICINE:
  stockSearchQuery: "human body anatomy organ dark", "medical brain scan x-ray", "microscope bacteria cell dark"
  negativeVisualPrompt: "smiling nurse commercial, cartoon body, clipart, happy doctor"
  visualCategory: health_body

TRUE CRIME / MYSTERIES / CONSPIRACIES / DARK HISTORY:
  stockSearchQuery: "crime scene tape dark night", "detective folder documents dark", "dark forest fog abandoned"
  negativeVisualPrompt: "cartoon alien, comedy, bright happy scene, UFO clipart, kids show"
  visualCategory: crime_mystery

SCENE PURPOSE FLOW for ${safeCount} scenes: Start with HOOK (scene 1), build through ESCALATION and DISCOVERY, use EXPLANATION for core facts, PAYOFF for the climax, FINAL_LINE for the mic-drop ending.

Return ONLY a valid JSON array of exactly ${safeCount} objects with all 9 fields.

Example PERFECT scene (rockets topic):
{
  "description": "Falcon 9 rocket ascending through dark night sky, twin engine plumes blazing white-orange, slow-motion vertical climb above launch pad",
  "searchKeywords": "rocket launch fire night",
  "stockSearchQuery": "Falcon 9 rocket launch fire night slow motion",
  "negativeVisualPrompt": "toy rocket, cartoon rocket, music studio, random office, animation",
  "scenePurpose": "HOOK",
  "visualIntent": "IMAX-scale awe — viewer feels raw thrust power in the first 3 seconds",
  "visualCategory": "rocket_launch",
  "voiceover": "SpaceX's Falcon 9 generates more thrust than 18 Boeing 747 engines at full power.",
  "caption": "More thrust than 18 jumbo jets"
}

Example PERFECT scene (pyramids topic):
{
  "description": "Aerial drone shot pulling back from Great Pyramid apex, revealing full Giza plateau at golden hour, warm desert haze, cinematic wide",
  "searchKeywords": "pyramid egypt desert aerial",
  "stockSearchQuery": "Great Pyramid Giza aerial desert golden hour drone",
  "negativeVisualPrompt": "modern buildings, CGI reconstruction, cartoon, actors in costume",
  "scenePurpose": "DISCOVERY",
  "visualIntent": "Planetary-scale perspective — ancient stone structure dwarfs everything, triggering awe",
  "visualCategory": "pyramids",
  "voiceover": "The Great Pyramid was the tallest structure on Earth for 3,800 years — until a cathedral surpassed it in 1311.",
  "caption": "Tallest building for 3,800 years"
}`

  const completion = await openai.chat.completions.create(
    {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 1800,
    },
    { timeout: 35000 }
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
        // Legacy fallback: plain string → use as description with safe defaults
        const description = item.trim()
        const voiceover = description
        const autoCategory = detectVisualCategory(prompt, voiceover) ?? 'general_documentary'
        return {
          description,
          searchKeywords: prompt.slice(0, 40),
          stockSearchQuery: prompt.slice(0, 60),
          negativeVisualPrompt: 'cartoon, animation, clipart, toy',
          scenePurpose: 'EXPLANATION',
          visualIntent: 'Documentary style, cinematic and grounded',
          visualCategory: autoCategory,
          voiceover,
          caption: shortCaptionFromVoiceover(voiceover),
        }
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>
        const description = (typeof obj.description === 'string' ? obj.description : '').trim()
        const searchKeywords = (typeof obj.searchKeywords === 'string' ? obj.searchKeywords : '').trim()
        const stockSearchQuery = (typeof obj.stockSearchQuery === 'string' ? obj.stockSearchQuery : '').trim()
        const negativeVisualPrompt = (typeof obj.negativeVisualPrompt === 'string' ? obj.negativeVisualPrompt : '').trim()
        const scenePurpose = (typeof obj.scenePurpose === 'string' ? obj.scenePurpose : '').trim()
        const visualIntent = (typeof obj.visualIntent === 'string' ? obj.visualIntent : '').trim()
        const rawVisualCategory = (typeof obj.visualCategory === 'string' ? obj.visualCategory : '').trim()
        const rawVoiceover = (typeof obj.voiceover === 'string' ? obj.voiceover : '').trim()
        const rawCaption = (typeof obj.caption === 'string' ? obj.caption : '').trim()
        if (description) {
          const voiceover = rawVoiceover || description
          const caption = shortCaptionFromVoiceover(rawCaption || voiceover)
          const sqFinal = stockSearchQuery || searchKeywords || prompt.slice(0, 60)
          // Prefer GPT-assigned visualCategory; fall back to auto-detection from content
          const visualCategory =
            rawVisualCategory ||
            detectVisualCategory(sqFinal, voiceover) ||
            'general_documentary'
          console.log(`[scene] purpose=${scenePurpose || 'EXPLANATION'} category=${visualCategory} query="${sqFinal.slice(0, 60)}"`)
          return {
            description,
            searchKeywords: searchKeywords || prompt.slice(0, 40),
            stockSearchQuery: sqFinal,
            negativeVisualPrompt: negativeVisualPrompt || 'cartoon, animation, clipart, toy',
            scenePurpose: scenePurpose || 'EXPLANATION',
            visualIntent: visualIntent || 'Documentary style, cinematic and grounded',
            visualCategory,
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
    const autoCategory = detectVisualCategory(prompt, voiceover) ?? 'general_documentary'
    scenes.push({
      description,
      searchKeywords: prompt.slice(0, 40),
      stockSearchQuery: prompt.slice(0, 60),
      negativeVisualPrompt: 'cartoon, animation, clipart, toy',
      scenePurpose: 'EXPLANATION',
      visualIntent: 'Documentary style, cinematic and grounded',
      visualCategory: autoCategory,
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
