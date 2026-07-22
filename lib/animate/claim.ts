import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'

const ANIMATE_CREDIT_COST = 5
const ANIMATE_CLAIM_EVENT = 'animate_submission_claim'
const ANIMATE_CLAIM_PATH = '/api/animate'
const ANIMATE_JOB_EVENT = 'animate_job_submitted'
const ANIMATE_JOB_PATH = '/api/animate-image'

type ClaimStatus = 'pending' | 'done' | 'released'

type EventRow = {
  id?: unknown
  name?: unknown
  user_id?: unknown
  path?: unknown
  session_id?: unknown
  metadata?: unknown
  created_at?: unknown
}

export type AnimateClaimResponse = {
  request_id: string
  image_url: string
  duration: '5' | '10'
  credits_charged: number
  balance: number | null
}

export type VerifiedAnimateClaim = {
  id: string
  userId: string
  keyHash: string
  fingerprint: string
  status: ClaimStatus
  billingReference: string
  startedAt: string
  response: AnimateClaimResponse | null
  releaseReason: string
  authority: string
}

export type VerifiedAnimateJob = {
  id: string
  userId: string
  requestId: string
  billingReference: string
  imageUrl: string
  duration: '5' | '10'
  balance: number
  authority: string
}

type AdminContext = { db: SupabaseClient; secret: string }

function adminContext(): AdminContext | null {
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

function deterministicUuid(namespace: string, ...parts: string[]): string {
  const hex = createHash('sha256')
    .update([namespace, ...parts].join(':'))
    .digest('hex')
    .slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`
}

export function animateValueHash(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex')
}

export function validAnimateIdempotencyKey(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{8,100}$/.test(value)
}

function keyHash(idempotencyKey: string): string {
  return createHash('sha256').update(idempotencyKey).digest('hex')
}

export function animateClaimId(userId: string, idempotencyKey: string): string {
  return deterministicUuid('kineo:animate-submission:v1', userId, idempotencyKey)
}

export function animateBillingReferenceForClaim(claimId: string): string {
  return `animate-${claimId}`
}

function claimAuthorityPayload(input: {
  id: string
  userId: string
  keyHash: string
  fingerprint: string
  status: ClaimStatus
  billingReference: string
  responseHash?: string
}): string {
  return JSON.stringify([
    'kineo-animate-claim-v1',
    input.id,
    input.userId,
    input.keyHash,
    input.fingerprint,
    input.status,
    input.billingReference,
    input.responseHash ?? '',
    ANIMATE_CLAIM_PATH,
  ])
}

function claimBillingAuthorityPayload(userId: string, billingReference: string): string {
  return JSON.stringify([
    'kineo-animate-claim-billing-v1',
    userId,
    billingReference,
    ANIMATE_CLAIM_EVENT,
    ANIMATE_CLAIM_PATH,
  ])
}

function signClaim(secret: string, input: Parameters<typeof claimAuthorityPayload>[0]): string {
  return createHmac('sha256', secret).update(claimAuthorityPayload(input)).digest('hex')
}

function validSignature(secret: string, payload: string, signature: unknown): boolean {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}

function verifyStoredClaimRow(args: {
  row: unknown
  secret: string
  userId: string
  expectedId?: string
  expectedKeyHash?: string
}): { ok: true; claim: VerifiedAnimateClaim } | { ok: false; error: string } {
  const row = args.row as EventRow | null
  const id = typeof row?.id === 'string' ? row.id : ''
  const storedKeyHash = typeof row?.session_id === 'string' ? row.session_id : ''
  if (
    !row || !/^[a-f0-9-]{36}$/i.test(id) || !/^[a-f0-9]{64}$/i.test(storedKeyHash) ||
    (args.expectedId !== undefined && id !== args.expectedId) ||
    (args.expectedKeyHash !== undefined && storedKeyHash !== args.expectedKeyHash) ||
    row.name !== ANIMATE_CLAIM_EVENT ||
    row.user_id !== args.userId || row.path !== ANIMATE_CLAIM_PATH ||
    row.session_id !== storedKeyHash
  ) {
    return { ok: false, error: 'animate claim identity mismatch' }
  }
  const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
    ? row.metadata as Record<string, unknown>
    : null
  if (!metadata) return { ok: false, error: 'animate claim metadata missing' }

  const status: ClaimStatus | null = metadata.status === 'pending' || metadata.status === 'done' || metadata.status === 'released'
    ? metadata.status
    : null
  const fingerprint = typeof metadata.fingerprint === 'string' ? metadata.fingerprint : ''
  const billingReference = typeof metadata.billing_reference === 'string' ? metadata.billing_reference : ''
  const startedAt = typeof metadata.started_at === 'string' ? metadata.started_at : ''
  const authority = typeof metadata.authority === 'string' ? metadata.authority : ''
  const billingAuthority = typeof metadata.billing_authority === 'string' ? metadata.billing_authority : ''
  const responseHash = typeof metadata.response_hash === 'string' ? metadata.response_hash : ''
  const response = metadata.response && typeof metadata.response === 'object' && !Array.isArray(metadata.response)
    ? metadata.response as AnimateClaimResponse
    : null
  const releaseReason = typeof metadata.release_reason === 'string' ? metadata.release_reason : ''
  if (
    !status || !fingerprint || !startedAt || !Number.isFinite(Date.parse(startedAt)) ||
    billingReference !== animateBillingReferenceForClaim(id) ||
    !validSignature(args.secret, claimBillingAuthorityPayload(args.userId, billingReference), billingAuthority)
  ) {
    return { ok: false, error: 'animate claim fields are invalid' }
  }
  const authorityPayload = claimAuthorityPayload({
    id,
    userId: args.userId,
    keyHash: storedKeyHash,
    fingerprint,
    status,
    billingReference,
    ...(responseHash ? { responseHash } : {}),
  })
  if (!validSignature(args.secret, authorityPayload, authority)) {
    return { ok: false, error: 'animate claim authority is invalid' }
  }
  if ((status === 'pending' || status === 'released') && (response || responseHash)) {
    return { ok: false, error: 'unfinished animate claim contains a response' }
  }
  if (status === 'released' && !releaseReason) {
    return { ok: false, error: 'released animate claim has no reason' }
  }
  if (status === 'done') {
    if (!response || !responseHash || animateValueHash(response) !== responseHash) {
      return { ok: false, error: 'animate claim response is invalid' }
    }
    if (
      typeof response.request_id !== 'string' || !response.request_id ||
      typeof response.image_url !== 'string' || !response.image_url ||
      (response.duration !== '5' && response.duration !== '10') ||
      response.credits_charged !== ANIMATE_CREDIT_COST ||
      (response.balance !== null && typeof response.balance !== 'number')
    ) {
      return { ok: false, error: 'animate claim response fields are invalid' }
    }
  }
  return {
    ok: true,
    claim: {
      id,
      userId: args.userId,
      keyHash: storedKeyHash,
      fingerprint,
      status,
      billingReference,
      startedAt,
      response,
      releaseReason,
      authority,
    },
  }
}

function verifyClaimRow(args: {
  row: unknown
  secret: string
  userId: string
  idempotencyKey: string
}): { ok: true; claim: VerifiedAnimateClaim } | { ok: false; error: string } {
  return verifyStoredClaimRow({
    row: args.row,
    secret: args.secret,
    userId: args.userId,
    expectedId: animateClaimId(args.userId, args.idempotencyKey),
    expectedKeyHash: keyHash(args.idempotencyKey),
  })
}

export type AcquireAnimateClaimResult =
  | { kind: 'acquired'; claim: VerifiedAnimateClaim }
  | { kind: 'pending'; claim: VerifiedAnimateClaim }
  | { kind: 'replay'; claim: VerifiedAnimateClaim; response: AnimateClaimResponse }
  | { kind: 'released'; claim: VerifiedAnimateClaim }
  | { kind: 'conflict'; error: string }
  | { kind: 'error'; error: string }

export async function acquireAnimateClaim(args: {
  userId: string
  idempotencyKey: string
  fingerprint: string
}): Promise<AcquireAnimateClaimResult> {
  const admin = adminContext()
  if (!admin) return { kind: 'error', error: 'animate claim storage is unavailable' }

  const id = animateClaimId(args.userId, args.idempotencyKey)
  const hashedKey = keyHash(args.idempotencyKey)
  const billingReference = animateBillingReferenceForClaim(id)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const startedAt = new Date().toISOString()
    const metadata = {
      status: 'pending' as const,
      fingerprint: args.fingerprint,
      billing_reference: billingReference,
      credit_cost: ANIMATE_CREDIT_COST,
      started_at: startedAt,
      billing_authority: createHmac('sha256', admin.secret)
        .update(claimBillingAuthorityPayload(args.userId, billingReference))
        .digest('hex'),
      authority: signClaim(admin.secret, {
        id,
        userId: args.userId,
        keyHash: hashedKey,
        fingerprint: args.fingerprint,
        status: 'pending',
        billingReference,
      }),
    }
    const { error } = await admin.db.from('events').insert({
      id,
      user_id: args.userId,
      name: ANIMATE_CLAIM_EVENT,
      path: ANIMATE_CLAIM_PATH,
      session_id: hashedKey,
      metadata,
    })
    if (!error) {
      return {
        kind: 'acquired',
        claim: {
          id,
          userId: args.userId,
          keyHash: hashedKey,
          fingerprint: args.fingerprint,
          status: 'pending',
          billingReference,
          startedAt,
          response: null,
          releaseReason: '',
          authority: metadata.authority,
        },
      }
    }
    if (error.code !== '23505') return { kind: 'error', error: error.message }

    const { data: existing, error: loadError } = await admin.db
      .from('events')
      .select('id,name,user_id,path,session_id,metadata,created_at')
      .eq('id', id)
      .maybeSingle()
    if (loadError || !existing) return { kind: 'error', error: loadError?.message ?? 'animate claim missing' }
    const verified = verifyClaimRow({
      row: existing,
      secret: admin.secret,
      userId: args.userId,
      idempotencyKey: args.idempotencyKey,
    })
    const verificationError = verified.ok === false ? verified.error : 'animate claim identity mismatch'
    if (verified.ok === true) {
      if (verified.claim.fingerprint !== args.fingerprint) {
        return { kind: 'conflict', error: 'This Idempotency-Key belongs to a different Animate request.' }
      }
      if (verified.claim.status === 'done' && verified.claim.response) {
        return { kind: 'replay', claim: verified.claim, response: verified.claim.response }
      }
      if (verified.claim.status === 'released') {
        return { kind: 'released', claim: verified.claim }
      }
      return { kind: 'pending', claim: verified.claim }
    }

    // Some historical deployments allow browser analytics INSERTs into
    // `events`. Remove an unsigned row that squats on our reserved deterministic
    // id, but never do so once a real debit exists for that billing reference.
    const { data: debit, error: debitError } = await admin.db
      .from('credit_debits')
      .select('render_id')
      .eq('render_id', billingReference)
      .maybeSingle()
    if (debitError || debit) {
      return { kind: 'error', error: debitError?.message ?? verificationError }
    }
    let removeQuery = admin.db
      .from('events')
      .delete()
      .eq('id', id)
      .eq('name', existing.name as string)
    removeQuery = existing.session_id === null
      ? removeQuery.is('session_id', null)
      : removeQuery.eq('session_id', existing.session_id as string)
    removeQuery = existing.metadata === null
      ? removeQuery.is('metadata', null)
      : removeQuery.filter('metadata', 'eq', JSON.stringify(existing.metadata))
    const { data: removed, error: removeError } = await removeQuery.select('id').maybeSingle()
    if (removeError) return { kind: 'error', error: removeError.message }
    if (removed?.id !== id && attempt === 2) {
      return { kind: 'error', error: 'animate claim collision could not be cleared' }
    }
  }
  return { kind: 'error', error: 'animate claim collision could not be cleared' }
}

export async function completeAnimateClaim(args: {
  claim: VerifiedAnimateClaim
  idempotencyKey: string
  response: AnimateClaimResponse
}): Promise<boolean> {
  const admin = adminContext()
  if (!admin) return false
  const responseHash = animateValueHash(args.response)
  const metadata = {
    status: 'done' as const,
    fingerprint: args.claim.fingerprint,
    billing_reference: args.claim.billingReference,
    credit_cost: ANIMATE_CREDIT_COST,
    started_at: args.claim.startedAt,
    completed_at: new Date().toISOString(),
    response: args.response,
    response_hash: responseHash,
    billing_authority: createHmac('sha256', admin.secret)
      .update(claimBillingAuthorityPayload(args.claim.userId, args.claim.billingReference))
      .digest('hex'),
    authority: signClaim(admin.secret, {
      id: args.claim.id,
      userId: args.claim.userId,
      keyHash: args.claim.keyHash,
      fingerprint: args.claim.fingerprint,
      status: 'done',
      billingReference: args.claim.billingReference,
      responseHash,
    }),
  }
  const { data, error } = await admin.db
    .from('events')
    .update({ metadata })
    .eq('id', args.claim.id)
    .eq('user_id', args.claim.userId)
    .eq('name', ANIMATE_CLAIM_EVENT)
    .eq('metadata->>status', 'pending')
    .eq('metadata->>authority', args.claim.authority)
    .select('id')
    .maybeSingle()
  if (!error && data?.id === args.claim.id) return true

  const { data: existing } = await admin.db
    .from('events')
    .select('id,name,user_id,path,session_id,metadata')
    .eq('id', args.claim.id)
    .maybeSingle()
  if (!existing) return false
  const verified = verifyClaimRow({
    row: existing,
    secret: admin.secret,
    userId: args.claim.userId,
    idempotencyKey: args.idempotencyKey,
  })
  return verified.ok && verified.claim.status === 'done' &&
    animateValueHash(verified.claim.response) === responseHash
}

export async function deletePendingAnimateClaim(claim: VerifiedAnimateClaim): Promise<boolean> {
  const admin = adminContext()
  if (!admin) return false
  const { data, error } = await admin.db
    .from('events')
    .delete()
    .eq('id', claim.id)
    .eq('user_id', claim.userId)
    .eq('name', ANIMATE_CLAIM_EVENT)
    .eq('metadata->>status', 'pending')
    .eq('metadata->>authority', claim.authority)
    .select('id')
    .maybeSingle()
  return !error && data?.id === claim.id
}

export async function releaseAnimateClaim(args: {
  claim: VerifiedAnimateClaim
  reason: string
}): Promise<boolean> {
  const admin = adminContext()
  if (!admin || args.claim.status !== 'pending') return false
  const releaseReason = args.reason.trim().slice(0, 120) || 'closed_after_refund'
  const metadata = {
    status: 'released' as const,
    fingerprint: args.claim.fingerprint,
    billing_reference: args.claim.billingReference,
    credit_cost: ANIMATE_CREDIT_COST,
    started_at: args.claim.startedAt,
    released_at: new Date().toISOString(),
    release_reason: releaseReason,
    billing_authority: createHmac('sha256', admin.secret)
      .update(claimBillingAuthorityPayload(args.claim.userId, args.claim.billingReference))
      .digest('hex'),
    authority: signClaim(admin.secret, {
      id: args.claim.id,
      userId: args.claim.userId,
      keyHash: args.claim.keyHash,
      fingerprint: args.claim.fingerprint,
      status: 'released',
      billingReference: args.claim.billingReference,
    }),
  }
  const { data, error } = await admin.db
    .from('events')
    .update({ metadata })
    .eq('id', args.claim.id)
    .eq('user_id', args.claim.userId)
    .eq('name', ANIMATE_CLAIM_EVENT)
    .eq('metadata->>status', 'pending')
    .eq('metadata->>authority', args.claim.authority)
    .select('id')
    .maybeSingle()
  return !error && data?.id === args.claim.id
}

export async function admitAnimateAttempt(args: {
  userId: string
  billingReference: string
  refundedSinceIso: string
  activeSinceIso: string
  maxAttempts: number
}): Promise<{ ok: true; allowed: boolean; count: number } | { ok: false; error: string }> {
  const admin = adminContext()
  if (!admin) return { ok: false, error: 'animate claim storage is unavailable' }
  // The ledger is service-controlled. Merge refunded attempts from the last
  // hour with all very recent reservations, so parallel calls cannot all pass
  // a read-before-write counter. The current reservation must rank inside the
  // deterministic first N attempts.
  const [refundedQuery, activeQuery] = await Promise.all([
    admin.db
      .from('credit_debits')
      .select('render_id,created_at')
      .eq('user_id', args.userId)
      .like('render_id', 'animate-%')
      .not('refunded_at', 'is', null)
      .gte('created_at', args.refundedSinceIso)
      .order('created_at', { ascending: true })
      .order('render_id', { ascending: true })
      .limit(500),
    admin.db
      .from('credit_debits')
      .select('render_id,created_at')
      .eq('user_id', args.userId)
      .like('render_id', 'animate-%')
      .gte('created_at', args.activeSinceIso)
      .order('created_at', { ascending: true })
      .order('render_id', { ascending: true })
      .limit(500),
  ])
  if (refundedQuery.error || activeQuery.error) {
    return { ok: false, error: refundedQuery.error?.message ?? activeQuery.error?.message ?? 'animate admission failed' }
  }
  const attempts = new Map<string, string>()
  for (const row of [...(refundedQuery.data ?? []), ...(activeQuery.data ?? [])]) {
    if (typeof row.render_id === 'string' && typeof row.created_at === 'string') {
      attempts.set(row.render_id, row.created_at)
    }
  }
  const ordered = [...attempts.entries()].sort(([renderA, createdA], [renderB, createdB]) =>
    createdA.localeCompare(createdB) || renderA.localeCompare(renderB),
  )
  const position = ordered.findIndex(([renderId]) => renderId === args.billingReference)
  if (position < 0) return { ok: false, error: 'current animate reservation is not visible' }
  const maxAttempts = Math.max(1, Math.min(100, Math.floor(args.maxAttempts)))
  return { ok: true, allowed: position < maxAttempts, count: ordered.length }
}

export type AnimateClaimLoad =
  | { ok: true; claim: VerifiedAnimateClaim | null }
  | { ok: false; error: string }

export async function loadVerifiedAnimateClaimByBilling(args: {
  userId: string
  billingReference: string
}): Promise<AnimateClaimLoad> {
  const admin = adminContext()
  if (!admin) return { ok: false, error: 'animate claim storage is unavailable' }
  if (!/^animate-[a-f0-9-]{36}$/i.test(args.billingReference)) {
    return { ok: false, error: 'animate billing reference is invalid' }
  }
  const billingAuthority = createHmac('sha256', admin.secret)
    .update(claimBillingAuthorityPayload(args.userId, args.billingReference))
    .digest('hex')
  const { data, error } = await admin.db
    .from('events')
    .select('id,name,user_id,path,session_id,metadata,created_at')
    .eq('name', ANIMATE_CLAIM_EVENT)
    .eq('user_id', args.userId)
    .contains('metadata', { billing_reference: args.billingReference })
    .eq('metadata->>billing_authority', billingAuthority)
    .limit(10)
  if (error) return { ok: false, error: error.message }
  const validClaims: VerifiedAnimateClaim[] = []
  for (const row of data ?? []) {
    const verified = verifyStoredClaimRow({ row, secret: admin.secret, userId: args.userId })
    if (verified.ok && verified.claim.billingReference === args.billingReference) {
      validClaims.push(verified.claim)
    }
  }
  if (validClaims.length === 0) return { ok: true, claim: null }
  if (validClaims.length !== 1) return { ok: false, error: 'animate billing maps to multiple signed claims' }
  return { ok: true, claim: validClaims[0] }
}

function animateJobId(requestId: string): string {
  return deterministicUuid('kineo:animate-job:v1', requestId)
}

function jobAuthorityPayload(input: {
  id: string
  userId: string
  requestId: string
  billingReference: string
  imageUrl: string
  duration: '5' | '10'
  balance: number
}): string {
  return JSON.stringify([
    'kineo-animate-job-v1',
    input.id,
    input.userId,
    input.requestId,
    input.billingReference,
    input.imageUrl,
    input.duration,
    input.balance,
    ANIMATE_CREDIT_COST,
    ANIMATE_JOB_PATH,
  ])
}

function jobBillingAuthorityPayload(userId: string, billingReference: string): string {
  return JSON.stringify([
    'kineo-animate-job-billing-v1',
    userId,
    billingReference,
    ANIMATE_JOB_EVENT,
    ANIMATE_JOB_PATH,
  ])
}

export type AnimateJobLoad =
  | { ok: true; job: VerifiedAnimateJob | null }
  | { ok: false; reason: 'not_found' | 'invalid' | 'unavailable'; error: string }

function verifyJobRow(args: {
  row: unknown
  secret: string
  userId: string
  requestId: string
}): AnimateJobLoad {
  const row = args.row as EventRow | null
  if (!row) return { ok: true, job: null }
  if (row.user_id !== args.userId) {
    return { ok: false, reason: 'not_found', error: 'animate job not found' }
  }
  const id = animateJobId(args.requestId)
  if (row.id !== id || row.name !== ANIMATE_JOB_EVENT || row.path !== ANIMATE_JOB_PATH) {
    return { ok: false, reason: 'invalid', error: 'animate job identity mismatch' }
  }
  const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
    ? row.metadata as Record<string, unknown>
    : null
  const requestId = typeof metadata?.request_id === 'string' ? metadata.request_id : ''
  const billingReference = typeof metadata?.billing_reference === 'string' ? metadata.billing_reference : ''
  const imageUrl = typeof metadata?.image_url === 'string' ? metadata.image_url : ''
  const duration = metadata?.duration === '5' || metadata?.duration === '10' ? metadata.duration : null
  const balance = typeof metadata?.balance === 'number' ? metadata.balance : null
  const authority = typeof metadata?.authority === 'string' ? metadata.authority : ''
  const billingAuthority = typeof metadata?.billing_authority === 'string' ? metadata.billing_authority : ''
  if (
    requestId !== args.requestId ||
    !/^animate-[a-f0-9-]{36}$/i.test(billingReference) ||
    !imageUrl.startsWith('https://') || !duration || balance === null ||
    !validSignature(args.secret, jobBillingAuthorityPayload(args.userId, billingReference), billingAuthority) ||
    !validSignature(args.secret, jobAuthorityPayload({
      id,
      userId: args.userId,
      requestId,
      billingReference,
      imageUrl,
      duration,
      balance,
    }), authority)
  ) {
    return { ok: false, reason: 'invalid', error: 'animate job authority is invalid' }
  }
  return {
    ok: true,
    job: { id, userId: args.userId, requestId, billingReference, imageUrl, duration, balance, authority },
  }
}

export async function publishAnimateJob(args: {
  userId: string
  requestId: string
  billingReference: string
  imageUrl: string
  duration: '5' | '10'
  balance: number
}): Promise<{ ok: true } | { ok: false; error: string; pending?: boolean }> {
  const admin = adminContext()
  if (!admin) return { ok: false, error: 'animate job storage is unavailable' }
  const id = animateJobId(args.requestId)
  const authority = createHmac('sha256', admin.secret)
    .update(jobAuthorityPayload({ id, ...args }))
    .digest('hex')
  const billingAuthority = createHmac('sha256', admin.secret)
    .update(jobBillingAuthorityPayload(args.userId, args.billingReference))
    .digest('hex')
  const { error } = await admin.db.from('events').insert({
    id,
    user_id: args.userId,
    name: ANIMATE_JOB_EVENT,
    path: ANIMATE_JOB_PATH,
    session_id: args.requestId.slice(0, 64),
    metadata: {
      request_id: args.requestId,
      billing_reference: args.billingReference,
      image_url: args.imageUrl,
      duration: args.duration,
      balance: args.balance,
      credit_cost: ANIMATE_CREDIT_COST,
      submitted_at: new Date().toISOString(),
      billing_authority: billingAuthority,
      authority,
    },
  })
  if (!error) return { ok: true }
  // An insert may commit even when its network response is lost. Always do a
  // signed read-after-write before deciding that publication failed/refunding.
  const loaded = await loadVerifiedAnimateJob({ userId: args.userId, requestId: args.requestId })
  if (
    loaded.ok && loaded.job?.billingReference === args.billingReference &&
    loaded.job.imageUrl === args.imageUrl && loaded.job.duration === args.duration &&
    loaded.job.balance === args.balance
  ) return { ok: true }
  if (loaded.ok === false && loaded.reason === 'unavailable') {
    return {
      ok: false,
      pending: true,
      error: `${error.message}; signed readback is temporarily unavailable`,
    }
  }
  if (error.code === '23505') return { ok: false, error: 'animate job collision' }
  if (loaded.ok === false) {
    return { ok: false, error: `${error.message}; readback: ${loaded.error}` }
  }
  return { ok: false, error: error.message }
}

export async function loadVerifiedAnimateJob(args: {
  userId: string
  requestId: string
}): Promise<AnimateJobLoad> {
  const admin = adminContext()
  if (!admin) return { ok: false, reason: 'unavailable', error: 'animate job storage is unavailable' }
  const { data, error } = await admin.db
    .from('events')
    .select('id,name,user_id,path,session_id,metadata')
    .eq('id', animateJobId(args.requestId))
    .maybeSingle()
  if (error) return { ok: false, reason: 'unavailable', error: error.message }
  return verifyJobRow({ row: data, secret: admin.secret, ...args })
}

export async function loadVerifiedAnimateJobByBilling(args: {
  userId: string
  billingReference: string
}): Promise<AnimateJobLoad> {
  const admin = adminContext()
  if (!admin) return { ok: false, reason: 'unavailable', error: 'animate job storage is unavailable' }
  if (!/^animate-[a-f0-9-]{36}$/i.test(args.billingReference)) {
    return { ok: false, reason: 'invalid', error: 'animate billing reference is invalid' }
  }
  const billingAuthority = createHmac('sha256', admin.secret)
    .update(jobBillingAuthorityPayload(args.userId, args.billingReference))
    .digest('hex')
  const { data, error } = await admin.db
    .from('events')
    .select('id,name,user_id,path,session_id,metadata')
    .eq('name', ANIMATE_JOB_EVENT)
    .eq('user_id', args.userId)
    .contains('metadata', { billing_reference: args.billingReference })
    .eq('metadata->>billing_authority', billingAuthority)
    .limit(10)
  if (error) return { ok: false, reason: 'unavailable', error: error.message }
  if (!data?.length) return { ok: true, job: null }
  const validJobs: VerifiedAnimateJob[] = []
  for (const row of data) {
    const metadata = row.metadata && typeof row.metadata === 'object'
      ? row.metadata as Record<string, unknown>
      : {}
    const requestId = typeof metadata.request_id === 'string' ? metadata.request_id : ''
    if (!requestId) continue
    const verified = verifyJobRow({ row, secret: admin.secret, userId: args.userId, requestId })
    if (verified.ok && verified.job?.billingReference === args.billingReference) {
      validJobs.push(verified.job)
    }
  }
  if (validJobs.length === 0) return { ok: true, job: null }
  if (validJobs.length !== 1) return { ok: false, reason: 'invalid', error: 'animate billing maps to multiple signed jobs' }
  return { ok: true, job: validJobs[0] }
}

export async function confirmAnimateDebit(args: {
  userId: string
  billingReference: string
}): Promise<
  | { ok: true; refunded: boolean; amount: number }
  | { ok: false; reason: 'missing' | 'mismatch' | 'unavailable'; error: string }
> {
  const admin = adminContext()
  if (!admin) return { ok: false, reason: 'unavailable', error: 'animate debit storage is unavailable' }
  const { data, error } = await admin.db
    .from('credit_debits')
    .select('render_id,user_id,amount,refunded_at')
    .eq('render_id', args.billingReference)
    .maybeSingle()
  if (error) return { ok: false, reason: 'unavailable', error: error.message }
  if (!data) return { ok: false, reason: 'missing', error: 'animate debit is missing' }
  const amount = typeof data?.amount === 'number' ? data.amount : Number(data?.amount)
  if (data.user_id !== args.userId || !Number.isFinite(amount) || amount !== ANIMATE_CREDIT_COST) {
    return { ok: false, reason: 'mismatch', error: 'animate debit is mismatched' }
  }
  return {
    ok: true,
    amount,
    refunded: typeof data.refunded_at === 'string' && data.refunded_at.length > 0,
  }
}
