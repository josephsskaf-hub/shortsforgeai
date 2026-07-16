import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  COMPOSE_CLAIM_EVENT,
  COMPOSE_CLAIM_PATH,
  composeClaimId,
  validComposeGenerationId,
  verifyComposeClaim,
} from '@/lib/composeClaim'
import {
  AVATAR_CLAIM_EVENT,
  AVATAR_CLAIM_PATH,
  avatarClaimId,
  validAvatarGenerationId,
  verifyAvatarClaim,
} from '@/lib/avatar/claim'
import {
  CINEMATIC_CLAIM_EVENT,
  verifyCinematicClaimRow,
} from '@/lib/cinematic/claim'

// Provider jobs normally settle in minutes. Two hours matches the existing
// avatar hold and fails closed for abandoned/ambiguous submissions without
// locking a buyer forever.
export const ACTIVE_COMPOSE_CREDIT_HOLD_TTL_MS = 2 * 60 * 60 * 1000

type HoldInspection =
  | { ok: true; totalHeld: number; currentSeen: boolean }
  | { ok: false; error: string }

/**
 * Sum every server-signed, unsettled provider hold for one user. Compose and
 * Avatar use separate claim types, but Avatar->Compose keeps the generation id;
 * grouping by that id prevents double-reserving the same 110-credit video.
 */
export async function inspectActiveComposeCreditHolds(args: {
  db: SupabaseClient
  secret: string
  userId: string
  currentClaimId: string
}): Promise<HoldInspection> {
  const activeSince = new Date(Date.now() - ACTIVE_COMPOSE_CREDIT_HOLD_TTL_MS).toISOString()
  const { data, error } = await args.db
    .from('events')
    .select('id,name,user_id,path,session_id,metadata,created_at')
    .in('name', [COMPOSE_CLAIM_EVENT, AVATAR_CLAIM_EVENT, CINEMATIC_CLAIM_EVENT])
    .eq('user_id', args.userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1000)

  if (error) return { ok: false, error: error.message }
  if ((data?.length ?? 0) >= 1000) {
    return { ok: false, error: 'credit hold scan truncated; refusing provider submission' }
  }

  const costByGeneration = new Map<string, number>()
  let currentSeen = false
  for (const raw of data ?? []) {
    const row = raw as {
      id?: unknown
      name?: unknown
      user_id?: unknown
      path?: unknown
      session_id?: unknown
      metadata?: unknown
      created_at?: unknown
    }
    const metadata = row.metadata && typeof row.metadata === 'object'
      ? row.metadata as Record<string, unknown>
      : {}
    const claimId = typeof row.id === 'string' ? row.id : ''
    if (row.name === COMPOSE_CLAIM_EVENT) {
      if (metadata.credit_hold !== true) continue
      if (typeof metadata.credit_hold_settled_at === 'string' && metadata.credit_hold_settled_at) continue
      const status = metadata.status === 'done'
        ? 'done'
        : metadata.status === 'pending'
          ? 'pending'
          : null
      const createdAt = typeof row.created_at === 'string' ? row.created_at : ''
      if (status === 'pending' && (!createdAt || createdAt < activeSince)) continue
      const generationId = typeof row.session_id === 'string' ? row.session_id : ''
      const metadataGenerationId = typeof metadata.generation_id === 'string' ? metadata.generation_id : ''
      const quality = typeof metadata.quality === 'string' ? metadata.quality : ''
      const cost = typeof metadata.cost === 'number' && Number.isInteger(metadata.cost) ? metadata.cost : null
      const renderId = typeof metadata.render_id === 'string' ? metadata.render_id.trim() : ''
      const valid = Boolean(
        status && quality && cost !== null && cost > 0 && cost <= 1000 &&
        validComposeGenerationId(generationId) && metadataGenerationId === generationId &&
        claimId === composeClaimId(args.userId, generationId) &&
        row.user_id === args.userId && row.path === COMPOSE_CLAIM_PATH &&
        (status === 'pending' || Boolean(renderId)) &&
        verifyComposeClaim(args.secret, {
          claimId,
          userId: args.userId,
          generationId,
          status: status!,
          ...(renderId ? { renderId } : {}),
          quality,
          cost: cost!,
        }, metadata.authority),
      )
      if (!valid) {
        console.error('[compose-hold] ignored invalid compose hold:', claimId || 'missing-id')
        continue
      }
      const existingCost = costByGeneration.get(generationId)
      if (existingCost !== undefined && existingCost !== cost) {
        return { ok: false, error: `conflicting hold costs for generation ${generationId}` }
      }
      costByGeneration.set(generationId, cost as number)
      if (claimId === args.currentClaimId) currentSeen = true
      continue
    }

    if (row.name === AVATAR_CLAIM_EVENT) {
      const status = metadata.status === 'done'
        ? 'done'
        : metadata.status === 'pending'
          ? 'pending'
          : metadata.status === 'settled'
            ? 'settled'
            : null
      if (status === 'settled') continue
      const createdAt = typeof row.created_at === 'string' ? row.created_at : ''
      if (status === 'pending' && (!createdAt || createdAt < activeSince)) continue
      const generationId = typeof row.session_id === 'string' ? row.session_id : ''
      const fingerprint = typeof metadata.fingerprint === 'string' ? metadata.fingerprint : ''
      const responseHash = typeof metadata.response_hash === 'string' ? metadata.response_hash : ''
      const cost = typeof metadata.credit_cost === 'number' && Number.isInteger(metadata.credit_cost)
        ? metadata.credit_cost
        : null
      const valid = Boolean(
        status && fingerprint && cost !== null && cost > 0 && cost <= 1000 &&
        validAvatarGenerationId(generationId) && claimId === avatarClaimId(args.userId, generationId) &&
        row.user_id === args.userId && row.path === AVATAR_CLAIM_PATH &&
        (status === 'pending' || Boolean(responseHash)) &&
        verifyAvatarClaim(args.secret, {
          claimId,
          userId: args.userId,
          generationId,
          status: status as 'pending' | 'done',
          fingerprint,
          creditCost: cost!,
          ...(responseHash ? { responseHash } : {}),
        }, metadata.authority),
      )
      if (!valid) {
        console.error('[compose-hold] ignored invalid avatar hold:', claimId || 'missing-id')
        continue
      }
      const existingCost = costByGeneration.get(generationId)
      if (existingCost !== undefined && existingCost !== cost) {
        return { ok: false, error: `conflicting hold costs for generation ${generationId}` }
      }
      costByGeneration.set(generationId, cost as number)
      if (claimId === args.currentClaimId) currentSeen = true
      continue
    }

    if (row.name === CINEMATIC_CLAIM_EVENT) {
      const generationId = typeof row.session_id === 'string' ? row.session_id : ''
      const verified = verifyCinematicClaimRow({
        row,
        secret: args.secret,
        userId: args.userId,
        generationId,
      })
      if (!verified.ok) {
        console.error('[compose-hold] ignored invalid cinematic hold:', claimId || 'missing-id')
        continue
      }
      if (verified.claim.status === 'settled' || verified.claim.status === 'released') continue
      const createdAt = typeof row.created_at === 'string' ? row.created_at : ''
      if (verified.claim.status === 'pending' && (!createdAt || createdAt < activeSince)) continue
      const cost = verified.claim.creditCost
      const existingCost = costByGeneration.get(generationId)
      if (existingCost !== undefined && existingCost !== cost) {
        return { ok: false, error: `conflicting hold costs for generation ${generationId}` }
      }
      costByGeneration.set(generationId, cost)
      if (claimId === args.currentClaimId) currentSeen = true
    }
  }

  const totalHeld = [...costByGeneration.values()].reduce((sum, cost) => sum + cost, 0)
  return { ok: true, totalHeld, currentSeen }
}

/** Mark a completed/failed provider job's hold as released without deleting the
 * deterministic claim needed for replay and render-intent recovery. */
export async function settleComposeCreditHoldForRender(args: {
  userId: string
  renderId: string
  reason: 'debited' | 'provider_failed'
}): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secret || !args.renderId) return false
  const db = createAdminClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: claim, error } = await db
    .from('events')
    .select('id,name,user_id,path,session_id,metadata')
    .eq('name', COMPOSE_CLAIM_EVENT)
    .eq('user_id', args.userId)
    .contains('metadata', { status: 'done', render_id: args.renderId, credit_hold: true })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[compose-hold] settlement lookup failed:', error.message)
    return false
  }
  if (!claim) return true

  const metadata = claim.metadata && typeof claim.metadata === 'object'
    ? claim.metadata as Record<string, unknown>
    : {}
  if (typeof metadata.credit_hold_settled_at === 'string' && metadata.credit_hold_settled_at) return true
  const generationId = typeof claim.session_id === 'string' ? claim.session_id : ''
  const quality = typeof metadata.quality === 'string' ? metadata.quality : ''
  const cost = typeof metadata.cost === 'number' && Number.isInteger(metadata.cost) ? metadata.cost : null
  const claimId = typeof claim.id === 'string' ? claim.id : ''
  if (
    !validComposeGenerationId(generationId) || !quality || cost === null || cost <= 0 ||
    claimId !== composeClaimId(args.userId, generationId) ||
    claim.name !== COMPOSE_CLAIM_EVENT || claim.user_id !== args.userId ||
    claim.path !== COMPOSE_CLAIM_PATH || metadata.generation_id !== generationId ||
    !verifyComposeClaim(secret, {
      claimId,
      userId: args.userId,
      generationId,
      status: 'done',
      renderId: args.renderId,
      quality,
      cost,
    }, metadata.authority)
  ) {
    console.error('[compose-hold] rejected invalid settlement claim:', claimId || args.renderId)
    return false
  }

  const settledMetadata = {
    ...metadata,
    credit_hold_settled_at: new Date().toISOString(),
    credit_hold_settlement_reason: args.reason,
  }
  const { data: updated, error: updateError } = await db
    .from('events')
    .update({ metadata: settledMetadata })
    .eq('id', claimId)
    .eq('user_id', args.userId)
    .eq('name', COMPOSE_CLAIM_EVENT)
    .select('id')
    .maybeSingle()
  if (updateError || updated?.id !== claimId) {
    console.error('[compose-hold] settlement update failed:', updateError?.message ?? 'claim missing')
    return false
  }
  return true
}

/** A failed free Fast provider job must not consume one of the advertised
 * 3 previews/24h. Delete only the signed, zero-cost completed claim tied to
 * this terminal render; successful free claims remain as quota receipts. */
export async function releaseFailedFreeFastClaim(args: {
  userId: string
  renderId: string
}): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secret || !args.renderId) return false
  const db = createAdminClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: claim, error } = await db
    .from('events')
    .select('id,name,user_id,path,session_id,metadata')
    .eq('name', COMPOSE_CLAIM_EVENT)
    .eq('user_id', args.userId)
    .contains('metadata', {
      status: 'done',
      render_id: args.renderId,
      quality: 'fast',
      cost: 0,
      credit_hold: false,
    })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[compose-hold] free Fast release lookup failed:', error.message)
    return false
  }
  if (!claim) return true
  const metadata = claim.metadata && typeof claim.metadata === 'object'
    ? claim.metadata as Record<string, unknown>
    : {}
  const generationId = typeof claim.session_id === 'string' ? claim.session_id : ''
  const claimId = typeof claim.id === 'string' ? claim.id : ''
  if (
    !validComposeGenerationId(generationId) ||
    claimId !== composeClaimId(args.userId, generationId) ||
    claim.name !== COMPOSE_CLAIM_EVENT || claim.user_id !== args.userId ||
    claim.path !== COMPOSE_CLAIM_PATH || metadata.generation_id !== generationId ||
    !verifyComposeClaim(secret, {
      claimId,
      userId: args.userId,
      generationId,
      status: 'done',
      renderId: args.renderId,
      quality: 'fast',
      cost: 0,
    }, metadata.authority)
  ) {
    console.error('[compose-hold] rejected invalid free Fast release claim:', claimId || args.renderId)
    return false
  }
  const { data: deleted, error: deleteError } = await db
    .from('events')
    .delete()
    .eq('id', claimId)
    .eq('user_id', args.userId)
    .eq('name', COMPOSE_CLAIM_EVENT)
    .select('id')
    .maybeSingle()
  if (deleteError || deleted?.id !== claimId) {
    console.error('[compose-hold] free Fast release failed:', deleteError?.message ?? 'claim missing')
    return false
  }
  return true
}
