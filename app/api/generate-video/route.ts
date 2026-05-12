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

type Quality = 'basic' | 'pro'

// Flat per-job cost. The spec says credits are charged ONCE for the whole
// generation regardless of clip count — 30s and 50s jobs do not pay 3x or 5x.
// Basic = 15 credits, Pro = 20 credits (push #020 pricing policy).
function costForQuality(q: string | undefined): number {
  if (q === 'pro') return 20
  return 15 // 'basic'
}

/**
 * How many 10-second Runway clips are needed for the requested duration.
 * 10s â 1 clip, 30s â 3 clips, 50s â 5 clips.
 */
function clipCountForDuration(duration: number): number {
  if (duration <= 10) return 1
  if (duration <= 30) return 3
  return 5
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

    // ââ Concurrency / stale-job guard ââââââââââââââââââââââââââââââââââââââââ
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

    // Resolve platform and duration.
    // We support 10s (1 clip), 30s (3 clips), and 50s (5 clips).
    // Each Runway clip is 10 seconds; clips are generated sequentially.
    const platform = (body.platform ?? 'YouTube Shorts').toString()
    const requestedDuration = Number(body.duration) || 10
    const duration = requestedDuration <= 10 ? 10 : requestedDuration <= 30 ? 30 : 50
    const clipCount = clipCountForDuration(duration)
    const quality: Quality = body.quality === 'pro' ? 'pro' : 'basic'
    // Flat cost — 15 credits for Basic, 20 credits for Pro, regardless of duration.
    const cost = costForQuality(quality)

    // ââ Credit balance check (we DO NOT deduct here â deduction happens after
    // the Runway task completes successfully in /status). âââââââââââââââââââââ
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

    // Step 1 â OpenAI breaks the prompt into N cinematic scenes (one per clip).
    let scenes: string[]
    try {
      scenes = await generateScenes(prompt, clipCount)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[generate-video] scene generation failed:', msg)
      return NextResponse.json(
        { error: 'Failed to plan scenes. Please try a different prompt.' },
        { status: 500 }
      )
    }

    // Pre-validate the first scene payload BEFORE launching tasks.
    // This catches any Runway field errors early â before credits are charged.
    try {
      buildRunwayPayload(scenes[0], platform, 10, quality)
    } catch (validationErr: unknown) {
      const msg = validationErr instanceof Error ? validationErr.message : String(validationErr)
      console.error('[generate-video] payload pre-validation failed:', msg)
      return NextResponse.json(
        { error: `Request validation failed: ${msg}` },
        { status: 400 }
      )
    }

    // Step 2 â Kick off ONLY the first Runway clip and return immediately.
    // Runway Tier 1 has concurrency=1. Remaining clips are stored as
    // pending_scenes and launched sequentially by /status as each clip finishes.
    let singleTask: { id: string; promptText: string }
    try {
      singleTask = await startRunwayTask(scenes[0], platform, 10, quality)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[generate-video] runway task start failed:', msg)
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

    // Step 3 â Persist the generation row so we can recover after a refresh
    // and so /status can authorize the polling request.
    const meta = encodeGenerationMeta({
      task_ids: taskHandles,
      prompt,
      scenes,
      cost,
      platform,
      duration,
      quality,
      pending_scenes: scenes.slice(1),   // clips 1..N-1 queued for later
      completed_clip_urls: [],            // filled in by /status as clips finish
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

    console.log(`[generate-video] created generation ${inserted.id} for user ${user.id} (duration=${duration}s, clips=${clipCount}, cost=${cost})`)

    return NextResponse.json(
      {
        generation_id: inserted.id,
        status: 'processing',
        prompt,
        scenes,
        tasks: taskHandles,
        cost,
        clip_count: clipCount,
        duration,
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
