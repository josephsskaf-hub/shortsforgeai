import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import {
  buildRunwayPayload,
  clampToProviderLimit,
  generateScenes,
  startRunwayTask,
} from '@/lib/runway'

export const maxDuration = 60

// Runway only generates clips of 5 or 10 seconds. To produce a longer Short
// we kick off multiple 10s clips in parallel and let /api/compose stitch
// them together. Push #064 — durations bumped to 30 / 45 / 60 so the AI
// has enough room to build a real story arc. The default 45s lives in
// the client.
const SUPPORTED_DURATIONS = [30, 45, 60] as const
type Duration = (typeof SUPPORTED_DURATIONS)[number]
type Quality = 'basic' | 'basic_ai' | 'pro'

function clipCountForDuration(d: Duration): number {
  // 30s → 3 clips (30s), 45s → 5 clips (5×10s = 50s, last clip truncated
  // by compose to land at 45s), 60s → 6 clips (60s). Each Runway clip is
  // 10s, so we round up to cover the full duration.
  return Math.max(1, Math.ceil(d / 10))
}

// Credit cost shown on the Generate screen. Must match QUALITY_OPTIONS in
// app/(dashboard)/generate/GenerateClient.tsx and the deduction logic in
// /api/compose/status/[renderId]. Basic / Basic AI = 15, Pro = 20.
function creditCostFor(q: Quality): number {
  return q === 'pro' ? 20 : 15
}

// The Runway helper only knows about 'basic' | 'pro'. 'basic_ai' is a
// UI-side label that maps to the same Runway behavior as 'basic'.
function runwayQualityFor(q: Quality): 'basic' | 'pro' {
  return q === 'pro' ? 'pro' : 'basic'
}

export async function POST(req: NextRequest) {
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

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'You must be signed in to generate a video.' },
        { status: 401 }
      )
    }

    let body: {
      prompt?: string
      // Optional short visual-only prompt forwarded from /api/analyze-idea's
      // creative brief (≤500 chars, no hashtags, no narration). When
      // present, we use it as the seed for scene generation instead of the
      // raw user idea — see push #041 for why.
      provider_prompt?: string
      platform?: string
      duration?: number
      quality?: string
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
    // Push #041: the user idea field can carry a full creative brief — only
    // the visual prompts that actually reach Runway need the 500-char cap,
    // not this top-level user text. Bump to 1500 to match the textarea
    // maxLength on the client.
    if (prompt.length > 1500) {
      return NextResponse.json({ error: 'Prompt is too long (1500 chars max).' }, { status: 400 })
    }

    const platform = (body.platform ?? 'YouTube Shorts').toString()
    const requestedDuration = Number(body.duration) || 45
    const duration: Duration = SUPPORTED_DURATIONS.includes(requestedDuration as Duration)
      ? (requestedDuration as Duration)
      : 45
    const quality: Quality = ((): Quality => {
      const q = (body.quality ?? 'basic_ai').toString()
      return q === 'basic' || q === 'pro' ? q : 'basic_ai'
    })()

    const clipCount = clipCountForDuration(duration)
    const cost = creditCostFor(quality)

    // Step 0 — Upfront credit balance check. We don't deduct here (that
    // happens in /api/compose/status once the final MP4 is confirmed), but
    // refusing now prevents starting Runway tasks for a user who can't pay.
    {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('video_credits')
        .eq('id', user.id)
        .single()
      if (profileErr && profileErr.code !== 'PGRST116') {
        console.error('[generate-video] credit balance fetch failed:', profileErr.message)
      }
      const balance = profile?.video_credits ?? 0
      if (balance < cost) {
        return NextResponse.json(
          { error: 'Not enough credits.', needed: cost, balance },
          { status: 402 }
        )
      }
    }

    // Push #041 — decide what seeds the scene generation.
    // If the client passes the brief's `provider_prompt` (a short visual-only
    // string ≤500 chars), use it directly — it's already been groomed for
    // Runway. Otherwise derive one from the user idea, slicing to 400 chars
    // before the sentence-aware clamp so we don't blow up the OpenAI prompt
    // with a full creative brief. Either way the seed goes through
    // clampToProviderLimit so it is provably ≤500.
    const providerPromptRaw = (body.provider_prompt ?? '').trim()
    const sceneSeed = providerPromptRaw
      ? clampToProviderLimit(providerPromptRaw)
      : clampToProviderLimit(prompt.slice(0, 400))
    console.log(
      `[generate] provider_prompt length: ${sceneSeed.length}, preview: ${sceneSeed.slice(0, 120)}`
    )

    // Step 1 — OpenAI breaks the seed into N cinematic scene descriptions.
    // Each returned string is short (~15-25 words) and goes through
    // buildRunwayPayload → clampToProviderLimit again before reaching Runway,
    // so per-scene 500-char compliance is enforced at the boundary.
    let scenes: string[]
    try {
      scenes = await generateScenes(sceneSeed, clipCount)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[generate-video] scene generation failed:', msg)
      return NextResponse.json(
        { error: 'Failed to plan scenes. Please try a different prompt.' },
        { status: 500 }
      )
    }

    // Pre-validate the first scene payload BEFORE launching tasks so any
    // Runway field error surfaces before any Runway billing happens.
    const runwayQuality = runwayQualityFor(quality)
    try {
      buildRunwayPayload(scenes[0], platform, 10, runwayQuality)
    } catch (validationErr: unknown) {
      const msg = validationErr instanceof Error ? validationErr.message : String(validationErr)
      console.error('[generate-video] payload pre-validation failed:', msg)
      return NextResponse.json(
        { error: `Request validation failed: ${msg}` },
        { status: 400 }
      )
    }

    // Step 2 — Kick off all Runway tasks in parallel.
    let tasks: { id: string; promptText: string }[]
    try {
      tasks = await Promise.all(
        scenes.map((sceneText) => startRunwayTask(sceneText, platform, 10, runwayQuality))
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[generate-video] runway task start failed:', msg)
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    const generationId = randomUUID()

    return NextResponse.json({
      generationId,
      prompt,
      duration,
      quality,
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
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
