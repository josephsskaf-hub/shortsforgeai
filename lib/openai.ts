import OpenAI from 'openai'

// Lazy singleton — avoid instantiating at module load so Next.js can
// statically analyze API route modules at build time without the env var.
let _openai: OpenAI | null = null
function getClient(): OpenAI {
  if (_openai) return _openai
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
  _openai = new OpenAI({ apiKey })
  return _openai
}

export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    const client = getClient() as unknown as Record<string | symbol, unknown>
    const value = client[prop]
    return typeof value === 'function' ? (value as Function).bind(client) : value
  },
})

export interface ShortVideo {
  title: string
  script: string
  videoPrompt: string
  hashtags: string[]
  youtubeDescription: string
}

// Push #064 — duration-aware narration sizing.
//   30s → 75–90 words and 4 scenes
//   45s → 110–135 words and 5 scenes (default)
//   60s → 150–180 words and 6 scenes
export interface DurationPlan {
  duration: 30 | 45 | 60
  wordCountRange: [number, number]
  sceneCount: number
}

export function durationPlanFor(duration: number): DurationPlan {
  if (duration <= 35) return { duration: 30, wordCountRange: [75, 90], sceneCount: 4 }
  if (duration >= 55) return { duration: 60, wordCountRange: [150, 180], sceneCount: 6 }
  return { duration: 45, wordCountRange: [110, 135], sceneCount: 5 }
}

// Push #064 — story arc enforced on every Short. The arc keeps the AI
// from emitting "5 random facts" without a build-up; the ending samples
// are deliberately decisive so the closing scene doesn't trail off.
export const STORY_ARC_SYSTEM_RULES = `Every video must follow this exact structure:
1. HOOK (first 2 seconds): Grab attention immediately with a striking statement or question.
2. SETUP: Briefly explain what the topic is.
3. TENSION/MYSTERY: Show why it is strange, surprising, or important.
4. EXPLANATION: Give enough context so the viewer understands.
5. PAYOFF/ENDING: End with a strong final revelation, cliffhanger, or satisfying conclusion.

Do NOT list random facts without a story arc.
Do NOT end abruptly.
The ending MUST feel complete and strong — examples:
- "And that is why this mystery still refuses to disappear."
- "Some discoveries do not solve history. They make it stranger."
- "If this is what we found… what else is still hidden?"`

// Push #064 — caption highlight picker. Caption objects carry an optional
// `highlight` field so the renderer can paint that word in yellow. When the
// model doesn't supply one, we pick the most impactful word from the
// candidate list, falling back to the last meaningful word in the caption.
const HIGHLIGHT_CANDIDATES = [
  'strange', 'hidden', 'vanished', 'signal', 'mystery', 'impossible',
  'forbidden', 'unknown', 'discovered', 'secret', 'ancient', 'bizarre',
  'haunted', 'cursed', 'lost', 'found', 'real',
]

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'so', 'of', 'to', 'in', 'on', 'at',
  'by', 'for', 'with', 'as', 'is', 'was', 'were', 'are', 'be', 'been',
  'this', 'that', 'these', 'those', 'it', 'its', 'their', 'they', 'them',
  'he', 'she', 'we', 'you', 'i', 'me', 'my', 'your', 'our',
  'do', 'does', 'did', 'has', 'have', 'had', 'can', 'could', 'will',
  'would', 'should', 'just', 'than', 'then', 'when', 'where', 'why', 'how',
  'no', 'not', 'yes', 'if', 'into', 'from', 'about', 'after', 'before',
  'over', 'under', 'one', 'two',
])

function cleanWord(w: string): string {
  return w.replace(/[^a-zA-Z]/g, '').toLowerCase()
}

export function pickHighlightWord(caption: string): string | null {
  const text = (caption ?? '').trim()
  if (!text) return null
  const tokens = text.split(/\s+/)
  // Pass 1 — explicit candidate word.
  for (const tok of tokens) {
    const c = cleanWord(tok)
    if (HIGHLIGHT_CANDIDATES.includes(c)) return tok.replace(/[.,;!?:]+$/, '')
  }
  // Pass 2 — fall back to the last non-stopword (often the noun/adjective
  // that carries the meaning).
  for (let i = tokens.length - 1; i >= 0; i--) {
    const raw = tokens[i].replace(/[.,;!?:]+$/, '')
    const c = cleanWord(raw)
    if (c.length >= 4 && !STOPWORDS.has(c)) return raw
  }
  return null
}

// Push #066 — guided captions. A CaptionSegment is one viral-Shorts-sized
// caption slot: a ≤7-word chunk of the narration with the most impactful
// word pulled out so the renderer can paint it (or the whole line) yellow.
export interface CaptionSegment {
  text: string
  highlight: string | null
}

/**
 * Push #066 — Split a voiceover script into viral-style caption segments.
 *
 * Why deterministic (not an LLM call):
 *   Captions must always render. An LLM call here would add latency, cost,
 *   and a failure mode in the middle of compose. We instead use a hard
 *   rule — split on sentence boundaries, then break each sentence into
 *   ≤maxWords chunks — and pick the highlight word programmatically via
 *   `pickHighlightWord`. Result: one caption line at a time, max ~7 words,
 *   with a yellow-eligible keyword identified per slot.
 *
 * If the script is empty, returns []. The caller is expected to fall back
 * to scene captions in that case.
 */
export function buildCaptionSegments(script: string, maxWords = 7): CaptionSegment[] {
  const clean = (script ?? '').trim().replace(/\s+/g, ' ')
  if (!clean) return []

  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  const segments: CaptionSegment[] = []
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/)
    for (let i = 0; i < words.length; i += maxWords) {
      const chunk = words.slice(i, i + maxWords).join(' ').trim()
      if (!chunk) continue
      segments.push({
        text: chunk,
        highlight: pickHighlightWord(chunk),
      })
    }
  }
  return segments
}

const NICHE_CONTEXT: Record<string, string> = {
  // Legacy niches
  mideast: 'Middle East Secrets — hidden stories, geopolitics, untold facts, and shocking truths from the Middle East region (Dubai, Saudi Arabia, Egypt, Iran, etc.)',
  money: 'Money Facts — viral finance content, wealth inequality, how the rich get richer, money psychology, banking secrets, economic facts',
  mind: 'Mind Blowing Facts — jaw-dropping science, history, psychology, and nature facts that make people say "I never knew that"',
  dark: 'Dark Mysteries — unsolved mysteries, creepy historical events, government cover-ups, unexplained phenomena, horror history',
  motivation: 'Motivation — powerful motivational content, success mindset, daily discipline, overcoming failure, inspirational stories of real people',
  // Core niches
  history: 'History — fascinating historical facts, lost civilizations, ancient empires, wars, rulers, and turning points the textbooks rarely mention',
  mystery: 'Mystery — conspiracies, unsolved disappearances, secret societies, paranormal phenomena, government cover-ups, eerie unexplained events',
  finance: 'Finance — money psychology, wealth-building secrets, banking and economy facts, hidden financial truths, viral investing insights',
  science: 'Science — mind-bending physics, biology, space, the human body, cutting-edge discoveries that feel like science fiction',
  technology: 'Technology — AI breakthroughs, future tech, hidden truths about big tech, gadgets, cybersecurity, the next industrial revolution',
  general: 'General Viral — the most curiosity-driven, scroll-stopping facts and stories across any topic',
  // New viral niches
  'strange-facts': 'Strange Facts — the weirdest, most bizarre, and jaw-dropping facts from science, history, and nature that feel completely unreal',
  'hidden-places': 'Hidden Places — secret locations, forbidden zones, underground cities, and mysterious places most people will never see',
  'ancient-mysteries': 'Ancient Mysteries — lost civilizations, mysterious artifacts, impossible ancient technology, pyramids, and archaeological secrets',
  'billionaire-secrets': 'Billionaire Secrets — untold stories of how the ultra-rich really live, think, spend, and hide their wealth',
  'ai-tools': 'AI Tools — the most powerful AI tools transforming work, creativity, and life that most people do not know about',
  'money-hacks': 'Money Hacks — little-known financial tricks, tax secrets, passive income strategies, and wealth-building shortcuts',
  'psychology-facts': 'Psychology Facts — shocking truths about how the human mind works, dark psychology, manipulation tactics, and behavior science',
  'space-mysteries': 'Space Mysteries — mind-blowing discoveries, unexplained cosmic phenomena, alien theories, and the terrifying scale of the universe',
  'crime-stories': 'Crime Stories — true crime, heists, serial killers, masterminds, unsolved cases, and the darkest chapters of criminal history',
  'war-secrets': 'War Secrets — classified military operations, untold battles, government cover-ups, secret weapons, and the real stories behind wars',
  'survival-tips': 'Survival Tips — life-saving knowledge, extreme survival stories, disaster preparedness, and skills that could save your life',
  'conspiracy-files': 'Conspiracy Files — the most convincing conspiracy theories, government secrets, shadow organizations, and alternative histories',
  'tech-breakthroughs': 'Tech Breakthroughs — revolutionary technologies changing the world right now, from biotech to quantum computing',
  'lost-civilizations': 'Lost Civilizations — advanced ancient cultures, mysterious disappearances, forgotten empires, and archaeological anomalies',
  'animal-facts': 'Animal Facts — the most shocking, bizarre, and fascinating animal behaviors, abilities, and secrets from the natural world',
  'health-facts': 'Health Facts — surprising truths about the human body, controversial medical facts, and wellness secrets doctors do not always share',
  'celebrity-secrets': 'Celebrity Secrets — the untold stories, hidden scandals, secret lives, and shocking truths about famous people',
  'luxury-lifestyle': 'Luxury Lifestyle — how billionaires and celebrities really live, ultra-luxury experiences, and the world of extreme wealth',
  'future-predictions': 'Future Predictions — what scientists, futurists, and AI predict for the next 10-100 years that will change everything',
  'dark-history': 'Dark History — the most disturbing, suppressed, and chilling chapters of human history that were hidden from textbooks',
}

export function buildGenerationPrompt(niche: string): string {
  const context = NICHE_CONTEXT[niche] || NICHE_CONTEXT.general

  return `You are a viral YouTube Shorts content creator specializing in the "${context}" niche.

Generate exactly 5 viral YouTube Shorts scripts. Each short must be designed to maximize watch time, shares, and follows.

${STORY_ARC_SYSTEM_RULES}

Return ONLY a valid JSON array with exactly 5 objects. No markdown, no code blocks, no extra text — just the raw JSON array.

Each object must have these exact fields:
- "title": string — a click-bait, curiosity-driving title under 70 chars with 1 relevant emoji at the end
- "script": string — a complete 30-second script with 3 clearly labeled sections: "🎯 HOOK:" (first 3 seconds, shocking statement), "📝 CONTENT:" (main body, 20 seconds), "🔗 ENDING:" (call to action, 7 seconds). Use \\n\\n between sections.
- "videoPrompt": string — a detailed AI video generation prompt describing visuals, camera angles, text overlays, transitions, mood, and vertical 9:16 format
- "hashtags": array of 7 strings — each starting with # (e.g. "#shorts"), mix of niche-specific and viral tags
- "youtubeDescription": string — 2-3 sentences optimized for YouTube Shorts SEO, include primary keyword naturally

Make every hook absolutely shocking. The first 3 seconds must make the viewer physically unable to scroll past.`
}

export function buildSingleVideoPrompt(niche: string, topic: string, tone: string, durationSec: number): string {
  const context = NICHE_CONTEXT[niche] || NICHE_CONTEXT.general
  const safeTopic = topic.trim() || 'viral curiosity'
  const plan = durationPlanFor(durationSec)
  const [minWords, maxWords] = plan.wordCountRange

  return `You are a viral YouTube Shorts content creator specializing in the "${context}" niche.

Generate ONE viral YouTube Short tailored to this exact topic:
"${safeTopic}"

Tone: ${tone}. Target duration: ${plan.duration} seconds. Target word count: ${minWords}–${maxWords} words. Scene count: ${plan.sceneCount}. Vertical 9:16 format. English language.

${STORY_ARC_SYSTEM_RULES}

Return ONLY a valid JSON array containing exactly 1 object — no markdown, no code blocks, no extra text. Just the raw JSON array.

The object must have these exact fields:
- "title": string — a click-bait, curiosity-driving title under 70 chars with 1 relevant emoji at the end
- "script": string — a complete ${plan.duration}-second script following the HOOK → SETUP → TENSION → EXPLANATION → PAYOFF arc above. Total word count must land in ${minWords}–${maxWords} words. Use 3 clearly labeled sections: "🎯 HOOK:" (first 2 seconds), "📝 CONTENT:" (setup + tension + explanation), "🔗 ENDING:" (CTA — must end with: "Visit shortsforgeai.com"). Use \\n\\n between sections.
- "videoPrompt": string — a detailed AI video generation prompt describing visuals, camera angles, text overlays, transitions, mood, and vertical 9:16 format
- "hashtags": array of 7 strings — each starting with # (e.g. "#shorts"), mix of niche-specific and viral tags
- "youtubeDescription": string — 2-3 sentences optimized for YouTube Shorts SEO, include primary keyword naturally

Make the hook absolutely shocking. The first 2 seconds must make the viewer physically unable to scroll past.`
}
