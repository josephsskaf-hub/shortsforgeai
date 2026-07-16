import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const COMPOSE_CLAIM_EVENT = 'compose_submission_claim'
export const COMPOSE_CLAIM_PATH = '/api/compose'

export function composeClaimId(userId: string, generationId: string): string {
  const hex = createHash('sha256')
    .update(`kineo:compose-submission:v1:${userId}:${generationId}`)
    .digest('hex')
    .slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

export function validComposeGenerationId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(value)
}

export interface ComposeClaimAuthority {
  claimId: string
  userId: string
  generationId: string
  status: 'pending' | 'done'
  renderId?: string
  quality: string
  cost: number
}

function composeClaimAuthorityPayload(input: ComposeClaimAuthority): string {
  return JSON.stringify([
    'kineo-compose-authority-v1',
    input.claimId,
    input.userId,
    input.generationId,
    input.status,
    input.renderId ?? '',
    input.quality,
    input.cost,
    COMPOSE_CLAIM_PATH,
  ])
}

export function signComposeClaim(secret: string, input: ComposeClaimAuthority): string {
  return createHmac('sha256', secret).update(composeClaimAuthorityPayload(input)).digest('hex')
}

export function verifyComposeClaim(secret: string, input: ComposeClaimAuthority, signature: unknown): boolean {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) return false
  const expected = signComposeClaim(secret, input)
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}
