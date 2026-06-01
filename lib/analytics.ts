// Push #061 — shared client-side event tracking helper.
//
// `trackEvent` is fire-and-forget: it posts to /api/events but never
// awaits the response and never throws. Callers should NOT `await` it —
// just call it inline before navigation or alongside state changes.

// #377 — UTM / gclid first-touch preservation. Capture attribution params into
// sessionStorage so they survive the whole funnel (landing → signup → generate
// → checkout → success), even after the OAuth/login hop. Every tracked event
// then carries them for internal funnel attribution back to the Google Ads click.
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'ref'] as const

export function captureUtmsOnce(): void {
  if (typeof window === 'undefined') return
  try {
    const sp = new URLSearchParams(window.location.search)
    if (!UTM_KEYS.some((k) => sp.get(k))) return
    if (sessionStorage.getItem('sfa_utms')) return // first-touch wins
    const utms: Record<string, string> = {}
    UTM_KEYS.forEach((k) => {
      const v = sp.get(k)
      if (v) utms[k] = v
    })
    sessionStorage.setItem('sfa_utms', JSON.stringify(utms))
  } catch {
    /* sessionStorage may be unavailable — never break the page */
  }
}

function storedUtms(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(sessionStorage.getItem('sfa_utms') || '{}')
  } catch {
    return {}
  }
}

export async function trackEvent(
  event_name: string,
  metadata?: Record<string, unknown>,
  path?: string,
): Promise<void> {
  try {
    captureUtmsOnce()
    const body = JSON.stringify({
      event_name,
      // keep `name` for backward compat with Push #060 server logic
      name: event_name,
      metadata: { ...storedUtms(), ...(metadata ?? {}) },
      path: path ?? (typeof window !== 'undefined' ? window.location?.pathname : undefined),
    })
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    })
  } catch {
    // silent — analytics must never break the calling page
  }
}
