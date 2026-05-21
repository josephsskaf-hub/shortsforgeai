// Push #061 — shared client-side event tracking helper.
//
// `trackEvent` is fire-and-forget: it posts to /api/events but never
// awaits the response and never throws. Callers should NOT `await` it —
// just call it inline before navigation or alongside state changes.

export async function trackEvent(
  event_name: string,
  metadata?: Record<string, unknown>,
  path?: string,
): Promise<void> {
  try {
    const body = JSON.stringify({
      event_name,
      // keep `name` for backward compat with Push #060 server logic
      name: event_name,
      metadata: metadata ?? {},
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
