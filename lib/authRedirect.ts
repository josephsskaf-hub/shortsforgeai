const AUTH_REDIRECT_BASE = 'https://kineo.local'

/**
 * Normalize a post-auth destination while guaranteeing it remains an
 * application-relative URL. URL parsing is intentional: simple startsWith
 * checks accept values such as `/\\evil.example`, which browsers can interpret
 * as a protocol-relative external URL.
 */
export function normalizeInternalRedirect(
  raw: string | null | undefined
): string | null {
  if (!raw) return null

  const candidate = raw.trim()
  if (
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    /[\u0000-\u001F\u007F]/.test(candidate)
  ) {
    return null
  }

  try {
    const parsed = new URL(candidate, AUTH_REDIRECT_BASE)
    if (parsed.origin !== AUTH_REDIRECT_BASE) return null

    const destination = `${parsed.pathname}${parsed.search}${parsed.hash}`
    if (!destination.startsWith('/') || destination.startsWith('//')) return null
    return destination
  } catch {
    return null
  }
}

export function resolveAuthRedirect(
  raw: string | null | undefined,
  fallback = '/generate'
): string {
  return normalizeInternalRedirect(raw) ?? fallback
}
