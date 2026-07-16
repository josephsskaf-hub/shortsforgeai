// PUSH #29 — one canonical public-video share URL. The done screen and
// My Videos must never drift on referral or attribution parameters.

export const PUBLIC_VIDEO_SHARE_VERSION = 'push29_share_delivery'

const REFERRAL_CODE = /^[A-HJ-NP-Z2-9]{8}$/

export function buildPublicVideoSharePath(
  videoId: string | null | undefined,
  referralCode?: string | null,
): string | null {
  const id = (videoId ?? '').trim()
  if (!id) return null

  const query = new URLSearchParams({
    utm_source: 'kineo_user',
    utm_medium: 'video_share',
    utm_campaign: 'referral',
    utm_content: PUBLIC_VIDEO_SHARE_VERSION,
  })
  const referral = (referralCode ?? '').trim().toUpperCase()
  if (REFERRAL_CODE.test(referral)) query.set('ref', referral)

  return `/v/${encodeURIComponent(id)}?${query.toString()}`
}
