import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  AVATAR_CLAIM_EVENT,
  AVATAR_CLAIM_PATH,
  avatarClaimId,
  signAvatarClaim,
  validAvatarGenerationId,
  verifyAvatarClaim,
} from '@/lib/avatar/claim'
import {
  COMPOSE_CLAIM_EVENT,
  COMPOSE_CLAIM_PATH,
  composeClaimId,
  validComposeGenerationId,
  verifyComposeClaim,
} from '@/lib/composeClaim'

type SettlementReason = 'compose_succeeded' | 'provider_failed'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secret) return null
  return {
    db: createAdminClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    secret,
  }
}

async function settleClaim(args: {
  userId: string
  generationId: string
  reason: SettlementReason
}): Promise<boolean> {
  const admin = adminClient()
  if (!admin || !validAvatarGenerationId(args.generationId)) return false
  const claimId = avatarClaimId(args.userId, args.generationId)
  const { data: claim, error } = await admin.db
    .from('events')
    .select('id,name,user_id,path,session_id,metadata')
    .eq('id', claimId)
    .maybeSingle()
  if (error || !claim) {
    if (error) console.error('[avatar-hold] claim lookup failed:', error.message)
    return false
  }
  const metadata = claim.metadata && typeof claim.metadata === 'object'
    ? claim.metadata as Record<string, unknown>
    : {}
  const status = metadata.status === 'settled'
    ? 'settled'
    : metadata.status === 'done'
      ? 'done'
      : null
  const fingerprint = typeof metadata.fingerprint === 'string' ? metadata.fingerprint : ''
  const responseHash = typeof metadata.response_hash === 'string' ? metadata.response_hash : ''
  const creditCost = typeof metadata.credit_cost === 'number' && Number.isInteger(metadata.credit_cost)
    ? metadata.credit_cost
    : null
  if (
    !status || !fingerprint || !responseHash || creditCost === null || creditCost <= 0 ||
    claim.id !== claimId || claim.name !== AVATAR_CLAIM_EVENT ||
    claim.user_id !== args.userId || claim.path !== AVATAR_CLAIM_PATH ||
    claim.session_id !== args.generationId ||
    !verifyAvatarClaim(admin.secret, {
      claimId,
      userId: args.userId,
      generationId: args.generationId,
      status,
      fingerprint,
      creditCost,
      responseHash,
    }, metadata.authority)
  ) {
    console.error('[avatar-hold] rejected invalid claim:', claimId)
    return false
  }
  if (status === 'settled') return true

  const settledMetadata = {
    ...metadata,
    status: 'settled',
    credit_settlement_reason: args.reason,
    credit_settled_at: new Date().toISOString(),
    authority: signAvatarClaim(admin.secret, {
      claimId,
      userId: args.userId,
      generationId: args.generationId,
      status: 'settled',
      fingerprint,
      creditCost,
      responseHash,
    }),
  }
  const { data: updated, error: updateError } = await admin.db
    .from('events')
    .update({ metadata: settledMetadata })
    .eq('id', claimId)
    .eq('user_id', args.userId)
    .eq('name', AVATAR_CLAIM_EVENT)
    .select('id')
    .maybeSingle()
  if (updateError || updated?.id !== claimId) {
    console.error('[avatar-hold] settlement failed:', updateError?.message ?? 'row missing')
    return false
  }
  return true
}

export async function settleAvatarCreditHoldForRender(args: {
  userId: string
  renderId: string
}): Promise<boolean> {
  const admin = adminClient()
  if (!admin || !args.renderId) return false
  const { data: claim, error } = await admin.db
    .from('events')
    .select('id,user_id,path,session_id,metadata')
    .eq('name', COMPOSE_CLAIM_EVENT)
    .eq('user_id', args.userId)
    .contains('metadata', { status: 'done', render_id: args.renderId })
    .limit(1)
    .maybeSingle()
  if (error || !claim) {
    if (error) console.error('[avatar-hold] compose claim lookup failed:', error.message)
    return false
  }
  const metadata = claim.metadata && typeof claim.metadata === 'object'
    ? claim.metadata as Record<string, unknown>
    : {}
  const generationId = typeof claim.session_id === 'string' ? claim.session_id : ''
  const quality = typeof metadata.quality === 'string' ? metadata.quality : ''
  const cost = typeof metadata.cost === 'number' && Number.isInteger(metadata.cost) ? metadata.cost : null
  if (
    !validComposeGenerationId(generationId) ||
    (quality !== 'avatar' && quality !== 'presenter') || cost === null || cost <= 0 ||
    claim.id !== composeClaimId(args.userId, generationId) ||
    claim.user_id !== args.userId || claim.path !== COMPOSE_CLAIM_PATH ||
    !verifyComposeClaim(admin.secret, {
      claimId: claim.id as string,
      userId: args.userId,
      generationId,
      status: 'done',
      renderId: args.renderId,
      quality,
      cost,
    }, metadata.authority)
  ) {
    console.error('[avatar-hold] rejected invalid compose claim for render:', args.renderId)
    return false
  }
  return settleClaim({ userId: args.userId, generationId, reason: 'compose_succeeded' })
}

export async function settleAvatarCreditHoldForFailedRequest(args: {
  userId: string
  requestId: string
}): Promise<boolean> {
  const admin = adminClient()
  if (!admin || !args.requestId) return false
  const { data: claim, error } = await admin.db
    .from('events')
    .select('session_id')
    .eq('name', AVATAR_CLAIM_EVENT)
    .eq('user_id', args.userId)
    .contains('metadata', { response: { avatar_request_id: args.requestId } })
    .limit(1)
    .maybeSingle()
  if (error || !claim || typeof claim.session_id !== 'string') {
    if (error) console.error('[avatar-hold] failed-request lookup failed:', error.message)
    return false
  }
  return settleClaim({
    userId: args.userId,
    generationId: claim.session_id,
    reason: 'provider_failed',
  })
}
