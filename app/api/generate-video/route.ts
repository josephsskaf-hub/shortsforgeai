import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateScenes, sanitizePromptForRunway, startRunwayTextToImage } from '@/lib/runway'

// Push #015/#016: this route MUST return quickly. Previously it ran the whole
// text_to_image + image_to_video Runway pipeline inline, which routinely blew
// past Vercel's 60s limit and surfaced as 502 / "Runway task did not complete"
// errors. Now we kick off only the first stage (text_to_image), persist a
// "processing" row, and return generation_id immediately. The status route
// owns every subsequent stage transition.
export const maxDuration = 30

type Quality = 'basic' | 'basic_ai' | 'pro'

const QUALITY_COST: Record<Quality, number> = {
  basic: 1,
  basic_ai: 1,
  pro: 2,
}

const PRO_PROMPT_SUFFIX =
  ', cinematic 35mm anamorphic, premium volumetric lighting, shallow depth of field, film grain, 8K detail, ultra-sharp focus, color-graded'

function augmentForQuality(prompt: string, quality: Quality): string {
  if (quality !== 'pro') return prompt
  if (prompt.length + PRO_PROMPT_SUFFIX.length > 500) {
    return prompt.slice(0, 500 - PRO_PROMPT_SUFFIX.length) + PRO_PROMPT_SUFFIX
  }
  return prompt + PRO_PROMPT_SUFFIX
}

export async function POST(req: NextRequest) {
  const supabase = createClient()

  try {
    if (!process.env.RUNWAY_API_KEY) {
      console.error('[generate-video] RUNWAY_API_KEY is not configured')
      return NextResponse.json(
        { error: 'Video service is not configured. Please contact support.' },
        { status: 500 }
      )
    }
    if (!process.env.OPENAI_API_KEY) {
      console.error('[generate-video] OPENAI_API_KEY is not configured')
      return NextResponse.json(
        { error: 'AI service is not configured. Please contact support.' },
        { status: 500 }
      )
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'You must be signed in to generate a video.' },
        { status: 401 }
      )
    }

    let body: {
      prompt?: string
      platform?: string
      duration?: number
      quality?: Quality
    }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const prompt = (body.prompt ?? '').trim()
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 })
    }
    if (prompt.length > 1000) {
      return NextResponse.json({ error: 'Prompt is too long.' }, { status: 400 })
    }

    const platform = (body.platform ?? 'YouTube Shorts').toString()

    // Runway tier limit is 1 concurrent task. Multi-clip (30s / 60s) would
    // either need multiple sequential tasks (>2 min total) or break the
    // concurrency rule, so we render a single 10s clip and just record what
    // the user asked for. UI keeps the duration buttons; backend clamps.
    const requestedDuration = Number(body.duration) || 10

    const quality: Quality =
      body.quality === 'basic' || body.quality === 'pro' || body.quality === 'basic_ai'
        ? body.quality
        : 'basic_ai'
    const cost = QUALITY_COST[quality]

    console.log(
      `[generate-video] user=${user.id} prompt="${prompt.slice(0, 80)}…" requestedDuration=${requestedDuration}s quality=${quality} cost=${cost}`
    )

    // ── Step 1: verify balance (do NOT deduct — happens after completion). ──
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('video_credits')
      .eq('id', user.id)
      .single()

    if (profileErr && profileErr.code !== 'PGRST116') {
      console.error('[generate-video] profile lookup error:', profileErr.message)
      return NextResponse.json(
        { error: 'Could not load your credit balance. Please try again.' },
        { status: 500 }
      )
    }

    const available = profile?.video_credits ?? 0
    if (available < cost) {
      return NextResponse.json(
        {
          error: `Not enough credits. This generation needs ${cost} credit${cost === 1 ? '' : 's'}.`,
          credits: available,
        },
        { status: 402 }
      )
    }

    // ── Step 2: concurrency guard. Runway tier allows 1 task at a time, and
    // we want to avoid double-billing the user if they double-click Generate.
    const { data: inflight } = await supabase
      .from('generations')
      .select('id, content, created_at')
      .eq('user_id', user.id)
      .eq('content->>type', 'runway_video')
      .in('content->>status', ['processing'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (inflight && inflight.length > 0) {
      const row = inflight[0] as { id: string; created_at: string }
      const ageMs = Date.now() - new Date(row.created_at).getTime()
      // Auto-expire after 10 minutes — anything older is almost certainly a
      // crashed poll and shouldn't block the user forever.
      if (ageMs < 10 * 60 * 1000) {
        console.warn('[generate-video] blocked: user already has a processing generation', row.id)
        return NextResponse.json(
          { error: 'You already have a video processing. Please wait for it to finish.' },
          { status: 409 }
        )
      }
      console.warn('[generate-video] expiring stale processing row', row.id, 'ageMs=', ageMs)
    }

    // ── Step 3: plan one cinematic scene from the user prompt. ──
    let sceneText: string
    try {
      const scenes = await generateScenes(prompt, 1)
      sceneText = (scenes[0] ?? '').trim() || prompt
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[generate-video] scene generation failed:', msg)
      return NextResponse.json(
        { error: 'Failed to plan the scene. Please try a different prompt.' },
        { status: 500 }
      )
    }

    const augmented = augmentForQuality(sceneText, quality)
    const finalPromptText = sanitizePromptForRunway(augmented) || sanitizePromptForRunway(prompt)
    if (!finalPromptText) {
      return NextResponse.json(
        { error: 'Prompt contained no usable visual description. Please rephrase.' },
        { status: 400 }
      )
    }

    // ── Step 4: kick off the text_to_image stage only. Returns immediately.
    let textToImage
    try {
      textToImage = await startRunwayTextToImage(finalPromptText, '720:1280')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[generate-video] text_to_image start failed:', msg)
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    console.log(
      '[generate-video] text_to_image started: task_id=',
      textToImage.id,
      'for user',
      user.id
    )

    // ── Step 5: persist a generation row in `processing` state. We stash all
    // async-polling fields into the existing `content` JSONB column so this
    // change does not require a schema migration.
    const generationContent = {
      type: 'runway_video',
      prompt,
      sceneText: augmented,
      promptText: finalPromptText,
      platform,
      requested_duration: requestedDuration,
      quality,
      credits_required: cost,
      // Two-stage Runway pipeline: text_to_image → image_to_video.
      stage: 'text_to_image' as const,
      text_to_image_task_id: textToImage.id,
      text_to_image_url: null as string | null,
      image_to_video_task_id: null as string | null,
      status: 'processing' as const,
      video_url: null as string | null,
      error: null as string | null,
      charged: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data: insertRow, error: insertErr } = await supabase
      .from('generations')
      .insert({
        user_id: user.id,
        niche: 'runway_video',
        content: generationContent,
      })
      .select('id')
      .single()

    if (insertErr || !insertRow) {
      console.error(
        '[generate-video] failed to persist generation row:',
        insertErr?.message
      )
      return NextResponse.json(
        { error: 'Could not save generation. Please try again.' },
        { status: 500 }
      )
    }

    console.log(
      '[generate-video] queued generation',
      insertRow.id,
      'text_to_image_task_id=',
      textToImage.id,
      'cost=',
      cost
    )

    return NextResponse.json({
      generation_id: insertRow.id,
      status: 'processing',
      stage: 'text_to_image',
      prompt,
      sceneText: augmented,
      cost,
      duration: requestedDuration,
      quality,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[generate-video] unexpected error:', msg)
    return NextResponse.json(
      { error: 'Video generation failed. Please try again.' },
      { status: 500 }
    )
  }
}
