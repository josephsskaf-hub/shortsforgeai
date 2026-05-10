import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateScenes, startRunwayTask } from '@/lib/runway'

export const maxDuration = 60

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

    let body: { prompt?: string }
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

    // Step 2 — Kick off RunwayML tasks (in parallel) and return the task IDs
    let tasks: { id: string; promptText: string }[]
    try {
      tasks = await Promise.all(scenes.map((sceneText) => startRunwayTask(sceneText)))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[generate-video] runway task start failed:', msg)
      const lower = msg.toLowerCase()
      if (lower.includes('quota') || lower.includes('insufficient') || lower.includes('credit')) {
        return NextResponse.json(
          { error: 'Runway credits exhausted. Please try again later.' },
          { status: 503 }
        )
      }
      if (lower.includes('rate')) {
        return NextResponse.json(
          { error: 'Runway rate limit hit. Please wait a moment and retry.' },
          { status: 429 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to start video generation. Please try again.' },
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
