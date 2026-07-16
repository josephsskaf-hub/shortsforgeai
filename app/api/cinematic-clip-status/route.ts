// Authenticated Fal polling for one signed cinematic generation. Request IDs,
// models and completed URLs are bound to the owner claim before any URL leaves
// the server; the birth route has already debited the deterministic job key.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { fal } from '@fal-ai/client'
import {
  authorizeCinematicCompletedUrls,
  loadVerifiedCinematicClaim,
  releaseCinematicClaim,
  validCinematicGenerationId,
} from '@/lib/cinematic/claim'
import { refundRenderCredits } from '@/lib/credits/refund'

export const dynamic = 'force-dynamic'

const SEEDANCE_MODEL = 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video'
const KLING_MODEL = 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video'
const VEO_MODEL = 'fal-ai/veo3.1/fast'
const SORA_MODEL = 'fal-ai/sora-2/text-to-video'
const KLING3_MODEL = 'fal-ai/kling-video/v3/pro/text-to-video'
const KLING3_I2V_MODEL = 'fal-ai/kling-video/o3/pro/image-to-video'
const HOST_PRESENTER_MODEL = 'fal-ai/kling-video/ai-avatar/v2/standard'
const ALLOWED_MODELS = new Set([
  SEEDANCE_MODEL,
  KLING_MODEL,
  VEO_MODEL,
  SORA_MODEL,
  KLING3_MODEL,
  KLING3_I2V_MODEL,
  HOST_PRESENTER_MODEL,
])

type ClipStatus = {
  id: string | null
  status: 'pending' | 'processing' | 'done' | 'failed'
  url: string | null
}

async function checkFalClip(requestId: string, model: string): Promise<ClipStatus> {
  const falKey = process.env.FAL_KEY
  if (!falKey) return { id: requestId, status: 'processing', url: null }

  try {
    fal.config({ credentials: falKey })
    const st = await fal.queue.status(model, { requestId })
    const status = (st as { status?: string }).status
    if (status === 'IN_QUEUE') return { id: requestId, status: 'pending', url: null }
    if (status === 'IN_PROGRESS') return { id: requestId, status: 'processing', url: null }
    if (status === 'COMPLETED') {
      const result = await fal.queue.result(model, { requestId })
      const data = ((result as { data?: unknown }).data ?? result) as {
        video?: { url?: string }
        output?: { video?: { url?: string } }
      }
      const videoUrl = data?.video?.url ?? data?.output?.video?.url ?? null
      return videoUrl
        ? { id: requestId, status: 'done', url: videoUrl }
        : { id: requestId, status: 'failed', url: null }
    }
    if (status === 'FAILED') return { id: requestId, status: 'failed', url: null }
    return { id: requestId, status: 'processing', url: null }
  } catch (error) {
    // Poll/network ambiguity is not a terminal provider failure and must never
    // trigger an automatic refund while a clip may still be rendering.
    console.warn('[cinematic-status] transient poll error:', error instanceof Error ? error.message : String(error))
    return { id: requestId, status: 'processing', url: null }
  }
}

function parseIds(value: string): (string | null)[] | null {
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value))
    if (!Array.isArray(parsed)) return null
    return parsed.every((id) => id === null || (typeof id === 'string' && id.length > 0))
      ? parsed as (string | null)[]
      : null
  } catch {
    return null
  }
}

function sameArray<T>(left: T[], right: T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })

    const generationId = req.nextUrl.searchParams.get('generationId')?.trim() ?? ''
    if (!validCinematicGenerationId(generationId)) {
      return NextResponse.json({ error: 'generationId is required.' }, { status: 400 })
    }
    const idsParam = req.nextUrl.searchParams.get('ids') ?? ''
    const requestedIds = parseIds(idsParam)
    if (!requestedIds) return NextResponse.json({ error: 'Valid ids are required.' }, { status: 400 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !secret) {
      return NextResponse.json({ error: 'Clip ownership check is temporarily unavailable.' }, { status: 503 })
    }
    const admin = createAdminClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const loaded = await loadVerifiedCinematicClaim({
      db: admin,
      secret,
      userId: user.id,
      generationId,
    })
    if (!loaded.ok) {
      console.error('[cinematic-status] claim lookup failed:', loaded.error)
      return NextResponse.json({ error: 'Clip ownership check is temporarily unavailable.' }, { status: 503 })
    }
    const claim = loaded.claim
    if (!claim || claim.status === 'released') {
      return NextResponse.json({ error: 'Generation not found.' }, { status: 404 })
    }
    if (claim.status !== 'settled') {
      return NextResponse.json(
        { error: 'This AI generation is still being finalized.', pending: true, retry_after_ms: 2500 },
        { status: 409 },
      )
    }
    if (!sameArray(requestedIds, claim.falRequestIds)) {
      return NextResponse.json({ error: 'Generation not found.' }, { status: 404 })
    }
    if (!claim.falModels.every((model) => ALLOWED_MODELS.has(model))) {
      console.error('[cinematic-status] signed claim contains an unsupported model')
      return NextResponse.json({ error: 'Clip model could not be verified.' }, { status: 503 })
    }

    const clips = await Promise.all(
      claim.falRequestIds.map((id, index) => {
        if (!id) return Promise.resolve({ id: null, status: 'failed' as const, url: null })
        return checkFalClip(id, claim.falModels[index])
      }),
    )
    const completed = clips
      .filter((clip): clip is ClipStatus & { id: string; url: string } => clip.status === 'done' && !!clip.id && !!clip.url)
      .map((clip) => ({
        requestId: clip.id,
        model: claim.falModels[claim.falRequestIds.findIndex((id) => id === clip.id)],
        url: clip.url,
      }))
    if (completed.length > 0) {
      const authorized = await authorizeCinematicCompletedUrls({
        db: admin,
        secret,
        userId: user.id,
        generationId,
        completed,
      })
      if (!authorized.ok) {
        console.error('[cinematic-status] completed URL binding failed:', authorized.error)
        return NextResponse.json({ error: 'Completed clips could not be verified.' }, { status: 503 })
      }
    }

    const allDone = clips.every((clip) => clip.status === 'done' || clip.status === 'failed')
    const failedCount = clips.filter((clip) => clip.status === 'failed').length
    if (allDone && failedCount === clips.length) {
      const billingReference = claim.resolutionReference
      const refunded = await refundRenderCredits(billingReference)
      let refundConfirmed = refunded > 0
      if (!refundConfirmed) {
        const { data: debit } = await admin
          .from('credit_debits')
          .select('refunded_at')
          .eq('render_id', billingReference)
          .maybeSingle()
        refundConfirmed = typeof debit?.refunded_at === 'string' && debit.refunded_at.length > 0
      }
      if (!refundConfirmed) {
        return NextResponse.json(
          { error: 'All AI clips failed, but the automatic refund is still being confirmed. Please retry.' },
          { status: 503 },
        )
      }
      const released = await releaseCinematicClaim({
        db: admin,
        secret,
        userId: user.id,
        generationId,
        reason: 'provider_all_failed_refunded',
        reference: billingReference,
      })
      if (!released.ok) console.error('[cinematic-status] refunded claim release failed:', released.error)
      return NextResponse.json(
        { error: 'All AI clips failed. Your credits were refunded automatically.', clips },
        { status: 502 },
      )
    }

    return NextResponse.json({
      clips,
      allDone,
      anyDone: clips.some((clip) => clip.status === 'done'),
      done: clips.filter((clip) => clip.status === 'done').length,
      total: clips.length,
      failed: failedCount,
    })
  } catch (error) {
    console.error('[cinematic-status] unexpected error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ error: 'Status check failed.' }, { status: 500 })
  }
}
