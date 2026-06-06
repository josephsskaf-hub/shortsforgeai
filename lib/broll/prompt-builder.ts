import type { GlobalVisualStyle, ShotType, VisualMood } from './types'

const NEGATIVE_PROMPT_BASE =
  'anime, cartoon, watermark, text overlay, random generic footage, blurry, low quality, abstract'

const SHOT_TYPE_SUFFIXES: Record<ShotType, string> = {
  close_up: 'extreme close-up, macro lens, sharp focus',
  drone: 'aerial drone shot, bird\'s eye view',
  tracking: 'tracking shot, following motion, cinematic movement',
  handheld: 'handheld camera, documentary feel, slight shake',
  pov: 'point of view shot, first person perspective',
  wide: 'wide angle shot, establishing shot',
  macro: 'macro photography, extreme detail',
  cinematic_zoom: 'cinematic zoom, slow push in',
}

interface NicheVisualRule {
  patterns: RegExp
  visualStyle: string
}

const NICHE_VISUAL_RULES: NicheVisualRule[] = [
  {
    patterns: /curiosity|facts|knowledge|trivia|did you know/i,
    visualStyle:
      'maps, archives, documents, close-ups, real locations, museum artifacts, mystery visuals',
  },
  {
    patterns: /finance|money|wealth|invest|bank|stock|trading|economy/i,
    visualStyle:
      'trading screens, luxury environments, banking visuals, realistic money contexts, Wall Street',
  },
  {
    patterns: /technology|ai|robot|tech|future|automation|software|cyber/i,
    visualStyle:
      'futuristic interfaces, data centers, microchips, real software interfaces, server rooms',
  },
  {
    patterns: /history|mystery|ancient|ruins|war|empire|civilization|artifact/i,
    visualStyle:
      'ruins, ancient maps, dark corridors, artifacts, cinematic historical recreations, parchment',
  },
  {
    patterns: /country|place|geography|travel|landscape|city|mountain|world/i,
    visualStyle:
      'drone shots, sweeping landscapes, street level life, locals, landmarks, golden hour light',
  },
  {
    patterns: /billionaire|luxury|rich|celebrity|wealth|gold/i,
    visualStyle:
      'luxury interiors, private jets, supercars, yachts, penthouse views, high-end fashion',
  },
]

function getNicheVisualStyle(niche: string, narration: string): string {
  const searchText = `${niche} ${narration.slice(0, 200)}`
  for (const rule of NICHE_VISUAL_RULES) {
    if (rule.patterns.test(searchText)) return rule.visualStyle
  }
  return 'cinematic real-world footage, high production quality, compelling subjects'
}

/**
 * Extracts 2-3 concrete nouns from narration for a Pexels search query.
 * Strips adjectives and verbs, returns lowercase noun phrases.
 */
function extractPexelsQuery(narration: string): string {
  // Remove common stop words and function words
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'was', 'were', 'are', 'be', 'been',
    'this', 'that', 'these', 'those', 'it', 'he', 'she', 'they', 'we',
    'you', 'i', 'his', 'her', 'their', 'its', 'our', 'has', 'have', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'about', 'into', 'over', 'under', 'after', 'before', 'during', 'when',
    'where', 'how', 'why', 'what', 'who', 'which', 'than', 'then', 'so',
    'just', 'only', 'also', 'even', 'more', 'most', 'every', 'each', 'some',
    'any', 'all', 'no', 'not', 'can', 'as', 'if', 'up',
    // Abstract words to avoid
    'secret', 'truth', 'thing', 'way', 'fact', 'story', 'moment', 'time',
    'people', 'person', 'one', 'two', 'three', 'world', 'life', 'year',
    'day', 'part', 'place', 'point', 'number', 'back', 'first', 'last',
  ])

  const words = narration
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stopWords.has(w))

  // Return up to 3 concrete words joined as a query.
  // Push #436 — append a single production cue ("cinematic") to bias the
  // fallback Pexels search toward higher-production clips. Pexels has deep
  // "cinematic"-tagged inventory, and the multi-candidate scorer + semantic
  // fallback chain recover gracefully if a specific query returns fewer hits.
  const queryWords = words.slice(0, 3)
  const base =
    queryWords.length > 0
      ? queryWords.join(' ')
      : narration.split(/\s+/).slice(0, 3).join(' ').toLowerCase()
  return base ? `${base} cinematic` : base
}

function getMoodSuffix(mood: VisualMood, lighting: GlobalVisualStyle['lighting']): string {
  const moodMap: Partial<Record<VisualMood, string>> = {
    dark: 'dark moody atmosphere, deep shadows, high contrast',
    luxurious: 'luxury aesthetic, rich textures, high production value',
    mysterious: 'mysterious atmosphere, suspenseful lighting, cinematic tension',
    epic: 'epic scale, sweeping composition, awe-inspiring',
    tense: 'tense atmosphere, urgent pacing, dramatic lighting',
    energetic: 'dynamic energy, vibrant motion, engaging visuals',
    futuristic: 'futuristic aesthetic, clean lines, technological feel',
    emotional: 'emotional resonance, warm tones, intimate framing',
  }

  const lightingMap: Partial<Record<GlobalVisualStyle['lighting'], string>> = {
    cinematic_dark: 'cinematic_dark low-key lighting, chiaroscuro',
    golden_hour: 'golden hour warm light, sun-kissed tones',
    neon: 'neon lighting, urban night, vivid color palette',
    studio: 'clean studio lighting, controlled exposure',
    natural: 'natural ambient light, realistic exposure',
  }

  const moodStr = moodMap[mood] ?? ''
  const lightStr = lightingMap[lighting] ?? ''
  return [moodStr, lightStr].filter(Boolean).join(', ')
}

export interface BuiltPrompt {
  brollPrompt: string
  negativePrompt: string
  pexelsQuery: string
}

/**
 * Builds brollPrompt, negativePrompt, and pexelsQuery for a single scene.
 */
export function buildScenePrompt(
  narration: string,
  niche: string,
  globalStyle: GlobalVisualStyle,
  shotType: ShotType,
  visualMood: VisualMood,
): BuiltPrompt {
  const nicheStyle = getNicheVisualStyle(niche, narration)
  const shotSuffix = SHOT_TYPE_SUFFIXES[shotType]
  const moodSuffix = getMoodSuffix(visualMood, globalStyle.lighting)
  const pexelsQuery = extractPexelsQuery(narration)

  // Build the main broll prompt
  const promptParts = [
    // Core subject derived from narration
    narration.slice(0, 120).trim(),
    // Shot type
    shotSuffix,
    // Niche-specific visual vocabulary
    nicheStyle,
    // Mood and lighting
    moodSuffix,
    // Safe composition rules for vertical 9:16
    'vertical 9:16 frame, subject in upper 65-75% of frame, centered composition',
    // Quality markers
    'cinematic quality, high detail, real footage',
  ]

  const brollPrompt = promptParts.filter(Boolean).join(', ')

  return {
    brollPrompt,
    negativePrompt: NEGATIVE_PROMPT_BASE,
    pexelsQuery,
  }
}
