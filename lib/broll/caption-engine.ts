import type { BrollScene, ScenePurpose } from './types'

export type CaptionAnimation = 'pop' | 'zoom' | 'slide_up' | 'pulse' | 'shake' | 'fade'

export interface CaptionWord {
  text: string
  startTime: number  // seconds from scene start
  duration: number   // seconds this word is displayed
  animation: CaptionAnimation
  emphasis: boolean  // larger/bolder treatment
}

export interface DynamicCaption {
  sceneNumber: number
  fullText: string
  words: CaptionWord[]
  style: 'hook_style' | 'info_style' | 'payoff_style'
}

// Words that typically carry sentence weight — numbers, proper nouns, strong verbs, etc.
// Used to detect "key nouns" for emphasis in info/payoff captions.
const KEY_WORD_PATTERNS = [
  /^\d+([.,]\d+)?[%$kmb]*$/i, // numbers, percentages, dollar amounts
  /^[A-Z][a-z]+$/,            // Proper noun (TitleCase word)
  /^[A-Z]{2,}$/,              // ALL CAPS abbreviation (NYSE, FBI, etc.)
]

function isKeyWord(word: string): boolean {
  const cleaned = word.replace(/[^a-zA-Z0-9%$.,]/g, '')
  return KEY_WORD_PATTERNS.some((p) => p.test(cleaned))
}

/**
 * Estimate reading duration for a word in seconds.
 * Short words get ~0.15s, longer words up to ~0.45s.
 */
function wordDuration(word: string): number {
  const len = word.replace(/[^a-z]/gi, '').length
  if (len <= 3) return 0.15
  if (len <= 6) return 0.22
  if (len <= 10) return 0.32
  return 0.45
}

/**
 * Generate a DynamicCaption for a single BrollScene.
 *
 * Caption style is chosen by scenePurpose:
 * - hook        → hook_style: short (≤5 words), all caps, 'pop'/'zoom', every word emphasized
 * - payoff      → payoff_style: 3-7 words, mixed case, 'pulse' on key nouns
 * - explanation / escalation / transition → info_style: normal case, 'slide_up', numbers & proper nouns emphasized
 */
export function generateDynamicCaption(scene: BrollScene): DynamicCaption {
  const purpose: ScenePurpose = scene.scenePurpose

  // Choose style and source text
  const isHook = purpose === 'hook'
  const isPayoff = purpose === 'payoff'
  const style: DynamicCaption['style'] = isHook
    ? 'hook_style'
    : isPayoff
    ? 'payoff_style'
    : 'info_style'

  // Build the caption text
  let captionText = scene.caption.trim()
  if (!captionText) {
    // Fallback: first few words of narration
    captionText = scene.narration.split(/\s+/).slice(0, 5).join(' ')
  }

  // Hook: force all caps, limit to 5 words
  if (isHook) {
    captionText = captionText.split(/\s+/).slice(0, 5).join(' ').toUpperCase()
  }

  // Payoff: limit to 7 words
  if (isPayoff) {
    captionText = captionText.split(/\s+/).slice(0, 7).join(' ')
  }

  const wordList = captionText.split(/\s+/).filter(Boolean)

  // Build per-word metadata
  let currentTime = 0
  const words: CaptionWord[] = wordList.map((word, i) => {
    const dur = wordDuration(word)
    const startTime = currentTime
    currentTime += dur + 0.04 // small gap between words

    let animation: CaptionAnimation
    let emphasis: boolean

    if (isHook) {
      // Alternate pop and zoom for visual variety
      animation = i % 2 === 0 ? 'pop' : 'zoom'
      emphasis = true // every word is emphasized in hook
    } else if (isPayoff) {
      // Pulse on key nouns, fade on the rest
      const key = isKeyWord(word)
      animation = key ? 'pulse' : 'fade'
      emphasis = key
    } else {
      // info_style: slide_up baseline, shake on numbers
      const num = /^\d/.test(word)
      const key = isKeyWord(word)
      animation = num ? 'shake' : 'slide_up'
      emphasis = key || num
    }

    return { text: word, startTime, duration: dur, animation, emphasis }
  })

  return {
    sceneNumber: scene.sceneNumber,
    fullText: captionText,
    words,
    style,
  }
}

/**
 * Generate DynamicCaption for every scene in a plan.
 * Synchronous — no API calls needed.
 */
export function generateAllCaptions(scenes: BrollScene[]): DynamicCaption[] {
  return scenes.map(generateDynamicCaption)
}
