// KINEO-HOLLYWOOD-2026-07-09 — HOLLYWOOD MODE 2.0 scene router.
//
// One video, three engines, routed PER SCENE by what the scene needs:
//   dialogue  → Kling 3 Pro (native voice + lip sync — the person SPEAKS on camera)
//   cinematic → Veo 3.1 Fast (best motion + native ambient audio)
//   support   → Seedance 1.5 Pro (cheap b-roll with native ambient audio)
//
// The four keys to realism enforced by the planner prompt AND by code:
//   (1) NATIVE AUDIO   — dialogue lines live INSIDE the prompt (quoted); never TTS
//                        over a talking face.
//   (2) CONTINUITY     — one fictional characterSheet + one environmentSheet,
//                        repeated verbatim at the start of every relevant prompt.
//   (3) IMPERFECTION   — handheld camera, natural imperfect light, film grain.
//   (4) SIMPLE PHYSICS — only simple, well-executed movements.
//
// Anti-deepfake: prompts naming real contemporary people are BLOCKED at the API
// boundary (HTTP 400) and SANITIZED out of generated prompts.

import { openai } from '@/lib/openai'

// ── Engines ─────────────────────────────────────────────────────────────────
// KINEO-HOLLYWOOD-2026-07-09 — support reuses the exact Seedance model string
// from app/api/generate-video-cinematic/route.ts (keep in sync).
export const HOLLYWOOD_MODELS = {
  dialogue: 'fal-ai/kling-video/v3/pro/text-to-video',
  cinematic: 'fal-ai/veo3.1/fast',
  support: 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video',
} as const

export type HollywoodSceneType = keyof typeof HOLLYWOOD_MODELS

// KINEO-HOLLYWOOD-2026-07-09 — fal pricing, jul/2026: Kling 3 Pro audio-on
// $0.168/s; Veo 3.1 fast audio-on 720p $0.15/s; Seedance 1.5 pro audio-on
// 720p ≈ $0.052/s. Used for the code-computed cost estimate + cost logging.
export const HOLLYWOOD_USD_PER_SECOND: Record<HollywoodSceneType, number> = {
  dialogue: 0.168,
  cinematic: 0.15,
  support: 0.052,
}

// ── Anti-deepfake ────────────────────────────────────────────────────────────
// KINEO-HOLLYWOOD-2026-07-09 — contemporary celebrities / politicians /
// athletes. Used to (a) BLOCK user prompts that name a real person (HTTP 400
// in the route) and (b) sanitize GPT-generated prompts. Compound forms are
// used for surnames that double as common words ("gates", "curry", "brady")
// so a prompt about "the gates of Babylon" is never blocked.
export const CONTEMPORARY_FIGURE_RE = new RegExp(
  '\\b(?:' +
    [
      // tech / business
      'elon\\s+musk', 'musk', 'elon', 'zuckerberg', 'mark\\s+zuckerberg', 'bezos', 'jeff\\s+bezos',
      'bill\\s+gates', 'sam\\s+altman', 'jensen\\s+huang', 'tim\\s+cook', 'sundar\\s+pichai',
      'satya\\s+nadella', 'warren\\s+buffett', 'buffett', 'oprah', 'jack\\s+ma', 'bernard\\s+arnault',
      // politics / heads of state / royalty / religion
      'trump', 'donald\\s+trump', 'biden', 'joe\\s+biden', 'obama', 'barack\\s+obama', 'putin',
      'zelensky+', 'lula', 'bolsonaro', 'macron', 'merkel', 'netanyahu', 'kim\\s+jong[\\s-]?un',
      'xi\\s+jinping', 'narendra\\s+modi', 'trudeau', 'milei', 'maduro', 'kamala\\s+harris',
      'pope\\s+leo', 'pope\\s+francis', 'king\\s+charles', 'prince\\s+william', 'prince\\s+harry',
      'meghan\\s+markle', 'queen\\s+elizabeth', 'dalai\\s+lama', 'greta\\s+thunberg',
      // sports
      'messi', 'lionel\\s+messi', 'cristiano\\s+ronaldo', 'ronaldo', 'cr7', 'neymar', 'mbapp[eé]',
      'haaland', 'vinicius\\s+jr\\.?', 'vini\\s+jr\\.?', 'bellingham', 'lewandowski', 'mo\\s+salah',
      'lebron(?:\\s+james)?', 'steph(?:en)?\\s+curry', 'kevin\\s+durant', 'giannis', 'nikola\\s+jokic',
      'tom\\s+brady', 'patrick\\s+mahomes', 'serena\\s+williams', 'djokovic', 'rafael\\s+nadal',
      'roger\\s+federer', 'alcaraz', 'verstappen', 'lewis\\s+hamilton', 'tiger\\s+woods',
      'mike\\s+tyson', 'conor\\s+mcgregor', 'usain\\s+bolt',
      // music / entertainment / creators
      'taylor\\s+swift', 'beyonc[eé]', 'rihanna', 'drake', 'kanye(?:\\s+west)?', 'kendrick\\s+lamar',
      'billie\\s+eilish', 'ariana\\s+grande', 'justin\\s+bieber', 'bad\\s+bunny', 'dua\\s+lipa',
      'ed\\s+sheeran', 'adele', 'eminem', 'snoop\\s+dogg', 'cardi\\s+b', 'nicki\\s+minaj',
      'kardashian', 'kylie\\s+jenner', 'kendall\\s+jenner', 'shakira', 'selena\\s+gomez',
      'mr\\.?\\s?beast', 'pewdiepie', 'kai\\s+cenat', 'ishowspeed', 'logan\\s+paul', 'jake\\s+paul',
      'andrew\\s+tate', 'joe\\s+rogan', 'jordan\\s+peterson',
      // film / tv
      'tom\\s+cruise', 'leonardo\\s+dicaprio', 'dicaprio', 'brad\\s+pitt', 'angelina\\s+jolie',
      'johnny\\s+depp', 'keanu\\s+reeves', 'dwayne\\s+johnson', 'zendaya', 'timoth[eé]e\\s+chalamet',
      'margot\\s+robbie', 'scarlett\\s+johansson', 'robert\\s+downey(?:\\s+jr\\.?)?', 'will\\s+smith',
      'denzel\\s+washington', 'morgan\\s+freeman', 'emma\\s+watson', 'tom\\s+hanks',
    ].join('|') +
    ')\\b',
  'gi',
)

// KINEO-HOLLYWOOD-2026-07-09 — duplicated from NAMED_FIGURE_RE in
// app/api/generate-video-cinematic/route.ts (era-lock, historical figures).
// Duplicated on purpose: lib code must not import from a route file. Keep in sync.
export const HISTORICAL_FIGURE_RE =
  /\b(?:(?:emperor|general|marshal|king|queen|tsar|czar|president|commander|colonel|admiral|captain|duke|lord|sir|kaiser|pharaoh)\s+[A-Z][\w'-]+|napoleon(?:\s+bonaparte)?|bonaparte|wellington|hitler|stalin|churchill|caesar|cleopatra|genghis\s+khan|alexander\s+the\s+great|abraham\s+lincoln|george\s+washington|joan\s+of\s+arc)\b/gi

/** Stateless "does this text name a real person?" check (the /g regexes are
 * stateful under .test(), so we reset lastIndex before every use). */
export function mentionsRealPerson(text: string): boolean {
  const t = text ?? ''
  CONTEMPORARY_FIGURE_RE.lastIndex = 0
  if (CONTEMPORARY_FIGURE_RE.test(t)) return true
  HISTORICAL_FIGURE_RE.lastIndex = 0
  return HISTORICAL_FIGURE_RE.test(t)
}

/** Replace any real-person name with a generic fictional description. */
export function sanitizeRealPeople(text: string): string {
  CONTEMPORARY_FIGURE_RE.lastIndex = 0
  HISTORICAL_FIGURE_RE.lastIndex = 0
  return (text ?? '')
    .replace(CONTEMPORARY_FIGURE_RE, 'a fictional person (no real-world likeness)')
    .replace(HISTORICAL_FIGURE_RE, 'a fictional period-accurate figure')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ── Plan types ───────────────────────────────────────────────────────────────
export type HollywoodScene = {
  index: number
  type: HollywoodSceneType
  seconds: number // dialogue=10, cinematic=8, support=10 (last may be shorter)
  prompt: string // final prompt for the engine
  dialogueLine?: string // exact spoken line (English), quoted inside the prompt
  voiceover?: string // TTS narration ONLY for cinematic/support scenes
  needsNarration: boolean // dialogue => false ALWAYS
  caption: string
}

export type HollywoodPlan = {
  characterSheet: string
  environmentSheet: string
  scenes: HollywoodScene[]
  estimatedCostUsd: number
}

const REALISM_DIRECTIVES =
  'subtle handheld camera movement, natural imperfect lighting, light film grain, candid framing'

// ── Planner ──────────────────────────────────────────────────────────────────
export async function planHollywoodScenes(args: {
  idea: string
  voiceoverScript?: string
  scenes?: Array<{ voiceover?: string; description?: string }>
  durationSeconds: number
  language?: string
}): Promise<HollywoodPlan> {
  const { idea, voiceoverScript, scenes, durationSeconds, language } = args

  const sceneCtx = (scenes ?? [])
    .slice(0, 10)
    .map((s, i) => `Beat ${i + 1}: ${((s.voiceover || s.description || '') as string).slice(0, 220)}`)
    .join('\n')

  const system = `You are a Hollywood-grade director planning an ultra-realistic 9:16 vertical short film (45-60 seconds total) from an idea/script. You output ONLY valid JSON.

You route each scene to one of three engine types:
- "dialogue": a fictional person speaks ON CAMERA. 10 seconds. The EXACT spoken line (English, max ~20 words) MUST appear inside the scene prompt wrapped in double quotes, e.g.: she looks into the lens and says: "Nobody tells you this about money." The engine generates the voice and lip sync natively. NEVER plan external narration (TTS) over a person speaking in close-up.
- "cinematic": a high-motion cinematic shot (environment, action, reveal). 8 seconds. May carry a short external narration line ("voiceover").
- "support": a simpler establishing/detail b-roll shot. 10 seconds (the FINAL scene may be shorter to land the 45-60s total). May carry a "voiceover" narration line.

THE FOUR KEYS TO REALISM (mandatory):
1) NATIVE AUDIO: dialogue scenes carry their spoken line inside the prompt in double quotes; dialogue scenes NEVER have a "voiceover" field.
2) CONTINUITY: invent EXACTLY ONE fictional person ("characterSheet": ~40 words of precise physical description — age, ethnicity, hair, exact clothing) and EXACTLY ONE environment ("environmentSheet": ~30 words). Repeat BOTH sheets VERBATIM at the START of every scene prompt that shows the person and/or that place.
3) REALISTIC IMPERFECTION: every scene prompt includes directives like "${REALISM_DIRECTIVES}, occasional off-axis glance" — vary the wording scene to scene so it never reads templated.
4) PHYSICS: only simple, well-executed movements (walking, gesturing, pouring coffee, wind in clothes, turning the head). NO complex action, stunts, sports moves, or acrobatics.

OTHER HARD RULES:
- 9:16 vertical framing in every prompt.
- Scene 1 is a strong HOOK (usually a dialogue scene looking into the lens).
- Total duration 45-60 seconds. 4 to 6 scenes. Zero dead frames — every second earns attention.
- ALL text in English regardless of the input language${language && language !== 'en' ? ` (the input may be in "${language}")` : ''}.
- NEVER name or depict a real person (no celebrities, politicians, athletes, historical figures). People are always fictional and generic.
- Each scene gets a short on-screen "caption" (max 6 words, punchy).

Output JSON shape:
{"characterSheet":"...","environmentSheet":"...","scenes":[{"index":1,"type":"dialogue","seconds":10,"prompt":"...","dialogueLine":"...","caption":"..."},{"index":2,"type":"cinematic","seconds":8,"prompt":"...","voiceover":"...","caption":"..."}]}`

  const userMsg = `Idea/topic: ${String(idea ?? '').slice(0, 600)}

${voiceoverScript ? `Existing narration script (reuse its facts and beats):\n${String(voiceoverScript).slice(0, 1500)}\n` : ''}${sceneCtx ? `Existing scene beats:\n${sceneCtx}\n` : ''}
Target total duration: ${Math.max(45, Math.min(60, Math.round(durationSeconds || 60)))} seconds.`

  const completion = await openai.chat.completions.create(
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.7,
      max_tokens: 2200,
      response_format: { type: 'json_object' },
    },
    { timeout: 30000, maxRetries: 1 },
  )

  const raw = completion.choices[0]?.message?.content?.trim() ?? ''
  if (!raw) throw new Error('Hollywood planner returned empty response')

  const data = JSON.parse(raw) as {
    characterSheet?: unknown
    environmentSheet?: unknown
    scenes?: unknown
  }

  const characterSheet = sanitizeRealPeople(typeof data.characterSheet === 'string' ? data.characterSheet : '')
  const environmentSheet = sanitizeRealPeople(typeof data.environmentSheet === 'string' ? data.environmentSheet : '')
  const rawScenes = Array.isArray(data.scenes) ? data.scenes : []
  if (rawScenes.length === 0) throw new Error('Hollywood planner returned no scenes')

  const outScenes: HollywoodScene[] = []
  for (let i = 0; i < Math.min(rawScenes.length, 7); i++) {
    const rs = rawScenes[i] as Record<string, unknown>
    const typeRaw = typeof rs.type === 'string' ? rs.type.toLowerCase() : 'support'
    const type: HollywoodSceneType =
      typeRaw === 'dialogue' || typeRaw === 'cinematic' || typeRaw === 'support'
        ? (typeRaw as HollywoodSceneType)
        : 'support'

    // Sanitize EVERY generated prompt against real-person names (code-enforced —
    // never trust the model to follow the "no real people" instruction).
    let prompt = sanitizeRealPeople(typeof rs.prompt === 'string' ? rs.prompt : '')
    if (prompt.length < 10) continue
    // (3) realistic imperfection — code-enforced backstop if GPT dropped it.
    if (!/handheld|film grain|imperfect/i.test(prompt)) {
      prompt = `${prompt}, ${REALISM_DIRECTIVES}`
    }
    if (!/9:16|vertical/i.test(prompt)) prompt = `${prompt}, 9:16 vertical framing`

    const dialogueLine =
      type === 'dialogue' && typeof rs.dialogueLine === 'string' && rs.dialogueLine.trim()
        ? sanitizeRealPeople(rs.dialogueLine.trim()).slice(0, 220)
        : undefined
    // (1) native audio — a dialogue scene MUST carry its quoted line in the prompt.
    if (type === 'dialogue' && dialogueLine && !prompt.includes('"')) {
      prompt = `${prompt} — looking into the lens, the person says: "${dialogueLine}"`
    }

    const voiceover =
      type !== 'dialogue' && typeof rs.voiceover === 'string' && rs.voiceover.trim()
        ? sanitizeRealPeople(rs.voiceover.trim()).slice(0, 400)
        : undefined

    // Seconds are code-enforced per engine (dialogue=10, cinematic=8, support≤10).
    const rawSec = Number(rs.seconds)
    const seconds =
      type === 'dialogue'
        ? 10
        : type === 'cinematic'
          ? 8
          : Number.isFinite(rawSec)
            ? Math.max(4, Math.min(10, Math.round(rawSec)))
            : 10

    const caption =
      (typeof rs.caption === 'string' && rs.caption.trim()
        ? sanitizeRealPeople(rs.caption.trim())
        : (dialogueLine ?? voiceover ?? prompt).split(/\s+/).slice(0, 6).join(' ')
      ).slice(0, 60)

    outScenes.push({
      index: outScenes.length + 1,
      type,
      seconds,
      prompt,
      ...(dialogueLine ? { dialogueLine } : {}),
      ...(voiceover ? { voiceover } : {}),
      needsNarration: type !== 'dialogue' && !!voiceover, // dialogue => false ALWAYS
      caption,
    })
  }
  if (outScenes.length < 2) throw new Error('Hollywood planner produced too few usable scenes')

  // Fit the timeline to ≤ 60s: shrink the trailing support scene, then drop
  // trailing scenes if the plan still overflows. (< 45s plans are kept as-is —
  // compose trims/fits, and a short-but-dense video beats a padded one.)
  let total = outScenes.reduce((s, sc) => s + sc.seconds, 0)
  while (total > 60 && outScenes.length > 2) {
    const last = outScenes[outScenes.length - 1]
    if (last.type === 'support' && last.seconds > 4) {
      const shrink = Math.min(last.seconds - 4, total - 60)
      last.seconds -= shrink
      total -= shrink
      if (total <= 60) break
    }
    outScenes.pop()
    total = outScenes.reduce((s, sc) => s + sc.seconds, 0)
  }

  // Cost is computed IN CODE (never trust the model's arithmetic).
  const estimatedCostUsd =
    Math.round(outScenes.reduce((s, sc) => s + sc.seconds * HOLLYWOOD_USD_PER_SECOND[sc.type], 0) * 100) / 100

  return { characterSheet, environmentSheet, scenes: outScenes, estimatedCostUsd }
}

// ── Cost logging ─────────────────────────────────────────────────────────────
export function logHollywoodCost(generationId: string, scenes: HollywoodScene[]): void {
  let total = 0
  for (const s of scenes) {
    const usd = s.seconds * HOLLYWOOD_USD_PER_SECOND[s.type]
    total += usd
    console.log(
      `[hollywood-cost] gen=${generationId} scene=${s.index} type=${s.type} model=${HOLLYWOOD_MODELS[s.type]} sec=${s.seconds} usd=${usd.toFixed(2)}`,
    )
  }
  console.log(`[hollywood-cost] gen=${generationId} TOTAL usd=${total.toFixed(2)}`)
}
