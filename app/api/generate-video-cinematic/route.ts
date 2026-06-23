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

export const maxDuration = 60

// Push #402 — two user-selectable engines with different credit costs.
// AI Generated (Seedance) = 30 cr, available to all paid plans. Cinematic AI
// (Kling) = 45 cr, Studio-only (premium). Free trial only ever uses Seedance.
const SEEDANCE_CREDIT_COST = 40
const KLING_CREDIT_COST = 60
// Push #489/#491 — premium cinematic engines (Veo 3.1 Fast, Sora 2) via fal.
// Priced for a fat margin: fal ~$0.80/clip × ~6 clips ≈ $4.80 cost/video, so
// 180/200 credits (~$18–$20 retail at $0.10/cr) ≈ 73–76% margin, under Higgsfield.
const VEO_CREDIT_COST = 180
const SORA_CREDIT_COST = 200

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
// Back-compat: other modules import FAL_MODEL.
const FAL_MODEL = SEEDANCE_MODEL

// Build the per-model fal input (params differ between Seedance and Kling).
function buildFalInput(model: string, prompt: string): Record<string, unknown> {
  if (model === SORA_MODEL) {
    return {
      prompt,
      aspect_ratio: '9:16',
      resolution: '720p',
      duration: 8,
    }
  }
  if (model === VEO_MODEL) {
    return {
      prompt,
      aspect_ratio: '9:16',
      duration: '8s',
      resolution: '1080p',
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
  // Seedance (default)
  return {
    prompt,
    aspect_ratio: '9:16',
    resolution: '1080p',
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

    let body: { prompt?: string; duration?: number; engine?: string; brollScenes?: Array<{ sceneNumber?: number; brollPrompt?: string; shotType?: string; negativePrompt?: string }>; globalStyle?: { mood?: string; lighting?: string; cameraStyle?: string } }
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
    // (Studio-only, 45 cr); anything else = AI Generated (Seedance, 30 cr).
    const wantsKling = body.engine === 'kling'
    const wantsVeo = body.engine === 'veo'
    const wantsSora = body.engine === 'sora'

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
    const cost = wantsKling ? KLING_CREDIT_COST : wantsVeo ? VEO_CREDIT_COST : wantsSora ? SORA_CREDIT_COST : SEEDANCE_CREDIT_COST

    // #384 — FREE AI-GENERATE TRIAL eligibility. One per account, only after
    // email confirmation. The free trial ALWAYS uses Seedance (never Kling).
    const emailConfirmed = !!user.email_confirmed_at
    const freeAlreadyUsed = profile?.free_ai_generate_used === true
    const eligibleForFree = !freeAlreadyUsed && emailConfirmed
    const isFreeTrial = !wantsKling && !wantsVeo && !wantsSora && balance < SEEDANCE_CREDIT_COST && eligibleForFree

    // Push #404 — AI Generated (Seedance) requires a Creator or Studio plan (or
    // the one-time free trial). Starter (Fast) users and trial-exhausted free
    // users are upsold to Creator.
    const planVal = (profile?.plan ?? 'free') as string
    const isCreatorPlus = planVal === 'basic' || planVal === 'basic_trial' || isStudio
    // Push #430 — welcome credits: a free-plan user holding enough credits
    // (30 on signup) may pay for AI Generated with them. Their render is
    // watermarked server-side in /api/compose (free plan = watermark).
    const paysWithCredits = !wantsKling && balance >= (wantsVeo ? VEO_CREDIT_COST : wantsSora ? SORA_CREDIT_COST : SEEDANCE_CREDIT_COST)
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
    if (verbatim && planScenes.length === 0) {
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
    // charge to the Seedance price so the user is never billed 45 cr for a
    // Seedance video. Single model per generation keeps the status poll simple.
    let usedModel = wantsKling ? KLING_MODEL : wantsVeo ? VEO_MODEL : wantsSora ? SORA_MODEL : SEEDANCE_MODEL

    async function submitAllScenes(model: string): Promise<(string | null)[]> {
      const ids: (string | null)[] = []
      for (const scene of scenes) {
        // #440/#441 — feed Seedance the cinematic SHOT description (aiPrompt),
        // falling back to the stock query only if description generation failed.
        // buildFacelessCinematicPrompt then strips any person nouns + forces
        // environment-first b-roll, on-brand for this faceless channel.
        const visualPrompt = scene.aiPrompt || scene.stockSearchQuery || scene.description
        const cinematic = buildFacelessCinematicPrompt(visualPrompt) + styleSuffix
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
