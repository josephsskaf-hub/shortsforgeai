import type { BrollScene } from './types'

export type SceneHistory = Map<number, BrollScene[]>

const MAX_HISTORY_PER_SCENE = 3

/**
 * Adds the given scene to its history bucket (keyed by sceneNumber).
 * Keeps at most MAX_HISTORY_PER_SCENE versions per scene (oldest dropped first).
 * Returns a new Map so callers can treat history as immutable.
 */
export function addToHistory(history: SceneHistory, scene: BrollScene): SceneHistory {
  const next = new Map(history)
  const bucket = next.get(scene.sceneNumber) ?? []
  // Push to front (most recent first), cap at max
  const updated = [scene, ...bucket].slice(0, MAX_HISTORY_PER_SCENE)
  next.set(scene.sceneNumber, updated)
  return next
}

/**
 * Pops the most recent entry from the history bucket for sceneNumber.
 * Returns the popped scene (or null if history is empty) and the updated history.
 */
export function undoScene(
  history: SceneHistory,
  sceneNumber: number,
): { scene: BrollScene | null; newHistory: SceneHistory } {
  const bucket = history.get(sceneNumber) ?? []
  if (bucket.length === 0) return { scene: null, newHistory: new Map(history) }
  const [scene, ...rest] = bucket
  const newHistory = new Map(history)
  if (rest.length > 0) {
    newHistory.set(sceneNumber, rest)
  } else {
    newHistory.delete(sceneNumber)
  }
  return { scene, newHistory }
}

/**
 * Initialises an empty history Map with entries for each scene in the array.
 * Each bucket starts as an empty array — no prior versions yet.
 */
export function initHistory(scenes: BrollScene[]): SceneHistory {
  const history: SceneHistory = new Map()
  for (const scene of scenes) {
    history.set(scene.sceneNumber, [])
  }
  return history
}
