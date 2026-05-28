import OpenAI from 'openai'
import type {
  BrollEngineInput,
  BrollPlan,
  BrollScene,
  GlobalVisualStyle,
  ScenePurpose,
  ShotType,
  VisualMood,
  VisualSource,
} from './types'
import { deriveGlobalStyle } from './visual-consistency'
import { splitScriptToScenes } from './scene-splitter'
import { buildAttentionCurve } from './attention-curve'
import { buildScenePrompt } from './prompt-builder'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const VISUAL_DIRECTOR_SYSTEM_PROMPT = `You are an expert visual director for YouTube Shorts with deep knowledge of viral video retention.
Your job: given a narration segment, generate a highly specific, concrete B-roll description.

CRITICAL RULES:
1. NEVER use generic visuals: "city skyline", "people walking", "AI robot", "money falling", "business meeting", "generic office", "abstract technology"
2. ALWAYS use concrete, specific visuals: "underground NYC train platform 1903", "Dubai gold ATM machine", "ancient parchment manuscript", "Wall Street trading floor 1987 crash", "Waldorf Astoria hotel lobby secret basement"
3. Shot type creates rhythm — vary it scene by scene
4. Hook scenes: shocking, fast, high contrast
5. Payoff scenes: confirming, resolving, satisfying
6. Every visual MUST directly reinforce the exact meaning of the narration

Return JSON only. No explanation.`

const VALID_MOODS: VisualMood[] = [
  'dark', 'energetic', 'luxurious', 'mysterious', 'futuristic', 'emotional', 'tense', 'epic',
]
const VALID_SHOT_TYPES: ShotType[] = [
  'close_up', 'drone', 'tracking', 'handheld', 'pov', 'wide', 'macro', 'cinematic_zoom',
]
const VALID_PURPOSES: ScenePurpose[] = [
  'hook', 'explanation', 'escalation', 'transition', 'payoff',
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

function coercePurpose(v: unknown, fallback: ScenePurpose): ScenePurpose {
  return typeof v === 'string' && VALID_PURPOSES.includes(v as ScenePurpose)
    ? (v as ScenePurpose)
    : fallback
}

function asStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallback
}

function asStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
}

function asNum(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

// Shot type rotation — cycles through types for visual variety
const SHOT_ROTATION: ShotType[] = [
  'close_up', 'drone', 'tracking', 'wide', 'handheld', 'cinematic_zoom', 'macro', 'pov',
]

function pickShotType(index: number): ShotType {
  return SHOT_ROTATION[index % SHOT_ROTATION.length]
}

/**
 * Main B-roll engine. Generates a complete BrollPlan using GPT-4o-mini.
 * Uses a single GPT call for all scenes to minimize latency and cost.
 */
export async function brollEngine(input: BrollEngineInput): Promise<BrollPlan> {
  const { script, niche, tone, duration, globalStyle: overrides } = input

  // Step 1: Derive global style
  const baseStyle = deriveGlobalStyle(niche, tone, script)
  const globalStyle: GlobalVisualStyle = {
    ...baseStyle,
    ...(overrides ?? {}),
  } as GlobalVisualStyle

  // Step 2: Split script into scenes
  const rawSegments = splitScriptToScenes(script)
  if (rawSegments.length === 0) {
    throw new Error('broll-engine: script produced no scenes after splitting')
  }

  // Step 3: Build attention curve
  const curve = buildAttentionCurve(duration, rawSegments.length)

  // Step 4: Build scene list with attention curve metadata
  const scenesWithMeta = rawSegments.map((seg, i) => {
    const beat = curve[i] ?? { purpose: seg.purpose, intensity: 0.7, durationSeconds: seg.estimatedDuration }
    const shotType = pickShotType(i)
    const built = buildScenePrompt(seg.narration, niche, globalStyle, shotType, globalStyle.mood)

    return {
      sceneNumber: i + 1,
      scenePurpose: beat.purpose,
      narration: seg.narration,
      durationSeconds: beat.durationSeconds,
      shotType,
      builtPrompt: built,
      intensity: beat.intensity,
    }
  })

  // Step 5: Single GPT call to generate visual layer for all scenes
  const sceneDescriptions = scenesWithMeta
    .map(
      (s) =>
        `Scene ${s.sceneNumber} [${s.scenePurpose.toUpperCase()}] (${s.durationSeconds}s, shot: ${s.shotType}, intensity: ${s.intensity.toFixed(1)}):\nNarration: "${s.narration}"`,
    )
    .join('\n\n')

  const userMsg = `Niche: ${niche}
Tone: ${tone}
Global Mood: ${globalStyle.mood}
Camera Style: ${globalStyle.cameraStyle}
Lighting: ${globalStyle.lighting}

Generate the visual layer for these ${scenesWithMeta.length} scenes. For each scene return:
- sceneNumber (int)
- visualIntent (1 sentence describing exactly what is on screen and why it serves the narration)
- visualMood (one of: dark, energetic, luxurious, mysterious, futuristic, emotional, tense, epic)
- shotType (one of: close_up, drone, tracking, handheld, pov, wide, macro, cinematic_zoom — vary across scenes)
- caption (max 6 words, punchy fragment)
- keywords (array of 3-5 concrete visual nouns, no adjectives)
- brollPrompt (150-350 chars: specific, concrete visual description — NO generic visuals)
- pexelsQuery (2-3 concrete nouns only, lowercase, perfect for stock footage search)
- relevanceScore (int 0-100: how well this visual reinforces the exact narration meaning)

SCENES:
${sceneDescriptions}

Return a JSON object with a "scenes" array. No markdown, no code fences.`

  let gptScenes: Record<string, unknown>[] = []

  try {
    const completion = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: VISUAL_DIRECTOR_SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.6,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      },
      { timeout: 30000, maxRetries: 0 },
    )

    const raw = completion.choices[0]?.message?.content?.trim() ?? ''
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (Array.isArray(parsed.scenes)) {
        gptScenes = parsed.scenes as Record<string, unknown>[]
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[broll-engine] GPT call failed:', msg)
    // Fall through — we'll use built prompts as fallback below
  }

  // Step 6: Merge GPT output with our computed data
  const scenes: BrollScene[] = scenesWithMeta.map((s, i) => {
    const gpt = gptScenes[i] ?? {}
    const builtPrompt = s.builtPrompt

    const visualMood = coerceMood(gpt.visualMood, globalStyle.mood)
    const shotType = coerceShotType(gpt.shotType, s.shotType)
    const scenePurpose = coercePurpose(gpt.scenePurpose, s.scenePurpose)

    // Use GPT brollPrompt if present and specific, else fallback to our built one
    const rawGptPrompt = asStr(gpt.brollPrompt, '')
    const brollPrompt = rawGptPrompt.length > 20 ? rawGptPrompt : builtPrompt.brollPrompt

    const rawGptQuery = asStr(gpt.pexelsQuery, '')
    const pexelsQuery = rawGptQuery.length > 2 ? rawGptQuery : builtPrompt.pexelsQuery

    const caption = asStr(
      gpt.caption,
      s.narration.split(/\s+/).slice(0, 5).join(' '),
    )

    const keywords = asStrArr(gpt.keywords).length > 0
      ? asStrArr(gpt.keywords)
      : pexelsQuery.split(/\s+/).filter(Boolean)

    return {
      sceneNumber: s.sceneNumber,
      scenePurpose,
      narration: s.narration,
      caption,
      durationSeconds: s.durationSeconds,
      visualIntent: asStr(gpt.visualIntent, `Visual reinforcement for: ${s.narration.slice(0, 60)}`),
      visualMood,
      shotType,
      source: 'pexels' as VisualSource,
      keywords,
      brollPrompt,
      negativePrompt: builtPrompt.negativePrompt,
      relevanceScore: asNum(gpt.relevanceScore, 70),
      pexelsQuery,
    }
  })

  return {
    globalStyle,
    scenes,
    niche,
    tone,
    totalDuration: duration,
  }
}
