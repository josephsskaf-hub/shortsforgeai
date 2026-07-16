// PUSH #26 — one canonical acquisition-source policy for capture, persistence
// and reporting. OAuth/payment returns are navigation infrastructure, not the
// page that acquired the user, so they must never become first-touch sources.

const OWN_HOSTS = new Set([
  'usekineo.com',
  'www.usekineo.com',
  'shortsforgeai.com',
  'www.shortsforgeai.com',
  'shortsforgeai.vercel.app',
])

const NON_ACQUISITION_HOSTS = new Set([
  'accounts.google.com',
  'checkout.stripe.com',
])

function cleanHostname(value: string): string {
  return value.trim().replace(/^www\./, '').replace(/\.$/, '').toLowerCase()
}

function parsedReferrer(value: string | null | undefined): URL | null {
  const raw = (value ?? '').trim()
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    if (!['http:', 'https:', 'android-app:'].includes(parsed.protocol)) return null
    return parsed
  } catch {
    return null
  }
}

export function isNonAcquisitionHost(
  hostname: string | null | undefined,
  currentHostname?: string | null,
): boolean {
  const host = cleanHostname(hostname ?? '')
  if (!host) return true

  const current = cleanHostname(currentHostname ?? '')
  if (current && (host === current || host.endsWith(`.${current}`) || current.endsWith(`.${host}`))) {
    return true
  }

  return OWN_HOSTS.has(host) ||
    NON_ACQUISITION_HOSTS.has(host) ||
    host.endsWith('.supabase.co')
}

export function sanitizeAcquisitionReferrer(
  value: string | null | undefined,
  currentHostname?: string | null,
): string | null {
  const parsed = parsedReferrer(value)
  if (!parsed || isNonAcquisitionHost(parsed.hostname, currentHostname)) return null
  return parsed.toString().slice(0, 300)
}

function sourceFromHost(hostname: string): string | null {
  const host = cleanHostname(hostname)
  if (!host || isNonAcquisitionHost(host)) return null

  if (host === 'theresanaiforthat.com' || host.endsWith('.theresanaiforthat.com')) return 'taaft'
  if (host === 'google.com' || host.endsWith('.google.com') || host === 'com.google.android.googlequicksearchbox') return 'google'
  if (host === 'com.google.android.gm') return 'gmail'
  if (host === 'keep.google.com') return 'google-keep'
  if (host === 'chatgpt.com') return 'chatgpt'
  return host
}

export function sanitizeAcquisitionUtmSource(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim().toLowerCase()
  if (!raw) return null

  // Be tolerant of a full URL accidentally sent as utm_source, but apply the
  // same infrastructure/self-referral filter as a normal referrer.
  const asUrl = parsedReferrer(raw)
  if (asUrl) return sourceFromHost(asUrl.hostname)

  const token = cleanHostname(raw).slice(0, 80)
  if (!token || isNonAcquisitionHost(token)) return null
  if (token === 'taaft' || token === 'theresanaiforthat.com' || token.endsWith('.theresanaiforthat.com')) return 'taaft'
  if (token === 'google' || token === 'google.com' || token === 'com.google.android.googlequicksearchbox') return 'google'
  if (token === 'gmail' || token === 'com.google.android.gm') return 'gmail'
  if (token === 'chatgpt' || token === 'chatgpt.com') return 'chatgpt'
  return token
}

export function acquisitionSource(input: {
  utmSource?: string | null
  legacyUtmSource?: string | null
  referrer?: string | null
}): string {
  const explicit = sanitizeAcquisitionUtmSource(input.utmSource) ||
    sanitizeAcquisitionUtmSource(input.legacyUtmSource)
  if (explicit) return explicit

  const referrer = sanitizeAcquisitionReferrer(input.referrer)
  if (!referrer) return 'direct'
  const parsed = parsedReferrer(referrer)
  return parsed ? (sourceFromHost(parsed.hostname) ?? 'direct') : 'direct'
}

export function hasCorrectableSelfReferral(value: string | null | undefined): boolean {
  const parsed = parsedReferrer(value)
  return Boolean(parsed && isNonAcquisitionHost(parsed.hostname))
}
