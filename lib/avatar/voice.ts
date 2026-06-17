// AI Avatar — voice cloning (the avatar speaks in the user's OWN voice).
// MiniMax on fal: clone a voice from a ~10-60s sample → custom_voice_id, then
// synthesize the narration in that voice (multilingual, incl. Portuguese).
// Runs on the same FAL_KEY as the other avatar engines.
//   Clone:     fal-ai/minimax/voice-clone   ($1.50 per clone, one-time per voice)
//   Synthesize: fal-ai/minimax/speech-02-hd ($0.10 / 1000 chars)
import { fal } from '@fal-ai/client'

function configureFal(): boolean {
  const key = process.env.FAL_KEY
  if (!key) return false
  fal.config({ credentials: key })
  return true
}

const CLONE_MODEL = 'fal-ai/minimax/voice-clone'
const TTS_MODEL = 'fal-ai/minimax/speech-02-hd'

function langBoost(language?: string): string {
  if (language === 'pt') return 'Portuguese'
  if (language === 'es') return 'Spanish'
  return 'English'
}

/** Clone a voice from a sample audio URL (>=10s). Returns the custom_voice_id,
 *  or null on any failure (the caller surfaces a friendly error). */
export async function cloneVoice(audioUrl: string): Promise<string | null> {
  if (!configureFal()) return null
  const input: Record<string, unknown> = {
    audio_url: audioUrl,
    noise_reduction: true,
    need_volume_normalization: true,
  }
  const model: string = CLONE_MODEL
  try {
    const result = (await fal.subscribe(model, { input })) as {
      data?: { custom_voice_id?: string }
      custom_voice_id?: string
    }
    const id = result?.data?.custom_voice_id ?? result?.custom_voice_id ?? null
    return id && id.length > 0 ? id : null
  } catch (err) {
    console.error('[avatar/voice] clone failed:', err instanceof Error ? err.message : String(err))
    return null
  }
}

/** Synthesize text in a previously cloned voice. Returns the mp3 Buffer, or
 *  throws (the caller falls back to the default TTS engine so the render never
 *  fails just because of voice cloning). */
export async function synthesizeWithVoice(args: {
  voiceId: string
  text: string
  language?: string
}): Promise<Buffer> {
  if (!configureFal()) throw new Error('Voice engine is not configured.')
  const input: Record<string, unknown> = {
    text: args.text,
    voice_setting: { voice_id: args.voiceId },
    language_boost: langBoost(args.language),
    output_format: 'url',
  }
  const model: string = TTS_MODEL
  const result = (await fal.subscribe(model, { input })) as {
    data?: { audio?: { url?: string } }
    audio?: { url?: string }
  }
  const url = result?.data?.audio?.url ?? result?.audio?.url ?? null
  if (!url) throw new Error('Cloned-voice TTS returned no audio.')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch cloned audio failed: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}
