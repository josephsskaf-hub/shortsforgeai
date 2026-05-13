import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { generateScenes, startRunwayTask, buildRunwayPayload } from '@/lib/runway'

export const maxDuration = 60

// Runway Gen-4 Turbo only generates clips of 5 or 10 seconds. To produce a
// longer Short we kick off multiple 10s clips in parallel and let /api/compose
// stitch them together.
const SUPPORTED_DURATIONS = [10, 30, 60] as const
type Duration = (typeof SUPPORTED_DURATIONS)[number]
type Quality = 'basic' | 'basic_ai' | 'pro'

function clipCountForDuration(d: Duration): number {
  // 10s → 1 clip, 30s → 3 clips, 60s → 6 clips. Each Runway clip is 10s.
  return Math.max(1, Math.round(d / 10))
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

    const platform = (body.platform ?? 'YouTube Shorts').toString()
    const requestedDuration = Number(body.duration) || 30
    const duration: Duration = SUPPORTED_DURATIONS.includes(requestedDuration as Duration)
      ? (requestedDuration as Duration)
      : 30
    const quality: Quality = ((): Quality => {
      const q = (body.quality ?? 'basic_ai').toString()
      return q === 'basic' || q === 'pro' ? q : 'basic_ai'
    })()

    const clipCount = clipCountForDuration(duration)

    // Step 1 — OpenAI breaks the prompt into N cinematic scenes.
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

    // Pre-validate the first scene payload BEFORE launching tasks so any
    // Runway field error surfaces before any Runway billing happens.
    try {
      buildRunwayPayload(scenes[0], platform, 10)
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
        scenes.map((sceneText) => startRunwayTask(sceneText, platform, 10))
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
