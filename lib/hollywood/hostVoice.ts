// KINEO-HOLLYWOOD-HOST-2026-07-13 — HOLLYWOOD HOST MODE v3.5: one voice.
//
// The #1 defect left in Hollywood 3.0 (founder score 9): dialogue scenes run
// on Kling O3 i2v with generate_audio:true and the spoken line quoted inside
// the prompt — Kling invents a NEW random voice PER SCENE, so the same
// anchored presenter (same face, same world) speaks with a different voice in
// every scene he appears in. v3.5 fixes it by synthesizing every host line
// with OUR TTS (the same engine that narrates the b-roll) and lip-syncing it
// onto the canonical portrait via Kling AI Avatar v2 (the proven AI Presenter
// engine) — one voice for the whole film, host and narrator alike.
//
// WHY THIS FILE EXISTS (instead of reusing generateTTS directly): the voice
// must be identical across TWO routes that never talk to each other at
// runtime — /api/generate-video-cinematic synthesizes the HOST lines at
// submit time, and /api/compose synthesizes the b-roll NARRATION minutes
// later. generateTTS() re-selects a persona PER CALL by keyword-scanning the
// text it is given, so two different texts can land on two different voices.
// The fix: resolve the persona ONCE from the FULL video script (the exact
// same voiceover_script string both routes see — the cinematic route creates
// it and compose receives it verbatim from the client), then force that one
// voice on every synthesis. Deterministic input → deterministic persona →
// guaranteed voice match across both routes.
//
// FAIL-SAFE: both helpers are pure/self-contained. Callers wrap them in
// try/catch and fall back to the current behavior (Kling native audio on the
// route side, per-scene generateTTS persona on the compose side) — v3.5 can
// never kill a render that works today.
import { selectPersonaForScript } from '@/lib/narration/niche-mapping'
import type { OpenAIVoice } from '@/lib/narration/personas'
import { stripScriptMarkers } from '@/lib/scriptParser'
import { PRESENTER_PERFORMANCE_PROMPT } from '@/lib/avatar/veed'

export type HollywoodVoice = {
  personaId: string
  voice: OpenAIVoice
  /** The persona's natural pace (0.7–1.3) — multiplied by any user speed. */
  defaultSpeed: number
}

/**
 * Resolve THE narrator voice for a whole Hollywood video from its full
 * script text. Pure and deterministic: the same (script, language, vertical)
 * always yields the same persona, which is what lets the cinematic route and
 * the compose route agree on the voice without ever exchanging it.
 * stripScriptMarkers is applied here (idempotent) so it does not matter
 * whether the caller passes the raw or the already-stripped script — compose
 * strips at its boundary, the cinematic route does not.
 */
export function resolveHollywoodVoice(
  script: string,
  language: 'en' | 'pt' | 'es' = 'en',
  vertical?: string,
): HollywoodVoice {
  const cleaned = stripScriptMarkers(String(script ?? ''))
  // Hollywood is the premium engine — always resolve at the cinematic tier,
  // exactly like compose's narrationTier for quality === 'cinematic_hollywood'.
  const persona = selectPersonaForScript(cleaned, vertical, 'cinematic', language)
  return { personaId: persona.id, voice: persona.voice, defaultSpeed: persona.defaultSpeed }
}

/**
 * Single-pass TTS with a FORCED voice — the pinned-voice counterpart of
 * generateTTS()'s single-pass branch (same model, same input cap, same speed
 * clamp). No persona re-selection, no section modulation: host lines and
 * per-scene narration blocks are short single-thought texts, and re-selecting
 * anything here is exactly the bug this file exists to kill.
 * Throws on failure — callers catch and fall back.
 */
export async function synthesizeHostSpeech(args: {
  text: string
  voice: OpenAIVoice
  speed?: number
}): Promise<Buffer> {
  const cleaned = stripScriptMarkers(String(args.text ?? ''))
  if (!cleaned.trim()) throw new Error('empty host speech text')
  const input = cleaned.length > 3800 ? cleaned.slice(0, 3800) : cleaned
  const safeSpeed = Math.max(
    0.7,
    Math.min(1.3, Number.isFinite(args.speed) && (args.speed as number) > 0 ? (args.speed as number) : 1.0),
  )
  const { openai } = await import('@/lib/openai')
  const speech = await openai.audio.speech.create({
    model: 'tts-1-hd',
    voice: args.voice,
    input,
    speed: safeSpeed,
  })
  const buf = Buffer.from(await speech.arrayBuffer())
  if (!buf || buf.length === 0) throw new Error('TTS returned an empty buffer')
  return buf
}

/**
 * The performance prompt for a Hollywood host scene on Kling AI Avatar v2:
 * the AI Presenter gesture direction (already validated in production —
 * KINEO-PRESENTER-MOTION) plus the plan's characterSheet/styleSheet so the
 * avatar clip keeps the same person and the same photography as every other
 * anchored scene. Sheets arrive already sanitized (sanitizeRealPeople ran in
 * the planner), so the anti-deepfake guarantee carries through unchanged.
 */
export function buildHostPerformancePrompt(characterSheet: string, styleSheet: string): string {
  const character = String(characterSheet ?? '').trim()
  const style = String(styleSheet ?? '').trim()
  return (
    PRESENTER_PERFORMANCE_PROMPT +
    (character ? ` The person (match exactly): ${character}.` : '') +
    (style ? ` Cinematography (match exactly): ${style}.` : '')
  ).slice(0, 1500)
}
