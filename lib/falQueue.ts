/**
 * A paid Fal queue submission must be sent exactly once. The SDK may retry
 * POSTs after a transport/gateway failure even though Fal accepted the first
 * request, which can create duplicate billable jobs. This helper deliberately
 * performs one raw POST and tells durable callers whether a failure is
 * ambiguous (the job may exist) or an explicit rejection (safe to close).
 */
export class FalQueueSubmitError extends Error {
  readonly ambiguous: boolean
  readonly status: number | null
  readonly providerBody: unknown

  constructor(message: string, options: {
    ambiguous: boolean
    status?: number | null
    providerBody?: unknown
    cause?: unknown
  }) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'FalQueueSubmitError'
    this.ambiguous = options.ambiguous
    this.status = options.status ?? null
    this.providerBody = options.providerBody
  }
}

export async function submitFalQueueOnce(
  model: string,
  input: Record<string, unknown>,
): Promise<string> {
  const key = process.env.FAL_KEY
  if (!key) {
    throw new FalQueueSubmitError('FAL_KEY is not configured', { ambiguous: false })
  }

  let response: Response
  try {
    response = await fetch(`https://queue.fal.run/${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${key}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
      cache: 'no-store',
    })
  } catch (error) {
    throw new FalQueueSubmitError('Fal queue submit transport failed', {
      ambiguous: true,
      cause: error,
    })
  }

  const raw = await response.text().catch(() => '')
  let payload: Record<string, unknown> = {}
  try {
    payload = raw ? JSON.parse(raw) as Record<string, unknown> : {}
  } catch {
    payload = {}
  }

  if (!response.ok) {
    const detail = typeof payload.detail === 'string'
      ? payload.detail
      : typeof payload.error === 'string'
        ? payload.error
        : raw.slice(0, 300)
    const ambiguous = response.status === 408 || response.status >= 500
    throw new FalQueueSubmitError(
      `Fal queue rejected submit (${response.status})${detail ? `: ${detail}` : ''}`,
      {
        ambiguous,
        status: response.status,
        providerBody: payload,
      },
    )
  }

  const requestId = typeof payload.request_id === 'string' ? payload.request_id.trim() : ''
  if (!requestId) {
    throw new FalQueueSubmitError('Fal queue response had no request id', {
      ambiguous: true,
      status: response.status,
      providerBody: payload,
    })
  }
  return requestId
}
