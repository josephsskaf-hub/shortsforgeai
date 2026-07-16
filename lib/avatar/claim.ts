import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const AVATAR_CLAIM_EVENT = 'avatar_submission_claim'
export const AVATAR_CLAIM_PATH = '/api/generate-avatar'

function deterministicUuid(namespace: string, ...parts: string[]): string {
  const hex = createHash('sha256')
    .update([namespace, ...parts].join(':'))
    .digest('hex')
    .slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

export function avatarClaimId(userId: string, generationId: string): string {
  return deterministicUuid('kineo:avatar-submission:v1', userId, generationId)
}

export function avatarReservationId(userId: string, generationId: string): string {
  return deterministicUuid('kineo:avatar-reservation:v1', userId, generationId)
}

export function validAvatarGenerationId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(value)
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

export function avatarValueHash(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex')
}

export interface AvatarClaimAuthority {
  claimId: string
  userId: string
  generationId: string
  status: 'pending' | 'done' | 'settled'
  fingerprint: string
  creditCost: number
  responseHash?: string
}

function authorityPayload(input: AvatarClaimAuthority): string {
  return JSON.stringify([
    'kineo-avatar-authority-v1',
    input.claimId,
    input.userId,
    input.generationId,
    input.status,
    input.fingerprint,
    input.creditCost,
    input.responseHash ?? '',
    AVATAR_CLAIM_PATH,
  ])
}

export function signAvatarClaim(secret: string, input: AvatarClaimAuthority): string {
  return createHmac('sha256', secret).update(authorityPayload(input)).digest('hex')
}

export function verifyAvatarClaim(
  secret: string,
  input: AvatarClaimAuthority,
  signature: unknown,
): boolean {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false
  const expected = signAvatarClaim(secret, input)
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}
