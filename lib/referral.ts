// Referral loop — client-side capture helpers.
//
// captureRefOnce() reads `?ref=` from the URL on landing and stores it in
// localStorage under 'sf_ref' (first-touch wins — never overwritten). After
// the user signs up and reaches the dashboard, getStoredRef() reads it so the
// referral can be attributed, then clearStoredRef() removes it.
//
// All helpers are SSR-safe (guard `window`) and never throw — a storage
// failure can never break the page. Mirrors the style of lib/analytics.ts.

const REF_KEY = 'sf_ref'
const REFERRAL_CODE = /^[A-HJ-NP-Z2-9]{8}$/

export function captureRefOnce(): void {
  if (typeof window === 'undefined') return
  try {
    const raw = new URLSearchParams(window.location.search).get('ref')
    const ref = (raw ?? '').trim().toUpperCase()
    if (!REFERRAL_CODE.test(ref)) return
    const existing = (localStorage.getItem(REF_KEY) ?? '').trim().toUpperCase()
    if (REFERRAL_CODE.test(existing)) return // valid first-touch wins
    localStorage.setItem(REF_KEY, ref)
  } catch {
    /* localStorage may be unavailable — never break the page */
  }
}

export function getStoredRef(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = (localStorage.getItem(REF_KEY) ?? '').trim().toUpperCase()
    if (REFERRAL_CODE.test(v)) return v
    if (v) localStorage.removeItem(REF_KEY)
    return null
  } catch {
    return null
  }
}

export function clearStoredRef(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(REF_KEY)
  } catch {
    /* ignore */
  }
}
