import type { BrollScene, VisualSource } from './types'

// Keywords in brollPrompt that signal AI generation is preferred because
// stock footage libraries rarely have these subjects.
const AI_PREFERRED_KEYWORDS = [
  'underground',
  'hidden',
  'secret',
  'ancient',
  'futuristic',
  'fantasy',
  'mystery',
  'ghost',
  'alien',
  'magic',
  'impossible',
]

/**
 * Decide whether a scene should use AI video generation or Pexels stock footage.
 *
 * Rules (evaluated in order, first match wins):
 * 1. Hook scene with relevanceScore < 75 → AI (stock footage won't be specific enough)
 * 2. Any AI_PREFERRED_KEYWORD found in brollPrompt or keywords → AI
 * 3. visualMood is 'mysterious' or 'futuristic' → AI preferred
 * 4. Otherwise → Pexels
 */
export function shouldUseAI(scene: BrollScene): boolean {
  // Rule 1: low-relevance hook
  if (
    scene.scenePurpose === 'hook' &&
    (scene.relevanceScore ?? 100) < 75
  ) {
    return true
  }

  // Rule 2: AI-preferred keyword present in brollPrompt or keywords array
  const searchText = [
    scene.brollPrompt.toLowerCase(),
    ...(scene.keywords ?? []).map((k) => k.toLowerCase()),
  ].join(' ')

  for (const kw of AI_PREFERRED_KEYWORDS) {
    if (searchText.includes(kw)) return true
  }

  // Rule 3: mood signals content that stock footage can't capture well
  if (scene.visualMood === 'mysterious' || scene.visualMood === 'futuristic') {
    return true
  }

  return false
}

/**
 * Assign the `source` field to every scene in the array.
 * Returns a new array (does not mutate input).
 */
export function assignSources(scenes: BrollScene[]): BrollScene[] {
  return scenes.map((scene) => ({
    ...scene,
    source: (shouldUseAI(scene) ? 'ai' : 'pexels') as VisualSource,
  }))
}
