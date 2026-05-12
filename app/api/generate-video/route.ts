import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateScenes, startRunwayTask, buildRunwayPayload } from '@/lib/runway'
import {
  encodeGenerationMeta,
  fetchActiveGeneration,
  finalizeGeneration,
  isStale,
} from '@/lib/generations'

export const maxDuration = 60

// Runway Gen-4 Turbo only supports 5 or 10 seconds.
// 30s / 60s multi-clip stitching is not yet implemented.
const SUPPORTED_DURATIONS = [5, 10]

type Quality = 'basic' | 'basic_ai' | 'pro'

function costForQuality(q: string | undefined): number {
  if (q === 'pro') return 2
  return 1 // 'basic' and 'basic_ai'
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

    // ── Concurrency / stale-job guard ────────────────────────────────────────
    // Runway tier has concurrency = 1, so only one processing generation per
    // user is allowed. If the existing one is stale we sweep it and proceed.
    const active = await fetchActiveGeneration(supabase, user.id)
    if (active) {
      if (isStale({ created_at: active.created_at, updated_at: active.updated_at })) {
        console.log(`[generate-video] sweeping stale generation ${active.id} for user ${user.id}`)
        await finalizeGeneration(supabase, active.id, 'failed', { credits_used: 0 })
      } else {
        return NextResponse.json(
          {
            error: 'active_generation_exists',
            generation_id: active.id,
            status: 'processing',
            created_at: active.created_at,
            updated_at: active.updated_at ?? active.created_at,
          },
          { status: 409 }
        )
      }
    }

    let body: { prompt?: string; platform?: string; duration?: number; quality?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const prompt = (body.prompt ?? '').trim()
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 })
    }
    if (prompt.length > 500) {
      return NextResponse.json({ error: 'Prompt is too long (500 chars max).' }, { status: 400 })
    }

    // Resolve platform and duration — clamp duration to valid Runway values (5 or 10)
    const platform = (body.platform ?? 'YouTube Shorts').toString()
    const requestedDuration = Number(body.duration) || 10
    if (!SUPPORTED_DURATIONS.includes(requestedDuration) && requestedDuration > 10) {
      return NextResponse.json(
        { error: 'Multi-clip rendering (30s / 60s) is coming soon. Please choose 10s for now.' },
        { status: 400 }
      )
    }
    const duration = requestedDuration <= 5 ? 5 : 10
    const quality: Quality = (body.quality === 'pro' || body.quality === 'basic_ai' ? body.quality : 'basic') as Quality
    const cost = costForQuality(quality)

    // ── Credit balance check (we DO NOT deduct here — deduction happens after
    // the Runway task completes successfully in /status). ─────────────────────
    {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('video_credits')
        .eq('id', user.id)
        .single()

      if (profileErr && profileErr.code !== 'PGRST116') {
        console.error('[generate-video] credit check failed:', profileErr.message)
      }
      const balance = profile?.video_credits ?? 0
      if (balance < cost) {
        return NextResponse.json(
          { error: 'Not enough credits.', needed: cost, balance },
          { status: 402 }
        )
      }
    }

    // Step 1 — OpenAI breaks the prompt into 4 cinematic scenes
    let scenes: string[]
    try {
      scenes = await generateScenes(prompt)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[generate-video] scene generation failed:', msg)
      return NextResponse.json(
        { error: 'Failed to plan scenes. Please try a different prompt.' },
        { status: 500 }
      )
    }

    // Pre-validate the first scene payload BEFORE launching tasks.
    // This catches any Runway field errors early — before credits are charged.
    try {
      buildRunwayPayload(scenes[0], platform, duration)
    } catch (validationErr: unknown) {
      const msg = validationErr instanceof Error ? validationErr.message : String(validationErr)
      console.error('[generate-video] payload pre-validation failed:', msg)
      return NextResponse.json(
        { error: `Request validation failed: ${msg}` },
        { status: 400 }
      )
    }

    // Step 2 — Kick off a SINGLE RunwayML task and return immediately.
    // Runway Tier 1 only allows concurrency=1, so we render one 10s clip.
    // The route does NOT wait for the clip to finish — /status handles that.
    const firstScene = scenes[0]
    let singleTask: { id: string; promptText: string }
    try {
      singleTask = await startRunwayTask(firstScene, platform, duration)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[generate-video] runway task start failed:', msg)
      // Pass the specific Runway error through so the UI can show a useful message
      return NextResponse.json(
        { error: msg },
        { status: 502 }
      )
    }

    const taskHandles = [{
      id: singleTask.id,
      promptText: singleTask.promptText,
      index: 0,
    }]

    // Step 3 — Persist the generation row so we can recover after a refresh
    // and so /status can authorize the polling request.
    const meta = encodeGenerationMeta({
      task_ids: taskHandles,
      prompt,
      scenes,
      cost,
      platform,
      duration,
      quality,
    })

    const { data: inserted, error: insertErr } = await supabase
      .from('videos')
      .insert({
        user_id: user.id,
        status: 'processing',
        platform,
        duration,
        quality_mode: quality,
        credits_used: 0, // charged only on completion
        topic: prompt,
        script: meta,
        title: prompt.slice(0, 60),
      })
      .select('id, created_at')
      .single()

    if (insertErr || !inserted) {
      console.error('[generate-video] failed to persist generation row:', insertErr?.message)
      return NextResponse.json(
        { error: 'Could not start generation. Please try again.' },
        { status: 500 }
      )
    }

    console.log(`[generate-video] created generation ${inserted.id} for user ${user.id} (cost=${cost}, tasks=${taskHandles.length})`)

    return NextResponse.json(
      {
        generation_id: inserted.id,
        status: 'processing',
        prompt,
        scenes,
        tasks: taskHandles,
        cost,
        created_at: inserted.created_at,
      },
      { status: 202 }
    )
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[generate-video] unexpected error:', msg)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
