// AI Avatar — voice cloning route.
// POST multipart/form-data: `file` (audio sample, >=10s recommended, <= 12MB).
// Uploads the sample to storage, clones the voice via MiniMax, and returns the
// custom_voice_id. The client holds that id and passes it to /api/generate-avatar
// so the narration is spoken in the cloned voice.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uploadAvatarAudio } from '@/lib/avatar/storage'
import { cloneVoice } from '@/lib/avatar/voice'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const MAX_BYTES = 12 * 1024 * 1024
const EXT_BY_MIME: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: 'Voice engine is not configured.' }, { status: 500 })
    }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid upload request.' }, { status: 400 })
    }
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'A voice sample (audio file) is required.' }, { status: 400 })
    }
    const mime = (file.type || '').toLowerCase()
    const ext = EXT_BY_MIME[mime]
    if (!ext) {
      return NextResponse.json({ error: 'Use an MP3, M4A, WAV, OGG or WebM audio file.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Audio is too large — keep it under 12 MB (~1-2 min).' }, { status: 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length === 0) {
      return NextResponse.json({ error: 'The audio file is empty.' }, { status: 400 })
    }

    let audioUrl: string
    try {
      audioUrl = await uploadAvatarAudio(user.id, buffer, ext, mime)
    } catch (err) {
      console.error('[avatar/voice] upload failed:', err instanceof Error ? err.message : String(err))
      return NextResponse.json({ error: 'Could not store the voice sample. Please try again.' }, { status: 502 })
    }

    const cloneRes = await cloneVoice(audioUrl)
    if (!cloneRes.voiceId) {
      // Surface the RAW MiniMax/fal error so we can diagnose precisely (the
      // Vercel log dashboard truncates messages). Safe — it's the user's own
      // debug context, no secrets.
      return NextResponse.json(
        { error: `Voice clone failed — ${cloneRes.error ?? 'unknown error'}` },
        { status: 502 },
      )
    }

    // KINEO-OWN-VOICE-2026-07-10 — persist the clone on the PROFILE (migration
    // 016): clone once in Avatar Studio → every Fast/AI generation can narrate
    // with the user's voice. Best-effort: a failed update never fails the clone.
    try {
      await supabase.from('profiles').update({ voice_clone_id: cloneRes.voiceId }).eq('id', user.id)
    } catch (e) {
      console.warn('[avatar/voice] voice_clone_id persist failed (non-blocking):', e instanceof Error ? e.message : String(e))
    }

    console.log(`[avatar/voice] cloned user=${user.id.slice(0, 8)} voice=${cloneRes.voiceId}`)
    return NextResponse.json({ voiceId: cloneRes.voiceId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[avatar/voice] unexpected error:', msg)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
