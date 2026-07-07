import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import {
  buildCreatomateSource,
  estimateMp3DurationSeconds,
  generateTTS,
  scaleVoiceoverScript,
  submitCreatomateRender,
  targetWordCount,
  transcribeTTSWithTimestamps,
  uploadVoiceoverToSupabase,
  type WhisperWord,
} from '@/lib/compose'
import { stripScriptMarkers } from '@/lib/scriptParser'
import { getBackgroundMusicUrl } from '@/lib/pixabayMusic'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

// KINEO-WM-CHECKOUT-2026-07-07 — "watermark moment" inline unlock.
//
// When a FREE-plan user's Fast video finishes it carries a burnt-in watermark
// (see /api/compose → buildCreatomateSource, track 9 — it is baked into the MP4,
// so removing it REQUIRES a fresh render). The post-render CTA sells the $4.90
// Starter Pack (25 Fast Shorts, sets profiles.has_paid=true). On return, the
// client calls THIS route with the EXACT inputs of the just-made Fast video.
//
// This route:
//   1. Verifies the Stripe Checkout Session is PAID and belongs to this user.
//      It talks to Stripe directly, so it works even before the async webhook
//      lands (and in staging where the webhook may not be wired). No credits are
//      granted here — the webhook remains the single grantor of the 25 pack
//      credits (so there is zero double-credit risk).
//   2. Sets profiles.has_paid=true (idempotent safety net; the webhook does too).
//   3. Re-renders the SAME video with watermark:false and returns render_id.
//      The client then polls the normal /api/compose/status pipeline, which
//      migrates the asset to permanent storage + writes Visual History exactly
//      like any Fast render. (A Fast render costs 1 credit; the user just bought
//      25, so the clean re-render is effectively covered. If the webhook credit
//      grant hasn't landed yet, the debit RPC simply no-ops and the clean video
//      is still delivered — safe degradation.)
//
// NOTE: no exploit surface for FREE renders — the clean re-render flows through
// the standard credit path, so replaying a session_id only ever spends the
// user's own credits (same as making a normal Fast video).

interface UnlockBody {
  session_id?: string
  clip_urls?: string[]
  voiceover_script?: string
  scene_captions?: string[]
  duration?: number
  topic?: string
  language?: string
  vertical?: string
  speed?: number
}

const SUPPORTED_DURATIONS = [45, 60, 90] as const

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'AI service is not configured.' }, { status: 500 })
    }
    if (!process.env.CREATOMATE_API_KEY) {
      return NextResponse.json({ error: 'Render service is not configured.' }, { status: 500 })
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json({ error: 'Storage backend is not configured.' }, { status: 500 })
    }
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Payment service is not configured.' }, { status: 500 })
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: UnlockBody
    try {
      body = (await req.json()) as UnlockBody
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const sessionId = (body.session_id ?? '').trim()
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required.' }, { status: 400 })
    }

    const clipUrls = Array.isArray(body.clip_urls)
      ? body.clip_urls.filter((u) => typeof u === 'string' && u.trim().length > 0)
      : []
    if (clipUrls.length === 0) {
      return NextResponse.json({ error: 'clip_urls is required.' }, { status: 400 })
    }

    const voiceoverScript = stripScriptMarkers(body.voiceover_script ?? '')
    if (!voiceoverScript) {
      return NextResponse.json({ error: 'voiceover_script is required.' }, { status: 400 })
    }

    // ── 1) Verify the Stripe Checkout Session (webhook-independent) ──────────
    let paidOk = false
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      const belongsToUser =
        session.metadata?.supabase_user_id === user.id || session.client_reference_id === user.id
      const isPack = session.metadata?.pack === 'starter10'
      paidOk =
        session.mode === 'payment' &&
        session.payment_status === 'paid' &&
        belongsToUser &&
        isPack
      if (!paidOk) {
        console.warn('[compose/unlock] session not eligible', {
          id: sessionId.slice(0, 12),
          mode: session.mode,
          payment_status: session.payment_status,
          belongsToUser,
          isPack,
        })
      }
    } catch (err) {
      console.error('[compose/unlock] stripe session retrieve failed:', err instanceof Error ? err.message : String(err))
      return NextResponse.json({ error: 'Could not verify your purchase. Please try again.' }, { status: 502 })
    }
    if (!paidOk) {
      return NextResponse.json({ error: 'This purchase could not be verified.' }, { status: 402 })
    }

    // ── 2) Safety-net: mark the user as paid so any FUTURE render is clean too.
    //    Idempotent; the Stripe webhook also sets this. Never grants credits.
    try {
      const admin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      )
      await admin.from('profiles').update({ has_paid: true }).eq('id', user.id)
    } catch (err) {
      // Non-fatal — the webhook will set it too; the clean render below still runs.
      console.warn('[compose/unlock] has_paid set failed (non-fatal):', err instanceof Error ? err.message : String(err))
    }

    // ── 3) Rebuild the SAME Fast video, clean (watermark:false) ──────────────
    const requestedDuration = Number(body.duration) || 45
    const duration = (SUPPORTED_DURATIONS as readonly number[]).includes(requestedDuration)
      ? requestedDuration
      : 45
    const language = body.language === 'pt' ? 'pt' : body.language === 'es' ? 'es' : 'en'
    const vertical =
      typeof body.vertical === 'string' && body.vertical.trim() ? body.vertical.trim().toLowerCase() : undefined
    const explicitSpeed: number | null = (() => {
      const s = Number(body.speed)
      return Number.isFinite(s) && s > 0 ? Math.max(0.7, Math.min(1.3, s)) : null
    })()
    const sceneCaptions = Array.isArray(body.scene_captions)
      ? body.scene_captions.map((c) => (typeof c === 'string' ? c.trim() : '')).filter((c) => c.length > 0)
      : []

    // Mirror /api/compose scaling: verbatim (explicit speed) is used as-is; a
    // generated brief is scaled to the duration's word target. Falls back safely.
    let scaledScript: string
    if (explicitSpeed != null) {
      scaledScript = voiceoverScript
    } else {
      try {
        scaledScript = await scaleVoiceoverScript(voiceoverScript, targetWordCount(duration))
        if (!scaledScript) scaledScript = voiceoverScript
      } catch {
        scaledScript = voiceoverScript
      }
    }

    let audioBuffer: Buffer
    try {
      audioBuffer = await generateTTS(scaledScript, explicitSpeed ?? 1.0, vertical, 'free', language)
    } catch (err) {
      console.error('[compose/unlock] TTS failed:', err instanceof Error ? err.message : String(err))
      return NextResponse.json({ error: 'Voiceover generation failed. Please try again.' }, { status: 502 })
    }
    if (!audioBuffer || audioBuffer.length === 0) {
      return NextResponse.json({ error: 'Voiceover generation returned no audio.' }, { status: 502 })
    }

    const realAudioDuration = estimateMp3DurationSeconds(audioBuffer)

    // Captions (best-effort word-level sync, same as /api/compose).
    let whisperWords: WhisperWord[] | undefined
    try {
      const words = await transcribeTTSWithTimestamps(audioBuffer)
      if (words.length > 0) whisperWords = words
    } catch {
      whisperWords = undefined
    }

    let voiceoverUrl: string
    try {
      voiceoverUrl = await uploadVoiceoverToSupabase(user.id, audioBuffer)
    } catch (err) {
      console.error('[compose/unlock] voiceover upload failed:', err instanceof Error ? err.message : String(err))
      return NextResponse.json({ error: 'Could not store the voiceover. Please try again.' }, { status: 502 })
    }

    let musicUrl: string | null = null
    try {
      musicUrl = await getBackgroundMusicUrl(voiceoverUrl)
    } catch {
      musicUrl = null
    }

    let source: Record<string, unknown>
    try {
      source = buildCreatomateSource({
        clipUrls,
        voiceoverUrl,
        voiceoverScript: scaledScript,
        sceneCaptions,
        duration,
        quality: 'fast',
        realAudioDuration,
        whisperWords,
        musicUrl,
        // The whole point of the pack: no watermark. End card stays (it is the
        // free/Starter "Made with Kineo" ad, not the corner watermark, and it
        // matches what a fresh Fast render from a pack buyer already produces).
        watermark: false,
        endCard: true,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[compose/unlock] source build failed:', msg)
      return NextResponse.json({ error: `Could not assemble the render: ${msg}` }, { status: 500 })
    }

    let renderId: string
    try {
      renderId = await submitCreatomateRender(source)
    } catch (firstErr) {
      console.warn('[compose/unlock] Creatomate submit failed — retrying once:', firstErr instanceof Error ? firstErr.message : String(firstErr))
      await new Promise((r) => setTimeout(r, 1500))
      try {
        renderId = await submitCreatomateRender(source)
      } catch (err) {
        console.error('[compose/unlock] Creatomate submit failed (after retry):', err instanceof Error ? err.message : String(err))
        return NextResponse.json({ error: 'Render service rejected the job. Please try again.' }, { status: 502 })
      }
    }

    console.log(`[compose/unlock] clean re-render started user=${user.id.slice(0, 8)} render=${renderId} duration=${duration}s`)
    return NextResponse.json({ render_id: renderId, quality: 'fast', duration })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[compose/unlock] unexpected error:', msg)
    return NextResponse.json({ error: 'Something went wrong preparing the clean render.' }, { status: 500 })
  }
}
