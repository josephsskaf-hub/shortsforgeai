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
// Aesthetic packs (13/06) — per-niche approved visual universe + banned
// clichés, injected into the GPT prompt AND enforced on its output.
import { packForNiche, enforcePackOnQueries, UNIVERSAL_BANNED } from './aesthetic-packs'

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
7. GROUNDING (Push #486): build every pexelsQuery and brollPrompt ONLY from entities, places and objects that appear in THAT scene's narration (plus generic production cues like "aerial"/"macro"). NEVER substitute a different named location, landmark, animal or person than the narration mentions — if the narration is about Lake Karachay, "lake natron flamingos" is WRONG even though both are lakes.

HARD NEGATIVE RULES — never select footage that contradicts the narration:
- Ancient Rome / history: NO modern skyscrapers, NO contemporary offices
- Finance / Wall Street: NO beaches, forests, or random lifestyle shots
- AI / technology: NO generic nature unless script explicitly mentions nature
- War / history: NO modern unrelated soldiers unless period matches
- Luxury / money: NO random shopping mall footage unless context fits
- Mystery / dark topics: NO bright cheerful footage, NO beaches

VISUAL THEME CONSISTENCY — each video should have a coherent visual language:
- Ancient history: ruins, maps, statues, manuscripts, cinematic reenactment
- Money/finance: trading floors, charts, banks, offices, luxury but relevant
- AI/future: servers, neural networks, robots, interfaces, labs, data centers
- Mystery: dark rooms, archives, documents, shadows, cinematic close-ups
- Geography/countries: drone landscapes, local streets, landmarks, culture

## HARD NEGATIVE BLACKLIST — NEVER generate these Pexels queries

The following categories are PERMANENTLY BLACKLISTED as B-roll:
- people walking / people walking street
- lifestyle portrait / portrait woman / portrait man
- teenager portrait / young person / teen lifestyle
- fashion / fashion model / street fashion
- generic smiling people / happy people
- urban lifestyle / city lifestyle
- influencer footage / content creator
- street portrait / candid portrait

You MAY use people-related queries ONLY if the voiceover line explicitly mentions one of these keywords: "person", "influencer", "teenager", "fashion", "lifestyle", "human subject", "model", "woman", "man", "people".

For mystery, history, crime, finance, technology, geography content, ALWAYS prefer:
- documents, old documents, historical documents
- maps, world map, aerial map
- archives, library archives, old photographs
- city aerials, aerial cityscape, drone city
- ships, cruise ship, ocean vessel
- ocean, open ocean, dark sea
- investigation, crime scene, police tape
- office, corporate office, business meeting
- trading floor, stock market, financial charts
- servers, data center, technology infrastructure
- cinematic details (hands, objects, close-ups)
- landscapes, mountains, forests, rivers

If you cannot find a relevant clip: set pexelsQueries to [] and set requiresExtension: true — the pipeline will extend the previous clip instead.

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

  // Aesthetic pack (13/06) — tell the model what this niche's audience
  // expects to SEE, not just what the narration MEANS. Kills the
  // semantically-right-aesthetically-wrong picks (coins for "billionaire").
  // Hotfix (12/06): analyze-idea returns a ONE-WORD niche ("success",
  // "business", "habits") that often misses the trigger list and landed on
  // DEFAULT (no bans → coin closeups and random rivers slipped into a
  // billionaire video). If the niche word alone doesn't resolve to a real
  // pack, re-match against the actual script text — "billionaire" in the
  // narration is enough to lock the wealth pack.
  let pack = packForNiche(niche)
  if (pack.id === 'default') pack = packForNiche(`${niche} ${script}`)

  const userMsg = `Niche: ${niche}
Tone: ${tone}
Global Mood: ${globalStyle.mood}
Camera Style: ${globalStyle.cameraStyle}
Lighting: ${globalStyle.lighting}

VISUAL WORLD (aesthetic pack for this niche) — compose EVERY pexelsQuery inside this visual universe. Approved imagery building blocks: ${pack.vocab.join('; ')}.
HARD NEGATIVE BLACKLIST — NEVER use these visuals (audience-tested rejects): ${[...pack.banned, ...UNIVERSAL_BANNED].join('; ')}.
GROUNDING RULE — each scene's pexelsQueries/brollPrompt must stay anchored to the entities named in THAT scene's narration. NEVER introduce a different named place, landmark or subject than the narration itself mentions.

Generate the visual layer for these ${scenesWithMeta.length} scenes. For each scene return:
- sceneNumber (int)
- visualIntent (1 sentence describing exactly what is on screen and why it serves the narration)
- visualMood (one of: dark, energetic, luxurious, mysterious, futuristic, emotional, tense, epic)
- shotType (one of: close_up, drone, tracking, handheld, pov, wide, macro, cinematic_zoom — vary across scenes)
- caption (max 6 words, punchy fragment)
- keywords (array of 3-5 concrete visual nouns, no adjectives)
- brollPrompt (150-350 chars: specific, concrete visual description — NO generic visuals)
- pexelsQueries (array of 3-5 search queries for stock footage; each query is 2-4 concrete nouns, lowercase; ORDER from most specific to least specific so a fallback can broaden the search if the first query has no footage; set to [] and set requiresExtension: true if no safe query exists per the HARD NEGATIVE BLACKLIST)
- relevanceScore (int 0-100: how well this visual reinforces the exact narration meaning)
- requiresExtension (boolean, default false: set to true ONLY when pexelsQueries is empty because the blacklist prevents any safe query)

SCENES:
${sceneDescriptions}

Return a JSON object with a "scenes" array. No markdown, no code fences.`

  let gptScenes: Record<string, unknown>[] = []
  // #358 — instrumentation only. Track degradation + timing/finish_reason/usage
  // so the next runs reveal WHY the GPT call fails (timeout vs parse vs rate
  // limit vs token-truncation) instead of us guessing. Behavior is unchanged:
  // on any failure we still fall through to the built (template) prompts.
  let gptDegraded = false
  const gptStartTime = Date.now()
  let completion: OpenAI.Chat.Completions.ChatCompletion | undefined

  try {
    completion = await openai.chat.completions.create(
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
      { timeout: 45000, maxRetries: 1 }, // #359 Camera A — calls take 15-26s; 30s timed out intermittently
    )

    const raw = completion.choices[0]?.message?.content?.trim() ?? ''
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (Array.isArray(parsed.scenes)) {
        gptScenes = parsed.scenes as Record<string, unknown>[]
      } else {
        gptDegraded = true
        console.error('[broll-engine] GPT returned no scenes[] array', {
          finish_reason: completion.choices[0]?.finish_reason,
          tokens_used: completion.usage,
          elapsed_ms: Date.now() - gptStartTime,
        })
      }
    } else {
      gptDegraded = true
      console.error('[broll-engine] GPT returned empty content', {
        finish_reason: completion.choices[0]?.finish_reason,
        elapsed_ms: Date.now() - gptStartTime,
      })
    }
  } catch (err) {
    gptDegraded = true
    const e = (err ?? {}) as { name?: string; message?: string; code?: string; status?: number }
    // #358 — structured error log: name/code/status/finish_reason/usage/timing.
    console.error('[broll-engine] GPT failed', {
      error_name: e.name,
      error_message: e.message,
      error_code: e.code,
      error_status: e.status,
      finish_reason: completion?.choices?.[0]?.finish_reason,
      tokens_used: completion?.usage,
      elapsed_ms: Date.now() - gptStartTime,
      scene_count_expected: scenesWithMeta.length,
      prompt_tokens_estimate: Math.round((VISUAL_DIRECTOR_SYSTEM_PROMPT.length + userMsg.length) / 4),
    })
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

    // pexelsQueries: prefer the GPT array (3-5, most-specific-first), falling back
    // to the legacy single pexelsQuery, then the built prompt's query. The first
    // entry is mirrored into pexelsQuery for backward compatibility with callers
    // that still read a single string.
    const gptQueries = asStrArr(gpt.pexelsQueries).filter((q) => q.length > 2)
    const rawGptQuery = asStr(gpt.pexelsQuery, '')
    const legacyQuery = rawGptQuery.length > 2 ? rawGptQuery : builtPrompt.pexelsQuery
    // Aesthetic pack enforcement (13/06) — hard guarantee on top of the
    // prompt steering: banned visuals are dropped; an emptied scene gets a
    // rotated vocab term instead of a doomed/cliché search.
    const pexelsQueries = enforcePackOnQueries(
      gptQueries.length > 0 ? gptQueries : [legacyQuery],
      pack,
      i,
    )
    const pexelsQuery = pexelsQueries[0]

    const caption = asStr(
      gpt.caption,
      s.narration.split(/\s+/).slice(0, 5).join(' '),
    )

    const keywords = asStrArr(gpt.keywords).length > 0
      ? asStrArr(gpt.keywords)
      : pexelsQuery.split(/\s+/).filter(Boolean)

    // requiresExtension: true when the AI found no safe query (e.g. lifestyle
    // blacklist prevents any reasonable search term). Pipeline will extend the
    // previous relevant clip instead of firing a doomed Pexels search.
    const requiresExtension =
      gpt.requiresExtension === true ||
      (pexelsQueries.length === 0 && asStr(gpt.brollPrompt, '').length === 0)

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
      pexelsQueries,
      requiresExtension,
    }
  })

  return {
    globalStyle,
    scenes,
    niche,
    tone,
    totalDuration: duration,
    degraded: gptDegraded, // #358 — surface GPT failure to callers
  }
}
