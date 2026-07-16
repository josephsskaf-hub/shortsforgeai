import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  AVATAR_CLAIM_EVENT,
  AVATAR_CLAIM_PATH,
  avatarClaimId,
  avatarValueHash,
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
import { refundRenderCredits } from '@/lib/credits/refund'

type SettlementReason = 'compose_succeeded' | 'provider_failed' | 'compose_failed_after_asset_delivered'
type AvatarClaimStatus = 'pending' | 'done' | 'settled'

type AvatarClaimRow = {
  id?: unknown
  name?: unknown
  user_id?: unknown
  path?: unknown
  session_id?: unknown
  metadata?: unknown
}

export type VerifiedAvatarBirthClaim = {
  claimId: string
  userId: string
  generationId: string
  status: AvatarClaimStatus
  fingerprint: string
  creditCost: number
  response: Record<string, unknown> | null
  responseHash: string
  requestId: string
  engine: string
  quality: 'avatar' | 'presenter'
  completedVideoUrl: string
  billingReference: string
  metadata: Record<string, unknown>
  authority: string
}

type AvatarClaimLoad =
  | { ok: true; claim: VerifiedAvatarBirthClaim | null }
  | { ok: false; error: string }

type AvatarDebitResult =
  | { ok: true; credits: number }
  | { ok: false; error: string }

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

export function avatarBillingReference(userId: string, generationId: string): string {
  return `avatar-${avatarClaimId(userId, generationId)}`
}

export function avatarQualityForEngine(engine: string): 'avatar' | 'presenter' {
  return engine === 'presenter' ? 'presenter' : 'avatar'
}

function avatarCostForEngine(engine: string): number {
  return engine === 'presenter' ? 70 : 110
}

function verifyAvatarClaimRow(args: {
  row: unknown
  secret: string
  userId: string
  generationId: string
}): AvatarClaimLoad {
  if (!args.secret || !validAvatarGenerationId(args.generationId)) {
    return { ok: false, error: 'invalid avatar claim verifier input' }
  }
  const row = args.row as AvatarClaimRow | null
  const claimId = avatarClaimId(args.userId, args.generationId)
  if (
    !row || row.id !== claimId || row.name !== AVATAR_CLAIM_EVENT ||
    row.user_id !== args.userId || row.path !== AVATAR_CLAIM_PATH ||
    row.session_id !== args.generationId
  ) {
    return { ok: false, error: 'avatar claim identity mismatch' }
  }

  const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
    ? row.metadata as Record<string, unknown>
    : null
  if (!metadata || metadata.generation_id !== args.generationId) {
    return { ok: false, error: 'avatar claim metadata mismatch' }
  }
  const status: AvatarClaimStatus | null =
    metadata.status === 'pending' || metadata.status === 'done' || metadata.status === 'settled'
      ? metadata.status
      : null
  const fingerprint = typeof metadata.fingerprint === 'string' ? metadata.fingerprint : ''
  const creditCost = typeof metadata.credit_cost === 'number' && Number.isInteger(metadata.credit_cost)
    ? metadata.credit_cost
    : null
  const responseHash = typeof metadata.response_hash === 'string' ? metadata.response_hash : ''
  const response = metadata.response && typeof metadata.response === 'object' && !Array.isArray(metadata.response)
    ? metadata.response as Record<string, unknown>
    : null
  const authority = typeof metadata.authority === 'string' ? metadata.authority : ''
  if (
    !status || !fingerprint || creditCost === null || creditCost <= 0 || creditCost > 1000 ||
    !verifyAvatarClaim(args.secret, {
      claimId,
      userId: args.userId,
      generationId: args.generationId,
      status,
      fingerprint,
      creditCost,
      ...(responseHash ? { responseHash } : {}),
    }, authority)
  ) {
    return { ok: false, error: 'invalid avatar claim authority' }
  }

  if (status === 'pending') {
    if (response || responseHash) return { ok: false, error: 'pending avatar claim contains a response' }
    return {
      ok: true,
      claim: {
        claimId,
        userId: args.userId,
        generationId: args.generationId,
        status,
        fingerprint,
        creditCost,
        response: null,
        responseHash: '',
        requestId: '',
        engine: '',
        quality: 'avatar',
        completedVideoUrl: '',
        billingReference: avatarBillingReference(args.userId, args.generationId),
        metadata,
        authority,
      },
    }
  }

  if (!response || !responseHash || avatarValueHash(response) !== responseHash) {
    return { ok: false, error: 'completed avatar claim response is invalid' }
  }
  const requestId = typeof response.avatar_request_id === 'string' ? response.avatar_request_id.trim() : ''
  const engine = typeof response.engine === 'string' ? response.engine.trim() : ''
  const responseGenerationId = typeof response.generationId === 'string' ? response.generationId : ''
  const completedVideoUrl = typeof response.completed_video_url === 'string'
    ? response.completed_video_url.trim()
    : ''
  const quality = avatarQualityForEngine(engine)
  if (
    !requestId || !engine || responseGenerationId !== args.generationId ||
    creditCost !== avatarCostForEngine(engine)
  ) {
    return { ok: false, error: 'avatar response does not match its signed cost' }
  }
  return {
    ok: true,
    claim: {
      claimId,
      userId: args.userId,
      generationId: args.generationId,
      status,
      fingerprint,
      creditCost,
      response,
      responseHash,
      requestId,
      engine,
      quality,
      completedVideoUrl,
      billingReference: avatarBillingReference(args.userId, args.generationId),
      metadata,
      authority,
    },
  }
}

async function loadAvatarClaimByGeneration(args: {
  db: SupabaseClient
  secret: string
  userId: string
  generationId: string
}): Promise<AvatarClaimLoad> {
  if (!validAvatarGenerationId(args.generationId)) return { ok: false, error: 'invalid generation id' }
  const { data, error } = await args.db
    .from('events')
    .select('id,name,user_id,path,session_id,metadata')
    .eq('id', avatarClaimId(args.userId, args.generationId))
    .eq('user_id', args.userId)
    .eq('name', AVATAR_CLAIM_EVENT)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: true, claim: null }
  return verifyAvatarClaimRow({ ...args, row: data })
}

export async function loadVerifiedAvatarClaimForRequest(args: {
  userId: string
  requestId: string
}): Promise<AvatarClaimLoad> {
  const admin = adminClient()
  const requestId = args.requestId.trim()
  if (!admin || !requestId) return { ok: false, error: 'avatar claim lookup is unavailable' }
  const { data, error } = await admin.db
    .from('events')
    .select('id,name,user_id,path,session_id,metadata')
    .eq('name', AVATAR_CLAIM_EVENT)
    .eq('user_id', args.userId)
    .contains('metadata', { response: { avatar_request_id: requestId } })
    .limit(20)
  if (error) return { ok: false, error: error.message }
  let verified: VerifiedAvatarBirthClaim | null = null
  for (const row of data ?? []) {
    const generationId = typeof row.session_id === 'string' ? row.session_id : ''
    const candidate = verifyAvatarClaimRow({
      row,
      secret: admin.secret,
      userId: args.userId,
      generationId,
    })
    if (!candidate.ok || !candidate.claim || candidate.claim.requestId !== requestId) continue
    if (verified && verified.claimId !== candidate.claim.claimId) {
      return { ok: false, error: 'avatar request maps to multiple signed claims' }
    }
    verified = candidate.claim
  }
  return { ok: true, claim: verified }
}

export async function markAvatarClaimPrepaid(args: {
  userId: string
  generationId: string
}): Promise<boolean> {
  const admin = adminClient()
  if (!admin) return false
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const loaded = await loadAvatarClaimByGeneration({ ...admin, ...args })
    if (!loaded.ok || !loaded.claim) return false
    const claim = loaded.claim
    const expectedReference = claim.billingReference
    const existingReference = typeof claim.metadata.prepaid_billing_reference === 'string'
      ? claim.metadata.prepaid_billing_reference
      : ''
    if (existingReference === expectedReference && typeof claim.metadata.prepaid_debited_at === 'string') {
      return true
    }
    if (existingReference && existingReference !== expectedReference) return false
    const nextMetadata = {
      ...claim.metadata,
      prepaid_billing_reference: expectedReference,
      prepaid_debited_at: new Date().toISOString(),
    }
    const { data, error } = await admin.db
      .from('events')
      .update({ metadata: nextMetadata })
      .eq('id', claim.claimId)
      .eq('user_id', args.userId)
      .eq('name', AVATAR_CLAIM_EVENT)
      .eq('metadata->>authority', claim.authority)
      .select('id')
      .maybeSingle()
    if (!error && data?.id === claim.claimId) return true
  }
  return false
}

async function confirmAvatarDebitWithDb(args: {
  db: SupabaseClient
  userId: string
  billingReference: string
  creditCost: number
}): Promise<AvatarDebitResult> {
  const { data, error } = await args.db
    .from('credit_debits')
    .select('render_id,user_id,amount,refunded_at')
    .eq('render_id', args.billingReference)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  const amount = typeof data?.amount === 'number' ? data.amount : Number(data?.amount)
  if (
    !data || data.user_id !== args.userId || !Number.isFinite(amount) || amount !== args.creditCost
  ) {
    return { ok: false, error: 'avatar debit is missing or mismatched' }
  }
  if (typeof data.refunded_at === 'string' && data.refunded_at) {
    return { ok: false, error: 'avatar debit was refunded' }
  }
  return { ok: true, credits: amount }
}

export async function confirmAvatarBirthDebit(args: {
  userId: string
  generationId: string
  creditCost: number
}): Promise<AvatarDebitResult> {
  const admin = adminClient()
  if (!admin) return { ok: false, error: 'avatar debit verification unavailable' }
  return confirmAvatarDebitWithDb({
    db: admin.db,
    userId: args.userId,
    billingReference: avatarBillingReference(args.userId, args.generationId),
    creditCost: args.creditCost,
  })
}

export async function bindAvatarCompletedVideo(args: {
  userId: string
  requestId: string
  engine: string
  videoUrl: string
}): Promise<AvatarClaimLoad> {
  const admin = adminClient()
  const videoUrl = args.videoUrl.trim()
  if (!admin || !videoUrl.startsWith('https://')) return { ok: false, error: 'invalid avatar video URL' }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const loaded = await loadVerifiedAvatarClaimForRequest({ userId: args.userId, requestId: args.requestId })
    if (!loaded.ok || !loaded.claim) return loaded
    const claim = loaded.claim
    if (claim.engine !== args.engine) return { ok: false, error: 'avatar engine mismatch' }
    if (claim.completedVideoUrl) {
      return claim.completedVideoUrl === videoUrl
        ? loaded
        : { ok: false, error: 'avatar video URL is already bound differently' }
    }
    if (!claim.response) return { ok: false, error: 'avatar response is unavailable' }
    const response = { ...claim.response, completed_video_url: videoUrl }
    const responseHash = avatarValueHash(response)
    const nextMetadata = {
      ...claim.metadata,
      response,
      response_hash: responseHash,
      authority: signAvatarClaim(admin.secret, {
        claimId: claim.claimId,
        userId: claim.userId,
        generationId: claim.generationId,
        status: claim.status,
        fingerprint: claim.fingerprint,
        creditCost: claim.creditCost,
        responseHash,
      }),
    }
    const { data, error } = await admin.db
      .from('events')
      .update({ metadata: nextMetadata })
      .eq('id', claim.claimId)
      .eq('user_id', claim.userId)
      .eq('name', AVATAR_CLAIM_EVENT)
      .eq('metadata->>authority', claim.authority)
      .select('id,name,user_id,path,session_id,metadata')
      .maybeSingle()
    if (!error && data) {
      return verifyAvatarClaimRow({
        row: data,
        secret: admin.secret,
        userId: claim.userId,
        generationId: claim.generationId,
      })
    }
  }
  return { ok: false, error: 'avatar video binding changed concurrently' }
}

export async function loadPrepaidAvatarClaimForGeneration(args: {
  db: SupabaseClient
  secret: string
  userId: string
  generationId: string
}): Promise<AvatarClaimLoad> {
  const loaded = await loadAvatarClaimByGeneration(args)
  if (!loaded.ok || !loaded.claim) return loaded
  const claim = loaded.claim
  if (claim.status !== 'done' && claim.status !== 'settled') {
    return { ok: false, error: 'avatar birth claim is not complete' }
  }
  if (!claim.completedVideoUrl) return { ok: false, error: 'avatar completed URL is not signed' }
  if (
    claim.metadata.prepaid_billing_reference !== claim.billingReference ||
    typeof claim.metadata.prepaid_debited_at !== 'string'
  ) {
    return { ok: false, error: 'avatar birth claim is not marked prepaid' }
  }
  const debit = await confirmAvatarDebitWithDb({
    db: args.db,
    userId: args.userId,
    billingReference: claim.billingReference,
    creditCost: claim.creditCost,
  })
  return debit.ok ? loaded : { ok: false, error: debit.error }
}

export async function loadPrepaidAvatarClaimForRender(args: {
  db: SupabaseClient
  secret: string
  userId: string
  renderId: string
}): Promise<AvatarClaimLoad> {
  const { data: compose, error } = await args.db
    .from('events')
    .select('id,name,user_id,path,session_id,metadata')
    .eq('name', COMPOSE_CLAIM_EVENT)
    .eq('user_id', args.userId)
    .contains('metadata', { status: 'done', render_id: args.renderId })
    .limit(1)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!compose) return { ok: true, claim: null }
  const metadata = compose.metadata && typeof compose.metadata === 'object'
    ? compose.metadata as Record<string, unknown>
    : {}
  const generationId = typeof compose.session_id === 'string' ? compose.session_id : ''
  const quality = typeof metadata.quality === 'string' ? metadata.quality : ''
  const cost = typeof metadata.cost === 'number' && Number.isInteger(metadata.cost) ? metadata.cost : null
  const composeId = typeof compose.id === 'string' ? compose.id : ''
  if (
    !validComposeGenerationId(generationId) || (quality !== 'avatar' && quality !== 'presenter') ||
    cost === null || cost <= 0 || composeId !== composeClaimId(args.userId, generationId) ||
    compose.user_id !== args.userId || compose.path !== COMPOSE_CLAIM_PATH ||
    metadata.generation_id !== generationId ||
    !verifyComposeClaim(args.secret, {
      claimId: composeId,
      userId: args.userId,
      generationId,
      status: 'done',
      renderId: args.renderId,
      quality,
      cost,
    }, metadata.authority)
  ) {
    return { ok: false, error: 'invalid compose claim for avatar render' }
  }
  const birth = await loadPrepaidAvatarClaimForGeneration({ ...args, generationId })
  if (!birth.ok || !birth.claim) return birth
  if (birth.claim.quality !== quality || birth.claim.creditCost !== cost) {
    return { ok: false, error: 'avatar birth/compose billing mismatch' }
  }
  return birth
}

export async function refundAvatarBirthDebit(args: {
  userId: string
  generationId: string
  creditCost: number
}): Promise<AvatarDebitResult> {
  const admin = adminClient()
  if (!admin) return { ok: false, error: 'avatar refund verification unavailable' }
  const billingReference = avatarBillingReference(args.userId, args.generationId)
  await refundRenderCredits(billingReference)
  const { data, error } = await admin.db
    .from('credit_debits')
    .select('user_id,amount,refunded_at')
    .eq('render_id', billingReference)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: true, credits: 0 }
  const amount = typeof data.amount === 'number' ? data.amount : Number(data.amount)
  if (data.user_id !== args.userId || !Number.isFinite(amount) || amount !== args.creditCost) {
    return { ok: false, error: 'avatar refund ledger mismatch' }
  }
  return typeof data.refunded_at === 'string' && data.refunded_at
    ? { ok: true, credits: amount }
    : { ok: false, error: 'avatar refund is not confirmed' }
}

async function settleClaim(args: {
  userId: string
  generationId: string
  reason: SettlementReason
}): Promise<boolean> {
  const admin = adminClient()
  if (!admin || !validAvatarGenerationId(args.generationId)) return false
  const loaded = await loadAvatarClaimByGeneration({ ...admin, ...args })
  if (!loaded.ok || !loaded.claim) {
    if (!loaded.ok) console.error('[avatar-hold] claim lookup failed:', loaded.error)
    return false
  }
  const claim = loaded.claim
  if (claim.status === 'settled') return true
  if (claim.status !== 'done' || !claim.response || !claim.responseHash) return false

  const settledMetadata = {
    ...claim.metadata,
    status: 'settled',
    credit_settlement_reason: args.reason,
    credit_settled_at: new Date().toISOString(),
    authority: signAvatarClaim(admin.secret, {
      claimId: claim.claimId,
      userId: args.userId,
      generationId: args.generationId,
      status: 'settled',
      fingerprint: claim.fingerprint,
      creditCost: claim.creditCost,
      responseHash: claim.responseHash,
    }),
  }
  const { data: updated, error: updateError } = await admin.db
    .from('events')
    .update({ metadata: settledMetadata })
    .eq('id', claim.claimId)
    .eq('user_id', args.userId)
    .eq('name', AVATAR_CLAIM_EVENT)
    .eq('metadata->>authority', claim.authority)
    .select('id')
    .maybeSingle()
  if (updateError || updated?.id !== claim.claimId) {
    const retry = await loadAvatarClaimByGeneration({ ...admin, ...args })
    if (retry.ok && retry.claim?.status === 'settled') return true
    console.error('[avatar-hold] settlement failed:', updateError?.message ?? 'row missing')
    return false
  }
  return true
}

export async function settleAvatarCreditHoldForRender(args: {
  userId: string
  renderId: string
  reason?: SettlementReason
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
  return settleClaim({
    userId: args.userId,
    generationId,
    reason: args.reason ?? 'compose_succeeded',
  })
}

export async function refundAvatarBirthDebitForFailedRequest(args: {
  userId: string
  requestId: string
}): Promise<AvatarDebitResult> {
  const loaded = await loadVerifiedAvatarClaimForRequest(args)
  if (!loaded.ok) return { ok: false, error: loaded.error }
  if (!loaded.claim) return { ok: true, credits: 0 }
  const claim = loaded.claim
  const refunded = await refundAvatarBirthDebit({
    userId: args.userId,
    generationId: claim.generationId,
    creditCost: claim.creditCost,
  })
  if (!refunded.ok) return refunded
  const settled = await settleClaim({
    userId: args.userId,
    generationId: claim.generationId,
    reason: 'provider_failed',
  })
  return settled ? refunded : { ok: false, error: 'avatar failed claim could not settle' }
}

export async function settleAvatarCreditHoldForFailedRequest(args: {
  userId: string
  requestId: string
}): Promise<boolean> {
  const loaded = await loadVerifiedAvatarClaimForRequest(args)
  if (!loaded.ok || !loaded.claim) return false
  return settleClaim({
    userId: args.userId,
    generationId: loaded.claim.generationId,
    reason: 'provider_failed',
  })
}
