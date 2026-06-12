// Animate (13/06) — image-to-video: a real photo comes alive with motion.
// Built for the Upwork-style demand Joseph is seeing: client sends a photo,
// gets back a 5-10s animated clip.
//
// Flow: photo already in OUR avatars bucket (uploaded via /api/avatar/upload
// or the signed-url route) → Kling 2.5 Turbo Pro i2v on the fal queue →
// client polls /api/avatar-status?engine=animate → fal CDN MP4 delivered
// directly (no compose — the clip IS the product).
//
// Billing v1: ANIMATE_COST video_credits per clip, debited UPFRONT via the
// atomic debit_video_credits RPC (render_id = animate-<uuid> keeps it
// idempotent). Upfront because there is no compose/status success hook on
// this path; the fal failure rate on Kling i2v is low and a retry is free to
// re-submit manually. Cost basis: ~$0.35 per 5s clip → 10 credits ≈ $1.04
// retail on Creator (~66% margin) / $2.38 on Starter (~85%).
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { submitAnimateJob } from '@/lib/avatar/veed'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

const ANIMATE_COST = 10 // video_credits per clip (5s or 10s = same Kling call shape)

export async function POST(req: NextRequest) {
  try {
    if (!process.env.FAL_KEY) {
      return NextResponse.json({ error: 'Animation engine is not configured.' }, { status: 500 })
    }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
    }

    let body: { imageUrl?: string; prompt?: string; duration?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
    }

    // Photo must be OUR storage URL (no SSRF / hot-linking surface).
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const imageUrl = (body.imageUrl ?? '').trim()
    if (!imageUrl.startsWith(`${supabaseUrl}/storage/v1/object/public/avatars/`)) {
      return NextResponse.json({ error: 'Please upload your photo first.' }, { status: 400 })
    }
    const prompt = (body.prompt ?? '').trim().slice(0, 500) || 'subtle natural motion, cinematic, realistic movement'
    const duration: '5' | '10' = body.duration === '10' ? '10' : '5'

    // Balance gate + atomic upfront debit (idempotent by render_id).
    const { data: profile } = await supabase
      .from('profiles')
      .select('video_credits')
      .eq('id', user.id)
      .single()
    const balance = profile?.video_credits ?? 0
    if (balance < ANIMATE_COST) {
      return NextResponse.json(
        { error: `Animating a photo costs ${ANIMATE_COST} credits. You have ${balance}.`, balance },
        { status: 402 },
      )
    }
    const renderId = `animate-${randomUUID()}`
    const { data: newBalance, error: debitErr } = await supabase
      .rpc('debit_video_credits', { p_render: renderId, p_cost: ANIMATE_COST })
    if (debitErr) {
      console.error('[animate-image] debit RPC error:', debitErr.message)
      return NextResponse.json({ error: 'Could not reserve credits. Please try again.' }, { status: 502 })
    }

    const requestId = await submitAnimateJob({ imageUrl, prompt, duration })
    if (!requestId) {
      // fal refused the job — note for support; the ledger row records the
      // attempt (manual re-credit is a single SQL update if needed).
      console.error(`[animate-image] fal submit failed AFTER debit render=${renderId} user=${user.id.slice(0, 8)}`)
      return NextResponse.json(
        { error: 'The animation engine could not accept the job. Contact support@shortsforgeai.com and we will restore your credits.' },
        { status: 502 },
      )
    }

    console.log(`[animate-image] submitted user=${user.id.slice(0, 8)} request=${requestId} duration=${duration}s render=${renderId}`)
    return NextResponse.json({
      request_id: requestId,
      engine: 'animate',
      duration,
      credits_charged: ANIMATE_COST,
      balance: typeof newBalance === 'number' ? newBalance : null,
    })
  } catch (err) {
    console.error('[animate-image] unexpected error:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
