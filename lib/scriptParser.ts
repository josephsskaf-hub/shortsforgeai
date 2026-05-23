// Push #235 — User-script parser for Fast Mode.
//
// Root problem this fixes: when a user pastes a fully-authored script that
// already specifies the exact stock footage per beat with `[Pexels: QUERY]`
// markers (and optionally a `speed: 1.05` directive), the old pipeline threw
// all of it away — it truncated the prompt to 400 chars and let GPT invent its
// own scenes, voiceover, and Pexels queries. The result was footage that had
// nothing to do with what the user asked for (e.g. a candle for a rocket
// topic) and narration the user never wrote.
//
// This module extracts the user's intent verbatim so the rest of the Fast Mode
// pipeline can honor it instead of re-generating from scratch.
//
//   parseUserScript(raw) → {
//     hasMarkers,   // true when at least one [Pexels: ...] marker was found
//     segments,     // ordered { voiceover, pexelsQuery } — one per marker
//     narration,    // full spoken text, markers + directives stripped
//     speed,        // parsed "speed: X" directive, or null
//   }

export interface ParsedSegment {
  /** The narration the TTS should speak for this segment (markers stripped). */
  voiceover: string
  /** The exact Pexels search query the user specified for this segment. */
  pexelsQuery: string
}

export interface ParsedScript {
  hasMarkers: boolean
  segments: ParsedSegment[]
  /** Full narration with all markers/directives removed, whitespace collapsed. */
  narration: string
  /** Explicit playback speed from a `speed:` directive (0.7–1.3), or null. */
  speed: number | null
}

// Matches [Pexels: query], [pexels - query], [PEXELS: query], etc. The label is
// case-insensitive and a ':' or '-' separator is optional. Captured group 1 is
// the raw query text.
const PEXELS_MARKER = /\[\s*pexels\s*[:\-–]?\s*([^\]]+?)\s*\]/gi

// Matches a standalone speed directive anywhere in the text:
//   "speed: 1.05", "speed = 1.1", "Speed 0.95"
const SPEED_DIRECTIVE = /\bspeed\s*[:=]?\s*(\d+(?:\.\d+)?)/i

// Lines that are configuration/stage directions, never narration. Dropped from
// the spoken text so the narrator doesn't read "duration 45 seconds" out loud.
// Push #238 adds platform/resolution/orientation and the multi-word "aspect
// ratio" label so a leading metadata header block is stripped line-by-line.
const DIRECTIVE_LINE = /^\s*(speed|duration|voice|music|format|aspect\s*ratio|aspect|ratio|resolution|platform|orientation|style|tone|language|idioma|velocidade)\s*[:=]/i

// Push #238 — video-format spec lines that leak from a user's header block and
// are NEVER narration, e.g. "YouTube Short format, 9:16, 1 legend only",
// "Format: 9:16 vertical", "1 subtitle only". Matches when the line:
//   - contains a 9:16 aspect ratio anywhere ("9:16", "9 : 16") — always a spec,
//   - mentions a "YouTube Short(s) format" directive, or
//   - ends with "<n> legend(s) only" / "subtitle(s) only".
// Kept deliberately narrow so ordinary narration that merely says "YouTube" or
// "format" survives.
const FORMAT_SPEC_LINE = /\b9\s*:\s*16\b|youtube\s+shorts?\s+format|\b(legends?|subtitles?)\s+only\s*[.!]?$/i

// A line that's nothing but dash/em-dash/en-dash decoration ("———", "-----").
const DASH_ONLY_LINE = /^[\s—–-]+$/
// Markdown header line ("## HOOK", "# Introduction").
const MARKDOWN_HEADER_LINE = /^\s*#{1,6}\s+\S/
// Strips an em-dash/en-dash/hyphen fence from both ends ("— HOOK —" → "HOOK").
const FENCED_LINE = /^[—–-]{1,3}\s*([\s\S]*?)\s*[—–-]{1,3}$/
// Push #240 — an editing bullet point ("- Total length: ~52s", "- ZERO black
// frames"). Hyphen + space + text. Never narration. Note: section headers that
// use a hyphen fence ("- HOOK -") are detected as headers BEFORE this rule runs
// in cleanNarration, so this never swallows a header.
const BULLET_LINE = /^\s*-\s+\S/

// Push #240 — section-aware parsing.
//
// A user's full template is divided into named sections fenced like "— HOOK —"
// or "— VOICE (ElevenLabs) —". Some sections are NARRATION (their body text is
// spoken) and some are METADATA (their body is production notes that must never
// be spoken or captioned). The old line-by-line filter missed the metadata
// section bodies because the headers carry mixed-case parentheticals ("VOICE
// (ElevenLabs)", "EDITING (CapCut)") that defeat the ALL-CAPS heuristic, so the
// header AND its content leaked into the narration.
//
// These are the metadata-only section names (normalized: lowercased, dashes →
// spaces, parentheticals and digits stripped). When the parser enters one of
// these sections it drops every line until the next named section header.
const NON_NARRATION_SECTION_KEYWORDS = new Set([
  'on screen legend',
  'legend',
  'voice',
  'editing',
  'capcut',
  'elevenlabs',
  'notes',
  'instructions',
])

/**
 * Normalize a section header body for keyword matching: lowercase, strip
 * parentheticals ("(1 only)", "(ElevenLabs)"), strip digits ("MICRO
 * RECOMPENSA 1" → "micro recompensa"), turn dashes into spaces ("ON-SCREEN" →
 * "on screen"), and collapse whitespace.
 */
function normalizeSectionName(body: string): string {
  return body
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[0-9]+/g, ' ')
    .replace(/[—–-]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * If `line` is a named section header ("— HOOK —", "## VOICE", "- CTA -"),
 * return its normalized name; otherwise null. Pure dash decoration ("———") is
 * NOT a named header — it returns null so it can't reset the section mode.
 */
function sectionHeaderName(line: string): string | null {
  const t = line.trim()
  if (!t) return null
  if (DASH_ONLY_LINE.test(t)) return null
  let body: string | null = null
  const fenced = FENCED_LINE.exec(t)
  if (fenced) {
    body = fenced[1]
  } else if (MARKDOWN_HEADER_LINE.test(t)) {
    body = t.replace(/^#{1,6}\s*/, '')
  }
  if (body === null) return null
  return normalizeSectionName(body)
}

/**
 * True when a (normalized) section name is a metadata-only section whose body
 * must be dropped. Matches an exact keyword, a multi-word keyword as a
 * substring, or a single-word keyword as a whole word (so compound headers like
 * "voiceover notes" still match "notes" without "legend" matching "legendary").
 */
function isNonNarrationSection(name: string): boolean {
  if (!name) return false
  if (NON_NARRATION_SECTION_KEYWORDS.has(name)) return true
  const words = name.split(' ')
  for (const kw of NON_NARRATION_SECTION_KEYWORDS) {
    if (kw.includes(' ')) {
      if (name.includes(kw)) return true
    } else if (words.includes(kw)) {
      return true
    }
  }
  return false
}

/**
 * Push #237 — true when a line is a section header / stage direction rather than
 * narration, so it must be dropped before the text is spoken or captioned.
 * Catches:
 *   - directive lines      (speed:/duration:/voice:/format:/platform:/...)  [DIRECTIVE_LINE]
 *   - format spec lines    ("YouTube Short format, 9:16, 1 legend only")    [FORMAT_SPEC_LINE]
 *   - markdown headers     ("## HOOK", "# Introduction")
 *   - dash-only separators ("———", "-----")
 *   - em-dash headers      ("— MICRO RECOMPENSA —", "— CTA —", "- HOOK -")
 *   - ALL-CAPS stage cues  ("HOOK", "CTA", "BEAT 1", "SCENE 1", "BEAT 1:")
 *
 * An ALL-CAPS cue is detected as: after stripping any surrounding dash fence and
 * leading markdown hashes, the remainder has an uppercase letter and NO lowercase
 * letter — so normal sentence-case narration is never removed. Handles both the
 * em-dash "—" and regular hyphen "-" fence variants.
 */
function isDroppableLine(line: string): boolean {
  if (DIRECTIVE_LINE.test(line)) return true
  if (FORMAT_SPEC_LINE.test(line)) return true
  const t = line.trim()
  if (!t) return false
  if (DASH_ONLY_LINE.test(t)) return true
  if (BULLET_LINE.test(t)) return true
  if (MARKDOWN_HEADER_LINE.test(t)) return true
  const fenced = FENCED_LINE.exec(t)
  const body = (fenced ? fenced[1] : t).replace(/^#{1,6}\s*/, '').trim()
  if (!body) return Boolean(fenced)
  return /[A-Z]/.test(body) && !/[a-z]/.test(body)
}

/**
 * Strip residual bracketed directions (e.g. [HOOK], [Scene 2], leftover
 * markers), directive / section-header / stage-direction lines, metadata
 * section bodies, and collapse whitespace. Turns a raw narration chunk into
 * clean spoken text.
 *
 * Push #240 — section-aware. Walks the lines tracking whether we're inside a
 * metadata-only section ("— VOICE —", "— EDITING —", "— ON-SCREEN LEGEND —").
 * A named section header always drops the header line itself and either enters
 * (metadata) or exits (narration) metadata mode; while in metadata mode EVERY
 * line is dropped until the next named header. Dash-only decoration does not
 * change the mode. This handles mixed-case headers like "VOICE (ElevenLabs)"
 * that the ALL-CAPS line heuristic could not catch.
 */
function cleanNarration(raw: string): string {
  const kept: string[] = []
  let inMetadataSection = false
  for (const line of raw.split(/\r?\n/)) {
    const section = sectionHeaderName(line)
    if (section !== null) {
      // Named header: drop the header line, switch mode based on its kind.
      inMetadataSection = isNonNarrationSection(section)
      continue
    }
    if (inMetadataSection) continue
    if (isDroppableLine(line)) continue
    kept.push(line)
  }
  return kept
    .join(' ')
    // Remove any remaining bracketed stage directions / markers.
    .replace(/\[[^\]]*\]/g, ' ')
    // Drop markdown emphasis the TTS would otherwise vocalize oddly.
    .replace(/[*_`#>]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Push #236 — public, idempotent sanitizer for the TTS / caption boundary.
 *
 * Strips every bracketed marker ([Pexels: ...], [Scene 2], [HOOK], [Beat], ...),
 * drops standalone directive lines (speed:/duration:/voice:/music:/...), and
 * removes markdown emphasis so the narrator can never vocalize a stage
 * direction. This is the single function every narration path should pass
 * through before it is spoken or rendered as a caption.
 *
 * Why this exists: in some fall-back paths the RAW user prompt (markers and
 * all) reached OpenAI TTS, so the voice read "[Pexels: rocket launch]" aloud.
 * Running this at each TTS call site guarantees clean speech regardless of how
 * the script was assembled. Safe to call on already-clean text — idempotent.
 */
export function stripScriptMarkers(raw: string): string {
  return cleanNarration((raw ?? '').toString())
}

/**
 * Parse a clamped speed value from the raw script, or null when absent.
 * Clamped to the same 0.7–1.3 band generateTTS() accepts so an out-of-range
 * directive can't push the voice into unnatural territory.
 */
export function parseSpeed(raw: string): number | null {
  const m = (raw ?? '').match(SPEED_DIRECTIVE)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.max(0.7, Math.min(1.3, n))
}

export function parseUserScript(raw: string): ParsedScript {
  const text = (raw ?? '').toString()
  const speed = parseSpeed(text)

  // Walk the text marker-by-marker. The narration that PRECEDES each marker is
  // the spoken line for that marker's clip — this matches the natural authoring
  // format ("<narration> [Pexels: <query>]"). Any narration trailing the last
  // marker is appended to the final segment so it isn't lost.
  const segments: ParsedSegment[] = []
  let lastIndex = 0
  let m: RegExpExecArray | null
  PEXELS_MARKER.lastIndex = 0
  while ((m = PEXELS_MARKER.exec(text)) !== null) {
    const precedingRaw = text.slice(lastIndex, m.index)
    const voiceover = cleanNarration(precedingRaw)
    const pexelsQuery = m[1].replace(/\s{2,}/g, ' ').trim()
    if (pexelsQuery) {
      segments.push({ voiceover, pexelsQuery })
    }
    lastIndex = PEXELS_MARKER.lastIndex
  }

  const hasMarkers = segments.length > 0

  // Trailing narration after the final marker → append to the last segment so
  // its spoken line is complete.
  if (hasMarkers) {
    const trailing = cleanNarration(text.slice(lastIndex))
    if (trailing) {
      const last = segments[segments.length - 1]
      last.voiceover = [last.voiceover, trailing].filter(Boolean).join(' ').trim()
    }
    // A leading segment whose narration is empty (marker before any narration)
    // still keeps its query — the visual is what matters; its voiceover may be
    // filled by the next beat. We leave empty voiceovers as-is here and let the
    // narration field below carry the full spoken text.
  }

  const narration = cleanNarration(text)

  return { hasMarkers, segments, narration, speed }
}
