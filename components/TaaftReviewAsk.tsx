'use client'

// KINEO-TAAFT-REVIEW-2026-07-14 — TAAFT review ask for the post-generation
// success screen ("Your video is ready" in GenerateClient). TAAFT drives
// ~72% of our signups but the listing sits at 3.0 stars with only 2 reviews,
// so a single honest 5-star review from a real user is the highest-leverage
// growth ask we can make — and the only fair moment to make it is right
// after a render SUCCEEDS (peak-happiness moment), and only to users who
// actually signed up via TAAFT.
//
// Modeled on <ReferralMiniCard/> (the house pattern for win-moment cards):
// fully self-contained, degrades to null (renders nothing) on ANY failure —
// missing column, 401, storage blocked, fetch error — so it can never break
// the success screen. Show conditions (ALL must hold):
//   1. profiles.signup_utm_source === 'taaft' (via /api/me/plan, which
//      already returns it — cached at module level so repeat renders in one
//      session never refetch)
//   2. render completed successfully (parent only mounts this inside the
//      `phase === 'done' && finalVideoUrl` branch)
//   3. never shown before in this browser — localStorage flag
//      'kineo_taaft_review_asked', set the moment the card SHOWS (not on
//      click), so it is strictly once-per-browser-lifetime
// Clicking "Leave a review" or the × close hides it immediately; the flag is
// already persisted so it never comes back either way.
import { useEffect, useState } from 'react'

// #rw_cont anchor drops the visitor directly at the review form on our
// TAAFT listing — no scrolling/hunting, keeps the "30 seconds" promise true.
const TAAFT_REVIEW_URL = 'https://theresanaiforthat.com/ai/kineo/#rw_cont'
const STORAGE_KEY = 'kineo_taaft_review_asked'

// Module-level cache: /generate keeps GenerateClient mounted, but the
// success screen (and therefore this card's mount) can come and go across
// multiple renders in one session. One roundtrip per page lifetime is
// enough — the signup source never changes for a logged-in user.
let signupSourcePromise: Promise<string | null> | null = null

function fetchSignupSource(): Promise<string | null> {
  if (!signupSourcePromise) {
    signupSourcePromise = fetch('/api/me/plan')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) =>
        d && typeof d.signup_utm_source === 'string' && d.signup_utm_source
          ? String(d.signup_utm_source).toLowerCase()
          : null,
      )
      .catch(() => null)
  }
  return signupSourcePromise
}

// Same fire-and-forget /api/events pattern as GenerateClient's trackEvent —
// both `event_name` and `name` keys for the route's dual schema, keepalive
// so the 'clicked' event survives the tab opening, errors swallowed so
// analytics can never affect the UI.
function trackReviewAskEvent(name: string): void {
  try {
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: name,
        name,
        metadata: { source: 'post_video_success' },
        path: typeof window !== 'undefined' ? window.location?.pathname : undefined,
      }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // ignore — tracking must never throw into the success screen
  }
}

export default function TaaftReviewAsk() {
  // Starts hidden and only flips visible after ALL gates pass in the mount
  // effect below — hidden-by-default means SSR/hydration always agree and
  // every failure mode lands on "success UI exactly as before".
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Gate 3 first (cheapest): already asked in this browser → done forever.
    // If storage itself throws (private mode / blocked), we bail hidden: we
    // can't honor "only once" without storage, so we never show at all.
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === '1') return
    } catch {
      return
    }
    // Gate 1: confirmed TAAFT signup. null/unknown/non-taaft → stay hidden.
    fetchSignupSource().then((source) => {
      if (cancelled || source !== 'taaft') return
      // Persist the "asked" flag AT SHOW TIME (spec: once-per-browser even
      // if the user never interacts). Re-check + set inside one try so a
      // concurrent mount or a storage failure both resolve to "don't show".
      try {
        if (window.localStorage.getItem(STORAGE_KEY) === '1') return
        window.localStorage.setItem(STORAGE_KEY, '1')
      } catch {
        return
      }
      setVisible(true)
      trackReviewAskEvent('taaft_review_ask_shown')
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className="relative rounded-2xl px-5 py-4 mt-6 w-full"
      style={{
        maxWidth: 480,
        background: '#161618',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Close (×) — the flag is already persisted from show time, so this
          only needs to hide the card for the current view. */}
      <button
        type="button"
        aria-label="Dismiss review ask"
        onClick={() => setVisible(false)}
        className="absolute"
        style={{
          top: 10,
          right: 12,
          background: 'transparent',
          border: 'none',
          color: '#86868b',
          fontSize: '1rem',
          lineHeight: 1,
          cursor: 'pointer',
          padding: 4,
        }}
      >
        ×
      </button>
      <div className="text-sm font-black" style={{ color: '#f5f5f7', paddingRight: 24 }}>
        Enjoying Kineo? ⭐
      </div>
      <p className="text-xs mt-1.5" style={{ color: '#86868b', lineHeight: 1.55 }}>
        A 30-second review helps more creators find us.
      </p>
      <div className="mt-3">
        <a
          href={TAAFT_REVIEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            trackReviewAskEvent('taaft_review_ask_clicked')
            setVisible(false)
          }}
          className="inline-block rounded-xl px-4 py-2 text-xs font-bold"
          style={{
            background: 'rgba(41,151,255,.10)',
            border: '1px solid rgba(41,151,255,.45)',
            color: '#2997ff',
            textDecoration: 'none',
          }}
        >
          Leave a review →
        </a>
      </div>
    </div>
  )
}
