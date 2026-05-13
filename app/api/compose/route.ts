import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildCreatomateSource,
  generateTTS,
  pollCreatomateRender,
  scaleVoiceoverScript,
  submitCreatomateRender,
  targetWordCount,
  uploadVoiceoverToSupabase,
} from '@/lib/compose'

export const maxDuration = 60

const SUPPORTED_DURATIONS = [10, 30, 60] as const
type Quality = 'basic' | 'basic_ai' | 'pro'

interface ComposeBody {
  generationId?: string
  clip_urls?: string[]
  voiceover_script?: string
  scene_captions?: string[]
  duration?: number
  topic?: string
  quality?: string
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service is not configured.' },
        { status: 500 }
      )
    }
    if (!process.env.CREATOMATE_API_KEY) {
      return NextResponse.json(
        { error: 'Render service is not configured.' },
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

    let body: ComposeBody
    try {
      body = (await req.json()) as ComposeBody
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const clipUrls = Array.isArray(body.clip_urls)
      ? body.clip_urls.filter((u) => typeof u === 'string' && u.trim().length > 0)
      : []
    if (clipUrls.length === 0) {
      return NextResponse.json({ error: 'clip_urls is required.' }, { status: 400 })
    }

    const voiceoverScript = (body.voiceover_script ?? '').toString().trim()
    if (!voiceoverScript) {
      return NextResponse.json({ error: 'voiceover_script is required.' }, { status: 400 })
    }

    const sceneCaptions = Array.isArray(body.scene_captions)
      ? body.scene_captions
          .map((c) => (typeof c === 'string' ? c.trim() : ''))
          .filter((c) => c.length > 0)
      : []

    const requestedDuration = Number(body.duration) || 30
    const duration = (SUPPORTED_DURATIONS as readonly number[]).includes(requestedDuration)
      ? requestedDuration
      : 30

    const quality: Quality = ((): Quality => {
      const q = (body.quality ?? 'basic_ai').toString()
      return q === 'basic' || q === 'pro' ? q : 'basic_ai'
    })()

    // Step 1 — Scale the voiceover script to the right word count.
    let scaledScript: string
    try {
      scaledScript = await scaleVoiceoverScript(voiceoverScript, targetWordCount(duration))
      if (!scaledScript) scaledScript = voiceoverScript
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[compose] script scaling failed:', msg)
      // Non-fatal — fall back to the raw script.
      scaledScript = voiceoverScript
    }

    // Step 2 — Generate TTS.
    let audioBuffer: Buffer
    try {
      audioBuffer = await generateTTS(scaledScript)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[compose] TTS failed:', msg)
      return NextResponse.json(
        { error: 'Voiceover generation failed. Please try again.' },
        { status: 502 }
      )
    }

    // Step 3 — Upload TTS to Supabase storage.
    let voiceoverUrl: string
    try {
      voiceoverUrl = await uploadVoiceoverToSupabase(user.id, audioBuffer)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[compose] voiceover upload failed:', msg)
      return NextResponse.json(
        { error: 'Could not store the voiceover. Please try again.' },
        { status: 502 }
      )
    }

    // Step 4 — Build the Creatomate source.
    let source: Record<string, unknown>
    try {
      source = buildCreatomateSource({
        clipUrls,
        voiceoverUrl,
        sceneCaptions,
        duration,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[compose] source build failed:', msg)
      return NextResponse.json(
        { error: `Could not assemble the render: ${msg}` },
        { status: 500 }
      )
    }

    // Step 5 — Submit to Creatomate.
    let renderId: string
    try {
      renderId = await submitCreatomateRender(source)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[compose] Creatomate submit failed:', msg)
      return NextResponse.json(
        { error: 'Render service rejected the job. Please try again.' },
        { status: 502 }
      )
    }

    // Best-effort sanity check — confirm the render actually exists.
    try {
      await pollCreatomateRender(renderId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[compose] post-submit poll warning:', msg)
    }

    return NextResponse.json({
      render_id: renderId,
      quality,
      duration,
      voiceover_url: voiceoverUrl,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[compose] unexpected error:', msg)
    return NextResponse.json(
      { error: 'Something went wrong while preparing the render.' },
      { status: 500 }
    )
  }
}
