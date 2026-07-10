// KINEO-HOLLYWOOD-2026-07-09 — HOLLYWOOD MODE 2.0 scene router.
//
// One video, routed PER SCENE by what the scene needs:
//   dialogue  → Kling 3 Pro (native voice + lip sync — the person SPEAKS on camera)
//   cinematic → Veo 3.1 Fast (epic landscape/aerial ONLY, 1-2 scenes max)
//   support   → Kling 3 Pro (ambient-only b-roll — SAME look as dialogue scenes)
//
// KINEO-HOLLYWOOD-22-2026-07-10 — round 2 of founder feedback (3 real videos):
//   (e) VIRAL STRUCTURE — every plan follows the house timeline HOOK (0-3s) /
//       MICRO REWARD (3-8s) / ESCALATION (8-20s) / ESCALATION (20-35s) /
//       PAYOFF (35-50s), labeled per scene ("beat") and validated in code.
//   (f) VISUAL COHERENCE — one shared `styleSheet` (photography description)
//       appended VERBATIM to every scene prompt, and Seedance is OUT (its
//       inferior look was what made the engine switching visible).
//
// KINEO-HOLLYWOOD-23-2026-07-10 — round 3 (founder score 2 → 8; two defects
// left, both on support scenes):
//   (g) ZERO SILENT SECONDS — every non-dialogue scene MUST carry narration
//       (voiceover) that continues the story; prompt-demanded AND code-enforced
//       with a deterministic fallback (never null). needsNarration is TRUE for
//       every non-dialogue scene.
//   (h) STABLE COMPOSITION — support/cinematic inserts get a code-enforced
//       "level horizon, no dutch angle" suffix (the final Manhattan shot came
//       out tilted).
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
// KINEO-HOLLYWOOD-22-2026-07-10 — Seedance is OUT of Hollywood Mode. On the
// first 3 real renders its support shots visibly dropped in render quality
// next to Kling 3 (founder: "é muito visível que está trocando os motores").
// Support scenes now run on the SAME Kling 3 model as dialogue
// (generate_audio:true, ambient only — no quoted line), so the look stays
// continuous across cuts. Veo stays ONLY for the 1-2 epic landscape/aerial
// 'cinematic' scenes the planner may request.
export const HOLLYWOOD_MODELS = {
  dialogue: 'fal-ai/kling-video/v3/pro/text-to-video',
  cinematic: 'fal-ai/veo3.1/fast',
  support: 'fal-ai/kling-video/v3/pro/text-to-video',
} as const

export type HollywoodSceneType = keyof typeof HOLLYWOOD_MODELS

// KINEO-HOLLYWOOD-22-2026-07-10 — fal pricing, jul/2026: Kling 3 Pro audio-on
// $0.168/s (now BOTH dialogue and support); Veo 3.1 fast audio-on 720p $0.15/s.
// Typical 55s video ≈ $8.90 (was ~$6-7 with Seedance support — the extra ~$2
// buys the visual coherence). Used for the code-computed cost estimate + logs.
export const HOLLYWOOD_USD_PER_SECOND: Record<HollywoodSceneType, number> = {
  dialogue: 0.168,
  cinematic: 0.15,
  support: 0.168,
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
// KINEO-HOLLYWOOD-22-2026-07-10 — the house viral timeline, per scene:
// HOOK (0-3s) · MICRO REWARD (3-8s) · ESCALATION (8-20s) · ESCALATION (20-35s)
// · PAYOFF (35-50s). Scene 1 MUST be HOOK; the last scene MUST be PAYOFF —
// validated in code after planning (assignBeatsByPosition fallback).
export type HollywoodBeat = 'HOOK' | 'MICRO_REWARD' | 'ESCALATION' | 'PAYOFF'

export type HollywoodScene = {
  index: number
  type: HollywoodSceneType
  beat: HollywoodBeat // KINEO-HOLLYWOOD-22 — which viral beat this scene executes
  seconds: number // dialogue=5|10 (sized to the line), cinematic=8, support=5|10 (Kling 3 clip lengths; last may be timeline-trimmed)
  prompt: string // final prompt for the engine
  dialogueLine?: string // exact spoken line (English), quoted inside the prompt
  voiceover?: string // TTS narration — MANDATORY on cinematic/support (code-guaranteed, KINEO-HOLLYWOOD-23); never on dialogue
  needsNarration: boolean // dialogue => false ALWAYS; non-dialogue => true ALWAYS (KINEO-HOLLYWOOD-23)
  caption: string
}

export type HollywoodPlan = {
  characterSheet: string
  environmentSheet: string
  // KINEO-HOLLYWOOD-22-2026-07-10 — ONE ~30-word photography description
  // (palette, light, lens, grain, mood) generated once by the planner and
  // appended VERBATIM (in code) to the END of EVERY scene prompt, all engines.
  // This is what masks the look difference between Kling 3 and Veo.
  styleSheet: string
  scenes: HollywoodScene[]
  estimatedCostUsd: number
}

const REALISM_DIRECTIVES =
  'subtle handheld camera movement, natural imperfect lighting, light film grain, candid framing'

// KINEO-HOLLYWOOD-22-2026-07-10 — fallback cinematography sheet when the
// planner omits/butchers its styleSheet. Same role: glued to every prompt.
const DEFAULT_STYLE_SHEET =
  'shot on 35mm film, teal-orange cinematic color grade, soft golden backlight, shallow depth of field, light film grain, moody high-contrast look'

// KINEO-HOLLYWOOD-21-2026-07-10 (bug d) — Kling 3 is a Chinese model: any
// readable screen/sign in the shot tends to render in CHINESE (a phone showed
// up covered in Chinese text on the first real render). Code-enforced suffix
// on EVERY scene prompt — never trust GPT to carry the rule.
const NO_TEXT_SUFFIX =
  ' No readable text anywhere in the scene: no phone or computer screens, no signs, no billboards, no labels, no subtitles, no watermarks. If a phone appears, its screen is off or blurred.'

// KINEO-HOLLYWOOD-23-2026-07-10 (bug h) — the final Manhattan support shot on
// the round-3 render came out TILTED (dutch angle). Support/cinematic scenes
// are classic, stable inserts — code-enforced suffix on every NON-DIALOGUE
// prompt (rides with styleSheet/NO_TEXT_SUFFIX; never trust GPT to carry it).
const STABLE_SHOT_SUFFIX =
  ' Level horizon, stable well-composed shot (tripod or slow dolly), no tilted or dutch angles.'

// KINEO-HOLLYWOOD-23-2026-07-10 (bug g) — helpers for the mandatory-narration
// fallback: deterministic, zero extra GPT calls.
const NARRATION_WORDS_PER_SECOND = 2.3
const MIN_NARRATION_WORDS = 6

function normalizeForMatch(text: string): string {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Split the original idea/script into clean sentences (viral markers stripped),
 * usable as fallback narration lines. */
function splitIntoNarrationSentences(text: string): string[] {
  return (
    String(text ?? '')
      .replace(/\b(HOOK|MICRO[\s_-]?REWARD|ESCALATION|PAYOFF|RHYTHM)\b\s*[:\-–—]?/gi, ' ')
      .match(/[^.!?\n]+[.!?]+|[^.!?\n]+/g) ?? []
  )
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.split(/\s+/).filter(Boolean).length >= 4)
}

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
- "dialogue": a fictional person speaks ON CAMERA. 5 or 10 seconds. The EXACT spoken line (English) MUST appear inside the scene prompt wrapped in double quotes, e.g.: she looks into the lens and says: "Nobody tells you this about money." The line must FILL the entire clip: the person speaks continuously and energetically for the entire shot, no dead air. Line-length rule (strict): a 10-second scene needs a 22-30 word line; a 5-second scene needs a 10-14 word line. The engine generates the voice and lip sync natively. NEVER plan external narration (TTS) over a person speaking in close-up.
- "cinematic": an EPIC LANDSCAPE or AERIAL shot only (sweeping vista, drone reveal, vast environment). 8 seconds. MUST carry an external narration line ("voiceover" — see NARRATION rule below). USE SPARINGLY: at most 1-2 "cinematic" scenes per video, and ONLY when the story truly needs an epic wide — every other non-dialogue scene is "support". Write its prompt with the SAME styleSheet look as everything else.
- "support": a simpler establishing/detail b-roll shot (ambient sound only, nobody speaks on camera). 5 or 10 seconds. MUST carry a "voiceover" narration line (see NARRATION rule below). Composition: support scenes are classic, stable inserts — level horizon, well-composed tripod or slow-dolly shot, NEVER a tilted or dutch angle.

NARRATION (mandatory — ZERO silent seconds): EVERY "cinematic" and "support" scene MUST have a "voiceover". The narration continues the story OVER the b-roll — there must not be a single second of the video without spoken words, and each voiceover must PICK UP exactly where the previous spoken line (dialogue or narration) left off (content continuity, no resets, no filler). Size the voiceover to the scene: ~2.3 words per second — a 10-second scene needs 20-24 words, an 8-second scene 16-20 words, a 5-second scene 10-12 words.

VIRAL STRUCTURE (mandatory — the house timeline, every video follows it):
- HOOK (0-3s): scene 1 is ALWAYS the HOOK. The FIRST spoken sentence starts within 0.5 seconds of frame one and is a curiosity gap or shock built on a CONCRETE number (e.g. "This island kills 99% of the people who land on it."). Establishing context, greetings or scene-setting BEFORE the hook is FORBIDDEN.
- MICRO REWARD (3-8s): immediately deliver one satisfying, concrete fact that pays off the click — proof the video is worth watching.
- ESCALATION (8-20s, then 20-35s): each escalation raises the stakes with a STRONGER, more surprising fact than the scene before it.
- PAYOFF (35-50s): the final scene RESOLVES the open question the hook planted + lands a memorable closing line.
Label EVERY scene with its "beat": "HOOK" | "MICRO_REWARD" | "ESCALATION" | "PAYOFF". Scene 1 MUST have beat "HOOK"; the LAST scene MUST have beat "PAYOFF". The dialogue lines and narration lines EXECUTE these beats — they carry the hook, the reward, the escalations and the payoff in the actual spoken words.

CINEMATOGRAPHY ("styleSheet" — mandatory): output ONE ~30-word photography description shared by the WHOLE film — color palette, light, lens, grain, mood (e.g. "shot on 35mm, teal-orange grade, soft golden backlight, shallow depth of field, light film grain"). It is appended to every scene prompt so ALL engines render the exact same look.

THE FOUR KEYS TO REALISM (mandatory):
1) NATIVE AUDIO: dialogue scenes carry their spoken line inside the prompt in double quotes; dialogue scenes NEVER have a "voiceover" field.
2) CONTINUITY: invent EXACTLY ONE fictional person ("characterSheet": ~40 words of precise physical description — age, ethnicity, hair, exact clothing) and EXACTLY ONE environment ("environmentSheet": ~30 words). Repeat BOTH sheets VERBATIM at the START of every scene prompt that shows the person and/or that place.
3) REALISTIC IMPERFECTION: every scene prompt includes directives like "${REALISM_DIRECTIVES}, occasional off-axis glance" — vary the wording scene to scene so it never reads templated.
4) PHYSICS: only simple, well-executed movements (walking, gesturing, pouring coffee, wind in clothes, turning the head). NO complex action, stunts, sports moves, or acrobatics.

YOU ARE THE SCREENWRITER (KINEO-HOLLYWOOD-21 — the input is RAW material):
- The user's input is raw, unprocessed material — it may contain quoted lines, an interview format, loose notes or plain descriptions. Your job is to turn it into a tight, concrete screenplay.
- Every dialogue line and narration line must be CONCRETE and carry the SPECIFIC facts, numbers, names and claims from the input. Generic motivational filler is FORBIDDEN — never write empty phrases like "the digital age reshapes possibilities" or "success is a journey".
- If the user wrote lines between quotes, USE those exact lines as the spoken dialogue (adjust ONLY the length to fit the line-length rule above).
- The scenes tell ONE connected story: each scene continues the previous scene's beat (setup → escalation → payoff). No disconnected vignettes.

OTHER HARD RULES:
- 9:16 vertical framing in every prompt.
- ZERO readable text in any shot: no phone/computer screens with content, no signs, no billboards, no labels. If a phone appears, its screen is off or blurred.
- Scene 1 = the HOOK beat (usually a dialogue scene looking straight into the lens, speaking from the very first frame).
- Total duration 45-60 seconds. 4 to 6 scenes. Zero dead frames — every second earns attention.
- ALL text in English regardless of the input language${language && language !== 'en' ? ` (the input may be in "${language}")` : ''}.
- NEVER name or depict a real person (no celebrities, politicians, athletes, historical figures). People are always fictional and generic.
- Each scene gets a short on-screen "caption" (max 6 words, punchy).

Output JSON shape:
{"characterSheet":"...","environmentSheet":"...","styleSheet":"...","scenes":[{"index":1,"type":"dialogue","beat":"HOOK","seconds":10,"prompt":"...","dialogueLine":"...","caption":"..."},{"index":2,"type":"support","beat":"MICRO_REWARD","seconds":10,"prompt":"...","voiceover":"...","caption":"..."}]}`

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
    styleSheet?: unknown
    scenes?: unknown
  }

  const characterSheet = sanitizeRealPeople(typeof data.characterSheet === 'string' ? data.characterSheet : '')
  const environmentSheet = sanitizeRealPeople(typeof data.environmentSheet === 'string' ? data.environmentSheet : '')
  // KINEO-HOLLYWOOD-22-2026-07-10 — ONE photography sheet for the whole film,
  // appended IN CODE to every scene prompt below (all engines get the same
  // look). Falls back to a solid default if GPT skipped it or wrote garbage.
  const styleSheet = sanitizeRealPeople(
    typeof data.styleSheet === 'string' && data.styleSheet.trim().length >= 15
      ? data.styleSheet.trim().slice(0, 300)
      : DEFAULT_STYLE_SHEET,
  )
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

    // KINEO-HOLLYWOOD-22-2026-07-10 — viral beat per scene. Accepts "MICRO
    // REWARD"/"micro-reward" variants; anything unknown lands on ESCALATION
    // (the position-based validation after the loop fixes scene 1 / last).
    const beatRaw = typeof rs.beat === 'string' ? rs.beat.trim().toUpperCase().replace(/[\s-]+/g, '_') : ''
    const beat: HollywoodBeat =
      beatRaw === 'HOOK' || beatRaw === 'MICRO_REWARD' || beatRaw === 'ESCALATION' || beatRaw === 'PAYOFF'
        ? (beatRaw as HollywoodBeat)
        : 'ESCALATION'

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

    // Seconds are code-enforced per engine (dialogue=5|10, cinematic=8, support=5|10).
    // KINEO-HOLLYWOOD-21-2026-07-10 (bug a) — dialogue duration follows the LINE,
    // computed IN CODE from the word count: a short line on a 10s Kling clip left
    // the person speaking ~4s and staring in silence for the remaining 6s.
    // ≤14 words fits a 5s clip; ≥15 words gets the full 10s. Cost is computed
    // from these final seconds below (never from the model's own numbers).
    // KINEO-HOLLYWOOD-22-2026-07-10 — support scenes now render on Kling 3,
    // which only produces 5s or 10s clips: snap the planned seconds to 5|10 so
    // the plan/cost estimate matches what fal actually bills.
    const rawSec = Number(rs.seconds)
    const dialogueWords = (dialogueLine ?? '').split(/\s+/).filter(Boolean).length
    const seconds =
      type === 'dialogue'
        ? dialogueWords > 0 && dialogueWords <= 14
          ? 5
          : 10
        : type === 'cinematic'
          ? 8
          : Number.isFinite(rawSec) && rawSec <= 6
            ? 5
            : 10

    // KINEO-HOLLYWOOD-21-2026-07-10 (bug d) — zero readable text, code-enforced
    // on EVERY scene prompt (Kling 3 renders on-screen text in Chinese).
    // KINEO-HOLLYWOOD-22-2026-07-10 — the shared styleSheet rides VERBATIM at
    // the end of EVERY scene prompt (all engines) so Kling 3 and Veo render the
    // same photography; the NO_TEXT rule stays LAST (strongest position).
    // KINEO-HOLLYWOOD-23-2026-07-10 (bug h) — non-dialogue inserts additionally
    // get the stable-composition suffix (no dutch angles), code-enforced.
    prompt = `${prompt} Cinematography (match exactly): ${styleSheet}.${type !== 'dialogue' ? STABLE_SHOT_SUFFIX : ''}${NO_TEXT_SUFFIX}`

    const caption =
      (typeof rs.caption === 'string' && rs.caption.trim()
        ? sanitizeRealPeople(rs.caption.trim())
        : (dialogueLine ?? voiceover ?? prompt).split(/\s+/).slice(0, 6).join(' ')
      ).slice(0, 60)

    outScenes.push({
      index: outScenes.length + 1,
      type,
      beat,
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
  // KINEO-HOLLYWOOD-22 — shrink floor is 5 (Kling 3 min clip; buildFalInput
  // snaps ≤6s to a 5s clip, so a 5s plan bills exactly 5s).
  let total = outScenes.reduce((s, sc) => s + sc.seconds, 0)
  while (total > 60 && outScenes.length > 2) {
    const last = outScenes[outScenes.length - 1]
    if (last.type === 'support' && last.seconds > 5) {
      const shrink = Math.min(last.seconds - 5, total - 60)
      last.seconds -= shrink
      total -= shrink
      if (total <= 60) break
    }
    outScenes.pop()
    total = outScenes.reduce((s, sc) => s + sc.seconds, 0)
  }

  // KINEO-HOLLYWOOD-22-2026-07-10 — viral-structure validation, code-enforced:
  // the video MUST open on a HOOK and close on a PAYOFF (founder feedback on
  // the 3 real renders: "não teve HOOK, não teve desfecho final" — the one
  // thing AI Gen always gets right). If GPT mislabeled the beats — or the
  // ≤60s fit above dropped the PAYOFF scene — reassign ALL beats by position:
  // simple, deterministic fallback (1=HOOK, 2=MICRO_REWARD, last=PAYOFF,
  // middle=ESCALATION).
  if (outScenes[0].beat !== 'HOOK' || outScenes[outScenes.length - 1].beat !== 'PAYOFF') {
    outScenes.forEach((sc, i) => {
      sc.beat =
        i === 0 ? 'HOOK' : i === outScenes.length - 1 ? 'PAYOFF' : i === 1 ? 'MICRO_REWARD' : 'ESCALATION'
    })
  }

  // KINEO-HOLLYWOOD-23-2026-07-10 (bug g) — ZERO SILENT SECONDS, code-enforced
  // (never trust GPT): founder's round-3 render had a phone support scene at
  // ~5-12s with NO speech over it, and a mute Manhattan closer. EVERY
  // non-dialogue scene MUST narrate. If the planner skipped the voiceover or
  // wrote a stub (fewer than MIN_NARRATION_WORDS words), build a deterministic
  // fallback: the next UNUSED sentence(s) of the original script/idea, sized
  // to ~2.3 words/s of the scene; last resort = beat-aware expansion of the
  // scene caption. voiceover is NEVER left empty, and needsNarration is TRUE
  // for every non-dialogue scene (compose then always emits a TTS block).
  {
    const usedText = normalizeForMatch(
      outScenes.map((s) => `${s.dialogueLine ?? ''} ${s.voiceover ?? ''}`).join(' '),
    )
    const unusedSentences = splitIntoNarrationSentences(voiceoverScript || idea).filter((sen) => {
      const key = normalizeForMatch(sen).slice(0, 60)
      return key.length >= 12 && !usedText.includes(key)
    })

    for (const sc of outScenes) {
      if (sc.type === 'dialogue') continue
      const existing = (sc.voiceover ?? '').trim()
      const existingWords = existing.split(/\s+/).filter(Boolean).length
      if (existingWords < MIN_NARRATION_WORDS) {
        const targetWords = Math.max(MIN_NARRATION_WORDS, Math.round(sc.seconds * NARRATION_WORDS_PER_SECOND))
        // Keep a usable stub as the opening, then extend with unused script lines.
        const parts: string[] = existingWords >= 3 ? [existing] : []
        let count = existingWords >= 3 ? existingWords : 0
        while (count < targetWords && unusedSentences.length > 0) {
          const next = unusedSentences.shift() as string
          parts.push(next)
          count += next.split(/\s+/).filter(Boolean).length
        }
        if (parts.length === 0) {
          // Deterministic last resort: expand the scene caption by its beat.
          const lead =
            sc.beat === 'PAYOFF'
              ? 'And that is the real answer:'
              : sc.beat === 'MICRO_REWARD'
                ? 'Here is the first proof:'
                : 'And it gets even bigger:'
          parts.push(`${lead} ${sc.caption || 'this story is not over yet'}.`)
        }
        sc.voiceover = sanitizeRealPeople(parts.join(' ')).slice(0, 400)
      }
      sc.needsNarration = true // non-dialogue => ALWAYS narrated (KINEO-HOLLYWOOD-23)
    }
  }

  // Cost is computed IN CODE (never trust the model's arithmetic).
  const estimatedCostUsd =
    Math.round(outScenes.reduce((s, sc) => s + sc.seconds * HOLLYWOOD_USD_PER_SECOND[sc.type], 0) * 100) / 100

  return { characterSheet, environmentSheet, styleSheet, scenes: outScenes, estimatedCostUsd }
}

// ── Cost logging ─────────────────────────────────────────────────────────────
export function logHollywoodCost(generationId: string, scenes: HollywoodScene[]): void {
  let total = 0
  for (const s of scenes) {
    const usd = s.seconds * HOLLYWOOD_USD_PER_SECOND[s.type]
    total += usd
    console.log(
      `[hollywood-cost] gen=${generationId} scene=${s.index} type=${s.type} beat=${s.beat} model=${HOLLYWOOD_MODELS[s.type]} sec=${s.seconds} usd=${usd.toFixed(2)}`,
    )
  }
  console.log(`[hollywood-cost] gen=${generationId} TOTAL usd=${total.toFixed(2)}`)
}
