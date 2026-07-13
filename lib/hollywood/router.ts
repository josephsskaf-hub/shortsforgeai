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
// KINEO-HOLLYWOOD-24-2026-07-10 — round 4 (score ~8.5; one defect left: a 10s
// support scene of chart b-roll with NO audible narration — the real TTS came
// out shorter than the planned block and the leftover silence landed there):
//   (i) SUPPORT SIZED BY NARRATION — support scenes get their seconds from the
//       FINAL voiceover word count (<16 words → 5s, ≥16 → 10s), applied AFTER
//       the v2.3 narration fallback; the clip never outlasts its words.
//       Cinematic stays fixed at 8s (Veo).
//   (j) MAX 1 LONG B-ROLL IN A ROW — two adjacent non-dialogue scenes must not
//       BOTH be 10s (a >10s wall of b-roll kills retention); the second drops
//       to 5s and its narration is trimmed to fit, whole sentences first.
//   (compose side: one TTS mp3 PER narrated SCENE instead of per block — see
//    app/api/compose/route.ts + buildHollywoodCreatomateSource endCap.)
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
//
// KINEO-HOLLYWOOD-HOST-2026-07-13 — HOLLYWOOD HOST MODE v3.5 (3 upgrades):
//   (1) ONE HOST VOICE — anchored dialogue scenes render on Kling AI Avatar v2
//       (portrait anchor + OUR TTS of the line) instead of O3 native audio,
//       killing the random-voice-per-scene defect. Lives in the route +
//       lib/hollywood/hostVoice.ts; here only the cost log learns the model.
//   (2) DEMO/SHOWCASE BEAT — when the topic is a product/site/app/tool, the
//       planner adds 1-2 'support' scenes that DEMONSTRATE the subject in use
//       (hands/interface b-roll, no readable text). Flagged `isDemo` so the
//       route can swap in the user's own clips once compose supports it.
//   (3) HOOK & PAYOFF ON CAMERA — code-enforced after planning: the first
//       (HOOK) and last (PAYOFF) scenes MUST be dialogue (host speaking to
//       the lens); other types are converted, narration becomes the line.

import { openai } from '@/lib/openai'
// KINEO-HOLLYWOOD-HOST-2026-07-13 — the host-scene engine (Kling AI Avatar
// v2, $0.0562/s — ~1/3 of O3's $0.168/s) so logHollywoodCost prices anchored
// dialogue scenes correctly. lib→lib import, no cycle (veed.ts imports only
// the fal client + falAlert).
import { PRESENTER_MODEL, PRESENTER_USD_PER_SECOND } from '@/lib/avatar/veed'

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

// KINEO-HOLLYWOOD-30-2026-07-10 — HOLLYWOOD 3.0 "UM MUNDO": when the two image
// anchors exist (lib/hollywood/anchors.ts), EVERY scene renders on Kling O3
// Pro IMAGE-to-video instead of the per-type t2v models above: dialogue scenes
// are seeded with the canonical presenter PORTRAIT (same face every scene) and
// support/cinematic scenes with the empty ENVIRONMENT still (same world every
// cut). HOLLYWOOD_MODELS stays as the fail-open t2v fallback path (v2.4).
// Confirmed params: { image_url, prompt, duration: '3'..'15' (string),
// generate_audio: true } — it is `image_url`, NOT `start_image_url`.
export const KLING3_I2V_MODEL = 'fal-ai/kling-video/o3/pro/image-to-video'
// fal pricing jul/2026: Kling O3 Pro i2v audio-on $0.168/s (same rate as the
// t2v dialogue/support scenes — the anchored look costs nothing extra per
// second; only the ~$0.10 anchor images are added on top).
export const KLING3_I2V_USD_PER_SECOND = 0.168

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
  // KINEO-HOLLYWOOD-HOST-2026-07-13 (item 2) — TRUE when this is a DEMO/
  // SHOWCASE support scene (product/app/site shown in use). Same render path
  // as any support scene; the flag lets the route prefer the user's own
  // footage for this scene once compose-side splicing lands. Optional →
  // every existing consumer is untouched.
  isDemo?: boolean
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

// KINEO-HOLLYWOOD-HOST-2026-07-13 (item 2) — code-enforced direction for DEMO
// scenes (never trust GPT to carry it): the shot must read as "the product in
// use" through ACTION and FRAMING, never through readable UI — Kling renders
// on-screen text in Chinese (KINEO-HOLLYWOOD-21 bug d), so screens stay
// stylized/blurred and the NO_TEXT rule keeps its last-position authority.
const DEMO_SHOT_SUFFIX =
  ' Product demonstration insert: close on hands actively using the product/device, over-the-shoulder or macro framing of the interaction, screens and interfaces rendered as soft glowing abstract shapes (blurred, stylized, unreadable).'

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

/** KINEO-HOLLYWOOD-24-2026-07-10 — trim a narration line down to ~maxWords,
 * keeping COMPLETE sentences when possible (drops whole trailing sentences
 * first; only hard-cuts mid-sentence when even the first sentence blows the
 * budget). Never returns empty for non-empty input. */
function trimNarrationToWords(text: string, maxWords: number): string {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim()
  const words = clean.split(' ').filter(Boolean)
  if (words.length <= maxWords) return clean
  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? []
  const kept: string[] = []
  let count = 0
  for (const raw of sentences) {
    const sen = raw.trim()
    if (!sen) continue
    const w = sen.split(/\s+/).filter(Boolean).length
    if (count > 0 && count + w > maxWords) break
    kept.push(sen)
    count += w
    if (count >= maxWords) break
  }
  const out = kept.join(' ').trim()
  // Small tolerance so one complete sentence beats a mid-sentence chop.
  if (out && count <= maxWords + 4) return out
  return words.slice(0, maxWords).join(' ')
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
- "support": a simpler establishing/detail b-roll shot (ambient sound only, nobody speaks on camera). 5 or 10 seconds. MUST carry a "voiceover" narration line (see NARRATION rule below). Size the scene to its narration, same rule as dialogue: a voiceover under 16 words → 5 seconds; 16 words or more → 10 seconds — the clip must never outlast its words. Composition: support scenes are classic, stable inserts — level horizon, well-composed tripod or slow-dolly shot, NEVER a tilted or dutch angle.

NARRATION (mandatory — ZERO silent seconds): EVERY "cinematic" and "support" scene MUST have a "voiceover". The narration continues the story OVER the b-roll — there must not be a single second of the video without spoken words, and each voiceover must PICK UP exactly where the previous spoken line (dialogue or narration) left off (content continuity, no resets, no filler). Size the voiceover to the scene: ~2.3 words per second — a 10-second scene needs 20-24 words, an 8-second scene 16-20 words, a 5-second scene 10-12 words.

VIRAL STRUCTURE (mandatory — the house timeline, every video follows it):
- HOOK (0-3s): scene 1 is ALWAYS the HOOK. The FIRST spoken sentence starts within 0.5 seconds of frame one and is a curiosity gap or shock built on a CONCRETE number (e.g. "This island kills 99% of the people who land on it."). Establishing context, greetings or scene-setting BEFORE the hook is FORBIDDEN.
- MICRO REWARD (3-8s): immediately deliver one satisfying, concrete fact that pays off the click — proof the video is worth watching.
- ESCALATION (8-20s, then 20-35s): each escalation raises the stakes with a STRONGER, more surprising fact than the scene before it.
- PAYOFF (35-50s): the final scene RESOLVES the open question the hook planted + lands a memorable closing line.
Label EVERY scene with its "beat": "HOOK" | "MICRO_REWARD" | "ESCALATION" | "PAYOFF". Scene 1 MUST have beat "HOOK"; the LAST scene MUST have beat "PAYOFF". The dialogue lines and narration lines EXECUTE these beats — they carry the hook, the reward, the escalations and the payoff in the actual spoken words.
HOOK AND PAYOFF ON CAMERA (mandatory): the HOOK scene (scene 1) and the PAYOFF scene (the last scene) are ALWAYS "dialogue" — the host speaks them straight into the lens. B-roll belongs in the middle of the video, never at its first or last words.

DEMO / SHOWCASE (only when the topic IS a specific product, app, website, tool or service — e.g. "explain Kineo", "why everyone uses this app"): include 1-2 "support" scenes that DEMONSTRATE the subject in use while the narration continues — close-up of hands actively using the device or product, over-the-shoulder shot of someone mid-interaction, macro details of the experience. The demonstration reads through ACTION and FRAMING only: screens/interfaces appear as soft glowing abstract shapes, blurred and unreadable (the zero-readable-text rule still applies). Mark these scenes with "demo": true. Demo scenes follow every other "support" rule (voiceover, sizing, stable composition). For any topic that is NOT a product/app/site/tool, output NO demo scenes.

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
- MAX 1 LONG B-ROLL IN A ROW: never place two adjacent non-dialogue scenes (cinematic/support) that are BOTH 10 seconds — more than ~10 straight seconds of b-roll kills retention. Break b-roll walls with a dialogue scene, or make the second insert 5 seconds.
- Total duration 45-60 seconds. 4 to 6 scenes. Zero dead frames — every second earns attention.
- ALL text in English regardless of the input language${language && language !== 'en' ? ` (the input may be in "${language}")` : ''}.
- NEVER name or depict a real person (no celebrities, politicians, athletes, historical figures). People are always fictional and generic.
- Each scene gets a short on-screen "caption" (max 6 words, punchy).

Output JSON shape ("demo" is optional, only on demo/showcase support scenes):
{"characterSheet":"...","environmentSheet":"...","styleSheet":"...","scenes":[{"index":1,"type":"dialogue","beat":"HOOK","seconds":10,"prompt":"...","dialogueLine":"...","caption":"..."},{"index":2,"type":"support","beat":"MICRO_REWARD","seconds":10,"prompt":"...","voiceover":"...","caption":"...","demo":true}]}`

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

    // KINEO-HOLLYWOOD-HOST-2026-07-13 (item 2) — DEMO scene flag. Only valid
    // on 'support' (demo IS a support scene, just with demonstration framing);
    // a stray "demo":true on dialogue/cinematic is ignored (fail-open).
    const isDemo = type === 'support' && rs.demo === true

    // KINEO-HOLLYWOOD-21-2026-07-10 (bug d) — zero readable text, code-enforced
    // on EVERY scene prompt (Kling 3 renders on-screen text in Chinese).
    // KINEO-HOLLYWOOD-22-2026-07-10 — the shared styleSheet rides VERBATIM at
    // the end of EVERY scene prompt (all engines) so Kling 3 and Veo render the
    // same photography; the NO_TEXT rule stays LAST (strongest position).
    // KINEO-HOLLYWOOD-23-2026-07-10 (bug h) — non-dialogue inserts additionally
    // get the stable-composition suffix (no dutch angles), code-enforced.
    // KINEO-HOLLYWOOD-HOST-2026-07-13 — demo scenes get the demonstration
    // direction suffix (code-enforced; rides BEFORE the NO_TEXT rule so the
    // "screens are abstract/unreadable" instruction keeps final authority).
    prompt = `${prompt} Cinematography (match exactly): ${styleSheet}.${type !== 'dialogue' ? STABLE_SHOT_SUFFIX : ''}${isDemo ? DEMO_SHOT_SUFFIX : ''}${NO_TEXT_SUFFIX}`

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
      ...(isDemo ? { isDemo: true } : {}), // KINEO-HOLLYWOOD-HOST-2026-07-13 (item 2)
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

  // KINEO-HOLLYWOOD-HOST-2026-07-13 (item 3) — HOOK AND PAYOFF ON CAMERA,
  // code-enforced (the prompt asks too, but never trust GPT): the FIRST scene
  // (beat HOOK, guaranteed by the beat validation above) and the LAST scene
  // (beat PAYOFF, same guarantee) must be 'dialogue' — the host opens and
  // closes the video speaking straight into the lens. When the planner routed
  // either one to support/cinematic, we convert it HERE: its narration becomes
  // the host's spoken line (trimmed to the 30-word dialogue ceiling, whole
  // sentences first), seconds re-follow the line-length rule (≤14 words → 5s,
  // else 10s), and the prompt is rebuilt as an on-camera host shot from the
  // plan's own sheets. Placed AFTER the narration fallback on purpose — every
  // non-dialogue scene is GUARANTEED a voiceover by then, so the conversion
  // always has real words to put in the host's mouth. Fail-open: a scene
  // whose narration is too thin to speak (<4 words) keeps its original type.
  {
    const forceHostOnCamera = (sc: HollywoodScene): void => {
      if (sc.type === 'dialogue') return
      const source = (sc.voiceover ?? '').trim() || (sc.caption ?? '').trim()
      const line = trimNarrationToWords(source, 30).slice(0, 220)
      const lineWords = line.split(/\s+/).filter(Boolean).length
      if (lineWords < 4) {
        console.warn(
          `[hollywood-planner] KINEO-HOLLYWOOD-HOST — scene ${sc.index} (beat=${sc.beat}) kept as ${sc.type}: narration too thin to convert to dialogue`,
        )
        return
      }
      const prevType = sc.type
      sc.type = 'dialogue'
      sc.dialogueLine = line
      sc.seconds = lineWords <= 14 ? 5 : 10
      sc.voiceover = undefined
      sc.needsNarration = false // dialogue => false ALWAYS (KINEO-HOLLYWOOD-23)
      // Rebuilt from the plan's own sanitized sheets — same skeleton as a
      // planner-native dialogue prompt (sheets first, quoted line, realism
      // directives, styleSheet, NO_TEXT last). No STABLE_SHOT/DEMO suffixes:
      // this is now a person shot, not an insert.
      sc.prompt = `${characterSheet}. Standing in: ${environmentSheet}. Medium shot, 9:16 vertical framing — looking straight into the lens, the person says: "${sc.dialogueLine}" The person speaks continuously and energetically for the entire shot, no dead air, ${REALISM_DIRECTIVES}. Cinematography (match exactly): ${styleSheet}.${NO_TEXT_SUFFIX}`
      console.log(
        `[hollywood-planner] KINEO-HOLLYWOOD-HOST — scene ${sc.index} (beat=${sc.beat}) converted ${prevType} → dialogue (host on camera, ${lineWords} words → ${sc.seconds}s)`,
      )
    }
    forceHostOnCamera(outScenes[0])
    forceHostOnCamera(outScenes[outScenes.length - 1])
  }

  // KINEO-HOLLYWOOD-24-2026-07-10 (i) — support scenes SIZED BY THEIR FINAL
  // narration (post-fallback), same rule as dialogue lines: <16 words → 5s,
  // ≥16 → 10s (Kling 3 only renders 5s/10s; cinematic stays fixed at 8s/Veo).
  // Round-4 defect: a 10s support scene whose narration ran out ended as chart
  // b-roll with no voice — the clip must never outlast its words.
  for (const sc of outScenes) {
    if (sc.type !== 'support') continue
    const words = (sc.voiceover ?? '').split(/\s+/).filter(Boolean).length
    sc.seconds = words < 16 ? 5 : 10
  }

  // KINEO-HOLLYWOOD-24-2026-07-10 (j) — MAX 1 long b-roll in a row, code-
  // enforced (the prompt asks too, but never trust GPT): two adjacent
  // non-dialogue scenes must not BOTH be 10s. The SECOND drops to 5s and its
  // narration is trimmed to ~5s of words, whole sentences kept when possible.
  const SHORT_SUPPORT_WORDS = Math.round(5 * NARRATION_WORDS_PER_SECOND) // ≈12
  for (let i = 1; i < outScenes.length; i++) {
    const prev = outScenes[i - 1]
    const cur = outScenes[i]
    if (prev.type === 'dialogue' || cur.type === 'dialogue') continue
    if (prev.seconds < 10 || cur.seconds < 10) continue
    cur.seconds = 5
    if (cur.voiceover) cur.voiceover = trimNarrationToWords(cur.voiceover, SHORT_SUPPORT_WORDS)
  }

  // Re-fit ≤60s after the resizes above (a 5s→10s support upsize can
  // overflow the earlier fit): shrink trailing 10s support scenes to 5s
  // (trimming their narration to match) until the timeline fits — never
  // drop a whole beat at this stage.
  {
    let fitted = outScenes.reduce((s, sc) => s + sc.seconds, 0)
    for (let i = outScenes.length - 1; i >= 0 && fitted > 60; i--) {
      const sc = outScenes[i]
      if (sc.type !== 'support' || sc.seconds <= 5) continue
      sc.seconds = 5
      if (sc.voiceover) sc.voiceover = trimNarrationToWords(sc.voiceover, SHORT_SUPPORT_WORDS)
      fitted = outScenes.reduce((s, x) => s + x.seconds, 0)
    }
  }

  // Cost is computed IN CODE (never trust the model's arithmetic).
  const estimatedCostUsd =
    Math.round(outScenes.reduce((s, sc) => s + sc.seconds * HOLLYWOOD_USD_PER_SECOND[sc.type], 0) * 100) / 100

  return { characterSheet, environmentSheet, styleSheet, scenes: outScenes, estimatedCostUsd }
}

// ── Cost logging ─────────────────────────────────────────────────────────────
// KINEO-HOLLYWOOD-30-2026-07-10 — optional per-scene `models` (parallel to
// `scenes`) + flat `anchorsUsd`: on the anchored 3.0 path every scene runs on
// KLING3_I2V_MODEL ($0.168/s regardless of type) and the two anchor images add
// ~$0.10 to the TOTAL. Both optional → v2.4 callers stay byte-identical.
// KINEO-HOLLYWOOD-HOST-2026-07-13 — host scenes run on Kling AI Avatar v2
// ($0.0562/s, ~1/3 of O3) + one flat TTS/upload cost per line (~pennies,
// covered by the anchorsUsd-style rounding); the per-scene lookup prices the
// presenter model so the [hollywood-cost] TOTAL reflects the real per-scene
// engine mix instead of assuming O3 everywhere.
export function logHollywoodCost(
  generationId: string,
  scenes: HollywoodScene[],
  opts?: { models?: string[]; anchorsUsd?: number },
): void {
  let total = 0
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i]
    const model = opts?.models?.[i] ?? HOLLYWOOD_MODELS[s.type]
    const perSecond =
      model === PRESENTER_MODEL
        ? PRESENTER_USD_PER_SECOND
        : model === KLING3_I2V_MODEL
          ? KLING3_I2V_USD_PER_SECOND
          : HOLLYWOOD_USD_PER_SECOND[s.type]
    const usd = s.seconds * perSecond
    total += usd
    console.log(
      `[hollywood-cost] gen=${generationId} scene=${s.index} type=${s.type} beat=${s.beat} model=${model} sec=${s.seconds} usd=${usd.toFixed(2)}`,
    )
  }
  const anchorsUsd = opts?.anchorsUsd ?? 0
  if (anchorsUsd > 0) {
    total += anchorsUsd
    console.log(`[hollywood-cost] gen=${generationId} anchors usd=${anchorsUsd.toFixed(2)}`)
  }
  console.log(`[hollywood-cost] gen=${generationId} TOTAL usd=${total.toFixed(2)}`)
}
