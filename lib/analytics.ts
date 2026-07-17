import { sanitizeAcquisitionReferrer, sanitizeAcquisitionUtmSource } from '@/lib/acquisitionSource'

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
const EVENT_SESSION_KEY = 'kineo_event_session_id'

function syncEventSessionCookie(sessionId: string): void {
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${EVENT_SESSION_KEY}=${encodeURIComponent(sessionId)}; Path=/; SameSite=Lax${secure}`
  } catch {
    // Cookie blocking must never affect product analytics or navigation.
  }
}

function eventSessionId(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const existing = sessionStorage.getItem(EVENT_SESSION_KEY)
    if (existing) {
      const normalized = existing.slice(0, 64)
      syncEventSessionCookie(normalized)
      return normalized
    }
    const created = typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 18)}`
    sessionStorage.setItem(EVENT_SESSION_KEY, created)
    syncEventSessionCookie(created)
    return created
  } catch {
    return undefined
  }
}

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

// PUSH #32 — remember the high-intent page that handed a visitor to signup
// without rewriting their real first-touch acquisition source. Internal UTMs
// would turn a Google/TAAFT/referral visit into a false `seo` source, so this
// campaign marker travels separately and is only used when the true source did
// not already provide a campaign.
const SIGNUP_CAMPAIGN_KEY = 'kineo_signup_campaign'
const SIGNUP_CAMPAIGN_TTL_MS = 24 * 60 * 60 * 1000

type StoredSignupCampaign = {
  campaign: string
  capturedAt: number
}

function cleanSignupCampaign(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const campaign = value.trim()
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(campaign) ? campaign : null
}

function parseSignupCampaign(raw: string | null): string | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSignupCampaign>
    const campaign = cleanSignupCampaign(parsed.campaign)
    if (!campaign || typeof parsed.capturedAt !== 'number') return null
    if (Date.now() - parsed.capturedAt > SIGNUP_CAMPAIGN_TTL_MS) return null
    return campaign
  } catch {
    return null
  }
}

function signupCampaignCookie(): string | null {
  if (typeof document === 'undefined') return null
  try {
    const match = document.cookie.match(/(?:^|;\s*)kineo_signup_campaign=([^;]+)/)
    return parseSignupCampaign(match ? decodeURIComponent(match[1]) : null)
  } catch {
    return null
  }
}

function storedSignupCampaign(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const fromSession = parseSignupCampaign(sessionStorage.getItem(SIGNUP_CAMPAIGN_KEY))
    if (fromSession) return fromSession
  } catch {
    /* fall through */
  }
  try {
    const fromLocal = parseSignupCampaign(localStorage.getItem(SIGNUP_CAMPAIGN_KEY))
    if (fromLocal) return fromLocal
  } catch {
    /* fall through */
  }
  return signupCampaignCookie()
}

export function rememberSignupCampaign(value: string): void {
  if (typeof window === 'undefined') return
  try {
    const campaign = cleanSignupCampaign(value)
    if (!campaign || storedSignupCampaign()) return // first high-intent handoff wins
    const payload = JSON.stringify({ campaign, capturedAt: Date.now() } satisfies StoredSignupCampaign)
    try {
      sessionStorage.setItem(SIGNUP_CAMPAIGN_KEY, payload)
    } catch {
      /* ignore */
    }
    try {
      localStorage.setItem(SIGNUP_CAMPAIGN_KEY, payload)
    } catch {
      /* ignore */
    }
    try {
      const secure = window.location.protocol === 'https:' ? ';secure' : ''
      document.cookie = `${SIGNUP_CAMPAIGN_KEY}=${encodeURIComponent(payload)};path=/;max-age=86400;samesite=lax${secure}`
    } catch {
      /* ignore */
    }
  } catch {
    /* campaign attribution must never break navigation */
  }
}

// KINEO-SOURCE-TRACK-2026-07-06 — Block 3.3 acquisition source tracking.
//
// First-touch capture of where a signup came from, surviving the Google OAuth
// round-trip. The existing captureUtmsOnce() above only uses sessionStorage,
// which is per-tab and is NOT guaranteed to survive the full-navigation hop out
// to accounts.google.com and back — so this adds a belt-and-suspenders store:
// localStorage (survives tab reuse) AND a first-party cookie (survives ANY
// navigation, incl. OAuth, and is readable server-side if ever needed).
//
// Stored fields (first-touch — never overwritten once set):
//   - utm_source / utm_medium / utm_campaign  (from URL query on first landing)
//   - referrer  (document.referrer — the off-site page that sent them here;
//                empty for direct/bookmarked visits)
//
// SSR-safe (guards `window`) and never throws — a storage failure can never
// break the page. Mirrors the style of captureRefOnce() in lib/referral.ts.
const SRC_KEY = 'kineo_src'
const SRC_COOKIE = 'kineo_src'
const SRC_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign'] as const

type StoredSource = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  referrer?: string
}

function readSourceCookie(): StoredSource | null {
  if (typeof document === 'undefined') return null
  try {
    const m = document.cookie.match(/(?:^|;\s*)kineo_src=([^;]+)/)
    if (!m) return null
    return JSON.parse(decodeURIComponent(m[1])) as StoredSource
  } catch {
    return null
  }
}

export function captureSourceOnce(): void {
  if (typeof window === 'undefined') return
  try {
    // First-touch wins: if we already recorded a source (either store), stop.
    if (localStorage.getItem(SRC_KEY) || readSourceCookie()) return

    const sp = new URLSearchParams(window.location.search)
    const src: StoredSource = {}
    SRC_FIELDS.forEach((k) => {
      const v = (sp.get(k) ?? '').trim()
      if (!v) return
      if (k === 'utm_source') {
        const source = sanitizeAcquisitionUtmSource(v)
        if (source) src[k] = source
        return
      }
      src[k] = v.slice(0, 255)
    })
    // document.referrer is the off-site URL that linked here (directory, social,
    // search). Same-origin internal navigations set it to our own domain — skip
    // those so "referrer" only ever reflects a genuine external acquisition source.
    try {
      const ref = sanitizeAcquisitionReferrer(document.referrer, window.location.hostname)
      if (ref) src.referrer = ref
    } catch {
      /* referrer may be unavailable — ignore */
    }

    // Nothing to record (organic/direct with no UTMs and no external referrer) —
    // don't write an empty marker, so a later UTM landing this session can still win.
    if (Object.keys(src).length === 0) return

    const json = JSON.stringify(src)
    try {
      localStorage.setItem(SRC_KEY, json)
    } catch {
      /* ignore */
    }
    try {
      // 90-day first-party cookie so the source survives the OAuth redirect and a
      // delayed email-confirmation → login. SameSite=Lax keeps it on the top-level
      // return navigation from Google's OAuth callback.
      document.cookie = `${SRC_COOKIE}=${encodeURIComponent(json)};path=/;max-age=7776000;samesite=lax`
    } catch {
      /* ignore */
    }
  } catch {
    /* silent — source capture must never break the page */
  }
}

function storedSource(): StoredSource {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(SRC_KEY)
    if (raw) return JSON.parse(raw) as StoredSource
  } catch {
    /* fall through to cookie */
  }
  return readSourceCookie() ?? {}
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
    // KINEO-SOURCE-TRACK-2026-07-06 — Block 3.3: also send the first-touch
    // acquisition source (utm_source/medium/campaign + external referrer) so the
    // server can persist it to signup_* columns. Read from the OAuth-durable
    // localStorage/cookie store, falling back to the sessionStorage UTMs for
    // utm_source when the source store is empty (belt-and-suspenders).
    const src = storedSource()
    fetch('/api/track-signup-source', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gclid: utms.gclid || null,
        utm_source: utms.utm_source || null,
        // Block 3.3 first-touch source fields:
        signup_utm_source: src.utm_source || utms.utm_source || null,
        signup_utm_medium: src.utm_medium || utms.utm_medium || null,
        signup_utm_campaign: src.utm_campaign || storedSignupCampaign() || utms.utm_campaign || null,
        signup_referrer: src.referrer || null,
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
    captureSourceOnce() // KINEO-SOURCE-TRACK-2026-07-06 — first-touch acquisition source
    const body = JSON.stringify({
      event_name,
      // keep `name` for backward compat with Push #060 server logic
      name: event_name,
      metadata: { ...storedUtms(), ...(metadata ?? {}) },
      path: path ?? (typeof window !== 'undefined' ? window.location?.pathname : undefined),
      session_id: eventSessionId(),
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
