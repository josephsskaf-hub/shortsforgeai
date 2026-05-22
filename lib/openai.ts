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
// Push #208 — added 90s tier.
//   90s → 225–270 words and 9 scenes
export interface DurationPlan {
  duration: 30 | 45 | 60 | 90
  wordCountRange: [number, number]
  sceneCount: number
}

export function durationPlanFor(duration: number): DurationPlan {
  if (duration <= 35) return { duration: 30, wordCountRange: [75, 90], sceneCount: 4 }
  if (duration >= 80) return { duration: 90, wordCountRange: [225, 270], sceneCount: 9 }
  if (duration >= 55) return { duration: 60, wordCountRange: [150, 180], sceneCount: 6 }
  return { duration: 45, wordCountRange: [110, 135], sceneCount: 5 }
}

// Push #065 — safe composition rules. Vertical 9:16 + bottom captions
// means generators must keep landmarks/faces inside a generous inner
// frame, otherwise heads, monuments, or readable text get clipped on
// the top/bottom or sit behind the caption strip. These rules are
// injected into every visual-prompt-building system prompt.
export const SAFE_COMPOSITION_RULES = `SAFE COMPOSITION (mandatory for every visual_prompt and provider_prompt):
- Center the main subject in frame. Keep all important elements within the central 80% of the frame.
- Avoid placing landmarks, faces, or key subjects near the edges. Ensure the full landmark/subject is visible without cropping.
- Subject must be fully visible — no part of the landmark, face, or focal object should be clipped by the top, bottom, or sides of the 9:16 frame.
- The main visual subject must sit in the UPPER 65-75% of the frame so the bottom 25-35% stays clear for captions. Never compose the subject so that captions at the bottom would cover it.
- Use safe inner-frame composition: center composition, subject fully visible, landmark fully readable.
- Avoid extreme close-ups that crop a face above the eyebrows or below the chin; avoid wide shots where a landmark touches the frame edges.`

// Push #083 — Addictive micro-knowledge content formula. Every Short must
// feel like Netflix knowledge dopamine: short, real, surprising, satisfying.
// Replaces the older "story arc" rules. We keep the export name
// STORY_ARC_SYSTEM_RULES so every existing caller picks up the new formula
// without breaking imports; a new alias MICRO_KNOWLEDGE_SYSTEM_RULES is
// also exported for new call sites.
export const MICRO_KNOWLEDGE_SYSTEM_RULES = `Every video must follow this addictive micro-knowledge formula:

CONTENT FORMULA:
1. BRUTAL HOOK (first 1-2 seconds): Must create instant curiosity. Start with a shocking fact, question, or statement.
2. MICRO-KNOWLEDGE (every 3-5 seconds): Real, surprising, useful facts. No filler. No vague mystery.
3. ESCALATION: Each fact must be more interesting than the last.
4. PAYOFF: A comparison, twist, statistic, or conclusion that makes it feel complete.
5. COMPLETE ENDING: Viewer should feel they learned something real.

RULES (non-negotiable):
- Every fact must be real and verifiable.
- No vague cinematic mystery with no answer.
- No generic motivational phrases.
- No filler language ("imagine...", "what if...", "scientists say...").
- Every 3-5 seconds delivers new information.
- End with a payoff, not a cliffhanger.

PREFERRED ANGLES: history facts, weird facts, money psychology, hidden places, science mysteries, ancient civilizations, ocean discoveries, forbidden inventions, military secrets, billionaire psychology.`

export const STORY_ARC_SYSTEM_RULES = MICRO_KNOWLEDGE_SYSTEM_RULES

// Push #064 — caption highlight picker. Caption objects carry an optional
// `highlight` field so the renderer can paint that word in yellow. When the
// model doesn't supply one, we pick the most impactful word from the
// candidate list, falling back to the last meaningful word in the caption.
const HIGHLIGHT_CANDIDATES = [
  'strange', 'hidden', 'vanished', 'signal', 'mystery', 'impossible',
  'forbidden', 'unknown', 'discovered', 'secret', 'ancient', 'bizarre',
  'haunted', 'cursed', 'lost', 'found', 'real',
  // Push #081 — broaden the keyword pool so finance/luxury topics also
  // get a colored caption word, not just mystery scripts.
  'wealth', 'rare', 'shocking', 'banned', 'leaked', 'exposed',
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

  return `You are a viral YouTube Shorts script writer specializing in addictive micro-knowledge content for the "${context}" niche. Every script must feel like Netflix knowledge dopamine — short, real, surprising, and satisfying.

Generate exactly 5 addictive micro-knowledge YouTube Shorts scripts. Each one delivers a brutal hook plus 4-5 real, surprising facts that escalate to a satisfying payoff.

${MICRO_KNOWLEDGE_SYSTEM_RULES}

${SAFE_COMPOSITION_RULES}

Return ONLY a valid JSON array with exactly 5 objects. No markdown, no code blocks, no extra text — just the raw JSON array.

Each object must have these exact fields:
- "title": string — a curiosity-driven YouTube title under 60 chars, no clickbait fluff, with 1 relevant emoji at the end
- "script": string — a complete ~30-second script (~80-100 words) with 3 clearly labeled sections: "🎯 HOOK:" (brutal opening line, 1-2 seconds), "📝 CONTENT:" (5 micro-knowledge beats, each 1-2 sentences, real facts, escalating), "🔗 PAYOFF:" (satisfying conclusion or twist — a comparison, twist, statistic, or definitive statement that makes it feel complete). Use \\n\\n between sections.
- "videoPrompt": string — a detailed AI video generation prompt describing visuals, camera angles, text overlays, transitions, mood, and vertical 9:16 format
- "hashtags": array of 7 strings — each starting with # (e.g. "#shorts"), mix of niche-specific and viral tags
- "youtubeDescription": string — 2-3 sentences optimized for YouTube Shorts SEO. Include the main facts naturally and the primary keyword.

Every fact must be real and verifiable. Every 3-5 seconds must deliver new information. End with a payoff, not a cliffhanger.`
}

export function buildSingleVideoPrompt(niche: string, topic: string, tone: string, durationSec: number): string {
  const context = NICHE_CONTEXT[niche] || NICHE_CONTEXT.general
  const safeTopic = topic.trim() || 'viral curiosity'
  const plan = durationPlanFor(durationSec)
  const [minWords, maxWords] = plan.wordCountRange

  return `You are a viral YouTube Shorts script writer specializing in addictive micro-knowledge content for the "${context}" niche. Every script must feel like Netflix knowledge dopamine — short, real, surprising, and satisfying.

Create an addictive micro-knowledge YouTube Short about: "${safeTopic}".
Duration: ~${plan.duration} seconds (~${minWords}-${maxWords} words of script). Make every line teach something real and surprising. Follow the Hook → Micro-Knowledge → Escalation → Payoff structure exactly.

Tone: ${tone}. Scene count: ${plan.sceneCount}. Vertical 9:16 format. English language.

${MICRO_KNOWLEDGE_SYSTEM_RULES}

${SAFE_COMPOSITION_RULES}

Return ONLY a valid JSON array containing exactly 1 object — no markdown, no code blocks, no extra text. Just the raw JSON array.

The object must have these exact fields:
- "title": string — a curiosity-driven YouTube title under 60 chars, no clickbait fluff, with 1 relevant emoji at the end
- "script": string — a complete ${plan.duration}-second script (${minWords}–${maxWords} words total) with 3 clearly labeled sections: "🎯 HOOK:" (brutal opening line, 1-2 seconds), "📝 CONTENT:" (5 micro-knowledge beats, each 1-2 sentences, real verifiable facts, escalating in interest, every 3-5 seconds delivers new info), "🔗 PAYOFF:" (a comparison, twist, statistic, or definitive conclusion that makes the Short feel complete — leave the viewer stunned, no call to action). Use \\n\\n between sections.
- "videoPrompt": string — a detailed AI video generation prompt describing visuals, camera angles, text overlays, transitions, mood, and vertical 9:16 format
- "hashtags": array of 7 strings — each starting with # (e.g. "#shorts"), mix of niche-specific and viral tags
- "youtubeDescription": string — 2-3 sentences optimized for YouTube Shorts SEO. Include the main facts naturally and the primary keyword.

Every fact must be real and verifiable. No filler ("imagine…", "what if…", "scientists say…"). End with a payoff, not a cliffhanger.`
}
