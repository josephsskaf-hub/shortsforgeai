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
}): Promise<void> {
  const renderId = (args.renderId ?? '').trim()
  if (!renderId) return
  const db = adminClient()
  if (!db) return
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
        console.log(`[render-intent] already recorded render_id=${renderId} (idempotent)`)
        return
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
      return
    }
    console.log(`[render-intent] recorded render_id=${renderId} quality=${args.quality} cost=${args.cost}`)
  } catch (e) {
    console.error(`[render-intent] record threw render=${renderId}:`, e instanceof Error ? e.message : String(e))
  }
}

export interface RenderIntent {
  quality: string
  cost: number | null
  userId: string
}

/**
 * Read the authoritative engine + intended cost for a render. Returns null when
 * there is no intent row (legacy / pre-deploy render) or on any error — the
 * caller then falls back to its legacy behavior. Never throws.
 */
export async function getRenderIntent(renderId: string): Promise<RenderIntent | null> {
  const id = (renderId ?? '').trim()
  if (!id) return null
  const db = adminClient()
  if (!db) return null
  try {
    const { data, error } = await db
      .from('render_jobs')
      .select('quality, cost, user_id')
      .eq('render_id', id)
      .maybeSingle()
    if (error) {
      console.warn(`[render-intent] read error render=${id}:`, error.message)
      return null
    }
    if (!data) return null
    return {
      quality: (data as { quality: string }).quality,
      cost: (data as { cost: number | null }).cost ?? null,
      userId: (data as { user_id: string }).user_id,
    }
  } catch (e) {
    console.warn(`[render-intent] read threw render=${id}:`, e instanceof Error ? e.message : String(e))
    return null
  }
}
