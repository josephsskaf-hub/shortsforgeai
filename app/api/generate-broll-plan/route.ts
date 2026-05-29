import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { brollEngine } from '@/lib/broll/broll-engine'
import { scoreAllScenes } from '@/lib/broll/relevance-score'
import { assignSources } from '@/lib/broll/hybrid-source'
import type { BrollEngineInput, BrollScene, GlobalVisualStyle } from '@/lib/broll/types'

export const maxDuration = 90 // #359 Camera A — headroom for the slower GPT call + scoring + regen

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const VISUAL_DIRECTOR_SYSTEM_PROMPT = `You are an expert visual director for YouTube Shorts with deep knowledge of viral video retention.
Your job: given a narration segment, generate a highly specific, concrete B-roll description.

CRITICAL RULES:
1. NEVER use generic visuals: "city skyline", "people walking", "AI robot", "money falling", "business meeting", "generic office", "abstract technology"
2. ALWAYS use concrete, specific visuals: "underground NYC train platform 1903", "Dubai gold ATM machine", "ancient parchment manuscript", "Wall Street trading floor 1987 crash"
3. Be more specific and concrete, avoid generic visuals
4. Every visual MUST directly reinforce the exact meaning of the narration

Return JSON only. No explanation.`

/**
 * Attempt to regenerate a single low-relevance scene using GPT.
 * Returns the updated scene if successful, otherwise the original.
 */
async function regenerateLowRelevanceScene(
  scene: BrollScene,
  niche: string,
  globalStyle: GlobalVisualStyle,
  attempt: number,
): Promise<BrollScene> {
  const userMsg = `Scene ${scene.sceneNumber} narration: "${scene.narration}"

Current B-roll prompt (relevance score: ${scene.relevanceScore ?? '?'}/100 — too generic):
"${scene.brollPrompt}"

Instruction: be more specific and concrete, avoid generic visuals. Use real locations, named objects, or specific events tied directly to what is being said.

Niche: ${niche}
Mood: ${globalStyle.mood}
Lighting: ${globalStyle.lighting}

Return JSON with:
- brollPrompt (150-350 chars, highly specific and concrete)
- pexelsQuery (2-3 concrete nouns, lowercase)
- visualIntent (1 sentence: what is on screen and why)`

  try {
    const completion = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: VISUAL_DIRECTOR_SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.7 + attempt * 0.05, // slightly increase temperature each retry
        max_tokens: 400,
        response_format: { type: 'json_object' },
      },
      { timeout: 20000, maxRetries: 0 },
    )

    const raw = completion.choices[0]?.message?.content?.trim() ?? ''
    if (!raw) return scene

    const parsed = JSON.parse(raw) as Record<string, unknown>
    const newBrollPrompt =
      typeof parsed.brollPrompt === 'string' && parsed.brollPrompt.trim().length > 20
        ? parsed.brollPrompt.trim()
        : scene.brollPrompt
    const newPexelsQuery =
      typeof parsed.pexelsQuery === 'string' && parsed.pexelsQuery.trim().length > 2
        ? parsed.pexelsQuery.trim()
        : scene.pexelsQuery
    const newVisualIntent =
      typeof parsed.visualIntent === 'string' && parsed.visualIntent.trim().length > 5
        ? parsed.visualIntent.trim()
        : scene.visualIntent

    // #349 — keep pexelsQueries in sync. The regenerated (more specific) query
    // must lead the multi-query list, otherwise generate-video-fast (which now
    // prefers pexelsQueries over the single pexelsQuery) would still search the
    // old low-relevance terms. Put the new query first, keep the prior ones as
    // broader fallbacks, deduped.
    const priorQueries = scene.pexelsQueries ?? [scene.pexelsQuery]
    const newPexelsQueries = [
      newPexelsQuery,
      ...priorQueries.filter((q) => q && q.toLowerCase() !== newPexelsQuery.toLowerCase()),
    ]

    return {
      ...scene,
      brollPrompt: newBrollPrompt,
      pexelsQuery: newPexelsQuery,
      pexelsQueries: newPexelsQueries,
      visualIntent: newVisualIntent,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[generate-broll-plan] auto-regenerate scene ${scene.sceneNumber} attempt ${attempt + 1} failed:`, msg)
    return scene
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('[generate-broll-plan] OPENAI_API_KEY is not configured')
      return NextResponse.json({ error: 'AI service is not configured.' }, { status: 500 })
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: Partial<BrollEngineInput>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const script = (body.script ?? '').trim()
    if (!script) {
      return NextResponse.json({ error: 'script is required.' }, { status: 400 })
    }

    const niche = (body.niche ?? 'general').trim()
    const tone = (body.tone ?? 'cinematic').trim()
    const duration = typeof body.duration === 'number' && body.duration > 0 ? body.duration : 45
    const language = (body.language ?? 'en').trim()

    const input: BrollEngineInput = {
      script,
      niche,
      tone,
      duration,
      language,
      globalStyle: body.globalStyle,
    }

    // Step 1: Generate the initial plan
    const plan = await brollEngine(input)

    // Step 2: Score all scenes with embeddings-based relevance
    plan.scenes = await scoreAllScenes(plan.scenes)

    // Step 3: Auto-regenerate any scene with relevanceScore < 70 (max 2 retries each)
    const MAX_RETRIES = 2
    const REGEN_THRESHOLD = 70

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const lowSceneIndexes = plan.scenes
        .map((s, i) => ({ scene: s, i }))
        .filter(({ scene }) => (scene.relevanceScore ?? 100) < REGEN_THRESHOLD)

      if (lowSceneIndexes.length === 0) break

      // Regenerate all low-score scenes in parallel
      const regenerated = await Promise.all(
        lowSceneIndexes.map(({ scene }) =>
          regenerateLowRelevanceScene(scene, niche, plan.globalStyle, attempt),
        ),
      )

      // Re-score the regenerated scenes
      const rescored = await Promise.all(
        regenerated.map((scene, idx) => {
          const original = lowSceneIndexes[idx].scene
          // Only re-score if the prompt actually changed
          if (scene.brollPrompt === original.brollPrompt) {
            return Promise.resolve(scene)
          }
          return scoreAllScenes([scene]).then((arr) => arr[0])
        }),
      )

      // Splice back into plan.scenes
      for (let j = 0; j < lowSceneIndexes.length; j++) {
        plan.scenes[lowSceneIndexes[j].i] = rescored[j]
      }
    }

    // Step 4: Assign source (pexels vs ai) per scene
    plan.scenes = assignSources(plan.scenes)

    return NextResponse.json(plan)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[generate-broll-plan] unexpected error:', msg)
    return NextResponse.json({ error: 'B-roll plan generation failed. Please try again.' }, { status: 500 })
  }
}
