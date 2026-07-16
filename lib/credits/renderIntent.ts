// KINEO-CREDIT-INTENT-2026-07-11 — server-side record of what a render is
// SUPPOSED to cost, written the instant the render is born (/api/compose,
// /api/compose/unlock) and read back at settle time (/api/compose/status).
//
// WHY THIS EXISTS (the credit leak):
//   /api/compose/status used to decide HOW MUCH / WHETHER to charge from two
//   CLIENT-supplied query params — ?quality and ?deducted. A crafted request
//   (?quality=fast&deducted=1) made a 110-credit Avatar (or Kling/Veo/Hollywood)
//   render settle as a FREE Fast video with no ledger trace. That is the
//   recurrence of the historical "avatar nunca debitava por quality ausente"
//   class of bug.
//
//   render_jobs is the trusted source: the ENGINE and the intended COST are
//   pinned to the render_id (primary key) at creation, by the server, before
//   the user can poll status. compose/status reads the engine from HERE and
//   ignores the client's ?quality / ?deducted for the billing decision.
//
// All operations are best-effort and NEVER throw: a render is availability-first
// (we never break a legitimate video over a DB blip). But the WRITE is loud on
// failure — a missing intent row is what re-opens the leak for that one render,
// so it must be visible in logs.
//
// Uses the service-role admin client (like lib/credits/refund.ts and the
// history persist path) so the security-critical read can never be blocked by a
// missing/instant RLS policy. The table also carries owner-scoped RLS as
// defense in depth (see migration 017).

import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { COMPOSE_CLAIM_EVENT, COMPOSE_CLAIM_PATH, composeClaimId, validComposeGenerationId, verifyComposeClaim } from '@/lib/composeClaim'

function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.warn('[render-intent] service-role env missing — render intent disabled')
    return null
  }
  return createAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Record the authoritative engine + intended cost for a freshly-created render.
 * Keyed by render_id (PK) so it is idempotent — a duplicate insert (retry) is a
 * 23505 no-op, never an error. Best-effort + never throws; loud on real errors.
 */
export async function recordRenderIntent(args: {
  renderId: string
  userId: string
  quality: string
  cost: number
}): Promise<boolean> {
  const renderId = (args.renderId ?? '').trim()
  if (!renderId) return false
  const db = adminClient()
  if (!db) return false
  try {
    const { error } = await db.from('render_jobs').insert({
      render_id: renderId,
      user_id: args.userId,
      quality: args.quality,
      cost: args.cost,
    })
    if (error) {
      // 23505 = already recorded for this render_id (retry / double submit) — fine.
      if ((error as { code?: string }).code === '23505') {
        const { data: existing, error: verifyError } = await db
          .from('render_jobs')
          .select('user_id,quality,cost')
          .eq('render_id', renderId)
          .maybeSingle()
        const existingCost = typeof existing?.cost === 'number' ? existing.cost : Number(existing?.cost)
        if (
          !verifyError && existing &&
          existing.user_id === args.userId &&
          existing.quality === args.quality &&
          Number.isFinite(existingCost) && existingCost === args.cost
        ) {
          console.log(`[render-intent] already recorded render_id=${renderId} (verified idempotent)`)
          return true
        }
        console.error('[render-intent] conflicting duplicate render intent:', JSON.stringify({
          render_id: renderId,
          requested_user_id: args.userId,
          requested_quality: args.quality,
          requested_cost: args.cost,
          existing,
          verify_error: verifyError?.message,
        }))
        return false
      }
      // A real failure means compose/status may fall back to the (legacy) client
      // params for THIS render — surface it loudly so it is diagnosable.
      console.error('[render-intent] record FAILED — this render will lack server-side billing intent:', JSON.stringify({
        render_id: renderId,
        quality: args.quality,
        cost: args.cost,
        code: (error as { code?: string }).code,
        message: error.message,
      }))
      return false
    }
    console.log(`[render-intent] recorded render_id=${renderId} quality=${args.quality} cost=${args.cost}`)
    return true
  } catch (e) {
    console.error(`[render-intent] record threw render=${renderId}:`, e instanceof Error ? e.message : String(e))
    return false
  }
}

export interface RenderIntent {
  quality: string
  cost: number | null
  userId: string
}

/**
 * Read the authoritative engine + intended cost for a render. `null` means a
 * confirmed absence; `undefined` means the lookup was unavailable or untrusted,
 * so resumable clients retry instead of discarding a valid render. Never throws.
 */
export async function getRenderIntent(renderId: string): Promise<RenderIntent | null | undefined> {
  const id = (renderId ?? '').trim()
  if (!id) return null
  const db = adminClient()
  if (!db) return undefined
  try {
    const { data, error } = await db
      .from('render_jobs')
      .select('quality, cost, user_id')
      .eq('render_id', id)
      .maybeSingle()
    const primaryUnavailable = Boolean(error)
    if (error) {
      console.warn(`[render-intent] primary read error render=${id}:`, error.message)
    } else if (data) {
      return {
        quality: (data as { quality: string }).quality,
        cost: (data as { cost: number | null }).cost ?? null,
        userId: (data as { user_id: string }).user_id,
      }
    }

    // Recovery fallback: /api/compose publishes the same trusted engine/cost in
    // its deterministic submission claim after attempting the primary insert.
    // This keeps billing server-authoritative even if render_jobs had a brief
    // write outage while the accepted provider render continued successfully.
    const { data: claim, error: claimError } = await db
      .from('events')
      .select('id,user_id,metadata,path,session_id')
      .eq('name', COMPOSE_CLAIM_EVENT)
      .contains('metadata', { status: 'done', render_id: id })
      .limit(1)
      .maybeSingle()
    if (claimError) {
      console.warn(`[render-intent] fallback claim read error render=${id}:`, claimError.message)
      return undefined
    }
    if (!claim) return primaryUnavailable ? undefined : null
    const metadata = claim.metadata && typeof claim.metadata === 'object'
      ? claim.metadata as Record<string, unknown>
      : {}
    const quality = typeof metadata.quality === 'string' ? metadata.quality : ''
    const cost = typeof metadata.cost === 'number' && Number.isFinite(metadata.cost) ? metadata.cost : null
    const userId = typeof claim.user_id === 'string' ? claim.user_id : ''
    const generationId = typeof metadata.generation_id === 'string' ? metadata.generation_id : ''
    const claimId = typeof claim.id === 'string' ? claim.id : ''
    const claimSecret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
    if (
      !quality || !userId || !validComposeGenerationId(generationId) ||
      claimId !== composeClaimId(userId, generationId) ||
      claim.path !== COMPOSE_CLAIM_PATH || claim.session_id !== generationId ||
      !claimSecret || cost === null ||
      !verifyComposeClaim(claimSecret, {
        claimId,
        userId,
        generationId,
        status: 'done',
        renderId: id,
        quality,
        cost,
      }, metadata.authority)
    ) {
      console.error(`[render-intent] rejected untrusted compose claim render=${id}`)
      return undefined
    }
    console.warn(`[render-intent] recovered from compose claim render=${id}`)
    return {
      quality,
      cost,
      userId,
    }
  } catch (e) {
    console.warn(`[render-intent] read threw render=${id}:`, e instanceof Error ? e.message : String(e))
    return undefined
  }
}
