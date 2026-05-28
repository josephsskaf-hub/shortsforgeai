/**
 * Dynamic AI Narration Engine — Phase 2: Section-Level Speed Modulation
 *
 * Splits a viral script (HOOK / MICRO REWARD / ESCALATION / PAYOFF) into
 * sections and assigns each section a speed multiplier derived from the
 * active persona's hookSpeedMultiplier / payoffSpeedMultiplier values.
 *
 * The result is a distinct narrative arc in the final audio:
 *   HOOK      → punchy & fast  (persona.hookSpeedMultiplier)
 *   BODY      → steady         (1.0 × persona.defaultSpeed)
 *   ESCALATION→ builds tension (midpoint between hook and body)
 *   PAYOFF    → slow & weighty (persona.payoffSpeedMultiplier)
 *
 * Each section is TTS'd separately; the caller concatenates the MP3
 * buffers (raw MPEG frames — safe to byte-concat without re-encoding).
 */

import { type VoicePersona } from './personas'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SectionType = 'hook' | 'body' | 'escalation' | 'payoff'

export interface ScriptSection {
  type: SectionType
  /** Clean narration text (markers and Pexels cues stripped) */
  text: string
  /**
   * Speed multiplier for this section relative to the persona's defaultSpeed.
   * Actual TTS speed = persona.defaultSpeed × speedMultiplier × corrective.
   */
  speedMultiplier: number
}

// ─── Section detection ────────────────────────────────────────────────────────

const HOOK_RE       = /^HOOK\b[:\s]*/im
const MR_RE         = /^MICRO REWARD\b[:\s]*/im
const ESCALATION_RE = /^ESCALATION\b[:\s]*/im
const PAYOFF_RE     = /^PAYOFF\b[:\s]*/im
const PEXELS_RE     = /^\[Pexels:[^\]]*\]/i

/** True when the script contains at least HOOK + PAYOFF markers */
export function hasViralSections(script: string): boolean {
  return HOOK_RE.test(script) && PAYOFF_RE.test(script)
}

/**
 * Split a raw viral script into sections with per-section speed multipliers.
 * Returns `null` when the script doesn't contain recognisable section markers
 * (caller falls back to single-pass TTS).
 *
 * @param rawScript  - The full script text, markers included
 * @param persona    - Active VoicePersona (provides hookSpeedMultiplier etc.)
 */
export function splitIntoSections(
  rawScript: string,
  persona: VoicePersona,
): ScriptSection[] | null {
  if (!hasViralSections(rawScript)) return null

  const lines = rawScript.split('\n')

  let currentType: SectionType = 'body'
  let currentLines: string[] = []
  const sections: ScriptSection[] = []

  const flush = (): void => {
    const text = currentLines
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .join(' ')
      .trim()
    if (text) {
      sections.push({
        type: currentType,
        text,
        speedMultiplier: resolveMultiplier(currentType, persona),
      })
    }
    currentLines = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    // Section header detection — order matters (ESCALATION before MICRO REWARD)
    if (HOOK_RE.test(line)) {
      flush()
      currentType = 'hook'
      const rest = line.replace(/^HOOK[:\s]*/i, '').trim()
      if (rest && !PEXELS_RE.test(rest)) currentLines.push(rest)
      continue
    }
    if (ESCALATION_RE.test(line)) {
      flush()
      currentType = 'escalation'
      const rest = line.replace(/^ESCALATION[:\s]*/i, '').trim()
      if (rest && !PEXELS_RE.test(rest)) currentLines.push(rest)
      continue
    }
    if (MR_RE.test(line)) {
      flush()
      currentType = 'body'
      const rest = line.replace(/^MICRO REWARD\s*\d*[:\s]*/i, '').trim()
      if (rest && !PEXELS_RE.test(rest)) currentLines.push(rest)
      continue
    }
    if (PAYOFF_RE.test(line)) {
      flush()
      currentType = 'payoff'
      const rest = line.replace(/^PAYOFF[:\s]*/i, '').trim()
      if (rest && !PEXELS_RE.test(rest)) currentLines.push(rest)
      continue
    }

    // Skip Pexels cues and section-level directives
    if (PEXELS_RE.test(line)) continue
    if (/^\[/.test(line) && /\]/.test(line)) continue

    currentLines.push(line)
  }

  flush()

  // Filter out sections with no usable text
  return sections.filter((s) => s.text.length > 3)
}

// ─── Speed multiplier resolution ─────────────────────────────────────────────

function resolveMultiplier(type: SectionType, persona: VoicePersona): number {
  switch (type) {
    case 'hook':
      return persona.hookSpeedMultiplier
    case 'payoff':
      return persona.payoffSpeedMultiplier
    case 'escalation':
      // Escalation sits between body pace and hook energy.
      // Midpoint between 1.0 and hookSpeedMultiplier.
      return (1.0 + persona.hookSpeedMultiplier) / 2
    case 'body':
    default:
      return 1.0
  }
}
