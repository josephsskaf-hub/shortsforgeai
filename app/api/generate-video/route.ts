import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateScenes, startRunwayTask, buildRunwayPayload } from '@/lib/runway'

export const maxDuration = 60

// Runway Gen-4 Turbo only supports 5 or 10 seconds.
// 30s / 60s multi-clip stitching is not yet implemented.
const SUPPORTED_DURATIONS = [5, 10]

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

    let body: { prompt?: string; platform?: string; duration?: number }
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

    // Step 2 — Kick off RunwayML tasks (in parallel) and return the task IDs
    let tasks: { id: string; promptText: string }[]
    try {
      tasks = await Promise.all(
        scenes.map((sceneText) => startRunwayTask(sceneText, platform, duration))
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[generate-video] runway task start failed:', msg)
      // Pass the specific Runway error through so the UI can show a useful message
      return NextResponse.json(
        { error: msg },
        { status: 502 }
      )
    }

    return NextResponse.json({
      prompt,
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
