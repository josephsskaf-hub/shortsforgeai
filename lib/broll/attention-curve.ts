import type { ScenePurpose } from './types'

export interface AttentionBeat {
  purpose: ScenePurpose
  intensity: number
  durationSeconds: number
}

/**
 * Builds an attention curve for a video given total duration and scene count.
 *
 * Distribution:
 *  - Scene 1              → hook,        intensity 1.0
 *  - Last scene           → payoff,      intensity 0.9
 *  - ~10% of middle       → transition,  intensity 0.5
 *  - ~30% after hook      → explanation, intensity 0.6–0.7
 *  - Remaining middle     → escalation,  intensity 0.7–0.9 (increasing)
 *
 * Durations are proportional to intensity so hook/payoff scenes are snappier.
 */
export function buildAttentionCurve(
  totalDuration: number,
  sceneCount: number,
): AttentionBeat[] {
  if (sceneCount <= 0) return []
  if (sceneCount === 1) {
    return [{ purpose: 'hook', intensity: 1.0, durationSeconds: totalDuration }]
  }
  if (sceneCount === 2) {
    const hookDur = Math.round(totalDuration * 0.45)
    return [
      { purpose: 'hook', intensity: 1.0, durationSeconds: hookDur },
      { purpose: 'payoff', intensity: 0.9, durationSeconds: totalDuration - hookDur },
    ]
  }

  const middleCount = sceneCount - 2 // exclude first (hook) and last (payoff)
  const transitionCount = Math.max(0, Math.round(middleCount * 0.1))
  const explanationCount = Math.max(1, Math.round(middleCount * 0.3))
  const escalationCount = Math.max(
    0,
    middleCount - transitionCount - explanationCount,
  )

  const beats: AttentionBeat[] = []

  // Scene 1: hook
  beats.push({ purpose: 'hook', intensity: 1.0, durationSeconds: 0 })

  // Explanation scenes
  for (let i = 0; i < explanationCount; i++) {
    const intensity = 0.6 + (i / Math.max(1, explanationCount - 1)) * 0.1
    beats.push({ purpose: 'explanation', intensity, durationSeconds: 0 })
  }

  // Escalation scenes (intensity rises from 0.7 → 0.9)
  for (let i = 0; i < escalationCount; i++) {
    const progress = escalationCount > 1 ? i / (escalationCount - 1) : 1
    const intensity = 0.7 + progress * 0.2
    beats.push({ purpose: 'escalation', intensity, durationSeconds: 0 })
  }

  // Transition scenes (low intensity, sprinkled at end of middle)
  for (let i = 0; i < transitionCount; i++) {
    beats.push({ purpose: 'transition', intensity: 0.5, durationSeconds: 0 })
  }

  // Last scene: payoff
  beats.push({ purpose: 'payoff', intensity: 0.9, durationSeconds: 0 })

  // Distribute duration proportionally to intensity
  const totalIntensity = beats.reduce((sum, b) => sum + b.intensity, 0)
  const allocated = beats.map((b) => ({
    ...b,
    durationSeconds: Math.max(
      1,
      Math.round((b.intensity / totalIntensity) * totalDuration),
    ),
  }))

  // Correct rounding drift — adjust last scene to absorb any difference
  const allocatedTotal = allocated.reduce((s, b) => s + b.durationSeconds, 0)
  const drift = totalDuration - allocatedTotal
  if (allocated.length > 0) {
    allocated[allocated.length - 1].durationSeconds = Math.max(
      1,
      allocated[allocated.length - 1].durationSeconds + drift,
    )
  }

  return allocated
}
