import crypto from 'crypto'

// Push #427 — minimal Web Push sender (payload-less, VAPID-signed).
//
// Why no `web-push` dependency: payload-less pushes skip the RFC 8291
// encryption entirely — the service worker (public/sw.js) carries the
// notification text. All we need is an ES256-signed VAPID JWT in the
// Authorization header and an empty POST to the subscription endpoint.
// Zero new dependencies, zero lockfile churn, works with FCM/Mozilla/Apple.
//
// Keys: the PUBLIC key is hardcoded below (it is public by design — it also
// ships to every browser). The PRIVATE key lives only in the
// VAPID_PRIVATE_KEY env var (base64url "d" scalar, P-256).

export const VAPID_PUBLIC_KEY =
  'BGOZTjCZhKc3qWvh18exh1bus37T9KsoqzUTDH4ZaDyp9j54ItfzTr9VEZKv_8uoCGxuCRhT-rt-j1KDOKHpe9k'

const VAPID_SUBJECT = 'mailto:support@usekineo.com'

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function getPrivateKey(): crypto.KeyObject | null {
  const d = process.env.VAPID_PRIVATE_KEY
  if (!d) return null
  try {
    const pub = Buffer.from(VAPID_PUBLIC_KEY, 'base64url')
    // Uncompressed point: 0x04 || X(32) || Y(32)
    const x = b64url(pub.subarray(1, 33))
    const y = b64url(pub.subarray(33, 65))
    return crypto.createPrivateKey({
      key: { kty: 'EC', crv: 'P-256', d, x, y },
      format: 'jwk',
    })
  } catch (e) {
    console.error('[push] invalid VAPID_PRIVATE_KEY:', e)
    return null
  }
}

function vapidHeaders(endpoint: string): Record<string, string> | null {
  const key = getPrivateKey()
  if (!key) return null
  const { origin } = new URL(endpoint)
  const header = b64url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = b64url(
    Buffer.from(
      JSON.stringify({
        aud: origin,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: VAPID_SUBJECT,
      })
    )
  )
  const unsigned = `${header}.${payload}`
  const signature = crypto.sign('sha256', Buffer.from(unsigned), {
    key,
    dsaEncoding: 'ieee-p1363',
  })
  const jwt = `${unsigned}.${b64url(signature)}`
  return {
    Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
    TTL: '86400',
    Urgency: 'high',
  }
}

export interface PushSubscriptionRow {
  endpoint: string
}

export interface PushSendResult {
  sent: number
  gone: string[] // endpoints that returned 404/410 — caller should delete them
}

/**
 * Sends a payload-less push to each subscription endpoint. Returns which
 * endpoints are dead (unsubscribed/expired) so the caller can prune them.
 * Never throws — push is always best-effort.
 */
export async function sendPushToSubscriptions(
  subs: PushSubscriptionRow[]
): Promise<PushSendResult> {
  const result: PushSendResult = { sent: 0, gone: [] }
  if (!process.env.VAPID_PRIVATE_KEY || subs.length === 0) return result

  await Promise.all(
    subs.map(async (s) => {
      try {
        const headers = vapidHeaders(s.endpoint)
        if (!headers) return
        const res = await fetch(s.endpoint, { method: 'POST', headers })
        if (res.ok || res.status === 201) {
          result.sent++
        } else if (res.status === 404 || res.status === 410) {
          result.gone.push(s.endpoint)
        } else {
          console.warn('[push] endpoint returned', res.status, s.endpoint.slice(0, 60))
        }
      } catch (e) {
        console.warn('[push] send failed:', e instanceof Error ? e.message : String(e))
      }
    })
  )
  return result
}
