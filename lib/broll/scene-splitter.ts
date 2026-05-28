import type { ScenePurpose } from './types'

export interface SceneSegment {
  narration: string
  purpose: ScenePurpose
  estimatedDuration: number
}

// TTS-1-HD speaks at ~3.1 words/second (calibrated in lib/openai.ts)
const WORDS_PER_SECOND = 3.1
const MIN_SCENE_DURATION = 1.5
const MAX_SCENE_DURATION = 3.0

function wordsToDuration(wordCount: number): number {
  const raw = wordCount / WORDS_PER_SECOND
  return Math.min(MAX_SCENE_DURATION, Math.max(MIN_SCENE_DURATION, raw))
}

function purposeFromMarker(marker: string): ScenePurpose {
  const m = marker.toUpperCase()
  if (/\bHOOK\b/.test(m)) return 'hook'
  if (/MICRO REWARD|MICRO RECOMPENSA/.test(m)) return 'explanation'
  if (/ESCALATION|ESCALADA/.test(m)) return 'escalation'
  if (/PAYOFF|PAGAMENTO|RECOMPENSA FINAL/.test(m)) return 'payoff'
  return 'explanation'
}

/**
 * Attempts to split script by HOOK/MICRO REWARD/ESCALATION/PAYOFF markers.
 * Falls back to sentence-based splitting when markers are absent.
 */
export function splitScriptToScenes(script: string): SceneSegment[] {
  const text = (script ?? '').trim()
  if (!text) return []

  // Detect structured markers (English and Portuguese variants)
  const hasHook = /\b(HOOK|GANCHO)\b/i.test(text)
  const hasMR = /\b(MICRO REWARD|MICRO RECOMPENSA)\b/i.test(text)
  const hasPayoff = /\b(PAYOFF|PAGAMENTO|RECOMPENSA FINAL)\b/i.test(text)

  if (hasHook && (hasMR || hasPayoff)) {
    return splitByMarkers(text)
  }

  return splitBySentences(text)
}

function splitByMarkers(text: string): SceneSegment[] {
  // Split at lines that begin a section header
  const parts = text.split(
    /\n(?=(?:HOOK|GANCHO|MICRO REWARD\s+\d+|MICRO RECOMPENSA\s+\d+|ESCALATION|ESCALADA|PAYOFF|PAGAMENTO|RECOMPENSA FINAL)[\s:(])/i,
  )

  const segments: SceneSegment[] = []

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    // Extract marker and body
    const markerMatch = trimmed.match(
      /^(HOOK|GANCHO|MICRO REWARD\s+\d+|MICRO RECOMPENSA\s+\d+|ESCALATION|ESCALADA|PAYOFF|PAGAMENTO|RECOMPENSA FINAL)[^:\n]*:?\s*/i,
    )
    if (!markerMatch) continue

    const marker = markerMatch[0]
    const purpose = purposeFromMarker(trimmed)
    // Strip pexels markers and leading quotes
    const body = trimmed
      .slice(marker.length)
      .replace(/^\s*\[\s*pexels[^\]]*\]\s*/i, '')
      .replace(/^[""]|[""]$/g, '')
      .trim()

    if (!body) continue

    const wordCount = body.split(/\s+/).filter(Boolean).length
    segments.push({
      narration: body,
      purpose,
      estimatedDuration: wordsToDuration(wordCount),
    })
  }

  return segments.length >= 2 ? segments : splitBySentences(text)
}

function splitBySentences(text: string): SceneSegment[] {
  // Split on sentence-ending punctuation followed by whitespace
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  if (sentences.length === 0) return []

  // Assign purposes based on position
  const segments: SceneSegment[] = sentences.map((narration, i) => {
    const wordCount = narration.split(/\s+/).filter(Boolean).length
    let purpose: ScenePurpose

    if (i === 0) {
      purpose = 'hook'
    } else if (i === sentences.length - 1) {
      purpose = 'payoff'
    } else {
      const progress = i / (sentences.length - 1)
      if (progress < 0.4) {
        purpose = 'explanation'
      } else if (progress < 0.75) {
        purpose = 'escalation'
      } else {
        purpose = 'escalation'
      }
    }

    return {
      narration,
      purpose,
      estimatedDuration: wordsToDuration(wordCount),
    }
  })

  return segments
}
