// KINEO-GESTURE-2026-07-10 — Transparent gesture clips (Feature 3,
// Upwork-validated: e-learning/corporate clients pay $100+ per PACK of these).
// The user picks a character/face + a gesture → Kling 2.5 i2v animates it →
// VEED background removal outputs a WebM with EMBEDDED ALPHA (drop-in for
// Articulate Storyline, Premiere, CapCut — no green screen, no keying).
//
// Flow: POST here (submit animate + upfront debit, `gesture-<requestId>`) →
// client polls /api/gesture-clip-status (stage 'animate' → auto-submits the
// matte job → stage 'matte' → transparent WebM URL). Failure at ANY stage
// auto-refunds the ledger row (same pattern as animate-image).
//
// Pricing: 15 credits (5s) / 25 credits (10s). Real cost ≈ Kling i2v ~$0.07/s
// + VEED matte — ~$1-1.7/clip → ~60-66% margin on Creator $/cr.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { submitAnimateJob } from '@/lib/avatar/veed'
import { getCharacterImageUrl } from '@/lib/characters'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// (module-private — Next.js route files must only export handlers/config)
const GESTURE_PROMPTS: Record<string, string> = {
  wave: 'the person waves warmly at the camera with one hand, friendly smile, natural relaxed posture, body stays in place',
  point: 'the person points confidently toward the side of the frame as if presenting content, engaging expression, body stays in place',
  thumbs_up: 'the person gives an enthusiastic thumbs up to the camera, confident smile, body stays in place',
  hold_tablet: 'the person holds up a blank tablet screen toward the camera as if presenting it, professional posture, body stays in place',
  nod: 'the person nods approvingly at the camera, warm professional expression, subtle natural motion, body stays in place',
  explain: 'the person gestures naturally with both hands as if explaining something to the camera, engaging professional energy, body stays in place',
}

// Suffix that keeps the subject centered + clean for matting.
const GESTURE_SUFFIX =
  ', full subject visible and centered, plain uncluttered background, steady locked-off camera, no camera movement, no zoom, realistic natural motion'

function gestureCost(duration: '5' | '10'): number {
  return duration === '10' ? 25 : 15
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: 'The clip engine is not configured.' }, { status: 500 })
    }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: { imageUrl?: string; characterId?: string; gesture?: string; customPrompt?: string; duration?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    // Source image: a saved character (id → our storage URL, ownership
    // enforced) or a direct our-storage URL (no SSRF surface).
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const storagePrefix = `${supabaseUrl}/storage/v1/object/public/avatars/`
    let imageUrl = (body.imageUrl ?? '').trim()
    const characterId = (body.characterId ?? '').trim()
    if (characterId) {
      const charUrl = await getCharacterImageUrl(user.id, characterId)
      if (!charUrl) return NextResponse.json({ error: 'Character not found.' }, { status: 404 })
      imageUrl = charUrl
    }
    if (!imageUrl.startsWith(storagePrefix)) {
      return NextResponse.json({ error: 'Please upload a photo or pick a character first.' }, { status: 400 })
    }

    const gestureKey = (body.gesture ?? '').trim()
    const custom = (body.customPrompt ?? '').trim().slice(0, 300)
    const basePrompt = GESTURE_PROMPTS[gestureKey] ?? (custom || GESTURE_PROMPTS.wave)
    const prompt = basePrompt + GESTURE_SUFFIX
    const duration: '5' | '10' = body.duration === '10' ? '10' : '5'
    const cost = gestureCost(duration)

    // Balance gate → submit → atomic upfront debit keyed on the request id
    // (idempotent; /api/gesture-clip-status refunds this row on failure).
    const { data: profile } = await supabase
      .from('profiles')
      .select('video_credits')
      .eq('id', user.id)
      .single()
    const balance = profile?.video_credits ?? 0
    if (balance < cost) {
      return NextResponse.json(
        { error: `Transparent gesture clips cost ${cost} credits. You have ${balance}.`, balance, upsell: 'credits', upgrade: '/pricing' },
        { status: 402 },
      )
    }

    const requestId = await submitAnimateJob({ imageUrl, prompt, duration })
    if (!requestId) {
      return NextResponse.json(
        { error: 'The clip engine could not accept the job. You were not charged — please try again.' },
        { status: 502 },
      )
    }

    const renderId = `gesture-${requestId}`
    const { data: newBalance, error: debitErr } = await supabase
      .rpc('debit_video_credits', { p_render: renderId, p_cost: cost })
    if (debitErr) {
      console.error(`[gesture-clip] debit RPC error AFTER submit render=${renderId} user=${user.id.slice(0, 8)}:`, debitErr.message)
    }

    console.log(`[gesture-clip] submitted user=${user.id.slice(0, 8)} request=${requestId} gesture=${gestureKey || 'custom'} duration=${duration}s cost=${cost}`)
    return NextResponse.json({
      request_id: requestId,
      stage: 'animate',
      duration,
      credits_charged: cost,
      balance: typeof newBalance === 'number' ? newBalance : null,
    })
  } catch (err) {
    console.error('[gesture-clip] unexpected error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
