import OpenAI from 'openai'
import type { BrollScene } from './types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Generic terms that indicate a low-quality, non-specific broll prompt.
// Each match deducts 10 points from the raw cosine similarity score.
const GENERIC_TERMS = [
  'city skyline',
  'people walking',
  'ai robot',
  'money falling',
  'generic',
  'random',
  'business meeting',
  'abstract',
]

/**
 * Compute cosine similarity between two embedding vectors.
 * Returns a value in [-1, 1]. Two identical vectors → 1.0.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let magA = 0
  let magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  if (denom === 0) return 0
  return dot / denom
}

/**
 * Get embeddings for a piece of text using text-embedding-3-small.
 * Throws if the API call fails — callers should catch and handle.
 */
async function embed(text: string): Promise<number[]> {
  const res = await openai.embeddings.create(
    {
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000), // API limit safety
    },
    { timeout: 15000, maxRetries: 0 },
  )
  return res.data[0]?.embedding ?? []
}

/**
 * Score how semantically relevant a brollPrompt is to the narration.
 *
 * Algorithm:
 * 1. Get embeddings for narration and brollPrompt via text-embedding-3-small
 * 2. Compute cosine similarity → raw score in [-1, 1]
 * 3. Normalize to [0, 100]
 * 4. Subtract 10 for each generic term found in the brollPrompt
 * 5. Clamp to [0, 100]
 *
 * Returns 75 (neutral) on any API failure so generation is never blocked.
 */
export async function scoreRelevance(
  narration: string,
  brollPrompt: string,
): Promise<number> {
  try {
    const [narrationEmbed, promptEmbed] = await Promise.all([
      embed(narration),
      embed(brollPrompt),
    ])

    if (narrationEmbed.length === 0 || promptEmbed.length === 0) return 75

    const similarity = cosineSimilarity(narrationEmbed, promptEmbed)

    // Normalize from [-1, 1] to [0, 100]
    let score = ((similarity + 1) / 2) * 100

    // Apply penalty for generic terms (case-insensitive)
    const lowerPrompt = brollPrompt.toLowerCase()
    for (const term of GENERIC_TERMS) {
      if (lowerPrompt.includes(term)) {
        score -= 10
      }
    }

    return Math.max(0, Math.min(100, Math.round(score)))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[relevance-score] embeddings API failed:', msg)
    return 75 // neutral fallback — do not block generation
  }
}

/**
 * Score all scenes in parallel and return them with relevanceScore populated.
 * Runs all embed calls concurrently via Promise.all for efficiency.
 */
export async function scoreAllScenes(scenes: BrollScene[]): Promise<BrollScene[]> {
  const scores = await Promise.all(
    scenes.map((scene) => scoreRelevance(scene.narration, scene.brollPrompt)),
  )
  return scenes.map((scene, i) => ({ ...scene, relevanceScore: scores[i] }))
}
