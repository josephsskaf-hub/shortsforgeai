// Push #315 — Cinematic Mode: fal.ai Wan 2.1 AI video generation.
// Submits each scene to fal.ai queue (async), returns request IDs immediately.
// Client polls /api/cinematic-clip-status until all clips are ready, then
// hands off to /api/compose exactly like Fast Mode. Cost: 3 credits.
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { generateScenes, shortCaptionFromVoiceover } from '@/lib/runway'
import { parseUserScript } from '@/lib/scriptParser'
import { fal } from '@fal-ai/client'

export const maxDuration = 60

// Push #402 — two user-selectable engines with different credit costs.
// AI Generated (Seedance) = 30 cr, available to all paid plans. Cinematic AI
// (Kling) = 45 cr, Studio-only (premium). Free trial only ever uses Seedance.
const SEEDANCE_CREDIT_COST = 30
const KLING_CREDIT_COST = 45

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
// Back-compat: other modules import FAL_MODEL.
const FAL_MODEL = SEEDANCE_MODEL

// Build the per-model fal input (params differ between Seedance and Kling).
function buildFalInput(model: string, prompt: string): Record<string, unknown> {
  if (model === KLING_MODEL) {
    return {
      prompt,
      duration: '10',
      aspect_ratio: '9:16',
      negative_prompt: 'blur, distort, low quality, watermark, text',
      cfg_scale: 0.5,
    }
  }
  // Seedance (default)
  return {
    prompt,
    aspect_ratio: '9:16',
    resolution: '720p',
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

function buildFacelessCinematicPrompt(raw: string): string {
  let s = (raw || '').replace(/\s+/g, ' ').trim()
  s = s
    .replace(PERSON_NOUN_RE, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,.;:–-]+/, '')
    .trim()
  if (s.length < 3) s = 'cinematic establishing environment shot'
  return (
    `${s}, faceless cinematic b-roll, empty scene focused on the environment, ` +
    `objects and scenery, no people, no human faces, documentary establishing shot, ` +
    `photorealistic, ultra-detailed, dramatic cinematic lighting, smooth camera motion, ` +
    `9:16 vertical, no text, no watermark, no logo`
  )
}

// #369 — clip count = ceil(duration/9), capped 2..6. One ~9-10s clip per
// timeline slot so a 45s video gets 5 distinct clips and a 60s video gets 6
// (no looping/repetition in compose).
function clipCountForDuration(d: number): number {
  return Math.max(2, Math.min(6, Math.ceil(d / 9)))
}

async function submitToFal(prompt: string, model: string = SEEDANCE_MODEL): Promise<string | null> {
  const falKey = process.env.FAL_KEY
  if (!falKey) return null

  try {
    fal.config({ credentials: falKey })
    const { request_id } = await fal.queue.submit(model, {
      input: buildFalInput(model, prompt),
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
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
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

    let body: { prompt?: string; duration?: number; engine?: string }
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
    const clipCount = clipCountForDuration(duration)
    // Push #402 — explicit engine choice from the UI. 'kling' = Cinematic AI
    // (Studio-only, 45 cr); anything else = AI Generated (Seedance, 30 cr).
    const wantsKling = body.engine === 'kling'

    // Upfront balance + free-trial eligibility check (deduction/flag-flip happens
    // in compose/status on SUCCESS).
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('video_credits, free_ai_generate_used, plan')
      .eq('id', user.id)
      .single()

    if (profileErr && profileErr.code !== 'PGRST116') {
      console.error('[cinematic] credit fetch failed:', profileErr.message)
    }
    const balance = profile?.video_credits ?? 0
    const isStudio = profile?.plan === 'pro' || profile?.plan === 'pro_trial'

    // Push #402 — Cinematic AI (Kling) is a Studio-only feature. The UI also
    // locks the button; this is the server-side guard against direct calls.
    if (wantsKling && !isStudio) {
      return NextResponse.json(
        {
          error: 'Cinematic AI (Kling) is a Studio feature. Upgrade to Studio to use it.',
          upsell: 'studio',
          balance,
        },
        { status: 402 },
      )
    }

    // Push #402 — per-engine cost: Cinematic (Kling) 45, AI Generated (Seedance) 30.
    const cost = wantsKling ? KLING_CREDIT_COST : SEEDANCE_CREDIT_COST

    // #384 — FREE AI-GENERATE TRIAL eligibility. One per account, only after
    // email confirmation. The free trial ALWAYS uses Seedance (never Kling).
    const emailConfirmed = !!user.email_confirmed_at
    const freeAlreadyUsed = profile?.free_ai_generate_used === true
    const eligibleForFree = !freeAlreadyUsed && emailConfirmed
    const isFreeTrial = !wantsKling && balance < SEEDANCE_CREDIT_COST && eligibleForFree

    // Push #404 — AI Generated (Seedance) requires a Creator or Studio plan (or
    // the one-time free trial). Starter (Fast) users and trial-exhausted free
    // users are upsold to Creator.
    const planVal = (profile?.plan ?? 'free') as string
    const isCreatorPlus = planVal === 'basic' || planVal === 'basic_trial' || isStudio
    // Push #430 — welcome credits: a free-plan user holding enough credits
    // (30 on signup) may pay for AI Generated with them. Their render is
    // watermarked server-side in /api/compose (free plan = watermark).
    const paysWithCredits = !wantsKling && balance >= SEEDANCE_CREDIT_COST
    if (!wantsKling && !isCreatorPlus && !isFreeTrial && !paysWithCredits) {
      return NextResponse.json(
        {
          error: 'AI Generated videos are on the Creator & Studio plans. Upgrade to use the AI engine.',
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
            ? `You've used your 1 free AI video. ${wantsKling ? 'Cinematic AI needs 45' : 'AI Generated needs 30'} credits. You have ${balance}.`
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

    // Build scenes
    let scenes: { description: string; voiceover: string; caption: string; stockSearchQuery?: string }[]

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
      }))
    }

    // #370 — Submit clips SEQUENTIALLY with a small stagger (was Promise.all,
    // all at once). Firing 5-6 submits in the same instant tripped a fal burst/
    // rate limit that 403'd exactly one clip every time ("submitted 4/5") even
    // with healthy balance + concurrency 10 — which produced the repeated-clip
    // videos. Staggering lets every clip enqueue. One retry per clip covers a
    // transient reject.
    // Push #402 — engine is the user's explicit choice (Kling already gated to
    // Studio above). If Kling fails entirely, fall back to Seedance AND drop the
    // charge to the Seedance price so the user is never billed 45 cr for a
    // Seedance video. Single model per generation keeps the status poll simple.
    let usedModel = wantsKling ? KLING_MODEL : SEEDANCE_MODEL

    async function submitAllScenes(model: string): Promise<(string | null)[]> {
      const ids: (string | null)[] = []
      for (const scene of scenes) {
        // #440 — feed Seedance a FACELESS cinematic prompt built from the scene
        // query, not the raw stock-search keywords (which made it invent a random
        // person). buildFacelessCinematicPrompt strips person nouns + forces
        // environment-first b-roll on-brand for this faceless channel.
        const visualPrompt = scene.stockSearchQuery || scene.description
        const cinematic = buildFacelessCinematicPrompt(visualPrompt)
        let id = await submitToFal(cinematic, model)
        if (!id) {
          await new Promise((r) => setTimeout(r, 800))
          id = await submitToFal(cinematic, model)
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
      quality: usedModel === KLING_MODEL ? 'cinematic_kling' : 'cinematic_ai',
      verbatim,
      speed: parsedScript.speed,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[cinematic] unexpected error:', msg)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
