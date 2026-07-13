// NOTE: do NOT statically `import { openai } from '@/lib/openai'` here.
// The compose-status route only needs the Creatomate helpers and we don't
// want to trigger OpenAI client instantiation (which reads OPENAI_API_KEY at
// module load) when it isn't needed. The TTS / script-scaling functions
// dynamically import it below.

import { toFile } from 'openai'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildCaptionSegments, pickHighlightWord, type CaptionSegment } from '@/lib/openai'
import { stripScriptMarkers } from '@/lib/scriptParser'
import { selectPersonaForScript, describeVoiceSelection } from '@/lib/narration/niche-mapping'
import { splitIntoSections, hasViralSections } from '@/lib/narration/section-tts'

const CREATOMATE_BASE = 'https://api.creatomate.com/v1'
const CTA_TEXT = 'usekineo.com'
const CTA_TAIL_SECONDS = 2.5
// Push #293 — Background music volume. 18% keeps the phonk audible and
// energetic without competing with the narrator. InVideo uses 15-20% range.
const MUSIC_VOLUME = '18%'
// Push #064 — yellow used for the per-caption highlight word overlay.
const HIGHLIGHT_COLOR = '#FFD700'

// ── Fast Mode v2 (02/07) — ALL constants below are GATED to quality==='fast'
// (free stock pipeline). AI Gen / avatar / legacy modes keep their exact
// pre-existing pacing, animation and caption behavior. Easy to tune here.
// (a) RITMO — cut cadence band: each clip slot lasts 2.5–4s (viral edit rhythm).
const FAST_MIN_CUT_SECONDS = 2.5
const FAST_MAX_CUT_SECONDS = 4
// (b) MOVIMENTO — Ken Burns pattern cycled per cut: center push-in, pull-back,
// then off-center push-ins (anchored left/right) that read as subtle lateral
// pans. Same proven Creatomate 'scale' animation type as #292, only varied.
const FAST_KEN_BURNS_PATTERN = [
  { from: '100%', to: '108%', xAnchor: '50%' }, // push-in, centered
  { from: '108%', to: '100%', xAnchor: '50%' }, // pull-back, centered
  { from: '100%', to: '110%', xAnchor: '38%' }, // push-in anchored left → pan-right feel
  { from: '100%', to: '110%', xAnchor: '62%' }, // push-in anchored right → pan-left feel
] as const
// (d) LEGENDAS — caption chunks carrying money/percent/big-number/power words
// render the WHOLE 3-word line in HIGHLIGHT_COLOR (yellow pop); rest stay white.
// Whole-line color (not per-word layering) on purpose — see #277 regression note.
const FAST_EMPHASIS_RE =
  /(\$[\d.,]+|\d+(\.\d+)?%|\b\d{3,}\b|\b(million|billion|trillion|secret|never|banned|hidden|illegal|forbidden|richest|poorest|deadliest|shocking|insane|free)\b)/i
// Push #049 — bucket name lives here so we never typo it across the
// upload + URL-build code paths. If we ever rename the bucket, change
// this single constant.
export const VOICEOVER_BUCKET = 'voiceovers' // (feature/ai-avatar touches this module)

export interface ComposeInputs {
  clipUrls: string[]
  voiceoverUrl: string
  /**
   * The narration text that the captions should be derived from. Push #031
   * fixed caption sync — captions are now segments of the actual spoken
   * script (one sentence per segment) rather than the visual scene
   * descriptions, so what the viewer reads matches what the narrator says.
   */
  voiceoverScript: string
  /**
   * Legacy: short caption strings (typically derived from scene visual
   * prompts). Used ONLY as a fallback when `voiceoverScript` is empty or
   * cannot be segmented.
   */
  sceneCaptions: string[]
  duration: number
  /**
   * Push #445 — render quality/engine ('fast' | 'cinematic_ai' | 'cinematic_kling' | ...).
   * Controls clip pacing: AI-generated clips are unique ~10s generations, so each
   * one is allowed to fill up to ~10s (so 6–9 clips cover a 60–90s video with NO
   * repetition). Fast stock keeps the tighter 6s slots for frequent cuts. Optional;
   * falls back to Fast pacing when absent.
   */
  quality?: string
  /**
   * Push #158 — real measured duration (seconds) of the generated TTS mp3.
   * The caption window is sized to this instead of the requested duration,
   * which assumed a fixed 2.5 words/sec pace the real audio never matched.
   * Optional: when absent the window falls back to the requested duration.
   */
  realAudioDuration?: number
  /**
   * Push #175 — optional pre-computed word-level timing from Whisper
   * transcription. Each entry aligns with the corresponding caption segment
   * produced by buildCaptionSegments(voiceoverScript, 7). When present, the
   * caption builder uses these exact timestamps instead of the proportional
   * word-count approximation, eliminating caption/narrator desync.
   * @deprecated in Push #258 — prefer whisperWords for drift-free captions
   */
  whisperTimings?: Array<{ time: number; duration: number }>
  /**
   * Push #258 — raw Whisper word-level timestamps. When present, captions are
   * built DIRECTLY from these words (grouped into ≤7-word chunks) rather than
   * mapping script-text segments to Whisper timing. This eliminates the word-
   * count drift bug where numbers spoken differently by TTS (e.g. "63%" as
   * "sixty three percent") caused captions to desync from the narrator's voice.
   */
  whisperWords?: WhisperWord[]
  /**
   * Push #293 — Optional background music URL (Pixabay phonk/motivational).
   * When present, added as track 8 at MUSIC_VOLUME volume, looping under the
   * voiceover for the full video duration. Volume is kept low so the narrator
   * stays clear and dominant.
   */
  musicUrl?: string | null
  /**
   * #384 — when true, burn a "ShortsForgeAI" watermark into the final render.
   * Used ONLY for the free AI-Generate trial; paid renders pass false/undefined.
   * The decision is made server-side in /api/compose (never trusts the client).
   */
  watermark?: boolean
  /**
   * #482 — when true, append a "Made with ShortsForgeAI" end card in the final
   * CTA window. Option A: shown on FREE + Starter renders (every posted video
   * becomes an ad — the Loom/CapCut viral loop); clean on Creator/Studio.
   * Decision made server-side in /api/compose (never trusts the client).
   */
  endCard?: boolean
  /**
   * AI Avatar (feature/ai-avatar) — public URL of the VEED Fabric talking-head
   * MP4. When present the avatar becomes the MAIN video track (muted — the
   * voiceover track stays the single audio source; VEED lip-synced to that
   * exact mp3, so starting both at t=0 keeps lips and audio in sync) and the
   * stock clips become periodic full-frame CUTAWAYS instead of the base
   * timeline. Captions / CTA / music / watermark behave exactly as usual.
   */
  avatarUrl?: string | null
  /**
   * Face-app wave 1 (12/06) — Hook Avatar mode. When set (> 2), the avatar MP4
   * covers ONLY [0, avatarHookSeconds] (it was lip-synced to a byte-slice of
   * the narration head, so lips stay locked) and the stock clips tile the rest
   * of the timeline exactly like the standard mode. null/undefined = the
   * legacy full-length avatar with periodic cutaways.
   */
  avatarHookSeconds?: number | null
}

export interface CreatomateRenderState {
  status: 'planned' | 'waiting' | 'transcribing' | 'rendering' | 'succeeded' | 'failed' | 'cancelled' | 'unknown'
  progress: number
  url: string | null
  snapshotUrl: string | null
  error: string | null
}

// Push #234 — calibrated to the REAL TTS pace. OpenAI tts-1 (onyx) speaks at
// ~4.0 words/second, so a script must contain ~duration × 4.0 words for the
// narration to actually fill the requested duration. The old 2.5 wps figure
// produced scripts that finished ~40% early, which (because the final video
// length tracks the audio length) made every "45s" video come out ~27s.
// Keep this in lockstep with durationPlanFor() in lib/openai.ts so the
// analyze-idea script and the scale target agree (and scaleVoiceoverScript's
// ±15% short-circuit usually skips an extra rewrite).
// Push #295 — recalibrated to tts-1-hd actual pace (~3.1 wps).
// Push #292 upgraded the TTS model from tts-1 → tts-1-hd but this constant
// was never updated. tts-1-hd speaks noticeably slower (~3.1 wps vs ~4.0 wps),
// so scripts sized at 4.0 wps were ~29% too long → every "45s" video came out
// ~1:06. Dropping to 3.1 keeps generated audio in the requested window.
const TTS_WORDS_PER_SECOND = 3.1
export function targetWordCount(duration: number): number {
  const seconds = Math.max(5, Math.min(120, Math.round(duration)))
  return Math.round(seconds * TTS_WORDS_PER_SECOND)
}

/**
 * Rewrite a voiceover script so it lands close to the target word count.
 * Falls back to a hard word-slice if the model call fails — we never want
 * compose to die because of a script-scaling step.
 */
export async function scaleVoiceoverScript(rawScript: string, targetWords: number): Promise<string> {
  const cleanInput = (rawScript ?? '').trim()
  if (!cleanInput) return ''

  const words = cleanInput.split(/\s+/).filter(Boolean)
  // If already close to target (±15%), don't bother round-tripping to OpenAI.
  const lo = Math.floor(targetWords * 0.85)
  const hi = Math.ceil(targetWords * 1.15)
  if (words.length >= lo && words.length <= hi) return cleanInput

  try {
    const { openai } = await import('@/lib/openai')
    const completion = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a viral short-form scriptwriter. You rewrite scripts to a precise word count while keeping the hook, the core idea, and a strong CTA. Reply with the script text only — no quotes, no markdown.',
          },
          {
            role: 'user',
            content: `Rewrite this voiceover script so it reads as ${targetWords} words (±5%). Keep the hook in the first sentence, the payoff in the middle, and end with a strong payoff line. Plain prose only — no scene labels, no stage directions.\n\nSCRIPT:\n${cleanInput}`,
          },
        ],
        temperature: 0.7,
        max_tokens: Math.min(800, Math.max(120, targetWords * 4)),
      },
      { timeout: 20000 }
    )
    const scaled = completion.choices[0]?.message?.content?.trim() ?? ''
    if (scaled) return scaled
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[compose] scaleVoiceoverScript failed, falling back:', msg)
  }

  // Fallback — naive truncate / pad.
  if (words.length > targetWords) return words.slice(0, targetWords).join(' ')
  return cleanInput
}

// Push #234 — `speed` lets the compose route nudge narration length to the
// requested duration after measuring the first pass. tts-1 accepts 0.25–4.0
// (1.0 = natural). duration scales as 1/speed, so speed<1 lengthens and
// speed>1 shortens. We clamp to a natural-sounding band before sending.
//
// Narration Engine (Phase 1) — `vertical` enables automatic persona selection.
// When provided, generateTTS picks the OpenAI TTS voice and base speed that
// best match the content niche (mystery→onyx slow, finance→onyx normal,
// curiosities→fable fast, geography→echo measured, etc.).
// When absent, falls back to the legacy onyx/1.0 behaviour.
export async function generateTTS(
  script: string,
  speed = 1.0,
  vertical?: string,
  userTier: 'free' | 'premium' | 'cinematic' = 'free',
  language: 'en' | 'pt' | 'es' = 'en',
): Promise<Buffer> {
  // Push #236 — last line of defense: strip any residual script markers /
  // directives so the narrator can never speak "[Pexels: ...]" or a "speed:"
  // line, no matter what upstream produced `script`. Idempotent on clean text.
  const cleaned = stripScriptMarkers(script)

  // ── Phase 1: Narration Engine — persona-driven voice + speed ──────────────
  let resolvedVoice: 'alloy' | 'echo' | 'fable' | 'nova' | 'onyx' | 'shimmer' = 'onyx'
  let baseSpeed = speed

  if (vertical) {
    const persona = selectPersonaForScript(cleaned, vertical, userTier, language)
    resolvedVoice = persona.voice
    baseSpeed = persona.defaultSpeed * speed
    console.log(
      `[compose] Narration Engine: ${describeVoiceSelection(cleaned, vertical, userTier, language)}`,
    )

    // ── Phase 2: Section-level speed modulation ────────────────────────────
    // When the script has HOOK/MICRO REWARD/ESCALATION/PAYOFF markers, TTS
    // each section at its own speed (hook fast, payoff slow) and concatenate
    // the raw MP3 frames. Falls back to single-pass if no markers detected.
    if (hasViralSections(script)) {
      const sections = splitIntoSections(script, persona)
      if (sections && sections.length >= 2) {
        console.log(
          `[compose] Phase 2 sectioned TTS: ${sections.length} sections`,
          sections.map((s) => `${s.type}×${s.speedMultiplier.toFixed(2)}`).join(', '),
        )
        const { openai } = await import('@/lib/openai')
        const buffers: Buffer[] = []
        for (const section of sections) {
          // section speed = persona.defaultSpeed × sectionMultiplier × corrective(speed)
          const sectionSpeed = persona.defaultSpeed * section.speedMultiplier * speed
          const safeSection = Math.max(0.7, Math.min(1.3, sectionSpeed))
          const input = section.text.length > 3800 ? section.text.slice(0, 3800) : section.text
          const speech = await openai.audio.speech.create({
            model: 'tts-1-hd',
            voice: resolvedVoice,
            input,
            speed: safeSection,
          })
          buffers.push(Buffer.from(await speech.arrayBuffer()))
        }
        return Buffer.concat(buffers)
      }
    }
  }

  // ── Single-pass TTS (no vertical, or no sections detected) ────────────────
  const input = cleaned.length > 3800 ? cleaned.slice(0, 3800) : cleaned
  const safeSpeed = Math.max(0.7, Math.min(1.3, Number.isFinite(baseSpeed) ? baseSpeed : 1.0))
  const { openai } = await import('@/lib/openai')
  const speech = await openai.audio.speech.create({
    model: 'tts-1-hd',
    voice: resolvedVoice,
    input,
    speed: safeSpeed,
  })
  return Buffer.from(await speech.arrayBuffer())
}

// OpenAI tts-1 emits constant-bitrate MP3 at ~128 kbps — kept as fallback.
const TTS_MP3_BITRATE_BPS = 128_000

// MPEG Layer-3 bitrate lookup: [MPEG1/2 flag][bitrate index] → kbps
// Index 0 = "free", index 15 = "bad" — both invalid.
const MP3_BITRATE_MPEG1: ReadonlyArray<number> =
  [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0]
const MP3_BITRATE_MPEG2: ReadonlyArray<number> =
  [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0]
// MPEG1 sample-rate table (Hz); MPEG2 = half these, MPEG2.5 = quarter.
const MP3_SAMPLERATE_MPEG1: ReadonlyArray<number> = [44100, 48000, 32000, 0]

/**
 * Push #158 / Push #223 — Parse the real playback duration (seconds) of a
 * TTS MP3 buffer by scanning actual MPEG frame headers. This is accurate for
 * both CBR and VBR files and correctly ignores ID3 tag bytes.
 *
 * Falls back to the old byte-rate estimate when no valid frames are found.
 * Returns 0 for empty/unparseable buffers — callers treat 0 as "unknown" and
 * fall back to the requested-duration window.
 */
export function estimateMp3DurationSeconds(buffer: Buffer): number {
  if (!buffer || buffer.length === 0) return 0

  let offset = 0

  // Skip ID3v2 tag — "ID3" + 2-byte version + 1-byte flags + 4-byte syncsafe size.
  if (
    buffer.length > 10 &&
    buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33
  ) {
    const id3Size =
      ((buffer[6] & 0x7f) << 21) |
      ((buffer[7] & 0x7f) << 14) |
      ((buffer[8] & 0x7f) << 7) |
       (buffer[9] & 0x7f)
    offset = 10 + id3Size
  }

  let totalSamples = 0
  let sampleRate = 0
  let frames = 0
  const MAX_SEARCH_BYTES = 1024 // bytes to scan before giving up on sync

  while (offset + 4 <= buffer.length) {
    // Locate frame-sync word: 0xFF followed by 0xE? (top 11 bits all 1).
    if (buffer[offset] !== 0xff || (buffer[offset + 1] & 0xe0) !== 0xe0) {
      // Fast-forward up to MAX_SEARCH_BYTES if we lose sync.
      const searchEnd = Math.min(offset + MAX_SEARCH_BYTES, buffer.length - 4)
      let found = false
      for (let s = offset + 1; s < searchEnd; s++) {
        if (buffer[s] === 0xff && (buffer[s + 1] & 0xe0) === 0xe0) {
          offset = s
          found = true
          break
        }
      }
      if (!found) break
      continue
    }

    const h = buffer.readUInt32BE(offset)

    const versionBits  = (h >> 19) & 0x3  // 3=MPEG1, 2=MPEG2, 0=MPEG2.5, 1=reserved
    const layerBits    = (h >> 17) & 0x3  // 3=Layer1, 2=Layer2, 1=Layer3, 0=reserved
    const bitrateBits  = (h >> 12) & 0xf
    const srBits       = (h >> 10) & 0x3
    const paddingBit   = (h >>  9) & 0x1

    // Reject reserved/bad combos.
    if (
      versionBits === 1 || layerBits === 0 ||
      bitrateBits === 0 || bitrateBits === 0xf ||
      srBits === 3
    ) {
      offset++
      continue
    }

    // We only handle Layer 3 (most common for TTS output).
    if (layerBits !== 1) { offset++; continue }

    const isMpeg1 = versionBits === 3
    const bitrateKbps = (isMpeg1 ? MP3_BITRATE_MPEG1 : MP3_BITRATE_MPEG2)[bitrateBits]
    if (!bitrateKbps) { offset++; continue }

    const srMpeg1 = MP3_SAMPLERATE_MPEG1[srBits]
    if (!srMpeg1) { offset++; continue }
    const sr = isMpeg1 ? srMpeg1 : (versionBits === 2 ? srMpeg1 / 2 : srMpeg1 / 4)

    // Layer3 samples per frame: 1152 for MPEG1, 576 for MPEG2/2.5.
    const samplesInFrame = isMpeg1 ? 1152 : 576

    // Frame byte size = floor(coeff * bitrate_bps / sample_rate) + padding,
    // where coeff = samplesPerFrame / 8 (144 for MPEG1 Layer3 = 1152/8, 72 for
    // MPEG2/2.5 Layer3 = 576/8). Push #242: this was hardcoded to 144, so for a
    // 24 kHz MPEG2 stream (OpenAI tts-1's output) every frameSize came out 2x too
    // large; the scanner then skipped every other frame and reported HALF the
    // real duration — the "32s audio rendered as a 16s video" bug.
    const frameSizeCoeff = isMpeg1 ? 144 : 72
    const frameSize = Math.floor(frameSizeCoeff * bitrateKbps * 1000 / sr) + paddingBit
    if (frameSize < 4 || offset + frameSize > buffer.length) break

    if (!sampleRate) sampleRate = sr
    totalSamples += samplesInFrame
    frames++
    offset += frameSize
  }

  if (sampleRate && totalSamples > 0) {
    const dur = totalSamples / sampleRate
    if (Number.isFinite(dur) && dur > 0) return dur
  }

  // Fallback: CBR byte-rate estimate (original Push #158 logic).
  const seconds = buffer.length / (TTS_MP3_BITRATE_BPS / 8)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0
}

// ---------------------------------------------------------------------------
// Push #175 — Whisper-based caption sync helpers
// ---------------------------------------------------------------------------

export interface WhisperWord {
  word: string
  start: number
  end: number
}

/**
 * Call OpenAI Whisper on the TTS audio buffer to obtain word-level timestamps.
 * Returns an empty array if the call fails so a Whisper outage never blocks
 * the render — proportional distribution is the fallback.
 */
export async function transcribeTTSWithTimestamps(buffer: Buffer): Promise<WhisperWord[]> {
  try {
    const { openai } = await import('@/lib/openai')
    // Push #258 — use openai's `toFile` helper instead of `new File(...)`.
    // `File` is a Web API not available in Node.js 18 (Vercel's default
    // runtime). `toFile` works in both Node.js 18 and 20 and sets the correct
    // filename + MIME type the Whisper API requires.
    // Cast to ArrayBuffer to satisfy TypeScript strict BlobPart typing —
    // buffer.buffer is ArrayBufferLike (ArrayBuffer | SharedArrayBuffer) but
    // Blob only accepts ArrayBuffer. In practice this is always ArrayBuffer here.
    const audioBlob = new Blob(
      [new Uint8Array(buffer.buffer as ArrayBuffer, buffer.byteOffset, buffer.byteLength)],
      { type: 'audio/mpeg' },
    )
    const file = await toFile(audioBlob, 'voiceover.mp3', { type: 'audio/mpeg' })
    // verbose_json + word granularity returns {word, start, end} per token.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transcription: any = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: file as unknown as Parameters<typeof openai.audio.transcriptions.create>[0]['file'],
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
    } as Parameters<typeof openai.audio.transcriptions.create>[0])
    const words: WhisperWord[] = transcription?.words ?? []
    console.log(`[compose] Whisper transcribed ${words.length} words`)
    return words
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[compose] Whisper transcription failed, using proportional fallback:', msg)
    return []
  }
}

// Push #240 — captions were appearing AHEAD of the narration. The earlier
// Push #209 "lead" subtracted 0.4s from every Whisper timestamp, which
// over-corrected and pushed captions earlier than the spoken word. Whisper's
// word `start` already marks when the word is spoken relative to the audio,
// and Creatomate plays that audio from t=0, so the correct nudge is a small
// POSITIVE offset: it lands each caption with — or a hair after — the voice,
// never before it. Clamped to 0 so the first caption never goes negative.
// Push #263 — reduced from 0.3 → 0.15. Whisper timestamps are accurate to
// ~50ms; 0.3s was visibly lagging captions behind the voice. 0.15s keeps a
// tiny guard without perceptible delay.
const CAPTION_SYNC_OFFSET = 0.15 // seconds, added to each caption start

/**
 * Map Whisper word-level timestamps to caption segment boundaries.
 *
 * Strategy: sequential word-count assignment.  Each caption segment owns
 * the next N words from the Whisper transcript (N = word count of that
 * segment's text).  The segment starts when its first word starts and ends
 * when the next segment starts (or at the caption-window end for the last).
 *
 * Returns [{time, duration}] aligned 1:1 with `segments`, or [] on failure.
 */
export function mapWhisperTimingsToSegments(
  words: WhisperWord[],
  segments: Array<{ text: string }>,
  totalAudioDuration: number,
  ctaTailSeconds: number,
): Array<{ time: number; duration: number }> {
  if (words.length === 0 || segments.length === 0) return []

  const result: Array<{ time: number; duration: number }> = []
  let wIdx = 0

  for (let i = 0; i < segments.length; i++) {
    const nWords = Math.max(1, (segments[i].text ?? '').trim().split(/\s+/).filter(Boolean).length)

    if (wIdx >= words.length) {
      // Push #244 — Whisper ran out of words before all segments were processed.
      // Previously this returned [] causing full proportional fallback (no sync).
      // Instead: fill remaining segments proportionally from the last mapped
      // timestamp to the caption-window end so Whisper data is not wasted.
      console.warn('[compose] mapWhisperTimings: ran out of words at segment', i, '— filling remainder proportionally')
      const captionWindowEnd = Math.max(0, totalAudioDuration - ctaTailSeconds)
      const lastEntry = result[result.length - 1]
      const fillStart = lastEntry ? lastEntry.time + lastEntry.duration : 0
      const remaining = segments.slice(i)
      const remainWords = remaining.reduce(
        (sum, s) => sum + Math.max(1, (s.text ?? '').trim().split(/\s+/).filter(Boolean).length),
        0,
      )
      const fillWindow = Math.max(0.1, captionWindowEnd - fillStart)
      let localElapsed = fillStart
      for (const rem of remaining) {
        const remWords = Math.max(1, (rem.text ?? '').trim().split(/\s+/).filter(Boolean).length)
        const slot = Math.max(0.1, (remWords / remainWords) * fillWindow)
        result.push({
          time: Math.round(localElapsed * 1000) / 1000,
          duration: Math.round(slot * 1000) / 1000,
        })
        localElapsed += slot
      }
      return result
    }

    const segStartWord = words[wIdx]
    const captionWindowEnd = Math.max(0, totalAudioDuration - ctaTailSeconds)
    const isLast = i === segments.length - 1
    const nextWordStart =
      !isLast && wIdx + nWords < words.length
        ? words[wIdx + nWords].start
        : captionWindowEnd
    const duration = Math.max(0.1, nextWordStart - segStartWord.start)

    // Push #240 — shift the caption slightly LATER so it never precedes the
    // spoken word (the prior negative lead made captions appear ahead of the
    // voice). Clamped to 0 so the first caption never goes negative.
    const rawTime = segStartWord.start
    const adjustedTime = Math.max(0, rawTime + CAPTION_SYNC_OFFSET)

    result.push({
      time: Math.round(adjustedTime * 1000) / 1000,
      duration: Math.round(duration * 1000) / 1000,
    })
    wIdx += nWords
  }

  return result
}

/**
 * Push #258 — Build caption segments DIRECTLY from Whisper word timestamps.
 *
 * Why this replaces the old script→Whisper mapping approach:
 *   The old flow grouped script words into 7-word chunks then looked up those
 *   chunks' timings from Whisper. Numbers caused drift: "63%" is 1 word in
 *   the script but TTS speaks it as "sixty three percent" (3 Whisper words).
 *   Each such mismatch shifted subsequent captions earlier until by the end
 *   the captions were several beats ahead of the narrator.
 *
 *   This function bypasses the script entirely. It takes Whisper's own words
 *   (the ACTUAL spoken transcript) and groups them into ≤maxWords chunks.
 *   Caption text comes from Whisper, timing comes from Whisper — perfect
 *   sync is guaranteed regardless of how numbers or abbreviations are spoken.
 */
export function buildCaptionsFromWhisperWords(
  words: WhisperWord[],
  totalAudioDuration: number,
  ctaTailSeconds: number,
  maxWords = 7,
): Array<{ text: string; time: number; duration: number; highlight: string | null }> {
  if (words.length === 0) return []

  // Only include words that start before the caption window ends (i.e. before the CTA).
  const captionWindowEnd = Math.max(0, totalAudioDuration - ctaTailSeconds)
  const windowWords = words.filter((w) => w.start < captionWindowEnd)
  if (windowWords.length === 0) return []

  const result: Array<{ text: string; time: number; duration: number; highlight: string | null }> = []

  for (let i = 0; i < windowWords.length; i += maxWords) {
    const chunk = windowWords.slice(i, i + maxWords)
    const text = chunk.map((w) => w.word).join(' ').trim()
    if (!text) continue

    // Caption starts when its first word is spoken (+ sync offset).
    const rawStart = chunk[0].start
    const adjustedStart = Math.max(0, rawStart + CAPTION_SYNC_OFFSET)

    // Caption ends when next chunk's first word starts, or at window end.
    const nextChunk = windowWords[i + maxWords]
    const endTime = nextChunk ? nextChunk.start : captionWindowEnd
    const duration = Math.max(0.1, endTime - rawStart)

    result.push({
      text,
      time: round3(adjustedStart),
      duration: round3(duration),
      highlight: pickHighlightWord(text),
    })
  }

  return result
}

function wordCount(s: string): number {
  const t = (s ?? '').trim()
  if (!t) return 0
  return t.split(/\s+/).length
}

// Push #049 — fix voiceover storage on staging.
//
// Root cause of the prior "Could not store the voiceover" failure:
//   1. The raw-fetch upload was missing the `apikey` header that the
//      Supabase Storage REST API requires alongside the Authorization
//      bearer. Supabase rejects auth-bearer-only Storage uploads.
//   2. Node's `Buffer` is not officially a fetch `BodyInit` (TypeScript
//      flags this), and in some Vercel runtimes the body was getting
//      serialised in an unexpected way, producing a 400 from Storage.
//   3. The error was swallowed — only res.status + first 200 chars were
//      surfaced, hiding the actual Supabase error.body the engineer
//      needed to fix the bucket / policy.
//
// Fix: route the upload through @supabase/supabase-js with the service-
// role key. The library sets the correct headers (apikey + Authorization),
// wraps the binary in a Blob, and returns a typed error object we log in
// full. We also auto-create the bucket on first upload if it doesn't
// exist (idempotent — repeat creates return a known error we ignore).
//
// Returns a public URL (the bucket is created as public, matching how
// Creatomate consumes the audio source — it must be reachable without
// auth headers).
let cachedAdminClient: SupabaseClient | null = null
function getAdminClient(): SupabaseClient {
  if (cachedAdminClient) return cachedAdminClient
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured.')
  }
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.')
  }
  cachedAdminClient = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedAdminClient
}

/**
 * Best-effort bucket bootstrap. If the bucket already exists we ignore
 * the "Bucket already exists" / 409 response. Any other error is
 * surfaced so the caller can see what's wrong.
 */
async function ensureVoiceoverBucket(admin: SupabaseClient): Promise<void> {
  const { error } = await admin.storage.createBucket(VOICEOVER_BUCKET, {
    public: true,
    fileSizeLimit: 25 * 1024 * 1024, // 25 MB is more than enough for ~3min mp3
    allowedMimeTypes: ['audio/mpeg', 'audio/mp3'],
  })
  if (!error) {
    console.log(`[compose] created storage bucket "${VOICEOVER_BUCKET}"`)
    return
  }
  const msg = (error.message ?? '').toLowerCase()
  // Supabase returns 409 / "already exists" / "duplicate" — all benign.
  if (
    msg.includes('already exists') ||
    msg.includes('duplicate') ||
    msg.includes('resource already')
  ) {
    return
  }
  // Anything else is an actual problem — log the full error and rethrow.
  console.error('[compose] ensureVoiceoverBucket error:', JSON.stringify(error))
  throw new Error(`Could not ensure storage bucket: ${error.message}`)
}

export async function uploadVoiceoverToSupabase(userId: string, buffer: Buffer): Promise<string> {
  console.log(
    `[compose] uploadVoiceoverToSupabase: user=${userId.slice(0, 8)} size=${buffer.length} bytes mime=audio/mpeg bucket=${VOICEOVER_BUCKET}`,
  )

  // Service-role admin client. Throws if env vars are missing — caller
  // converts that into the user-facing "service not configured" error.
  const admin = getAdminClient()

  // 1) Make sure the bucket exists. First upload of the deployment pays
  //    the bucket-create cost; subsequent uploads see "already exists"
  //    and skip.
  try {
    await ensureVoiceoverBucket(admin)
  } catch (bucketErr) {
    // ensureVoiceoverBucket already logged the full error — re-throw the
    // message verbatim so compose/route.ts can put it into its response.
    throw bucketErr
  }

  // 2) Upload. We wrap the Buffer in a Uint8Array view so the storage
  //    SDK serialises it correctly (Buffer is a subclass but the typing
  //    is happier with Uint8Array, which removes the pre-existing
  //    `BodyInit` TypeScript warning).
  const fileName = `vo-${userId.slice(0, 8)}-${Date.now()}.mp3`
  const filePath = fileName
  console.log(`[compose] storage upload path: ${VOICEOVER_BUCKET}/${filePath}`)

  const audioBytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  const { data: uploadData, error: uploadError } = await admin.storage
    .from(VOICEOVER_BUCKET)
    .upload(filePath, audioBytes, {
      contentType: 'audio/mpeg',
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    // Surface the full Supabase error object so the operator sees the
    // root cause in logs (status / details / hint / code). We keep
    // SECRETS out — only the response from Supabase, never the service
    // key itself.
    console.error('[compose] supabase storage upload failed:', JSON.stringify({
      name: uploadError.name,
      message: uploadError.message,
      ...('statusCode' in uploadError ? { statusCode: (uploadError as { statusCode?: unknown }).statusCode } : {}),
      ...('error' in uploadError ? { error: (uploadError as { error?: unknown }).error } : {}),
    }))
    throw new Error(`Voiceover upload failed: ${uploadError.message}`)
  }

  console.log('[compose] supabase storage upload ok:', JSON.stringify(uploadData))

  // 3) Build the public URL. The bucket is created public above; the
  //    SDK returns the canonical public URL for the object.
  const { data: pub } = admin.storage.from(VOICEOVER_BUCKET).getPublicUrl(filePath)
  if (!pub?.publicUrl) {
    throw new Error('Voiceover upload succeeded but no public URL was returned.')
  }
  console.log(`[compose] voiceover public URL: ${pub.publicUrl}`)
  return pub.publicUrl
}

interface CreatomateElement {
  type: 'video' | 'audio' | 'text' | 'shape'
  track: number
  time: number
  duration: number
  source?: string
  text?: string
  x?: string
  y?: string
  width?: string
  height?: string
  fit?: string
  loop?: boolean
  trim_start?: number
  volume?: string
  fill_color?: string
  stroke_color?: string
  stroke_width?: number
  font_family?: string
  font_size?: number
  font_weight?: string
  // Push #256 — caption pill background + rounded corners
  background_color?: string
  background_x_padding?: string
  background_y_padding?: string
  border_radius?: number
  enter_transition?: { type: string; duration: number }
  // Push #292 — Ken Burns slow zoom animation
  animations?: unknown[]
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000
}

/**
 * Push #066 — build the Creatomate text element(s) for a single caption
 * slot. Renders ONE text element so captions never stack on screen.
 *
 * Visual rule (guided captions):
 *   - If the segment carries a highlight word, the whole caption is
 *     rendered in yellow (#FFD700). The viewer's eye locks onto
 *     high-impact moments without us doing fragile per-word positioning.
 *   - Otherwise the caption renders in white.
 *
 * Why not two layers / inline rich text:
 *   Push #064 used a separate floating yellow accent word above the
 *   white caption. In practice this read as two stacked subtitle lines
 *   and the positioning never landed cleanly on top of the matching
 *   word in the white caption. Per-word inline color via Creatomate
 *   rich-text markup is feature-gated across versions, so a malformed
 *   tag would render as literal `[color]` text — unacceptable.
 *   Whole-line color is the simplest path that's guaranteed to render
 *   correctly on every Creatomate template.
 *
 * Safety: the build is wrapped in try/catch and ALWAYS returns at least
 * the plain white caption element — a failed highlight decision can
 * never break the render.
 */
// Push #256 — Caption quality overhaul:
//   1. Larger font (58→76) + heavier stroke (3→4) for mobile readability.
//   2. Lower position (68%→74%) — closer to the bottom where viewers look on Shorts.
//   3. Dark pill background (background_color + padding) so captions read on
//      any footage, removing the need for a dense stroke alone.
//   4. Word-level highlight: instead of coloring the whole line yellow, we keep
//      the base caption in white and emit a SECOND element on track 7 showing
//      just the highlight keyword in large yellow — creating the "word pop"
//      effect seen in high-retention Shorts. CTA lives on track 6 (last 2.5s)
//      and captions end before CTA starts, so tracks 5/7 never conflict with 6.
export function buildCaptionElements({
  text,
  time,
  duration,
  highlight,
  emphasize = false,
}: {
  text: string
  time: number
  duration: number
  highlight?: string | null
  // Fast Mode v2 (d) — true → whole line renders in HIGHLIGHT_COLOR (yellow
  // pop for money/number/power-word chunks). Only Fast Mode passes true.
  emphasize?: boolean
}): CreatomateElement[] {
  // Push #292 — OpusClip/InVideo quality upgrade:
  //   - UPPERCASE text: standard across all professional Shorts tools
  //   - Font 52→70: larger captions are more readable on mobile
  //   - y: 79%→72%: moved up so more footage is visible below captions
  //   - Pop transition (0.08s) instead of fade: snappier, more energetic
  //   - Slightly narrower pill (88%→84%) to look less like a subtitle bar
  const baseCaption: CreatomateElement = {
    type: 'text',
    track: 5,
    time,
    duration,
    text: (text ?? '').toUpperCase(),
    x: '50%',
    y: '72%',
    width: '84%',
    font_family: 'Montserrat',
    font_size: 70,
    font_weight: '800',
    // Fast Mode v2 (d) — emphasized chunks go whole-line yellow (mobile-safe:
    // same size/stroke/pill, only the fill changes so contrast never drops).
    fill_color: emphasize ? HIGHLIGHT_COLOR : '#ffffff',
    stroke_color: 'rgba(0,0,0,0.98)',
    stroke_width: 5,
    background_color: 'rgba(0,0,0,0.60)',
    background_x_padding: '4%',
    background_y_padding: '2%',
    border_radius: 10,
    enter_transition: { type: 'pop', duration: 0.08 },
  }

  // Push #277 — remove yellow keyword pop (track 7). The two-layer approach
  // (white caption on track 5 + yellow word on track 7) was rendering as two
  // visible subtitle lines which looked like duplicate/random captions to viewers.
  // Single white caption only — clean, no confusion, timing already perfect.
  return [baseCaption]
}

/**
 * Build a Creatomate source JSON: video clips tiled to fill `duration`,
 * voiceover audio across the full timeline, captions evenly distributed,
 * and a CTA in the last 2.5 seconds.
 */
export function buildCreatomateSource({
  clipUrls,
  voiceoverUrl,
  voiceoverScript,
  sceneCaptions,
  duration,
  quality,
  realAudioDuration,
  whisperTimings,
  whisperWords,
  musicUrl,
  watermark = false,
  endCard = false,
  avatarUrl = null,
  avatarHookSeconds = null,
}: ComposeInputs): Record<string, unknown> {
  // Push #199 — use the REAL TTS audio duration as the master timeline length
  // instead of the user-requested duration. This eliminates both the "black
  // screen at the end" (TTS shorter than requested) and the "narration cut off"
  // (TTS longer than requested) problems. The user-selected duration still
  // influences the word-count target in scaleVoiceoverScript, so "45s" still
  // produces a ~45s video — but the exact length is now always driven by the
  // actual audio, never by an arbitrary integer. We cap at 90s and floor at 5s
  // as a sanity guard, and fall back to the requested duration if the TTS
  // measurement failed or returned an implausible value.
  const hasAvatar = typeof avatarUrl === 'string' && avatarUrl.trim().length > 0
  // Avatar duration fix (02/07, TAAFT reviewer bug) — in avatar mode a SHORT
  // measured audio (a one-sentence verbatim line ≈ 3s) is a legitimate value,
  // not a failed measurement, so the plausibility floor drops 4s → 0.5s and
  // the timeline floor drops 5s → 3s. Non-avatar modes keep the old guards.
  const minPlausibleAudio = hasAvatar ? 0.5 : 4
  const masterDuration =
    realAudioDuration && realAudioDuration > minPlausibleAudio && realAudioDuration < 120
      ? realAudioDuration
      : duration
  let totalDuration = clamp(Math.ceil(masterDuration * 10) / 10, hasAvatar ? 3 : 5, 90)
  const cleanClips = clipUrls.filter((u) => typeof u === 'string' && u.trim().length > 0)
  // Avatar tail fix (13/06) — in avatar mode the narration IS the master
  // clock: the lip-synced face and the mp3 are the same length, so the
  // timeline must NEVER outlive the audio. This also lets short verbatim
  // videos (e.g. a 5s greeting) end at ~5s instead of being floored to the
  // 45s-era minimums and padded with unrelated clips (Joseph, 13/06).
  // 02/07 — gate loosened 2s → 0.5s so ultra-short lines also cap the tail.
  if (hasAvatar && realAudioDuration && realAudioDuration > 0.5 && realAudioDuration < 120) {
    totalDuration = Math.min(totalDuration, clamp(Math.ceil((realAudioDuration + 0.4) * 10) / 10, 3, 90))
  }
  // Avatar mode can render with ZERO stock clips (talking head carries the
  // whole video); every other mode still requires clips.
  if (cleanClips.length === 0 && !hasAvatar) {
    throw new Error('No video clips provided to compose.')
  }

  const elements: CreatomateElement[] = []

  // Track 1 — solid background so the video never shows a transparent gap.
  elements.push({
    type: 'shape',
    track: 1,
    time: 0,
    duration: totalDuration,
    x: '50%',
    y: '50%',
    width: '100%',
    height: '100%',
    fill_color: '#08080f',
  })

  // Track 2 — tile / loop the clips to fill the full duration.
  // Clips are placed back-to-back with cumulative `time` (no gap, no overlap)
  // until we cover totalDuration.
  //
  // fit: 'cover' is the right default for a 9:16 output canvas. Most clips
  // are already vertical 9:16 (Runway 720x1280, Pexels portrait HD), where
  // 'cover' and 'contain' produce identical output. The case that matters
  // is the curated stock-library fallback, which contains landscape clips
  // (Cloudinary 1280x720 etc.) — 'contain' would render those as a small
  // strip on a black canvas (the black-screen bug); 'cover' fills the
  // frame with a centered crop. Track 1 still paints a dark background as
  // a safety net for any decode failure.
  //
  // Push #234 — two black-frame fixes:
  //   1. loop: true — stock clips are NOT all 10s (Pexels/cached clips vary
  //      in length). When a clip is shorter than its slot, Creatomate would
  //      otherwise hold a frozen/black frame for the remainder. Looping the
  //      source fills the whole slot with motion instead of a black tail.
  //   2. Removed the per-clip enter_transition fade (Push #202). Because
  //      consecutive same-track clips do NOT overlap here, that fade animated
  //      each clip in FROM the near-black track-1 background, producing a
  //      visible dark dip at every clip boundary — the "gaps pretos" the user
  //      reported. A clean hard cut has no such dip. We also trim the first
  //      0.25s of each clip so any source fade-in-from-black is skipped.
  // Push #438 — was 10s. Lowered to 6s so the timeline cuts more often and a
  // single clip is never held on screen for ~35s when few unique clips resolve.
  // More cuts = more dynamic pacing (closer to viral edit rhythm) and hides the
  // repetition when the fallback has to reuse a clip.
  // Push #445 — but for AI-GENERATED clips (Seedance/Kling) each clip is a UNIQUE
  // ~10s generation, NOT recycled stock. With CLIP_LEN=6 a 60s video only covered
  // 6×6=36s with its 6 clips, so compose re-cycled clips to fill the rest →
  // visible repetition (Joseph's 60s feedback). For AI Gen we let each clip fill
  // up to 10s (its real length), so 6–9 clips cover a 60–90s video with no repeat.
  // Fast stock keeps the tight 6s cut rhythm.
  // KINEO-HOLLYWOOD-2026-07-09 — cinematic_hollywood included for safety (its
  // renders normally go through buildHollywoodCreatomateSource, but if one ever
  // lands here it must get AI-clip pacing, never Fast's 6s recycling).
  const isAiGen =
    quality === 'cinematic_ai' || quality === 'cinematic_kling' || quality === 'cinematic_veo' || quality === 'cinematic_sora' || quality === 'cinematic_hollywood' || quality === 'basic_ai'
  // Fast Mode v2 (02/07) — single gate for every v2 upgrade in this builder.
  // ONLY quality==='fast' (the free stock pipeline) opts in; absent/legacy
  // quality values keep the exact pre-v2 behavior.
  const isFastStock = quality === 'fast'
  // Push #446 — Fast 60s repetition fix. Fast (stock) makes ~1 clip per script
  // beat (~6-7 clips). At CLIP_LEN=6 those 6-7 clips only cover 36-42s, so a ~55s
  // 60s video recycled/repeated clips to fill the rest (Joseph's feedback). Keep
  // the tight 6s cuts on short videos (≤50s, e.g. the 45s that scored well), but
  // for 60s/90s let each Fast clip run up to ~9s so 6-7 clips spread across the
  // full timeline without recycling (slotLen = min(9, total/clips) lands them
  // naturally; the old 6s cap was artificially low for the 6-7 clip case and
  // forced the repeat). AI Gen (unique 10s gens) stays at 10s (see #445).
  const AI_CLIP_LEN = quality === 'cinematic_veo' || quality === 'cinematic_sora' ? 8 : 10
  const CLIP_LEN = isAiGen ? AI_CLIP_LEN : totalDuration > 50 ? 9 : 6
  // Push #256 — reduced from 0.25→0.1. Pexels/Supabase-cached clips rarely have
  // a source fade-in; 0.1s (3 frames) is enough to skip any brief dark frame
  // at the clip head without eating into useful footage.
  const CLIP_TRIM_START = 0.1
  // Push #256 — micro-overlap to prevent the rendering gap at clip boundaries.
  // Each clip element is made 0.06s longer than its timeline slot, so it
  // slightly overlaps the next clip on the same track. Creatomate renders the
  // later element (higher array index) on top, giving a seamless hard cut with
  // no black flash between clips.
  const CLIP_GAP_OVERLAP = 0.06
  // Push #241 — size each slot so EVERY clip appears, in order, within the audio
  // window. The old fixed 10s slots overflowed the timeline and silently dropped
  // the later clips: a 7-clip / ~52s verbatim script laid clips across 0–70s, so
  // the video (which ends at the ~52s audio length) never reached its final
  // skyline clip and footage drifted a full beat off the narration. Dividing the
  // timeline by the clip count lands all clips on-screen and roughly on their
  // beats. The CLIP_LEN cap preserves the old behavior when there are too few
  // clips to fill the window (e.g. a 2-clip / 90s GPT-scene video): the loop
  // re-cycles them at 10s each for the remainder instead of stretching one clip.
  // ── AI Avatar mode (feature/ai-avatar) ────────────────────────────────
  // The talking head is the MAIN video, muted (the voiceover on track 4 is
  // the one audio source — VEED lip-synced to that exact mp3, so timeline
  // alignment keeps lips in sync). Stock clips appear as periodic full-frame
  // CUTAWAYS. Rhythm: the HOOK (first 6s) and the PAYOFF (last 6s) always
  // stay on the face; in between, a 4s cutaway every 12s.
  //
  // Checkpoint-1 feedback fix (telas pretas): v1 stacked the cutaways ON TOP
  // of a single full-length avatar element on the SAME track. Creatomate does
  // not reliably render fully-overlapping same-track elements (only the tiny
  // #256 micro-overlap is proven), and the conflict resolution produced black
  // gaps. v2 builds track 2 STRICTLY SEQUENTIALLY — avatar segment → cutaway →
  // avatar segment — with no overlap beyond the #256 micro-overlap. Each
  // avatar segment uses trim_start = its timeline position, so the (muted)
  // talking head resumes exactly where the narration is and lip sync is
  // preserved across every cut. This is the same battle-tested sequential
  // pattern as the standard clip tiling below.
  if (hasAvatar && avatarHookSeconds != null && avatarHookSeconds > 2 && cleanClips.length > 0) {
    // ── Hook Avatar (Face-app wave 1, 12/06) ──────────────────────────────
    // The avatar MP4 only contains the lip-synced HOOK (first ~8s of the
    // narration, byte-sliced from the same mp3 → zero drift). Face on screen
    // for [0, hook], then standard b-roll tiling carries the timeline to the
    // end. Same sequential no-overlap pattern as everywhere else.
    const hookEnd = round3(Math.min(avatarHookSeconds, totalDuration - 1))
    elements.push({
      type: 'video',
      track: 2,
      time: 0,
      duration: round3(hookEnd + CLIP_GAP_OVERLAP),
      source: avatarUrl as string,
      fit: 'cover',
      loop: false,
      x: '50%',
      y: '50%',
      width: '100%',
      height: '100%',
      volume: '0%',
    })
    const remainingWindow = totalDuration - hookEnd
    const hookSlotLen = Math.min(CLIP_LEN, remainingWindow / cleanClips.length)
    let hookCursor = hookEnd
    let hi = 0
    while (hookCursor < totalDuration) {
      const remaining = totalDuration - hookCursor
      const segLen = round3(Math.min(hookSlotLen, remaining))
      const zoomIn = hi % 2 === 0
      elements.push({
        type: 'video',
        track: 2,
        time: round3(hookCursor),
        duration: round3(segLen + CLIP_GAP_OVERLAP),
        source: cleanClips[hi % cleanClips.length],
        fit: 'cover',
        loop: true,
        trim_start: CLIP_TRIM_START,
        x: '50%',
        y: '50%',
        width: '100%',
        height: '100%',
        volume: '0%',
        animations: [
          {
            type: 'scale',
            fade: false,
            start_scale: zoomIn ? '100%' : '108%',
            end_scale: zoomIn ? '108%' : '100%',
            easing: 'linear',
          },
        ],
      })
      hookCursor = round3(hookCursor + segLen)
      hi += 1
    }
    console.log(
      `[compose] hook-avatar mode: face 0–${hookEnd}s, ${cleanClips.length} clip(s) tiling ${round3(remainingWindow)}s, total ${totalDuration}s`,
    )
  } else if (hasAvatar) {
    // 1) Compute the cutaway windows first.
    const CUTAWAY_LEN = 4
    const CUTAWAY_EVERY = 12 // window start → next window start (8s face + 4s b-roll)
    const FACE_HEAD = 6 // hook stays on the face
    const FACE_TAIL = 6 // payoff + CTA stay on the face
    const cutStarts: number[] = []
    // Tail fix (13/06) — short avatar videos (< 16s, e.g. verbatim one-liners)
    // get ZERO cutaways: the face carries the whole thing.
    if (cleanClips.length > 0 && totalDuration >= 16) {
      let t = FACE_HEAD
      while (t + CUTAWAY_LEN <= totalDuration - FACE_TAIL) {
        cutStarts.push(t)
        t += CUTAWAY_EVERY
      }
    }

    // 2) Walk the timeline emitting non-overlapping segments in order.
    const pushAvatarSegment = (from: number, to: number) => {
      const len = to - from
      if (len <= 0.05) return
      elements.push({
        type: 'video',
        track: 2,
        time: round3(from),
        // #256 micro-overlap so the boundary with the NEXT element is a clean
        // hard cut with no rendering gap (black flash).
        duration: round3(len + CLIP_GAP_OVERLAP),
        source: avatarUrl as string,
        fit: 'cover',
        loop: false,
        // Resume the talking head at its own timeline position — keeps the
        // lips locked to the narration after every cutaway.
        trim_start: round3(from),
        x: '50%',
        y: '50%',
        width: '100%',
        height: '100%',
        volume: '0%',
      })
    }

    let cursor = 0
    cutStarts.forEach((cutStart, ci) => {
      pushAvatarSegment(cursor, cutStart)
      const zoomIn = ci % 2 === 0
      elements.push({
        type: 'video',
        track: 2,
        time: round3(cutStart),
        duration: round3(CUTAWAY_LEN + CLIP_GAP_OVERLAP),
        source: cleanClips[ci % cleanClips.length],
        fit: 'cover',
        loop: true, // short stock clips fill the whole 4s window (no black tail)
        trim_start: CLIP_TRIM_START,
        x: '50%',
        y: '50%',
        width: '100%',
        height: '100%',
        volume: '0%',
        animations: [
          {
            type: 'scale',
            fade: false,
            start_scale: zoomIn ? '100%' : '108%',
            end_scale: zoomIn ? '108%' : '100%',
            easing: 'linear',
          },
        ],
      })
      cursor = cutStart + CUTAWAY_LEN
    })
    // Final face segment through the very end of the timeline (payoff + CTA).
    pushAvatarSegment(cursor, totalDuration)

    console.log(
      `[compose] avatar mode v2 (sequential): ${cutStarts.length} cutaway(s), ${cleanClips.length} clip(s), total ${totalDuration}s`,
    )
  } else {
  // Fast Mode v2 (a) — RITMO: fast stock cuts every 2.5–4s (generate-video-fast
  // now sources 2 ranked clips per scene, so total/count lands inside the band;
  // when few clips resolve, the clamp still forces frequent cuts by cycling).
  // Non-fast modes keep the exact pre-v2 slot math.
  const slotLen = isFastStock
    ? clamp(totalDuration / cleanClips.length, FAST_MIN_CUT_SECONDS, FAST_MAX_CUT_SECONDS)
    : Math.min(CLIP_LEN, totalDuration / cleanClips.length)
  let cursor = 0
  let i = 0
  while (cursor < totalDuration) {
    const remaining = totalDuration - cursor
    const segLen = round3(Math.min(slotLen, remaining))
    const url = cleanClips[i % cleanClips.length]
    // Push #292 — Ken Burns slow zoom. Alternate zoom-in / zoom-out so
    // consecutive clips don't feel like the same motion. start_scale 100%→108%
    // for even clips (zoom in), 108%→100% for odd clips (zoom out). The
    // 8% scale range is subtle enough not to feel fake on stock footage
    // but clearly visible as "alive" motion to the viewer.
    const zoomIn = i % 2 === 0
    // Fast Mode v2 (b) — MOVIMENTO: cycle a 4-step Ken Burns pattern (center
    // push/pull + anchored push-ins that read as lateral pans) so consecutive
    // cuts never repeat the same motion. Fast only; others keep #292 behavior.
    const kb = isFastStock ? FAST_KEN_BURNS_PATTERN[i % FAST_KEN_BURNS_PATTERN.length] : null
    const elem: CreatomateElement = {
      type: 'video',
      track: 2,
      time: round3(cursor),
      duration: round3(segLen + CLIP_GAP_OVERLAP), // micro-overlap → no gap
      source: url,
      fit: 'cover',
      loop: true,
      trim_start: CLIP_TRIM_START,
      x: '50%',
      y: '50%',
      width: '100%',
      height: '100%',
      volume: '0%',
      animations: [
        kb
          ? {
              type: 'scale',
              fade: false,
              start_scale: kb.from,
              end_scale: kb.to,
              x_anchor: kb.xAnchor,
              y_anchor: '50%',
              easing: 'linear',
            }
          : {
              type: 'scale',
              fade: false,
              start_scale: zoomIn ? '100%' : '108%',
              end_scale: zoomIn ? '108%' : '100%',
              easing: 'linear',
            },
      ],
    }
    elements.push(elem)
    cursor = round3(cursor + segLen)
    i += 1
  }
  } // end avatar/standard track-2 branch

  // Track 3 — soft dark overlay so caption text always reads on any clip.
  elements.push({
    type: 'shape',
    track: 3,
    time: 0,
    duration: totalDuration,
    x: '50%',
    y: '50%',
    width: '100%',
    height: '100%',
    fill_color: 'rgba(0,0,0,0.30)',
  })

  // Push #292 — Cinematic top & bottom gradient bars (letterbox vignette).
  // Darkens the top 20% and bottom 20% of the frame so captions and hook
  // text always read cleanly, and gives the "cinematic documentary" feel
  // that OpusClip/InVideo apply to all footage.
  // Top bar gradient (dark→transparent downward)
  elements.push({
    type: 'shape',
    track: 3,
    time: 0,
    duration: totalDuration,
    x: '50%',
    y: '10%',
    width: '100%',
    height: '20%',
    fill_color: 'rgba(0,0,0,0.65)',
  })
  // Bottom bar gradient (transparent→dark upward)
  elements.push({
    type: 'shape',
    track: 3,
    time: 0,
    duration: totalDuration,
    x: '50%',
    y: '90%',
    width: '100%',
    height: '20%',
    fill_color: 'rgba(0,0,0,0.65)',
  })

  // Push #436 — CINEMATIC COLOR GRADE + VIGNETTE. Stock clips from Pexels each
  // arrive with their own color temperature and look, so a multi-clip Fast video
  // feels like a patchwork. These low-opacity overlays unify every clip into one
  // graded, premium look (the single biggest "make stock look produced" trick),
  // closing the gap toward AI Generated — for free, applied to every Fast video.
  //
  // KINEO-FAST-V4 (10/07) — NICHE-AWARE GRADE. One fixed teal wash made every
  // niche look the same; real colorists grade money content warm/gold, mystery
  // deep blue, geography teal/orange. Detected from the narration itself —
  // zero new params, works for every caller. Unknown niche keeps #436's grade.
  const gradeText = (voiceoverScript ?? '').toLowerCase()
  const grade = /\b(billionaire|millionaire|wealth|money|invest|luxur|rich|dollar|business)\b/.test(gradeText)
    ? { wash: 'rgba(35,26,8,0.15)',  glow: 'rgba(255,190,80,0.07)' }   // wealth: warm gold
    : /\b(mystery|mysterious|unexplained|vanish|disappear|haunted|secret|creepy)\b/.test(gradeText)
    ? { wash: 'rgba(8,14,40,0.17)',  glow: 'rgba(120,150,255,0.05)' }  // mystery: deep blue
    : /\b(volcano|desert|island|mountain|ocean|country|village|glacier|jungle|crater)\b/.test(gradeText)
    ? { wash: 'rgba(10,32,40,0.14)', glow: 'rgba(255,140,50,0.06)' }   // places: teal/orange doc
    : { wash: 'rgba(12,34,51,0.13)', glow: 'rgba(255,150,60,0.05)' }   // default (#436 original)
  // (a) Niche wash over the whole frame → cohesion + moody cinematic tone.
  elements.push({
    type: 'shape',
    track: 3,
    time: 0,
    duration: totalDuration,
    x: '50%',
    y: '50%',
    width: '100%',
    height: '100%',
    fill_color: grade.wash,
  })
  // (b) Complementary highlight lift in the center → reads as "color graded",
  //     not just tinted. Very subtle, center-weighted.
  elements.push({
    type: 'shape',
    track: 3,
    time: 0,
    duration: totalDuration,
    x: '50%',
    y: '48%',
    width: '70%',
    height: '55%',
    fill_color: grade.glow,
  })
  // (c) Side vignette bars (left + right) → completes the frame darkening with
  //     the existing top/bottom letterbox, focusing the eye on the subject.
  elements.push({
    type: 'shape',
    track: 3,
    time: 0,
    duration: totalDuration,
    x: '4%',
    y: '50%',
    width: '8%',
    height: '100%',
    fill_color: 'rgba(0,0,0,0.40)',
  })
  elements.push({
    type: 'shape',
    track: 3,
    time: 0,
    duration: totalDuration,
    x: '96%',
    y: '50%',
    width: '8%',
    height: '100%',
    fill_color: 'rgba(0,0,0,0.40)',
  })

  // Track 4 — voiceover. Duration = actual audio length so Creatomate
  // doesn't pad or truncate the audio file. totalDuration already equals
  // realAudioDuration (see master-duration logic above), so this is a
  // no-op in normal operation; it acts as an explicit guard for edge cases.
  // 02/07 — guard follows minPlausibleAudio (0.5s in avatar mode) so a short
  // verbatim mp3 keeps its own length instead of inheriting totalDuration.
  const audioDuration = round3(
    masterDuration && masterDuration > minPlausibleAudio ? masterDuration : totalDuration
  )
  elements.push({
    type: 'audio',
    track: 4,
    time: 0,
    duration: audioDuration,
    source: voiceoverUrl,
    volume: '100%',
  })

  // Track 5 (+ Track 7 for keyword pops) — captions.
  //
  // Push #258 — DIRECT WHISPER PATH (primary, drift-free):
  //   When whisperWords are available, captions are built directly from Whisper's
  //   own transcript words grouped into ≤7-word chunks. Caption text + timing both
  //   come from Whisper, so there is zero possibility of desync caused by number
  //   expansion (e.g. script "63%" vs TTS "sixty three percent"). This replaces the
  //   old script-segment → Whisper-timing mapping that drifted on number-heavy scripts.
  //
  // PROPORTIONAL FALLBACK (when Whisper is unavailable):
  //   Falls back to script-text segments with word-count-proportional timing.
  //   This is less accurate but always produces something on screen.
  if (Array.isArray(whisperWords) && whisperWords.length > 0) {
    // Direct path — perfect sync guaranteed.
    // Push #292 — 3 words/chunk (was 4). Shorter, punchier lines match
    // OpusClip/InVideo style — each caption appears and disappears quickly,
    // creating more visual energy and easier mobile readability.
    const directCaps = buildCaptionsFromWhisperWords(
      whisperWords,
      masterDuration,
      CTA_TAIL_SECONDS,
      3,
    )
    for (const cap of directCaps) {
      elements.push(...buildCaptionElements({
        text: cap.text,
        time: cap.time,
        duration: cap.duration,
        highlight: cap.highlight,
        // Fast Mode v2 (d) — money/number/power-word chunks pop in yellow.
        emphasize: isFastStock && FAST_EMPHASIS_RE.test(cap.text),
      }))
    }
  } else {
    // Proportional fallback — script segments with word-count proportional slots.
    // Push #292 — 3 words/chunk (was 4). Matches directCaps limit above.
    const scriptSegments = buildCaptionSegments(voiceoverScript, 3)
    const captionsClean: CaptionSegment[] = scriptSegments.length > 0
      ? scriptSegments
      : sceneCaptions
          .map((c) => (c ?? '').toString().trim())
          .filter((c) => c.length > 0)
          .map((text) => ({ text, highlight: pickHighlightWord(text) }))
    if (captionsClean.length > 0) {
      const measured = realAudioDuration && realAudioDuration > 0 ? realAudioDuration : totalDuration
      const captionWindow = Math.max(2, Math.min(measured, totalDuration) - CTA_TAIL_SECONDS)
      const totalWords = captionsClean.reduce((sum, c) => sum + wordCount(c.text), 0) || captionsClean.length
      let elapsed = 0
      captionsClean.forEach((segment, idx) => {
        const portion = (wordCount(segment.text) || 1) / totalWords
        const isLast = idx === captionsClean.length - 1
        const slot = isLast ? Math.max(0.1, captionWindow - elapsed) : portion * captionWindow
        const time = elapsed
        elapsed += slot
        elements.push(...buildCaptionElements({
          text: segment.text,
          time: round3(time),
          duration: round3(slot),
          highlight: segment.highlight,
          // Fast Mode v2 (d) — same yellow-pop rule as the Whisper path.
          emphasize: isFastStock && FAST_EMPHASIS_RE.test(segment.text),
        }))
      })
    }
  }

  // Track 6 — CTA in the final 2.5s.
  const ctaTime = Math.max(0, totalDuration - CTA_TAIL_SECONDS)
  elements.push({
    type: 'text',
    track: 6,
    time: round3(ctaTime),
    duration: Math.min(CTA_TAIL_SECONDS, totalDuration),
    text: CTA_TEXT,
    x: '50%',
    y: '90%',
    width: '80%',
    font_family: 'Montserrat',
    font_size: 30,
    font_weight: '700',
    fill_color: '#ffffff',
    stroke_color: 'rgba(99,102,241,0.9)',
    stroke_width: 2,
  })

  // Track 7 — #482 "Made with ShortsForgeAI" end card (free + Starter only).
  // Sits just above the URL CTA in the final CTA window (no captions there —
  // they stop before the CTA tail), so every video those users post becomes an
  // ad for the product (the Loom/CapCut viral loop). Clean on Creator/Studio.
  if (endCard) {
    elements.push({
      type: 'text',
      track: 7,
      time: round3(ctaTime),
      duration: Math.min(CTA_TAIL_SECONDS, totalDuration),
      text: 'Made with Kineo',
      x: '50%',
      y: '80%',
      width: '86%',
      font_family: 'Montserrat',
      font_size: 44,
      font_weight: '800',
      fill_color: '#ffffff',
      stroke_color: 'rgba(99,102,241,0.95)',
      stroke_width: 3,
      background_color: 'rgba(13,13,20,0.55)',
    })
  }

  // Track 8 — background music (Push #293).
  // Phonk / motivational track from Pixabay at low volume, looping under
  // the voiceover. Starts at t=0, runs the full video duration. The loop
  // flag re-cycles the track if the video is longer than the audio file.
  if (musicUrl) {
    elements.push({
      type: 'audio',
      track: 8,
      time: 0,
      duration: totalDuration,
      source: musicUrl,
      volume: MUSIC_VOLUME,
      loop: true,
    })
    console.log(`[compose] background music added: ${musicUrl.slice(0, 80)}`)
  }

  // Track 9 — #384 free-trial watermark, burned into the final MP4 so it can't
  // be stripped. Text = "shortsforgeai.com" (one consistent brand across the
  // app; the same domain shown in the end CTA). Placed at the TOP so it never
  // collides with the bottom CTA (track 6, last ~2.5s, y:90%). Full duration,
  // semi-transparent. ONLY added when watermark:true (server free-AI-trial decision).
  // TO SWAP FOR A LOGO PNG LATER: replace this text element with an image one:
  //   { type:'image', track:9, time:0, duration:totalDuration, source:<logoUrl>,
  //     x:'50%', y:'6%', width:'30%', opacity:'60%' }
  if (watermark) {
    elements.push({
      type: 'text',
      track: 9,
      time: 0,
      duration: totalDuration,
      text: 'usekineo.com',
      x: '50%',
      y: '5%',
      width: '80%',
      font_family: 'Montserrat',
      font_size: 28,
      font_weight: '700',
      fill_color: 'rgba(255,255,255,0.6)',
      stroke_color: 'rgba(0,0,0,0.35)',
      stroke_width: 1,
    })
  }

  return {
    output_format: 'mp4',
    width: 1080,
    height: 1920,
    frame_rate: 30,
    duration: totalDuration,
    elements,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KINEO-HOLLYWOOD-2026-07-09 — HOLLYWOOD MODE 2.0 source builder.
//
// Differences vs buildCreatomateSource (which stays 100% untouched):
//  - Clips are NOT muted. The engines generated NATIVE audio (Kling3 voice +
//    lip sync on dialogue scenes, ambient sound on the rest). Volume per scene
//    type: dialogue 100%, cinematic 55%, support 35%.
//  - Timeline = the planned per-scene durations (dialogue 10s / cinematic 8s /
//    support = planned seconds), tiled sequentially, last scene trimmed to
//    close the 45-60s target. NOT audio-length driven.
//  - TTS narration comes in per-BLOCK mp3s (one mp3 per contiguous run of
//    narrated scenes), each placed at its block's timeline offset. Dialogue
//    scenes never get narration over them.
//  - Captions: narrated blocks use the Whisper words of THAT block's mp3
//    shifted by the block offset (drift-free); dialogue scenes show the REAL
//    spoken line in ~3-word chunks spread across the scene
//    (KINEO-HOLLYWOOD-21-2026-07-10, bug b), falling back to the old static
//    scene caption when the line is unavailable.
//  - Background music is OFF (the native audio IS the realism).
//  - KINEO-HOLLYWOOD-22-2026-07-10: the niche-aware color grade IS applied
//    (slightly stronger than AI Gen) — it unifies the look across engines.
//  - CTA / end card / watermark follow the exact same rules as everywhere else.
// ─────────────────────────────────────────────────────────────────────────────

export interface HollywoodClipInput {
  url: string
  // KINEO-HOLLYWOOD-HOST-2026-07-13 — 'host' added: an anchored dialogue
  // scene rendered on Kling AI Avatar v2 (our TTS baked into the clip, one
  // voice for the whole video). Behaves like 'dialogue' for volume (100%),
  // narration (never TTS over it) and captions (chunks the real line), but
  // its `seconds` are the MEASURED audio duration and are honored EXACTLY
  // (no 5|10 snap) so the montage neither pools silence nor cuts speech.
  engine: 'dialogue' | 'cinematic' | 'support' | 'host'
  seconds: number
  caption: string
  // KINEO-HOLLYWOOD-21-2026-07-10 (bug b) — the EXACT spoken line of a
  // dialogue scene (undefined for cinematic/support). Captions chunk THIS
  // text so the on-screen words match what the person actually says.
  dialogueLine?: string
}

export interface HollywoodNarrationBlock {
  /** Timeline offset (seconds) where this block's narration starts. */
  time: number
  /** KINEO-HOLLYWOOD-24-2026-07-10 — hard cut for this narration on the
   * timeline: end of ITS OWN scene + 0.5s tolerance. Narration is now one mp3
   * PER SCENE, and it must never bleed into (or displace silence onto) the
   * next scene. Optional for backward compatibility — absent means the old
   * behavior (cap only at the next dialogue scene / timeline end). */
  endCap?: number
  /** Public URL of the block's TTS mp3. */
  url: string
  /** Measured mp3 duration (seconds). */
  audioDuration: number
  /** The narration text (caption fallback when Whisper is unavailable). */
  text: string
  /** Whisper word timestamps for THIS block's mp3 (relative to the mp3). */
  words?: WhisperWord[]
}

const HOLLYWOOD_CLIP_VOLUME: Record<HollywoodClipInput['engine'], string> = {
  dialogue: '100%',
  cinematic: '55%',
  support: '35%',
  // KINEO-HOLLYWOOD-HOST-2026-07-13 — the host clip's audio IS the speech
  // (our TTS lip-synced by Kling Avatar v2): full volume, like dialogue.
  host: '100%',
}

export function buildHollywoodCreatomateSource({
  clips,
  narrationBlocks,
  watermark = false,
  endCard = false,
}: {
  clips: HollywoodClipInput[]
  narrationBlocks: HollywoodNarrationBlock[]
  watermark?: boolean
  endCard?: boolean
}): Record<string, unknown> {
  const cleanClips = clips.filter((c) => typeof c.url === 'string' && c.url.trim().length > 0)
  if (cleanClips.length === 0) {
    throw new Error('No video clips provided to compose (hollywood).')
  }

  // Per-scene durations: cinematic fixed at 8s; dialogue follows the plan
  // (KINEO-HOLLYWOOD-21-2026-07-10, bug a: 5s or 10s, sized to the spoken
  // line — default 10); support seconds come from the plan. Trim the LAST
  // scene so the total closes at ≤ 60s; floor the timeline at 8s as a guard.
  // KINEO-HOLLYWOOD-HOST-2026-07-13 — 'host' scenes use their seconds EXACTLY
  // (the route measured the real TTS audio length; snapping to 5|10 here
  // would re-create the very silence/cut-speech defect the host path kills).
  // Clamp 2..20s: a hollywood line is ≤220 chars ≈ ≤13s of speech, so 20 is
  // pure safety. MUST mirror secondsOf in app/api/compose/route.ts or the
  // narration-block offsets drift from the real timeline.
  const secondsFor = (c: HollywoodClipInput): number =>
    c.engine === 'host'
      ? (Number.isFinite(c.seconds) && c.seconds > 0 ? Math.min(20, Math.max(2, c.seconds)) : 10)
      : c.engine === 'dialogue' ? (c.seconds === 5 ? 5 : 10) : c.engine === 'cinematic' ? 8 :
        Number.isFinite(c.seconds) && c.seconds > 0 ? Math.min(10, Math.max(2, c.seconds)) : 10

  const durations = cleanClips.map(secondsFor)
  let total = durations.reduce((s, d) => s + d, 0)
  // KINEO-HOLLYWOOD-HOST-2026-07-13 — NEVER trim a trailing 'host' clip to fit
  // 60s: its duration IS its speech (the PAYOFF line, after the HOOK/PAYOFF-
  // on-camera rule, usually closes the video), and cutting it mid-word is the
  // worst possible ending. When host lines run the timeline slightly past 60s
  // we ACCEPT the overflow instead (totalDuration is already clamped to ≤90s
  // below, and 61-65s is fine for Shorts — TikTok Creator Rewards even wants
  // >60s). Middle scenes can't be trimmed here either: their narration mp3s
  // were placed at offsets computed from the UNtrimmed durations in
  // app/api/compose/route.ts, and moving earlier scenes would desync them.
  while (total > 60 && durations.length > 0 && cleanClips[durations.length - 1].engine !== 'host') {
    const overflow = total - 60
    const lastIdx = durations.length - 1
    const trimmable = durations[lastIdx] - 2 // never below 2s
    if (trimmable <= 0) break
    const trim = Math.min(overflow, trimmable)
    durations[lastIdx] = round3(durations[lastIdx] - trim)
    total = round3(total - trim)
    if (trim < overflow) break // last scene can't absorb more — accept slight overflow
  }
  const totalDuration = clamp(round3(total), 8, 90)

  // Scene start offsets (cumulative).
  const sceneStarts: number[] = []
  {
    let cursor = 0
    for (const d of durations) {
      sceneStarts.push(round3(cursor))
      cursor = round3(cursor + d)
    }
  }

  const elements: CreatomateElement[] = []
  const CLIP_GAP_OVERLAP = 0.06 // same #256 micro-overlap as the standard builder

  // KINEO-HOLLYWOOD-30-2026-07-10 — subtle 250ms crossfade between hollywood
  // scene clips ("UM MUNDO": the anchored scenes share one face + one world;
  // the crossfade makes the cuts read as one continuous film instead of hard
  // engine cuts). Mechanics: each non-last clip EXTENDS 0.25s under the next
  // clip (real footage under the blend — the standard builder's #202 fade was
  // removed exactly because non-overlapping clips faded in from the black
  // track-1 background), and each clip after the first fades in over 0.25s
  // via enter_transition (same property the caption 'pop' already uses).
  // Gate: flip HOLLYWOOD_CROSSFADE to false to kill the effect instantly.
  const HOLLYWOOD_CROSSFADE = true
  const HOLLYWOOD_CROSSFADE_SECONDS = 0.25

  // Track 1 — solid background (never show a transparent gap).
  elements.push({
    type: 'shape', track: 1, time: 0, duration: totalDuration,
    x: '50%', y: '50%', width: '100%', height: '100%', fill_color: '#08080f',
  })

  // Track 2 — scenes tiled sequentially, NATIVE AUDIO ON (volume per engine).
  // trim_start intentionally 0: trimming a dialogue clip's head would eat the
  // first spoken word. loop:true fills the slot if an engine returned a clip
  // slightly shorter than planned (robustness, zero dead frames).
  // KINEO-HOLLYWOOD-HOST-2026-07-13 — EXCEPT 'host' clips: their audio is the
  // baked-in speech, so looping would REPLAY the first words. loop:false — if
  // the presenter clip runs a hair short of its slot, the dark track-1
  // background covers the sub-second gap (invisible next to repeated speech).
  cleanClips.forEach((clip, i) => {
    const isLast = i === cleanClips.length - 1
    // Non-last clips run long enough to sit under the next clip's fade-in;
    // the last clip keeps the classic micro-overlap (nothing follows it).
    const overlap = HOLLYWOOD_CROSSFADE && !isLast ? HOLLYWOOD_CROSSFADE_SECONDS : CLIP_GAP_OVERLAP
    elements.push({
      type: 'video',
      track: 2,
      time: sceneStarts[i],
      duration: round3(Math.min(durations[i], totalDuration - sceneStarts[i]) + overlap),
      source: clip.url,
      fit: 'cover',
      loop: clip.engine !== 'host',
      x: '50%', y: '50%', width: '100%', height: '100%',
      volume: HOLLYWOOD_CLIP_VOLUME[clip.engine] ?? '35%',
      ...(HOLLYWOOD_CROSSFADE && i > 0
        ? { enter_transition: { type: 'fade', duration: HOLLYWOOD_CROSSFADE_SECONDS } }
        : {}),
    })
  })

  // Track 3 — readability overlays (same as the standard builder).
  elements.push({
    type: 'shape', track: 3, time: 0, duration: totalDuration,
    x: '50%', y: '50%', width: '100%', height: '100%', fill_color: 'rgba(0,0,0,0.22)',
  })
  elements.push({
    type: 'shape', track: 3, time: 0, duration: totalDuration,
    x: '50%', y: '10%', width: '100%', height: '20%', fill_color: 'rgba(0,0,0,0.55)',
  })
  elements.push({
    type: 'shape', track: 3, time: 0, duration: totalDuration,
    x: '50%', y: '90%', width: '100%', height: '20%', fill_color: 'rgba(0,0,0,0.55)',
  })

  // KINEO-HOLLYWOOD-22-2026-07-10 — UNIFIED COLOR GRADE. The hollywood branch
  // used to SKIP the niche grade on purpose ("realism wants untinted footage").
  // Founder feedback on the 3 real renders overruled that: "é muito visível
  // que está trocando os motores — a qualidade salta entre cenas". Kling 3 and
  // Veo each have their own color science, so a hard cut between engines reads
  // as a quality jump. DECISION: apply the SAME niche-aware grade scheme as
  // AI Gen (#436 + KINEO-FAST-V4) over ALL clips, uniformly (time 0 → total),
  // with the wash ~+0.05 opacity vs AI Gen — strong enough to mask the
  // per-engine look difference, subtle enough to keep the realism. Works with
  // the router's styleSheet (prompt-side); this is the compose-side half.
  // Niche is detected from the video's own words (narration + dialogue lines),
  // since this builder receives no voiceoverScript param.
  const gradeText = [
    ...narrationBlocks.map((b) => b.text ?? ''),
    ...cleanClips.map((c) => `${c.dialogueLine ?? ''} ${c.caption ?? ''}`),
  ]
    .join(' ')
    .toLowerCase()
  const grade = /\b(billionaire|millionaire|wealth|money|invest|luxur|rich|dollar|business)\b/.test(gradeText)
    ? { wash: 'rgba(35,26,8,0.20)',  glow: 'rgba(255,190,80,0.07)' }   // wealth: warm gold
    : /\b(mystery|mysterious|unexplained|vanish|disappear|haunted|secret|creepy)\b/.test(gradeText)
    ? { wash: 'rgba(8,14,40,0.22)',  glow: 'rgba(120,150,255,0.05)' }  // mystery: deep blue
    : /\b(volcano|desert|island|mountain|ocean|country|village|glacier|jungle|crater)\b/.test(gradeText)
    ? { wash: 'rgba(10,32,40,0.19)', glow: 'rgba(255,140,50,0.06)' }   // places: teal/orange doc
    : { wash: 'rgba(12,34,51,0.18)', glow: 'rgba(255,150,60,0.05)' }   // default (#436 palette, +0.05)
  elements.push({
    type: 'shape', track: 3, time: 0, duration: totalDuration,
    x: '50%', y: '50%', width: '100%', height: '100%', fill_color: grade.wash,
  })
  elements.push({
    type: 'shape', track: 3, time: 0, duration: totalDuration,
    x: '50%', y: '48%', width: '70%', height: '55%', fill_color: grade.glow,
  })

  const captionWindowEnd = Math.max(0, totalDuration - CTA_TAIL_SECONDS)

  // Track 4 — narration blocks. Each block's mp3 starts at its scene offset.
  // The audio is capped so it can never run over the NEXT dialogue scene
  // (native speech must stay clean) nor past the timeline end.
  // KINEO-HOLLYWOOD-24-2026-07-10 — blocks are now PER SCENE and additionally
  // capped at their own scene's end (+0.5s tolerance, block.endCap): a short
  // TTS can no longer pool 10s of leftover silence onto a later scene, and a
  // long TTS can no longer talk over the following scene's narration.
  // KINEO-HOLLYWOOD-HOST-2026-07-13 — 'host' scenes carry baked-in speech
  // exactly like dialogue: narration must never run over either of them.
  const dialogueStarts = cleanClips
    .map((c, i) => (c.engine === 'dialogue' || c.engine === 'host' ? sceneStarts[i] : null))
    .filter((v): v is number => v !== null)

  for (const block of narrationBlocks) {
    if (!block.url || !(block.audioDuration > 0)) continue
    const nextDialogue = dialogueStarts.find((t) => t > block.time + 0.05)
    const hardEnd = Math.min(
      nextDialogue ?? totalDuration,
      Number.isFinite(block.endCap) && (block.endCap as number) > block.time ? (block.endCap as number) : totalDuration,
      totalDuration,
    )
    const audioDur = round3(Math.max(0.1, Math.min(block.audioDuration, hardEnd - block.time)))
    if (audioDur <= 0.1) continue
    elements.push({
      type: 'audio', track: 4, time: round3(block.time), duration: audioDur,
      source: block.url, volume: '100%',
    })

    // Track 5 — captions for this narrated block.
    if (Array.isArray(block.words) && block.words.length > 0) {
      // Whisper path: timings are relative to the block mp3 → shift by offset.
      const caps = buildCaptionsFromWhisperWords(block.words, block.audioDuration, 0, 3)
      for (const cap of caps) {
        const t = round3(block.time + cap.time)
        if (t >= captionWindowEnd) continue
        const d = round3(Math.max(0.1, Math.min(cap.duration, captionWindowEnd - t)))
        elements.push(...buildCaptionElements({ text: cap.text, time: t, duration: d, highlight: cap.highlight }))
      }
    } else if (block.text && block.text.trim()) {
      // Proportional fallback within the block window.
      const segments = buildCaptionSegments(block.text, 3)
      const totalWords = segments.reduce((s, seg) => s + Math.max(1, wordCount(seg.text)), 0) || 1
      let elapsed = block.time
      const window = Math.max(1, Math.min(audioDur, captionWindowEnd - block.time))
      for (const seg of segments) {
        const slot = Math.max(0.1, (Math.max(1, wordCount(seg.text)) / totalWords) * window)
        if (elapsed >= captionWindowEnd) break
        elements.push(...buildCaptionElements({
          text: seg.text,
          time: round3(elapsed),
          duration: round3(Math.min(slot, captionWindowEnd - elapsed)),
          highlight: seg.highlight,
        }))
        elapsed = round3(elapsed + slot)
      }
    }
  }

  // Track 5 — captions on DIALOGUE scenes (the person's own voice carries the
  // audio). KINEO-HOLLYWOOD-21-2026-07-10 (bug b): the caption is the REAL
  // spoken line, in ~3-word chunks distributed uniformly across the scene
  // window [start + 0.3s, end - 0.4s] — same visual style as the whisper
  // captions (buildCaptionElements). Fallback when the line is unavailable:
  // the old static scene caption (previous behavior).
  // KINEO-HOLLYWOOD-HOST-2026-07-13 — 'host' scenes caption identically: the
  // clip speaks its dialogueLine (our TTS), so the same chunking applies and,
  // because host slots equal the real audio length, the uniform spread tracks
  // the speech even more closely than on native-audio dialogue scenes.
  cleanClips.forEach((clip, i) => {
    if (clip.engine !== 'dialogue' && clip.engine !== 'host') return
    const t = sceneStarts[i]
    if (t >= captionWindowEnd) return

    const line = (clip.dialogueLine ?? '').trim()
    if (line) {
      const winStart = round3(t + 0.3)
      const winEnd = round3(Math.min(t + durations[i] - 0.4, captionWindowEnd))
      const window = winEnd - winStart
      const segments = buildCaptionSegments(line, 3)
      if (window > 0.5 && segments.length > 0) {
        const slot = window / segments.length
        segments.forEach((seg, k) => {
          const st = round3(winStart + k * slot)
          if (st >= captionWindowEnd) return
          const d = round3(Math.max(0.1, Math.min(slot, captionWindowEnd - st)))
          elements.push(...buildCaptionElements({ text: seg.text, time: st, duration: d, highlight: seg.highlight }))
        })
        return
      }
    }

    const text = (clip.caption ?? '').trim()
    if (!text) return
    const d = round3(Math.max(0.5, Math.min(durations[i] - 0.2, captionWindowEnd - t)))
    elements.push(...buildCaptionElements({ text, time: round3(t), duration: d, highlight: null }))
  })

  // Track 6 — CTA in the final window (identical to the standard builder).
  const ctaTime = Math.max(0, totalDuration - CTA_TAIL_SECONDS)
  elements.push({
    type: 'text', track: 6, time: round3(ctaTime), duration: Math.min(CTA_TAIL_SECONDS, totalDuration),
    text: CTA_TEXT, x: '50%', y: '90%', width: '80%',
    font_family: 'Montserrat', font_size: 30, font_weight: '700',
    fill_color: '#ffffff', stroke_color: 'rgba(99,102,241,0.9)', stroke_width: 2,
  })

  // Track 7 — end card (same rule as the standard builder).
  if (endCard) {
    elements.push({
      type: 'text', track: 7, time: round3(ctaTime), duration: Math.min(CTA_TAIL_SECONDS, totalDuration),
      text: 'Made with Kineo', x: '50%', y: '80%', width: '86%',
      font_family: 'Montserrat', font_size: 44, font_weight: '800',
      fill_color: '#ffffff', stroke_color: 'rgba(99,102,241,0.95)', stroke_width: 3,
      background_color: 'rgba(13,13,20,0.55)',
    })
  }

  // Track 8 — background music intentionally OMITTED: the engines' native
  // audio (voice + ambience) IS the realism; music on top breaks it.

  // Track 9 — watermark (same rule as the standard builder).
  if (watermark) {
    elements.push({
      type: 'text', track: 9, time: 0, duration: totalDuration,
      text: 'usekineo.com', x: '50%', y: '5%', width: '80%',
      font_family: 'Montserrat', font_size: 28, font_weight: '700',
      fill_color: 'rgba(255,255,255,0.6)', stroke_color: 'rgba(0,0,0,0.35)', stroke_width: 1,
    })
  }

  return {
    output_format: 'mp4',
    width: 1080,
    height: 1920,
    frame_rate: 30,
    duration: totalDuration,
    elements,
  }
}
// ── end KINEO-HOLLYWOOD-2026-07-09 ───────────────────────────────────────────

export async function submitCreatomateRender(source: Record<string, unknown>): Promise<string> {
  const key = process.env.CREATOMATE_API_KEY
  if (!key) throw new Error('CREATOMATE_API_KEY is not configured.')

  const res = await fetch(`${CREATOMATE_BASE}/renders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source }),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Creatomate rejected the render (${res.status}): ${text.slice(0, 300)}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Creatomate returned a non-JSON response.')
  }

  const first = Array.isArray(parsed) ? parsed[0] : parsed
  const obj = first as { id?: string } | null
  if (!obj || typeof obj.id !== 'string' || !obj.id) {
    throw new Error('Creatomate returned no render id.')
  }
  return obj.id
}

export async function pollCreatomateRender(renderId: string): Promise<CreatomateRenderState> {
  const key = process.env.CREATOMATE_API_KEY
  if (!key) throw new Error('CREATOMATE_API_KEY is not configured.')

  const res = await fetch(`${CREATOMATE_BASE}/renders/${encodeURIComponent(renderId)}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Creatomate lookup failed (${res.status})`)
  }

  const data = (await res.json()) as {
    status?: string
    url?: string
    snapshot_url?: string
    error_message?: string
    progress?: number
  }

  const raw = (data.status ?? '').toLowerCase()
  let status: CreatomateRenderState['status']
  switch (raw) {
    case 'succeeded':
      status = 'succeeded'
      break
    case 'failed':
      status = 'failed'
      break
    case 'cancelled':
      status = 'cancelled'
      break
    case 'planned':
      status = 'planned'
      break
    case 'waiting':
      status = 'waiting'
      break
    case 'transcribing':
      status = 'transcribing'
      break
    case 'rendering':
      status = 'rendering'
      break
    default:
      status = 'unknown'
  }

  let progress: number
  if (typeof data.progress === 'number' && data.progress >= 0 && data.progress <= 100) {
    progress = Math.round(data.progress)
  } else {
    switch (status) {
      case 'planned':
        progress = 5
        break
      case 'waiting':
        progress = 10
        break
      case 'transcribing':
        progress = 25
        break
      case 'rendering':
        progress = 60
        break
      case 'succeeded':
        progress = 100
        break
      case 'failed':
      case 'cancelled':
        progress = 0
        break
      default:
        progress = 15
    }
  }

  return {
    status,
    progress,
    url: typeof data.url === 'string' ? data.url : null,
    snapshotUrl: typeof data.snapshot_url === 'string' ? data.snapshot_url : null,
    error: typeof data.error_message === 'string' ? data.error_message : null,
  }
}
