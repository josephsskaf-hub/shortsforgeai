import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

export const maxDuration = 30

// ─── Schema ───────────────────────────────────────────────────────────────────
// Push #024A: richer creative brief. The legacy fields (title, summary, niche,
// scenePlan) are kept so existing clients keep working; new fields are added
// for clients that opt into the upgraded display.

interface SceneBrief {
  scene_number: number
  duration_seconds: number
  caption: string
  visual_prompt: string
  voiceover: string
}

interface CreativeBrief {
  // New rich fields
  viral_title: string
  hook: string
  summary: string
  niche: string
  tone: string
  voiceover_script: string
  scenes: SceneBrief[]
  music_mood: string
  pacing_notes: string
  youtube_title: string
  youtube_description: string
  hashtags: string[]
  // Push #024B: short cinematic prompt safe to send straight to Runway.
  // Max 500 chars (hard clamp), visual-only — no voiceover, hashtags, or
  // YouTube metadata. The client may pass this to /api/generate-video so the
  // server can skip a fresh OpenAI scene call for the overall video.
  provider_prompt: string

  // Legacy compatibility — populated from the new fields so older callers
  // (e.g. GenerateClient before the matching client update) don't break.
  title: string
  scenePlan: string[]
}

// Runway's text_to_video endpoint rejects prompts >500 chars. We clamp every
// model-facing string to this cap before either storing it or sending it on.
const PROVIDER_PROMPT_MAX = 500

// Hard-clamp a string to `max` characters at a sentence/comma boundary when
// possible, falling back to a plain slice. Strips leading/trailing whitespace.
export function clampToProviderLimit(raw: string, max = PROVIDER_PROMPT_MAX): string {
  const trimmed = raw.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= max) return trimmed
  const window = trimmed.slice(0, max)
  // Prefer to cut at the last sentence boundary or comma so we don't end mid-word.
  const lastSentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '))
  if (lastSentence > max * 0.6) return window.slice(0, lastSentence + 1).trim()
  const lastComma = window.lastIndexOf(', ')
  if (lastComma > max * 0.6) return window.slice(0, lastComma).trim()
  const lastSpace = window.lastIndexOf(' ')
  if (lastSpace > max * 0.6) return window.slice(0, lastSpace).trim()
  return window.trim()
}

function inferNiche(prompt: string): string {
  const p = prompt.toLowerCase()
  if (/(money|finance|wealth|invest|billionaire|cash)/.test(p)) return 'Finance'
  if (/(history|ancient|war|empire|forgotten)/.test(p)) return 'History'
  if (/(mystery|unexplained|signal|ufo|cover-?up|paranormal)/.test(p)) return 'Mystery'
  if (/(space|nasa|black hole|galaxy|alien|cosmos)/.test(p)) return 'Space'
  if (/(ai|robot|tech|future|automation)/.test(p)) return 'Tech'
  if (/(crime|killer|murder|case)/.test(p)) return 'True Crime'
  if (/(fact|did you know|stat|number)/.test(p)) return 'Facts'
  return 'General'
}

function inferTone(niche: string): string {
  switch (niche) {
    case 'Mystery':
    case 'Space':
    case 'True Crime': return 'Suspenseful'
    case 'History':
    case 'Facts': return 'Dramatic'
    case 'Finance': return 'Urgent and relatable'
    case 'Tech': return 'Fast-paced'
    default: return 'Cinematic'
  }
}

function fallbackBrief(prompt: string): CreativeBrief {
  const trimmed = prompt.trim().slice(0, 80)
  const niche = inferNiche(prompt)
  const tone = inferTone(niche)
  const scenes: SceneBrief[] = [
    {
      scene_number: 1,
      duration_seconds: 6,
      caption: 'Wait — you have to see this',
      visual_prompt: 'extreme close-up macro shot, low-key lighting, deep shadows, ' +
        'a single point of light pulsing in the dark, cinematic 9:16 framing, 35mm film grain',
      voiceover: 'You have probably never heard about this — and that is the whole point.',
    },
    {
      scene_number: 2,
      duration_seconds: 8,
      caption: 'It started with one clue',
      visual_prompt: 'overhead drone shot pulling back slowly, cold blue-grey color palette, ' +
        'rain-soaked surface, single subject centered, volumetric mist',
      voiceover: 'It started with a single clue most people walked right past.',
    },
    {
      scene_number: 3,
      duration_seconds: 8,
      caption: 'Then they saw the pattern',
      visual_prompt: 'tracking shot through a corridor of glowing screens, magenta and teal neon, ' +
        'shallow depth of field, anamorphic flares, subject silhouetted',
      voiceover: 'Once they zoomed in, the pattern was impossible to ignore.',
    },
    {
      scene_number: 4,
      duration_seconds: 8,
      caption: 'And the truth was wilder',
      visual_prompt: 'slow push-in on a vintage monitor displaying classified text, ' +
        'green phosphor glow, dust in the air, cinematic chiaroscuro lighting',
      voiceover: 'And the truth, when it finally came out, was wilder than anyone guessed.',
    },
    {
      scene_number: 5,
      duration_seconds: 5,
      caption: 'Follow for part two',
      visual_prompt: 'silhouette of a figure walking toward a single distant light, ' +
        'twilight sky, ultra-wide vertical composition, faint lens flare',
      voiceover: 'Follow for the part nobody is allowed to talk about.',
    },
  ]
  const providerPrompt = clampToProviderLimit(
    `Cinematic vertical 9:16 video, ${tone.toLowerCase()} tone, ${niche.toLowerCase()} aesthetic. ` +
    `Dark moody lighting, deep shadows, dramatic camera moves, rich color grading, ` +
    `high contrast, atmospheric haze, single subject framing, suspenseful build, ` +
    `ultra-detailed textures, 35mm film grain, hyperreal.`,
  )
  return {
    viral_title: trimmed || 'The Truth Nobody Told You',
    hook: 'You have never heard about this — and that is exactly the point.',
    summary: 'A fast-paced cinematic Short built around a single shocking idea, with strong visuals and a cliffhanger ending.',
    niche,
    tone,
    voiceover_script: scenes.map((s) => s.voiceover).join(' '),
    scenes,
    music_mood: 'dark cinematic pulse with rising tension',
    pacing_notes: 'fast cuts every 2–3 seconds, hold on the final scene for impact',
    youtube_title: trimmed || 'The Story Nobody Wanted You To Hear #shorts',
    youtube_description: 'A cinematic Short about the part of the story most people never get told. Watch to the end for the twist.',
    hashtags: ['#shorts', '#viral', '#mystery', '#fyp', '#storytime'],
    provider_prompt: providerPrompt,
    title: trimmed || 'The Truth Nobody Told You',
    scenePlan: scenes.map((s) => s.visual_prompt),
  }
}

const SYSTEM_PROMPT = `You are an expert YouTube Shorts creative director specializing in viral faceless videos. Your job is to produce a complete creative brief for a 30-35 second Short that will go viral.

The brief MUST include: a viral_title, a powerful hook for the first 2 seconds, a scene-by-scene breakdown with cinematic visual prompts (never generic), captions of MAX 6-8 words, full voiceover_script, music_mood, pacing_notes, youtube_title, youtube_description, and hashtags.

QUALITY RULES (non-negotiable):
- The hook lands in the first 2 seconds and is impossible to scroll past. No "in this video..." or "today we will...". Start mid-scene, mid-question, or mid-revelation.
- Captions: maximum 6-8 words. Punchy fragments, not full sentences. No periods.
- Visual prompts must be EXTREMELY cinematic and specific. Describe camera angle, lighting, color palette, subject, atmosphere, lens feel. BAD: "ocean waves" or "historical ruins". GOOD: "extreme close-up of a sonar screen pulsing with an unknown signal, deep blue glow, underwater facility in soft focus behind, ominous teal atmosphere, slow push-in on the screen". Every visual_prompt should read like a shot list for a cinematographer.
- Every scene is visually distinct from the others — different camera angle, different lighting, different subject framing. No two scenes should feel like the same shot.
- The final scene ends on a cliffhanger or a powerful one-liner that demands the viewer follow.
- Output is in English.
- 4-6 scenes total. Durations add up to roughly 30-35 seconds.

GENRE-SPECIFIC GUIDANCE:
- Mystery / Conspiracy: suspense, curiosity gaps, dark cinematic visuals, slow reveals, deep blues and shadow.
- History / Facts: fast pacing, surprising stats, bold dramatic narration, archival-feel visuals, warm sepia or hard contrast.
- Finance / Money: clean minimal aesthetic, relatable money problems, urgent tone, charts/cash/skyline visuals with high contrast.
- Space / Cosmic: vast cinematic scale, deep blacks, single subject against scale, ambient pulses.
- True Crime: cold lighting, slow tracking shots, evidence-board feel, restraint.
- Tech / AI: clean futurism, glowing UI, magenta/teal palette, motion in every shot.

PROVIDER PROMPT — important:
You also produce a separate "provider_prompt": a SHORT cinematic description (200-450 chars, NEVER over 500) that an AI video model can use directly. It must be visual only — no voiceover, no hashtags, no YouTube text, no scene list. Describe overall mood, color palette, lighting, camera language, subject framing. Example: "Cinematic vertical 9:16 video of a deep ocean at night, sonar screens glowing blue, underwater shadows moving slowly, suspenseful scientific monitoring station, realistic lighting, high contrast, mysterious mood, slow camera movement."

OUTPUT FORMAT — valid JSON ONLY (no markdown fences, no commentary) matching this exact schema:
{
  "viral_title": string,
  "hook": string,
  "summary": string,
  "niche": string,
  "tone": string,
  "voiceover_script": string,
  "scenes": [
    {
      "scene_number": number,
      "duration_seconds": number,
      "caption": string,
      "visual_prompt": string (max 450 characters, cinematic-specific),
      "voiceover": string
    }
  ],
  "music_mood": string,
  "pacing_notes": string,
  "youtube_title": string,
  "youtube_description": string,
  "hashtags": string[],
  "provider_prompt": string (200-450 chars, hard max 500)
}`

// ─── Coercion helpers ────────────────────────────────────────────────────────
function asString(v: unknown, fallbackVal = ''): string {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : fallbackVal
}
function asNumber(v: unknown, fallbackVal: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return fallbackVal
}
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim())
}

// Trim a caption down to ~6-8 words. Models sometimes overshoot; clamp here
// so the UI never has to.
function clampCaption(raw: string, maxWords = 8): string {
  const words = raw.trim().replace(/[.!?]+$/g, '').split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return words.join(' ')
  return words.slice(0, maxWords).join(' ')
}

function coerceScenes(raw: unknown, fallbacks: SceneBrief[]): SceneBrief[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallbacks
  const out: SceneBrief[] = []
  raw.slice(0, 6).forEach((entry, i) => {
    if (!entry || typeof entry !== 'object') return
    const e = entry as Record<string, unknown>
    const fb = fallbacks[i] ?? fallbacks[fallbacks.length - 1]
    // Per-scene visual_prompt is what /api/generate-video sends to Runway as
    // the per-clip prompt. Hard-clamp it to PROVIDER_PROMPT_MAX so a long
    // model response can never trigger "Prompt is too long" downstream.
    const rawVisual = asString(e.visual_prompt, fb.visual_prompt)
    out.push({
      scene_number: asNumber(e.scene_number, i + 1),
      duration_seconds: asNumber(e.duration_seconds, fb.duration_seconds),
      caption: clampCaption(asString(e.caption, fb.caption)),
      visual_prompt: clampToProviderLimit(rawVisual),
      voiceover: asString(e.voiceover, fb.voiceover),
    })
  })
  return out.length >= 3 ? out : fallbacks
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('[analyze-idea] OPENAI_API_KEY is not configured')
      return NextResponse.json({ error: 'AI service is not configured.' }, { status: 500 })
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: { prompt?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const prompt = (body.prompt ?? '').trim()
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 })
    }
    if (prompt.length > 1000) {
      return NextResponse.json({ error: 'Prompt is too long.' }, { status: 400 })
    }

    const fallback = fallbackBrief(prompt)

    const userMsg = `Build the full creative brief for this video idea.

IDEA:
"""${prompt}"""

Detected niche hint: ${fallback.niche}
Detected tone hint: ${fallback.tone}

Follow every rule in the system prompt. Return ONLY the JSON object — no markdown, no commentary.`

    let brief: CreativeBrief = fallback
    try {
      const completion = await openai.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMsg },
          ],
          temperature: 0.85,
          max_tokens: 1600,
          response_format: { type: 'json_object' },
        },
        { timeout: 25000 }
      )
      const raw = completion.choices[0]?.message?.content?.trim() ?? ''
      if (!raw) throw new Error('Empty response from OpenAI')
      const data = JSON.parse(raw) as Record<string, unknown>

      const scenes = coerceScenes(data.scenes, fallback.scenes)
      const viral_title = asString(data.viral_title, fallback.viral_title).slice(0, 120)
      const hook = asString(data.hook, fallback.hook)
      const summary = asString(data.summary, fallback.summary)
      const niche = asString(data.niche, fallback.niche).slice(0, 40)
      const tone = asString(data.tone, fallback.tone).slice(0, 80)
      const voiceover_script = asString(
        data.voiceover_script,
        scenes.map((s) => s.voiceover).filter(Boolean).join(' ') || fallback.voiceover_script,
      )
      const music_mood = asString(data.music_mood, fallback.music_mood).slice(0, 160)
      const pacing_notes = asString(data.pacing_notes, fallback.pacing_notes).slice(0, 240)
      const youtube_title = asString(data.youtube_title, fallback.youtube_title).slice(0, 120)
      const youtube_description = asString(data.youtube_description, fallback.youtube_description).slice(0, 600)
      let hashtags = asStringArray(data.hashtags).slice(0, 8)
      // Normalize hashtags: ensure leading '#', strip whitespace, drop empties.
      hashtags = hashtags
        .map((h) => h.replace(/\s+/g, ''))
        .map((h) => (h.startsWith('#') ? h : `#${h}`))
        .filter((h) => h.length > 1)
      if (hashtags.length === 0) hashtags = fallback.hashtags

      // Build the provider_prompt. Prefer the model's own value, fall back to
      // synthesising one from summary + visual prompts, then clamp hard to
      // PROVIDER_PROMPT_MAX. This is the string /api/generate-video will hand
      // to Runway, so the >500-char failure mode is closed here.
      const modelProvider = asString(data.provider_prompt, '')
      const synthesised =
        modelProvider ||
        [summary, scenes.map((s) => s.visual_prompt).join(' ')]
          .filter(Boolean)
          .join(' ') ||
        fallback.provider_prompt
      const provider_prompt_raw = synthesised
      const provider_prompt = clampToProviderLimit(provider_prompt_raw)
      if (provider_prompt_raw.length !== provider_prompt.length) {
        console.log(
          `[analyze-idea] provider_prompt clamped ${provider_prompt_raw.length} -> ${provider_prompt.length} chars`,
        )
      }

      brief = {
        viral_title,
        hook,
        summary,
        niche,
        tone,
        voiceover_script,
        scenes,
        music_mood,
        pacing_notes,
        youtube_title,
        youtube_description,
        hashtags,
        provider_prompt,
        // Legacy compatibility
        title: viral_title,
        scenePlan: scenes.map((s) => s.visual_prompt),
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[analyze-idea] OpenAI failed:', msg)
      brief = fallback
    }

    return NextResponse.json(brief)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[analyze-idea] unexpected error:', msg)
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 })
  }
}
