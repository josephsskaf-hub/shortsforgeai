/**
 * Dynamic AI Narration Engine — Niche → Voice Mapping
 * Phase 1: Auto-select the best persona for a given content vertical/script.
 *
 * detectVertical() analyses the script text + channel vertical string and
 * returns the most appropriate persona ID. selectVoiceForScript() is the
 * public entry-point used by generateTTS().
 */

import { VOICE_PERSONAS, type VoicePersona } from './personas'

// ─── Niche types ─────────────────────────────────────────────────────────────

export type ContentNiche =
  | 'mystery'
  | 'conspiracy'
  | 'dark_history'
  | 'finance'
  | 'billionaire'
  | 'money'
  | 'curiosities'
  | 'learning'
  | 'facts'
  | 'history'
  | 'geography'
  | 'science'
  | 'luxury'
  | 'travel'
  | 'technology'
  | 'ai'

// ─── Persona mapping per niche ────────────────────────────────────────────────

type NicheMapping = {
  /** Primary persona ID — used for premium/free if available */
  primary: string
  /** Secondary persona — used as fallback or for free-tier if primary is premium */
  secondary: string
  /** Cinematic tier upgrade */
  cinematic?: string
}

const NICHE_PERSONA_MAP: Record<ContentNiche, NicheMapping> = {
  mystery:      { primary: 'dark-mystery',      secondary: 'conspiracy',        cinematic: 'emotional-storyteller' },
  conspiracy:   { primary: 'conspiracy',         secondary: 'dark-mystery',      cinematic: 'dark-mystery' },
  dark_history: { primary: 'documentary',        secondary: 'dark-mystery',      cinematic: 'emotional-storyteller' },
  finance:      { primary: 'finance-authority',  secondary: 'storyteller',       cinematic: 'luxury-narrator' },
  billionaire:  { primary: 'finance-authority',  secondary: 'luxury-narrator',   cinematic: 'luxury-narrator' },
  money:        { primary: 'finance-authority',  secondary: 'energetic-facts',   cinematic: 'luxury-narrator' },
  curiosities:  { primary: 'energetic-facts',    secondary: 'storyteller',       cinematic: 'emotional-storyteller' },
  learning:     { primary: 'storyteller',         secondary: 'energetic-facts',   cinematic: 'documentary' },
  facts:        { primary: 'energetic-facts',    secondary: 'storyteller',       cinematic: 'documentary' },
  history:      { primary: 'documentary',         secondary: 'emotional-storyteller', cinematic: 'emotional-storyteller' },
  geography:    { primary: 'documentary',         secondary: 'storyteller',       cinematic: 'luxury-narrator' },
  science:      { primary: 'documentary',         secondary: 'futuristic-ai',     cinematic: 'futuristic-ai' },
  luxury:       { primary: 'luxury-narrator',    secondary: 'finance-authority', cinematic: 'luxury-narrator' },
  travel:       { primary: 'luxury-narrator',    secondary: 'documentary',       cinematic: 'luxury-narrator' },
  technology:   { primary: 'futuristic-ai',      secondary: 'energetic-facts',   cinematic: 'futuristic-ai' },
  ai:           { primary: 'futuristic-ai',       secondary: 'storyteller',       cinematic: 'futuristic-ai' },
}

// ─── Keyword-based niche detection ───────────────────────────────────────────

const NICHE_KEYWORDS: Array<{ niche: ContentNiche; keywords: string[] }> = [
  // mystery / conspiracy first — highest specificity
  { niche: 'conspiracy',   keywords: ['conspiracy', 'cover up', 'coverup', 'secret society', 'illuminati', 'deep state', 'cover-up', 'classified', 'government hid'] },
  { niche: 'mystery',      keywords: ['unsolved', 'mystery', 'disappear', 'vanish', 'haunted', 'paranormal', 'ufo', 'alien', 'unexplained', 'supernatural', 'ghost', 'weird', 'strange'] },
  { niche: 'dark_history', keywords: ['war crime', 'massacre', 'genocide', 'torture', 'execution', 'dark history', 'serial killer', 'murder', 'brutal', 'atrocity'] },
  // billionaire / luxury before generic finance
  { niche: 'billionaire',  keywords: ['billionaire', 'elon musk', 'jeff bezos', 'warren buffett', 'bill gates', 'zuckerberg', 'billion dollar', 'richest'] },
  { niche: 'luxury',       keywords: ['luxury', 'mansion', 'yacht', 'ferrari', 'lamborghini', 'rolex', 'private jet', 'penthouse', 'exclusive', 'ultra-rich', 'rolls royce'] },
  { niche: 'finance',      keywords: ['stock market', 'invest', 'compound interest', 'credit card', 'debt', 'savings', 'budget', 'inflation', 'recession', 'economy', 'crypto', 'bitcoin', 'money trap'] },
  { niche: 'money',        keywords: ['money habit', 'financial freedom', 'passive income', 'rich', 'wealth', 'salary', 'income', 'broke', 'afford'] },
  // ai / tech before science
  { niche: 'ai',           keywords: ['artificial intelligence', 'machine learning', 'chatgpt', 'openai', 'robot', 'automation', 'neural network', ' ai '] },
  { niche: 'technology',   keywords: ['tech', 'software', 'computer', 'internet', 'smartphone', 'app', 'code', 'startup', 'silicon valley', 'quantum', 'space'] },
  { niche: 'science',      keywords: ['science', 'physics', 'chemistry', 'biology', 'experiment', 'discovery', 'nasa', 'universe', 'black hole', 'evolution', 'dna'] },
  // history / geography
  { niche: 'history',      keywords: ['ancient', 'roman', 'empire', 'medieval', 'century', 'world war', 'wwii', 'wwi', 'historical', 'civilization', 'pharaoh', 'viking', 'revolution'] },
  { niche: 'geography',    keywords: ['country', 'capital', 'mountain', 'ocean', 'continent', 'nation', 'population', 'territory', 'island', 'border', 'flag', 'language spoken', 'city'] },
  { niche: 'travel',       keywords: ['travel', 'visit', 'beach', 'destination', 'tourism', 'backpack', 'hostel', 'wanderlust', 'explore', 'hidden gem'] },
  // generic learning / facts last — lowest specificity
  { niche: 'curiosities',  keywords: ['did you know', 'fun fact', 'actually', 'surprisingly', 'most people', 'no one knows', 'you won\'t believe'] },
  { niche: 'facts',        keywords: ['fact', 'truth about', 'real reason', 'real story'] },
]

// Channel vertical string → most likely niche (fast coarse detection)
const VERTICAL_TO_NICHE: Record<string, ContentNiche> = {
  mystery:    'mystery',
  finance:    'finance',
  billionaire: 'billionaire',
  learning:   'learning',
  geography:  'geography',
  country:    'geography',
  history:    'history',
  technology: 'technology',
  luxury:     'luxury',
  travel:     'travel',
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect the content niche from a combination of script text and channel
 * vertical label. Vertical is used as a strong prior, then keyword scanning
 * refines to the most specific sub-niche.
 */
export function detectNiche(script: string, vertical?: string): ContentNiche {
  const lower = script.toLowerCase()

  // 1. Run keyword scan — first match wins (list is ordered most→least specific)
  for (const { niche, keywords } of NICHE_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return niche
  }

  // 2. Fall back to channel vertical if no keyword matched
  if (vertical) {
    const vLower = vertical.toLowerCase()
    for (const [key, niche] of Object.entries(VERTICAL_TO_NICHE)) {
      if (vLower.includes(key)) return niche
    }
  }

  // 3. Last resort — generic facts
  return 'facts'
}

/**
 * Select the best VoicePersona for the given script + vertical.
 *
 * @param script - The narration text (used for keyword detection)
 * @param vertical - Channel vertical hint (e.g. 'mystery', 'finance', 'geography')
 * @param userTier - User's subscription tier (free | premium | cinematic)
 * @returns The VoicePersona to use for TTS generation
 */
export function selectPersonaForScript(
  script: string,
  vertical?: string,
  userTier: 'free' | 'premium' | 'cinematic' = 'free',
): VoicePersona {
  const niche = detectNiche(script, vertical)
  const mapping = NICHE_PERSONA_MAP[niche]

  const getPersona = (id: string): VoicePersona | undefined =>
    VOICE_PERSONAS.find((p) => p.id === id)

  // Cinematic tier: try cinematic → primary → secondary
  if (userTier === 'cinematic' && mapping.cinematic) {
    const p = getPersona(mapping.cinematic)
    if (p) return p
  }

  // Premium tier: primary persona regardless of its own tier
  if (userTier === 'premium' || userTier === 'cinematic') {
    const p = getPersona(mapping.primary)
    if (p) return p
  }

  // Free tier: try primary if it's free, else fall back to secondary
  const primary = getPersona(mapping.primary)
  if (primary?.tier === 'free') return primary

  const secondary = getPersona(mapping.secondary)
  if (secondary?.tier === 'free') return secondary

  // Ultimate fallback — storyteller is always free
  return VOICE_PERSONAS.find((p) => p.id === 'storyteller')!
}

/**
 * Log-friendly summary of the voice selection decision.
 * Used in compose/route.ts to log which persona was chosen and why.
 */
export function describeVoiceSelection(
  script: string,
  vertical?: string,
  userTier: 'free' | 'premium' | 'cinematic' = 'free',
): string {
  const niche = detectNiche(script, vertical)
  const persona = selectPersonaForScript(script, vertical, userTier)
  return `niche=${niche} vertical=${vertical ?? 'unknown'} tier=${userTier} → persona=${persona.id} voice=${persona.voice} speed=${persona.defaultSpeed}`
}
