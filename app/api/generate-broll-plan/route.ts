import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { brollEngine } from '@/lib/broll/broll-engine'
import type { BrollEngineInput } from '@/lib/broll/types'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('[generate-broll-plan] OPENAI_API_KEY is not configured')
      return NextResponse.json({ error: 'AI service is not configured.' }, { status: 500 })
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: Partial<BrollEngineInput>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const script = (body.script ?? '').trim()
    if (!script) {
      return NextResponse.json({ error: 'script is required.' }, { status: 400 })
    }

    const niche = (body.niche ?? 'general').trim()
    const tone = (body.tone ?? 'cinematic').trim()
    const duration = typeof body.duration === 'number' && body.duration > 0 ? body.duration : 45
    const language = (body.language ?? 'en').trim()

    const input: BrollEngineInput = {
      script,
      niche,
      tone,
      duration,
      language,
      globalStyle: body.globalStyle,
    }

    const plan = await brollEngine(input)
    return NextResponse.json(plan)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[generate-broll-plan] unexpected error:', msg)
    return NextResponse.json({ error: 'B-roll plan generation failed. Please try again.' }, { status: 500 })
  }
}
