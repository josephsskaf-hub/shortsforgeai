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

const CINEMATIC_CREDIT_COST = 30

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

    let body: { prompt?: string; duration?: number }
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

    // #384 — FREE AI-GENERATE TRIAL eligibility. One per account, forever, only
    // after email confirmation (prod auto-confirms). The free trial is what lets
    // a user WITHOUT the 30 credits make exactly one AI video (watermarked). Once
    // used, the flag is true → they fall back to the normal 30-credit rule.
    const emailConfirmed = !!user.email_confirmed_at
    const freeAlreadyUsed = profile?.free_ai_generate_used === true
    const eligibleForFree = !freeAlreadyUsed && emailConfirmed
    const isFreeTrial = balance < CINEMATIC_CREDIT_COST && eligibleForFree

    if (balance < CINEMATIC_CREDIT_COST && !isFreeTrial) {
      return NextResponse.json(
        {
          error: freeAlreadyUsed
            ? `You've used your 1 free AI video. AI Generate now needs ${CINEMATIC_CREDIT_COST} credits. You have ${balance}.`
            : `Cinematic Mode needs ${CINEMATIC_CREDIT_COST} credits. You have ${balance}.`,
          needed: CINEMATIC_CREDIT_COST,
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
    // Push #401 — pick the engine by plan. Pro → Kling (premium/cinematic);
    // everyone else (Basic, free trial) → Seedance. If Kling yields zero clips
    // (no access / transient), fall back to Seedance for the WHOLE generation so
    // a paying user never gets a failed render. Single model per generation keeps
    // the status poll simple (it checks one endpoint).
    const isProPlan = profile?.plan === 'pro' || profile?.plan === 'pro_trial'
    let usedModel = isProPlan ? KLING_MODEL : SEEDANCE_MODEL

    async function submitAllScenes(model: string): Promise<(string | null)[]> {
      const ids: (string | null)[] = []
      for (const scene of scenes) {
        const visualPrompt = scene.stockSearchQuery || scene.description
        const cinematic = `${visualPrompt}, cinematic 9:16 vertical video, YouTube Shorts style, high quality`
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
      verbatim,
      speed: parsedScript.speed,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[cinematic] unexpected error:', msg)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
