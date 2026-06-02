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

// #383 — persist first-touch signup attribution to the user's profile row so
// we can measure how much of the US Ads spend becomes a real signup.
// Sends the first-touch gclid + utm_source (from sessionStorage); the server
// route adds signup_country from Vercel's IP header and only fills columns that
// are still null (first-touch wins — never overwritten).
//
// Robust across ANY signup flow: call this at every authenticated entry point
// (signup-success, OAuth landing, first login after email confirmation, app
// mount). It de-dupes itself per browser session, but ONLY marks itself done
// once the server confirms a real session processed it (ok:true). If there was
// no session yet (e.g. email-confirmation pending), it does NOT mark done, so a
// later login will retry and finally record the attribution.
//
// Fire-and-forget: NEVER awaited by callers, NEVER throws — a failure here can
// never block or break signup or login.
export function trackSignupSource(): void {
  if (typeof window === 'undefined') return
  try {
    // Already recorded with a real session this browser session — skip.
    if (sessionStorage.getItem('sfa_src_sent') === '1') return
    const utms = storedUtms()
    fetch('/api/track-signup-source', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gclid: utms.gclid || null,
        utm_source: utms.utm_source || null,
      }),
      keepalive: true,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        // Only stop retrying once a real session processed it. ok:false
        // (no-session) leaves the flag unset so a later login retries.
        if (res && res.ok) {
          try {
            sessionStorage.setItem('sfa_src_sent', '1')
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {
        /* silent — attribution must never break the flow */
      })
  } catch {
    /* silent — attribution must never break the flow */
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
