import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  COMPOSE_CLAIM_EVENT,
  COMPOSE_CLAIM_PATH,
  composeClaimId,
  validComposeGenerationId,
  verifyComposeClaim,
} from '@/lib/composeClaim'

export const CINEMATIC_CLAIM_EVENT = 'cinematic_submission_claim'
export const CINEMATIC_CLAIM_PATH = '/api/generate-video-cinematic'

export type CinematicClaimStatus = 'pending' | 'done' | 'settled' | 'released'

export type CinematicCompletedUrl = string | null
export type CinematicRequestId = string | null

export interface CinematicClaimAuthority {
  claimId: string
  userId: string
  generationId: string
  status: CinematicClaimStatus
  fingerprint: string
  creditCost: number
  quality: string
  engine: string
  falRequestIds: CinematicRequestId[]
  falModels: string[]
  authorizedCompletedUrls: CinematicCompletedUrl[]
  responseHash?: string
  resolutionReason?: string
  resolutionReference?: string
}

export interface CinematicClaim {
  id: string
  userId: string
  generationId: string
  status: CinematicClaimStatus
  fingerprint: string
  creditCost: number
  quality: string
  engine: string
  falRequestIds: CinematicRequestId[]
  falModels: string[]
  authorizedCompletedUrls: CinematicCompletedUrl[]
  response: Record<string, unknown> | null
  responseHash: string
  resolutionReason: string
  resolutionReference: string
  startedAt: string
  completedAt: string
  resolvedAt: string
  authority: string
}

type CinematicClaimRow = {
  id?: unknown
  name?: unknown
  user_id?: unknown
  path?: unknown
  session_id?: unknown
  metadata?: unknown
  created_at?: unknown
}

export type CinematicClaimValidation =
  | { ok: true; claim: CinematicClaim }
  | { ok: false; error: string }

export type CinematicClaimLoad =
  | { ok: true; claim: CinematicClaim | null }
  | { ok: false; error: string }

export type CinematicRenderClaimLoad =
  | { ok: true; claim: CinematicClaim | null }
  | { ok: false; error: string }

export type CinematicClaimAcquire =
  | { kind: 'acquired'; claim: CinematicClaim }
  | { kind: 'pending'; claim: CinematicClaim }
  | { kind: 'replay'; claim: CinematicClaim; response: Record<string, unknown> }
  | { kind: 'released'; claim: CinematicClaim }
  | { kind: 'conflict'; error: string }
  | { kind: 'error'; error: string }

export type CinematicClaimMutation =
  | { ok: true; claim: CinematicClaim }
  | { ok: false; error: string; conflict?: boolean }

function deterministicUuid(namespace: string, ...parts: string[]): string {
  const hex = createHash('sha256')
    .update([namespace, ...parts].join(':'))
    .digest('hex')
    .slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

export function cinematicClaimId(userId: string, generationId: string): string {
  return deterministicUuid('kineo:cinematic-submission:v1', userId, generationId)
}

export function validCinematicGenerationId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(value)
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`
}

export function cinematicValueHash(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex')
}

/** Hash the complete, normalized client intent before any paid provider call. */
export function cinematicRequestFingerprint(value: unknown): string {
  return cinematicValueHash(value)
}

function authorityPayload(input: CinematicClaimAuthority): string {
  return stableJson([
    'kineo-cinematic-authority-v1',
    input.claimId,
    input.userId,
    input.generationId,
    input.status,
    input.fingerprint,
    input.creditCost,
    input.quality,
    input.engine,
    input.falRequestIds,
    input.falModels,
    input.authorizedCompletedUrls,
    input.responseHash ?? '',
    input.resolutionReason ?? '',
    input.resolutionReference ?? '',
    CINEMATIC_CLAIM_PATH,
  ])
}

export function signCinematicClaim(secret: string, input: CinematicClaimAuthority): string {
  return createHmac('sha256', secret).update(authorityPayload(input)).digest('hex')
}

export function verifyCinematicClaim(
  secret: string,
  input: CinematicClaimAuthority,
  signature: unknown,
): boolean {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false
  const expected = signCinematicClaim(secret, input)
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}

function isHash(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value)
}

function validCreditCost(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 1000
}

function validQuality(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9_-]{2,80}$/i.test(value)
}

function validEngine(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 240 && /^[a-z0-9._:/-]+$/i.test(value)
}

function validRequestId(value: unknown): value is CinematicRequestId {
  return value === null || (typeof value === 'string' && value.length > 0 && value.length <= 512)
}

function validModel(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 300 && /^[a-z0-9._:/-]+$/i.test(value)
}

function validCompletedUrl(value: unknown): value is CinematicCompletedUrl {
  if (value === null) return true
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function claimAuthority(claim: CinematicClaim): CinematicClaimAuthority {
  return {
    claimId: claim.id,
    userId: claim.userId,
    generationId: claim.generationId,
    status: claim.status,
    fingerprint: claim.fingerprint,
    creditCost: claim.creditCost,
    quality: claim.quality,
    engine: claim.engine,
    falRequestIds: claim.falRequestIds,
    falModels: claim.falModels,
    authorizedCompletedUrls: claim.authorizedCompletedUrls,
    ...(claim.responseHash ? { responseHash: claim.responseHash } : {}),
    ...(claim.resolutionReason ? { resolutionReason: claim.resolutionReason } : {}),
    ...(claim.resolutionReference ? { resolutionReference: claim.resolutionReference } : {}),
  }
}

function sameArray<T>(left: T[], right: T[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function validResponseBinding(claim: CinematicClaim): boolean {
  if (!claim.response) return claim.responseHash === ''
  if (cinematicValueHash(claim.response) !== claim.responseHash) return false
  if (claim.response.generationId !== claim.generationId || claim.response.quality !== claim.quality) return false

  const responseIds = claim.response.fal_request_ids
  if (!Array.isArray(responseIds) || !responseIds.every(validRequestId)) return false
  if (!sameArray(responseIds, claim.falRequestIds)) return false

  const responseModels = claim.response.fal_models
  if (Array.isArray(responseModels)) {
    if (!responseModels.every(validModel) || !sameArray(responseModels, claim.falModels)) return false
  } else {
    const responseModel = claim.response.fal_model
    if (!validModel(responseModel)) return false
    if (!claim.falModels.every((model) => model === responseModel)) return false
  }
  return true
}

/**
 * Verify a raw events row against its deterministic owner/id/path and HMAC.
 * `userId` must come from the authenticated server session, never request JSON.
 */
export function verifyCinematicClaimRow(args: {
  row: unknown
  secret: string
  userId: string
  generationId: string
}): CinematicClaimValidation {
  if (!args.secret || !validCinematicGenerationId(args.generationId)) {
    return { ok: false, error: 'invalid claim verifier input' }
  }
  const row = args.row as CinematicClaimRow | null
  const expectedId = cinematicClaimId(args.userId, args.generationId)
  if (
    !row || row.id !== expectedId || row.name !== CINEMATIC_CLAIM_EVENT ||
    row.user_id !== args.userId || row.path !== CINEMATIC_CLAIM_PATH ||
    row.session_id !== args.generationId
  ) {
    return { ok: false, error: 'claim identity mismatch' }
  }

  const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
    ? row.metadata as Record<string, unknown>
    : null
  if (!metadata || metadata.generation_id !== args.generationId) {
    return { ok: false, error: 'claim metadata mismatch' }
  }

  const status: CinematicClaimStatus | null =
    metadata.status === 'pending' || metadata.status === 'done' ||
    metadata.status === 'settled' || metadata.status === 'released'
      ? metadata.status
      : null
  const fingerprint = metadata.fingerprint
  const creditCost = metadata.credit_cost
  const quality = metadata.quality
  const engine = metadata.engine
  const requestIds = metadata.fal_request_ids
  const models = metadata.fal_models
  const completedUrls = metadata.authorized_completed_urls
  const response = metadata.response && typeof metadata.response === 'object' && !Array.isArray(metadata.response)
    ? metadata.response as Record<string, unknown>
    : null
  const responseHash = stringValue(metadata.response_hash)
  const resolutionReason = stringValue(metadata.resolution_reason)
  const resolutionReference = stringValue(metadata.resolution_reference)

  if (
    !status || !isHash(fingerprint) || !validCreditCost(creditCost) ||
    !validQuality(quality) || !validEngine(engine) ||
    !Array.isArray(requestIds) || !requestIds.every(validRequestId) ||
    !Array.isArray(models) || !models.every(validModel) ||
    !Array.isArray(completedUrls) || !completedUrls.every(validCompletedUrl) ||
    requestIds.length !== models.length || requestIds.length !== completedUrls.length
  ) {
    return { ok: false, error: 'invalid claim authority fields' }
  }

  if (status === 'pending' && (requestIds.length !== 0 || response || responseHash)) {
    return { ok: false, error: 'pending claim contains provider output' }
  }
  if ((status === 'done' || status === 'settled') && (!response || !isHash(responseHash))) {
    return { ok: false, error: 'completed claim is missing its response' }
  }
  if (status === 'done' && (resolutionReason || resolutionReference)) {
    return { ok: false, error: 'unresolved claim contains a resolution' }
  }
  if ((status === 'settled' || status === 'released') && !resolutionReason) {
    return { ok: false, error: 'resolved claim is missing its reason' }
  }
  if (status === 'released' && ((response && !isHash(responseHash)) || (!response && responseHash))) {
    return { ok: false, error: 'released claim response is incomplete' }
  }

  const claim: CinematicClaim = {
    id: expectedId,
    userId: args.userId,
    generationId: args.generationId,
    status,
    fingerprint,
    creditCost,
    quality,
    engine,
    falRequestIds: requestIds,
    falModels: models,
    authorizedCompletedUrls: completedUrls,
    response,
    responseHash,
    resolutionReason,
    resolutionReference,
    startedAt: stringValue(metadata.started_at) || stringValue(row.created_at),
    completedAt: stringValue(metadata.completed_at),
    resolvedAt: stringValue(metadata.resolved_at),
    authority: stringValue(metadata.authority),
  }
  if (!verifyCinematicClaim(args.secret, claimAuthority(claim), claim.authority)) {
    return { ok: false, error: 'invalid claim signature' }
  }
  if (!validResponseBinding(claim)) {
    return { ok: false, error: 'claim response/provider binding mismatch' }
  }
  return { ok: true, claim }
}

export async function loadVerifiedCinematicClaim(args: {
  db: SupabaseClient
  secret: string
  userId: string
  generationId: string
}): Promise<CinematicClaimLoad> {
  if (!validCinematicGenerationId(args.generationId)) {
    return { ok: false, error: 'invalid generation id' }
  }
  const claimId = cinematicClaimId(args.userId, args.generationId)
  const { data, error } = await args.db
    .from('events')
    .select('id,name,user_id,path,session_id,metadata,created_at')
    .eq('id', claimId)
    .eq('user_id', args.userId)
    .eq('name', CINEMATIC_CLAIM_EVENT)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: true, claim: null }
  return verifyCinematicClaimRow({ ...args, row: data })
}

/** Resolve an upstream-debited cinematic birth claim from the signed Compose
 * claim that owns a final render id. Used by compose/status to skip a second
 * debit without trusting query params or mutable client state. */
export async function loadSettledCinematicClaimForRender(args: {
  db: SupabaseClient
  secret: string
  userId: string
  renderId: string
}): Promise<CinematicRenderClaimLoad> {
  if (!args.renderId) return { ok: true, claim: null }
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
  const cost = typeof metadata.cost === 'number' && Number.isInteger(metadata.cost)
    ? metadata.cost
    : null
  const composeId = typeof compose.id === 'string' ? compose.id : ''
  if (
    !validComposeGenerationId(generationId) || !quality || cost === null || cost <= 0 ||
    composeId !== composeClaimId(args.userId, generationId) ||
    compose.name !== COMPOSE_CLAIM_EVENT || compose.user_id !== args.userId ||
    compose.path !== COMPOSE_CLAIM_PATH || metadata.generation_id !== generationId ||
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
    return { ok: false, error: 'invalid compose claim for cinematic render' }
  }

  const birth = await loadVerifiedCinematicClaim({
    db: args.db,
    secret: args.secret,
    userId: args.userId,
    generationId,
  })
  if (!birth.ok) return birth
  if (!birth.claim) return { ok: true, claim: null }
  const isDebited =
    birth.claim.status === 'settled' &&
    birth.claim.resolutionReason === 'provider_submitted_and_debited'
  const isRefunded =
    birth.claim.status === 'released' &&
    /^provider_(all_failed|failed)_refunded$/.test(birth.claim.resolutionReason)
  if (
    (!isDebited && !isRefunded) || birth.claim.quality !== quality ||
    birth.claim.creditCost !== cost ||
    !birth.claim.resolutionReference.startsWith('cinematic-')
  ) {
    return { ok: false, error: 'cinematic birth/compose billing mismatch' }
  }
  return { ok: true, claim: birth.claim }
}

function metadataForClaim(claim: CinematicClaim): Record<string, unknown> {
  return {
    generation_id: claim.generationId,
    status: claim.status,
    fingerprint: claim.fingerprint,
    credit_cost: claim.creditCost,
    quality: claim.quality,
    engine: claim.engine,
    fal_request_ids: claim.falRequestIds,
    fal_models: claim.falModels,
    authorized_completed_urls: claim.authorizedCompletedUrls,
    ...(claim.response ? { response: claim.response, response_hash: claim.responseHash } : {}),
    ...(claim.resolutionReason ? { resolution_reason: claim.resolutionReason } : {}),
    ...(claim.resolutionReference ? { resolution_reference: claim.resolutionReference } : {}),
    started_at: claim.startedAt,
    ...(claim.completedAt ? { completed_at: claim.completedAt } : {}),
    ...(claim.resolvedAt ? { resolved_at: claim.resolvedAt } : {}),
    authority: claim.authority,
  }
}

function withSignature(secret: string, claim: Omit<CinematicClaim, 'authority'>): CinematicClaim {
  const unsigned = { ...claim, authority: '' }
  return { ...unsigned, authority: signCinematicClaim(secret, claimAuthority(unsigned)) }
}

function sameIntent(
  claim: CinematicClaim,
  input: { fingerprint: string; creditCost: number; quality: string; engine: string },
): boolean {
  return claim.fingerprint === input.fingerprint && claim.creditCost === input.creditCost &&
    claim.quality === input.quality && claim.engine === input.engine
}

export async function acquireCinematicClaim(args: {
  db: SupabaseClient
  secret: string
  userId: string
  generationId: string
  fingerprint: string
  creditCost: number
  quality: string
  engine: string
}): Promise<CinematicClaimAcquire> {
  if (
    !args.secret || !validCinematicGenerationId(args.generationId) || !isHash(args.fingerprint) ||
    !validCreditCost(args.creditCost) || !validQuality(args.quality) || !validEngine(args.engine)
  ) {
    return { kind: 'error', error: 'invalid cinematic claim input' }
  }

  const now = new Date().toISOString()
  const claim = withSignature(args.secret, {
    id: cinematicClaimId(args.userId, args.generationId),
    userId: args.userId,
    generationId: args.generationId,
    status: 'pending',
    fingerprint: args.fingerprint,
    creditCost: args.creditCost,
    quality: args.quality,
    engine: args.engine,
    falRequestIds: [],
    falModels: [],
    authorizedCompletedUrls: [],
    response: null,
    responseHash: '',
    resolutionReason: '',
    resolutionReference: '',
    startedAt: now,
    completedAt: '',
    resolvedAt: '',
  })
  const { data, error } = await args.db.from('events').insert({
    id: claim.id,
    user_id: args.userId,
    name: CINEMATIC_CLAIM_EVENT,
    path: CINEMATIC_CLAIM_PATH,
    session_id: args.generationId,
    metadata: metadataForClaim(claim),
  }).select('id,name,user_id,path,session_id,metadata,created_at').maybeSingle()

  if (!error && data) {
    const verified = verifyCinematicClaimRow({ ...args, row: data })
    return verified.ok
      ? { kind: 'acquired', claim: verified.claim }
      : { kind: 'error', error: verified.error }
  }
  if (!error || (error as { code?: string }).code !== '23505') {
    return { kind: 'error', error: error?.message ?? 'claim insert returned no row' }
  }

  const existing = await loadVerifiedCinematicClaim(args)
  if (!existing.ok) return { kind: 'error', error: existing.error }
  if (!existing.claim) return { kind: 'error', error: 'duplicate claim could not be loaded' }
  if (!sameIntent(existing.claim, args)) {
    return { kind: 'conflict', error: 'generation id belongs to a different cinematic request' }
  }
  if (existing.claim.status === 'pending') return { kind: 'pending', claim: existing.claim }
  if (existing.claim.status === 'released') return { kind: 'released', claim: existing.claim }
  if (!existing.claim.response) return { kind: 'error', error: 'replay response is unavailable' }
  return { kind: 'replay', claim: existing.claim, response: existing.claim.response }
}

function normalizeResponse(value: Record<string, unknown>): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(JSON.stringify(value))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

async function updateClaim(args: {
  db: SupabaseClient
  secret: string
  previous: CinematicClaim
  next: CinematicClaim
}): Promise<CinematicClaimMutation> {
  const { data, error } = await args.db
    .from('events')
    .update({ metadata: metadataForClaim(args.next) })
    .eq('id', args.previous.id)
    .eq('user_id', args.previous.userId)
    .eq('name', CINEMATIC_CLAIM_EVENT)
    .eq('metadata->>authority', args.previous.authority)
    .select('id,name,user_id,path,session_id,metadata,created_at')
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'claim changed concurrently', conflict: true }
  const verified = verifyCinematicClaimRow({
    row: data,
    secret: args.secret,
    userId: args.previous.userId,
    generationId: args.previous.generationId,
  })
  return verified.ok ? verified : { ok: false, error: verified.error }
}

export async function completeCinematicClaim(args: {
  db: SupabaseClient
  secret: string
  userId: string
  generationId: string
  fingerprint: string
  creditCost: number
  quality: string
  engine: string
  response: Record<string, unknown>
  falRequestIds: CinematicRequestId[]
  falModels: string[]
  authorizedCompletedUrls?: CinematicCompletedUrl[]
}): Promise<CinematicClaimMutation> {
  const loaded = await loadVerifiedCinematicClaim(args)
  if (!loaded.ok || !loaded.claim) return { ok: false, error: loaded.ok ? 'claim not found' : loaded.error }
  const current = loaded.claim
  if (!sameIntent(current, args)) return { ok: false, error: 'claim intent mismatch', conflict: true }
  if (
    !args.falRequestIds.every(validRequestId) || !args.falModels.every(validModel) ||
    args.falRequestIds.length !== args.falModels.length || !args.falRequestIds.some(Boolean)
  ) {
    return { ok: false, error: 'invalid provider binding' }
  }
  const completedUrls = args.authorizedCompletedUrls ?? args.falRequestIds.map(() => null)
  if (completedUrls.length !== args.falRequestIds.length || !completedUrls.every(validCompletedUrl)) {
    return { ok: false, error: 'invalid completed URL binding' }
  }
  const response = normalizeResponse(args.response)
  if (!response) return { ok: false, error: 'response is not JSON serializable' }
  const responseHash = cinematicValueHash(response)

  const candidate = withSignature(args.secret, {
    ...current,
    status: 'done',
    falRequestIds: [...args.falRequestIds],
    falModels: [...args.falModels],
    authorizedCompletedUrls: [...completedUrls],
    response,
    responseHash,
    resolutionReason: '',
    resolutionReference: '',
    completedAt: current.completedAt || new Date().toISOString(),
    resolvedAt: '',
  })
  if (!validResponseBinding(candidate)) return { ok: false, error: 'response does not match provider binding' }

  if (current.status !== 'pending') {
    const idempotent = (current.status === 'done' || current.status === 'settled') &&
      current.responseHash === responseHash && sameArray(current.falRequestIds, args.falRequestIds) &&
      sameArray(current.falModels, args.falModels)
    return idempotent
      ? { ok: true, claim: current }
      : { ok: false, error: `cannot complete ${current.status} claim`, conflict: true }
  }
  return updateClaim({ db: args.db, secret: args.secret, previous: current, next: candidate })
}

/**
 * Bind provider-completed URLs to their signed request id/model slots. Once a
 * slot is authorized, it cannot be changed to a different URL.
 */
export async function authorizeCinematicCompletedUrls(args: {
  db: SupabaseClient
  secret: string
  userId: string
  generationId: string
  completed: Array<{ requestId: string; model?: string; url: string }>
}): Promise<CinematicClaimMutation> {
  const loaded = await loadVerifiedCinematicClaim(args)
  if (!loaded.ok || !loaded.claim) return { ok: false, error: loaded.ok ? 'claim not found' : loaded.error }
  const current = loaded.claim
  if (current.status !== 'done' && current.status !== 'settled') {
    return { ok: false, error: `cannot authorize URLs for ${current.status} claim`, conflict: true }
  }
  const urls = [...current.authorizedCompletedUrls]
  for (const completed of args.completed) {
    if (!validCompletedUrl(completed.url) || !completed.url) return { ok: false, error: 'invalid completed URL' }
    const indexes = current.falRequestIds
      .map((requestId, index) => requestId === completed.requestId ? index : -1)
      .filter((index) => index >= 0)
    if (indexes.length !== 1) return { ok: false, error: 'request id is not uniquely authorized', conflict: true }
    const index = indexes[0]
    if (completed.model && completed.model !== current.falModels[index]) {
      return { ok: false, error: 'request model mismatch', conflict: true }
    }
    if (urls[index] && urls[index] !== completed.url) {
      return { ok: false, error: 'completed URL is already bound', conflict: true }
    }
    urls[index] = completed.url
  }
  if (sameArray(urls, current.authorizedCompletedUrls)) return { ok: true, claim: current }
  const next = withSignature(args.secret, { ...current, authorizedCompletedUrls: urls })
  return updateClaim({ db: args.db, secret: args.secret, previous: current, next })
}

export async function settleCinematicClaim(args: {
  db: SupabaseClient
  secret: string
  userId: string
  generationId: string
  reason: string
  renderId: string
}): Promise<CinematicClaimMutation> {
  const loaded = await loadVerifiedCinematicClaim(args)
  if (!loaded.ok || !loaded.claim) return { ok: false, error: loaded.ok ? 'claim not found' : loaded.error }
  const current = loaded.claim
  const reason = args.reason.trim().slice(0, 160)
  const renderId = args.renderId.trim().slice(0, 200)
  if (!reason || !renderId) return { ok: false, error: 'settlement reason and render id are required' }
  if (current.status === 'settled') {
    return current.resolutionReason === reason && current.resolutionReference === renderId
      ? { ok: true, claim: current }
      : { ok: false, error: 'claim was settled differently', conflict: true }
  }
  if (current.status !== 'done') {
    return { ok: false, error: `cannot settle ${current.status} claim`, conflict: true }
  }
  const next = withSignature(args.secret, {
    ...current,
    status: 'settled',
    resolutionReason: reason,
    resolutionReference: renderId,
    resolvedAt: new Date().toISOString(),
  })
  return updateClaim({ db: args.db, secret: args.secret, previous: current, next })
}

export async function releaseCinematicClaim(args: {
  db: SupabaseClient
  secret: string
  userId: string
  generationId: string
  reason: string
  reference?: string
}): Promise<CinematicClaimMutation> {
  const loaded = await loadVerifiedCinematicClaim(args)
  if (!loaded.ok || !loaded.claim) return { ok: false, error: loaded.ok ? 'claim not found' : loaded.error }
  const current = loaded.claim
  const reason = args.reason.trim().slice(0, 160)
  const reference = (args.reference ?? '').trim().slice(0, 200)
  if (!reason) return { ok: false, error: 'release reason is required' }
  if (current.status === 'released') {
    return current.resolutionReason === reason && current.resolutionReference === reference
      ? { ok: true, claim: current }
      : { ok: false, error: 'claim was released differently', conflict: true }
  }
  if (current.status === 'settled') {
    // A provider can still fail every queued clip after the deterministic
    // upfront debit. The status route refunds that exact billing reference
    // first, then records the terminal released state here.
    if (!/^provider_(all_failed|failed)_refunded$/.test(reason) || reference !== current.resolutionReference) {
      return { ok: false, error: 'settled claim can only be released after its provider debit is refunded', conflict: true }
    }
  }
  const next = withSignature(args.secret, {
    ...current,
    status: 'released',
    resolutionReason: reason,
    resolutionReference: reference,
    resolvedAt: new Date().toISOString(),
  })
  return updateClaim({ db: args.db, secret: args.secret, previous: current, next })
}
