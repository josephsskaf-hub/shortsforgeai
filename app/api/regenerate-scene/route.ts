import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import type { BrollScene, GlobalVisualStyle, ShotType, VisualMood } from '@/lib/broll/types'
import { buildScenePrompt } from '@/lib/broll/prompt-builder'

export const maxDuration = 30

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface RegenerateSceneInput {
  sceneNumber: number
  narration: string
  niche: string
  currentPrompt: string
  globalStyle: GlobalVisualStyle
  instruction?: string
}

const VALID_MOODS: VisualMood[] = [
  'dark', 'energetic', 'luxurious', 'mysterious', 'futuristic', 'emotional', 'tense', 'epic',
]
const VALID_SHOT_TYPES: ShotType[] = [
  'close_up', 'drone', 'tracking', 'handheld', 'pov', 'wide', 'macro', 'cinematic_zoom',
]

function coerceMood(v: unknown, fallback: VisualMood): VisualMood {
  return typeof v === 'string' && VALID_MOODS.includes(v as VisualMood)
    ? (v as VisualMood)
    : fallback
}

function coerceShotType(v: unknown, fallback: ShotType): ShotType {
  return typeof v === 'string' && VALID_SHOT_TYPES.includes(v as ShotType)
    ? (v as ShotType)
    : fallback
}

function asStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('[regenerate-scene] OPENAI_API_KEY is not configured')
      return NextResponse.json({ error: 'AI service is not configured.' }, { status: 500 })
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: Partial<RegenerateSceneInput>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const narration = (body.narration ?? '').trim()
    if (!narration) {
      return NextResponse.json({ error: 'narration is required.' }, { status: 400 })
    }

    const sceneNumber = typeof body.sceneNumber === 'number' ? body.sceneNumber : 1
    const niche = (body.niche ?? 'general').trim()
    const currentPrompt = (body.currentPrompt ?? '').trim()
    const instruction = (body.instruction ?? '').trim()
    const globalStyle = body.globalStyle

    if (!globalStyle) {
      return NextResponse.json({ error: 'globalStyle is required.' }, { status: 400 })
    }

    const systemPrompt = `You are an expert visual director for YouTube Shorts. Regenerate a B-roll description for one scene.

CRITICAL RULES:
1. NEVER use generic visuals: "city skyline", "people walking", "AI robot", "money falling"
2. ALWAYS use concrete, specific visuals tied to the exact narration meaning
3. The new visual must directly reinforce what is being said

Return JSON only. No explanation.`

    const userMsg = `Scene ${sceneNumber} narration: "${narration}"

Current B-roll prompt: "${currentPrompt}"

${instruction ? `Director instruction: "${instruction}"` : 'Regenerate with a more specific, concrete visual that better matches the narration.'}

Global style context:
- Mood: ${globalStyle.mood}
- Lighting: ${globalStyle.lighting}
- Camera style: ${globalStyle.cameraStyle}
- Niche: ${niche}

Return JSON with:
- brollPrompt (150-350 chars, specific and concrete, no generic footage)
- pexelsQuery (2-3 concrete nouns, lowercase, for stock footage search)
- visualMood (one of: dark, energetic, luxurious, mysterious, futuristic, emotional, tense, epic)
- shotType (one of: close_up, drone, tracking, handheld, pov, wide, macro, cinematic_zoom)
- visualIntent (1 sentence: what is on screen and why it serves the narration)`

    let result: Partial<BrollScene> = {}

    try {
      const completion = await openai.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg },
          ],
          temperature: 0.7,
          max_tokens: 500,
          response_format: { type: 'json_object' },
        },
        { timeout: 20000, maxRetries: 0 },
      )

      const raw = completion.choices[0]?.message?.content?.trim() ?? ''
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>
        const visualMood = coerceMood(parsed.visualMood, globalStyle.mood)
        const shotType = coerceShotType(parsed.shotType, 'tracking')

        const gptBrollPrompt = asStr(parsed.brollPrompt, '')
        const gptPexelsQuery = asStr(parsed.pexelsQuery, '')

        // Fall back to our prompt builder if GPT returns empty
        const builtFallback = buildScenePrompt(narration, niche, globalStyle, shotType, visualMood)

        result = {
          brollPrompt: gptBrollPrompt.length > 20 ? gptBrollPrompt : builtFallback.brollPrompt,
          pexelsQuery: gptPexelsQuery.length > 2 ? gptPexelsQuery : builtFallback.pexelsQuery,
          negativePrompt: builtFallback.negativePrompt,
          visualMood,
          shotType,
          visualIntent: asStr(parsed.visualIntent, `Regenerated visual for scene ${sceneNumber}`),
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[regenerate-scene] GPT call failed:', msg)

      // Fallback: use our deterministic prompt builder
      const fallbackShot: ShotType = 'tracking'
      const builtFallback = buildScenePrompt(narration, niche, globalStyle, fallbackShot, globalStyle.mood)
      result = {
        brollPrompt: builtFallback.brollPrompt,
        pexelsQuery: builtFallback.pexelsQuery,
        negativePrompt: builtFallback.negativePrompt,
        visualMood: globalStyle.mood,
        shotType: fallbackShot,
        visualIntent: `Fallback visual for: ${narration.slice(0, 60)}`,
      }
    }

    return NextResponse.json({ sceneNumber, ...result })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[regenerate-scene] unexpected error:', msg)
    return NextResponse.json({ error: 'Scene regeneration failed. Please try again.' }, { status: 500 })
  }
}
