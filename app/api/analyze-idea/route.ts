import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai, durationPlanFor, MICRO_KNOWLEDGE_SYSTEM_RULES, SAFE_COMPOSITION_RULES } from '@/lib/openai'

export const maxDuration = 60

// ─── Schema ───────────────────────────────────────────────────────────────────
// Push #024A: richer creative brief. The legacy fields (title, summary, niche,
// scenePlan) are kept so existing clients keep working; new fields are added
// for clients that opt into the upgraded display.

interface SceneBrief {
  scene_number: number
  duration_seconds: number
  caption: string
  // Push #064 — single word from `caption` to render in yellow on the
  // final composed video. Optional: fall back to a heuristic pick when
  // the model doesn't supply one.
  highlight?: string | null
  visual_prompt: string
  voiceover: string
}

// Push #048 — Viral Intelligence Layer.
// Optional metadata returned alongside the creative brief so the Generate
// page can render a "Viral Intelligence" panel. Everything is best-effort:
// if the model can't supply a field we derive a safe fallback so the panel
// never disappears.
export type HookRating = 'weak' | 'medium' | 'strong' | 'excellent'

export interface ViralIntelligence {
  viral_score: number
  hook_rating: HookRating
  retention_notes: string[]
  thumbnail_texts: string[]
  opening_caption: string
  improvement_suggestions: string[]
}

interface CreativeBrief {
  // New rich fields
  viral_title: string
  hook: string
  summary: string
  niche: string
  tone: string
  voiceover_script: string
  scenes: SceneBrief[]
  music_mood: string
  pacing_notes: string
  youtube_title: string
  youtube_description: string
  hashtags: string[]
  // Push #024B: short cinematic prompt safe to send straight to Runway.
  // Max 500 chars (hard clamp), visual-only — no voiceover, hashtags, or
  // YouTube metadata. The client may pass this to /api/generate-video so the
  // server can skip a fresh OpenAI scene call for the overall video.
  provider_prompt: string
  // Push #025: hint at the duration the user asked for ("30 seconds", "ten
  // seconds", "around 50s", or null if nothing was mentioned). The client
  // uses this to pre-select the duration in Generation Settings.
  detected_duration_seconds: number | null
  // Push #048 — viral intelligence block. Always present in the response;
  // populated from model output when possible, otherwise a sane fallback.
  viral_intelligence: ViralIntelligence

  // Legacy compatibility — populated from the new fields so older callers
  // (e.g. GenerateClient before the matching client update) don't break.
  title: string
  scenePlan: string[]
}

/**
 * Best-effort parse of an explicit duration mentioned in the prompt. Returns
 * null when nothing is mentioned, so the client can decide its own default.
 */
function detectDurationFromPrompt(raw: string): number | null {
  const text = (raw ?? '').toLowerCase()
  const wordToNum: Record<string, number> = {
    ten: 10, fifteen: 15, twenty: 20, 'twenty-five': 25, 'twenty five': 25,
    thirty: 30, 'thirty-five': 35, 'thirty five': 35,
    forty: 40, 'forty-five': 45, 'forty five': 45,
    fifty: 50, sixty: 60, ninety: 90,
  }
  // Also detect "1:30" (90s) and "1:30 minutes" style
  if (/\b1[:\s]30\b/.test(text)) return 90
  const numMatch = text.match(/(?:~|around|about|roughly)?\s*(\d{1,3})\s*(?:s\b|sec\b|seconds?\b)/i)
  if (numMatch) {
    const n = Number(numMatch[1])
    if (Number.isFinite(n)) return n
  }
  for (const [word, n] of Object.entries(wordToNum)) {
    if (new RegExp(`\\b${word}\\s*(?:seconds?|sec|s)\\b`, 'i').test(text)) return n
  }
  return null
}

// Runway's text_to_video endpoint rejects prompts >500 chars. We clamp every
// model-facing string to this cap before either storing it or sending it on.
const PROVIDER_PROMPT_MAX = 500

// Hard-clamp a string to `max` characters at a sentence/comma boundary when
// possible, falling back to a plain slice. Strips leading/trailing whitespace.
export function clampToProviderLimit(raw: string, max = PROVIDER_PROMPT_MAX): string {
  const trimmed = raw.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= max) return trimmed
  const window = trimmed.slice(0, max)
  // Prefer to cut at the last sentence boundary or comma so we don't end mid-word.
  const lastSentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '))
  if (lastSentence > max * 0.6) return window.slice(0, lastSentence + 1).trim()
  const lastComma = window.lastIndexOf(', ')
  if (lastComma > max * 0.6) return window.slice(0, lastComma).trim()
  const lastSpace = window.lastIndexOf(' ')
  if (lastSpace > max * 0.6) return window.slice(0, lastSpace).trim()
  return window.trim()
}

function inferNiche(prompt: string): string {
  const p = prompt.toLowerCase()
  if (/(money|finance|wealth|invest|billionaire|cash)/.test(p)) return 'Finance'
  if (/(history|ancient|war|empire|forgotten)/.test(p)) return 'History'
  if (/(mystery|unexplained|signal|ufo|cover-?up|paranormal)/.test(p)) return 'Mystery'
  if (/(space|nasa|black hole|galaxy|alien|cosmos)/.test(p)) return 'Space'
  if (/(ai|robot|tech|future|automation)/.test(p)) return 'Tech'
  if (/(crime|killer|murder|case)/.test(p)) return 'True Crime'
  if (/(fact|did you know|stat|number)/.test(p)) return 'Facts'
  return 'General'
}

function inferTone(niche: string): string {
  switch (niche) {
    case 'Mystery':
    case 'Space':
    case 'True Crime': return 'Suspenseful'
    case 'History':
    case 'Facts': return 'Dramatic'
    case 'Finance': return 'Urgent and relatable'
    case 'Tech': return 'Fast-paced'
    default: return 'Cinematic'
  }
}

// Push #048 — derive a sane viral_intelligence block when the model
// doesn't return one. Score scales with hook length / specificity heuristics
// and we always supply 3 thumbnail texts so the UI panel has something to
// render even on cold fallback.
function fallbackViralIntelligence(hook: string, niche: string): ViralIntelligence {
  const hookWords = hook.trim().split(/\s+/).filter(Boolean).length
  // Heuristic: short, punchy hooks (6-12 words) score higher than essays.
  let score = 65
  if (hookWords >= 6 && hookWords <= 12) score = 78
  else if (hookWords >= 4 && hookWords <= 18) score = 70
  // Specificity bonus — numbers and proper nouns are pattern interrupts.
  if (/\d/.test(hook)) score += 4
  if (/[A-Z][a-z]+/.test(hook)) score += 2
  score = Math.max(40, Math.min(94, score))
  const rating: HookRating =
    score >= 85 ? 'excellent' : score >= 70 ? 'strong' : score >= 55 ? 'medium' : 'weak'
  const lowNiche = niche.toLowerCase()
  return {
    viral_score: score,
    hook_rating: rating,
    retention_notes: [
      'Open mid-action — drop the viewer into the moment, not the setup.',
      'Add a curiosity gap by 2-3s in so the viewer needs the next beat.',
      'Cut visuals every 2-3s — same scene twice loses ~15% retention.',
      'End on a cliffhanger or single-word reveal that demands a rewatch.',
    ],
    thumbnail_texts: [
      'Nobody Saw This',
      'The Truth Hits Hard',
      'Watch Until The End',
    ],
    opening_caption: 'You won\'t believe this.',
    improvement_suggestions:
      score < 70
        ? [
            'Rewrite the hook so the payoff lands in the first 5 words.',
            'Anchor the opening on a specific number, name, or claim.',
            `Lean harder into the ${lowNiche || 'genre'} tropes the audience already searches for.`,
          ]
        : [],
  }
}

function fallbackBrief(prompt: string): CreativeBrief {
  const trimmed = prompt.trim().slice(0, 80)
  const niche = inferNiche(prompt)
  const tone = inferTone(niche)
  const scenes: SceneBrief[] = [
    {
      scene_number: 1,
      duration_seconds: 6,
      caption: 'Wait — you have to see this',
      visual_prompt: 'extreme close-up macro shot, low-key lighting, deep shadows, ' +
        'a single point of light pulsing in the dark, cinematic 9:16 framing, 35mm film grain',
      voiceover: 'You have probably never heard about this — and that is the whole point.',
    },
    {
      scene_number: 2,
      duration_seconds: 8,
      caption: 'It started with one clue',
      visual_prompt: 'overhead drone shot pulling back slowly, cold blue-grey color palette, ' +
        'rain-soaked surface, single subject centered, volumetric mist',
      voiceover: 'It started with a single clue most people walked right past.',
    },
    {
      scene_number: 3,
      duration_seconds: 8,
      caption: 'Then they saw the pattern',
      visual_prompt: 'tracking shot through a corridor of glowing screens, magenta and teal neon, ' +
        'shallow depth of field, anamorphic flares, subject silhouetted',
      voiceover: 'Once they zoomed in, the pattern was impossible to ignore.',
    },
    {
      scene_number: 4,
      duration_seconds: 8,
      caption: 'And the truth was wilder',
      visual_prompt: 'slow push-in on a vintage monitor displaying classified text, ' +
        'green phosphor glow, dust in the air, cinematic chiaroscuro lighting',
      voiceover: 'And the truth, when it finally came out, was wilder than anyone guessed.',
    },
    {
      scene_number: 5,
      duration_seconds: 5,
      caption: 'Follow for part two',
      visual_prompt: 'silhouette of a figure walking toward a single distant light, ' +
        'twilight sky, ultra-wide vertical composition, faint lens flare',
      voiceover: 'Follow for the part nobody is allowed to talk about.',
    },
  ]
  const providerPrompt = clampToProviderLimit(
    `Cinematic vertical 9:16 video, ${tone.toLowerCase()} tone, ${niche.toLowerCase()} aesthetic. ` +
    `Dark moody lighting, deep shadows, dramatic camera moves, rich color grading, ` +
    `high contrast, atmospheric haze, single subject framing, suspenseful build, ` +
    `ultra-detailed textures, 35mm film grain, hyperreal.`,
  )
  const fallbackHook = 'You have never heard about this — and that is exactly the point.'
  return {
    viral_title: trimmed || 'The Truth Nobody Told You',
    hook: fallbackHook,
    summary: 'A fast-paced cinematic Short built around a single shocking idea, with strong visuals and a cliffhanger ending.',
    niche,
    tone,
    voiceover_script: scenes.map((s) => s.voiceover).join(' '),
    scenes,
    music_mood: 'dark cinematic pulse with rising tension',
    pacing_notes: 'fast cuts every 2–3 seconds, hold on the final scene for impact',
    youtube_title: trimmed || 'The Story Nobody Wanted You To Hear #shorts',
    youtube_description: 'A cinematic Short about the part of the story most people never get told. Watch to the end for the twist.',
    hashtags: ['#shorts', '#viral', '#mystery', '#fyp', '#storytime'],
    provider_prompt: providerPrompt,
    detected_duration_seconds: detectDurationFromPrompt(prompt),
    viral_intelligence: fallbackViralIntelligence(fallbackHook, niche),
    title: trimmed || 'The Truth Nobody Told You',
    // Push #132 — `scenePlan` is the legacy field the GenerateClient feeds
    // into /api/compose as `scene_captions`. It MUST be the readable per-scene
    // captions (≤8 word fragments paraphrasing each scene's voiceover) — not
    // the cinematic `visual_prompt`, which is a camera/lighting description
    // and reads as garbage when shown as a caption strip.
    scenePlan: scenes.map((s) => s.caption),
  }
}

// Push #316 — language support
type AnalyzeLanguage = 'en' | 'pt' | 'es'

function languageInstruction(language: AnalyzeLanguage): string {
  if (language === 'pt') {
    return `\nLANGUAGE: Generate all voiceover text, title, description, hashtags, and captions in Brazilian Portuguese (pt-BR). Visual prompts must stay in English (Pexels/Runway search requires English). JSON field names stay in English.`
  }
  if (language === 'es') {
    return `\nLANGUAGE: Generate all voiceover text, title, description, hashtags, and captions in Spanish (Latin American, es-419). Visual prompts must stay in English (Pexels/Runway search requires English). JSON field names stay in English.`
  }
  return '' // English is the default
}

function buildSystemPrompt(duration: number, language: AnalyzeLanguage = 'en'): string {
  const plan = durationPlanFor(duration)
  const [minWords, maxWords] = plan.wordCountRange
  return `You are a YouTube Shorts creative director specializing in addictive micro-knowledge content. Every script must feel like Netflix knowledge dopamine — short, real, surprising, and satisfying. Your job is to produce a complete creative brief for a ${plan.duration} second Short built around real, verifiable facts that escalate to a satisfying payoff.${languageInstruction(language)}

The brief MUST include: a viral_title, a brutal hook for the first 1-2 seconds, a scene-by-scene breakdown with cinematic visual prompts (never generic), captions of MAX 6-8 words, full voiceover_script (made of real micro-knowledge beats, not vague mystery), music_mood, pacing_notes, youtube_title, youtube_description, and hashtags.

${MICRO_KNOWLEDGE_SYSTEM_RULES}

${SAFE_COMPOSITION_RULES}

QUALITY RULES (non-negotiable):
- The hook lands in the first 1-2 seconds with a shocking fact, question, or statement. No "in this video..." or "today we will...". Start mid-revelation. No filler like "imagine…", "what if…", "scientists say…".
- The voiceover_script must deliver real, verifiable facts. No vague cinematic mystery with no answer. Every 3-5 seconds delivers new information. Each fact escalates over the last.
- The final scene MUST be a payoff: a comparison, twist, statistic, or definitive conclusion that makes the viewer feel they learned something real. Not a cliffhanger.
- Captions: maximum 6-8 words. Punchy fragments, not full sentences. No periods. Each caption SHOULD include a "highlight" field naming the single most impactful word in the caption (preferred candidates: strange, hidden, vanished, signal, mystery, impossible, forbidden, unknown, discovered, secret, ancient, bizarre, haunted, cursed, lost, found, real). If none of those fit, pick the most striking noun or adjective in the caption.
- Visual prompts must be EXTREMELY cinematic and specific. Describe camera angle, lighting, color palette, subject, atmosphere, lens feel. BAD: "ocean waves" or "historical ruins". GOOD: "extreme close-up of a sonar screen pulsing with an unknown signal, deep blue glow, underwater facility in soft focus behind, ominous teal atmosphere, slow push-in on the screen". Every visual_prompt should read like a shot list for a cinematographer.
- Every visual_prompt MUST embed the safe-composition constraints above: keep the main subject centered, fully visible, within the inner 80% of the frame, in the upper 65-75% so the bottom caption strip never covers it. Landmarks must be readable end-to-end without cropping.
- PERIOD ACCURACY (KINEO-ERA-LOCK-2026-07-09): if the script is set in a specific era or historical event, EVERY visual_prompt must state the year/era and use ONLY period-accurate technology, clothing, weapons and architecture — and must explicitly append "no modern objects, no modern vehicles, no tanks, no modern weapons, no modern clothing" as a constraint inside the prompt. Example for 1815: muskets, bayonets, cavalry horses, shako hats, smoke-covered fields — NEVER tanks, cars, helicopters or modern uniforms.
- REAL PEOPLE (KINEO-ERA-LOCK-2026-07-09): NEVER prompt a recognizable close-up face of a named real person (historical or living) — AI cannot match likeness and it breaks immersion. Show such figures from behind, in silhouette, at a distance, or imply them through details (a bicorne hat, a hand on a map, boots in mud). Write the visual_prompt so no identifiable face is the focal point.
- Every scene is visually distinct from the others — different camera angle, different lighting, different subject framing. No two scenes should feel like the same shot.
- The closing voiceover MUST land a payoff — a comparison, twist, statistic, or definitive conclusion. The voiceover MUST NOT trail off and MUST NOT end on a vague cliffhanger.
- Output is in English.
- Exactly ${plan.sceneCount} scenes. Total voiceover word count: ${minWords}–${maxWords} words. Durations add up to roughly ${plan.duration} seconds.

GENRE-SPECIFIC GUIDANCE:
- Mystery / Conspiracy: suspense, curiosity gaps, dark cinematic visuals, slow reveals, deep blues and shadow.
- History / Facts: fast pacing, surprising stats, bold dramatic narration, archival-feel visuals, warm sepia or hard contrast.
- Finance / Money: clean minimal aesthetic, relatable money problems, urgent tone, charts/cash/skyline visuals with high contrast.
- Space / Cosmic: vast cinematic scale, deep blacks, single subject against scale, ambient pulses.
- True Crime: cold lighting, slow tracking shots, evidence-board feel, restraint.
- Tech / AI: clean futurism, glowing UI, magenta/teal palette, motion in every shot.

PROVIDER PROMPT — important:
You also produce a separate "provider_prompt": a SHORT cinematic description (200-450 chars, NEVER over 500) that an AI video model can use directly. It must be visual only — no voiceover, no hashtags, no YouTube text, no scene list. Describe overall mood, color palette, lighting, camera language, subject framing. The framing must respect the SAFE COMPOSITION rules above: centered subject, fully visible inside the inner 80%, subject placed in the upper 65-75% so bottom captions never cover it. Example: "Cinematic vertical 9:16 video of a deep ocean at night, sonar screens glowing blue, centered composition with the subject in the upper two-thirds, underwater shadows moving slowly, suspenseful scientific monitoring station, realistic lighting, high contrast, mysterious mood, slow camera movement, full subject visible."

VIRAL INTELLIGENCE — also produce a "viral_intelligence" block scoring the brief you just wrote:
- viral_score: integer 0-100 estimating how likely this Short is to go viral on YouTube Shorts. Be honest — a generic hook should score 40-55, a specific cinematic one 65-80, a truly scroll-stopping pattern interrupt 80-95.
- hook_rating: "weak" | "medium" | "strong" | "excellent" — must agree with viral_score (weak<50, medium 50-69, strong 70-84, excellent 85+).
- retention_notes: array of 3-4 short tactical notes (one sentence each) on how the structure will hold attention.
- thumbnail_texts: array of EXACTLY 3 thumbnail-overlay strings, MAX 4-6 words each, all-caps friendly. No emoji.
- opening_caption: one short string for the first 2-second on-screen caption (max 6 words).
- improvement_suggestions: array of 0-3 short tweaks the creator could make to push the score higher. If viral_score >= 70 this MUST be an empty array.

OUTPUT FORMAT — valid JSON ONLY (no markdown fences, no commentary) matching this exact schema:
{
  "viral_title": string,
  "hook": string,
  "summary": string,
  "niche": string,
  "tone": string,
  "voiceover_script": string,
  "scenes": [
    {
      "scene_number": number,
      "duration_seconds": number,
      "caption": string,
      "highlight": string (one word from caption to paint yellow on screen — see rules above),
      "visual_prompt": string (max 450 characters, cinematic-specific),
      "voiceover": string
    }
  ],
  "music_mood": string,
  "pacing_notes": string,
  "youtube_title": string,
  "youtube_description": string,
  "hashtags": string[],
  "provider_prompt": string (200-450 chars, hard max 500),
  "viral_intelligence": {
    "viral_score": number,
    "hook_rating": "weak" | "medium" | "strong" | "excellent",
    "retention_notes": string[],
    "thumbnail_texts": string[],
    "opening_caption": string,
    "improvement_suggestions": string[]
  }
}`
}

// ─── Coercion helpers ────────────────────────────────────────────────────────
function asString(v: unknown, fallbackVal = ''): string {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallbackVal
}
function asNumber(v: unknown, fallbackVal: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return fallbackVal
}
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
}

// Trim a caption down to ~6-8 words. Models sometimes overshoot; clamp here
// so the UI never has to.
function clampCaption(raw: string, maxWords = 8): string {
  const words = raw.trim().replace(/[.!?]+$/g, '').split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return words.join(' ')
  return words.slice(0, maxWords).join(' ')
}

// Push #048 — coerce the viral_intelligence block from model output, falling
// back to the heuristic when any field is missing/invalid. The fallback is
// computed AGAINST the final hook (after the brief has been coerced) so the
// rating stays consistent with what the user sees in the card.
function coerceViralIntelligence(raw: unknown, fallbacks: ViralIntelligence): ViralIntelligence {
  if (!raw || typeof raw !== 'object') return fallbacks
  const r = raw as Record<string, unknown>
  const rawScore = asNumber(r.viral_score, fallbacks.viral_score)
  const viral_score = Math.max(0, Math.min(100, Math.round(rawScore)))
  const ratingRaw = asString(r.hook_rating, fallbacks.hook_rating).toLowerCase()
  const hook_rating: HookRating =
    ratingRaw === 'weak' || ratingRaw === 'medium' || ratingRaw === 'strong' || ratingRaw === 'excellent'
      ? (ratingRaw as HookRating)
      : viral_score >= 85
      ? 'excellent'
      : viral_score >= 70
      ? 'strong'
      : viral_score >= 50
      ? 'medium'
      : 'weak'
  const retention_notes = asStringArray(r.retention_notes).slice(0, 4)
  let thumbnail_texts = asStringArray(r.thumbnail_texts)
    .map((t) => t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim())
    .filter((t) => t.length > 0)
    .slice(0, 3)
  if (thumbnail_texts.length === 0) thumbnail_texts = fallbacks.thumbnail_texts
  const opening_caption = asString(r.opening_caption, fallbacks.opening_caption).slice(0, 60)
  const improvement_suggestions =
    viral_score >= 70 ? [] : asStringArray(r.improvement_suggestions).slice(0, 3)
  return {
    viral_score,
    hook_rating,
    retention_notes: retention_notes.length > 0 ? retention_notes : fallbacks.retention_notes,
    thumbnail_texts,
    opening_caption,
    improvement_suggestions,
  }
}

// Push #208 — accept up to 9 scenes for 90s videos (dynamic cap).
function coerceScenes(raw: unknown, fallbacks: SceneBrief[], maxScenes = 9): SceneBrief[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallbacks
  const out: SceneBrief[] = []
  raw.slice(0, maxScenes).forEach((entry, i) => {
    if (!entry || typeof entry !== 'object') return
    const e = entry as Record<string, unknown>
    const fb = fallbacks[i] ?? fallbacks[fallbacks.length - 1]
    // Per-scene visual_prompt is what /api/generate-video sends to Runway as
    // the per-clip prompt. Hard-clamp it to PROVIDER_PROMPT_MAX so a long
    // model response can never trigger "Prompt is too long" downstream.
    const rawVisual = asString(e.visual_prompt, fb.visual_prompt)
    const caption = clampCaption(asString(e.caption, fb.caption))
    // Push #064 — accept a per-scene "highlight" word. We don't validate
    // here that it actually appears in the caption; the renderer in
    // lib/compose.ts treats missing highlights as "fall back to the
    // heuristic picker" and is tolerant of mismatches.
    const highlight = asString(e.highlight, '') || null
    out.push({
      scene_number: asNumber(e.scene_number, i + 1),
      duration_seconds: asNumber(e.duration_seconds, fb.duration_seconds),
      caption,
      highlight,
      visual_prompt: clampToProviderLimit(rawVisual),
      voiceover: asString(e.voiceover, fb.voiceover),
    })
  })
  return out.length >= 3 ? out : fallbacks
}

// Push #307 — Parse structured viral script sections from a Viral Now prompt.
// Returns null when the prompt is not a pre-written viral script.
interface ViralSection {
  type: 'hook' | 'micro_reward' | 'escalation' | 'rhythm' | 'payoff'
  text: string
}

// Push #311 — strip [Pexels: xxx] markers from a voiceover body so TTS
// never reads them aloud while generate-video-fast still sees them in the
// raw prompt and enters verbatim mode.
function stripPexelsMarker(body: string): string {
  return body.replace(/^\s*\[\s*pexels\s*[:\-–]?\s*[^\]]+\]\s*/i, '').trim()
}

function parseViralScriptSections(text: string): ViralSection[] | null {
  // Push #312 — detect BOTH English and Portuguese marker variants so any
  // legacy prompt or Supabase row with Portuguese text (“MICRO RECOMPENSA”,
  // “ESCALADA”, “GANCHO”) is parsed correctly and headers are NEVER spoken.
  const hasHook = /\b(HOOK|GANCHO)\b/i.test(text)
  const hasMR = /\b(MICRO REWARD|MICRO RECOMPENSA)\b/i.test(text)
  const hasPayoff = /\b(PAYOFF|PAGAMENTO|RECOMPENSA FINAL)\b/i.test(text)
  if (!hasHook || (!hasMR && !hasPayoff)) return null

  const sections: ViralSection[] = []
  // Split on lines that begin a new section header (English or Portuguese)
  const parts = text.split(/\n(?=(?:HOOK|GANCHO|MICRO REWARD\s+\d|MICRO RECOMPENSA\s+\d|ESCALATION|ESCALADA|RHYTHM|RITMO|PAYOFF|PAGAMENTO)[\s:(])/i)

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    if (/^(HOOK|GANCHO)[\s:(]/i.test(trimmed)) {
      const raw = trimmed
        .replace(/^(HOOK|GANCHO)[^:\n]*:\s*/i, '')
        .replace(/^(HOOK|GANCHO)\s+/i, '')
        .trim()
        .replace(/^[“”]|[“”]$/g, '')
        .trim()
      const body = stripPexelsMarker(raw)
      if (body) sections.push({ type: 'hook', text: body })
    } else if (/^(MICRO REWARD|MICRO RECOMPENSA)\s+\d/i.test(trimmed)) {
      const raw = trimmed.replace(/^(MICRO REWARD|MICRO RECOMPENSA)\s+\d+[:\s]*/i, '').trim()
      const body = stripPexelsMarker(raw)
      if (body) sections.push({ type: 'micro_reward', text: body })
    } else if (/^(ESCALATION|ESCALADA)/i.test(trimmed)) {
      const raw = trimmed.replace(/^(ESCALATION|ESCALADA)[:\s]*/i, '').trim()
      const body = stripPexelsMarker(raw)
      if (body) sections.push({ type: 'escalation', text: body })
    } else if (/^(RHYTHM|RITMO)/i.test(trimmed)) {
      const raw = trimmed.replace(/^(RHYTHM|RITMO)[:\s]*/i, '').trim()
      const body = stripPexelsMarker(raw)
      if (body) sections.push({ type: 'rhythm', text: body })
    } else if (/^(PAYOFF|PAGAMENTO|RECOMPENSA FINAL)/i.test(trimmed)) {
      const raw = trimmed.replace(/^(PAYOFF|PAGAMENTO|RECOMPENSA FINAL)[:\s]*/i, '').trim()
      const body = stripPexelsMarker(raw)
      if (body) sections.push({ type: 'payoff', text: body })
    }
  }

  return sections.length >= 3 ? sections : null
}

// Push #411 — split a free-form user script into scene-sized voiceover
// chunks WITHOUT rewriting a single word. Sentences are grouped into
// `targetScenes` chunks with roughly balanced word counts. Used by the
// verbatim fast-path so "Use my script as is" survives the AI engines.
function splitVerbatimScript(text: string, targetScenes: number): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const sentences =
    clean.match(/[^.!?…]+[.!?…]+["'”]?|[^.!?…]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [clean]
  if (sentences.length <= targetScenes) return sentences
  const totalWords = clean.split(' ').length
  const perScene = Math.ceil(totalWords / targetScenes)
  const chunks: string[] = []
  let cur: string[] = []
  let curWords = 0
  for (const s of sentences) {
    const w = s.split(' ').length
    if (curWords > 0 && curWords + w > perScene && chunks.length < targetScenes - 1) {
      chunks.push(cur.join(' '))
      cur = []
      curWords = 0
    }
    cur.push(s)
    curWords += w
  }
  if (cur.length) chunks.push(cur.join(' '))
  return chunks
}

// Push #428 — VERBATIM + AI PACING POLISH ("junção verbatim+IA").
// The user's words are sacred, but flat punctuation makes the TTS voice read
// their script like a news anchor. This asks GPT to adjust ONLY punctuation
// (dramatic "..." pauses, em-dashes, sentence splits) and then ENFORCES the
// contract in code: if the polished text differs from the original by even
// one word, we throw it away and keep the user's original. Risk-free upgrade.
function normalizeWords(text: string): string {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).join(' ')
}

async function polishVerbatimPacing(text: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a voice director preparing a script for a premium AI text-to-speech narrator. Improve ONLY the punctuation and sentence rhythm of the user's script so it SOUNDS cinematic.

YOU MAY: insert or change punctuation marks (periods, commas, "..." pauses before reveals, em-dashes for beats), split long sentences into shorter ones, join fragments, adjust line breaks.
YOU MAY NOT: add, remove, replace, reorder or translate ANY word. Not one. Numbers, names and spelling stay byte-identical.

Return ONLY the adjusted script text. No commentary, no markdown.`,
          },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        max_tokens: 1200,
      },
      { timeout: 12000, maxRetries: 0 }
    )
    const polished = completion.choices[0]?.message?.content?.trim() ?? ''
    if (polished && normalizeWords(polished) === normalizeWords(text)) {
      console.log('[analyze-idea] verbatim pacing polish applied (words verified identical)')
      return polished
    }
    if (polished) {
      console.warn('[analyze-idea] pacing polish REJECTED — word sequence changed, keeping original')
    }
    return text
  } catch (e) {
    console.warn('[analyze-idea] pacing polish skipped:', e instanceof Error ? e.message : String(e))
    return text
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('[analyze-idea] OPENAI_API_KEY is not configured')
      return NextResponse.json({ error: 'AI service is not configured.' }, { status: 500 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: { prompt?: string; duration?: number; language?: string; scriptMode?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const prompt = (body.prompt ?? '').trim()
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 })
    }

    // Push #316 — language selection (en | pt | es), defaults to English.
    const language: AnalyzeLanguage =
      body.language === 'pt' ? 'pt' : body.language === 'es' ? 'es' : 'en'
    if (prompt.length > 5000) {
      return NextResponse.json({ error: 'Prompt is too long (5000 chars max).' }, { status: 400 })
    }

    // Push #064 — duration shapes word count + scene count. Defaults to 45s
    // when missing or invalid so existing clients keep working.
    // Push #208 — added 90s; removed 30s (replaced by 45s minimum).
    const requestedDuration = Number(body.duration) || 45
    const duration = [45, 60, 90].includes(requestedDuration) ? requestedDuration : 45

    // Push #307 — VIRAL SCRIPT FAST PATH ─────────────────────────────────────
    // When the prompt is a pre-written Viral Now script (HOOK/MICRO REWARD/
    // ESCALATION/PAYOFF sections), parse the voiceovers directly in code so
    // they survive into the video VERBATIM. GPT is only asked for the visual
    // layer (visual_prompt + caption). This is the only reliable way to
    // guarantee specific facts (e.g. "Sodder children, DB Cooper, Beaumont")
    // reach the final video instead of being replaced by generic mystery copy.
    const viralSections = parseViralScriptSections(prompt)
    if (viralSections) {
      const fallbackV = fallbackBrief(prompt)
      const DURATIONS: Record<string, number> = { hook: 4, micro_reward: 8, escalation: 6, rhythm: 4, payoff: 5 }
      const sceneList = viralSections.map((s, i) => ({
        scene_number: i + 1,
        typeLabel: s.type.replace('_', ' ').toUpperCase(),
        duration_seconds: DURATIONS[s.type] ?? 7,
        voiceover: s.text,
      }))

      const visualUserMsg = `You are a cinematic video director. The voiceover for each scene below is FIXED — do NOT change, summarize, or rewrite it. Generate ONLY the visual layer.

For each scene return a JSON object with exactly:
- scene_number (int)
- caption (max 6 words, punchy fragment, no period — summarize the voiceover in 6 words)
- highlight (the single most striking word in the caption)
- visual_prompt (150-350 chars, cinematic 9:16 vertical, describe camera angle + lighting + subject specific to the voiceover content. PERIOD ACCURACY: if the voiceover is set in a specific era, state the year/era and use ONLY period-accurate tech/clothing/weapons, appending "no modern objects, no modern vehicles, no tanks" inside the prompt. REAL PEOPLE: never make a recognizable face of a named real person the focal point — show them from behind, in silhouette, at distance, or via details like a hat or hands)
- duration_seconds (int)

Also return at the top level:
- viral_title (catchy ≤80 char title)
- youtube_title (≤100 chars with #shorts)
- youtube_description (2-4 sentences)
- hashtags (array of 8 strings with # prefix)
- music_mood (one phrase)
- niche (one word)
- tone (one phrase)

SCENES TO VISUALIZE:
${sceneList.map(s => `Scene ${s.scene_number} [${s.typeLabel}] (${s.duration_seconds}s):\n${s.voiceover}`).join('\n\n')}

Return valid JSON only: { "viral_title": "...", "youtube_title": "...", "youtube_description": "...", "hashtags": [...], "music_mood": "...", "niche": "...", "tone": "...", "scenes": [{...}] }`

      try {
        const completion = await openai.chat.completions.create(
          {
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a cinematic video director. Return valid JSON only — no markdown, no code blocks.' },
              { role: 'user', content: visualUserMsg },
            ],
            temperature: 0.5,
            max_tokens: 2000,
            response_format: { type: 'json_object' },
          },
          { timeout: 28000, maxRetries: 0 }
        )
        const raw = completion.choices[0]?.message?.content?.trim() ?? ''
        const data = JSON.parse(raw) as Record<string, unknown>
        const rawScenes = Array.isArray(data.scenes) ? (data.scenes as Record<string, unknown>[]) : []

        // Merge: GPT provides visuals, our parser provides voiceovers
        const scenes: SceneBrief[] = sceneList.map((s, i) => {
          const gpt = rawScenes[i] ?? {}
          return {
            scene_number: s.scene_number,
            duration_seconds: asNumber(gpt.duration_seconds, s.duration_seconds),
            caption: clampCaption(asString(gpt.caption, s.voiceover.split(' ').slice(0, 6).join(' '))),
            highlight: asString(gpt.highlight, '') || null,
            visual_prompt: clampToProviderLimit(asString(gpt.visual_prompt, fallbackV.scenes[i]?.visual_prompt ?? '')),
            voiceover: s.voiceover, // ← exact parsed text, NEVER replaced
          }
        })

        const hookText = scenes[0]?.voiceover ?? ''
        const viral_title = asString(data.viral_title, hookText.slice(0, 80))
        const niche = asString(data.niche, fallbackV.niche)
        const tone = asString(data.tone, fallbackV.tone)
        const voiceover_script = scenes.map(s => s.voiceover).join(' ')
        const youtube_title = asString(data.youtube_title, viral_title).slice(0, 120)
        const youtube_description = asString(data.youtube_description, fallbackV.youtube_description).slice(0, 600)
        let hashtags = asStringArray(data.hashtags).slice(0, 8)
        hashtags = hashtags.map(h => h.replace(/\s+/g, '')).map(h => h.startsWith('#') ? h : `#${h}`).filter(h => h.length > 1)
        if (hashtags.length === 0) hashtags = fallbackV.hashtags
        const music_mood = asString(data.music_mood, fallbackV.music_mood)
        const provider_prompt = clampToProviderLimit(scenes.map(s => s.visual_prompt).join(' '))
        const vi = fallbackViralIntelligence(hookText, niche)

        const viralBrief: CreativeBrief = {
          viral_title,
          hook: hookText,
          summary: voiceover_script.slice(0, 300),
          niche,
          tone,
          voiceover_script,
          scenes,
          music_mood,
          pacing_notes: 'fast cuts every 2–3s, hold on payoff for impact',
          youtube_title,
          youtube_description,
          hashtags,
          provider_prompt,
          detected_duration_seconds: duration,
          viral_intelligence: vi,
          title: viral_title,
          scenePlan: scenes.map(s => s.caption),
        }
        return NextResponse.json(viralBrief)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[analyze-idea] viral fast-path failed, falling through to normal path:', msg)
        // Fall through to normal GPT path below
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Push #411 — VERBATIM FAST PATH (free-form scripts) ─────────────────────
    // When the user chose "Use my script as is" (scriptMode='verbatim') and
    // the text has NO viral markers, keep their words EXACTLY: split scenes
    // in code and ask GPT only for the visual layer — same contract as the
    // viral fast-path above. On any failure, fall through to the normal path.
    if (!viralSections && body.scriptMode === 'verbatim') {
      const targetScenes = duration >= 90 ? 8 : duration >= 60 ? 6 : 5
      // Push #428 — junção verbatim+IA: punctuation-only cinematic pacing
      // polish, word-sequence verified in code (falls back to the original).
      const polishedPrompt = await polishVerbatimPacing(prompt)
      const chunks = splitVerbatimScript(polishedPrompt, targetScenes)
      if (chunks.length >= 2) {
        const fallbackV = fallbackBrief(prompt)
        const perSceneSec = Math.max(3, Math.round(duration / chunks.length))
        const sceneList = chunks.map((text, i) => ({
          scene_number: i + 1,
          typeLabel: 'SCENE',
          duration_seconds: perSceneSec,
          voiceover: text,
        }))

        const visualUserMsg = `You are a cinematic video director. The voiceover for each scene below is FIXED — do NOT change, summarize, or rewrite it. Generate ONLY the visual layer.

For each scene return a JSON object with exactly:
- scene_number (int)
- caption (max 6 words, punchy fragment, no period — summarize the voiceover in 6 words)
- highlight (the single most striking word in the caption)
- visual_prompt (150-350 chars, cinematic 9:16 vertical, describe camera angle + lighting + subject specific to the voiceover content. PERIOD ACCURACY: if the voiceover is set in a specific era, state the year/era and use ONLY period-accurate tech/clothing/weapons, appending "no modern objects, no modern vehicles, no tanks" inside the prompt. REAL PEOPLE: never make a recognizable face of a named real person the focal point — show them from behind, in silhouette, at distance, or via details like a hat or hands)
- duration_seconds (int)

Also return at the top level:
- viral_title (catchy ≤80 char title)
- youtube_title (≤100 chars with #shorts)
- youtube_description (2-4 sentences)
- hashtags (array of 8 strings with # prefix)
- music_mood (one phrase)
- niche (one word)
- tone (one phrase)

SCENES TO VISUALIZE:
${sceneList.map(s => `Scene ${s.scene_number} (${s.duration_seconds}s):\n${s.voiceover}`).join('\n\n')}

Return valid JSON only: { "viral_title": "...", "youtube_title": "...", "youtube_description": "...", "hashtags": [...], "music_mood": "...", "niche": "...", "tone": "...", "scenes": [{...}] }`

        try {
          const completion = await openai.chat.completions.create(
            {
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'You are a cinematic video director. Return valid JSON only — no markdown, no code blocks.' },
                { role: 'user', content: visualUserMsg },
              ],
              temperature: 0.5,
              max_tokens: 2000,
              response_format: { type: 'json_object' },
            },
            { timeout: 28000, maxRetries: 0 }
          )
          const raw = completion.choices[0]?.message?.content?.trim() ?? ''
          const data = JSON.parse(raw) as Record<string, unknown>
          const rawScenes = Array.isArray(data.scenes) ? (data.scenes as Record<string, unknown>[]) : []

          const scenes: SceneBrief[] = sceneList.map((s, i) => {
            const gpt = rawScenes[i] ?? {}
            return {
              scene_number: s.scene_number,
              duration_seconds: asNumber(gpt.duration_seconds, s.duration_seconds),
              caption: clampCaption(asString(gpt.caption, s.voiceover.split(' ').slice(0, 6).join(' '))),
              highlight: asString(gpt.highlight, '') || null,
              visual_prompt: clampToProviderLimit(asString(gpt.visual_prompt, fallbackV.scenes[i]?.visual_prompt ?? '')),
              voiceover: s.voiceover, // ← user's exact words, NEVER replaced
            }
          })

          const hookText = scenes[0]?.voiceover ?? ''
          const viral_title = asString(data.viral_title, hookText.slice(0, 80))
          const niche = asString(data.niche, fallbackV.niche)
          const tone = asString(data.tone, fallbackV.tone)
          const voiceover_script = scenes.map(s => s.voiceover).join(' ')
          const youtube_title = asString(data.youtube_title, viral_title).slice(0, 120)
          const youtube_description = asString(data.youtube_description, fallbackV.youtube_description).slice(0, 600)
          let hashtags = asStringArray(data.hashtags).slice(0, 8)
          hashtags = hashtags.map(h => h.replace(/\s+/g, '')).map(h => h.startsWith('#') ? h : `#${h}`).filter(h => h.length > 1)
          if (hashtags.length === 0) hashtags = fallbackV.hashtags
          const music_mood = asString(data.music_mood, fallbackV.music_mood)
          const provider_prompt = clampToProviderLimit(scenes.map(s => s.visual_prompt).join(' '))
          const vi = fallbackViralIntelligence(hookText, niche)

          const verbatimBrief: CreativeBrief = {
            viral_title,
            hook: hookText,
            summary: voiceover_script.slice(0, 300),
            niche,
            tone,
            voiceover_script,
            scenes,
            music_mood,
            pacing_notes: 'follow the user script rhythm; hold on the final line',
            youtube_title,
            youtube_description,
            hashtags,
            provider_prompt,
            detected_duration_seconds: duration,
            viral_intelligence: vi,
            title: viral_title,
            scenePlan: scenes.map(s => s.caption),
          }
          console.log(`[analyze-idea] verbatim fast-path: ${scenes.length} scenes, ${voiceover_script.split(' ').length} words kept verbatim`)
          return NextResponse.json(verbatimBrief)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error('[analyze-idea] verbatim fast-path failed, falling through to normal path:', msg)
          // Fall through to normal GPT path below
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const fallback = fallbackBrief(prompt)

    // Push #305 — detect pre-written viral scripts (from Viral Now cards).
    // When the prompt already has the 5-element viral formula embedded,
    // instruct GPT to use those exact voiceover lines VERBATIM instead of
    // rewriting them. This preserves the Hook/MR/Escalada/Payoff structure
    // and creates tight synergy between prompt content and the final video.
    const isViralScript =
      /HOOK\s*\(/i.test(prompt) ||
      (/\bHOOK\b/i.test(prompt) && /MICRO REWARD|PAYOFF/i.test(prompt))

    const viralScriptInstruction = isViralScript
      ? `\n\nCRITICAL — PRE-WRITTEN VIRAL SCRIPT: The prompt above is ALREADY a complete viral script with the 5-element structure (HOOK → MICRO REWARD × 3-5 → ESCALATION → PAYOFF). You MUST map sections to scenes EXACTLY as follows:
- HOOK section → Scene 1 voiceover (use verbatim, do NOT rewrite)
- Each MICRO REWARD → its own scene voiceover (verbatim, no paraphrase)
- ESCALATION section → second-to-last scene voiceover (verbatim)
- PAYOFF section → final scene voiceover (verbatim)
Your ONLY creative task is to write a punchy 6-8 word caption and a cinematic visual_prompt for each scene — the voiceover text comes directly from the script sections above, word for word. Do NOT invent new content or condense the voiceovers.`
      : ''

    const userMsg = `Create an addictive micro-knowledge YouTube Short about: ${prompt}.
Duration: ~${duration} seconds (target word count is in the system prompt).
Make every line teach something real and surprising.
Follow the Hook → Micro-Knowledge → Escalation → Payoff structure exactly.

TOPIC FIDELITY (critical): The ENTIRE brief must be specifically about "${prompt}". Every fact in the voiceover_script, every scene voiceover, every caption, and every visual_prompt must be directly about this exact topic — not about the broader genre, not a tangentially related subject, not generic filler. If the topic names a specific person, place, event, or thing, every beat must stay on that subject. Do not pad with vague mystery to reach the word count; reach it with more real facts about this topic.

Detected niche hint: ${fallback.niche}
Detected tone hint: ${fallback.tone}
${viralScriptInstruction}
Return ONLY the JSON object — no markdown, no commentary.`

    let brief: CreativeBrief = fallback
    try {
      // Push #260 — disable OpenAI SDK retries. The SDK retries 2× by default;
      // with a 28s timeout that means worst-case 28s × 3 = 84s total, which
      // blows past Vercel's 60s function limit and causes a 504. With
      // maxRetries:0, a slow OpenAI response throws after 28s and we fall
      // through to the fallbackBrief instead of timing out the whole function.
      const completion = await openai.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: buildSystemPrompt(duration, language) },
            { role: 'user', content: userMsg },
          ],
          temperature: 0.85,
          // Push #208 — 90s videos need more tokens for 9 scenes + longer script.
          max_tokens: duration >= 80 ? 3200 : 1800,
          response_format: { type: 'json_object' },
        },
        { timeout: 28000, maxRetries: 0 }
      )
      const raw = completion.choices[0]?.message?.content?.trim() ?? ''
      if (!raw) throw new Error('Empty response from OpenAI')
      const data = JSON.parse(raw) as Record<string, unknown>

      const plan = durationPlanFor(duration)
      const scenes = coerceScenes(data.scenes, fallback.scenes, plan.sceneCount)
      const viral_title = asString(data.viral_title, fallback.viral_title).slice(0, 120)
      const hook = asString(data.hook, fallback.hook)
      const summary = asString(data.summary, fallback.summary)
      const niche = asString(data.niche, fallback.niche).slice(0, 40)
      const tone = asString(data.tone, fallback.tone).slice(0, 80)
      const voiceover_script = asString(
        data.voiceover_script,
        scenes.map((s) => s.voiceover).filter(Boolean).join(' ') || fallback.voiceover_script,
      )
      const music_mood = asString(data.music_mood, fallback.music_mood).slice(0, 160)
      const pacing_notes = asString(data.pacing_notes, fallback.pacing_notes).slice(0, 240)
      const youtube_title = asString(data.youtube_title, fallback.youtube_title).slice(0, 120)
      const youtube_description = asString(data.youtube_description, fallback.youtube_description).slice(0, 600)
      let hashtags = asStringArray(data.hashtags).slice(0, 8)
      // Normalize hashtags: ensure leading '#', strip whitespace, drop empties.
      hashtags = hashtags
        .map((h) => h.replace(/\s+/g, ''))
        .map((h) => (h.startsWith('#') ? h : `#${h}`))
        .filter((h) => h.length > 1)
      if (hashtags.length === 0) hashtags = fallback.hashtags

      // Build the provider_prompt. Prefer the model's own value, fall back to
      // synthesising one from summary + visual prompts, then clamp hard to
      // PROVIDER_PROMPT_MAX. This is the string /api/generate-video will hand
      // to Runway, so the >500-char failure mode is closed here.
      const modelProvider = asString(data.provider_prompt, '')
      const synthesised =
        modelProvider ||
        [summary, scenes.map((s) => s.visual_prompt).join(' ')]
          .filter(Boolean)
          .join(' ') ||
        fallback.provider_prompt
      const provider_prompt_raw = synthesised
      const provider_prompt = clampToProviderLimit(provider_prompt_raw)
      if (provider_prompt_raw.length !== provider_prompt.length) {
        console.log(
          `[analyze-idea] provider_prompt clamped ${provider_prompt_raw.length} -> ${provider_prompt.length} chars`,
        )
      }

      // Push #048 — viral_intelligence: prefer model output, fall back to a
      // heuristic computed against the final coerced hook so the rating
      // stays consistent with what the user actually sees.
      const viral_intelligence = coerceViralIntelligence(
        data.viral_intelligence,
        fallbackViralIntelligence(hook, niche),
      )

      brief = {
        viral_title,
        hook,
        summary,
        niche,
        tone,
        voiceover_script,
        scenes,
        music_mood,
        pacing_notes,
        youtube_title,
        youtube_description,
        hashtags,
        provider_prompt,
        detected_duration_seconds: detectDurationFromPrompt(prompt),
        viral_intelligence,
        title: viral_title,
        scenePlan: scenes.map((s) => s.caption),
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[analyze-idea] OpenAI failed:', msg)
      brief = fallback
    }

    return NextResponse.json(brief)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[analyze-idea] unexpected error:', msg)
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
