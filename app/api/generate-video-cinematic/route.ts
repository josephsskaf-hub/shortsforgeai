// Push #315 — Cinematic Mode: fal.ai Wan 2.1 AI video generation.
// Submits each scene to fal.ai queue (async), returns request IDs immediately.
// Client polls /api/cinematic-clip-status until all clips are ready, then
// hands off to /api/compose exactly like Fast Mode. Cost: 3 credits.
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { generateScenes, shortCaptionFromVoiceover } from '@/lib/runway'
import { parseUserScript } from '@/lib/scriptParser'
import { openai } from '@/lib/openai'
import { fal } from '@fal-ai/client'
// KINEO-HOLLYWOOD-2026-07-09 — Hollywood Mode 2.0: per-scene engine routing
// with native audio. KINEO-HOLLYWOOD-22-2026-07-10: Kling3 dialogue+support /
// Veo3.1 cinematic (1-2 epic shots max) — Seedance is OUT (visual coherence).
// KINEO-HOLLYWOOD-30-2026-07-10 — HOLLYWOOD 3.0 "UM MUNDO": two image anchors
// (canonical presenter portrait + empty environment still) generated BEFORE
// the scenes; every scene then runs Kling O3 Pro IMAGE-to-video seeded with
// its anchor → same face + same world across every cut. Fail-open: no anchors
// → the v2.4 t2v path below runs unchanged.
import {
  HOLLYWOOD_MODELS,
  KLING3_I2V_MODEL,
  mentionsRealPerson,
  planHollywoodScenes,
  logHollywoodCost,
  type HollywoodPlan,
} from '@/lib/hollywood/router'
import { generateHollywoodAnchors, ANCHORS_USD, type HollywoodAnchors } from '@/lib/hollywood/anchors'
// KINEO-HOLLYWOOD-HOST-2026-07-13 — HOLLYWOOD HOST MODE v3.5: anchored
// dialogue scenes get ONE voice. The scene's line is synthesized with OUR TTS
// (same persona the compose narration resolves — see lib/hollywood/hostVoice)
// and lip-synced onto the canonical portrait via Kling AI Avatar v2 (the AI
// Presenter engine, $0.0562/s vs O3's $0.168/s). ANY failure on this path
// falls back per-scene to the O3 i2v native-audio submit below (v3.0).
import {
  buildHostPerformancePrompt,
  resolveHollywoodVoice,
  synthesizeHostSpeech,
  type HollywoodVoice,
} from '@/lib/hollywood/hostVoice'
import { PRESENTER_MODEL as HOST_PRESENTER_MODEL, submitAvatarJob } from '@/lib/avatar/veed'
import { estimateMp3DurationSeconds, uploadVoiceoverToSupabase } from '@/lib/compose'

export const maxDuration = 60

// Push #402 — two user-selectable engines with different credit costs.
// KINEO-REBASE-2026-07-10 — CREDIT REBASE 2:1: every engine cost divided by 2
// (Seedance 40→20, Kling 90→45, Veo 180→90, Sora 200→100). USD value per video
// is unchanged because plan credits halved in lockstep (lib/pricing.ts).
// Free trial only ever uses Seedance.
const SEEDANCE_CREDIT_COST = 20
const KLING_CREDIT_COST = 50 // KINEO-PRICING-V3B-2026-07-10 — 45 → 50 cr (margin bump). Keep in sync with creditCostFor('cinematic_kling') in compose/status.
// Push #489/#491 — premium cinematic engines (Veo 3.1 Fast, Sora 2) via fal.
// KINEO-REBASE-2026-07-10 — 90/100 new credits = 180/200 old (same USD value).
const VEO_CREDIT_COST = 90
const SORA_CREDIT_COST = 100 // Sora segue BLOQUEADO (KINEO-SORA-REMOVED) — valor só por consistência.
// KINEO-HOLLYWOOD-22-2026-07-10 — custo real: support saiu do Seedance
// ($0.052/s) e foi pro Kling 3 ($0.168/s) pela coerência visual. Típico 55s
// ≈ $8.90-10.20 (Hollywood 3.0 i2v).
// KINEO-REBASE-2026-07-10 — HOLLYWOOD = 150 créditos: preço FINAL aprovado 10/07
// (equivale a 300 old-credits ≈ $28 de crédito → margem saudável sobre ~$10 de fal).
const HOLLYWOOD_CREDIT_COST = 150

// fal.ai model — Wan 2.5 text-to-video (commercial, supports 9:16, $0.05/s).
// #368 — Seedance 1.5 Pro. The earlier 'submit error' (#366) was fal EXHAUSTED
// BALANCE (403 'User is locked'), NOT a param/access bug — confirmed via the
// detailed error log. With balance topped up, re-enabling Seedance: better
// visual quality, ~48% cheaper than Wan ($0.13 vs $0.25/clip @720p no audio),
// faster (~30-45s/clip). Same { video: { url } } output. Fallback = Wan.
const SEEDANCE_MODEL = 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video'
// Push #401 — premium engine for the Pro plan. Kling 2.5 Turbo Pro is more
// cinematic (motion/physics/prompt adherence) than Seedance. Same { video: { url } }
// output shape. Kling has no `resolution`/`generate_audio` params and is silent
// by default, so our TTS narration (added in compose) stays the only audio.
const KLING_MODEL = 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video'
// Push #489 — Veo 3.1 Fast: Google's cinematic text-to-video on fal. 9:16, 8s,
// audio off; identical { video: { url } } output, same fal.queue submit/poll.
const VEO_MODEL = 'fal-ai/veo3.1/fast'
// Push #491 — Sora 2 (OpenAI) text-to-video on fal. Same { video: { url } }
// output + fal.queue pattern. Has native audio, but compose mutes every clip
// track (volume 0%), so the TTS narration stays the only audio.
const SORA_MODEL = 'fal-ai/sora-2/text-to-video'
// KINEO-HOLLYWOOD-2026-07-09 — Kling 3 Pro (native voice + lip sync) drives
// the Hollywood dialogue scenes. Same { video: { url } } output + fal.queue.
const KLING3_MODEL = HOLLYWOOD_MODELS.dialogue
// Back-compat: other modules import FAL_MODEL.
const FAL_MODEL = SEEDANCE_MODEL

// KINEO-FAL-ALARM-2026-07-06 — never break silently on an exhausted fal balance.
// submitToFal flips this when fal reports "User is locked / exhausted balance";
// the POST handler then (a) e-mails the founder and (b) returns a soft "queued"
// response instead of a dead 502. Reset at the top of every POST.
let FAL_EXHAUSTED = false
function looksExhausted(e: { status?: number; message?: string; body?: unknown }): boolean {
  const blob = `${e?.message ?? ''} ${JSON.stringify(e?.body ?? '')}`.toLowerCase()
  return e?.status === 403 || /exhaust|locked|insufficient|balance|quota|payment/.test(blob)
}
// Fire-and-forget founder alert via Resend. Throttled to once per 30 min via a
// module timestamp so a burst of failures doesn't spam the inbox.
let LAST_FAL_ALERT = 0
async function alertFalExhausted(context: string): Promise<void> {
  try {
    const key = process.env.RESEND_API_KEY
    if (!key || key === 'your_resend_api_key_here') return
    const now = Date.now()
    if (now - LAST_FAL_ALERT < 30 * 60 * 1000) return
    LAST_FAL_ALERT = now
    const from = process.env.RESEND_FROM_EMAIL || 'Kineo <support@usekineo.com>'
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: ['josephsskaf@gmail.com'],
        subject: '🚨 Kineo: fal.ai balance EXHAUSTED — AI videos are failing',
        text: `The fal.ai balance is exhausted — AI (Seedance/Kling/Veo) renders are failing RIGHT NOW and users are seeing the "high demand" queue message instead of a video.\n\nContext: ${context}\nTime: ${new Date().toISOString()}\n\nRecharge fal.ai to restore AI generation: https://fal.ai/dashboard/billing`,
      }),
    })
    console.error('[cinematic] FAL BALANCE EXHAUSTED — founder alerted')
  } catch (e) {
    console.error('[cinematic] fal alert email failed:', e instanceof Error ? e.message : String(e))
  }
}

// KINEO-SEEDANCE-720-CREATOR-2026-07-06 — margin fix. Seedance v1.5 pro at 1080p
// runs ~$0.62-0.74/clip on fal; a Creator video is 6-9 clips, which breaks the
// Creator ($24.90/240cr → $0.59/clip break-even). Dropping Seedance to 720p
// (~$0.26/clip) is imperceptible on a 9:16 phone Short and keeps Creator safely
// profitable. Studio keeps 1080p as its premium differentiator (hd=true).
// Build the per-model fal input (params differ between Seedance and Kling).
// KINEO-HOLLYWOOD-2026-07-09 — `hollywood` flips the audio-on variants: clips
// carry NATIVE audio (voice/ambience) instead of being silent for TTS-over.
// `seconds` = planned scene length (support scenes only; dialogue/cinematic are
// fixed at 10s/8s by their engines). Defaults keep every existing call intact.
// KINEO-HOLLYWOOD-30-2026-07-10 — `imageUrl` (optional): the anchor image for
// the Kling O3 Pro image-to-video branch (Hollywood 3.0). Unused by every
// other model — all existing calls stay byte-identical.
function buildFalInput(
  model: string,
  prompt: string,
  hd: boolean = true,
  hollywood: boolean = false,
  seconds?: number,
  imageUrl?: string,
): Record<string, unknown> {
  // KINEO-HOLLYWOOD-30-2026-07-10 — HOLLYWOOD 3.0 anchored scenes. Kling O3
  // Pro image-to-video: `image_url` (confirmed — NOT `start_image_url`) is the
  // canonical portrait (dialogue) or the environment still (support/
  // cinematic); duration is a STRING '3'..'15' (scene seconds are 5/8/10, all
  // in range — passed EXACTLY, no 5|10 snap: i2v bills per second, $0.168/s
  // audio-on); generate_audio true (dialogue speaks its quoted line natively,
  // b-roll gets ambience). Aspect follows the 9:16 anchor image, so no
  // aspect_ratio param. Only the confirmed params are sent (no negative_prompt
  // — the zero-readable-text rule rides in the prompt suffix from the router).
  if (model === KLING3_I2V_MODEL) {
    const sec = Math.max(3, Math.min(15, Math.round(typeof seconds === 'number' && seconds > 0 ? seconds : 10)))
    return {
      image_url: imageUrl,
      prompt,
      duration: String(sec),
      generate_audio: true,
    }
  }
  // KINEO-HOLLYWOOD-2026-07-09 — Kling 3 Pro dialogue scenes: 9:16, native
  // audio ON (the model generates the character's voice + lip sync from the
  // quoted line inside the prompt). No people-banning negative prompt here —
  // fictional people are the POINT of Hollywood Mode.
  // KINEO-HOLLYWOOD-21-2026-07-10 (bug a) — duration follows the planned scene
  // seconds (5 or 10, sized to the dialogue line by the router; default 10) so
  // a short line never leaves the person mute for half the clip.
  // KINEO-HOLLYWOOD-21-2026-07-10 (bug d) — anti-Chinese-text terms appended to
  // the EXISTING negative_prompt (Kling 3 is a Chinese model; on-screen text
  // renders in Chinese).
  // KINEO-HOLLYWOOD-22-2026-07-10 — this branch now ALSO serves hollywood
  // 'support' scenes (Seedance is out): same model, prompt is visual-only (no
  // quoted line), so generate_audio:true yields ambient sound, not speech.
  // Duration snap ≤6s→'5' covers both dialogue (exact 5|10) and support.
  if (model === KLING3_MODEL) {
    return {
      prompt,
      duration: typeof seconds === 'number' && seconds <= 6 ? '5' : '10',
      aspect_ratio: '9:16',
      generate_audio: true,
      negative_prompt: 'cartoon, anime, illustration, 3d render, blur, distort, low quality, watermark, text, logo, caption, chinese text, foreign text, on-screen text, readable signs, subtitles, captions, phone screen with text',
    }
  }
  if (model === SORA_MODEL) {
    return {
      prompt,
      aspect_ratio: '9:16',
      resolution: '720p',
      duration: 8,
    }
  }
  if (model === VEO_MODEL) {
    // KINEO-HOLLYWOOD-2026-07-09 — Hollywood cinematic scenes: native ambient
    // audio ON, and NO people ban in the negative prompt (fictional people are
    // allowed in Hollywood Mode). The classic faceless Veo path is unchanged.
    if (hollywood) {
      // KINEO-HOLLYWOOD-21-2026-07-10 (bug d) — anti-on-screen-text terms
      // appended to the existing negative_prompt.
      return {
        prompt,
        aspect_ratio: '9:16',
        duration: '8s',
        resolution: '720p',
        generate_audio: true,
        negative_prompt: 'cartoon, anime, illustration, 3d render, blur, distort, low quality, watermark, text, logo, caption, chinese text, foreign text, on-screen text, readable signs, subtitles, captions, phone screen with text',
      }
    }
    return {
      prompt,
      aspect_ratio: '9:16',
      duration: '8s',
      // KINEO-VEO-720-2026-07-06 — Veo 3.1 Fast at 720p (~$0.10-0.15/s) instead of
      // 1080p to keep Studio margin healthy; 9:16 phone Short = imperceptible.
      resolution: '720p',
      generate_audio: false,
      negative_prompt: 'human face, person, people, crowd, cartoon, anime, illustration, 3d render, blur, distort, low quality, watermark, text, logo, caption',
    }
  }
  if (model === KLING_MODEL) {
    return {
      prompt,
      duration: '10',
      aspect_ratio: '9:16',
      negative_prompt: 'people, person, human, face, crowd, logo, caption, blur, distort, low quality, watermark, text',
      cfg_scale: 0.6,
    }
  }
  // KINEO-HOLLYWOOD-2026-07-09 — Hollywood support scenes on Seedance: native
  // ambient audio ON + duration follows the planned scene length (Seedance
  // accepts 5s/10s — round down to 5 only for short closers). Classic path below
  // is untouched.
  // KINEO-HOLLYWOOD-22-2026-07-10 — UNREACHABLE for hollywood since support
  // moved to Kling 3 (KLING3_MODEL branch above). Kept as-is in case support
  // ever needs to fall back to Seedance for cost reasons.
  if (hollywood) {
    // KINEO-HOLLYWOOD-21-2026-07-10 (bug d) — Seedance v1.5 pro has NO
    // negative_prompt param (verified against the fal schema in #440; adding
    // one risks a 422). The zero-readable-text rule rides in the POSITIVE
    // prompt suffix the router appends to every scene.
    return {
      prompt,
      aspect_ratio: '9:16',
      resolution: '720p',
      duration: typeof seconds === 'number' && seconds <= 6 ? '5' : '10',
      generate_audio: true,
    }
  }
  // Seedance (default). KINEO-SEEDANCE-720-CREATOR-2026-07-06: resolution follows
  // the plan — Studio (hd=true) = 1080p premium, Creator/credit-payers = 720p.
  return {
    prompt,
    aspect_ratio: '9:16',
    resolution: hd ? '1080p' : '720p',
    duration: '10',
    generate_audio: false,
  }
}

// #440 — AI Gen "random person" fix. The fal prompt used to be the raw stock
// SEARCH query (e.g. "luxury penthouse interior", "businessman office"), which
// is keyword soup for a text-to-video model. Seedance fills the empty scene by
// inventing an unrelated human — the random "japanese man" that showed up in an
// Elon Musk video. Seedance v1.5 pro has NO negative_prompt param (verified
// against the fal schema), so the positive prompt is the only lever. We (1)
// strip identity-bearing person nouns that make the model spawn a stranger and
// (2) force faceless, environment-first b-roll — which is exactly this channel's
// faceless brand. Hands/silhouettes/crowds-from-behind still render fine via the
// environment framing; what we kill is the random foreground face.
const PERSON_NOUN_RE =
  /\b(?:(?:a|an|the)\s+)?(?:(?:random|generic|young|old|asian|white|black|european|american|middle[-\s]?aged)\s+)*(?:businessman|businesswoman|man|woman|men|women|person|persons|people|guy|guys|boy|boys|girl|girls|lady|ladies|gentleman|ceo|entrepreneur|trader|crowd|family|child|children|kid|kids|student|students)s?\b/gi

// KINEO-ERA-LOCK-2026-07-09 (system-level, not GPT-dependent) — real failure:
// a Battle of Waterloo (1815) video rendered TANKS on the field and a made-up
// "Napoleon" face (frame-checked by Joseph, sent to a live Upwork client).
// Prompt-side instructions in analyze-idea help but the model/GPT can ignore
// words — so this is enforced IN CODE on every prompt before it reaches fal:
//  (a) NAMED_FIGURE_RE: titled/famous historical names become a silhouetted
//      figure seen from behind (AI can never match a real likeness anyway);
//  (b) eraLockSuffix(): if the script mentions a pre-1940 year or era word,
//      every scene prompt gets a hard period-accuracy tail (Seedance has no
//      negative_prompt param, so the positive prompt is the only lever).
const NAMED_FIGURE_RE =
  /\b(?:(?:emperor|general|marshal|king|queen|tsar|czar|president|commander|colonel|admiral|captain|duke|lord|sir|kaiser|pharaoh)\s+[A-Z][\w'-]+|napoleon(?:\s+bonaparte)?|bonaparte|wellington|hitler|stalin|churchill|caesar|cleopatra|genghis\s+khan|alexander\s+the\s+great|abraham\s+lincoln|george\s+washington|joan\s+of\s+arc)\b/gi

const ERA_YEAR_RE = /\b1[0-8][0-9]{2}\b|\b19[0-3][0-9]\b/ // years 1000–1939
const ERA_WORD_RE =
  /\b(ancient|medieval|middle\s+ages|renaissance|victorian|napoleonic|roman\s+empire|byzantine|colonial\s+era|civil\s+war|revolutionary\s+war|b\.?c\.?e?\b|\d{1,2}(?:st|nd|rd|th)\s+century)\b/i

function eraLockSuffix(context: string): string {
  const ctx = (context || '').slice(0, 4000)
  const yearMatch = ctx.match(ERA_YEAR_RE)
  if (!yearMatch && !ERA_WORD_RE.test(ctx)) return ''
  const era = yearMatch ? `the year ${yearMatch[0]}` : 'the historical era being narrated'
  return (
    `, period piece set strictly in ${era}, only historically accurate clothing, weapons, ` +
    `vehicles and architecture from that exact time, absolutely no modern objects, no tanks, ` +
    `no cars, no trucks, no modern military vehicles, no modern weapons, no modern uniforms, ` +
    `no power lines, no asphalt, no plastic`
  )
}

function buildFacelessCinematicPrompt(raw: string): string {
  let s = (raw || '').replace(/\s+/g, ' ').trim()
  s = s
    // Named historical figures → silhouette from behind (never a face).
    .replace(NAMED_FIGURE_RE, 'a distant silhouetted figure seen from behind')
    .replace(PERSON_NOUN_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.;:–-]+/, '')
    .trim()
  if (s.length < 3) s = 'cinematic establishing environment shot'
  return (
    `${s}, faceless cinematic b-roll, empty scene focused on the environment, ` +
    `objects and scenery, no people, no human faces, documentary establishing shot, ` +
    `photorealistic, ultra-detailed, dramatic cinematic lighting, smooth camera motion, ` +
    `9:16 vertical, subject framed in the upper two-thirds with the lower third clear for captions, no text, no watermark, no logo`
  )
}

// #441 — AI Gen quality. The verbatim path (default flow: auto-structured
// script with [Pexels:] markers) had NO cinematic description — both the
// description and the query were the raw stock-search keywords, which produce
// flat, incoherent AI video (and invite the random-person bug). This turns each
// scene's NARRATION into one real cinematic SHOT description for Seedance, so
// the model gets a shot to direct instead of keyword soup. One gpt-4o-mini call
// for all scenes; on any failure the caller falls back to the query (no
// regression). Faceless by instruction AND re-enforced by buildFacelessCinematicPrompt.
async function generateCinematicDescriptions(
  scenes: { voiceover: string; stockSearchQuery?: string; description: string }[],
  topic: string,
): Promise<string[]> {
  const list = scenes
    .map((s, i) => {
      const vo = (s.voiceover || '').trim()
      const hint = (s.stockSearchQuery || s.description || '').trim()
      return `Scene ${i + 1}:\n  narration: ${vo || '(none)'}\n  visual hint: ${hint || '(none)'}`
    })
    .join('\n\n')

  const system = `You are a cinematographer for a FACELESS documentary-style YouTube Shorts channel. For each scene's narration line, write ONE vivid cinematic SHOT description (12-24 words) to feed a text-to-video AI.

RULES:
- Anchor the shot on the LITERAL subject of that scene's narration (the exact place, object, event, number, or concept being said).
- FACELESS only: show environment, landscapes, architecture, money, screens, objects, hands, or silhouettes/crowds seen from behind or far away. NEVER an identifiable person or face in the foreground. Never invent a random human to fill the scene.
- Include a camera move (aerial, slow push-in, tracking, pan, or macro), plus lighting and mood.
- VARY the camera move and framing across scenes — do not repeat the same shot type; rotate aerial / tracking / slow push-in / macro / wide / low-angle.
- Keep ONE consistent look across all scenes: same dark cinematic mood, color palette and lighting, as if from the same film.
- Frame the subject in the upper two-thirds; keep the lower third uncluttered for on-screen captions.
- Vertical 9:16, cinematic, photorealistic. No on-screen text, captions, or logos.
- Output ONLY valid JSON: { "descriptions": ["...", "..."] } with EXACTLY ${scenes.length} items, in scene order.`

  const userMsg = `Topic: ${topic.slice(0, 200)}\n\nScenes:\n${list}`

  const completion = await openai.chat.completions.create(
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMsg },
      ],
      temperature: 0.6,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    },
    { timeout: 15000, maxRetries: 0 },
  )

  const raw = completion.choices[0]?.message?.content?.trim() ?? ''
  if (!raw) return []
  const data = JSON.parse(raw) as { descriptions?: unknown }
  const arr = Array.isArray(data.descriptions) ? data.descriptions : []
  return arr.map((d) => (typeof d === 'string' ? d.trim() : ''))
}

// #369 — clip count = ceil(duration/9), capped 2..6. One ~9-10s clip per
// timeline slot so a 45s video gets 5 distinct clips and a 60s video gets 6
// (no looping/repetition in compose).
// Push #445 — cap raised 6→9. AI Gen clips are unique ~10s gens; a 60s video
// needs ~6-7 and a 90s needs ~9 distinct clips so compose (CLIP_LEN=10 for AI
// Gen) can cover the whole timeline without recycling/repeating. 45s→5, 60s→7,
// 90s→9 (was all capped at 6, which forced repetition on longer videos).
function clipCountForDuration(d: number): number {
  return Math.max(2, Math.min(9, Math.ceil(d / 9)))
}

// KINEO-HOLLYWOOD-2026-07-09 — `hollywood`/`seconds` forwarded to buildFalInput
// (audio-on variants); defaults keep every existing call byte-identical.
// KINEO-HOLLYWOOD-30-2026-07-10 — `imageUrl` forwarded to buildFalInput (Kling
// O3 i2v anchor); default keeps every existing call byte-identical.
async function submitToFal(prompt: string, model: string = SEEDANCE_MODEL, hd: boolean = true, hollywood: boolean = false, seconds?: number, imageUrl?: string): Promise<string | null> {
  const falKey = process.env.FAL_KEY
  if (!falKey) return null

  try {
    fal.config({ credentials: falKey })
    const { request_id } = await fal.queue.submit(model, {
      input: buildFalInput(model, prompt, hd, hollywood, seconds, imageUrl),
    })
    return request_id ?? null
  } catch (err) {
    // #366 — surface the FULL fal error (status + body + message) so a model /
    // param / access issue is diagnosable straight from Vercel logs (the bare
    // object stringified to "[object]" before, hiding the real cause).
    const e = err as { status?: number; body?: unknown; message?: string; name?: string }
    console.error('[cinematic] fal.ai submit error:', JSON.stringify({
      name: e?.name, status: e?.status, message: e?.message, body: e?.body,
    }))
    // KINEO-FAL-ALARM-2026-07-06 — flag an exhausted-balance failure so the POST
    // handler alerts the founder + soft-queues instead of hard-erroring.
    if (looksExhausted(e)) FAL_EXHAUSTED = true
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    FAL_EXHAUSTED = false // KINEO-FAL-ALARM — reset per request
    if (!process.env.FAL_KEY) {
      return NextResponse.json(
        { error: 'Cinematic mode is not configured. Please contact support.' },
        { status: 500 }
      )
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    // KINEO-HOLLYWOOD-2026-07-09 — `language` accepted (already sent by the
    // client) so the Hollywood planner knows the input language.
    // KINEO-CHARACTER-LOCK-2026-07-10 — characterId: a saved character (My
    // Characters) whose portrait replaces the generated Hollywood PORTRAIT
    // anchor → the SAME person appears across every video the user makes.
    // KINEO-HOLLYWOOD-HOST-2026-07-13 — two new OPTIONAL fields (absent →
    // byte-identical behavior): `vertical` (the analyze-idea niche, forwarded
    // by the client) pins the SAME narrator persona here and in /api/compose;
    // `brollScenes[].userFootageUrl` (My Footage, same contract as
    // generate-video-fast) is the prepared hook for demo scenes using the
    // user's own clips.
    let body: { prompt?: string; duration?: number; engine?: string; language?: string; vertical?: string; characterId?: string; brollScenes?: Array<{ sceneNumber?: number; brollPrompt?: string; shotType?: string; negativePrompt?: string; userFootageUrl?: string }>; globalStyle?: { mood?: string; lighting?: string; cameraStyle?: string } }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const prompt = (body.prompt ?? '').trim()
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 })
    }

    const duration = Number(body.duration) || 45
    // L2B - smart BrollPlan threaded from the client
    const planScenes = Array.isArray(body.brollScenes) ? body.brollScenes : []
    const gStyle = body.globalStyle
    const styleSuffix = gStyle && (gStyle.mood || gStyle.lighting || gStyle.cameraStyle) ? `, ${[gStyle.mood, gStyle.lighting, gStyle.cameraStyle].filter(Boolean).join(', ')}, consistent color grade across all scenes` : ''
    // #442 — base clip count on the selected duration for now; in verbatim mode
    // we re-size it to the actual SCRIPT length below (the video follows the
    // script, not the button), so footage always covers the narration.
    let clipCount = clipCountForDuration(duration)
    // Push #402 — explicit engine choice from the UI. 'kling' = Cinematic AI
    // (50 cr); anything else = AI Generated (Seedance, 20 cr).
    const wantsKling = body.engine === 'kling'
    const wantsVeo = body.engine === 'veo'
    const wantsSora = body.engine === 'sora'
    // KINEO-HOLLYWOOD-2026-07-09 — Hollywood Mode 2.0 (per-scene engine routing).
    const wantsHollywood = body.engine === 'hollywood'

    // KINEO-HOLLYWOOD-2026-07-09 — anti-deepfake gate. Hollywood renders REAL
    // fictional people with native voice, so a prompt naming a real person is
    // blocked outright (cheap check, before any credit/plan work).
    if (wantsHollywood && mentionsRealPerson(prompt)) {
      return NextResponse.json(
        { error: "Hollywood Mode can't depict real people. Describe a fictional person instead." },
        { status: 400 },
      )
    }

    // Upfront balance + free-trial eligibility check (deduction/flag-flip happens
    // in compose/status on SUCCESS).
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('video_credits, free_ai_generate_used, plan, has_paid')
      .eq('id', user.id)
      .single()

    if (profileErr && profileErr.code !== 'PGRST116') {
      console.error('[cinematic] credit fetch failed:', profileErr.message)
    }
    const balance = profile?.video_credits ?? 0

    // KINEO-REBASE-2026-07-10 — UNIVERSAL ENGINE GATES. The old plan ladder
    // (Seedance=Creator+, Kling/Veo/Hollywood=Studio) is retired: ANY paying
    // user (has_paid or any paid plan) can use ANY engine as long as they have
    // the credit balance. Free stays as today: Fast free + one AI Gen trial.
    const planVal = (profile?.plan ?? 'free') as string
    const PAID_PLANS = new Set(['starter', 'starter_trial', 'basic', 'basic_trial', 'pro', 'pro_trial'])
    const isPaidUser = profile?.has_paid === true || PAID_PLANS.has(planVal)

    // Premium engines (Kling/Veo/Hollywood) need any PAID account — no free trial.
    if ((wantsKling || wantsVeo || wantsHollywood) && !isPaidUser) {
      return NextResponse.json(
        {
          error: 'Premium engines (Kling, Veo, Hollywood) are available on every paid plan. Upgrade to use them.',
          upsell: 'creator',
          balance,
        },
        { status: 402 },
      )
    }
    // KINEO-SORA-REMOVED-2026-07-06 — Sora is pulled from the menu until its fal
    // endpoint cost is confirmed (margin guard). Reject any direct/stale call.
    if (wantsSora) {
      return NextResponse.json(
        { error: 'Sora is temporarily unavailable. Use Kling or AI Generated.', balance },
        { status: 400 },
      )
    }

    // Push #402 — per-engine cost. KINEO-PRICING-V3B-2026-07-10: Hollywood 150,
    // Kling 50, Veo 90, Sora 100 (blocked), Seedance 20.
    const cost = wantsHollywood ? HOLLYWOOD_CREDIT_COST : wantsKling ? KLING_CREDIT_COST : wantsVeo ? VEO_CREDIT_COST : wantsSora ? SORA_CREDIT_COST : SEEDANCE_CREDIT_COST

    // #384 — FREE AI-GENERATE TRIAL eligibility. One per account, only after
    // email confirmation. The free trial ALWAYS uses Seedance (never Kling).
    const emailConfirmed = !!user.email_confirmed_at
    const freeAlreadyUsed = profile?.free_ai_generate_used === true
    const eligibleForFree = !freeAlreadyUsed && emailConfirmed
    // KINEO-HOLLYWOOD-2026-07-09 — the free trial never applies to Hollywood.
    const isFreeTrial = !wantsKling && !wantsVeo && !wantsSora && !wantsHollywood && balance < SEEDANCE_CREDIT_COST && eligibleForFree

    // KINEO-REBASE-2026-07-10 — Seedance (AI Generated) now requires ANY paid
    // account (was Creator+; the KINEO-LADDER plan gating is retired). Free
    // users keep exactly today's behavior: Fast free + one AI Gen free trial.
    // Kling/Veo/Hollywood already paid-gated above; this catches Seedance.
    if (!wantsKling && !wantsVeo && !wantsHollywood && !isPaidUser && !isFreeTrial) {
      return NextResponse.json(
        {
          error: 'AI Generated videos are on the paid plans. Upgrade to use the AI engine.',
          upsell: 'creator',
          balance,
        },
        { status: 402 },
      )
    }

    if (balance < cost && !isFreeTrial) {
      return NextResponse.json(
        {
          error: freeAlreadyUsed
            ? `You've used your 1 free AI video. ${wantsKling ? 'Cinematic AI needs 50' : 'AI Generated needs 20'} credits. You have ${balance}.` // KINEO-PRICING-V3B-2026-07-10 — Kling 50
            : `This needs ${cost} credits. You have ${balance}.`,
          needed: cost,
          balance,
        },
        { status: 402 }
      )
    }

    // Parse script for verbatim mode
    const parsedScript = parseUserScript(prompt)
    const verbatim = parsedScript.hasMarkers && parsedScript.segments.length > 0

    // #442 — in verbatim mode the final video follows the SCRIPT length, not the
    // selected duration button (the script is narrated in full). The clip count
    // was still derived from the button, so a long script + a short button
    // (e.g. 45) under-provisioned clips and compose REPEATED one to fill the gap
    // (the ~2s repeated shot). Re-size the clip count to the actual narration:
    // each Seedance clip is 10s, so we need ceil(narration_seconds / 10) clips
    // for footage to cover the whole video. Estimate is biased to slightly MORE
    // clips (lower words/sec) since extra footage is just trimmed — never repeated.
    // Stays within the tested 2..6 range; never drops below the button's count.
    if (verbatim) {
      const SECONDS_PER_CLIP = (wantsVeo || wantsSora) ? 8 : 10 // Veo/Sora 8s, Seedance/Kling 10s
      const WORDS_PER_SECOND = 2.5 // ~ElevenLabs at speed 1.05 (conservative)
      const words = parsedScript.narration.split(/\s+/).filter(Boolean).length
      const estSeconds = words / WORDS_PER_SECOND
      const needed = Math.ceil(estSeconds / SECONDS_PER_CLIP)
      const sized = Math.max(clipCount, Math.min(9, needed))
      if (sized !== clipCount) {
        console.log(`[cinematic] #442 verbatim clip count ${clipCount} -> ${sized} (script ~${Math.round(estSeconds)}s, ${words} words)`)
        clipCount = sized
      }
    }

    // Build scenes
    // #441 — aiPrompt = the cinematic SHOT description fed to Seedance (prefer
    // it over the raw stock query). Set from generateScenes prose (non-verbatim)
    // or generated from the narration below (verbatim).
    let scenes: { description: string; voiceover: string; caption: string; stockSearchQuery?: string; aiPrompt?: string }[]

    if (verbatim) {
      // #369 — pick `clipCount` beats EVENLY across all segments, ALWAYS
      // including the first (hook) and last (payoff) so the opening and the
      // payoff each get their OWN distinct clip. The old slice(0, 5) dropped the
      // RHYTHM + PAYOFF beats, so the payoff narrated over an escalation clip.
      const segs = parsedScript.segments
      const picked =
        segs.length <= clipCount
          ? segs
          : Array.from({ length: clipCount }, (_, i) =>
              segs[Math.round((i * (segs.length - 1)) / (clipCount - 1))],
            )
      scenes = picked.map((seg) => ({
        description: seg.pexelsQuery,
        voiceover: seg.voiceover,
        caption: shortCaptionFromVoiceover(seg.voiceover || seg.pexelsQuery),
        stockSearchQuery: seg.pexelsQuery,
      }))
    } else {
      const generated = await generateScenes(prompt.slice(0, 1200), clipCount)
      scenes = generated.map((s) => ({
        description: s.description,
        voiceover: s.voiceover ?? '',
        caption: s.caption ?? shortCaptionFromVoiceover(s.description),
        stockSearchQuery: s.stockSearchQuery,
        // generateScenes already returns cinematic prose — feed THAT to the AI
        // engine instead of the keyword query.
        aiPrompt: s.description,
      }))
    }

    // L2B - prefer the smart BrollPlan per-scene cinematic prompt when provided
    if (planScenes.length > 0) {
      scenes = scenes.map((s, i) => { const bp = planScenes[i]?.brollPrompt; return bp && bp.trim().length > 20 ? { ...s, aiPrompt: bp.trim() } : s })
    }

    // #441 — verbatim path has no cinematic description (description === stock
    // query). Generate a real faceless shot description per scene from the
    // narration so Seedance gets a shot to direct, not keyword soup. Best-effort:
    // on failure each scene falls back to its stock query in submitAllScenes.
    // KINEO-HOLLYWOOD-2026-07-09 — skipped for hollywood: planHollywoodScenes
    // writes its own per-scene prompts (people allowed), so the faceless
    // description pass would be wasted work.
    if (verbatim && planScenes.length === 0 && !wantsHollywood) {
      try {
        const aiPrompts = await generateCinematicDescriptions(scenes, prompt)
        scenes = scenes.map((s, i) => ({
          ...s,
          aiPrompt: aiPrompts[i] && aiPrompts[i].length > 3 ? aiPrompts[i] : s.aiPrompt,
        }))
        const got = scenes.filter((s) => s.aiPrompt).length
        console.log(`[cinematic] #441 cinematic descriptions: ${got}/${scenes.length} scenes`)
      } catch (e) {
        console.warn('[cinematic] #441 description generation skipped:', e instanceof Error ? e.message : String(e))
      }
    }

    // #370 — Submit clips SEQUENTIALLY with a small stagger (was Promise.all,
    // all at once). Firing 5-6 submits in the same instant tripped a fal burst/
    // rate limit that 403'd exactly one clip every time ("submitted 4/5") even
    // with healthy balance + concurrency 10 — which produced the repeated-clip
    // videos. Staggering lets every clip enqueue. One retry per clip covers a
    // transient reject.
    // Push #402 — engine is the user's explicit choice (Kling already gated to
    // Studio above). If Kling fails entirely, fall back to Seedance AND drop the
    // charge to the Seedance price so the user is never billed 50 cr for a
    // Seedance video. Single model per generation keeps the status poll simple.
    let usedModel = wantsKling ? KLING_MODEL : wantsVeo ? VEO_MODEL : wantsSora ? SORA_MODEL : SEEDANCE_MODEL

    // KINEO-SEEDANCE-720-ALL-2026-07-06 — Seedance runs 720p on EVERY plan
    // (~$0.26/clip). 1080p (~$0.62/clip) blew the Studio margin (10 videos =
    // $43.40 cost > $37.90) so it's retired for Seedance — 1080p now lives only
    // in Kling, the premium engine. hd stays false; Kling sets its own params.
    const hd = false

    // KINEO-ERA-LOCK-2026-07-09 — era detected ONCE from the full narration +
    // topic, then appended to EVERY scene prompt below (code-enforced; survives
    // any GPT slip in the per-scene visual prompts).
    const eraSuffix = eraLockSuffix(
      `${prompt} ${scenes.map((s) => `${s.voiceover ?? ''} ${s.aiPrompt ?? ''} ${s.description ?? ''}`).join(' ')}`,
    )
    if (eraSuffix) console.log('[cinematic] era-lock active for this render')

    // ── KINEO-HOLLYWOOD-2026-07-09 — HOLLYWOOD MODE 2.0 ─────────────────────
    // Dedicated path: GPT plans dialogue/cinematic/support scenes with ONE
    // fictional character + ONE environment + ONE styleSheet (KINEO-HOLLYWOOD-22),
    // each scene is submitted to ITS engine (Kling3 dialogue+support / Veo3.1
    // cinematic — Seedance out since 22) with NATIVE AUDIO ON, and the
    // response carries the per-scene metadata compose needs (engines,
    // narrations, seconds). buildFacelessCinematicPrompt / PERSON_NOUN_RE are
    // intentionally NOT applied — fictional people are the point here. The
    // era-lock suffix IS kept (period accuracy still matters).
    if (wantsHollywood) {
      const hollywoodVoiceover = verbatim && parsedScript.narration
        ? parsedScript.narration
        : scenes.map((s) => s.voiceover).filter(Boolean).join(' ')

      // KINEO-HOLLYWOOD-HOST-2026-07-13 — language/vertical hoisted (the host
      // voice resolution below needs both; the same `vertical` reaches
      // /api/compose from the client, so both routes pin the same persona).
      const hollywoodLanguage: 'en' | 'pt' | 'es' =
        body.language === 'pt' ? 'pt' : body.language === 'es' ? 'es' : 'en'
      const hollywoodVertical =
        typeof body.vertical === 'string' && body.vertical.trim() ? body.vertical.trim().toLowerCase() : undefined

      let plan: HollywoodPlan
      try {
        plan = await planHollywoodScenes({
          idea: prompt,
          voiceoverScript: hollywoodVoiceover || undefined,
          scenes: scenes.map((s) => ({ voiceover: s.voiceover, description: s.aiPrompt || s.description })),
          durationSeconds: duration,
          language: hollywoodLanguage,
        })
      } catch (e) {
        console.error('[cinematic] hollywood planner failed:', e instanceof Error ? e.message : String(e))
        return NextResponse.json(
          { error: 'Hollywood scene planning failed. Please try again.' },
          { status: 502 },
        )
      }

      // KINEO-HOLLYWOOD-30-2026-07-10 — HOLLYWOOD 3.0 "UM MUNDO": generate the
      // two image anchors from the plan's sheets (portrait + environment
      // still, ~$0.10, synchronous — flux/schnell is fast). FAIL-OPEN: null →
      // every scene falls back to the v2.4 t2v engines below; the render
      // never dies because of anchors.
      let anchors: HollywoodAnchors | null = null
      try {
        anchors = await generateHollywoodAnchors({
          characterSheet: plan.characterSheet,
          environmentSheet: plan.environmentSheet,
          styleSheet: plan.styleSheet,
        })
      } catch (e) {
        console.error('[cinematic] hollywood anchors threw (falling back to t2v):', e instanceof Error ? e.message : String(e))
        anchors = null
      }
      if (!anchors) console.warn('[cinematic] hollywood 3.0 anchors unavailable — using v2.4 t2v path')

      // KINEO-CHARACTER-LOCK-2026-07-10 — a saved character OVERRIDES the
      // generated portrait anchor: dialogue scenes are seeded with the user's
      // character image, so the presenter is the SAME person in every video.
      // Server-side ownership lookup (id → url); the client never injects raw
      // URLs. Fail-open: an invalid id just falls back to the generated portrait.
      const characterIdRaw = (body.characterId ?? '').toString().trim()
      if (characterIdRaw) {
        try {
          const { getCharacterImageUrl } = await import('@/lib/characters')
          const charUrl = await getCharacterImageUrl(user.id, characterIdRaw)
          if (charUrl) {
            if (anchors) {
              anchors = { ...anchors, portraitUrl: charUrl }
            } else {
              // No generated anchors (flux hiccup) — still lock the character
              // for dialogue scenes; support scenes use the same image as a
              // world reference rather than dropping the lock entirely.
              anchors = { portraitUrl: charUrl, environmentUrl: charUrl }
            }
            console.log(`[cinematic] hollywood character-lock active char=${characterIdRaw.slice(0, 8)}`)
          } else {
            console.warn('[cinematic] character-lock id not found/owned — using generated portrait')
          }
        } catch (e) {
          console.warn('[cinematic] character-lock lookup failed (fail-open):', e instanceof Error ? e.message : String(e))
        }
      }

      // KINEO-HOLLYWOOD-HOST-2026-07-13 (item 2, prepared hook) — the user's
      // OWN clips for demo scenes. Same authorization contract as
      // generate-video-fast (KINEO-USER-FOOTAGE): only URLs inside THIS
      // user's folder of our public user-footage bucket are accepted, so
      // upload gating stays the real authorization. NOT spliced into the
      // render yet: hollywood clip URLs travel client-side exclusively via
      // the fal poll (cinematic-clip-status), so a pre-existing URL has no
      // lane to compose today. When compose grows a per-scene clip-override
      // param, demo scenes should consume `demoUserFootage` in order instead
      // of generating. Until then we log availability and generate demo
      // b-roll (fail-open, zero behavior change).
      const footagePrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/user-footage/${user.id}/`
      const demoUserFootage = planScenes
        .map((s) => (typeof s.userFootageUrl === 'string' && s.userFootageUrl.startsWith(footagePrefix) ? s.userFootageUrl : null))
        .filter((u): u is string => !!u)
      const demoSceneCount = plan.scenes.filter((s) => s.isDemo === true).length
      if (demoSceneCount > 0) {
        console.log(
          `[cinematic] hollywood demo beat: ${demoSceneCount} demo scene(s) planned${demoUserFootage.length > 0 ? ` — ${demoUserFootage.length} user clip(s) available (inline splicing pending compose hook; generating demo b-roll)` : ''}`,
        )
      }

      // KINEO-HOLLYWOOD-HOST-2026-07-13 (item 1) — narration metadata hoisted
      // ABOVE the submit loop: hVoiceoverScript is the exact voiceover_script
      // string compose receives back from the client, and BOTH routes resolve
      // the narrator persona from it (lib/hollywood/hostVoice) — that's what
      // guarantees the host lines and the b-roll narration share ONE voice.
      const hNarrations = plan.scenes.map((s) => (s.needsNarration && s.voiceover ? s.voiceover : null))
      const hVoiceoverScript =
        hNarrations.filter(Boolean).join(' ') ||
        plan.scenes.map((s) => s.dialogueLine ?? '').filter(Boolean).join(' ') ||
        prompt

      // One voice for the whole video. Only meaningful on the anchored path
      // (the presenter engine needs the portrait anchor); resolution is pure
      // and can only fail on truly broken input — fail-open to null → every
      // dialogue scene takes the v3.0 O3 native-audio path unchanged.
      let hostVoice: HollywoodVoice | null = null
      if (anchors) {
        try {
          hostVoice = resolveHollywoodVoice(hVoiceoverScript, hollywoodLanguage, hollywoodVertical)
          console.log(
            `[cinematic] hollywood host voice pinned: persona=${hostVoice.personaId} voice=${hostVoice.voice} speed=${hostVoice.defaultSpeed}`,
          )
        } catch (e) {
          console.warn('[cinematic] hollywood host voice resolution failed (falling back to O3 native audio):', e instanceof Error ? e.message : String(e))
          hostVoice = null
        }
      }
      const hostPerformancePrompt = buildHostPerformancePrompt(plan.characterSheet, plan.styleSheet)
      // Verbatim scripts may carry an explicit `speed:` directive — apply it
      // to the host lines exactly like compose applies it to the narration
      // (persona pace × user speed, clamped inside synthesizeHostSpeech).
      const hostUserSpeed = typeof parsedScript.speed === 'number' && parsedScript.speed > 0 ? parsedScript.speed : 1.0

      // Submit each scene to ITS engine — same stagger/retry as the classic
      // path, but the model is per scene (no single-model fallback here: a
      // partially-failed submit still composes from the scenes that made it).
      // KINEO-HOLLYWOOD-30-2026-07-10 — with anchors, EVERY scene goes to
      // Kling O3 Pro image-to-video: dialogue seeded with the PORTRAIT (same
      // face every scene), support/cinematic with the ENVIRONMENT still (same
      // world every cut). Concurrency note: the shared fal-ai/kling-video-v3
      // alias allows 1 in-flight request per user — the existing SEQUENTIAL
      // submit with stagger already respects that; do NOT parallelize.
      // KINEO-HOLLYWOOD-HOST-2026-07-13 — anchored DIALOGUE scenes try the
      // HOST path first: TTS the line with the pinned voice → upload mp3 →
      // Kling AI Avatar v2 (portrait + audio + performance prompt). The clip's
      // real length follows the AUDIO, so the scene's timeline seconds are
      // overwritten with the measured TTS duration (compose/builder honor the
      // exact value for 'host' scenes — no 5|10 snap, no leftover silence, no
      // cut speech). ANY failure (TTS, measure, upload, submit) logs the
      // reason and falls back to the O3 i2v native-audio submit for THAT
      // scene only. `hEngines` is the per-scene RENDER engine sent to compose
      // ('host' | 'dialogue' | 'cinematic' | 'support').
      const hRequestIds: (string | null)[] = []
      const hModels: string[] = []
      const hEngines: string[] = []
      for (const hs of plan.scenes) {
        // `sceneModel`/`sceneEngine` (NOT `usedModel` — that name belongs to
        // the classic single-model path below and must not be shadowed).
        let sceneModel: string = anchors ? KLING3_I2V_MODEL : HOLLYWOOD_MODELS[hs.type]
        let sceneEngine: string = hs.type
        let id: string | null = null

        if (anchors && hostVoice && hs.type === 'dialogue' && hs.dialogueLine && hs.dialogueLine.trim()) {
          try {
            const speechBuf = await synthesizeHostSpeech({
              text: hs.dialogueLine,
              voice: hostVoice.voice,
              speed: hostVoice.defaultSpeed * hostUserSpeed,
            })
            const audioDur = estimateMp3DurationSeconds(speechBuf)
            if (!(audioDur > 0.5)) throw new Error(`host TTS unmeasurable/too short (${audioDur.toFixed(2)}s)`)
            const audioUrl = await uploadVoiceoverToSupabase(user.id, speechBuf)
            const reqId = await submitAvatarJob({
              imageUrl: anchors.portraitUrl,
              audioUrl,
              engine: 'presenter',
              performancePrompt: hostPerformancePrompt,
            })
            if (!reqId) throw new Error('presenter queue submit returned no request id')
            id = reqId
            sceneModel = HOST_PRESENTER_MODEL
            sceneEngine = 'host'
            // The montage must follow the REAL audio length, not the planned
            // 5|10s block — this is what kills both the trailing silence and
            // the cut-off last word (0.1s precision is enough for Creatomate).
            hs.seconds = Math.max(2, Math.round(audioDur * 10) / 10)
            console.log(
              `[cinematic] hollywood host scene ${hs.index}: TTS ${audioDur.toFixed(1)}s voice=${hostVoice.voice} → presenter submitted`,
            )
          } catch (e) {
            console.warn(
              `[cinematic] hollywood host scene ${hs.index} failed — falling back to O3 native audio:`,
              e instanceof Error ? e.message : String(e),
            )
            id = null
            sceneModel = anchors ? KLING3_I2V_MODEL : HOLLYWOOD_MODELS[hs.type]
            sceneEngine = hs.type
          }
        }

        if (!id) {
          // v3.0 path — byte-identical to before v3.5 (and the per-scene
          // fallback when the host path above failed).
          const anchorUrl = anchors
            ? hs.type === 'dialogue'
              ? anchors.portraitUrl
              : anchors.environmentUrl
            : undefined
          const scenePrompt = hs.prompt + eraSuffix
          id = await submitToFal(scenePrompt, sceneModel, false, true, hs.seconds, anchorUrl)
          if (!id) {
            await new Promise((r) => setTimeout(r, 800))
            id = await submitToFal(scenePrompt, sceneModel, false, true, hs.seconds, anchorUrl)
          }
        }
        hRequestIds.push(id)
        hModels.push(sceneModel)
        hEngines.push(sceneEngine)
        await new Promise((r) => setTimeout(r, 450))
      }

      const hValid = hRequestIds.filter((id): id is string => id !== null)
      if (hValid.length === 0) {
        if (FAL_EXHAUSTED) {
          await alertFalExhausted(`user=${user.id.slice(0, 8)} engine=hollywood`)
          return NextResponse.json(
            {
              queued: true,
              error: "We're experiencing high demand right now — your video is queued and we'll have it ready shortly. No credits were used.",
            },
            { status: 503 },
          )
        }
        return NextResponse.json(
          { error: 'Could not submit clips to AI generator. Please try again.' },
          { status: 502 },
        )
      }

      const generationId = randomUUID()
      // KINEO-HOLLYWOOD-30-2026-07-10 — per-scene models (i2v when anchored)
      // + the anchors' ~$0.10 included in the logged TOTAL.
      logHollywoodCost(generationId, plan.scenes, {
        models: hModels,
        anchorsUsd: anchors ? ANCHORS_USD : 0,
      })
      console.log(
        `[cinematic] hollywood submitted ${hValid.length}/${plan.scenes.length} clips user=${user.id.slice(0, 8)} generationId=${generationId} anchored=${anchors ? 'yes' : 'no'} est=$${plan.estimatedCostUsd.toFixed(2)}`,
      )

      // KINEO-HOLLYWOOD-HOST-2026-07-13 — hNarrations/hVoiceoverScript moved
      // ABOVE the submit loop (the host voice is resolved from them).

      return NextResponse.json({
        mode: 'cinematic_ai',
        freeTrial: false,
        generationId,
        prompt,
        duration,
        scenes: plan.scenes.map((s) => s.prompt),
        scene_captions: plan.scenes.map((s) => s.caption),
        voiceover_script: hVoiceoverScript,
        fal_request_ids: hRequestIds, // null for failed submissions
        fal_model: hModels[0] ?? HOLLYWOOD_MODELS.dialogue, // back-compat: scene-1 model
        fal_models: hModels, // parallel to fal_request_ids
        // KINEO-HOLLYWOOD-HOST-2026-07-13 — the RENDER engine per scene:
        // 'host' (presenter clip, speech baked in, timeline follows the real
        // audio seconds) | 'dialogue' | 'cinematic' | 'support'. Compose keys
        // volume/narration/caption/duration decisions off this.
        scene_engines: hEngines,
        scene_narrations: hNarrations, // TTS text per scene (null = native audio only)
        // For host scenes these are the MEASURED TTS seconds (0.1s precision),
        // overwritten in the submit loop — not the planner's 5|10 estimate.
        scene_seconds: plan.scenes.map((s) => s.seconds),
        // KINEO-HOLLYWOOD-21-2026-07-10 (bug b) — the EXACT spoken line per
        // dialogue scene (null for the rest), parallel to fal_request_ids.
        // Compose uses it to caption dialogue scenes with the REAL speech.
        scene_dialogues: plan.scenes.map((s) => (s.type === 'dialogue' && s.dialogueLine ? s.dialogueLine : null)),
        cost_estimate_usd: plan.estimatedCostUsd,
        quality: 'cinematic_hollywood',
        verbatim,
        speed: parsedScript.speed,
      })
    }
    // ── end KINEO-HOLLYWOOD-2026-07-09 ──────────────────────────────────────

    async function submitAllScenes(model: string): Promise<(string | null)[]> {
      const ids: (string | null)[] = []
      for (const scene of scenes) {
        // #440/#441 — feed Seedance the cinematic SHOT description (aiPrompt),
        // falling back to the stock query only if description generation failed.
        // buildFacelessCinematicPrompt then strips any person nouns + forces
        // environment-first b-roll, on-brand for this faceless channel.
        const visualPrompt = scene.aiPrompt || scene.stockSearchQuery || scene.description
        const cinematic = buildFacelessCinematicPrompt(visualPrompt) + eraSuffix + styleSuffix
        let id = await submitToFal(cinematic, model, hd)
        if (!id) {
          await new Promise((r) => setTimeout(r, 800))
          id = await submitToFal(cinematic, model, hd)
        }
        ids.push(id)
        await new Promise((r) => setTimeout(r, 450))
      }
      return ids
    }

    let falRequestIds = await submitAllScenes(usedModel)
    let validIds = falRequestIds.filter((id): id is string => id !== null)

    if (validIds.length === 0 && usedModel === KLING_MODEL) {
      console.warn('[cinematic] Kling submit yielded 0 clips — falling back to Seedance')
      usedModel = SEEDANCE_MODEL
      falRequestIds = await submitAllScenes(SEEDANCE_MODEL)
      validIds = falRequestIds.filter((id): id is string => id !== null)
    }

    if (validIds.length === 0) {
      // KINEO-FAL-ALARM-2026-07-06 — if the failure was an exhausted fal balance,
      // don't show a dead error: alert the founder and return a soft "queued"
      // message so the user waits calmly instead of thinking the product broke.
      // No credits are charged (deduction only happens on successful render).
      if (FAL_EXHAUSTED) {
        await alertFalExhausted(`user=${user.id.slice(0, 8)} engine=${usedModel}`)
        return NextResponse.json(
          {
            queued: true,
            error: "We're experiencing high demand right now — your video is queued and we'll have it ready shortly. No credits were used.",
          },
          { status: 503 },
        )
      }
      return NextResponse.json(
        { error: 'Could not submit clips to AI generator. Please try again.' },
        { status: 502 }
      )
    }

    const voiceoverScript = verbatim && parsedScript.narration
      ? parsedScript.narration
      : scenes.map((s) => s.voiceover).filter(Boolean).join(' ')

    const generationId = randomUUID()

    console.log(
      `[cinematic] submitted ${validIds.length}/${scenes.length} clips to fal.ai user=${user.id.slice(0, 8)} generationId=${generationId}`
    )

    return NextResponse.json({
      mode: 'cinematic_ai',
      freeTrial: isFreeTrial, // #384 — UI hint only; watermark/quota decided server-side
      generationId,
      prompt,
      duration,
      scenes: scenes.map((s) => s.description),
      scene_captions: scenes.map((s) => s.caption),
      voiceover_script: voiceoverScript,
      fal_request_ids: falRequestIds, // null for failed submissions
      fal_model: usedModel, // #401 — which engine ran (client passes it to clip-status)
      // #402 — quality drives the credit cost in compose/status. Reflects the
      // engine that ACTUALLY ran (so a Kling→Seedance fallback charges 30, not 45).
      quality: usedModel === KLING_MODEL ? 'cinematic_kling' : usedModel === VEO_MODEL ? 'cinematic_veo' : usedModel === SORA_MODEL ? 'cinematic_sora' : 'cinematic_ai',
      verbatim,
      speed: parsedScript.speed,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[cinematic] unexpected error:', msg)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
