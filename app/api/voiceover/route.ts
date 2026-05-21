import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service is not configured.' },
        { status: 500 }
      )
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: { script?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const script = (body.script ?? '').trim()
    if (!script) {
      return NextResponse.json({ error: 'Script is required.' }, { status: 400 })
    }

    // Trim very long inputs (TTS limit ~4096 chars)
    const input = script.length > 3800 ? script.slice(0, 3800) : script

    let speech
    try {
      speech = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'onyx',
        input,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[voiceover] OpenAI TTS error:', msg)
      return NextResponse.json(
        { error: 'Voiceover generation failed. Please try again.' },
        { status: 500 }
      )
    }

    const buffer = Buffer.from(await speech.arrayBuffer())

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[voiceover] unexpected error:', msg)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
