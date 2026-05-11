import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateScenes, startRunwayTask, buildRunwayPayload } from '@/lib/runway'

export const maxDuration = 60

type Quality = 'basic' | 'basic_ai' | 'pro'

// Each Runway gen4_turbo clip is 10s. Total video length → # of 10s clips.
const SCENES_FOR_DURATION: Record<number, number> = {
  10: 1,
  30: 3,
  60: 6,
}

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

  let userId: string | null = null
  let creditsDeducted = 0

  async function refundCredits() {
    if (!userId || creditsDeducted <= 0) return
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('video_credits')
        .eq('id', userId)
        .single()
      const current = profile?.video_credits ?? 0
      await supabase
        .from('profiles')
        .update({ video_credits: current + creditsDeducted })
        .eq('id', userId)
    } catch (err) {
      console.error('[generate-video] refund failed:', err)
    }
  }

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
    userId = user.id

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

    const requestedDuration = Number(body.duration) || 30
    const sceneCount = SCENES_FOR_DURATION[requestedDuration]
    if (!sceneCount) {
      return NextResponse.json(
        { error: 'Duration must be 10, 30, or 60 seconds.' },
        { status: 400 }
      )
    }

    const quality: Quality =
      body.quality === 'basic' || body.quality === 'pro' || body.quality === 'basic_ai'
        ? body.quality
        : 'basic_ai'
    const cost = QUALITY_COST[quality]

    // Verify and deduct credits BEFORE calling Runway.
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('video_credits')
      .eq('id', user.id)
      .single()

    if (profileErr) {
      console.error('[generate-video] profile lookup error:', profileErr.message)
      return NextResponse.json(
        { error: 'Could not load your credit balance. Please try again.' },
        { status: 500 }
      )
    }

    const available = profile?.video_credits ?? 0
    if (available < cost) {
      return NextResponse.json(
        { error: `Not enough credits. This generation needs ${cost} credit${cost === 1 ? '' : 's'}.`, credits: available },
        { status: 402 }
      )
    }

    const { error: deductErr } = await supabase
      .from('profiles')
      .update({ video_credits: available - cost })
      .eq('id', user.id)
      .gte('video_credits', cost)

    if (deductErr) {
      console.error('[generate-video] credit deduction failed:', deductErr.message)
      return NextResponse.json(
        { error: 'Could not reserve credits. Please try again.' },
        { status: 500 }
      )
    }
    creditsDeducted = cost

    // Plan scenes
    let scenes: string[]
    try {
      scenes = await generateScenes(prompt, sceneCount)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[generate-video] scene generation failed:', msg)
      await refundCredits()
      return NextResponse.json(
        { error: 'Failed to plan scenes. Please try a different prompt.' },
        { status: 500 }
      )
    }

    const augmentedScenes = scenes.map((s) => augmentForQuality(s, quality))

    // Pre-validate the first payload — catches bad fields before launching the rest.
    try {
      buildRunwayPayload(augmentedScenes[0], platform, 10)
    } catch (validationErr: unknown) {
      const msg = validationErr instanceof Error ? validationErr.message : String(validationErr)
      console.error('[generate-video] payload pre-validation failed:', msg)
      await refundCredits()
      return NextResponse.json(
        { error: 'Video generation failed. Please try again.' },
        { status: 400 }
      )
    }

    // Kick off all Runway tasks. Always 10s per clip — total duration is # of clips.
    let tasks: { id: string; promptText: string }[]
    try {
      tasks = await Promise.all(
        augmentedScenes.map((sceneText) => startRunwayTask(sceneText, platform, 10))
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[generate-video] runway task start failed:', msg)
      await refundCredits()
      return NextResponse.json(
        { error: 'Video generation failed. Please try again.' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      prompt,
      duration: requestedDuration,
      quality,
      cost,
      creditsRemaining: available - cost,
      scenes,
      tasks: tasks.map((t, i) => ({
        id: t.id,
        promptText: t.promptText,
        index: i,
      })),
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[generate-video] unexpected error:', msg)
    await refundCredits()
    return NextResponse.json(
      { error: 'Video generation failed. Please try again.' },
      { status: 500 }
    )
  }
}
