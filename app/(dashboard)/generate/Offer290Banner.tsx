'use client'

// KINEO-OFFER290-2026-07-07 — first-purchase URGENCY offer banner.
//
// Shows a "First pack: $4.90 → $2.90 — expires in 24h" banner with a REAL
// countdown to (first_video_at + 24h) for brand-new, non-paying users, exactly
// ONCE. Self-contained: fetches its own inputs from /api/credits so mounting it
// costs GenerateClient a single line. Buy button → the flag-gated $2.90 SKU.
//
// Gated on OFFER_290_ENABLED (build-only until the founder flips the flag). When
// the flag is false this returns null immediately — nothing renders, no fetch.
//
// KINEO-REBASE-2026-07-10 — POST-EXIT COUNTDOWN: a SECOND eligibility path.
// When the pricing exit-intent modal is shown and the visitor doesn't
// convert, ExitIntentOffer writes `kineo_exit_seen_at` (localStorage). On
// their next visits within 24h of that moment, this same banner arms with
// the countdown anchored to exit_seen_at + 24h. Everything else is the
// SAME lock as today: server-side offer290Enabled + hasPaid + offer290Used
// gates, the flag-gated $2.90 SKU, and the once-ever SEEN_KEY.

import { useEffect, useMemo, useState } from 'react'
import { OFFER_290_ENABLED } from '@/lib/flags'

const SEEN_KEY = 'kineo_offer290_seen'
// KINEO-REBASE-2026-07-10 — written by components/ExitIntentOffer.tsx on show.
const EXIT_SEEN_KEY = 'kineo_exit_seen_at'
const WINDOW_MS = 24 * 60 * 60 * 1000 // 24h

function fmt(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export default function Offer290Banner() {
  // Flag OFF → render nothing (and never fetch). Hard client-side gate.
  const enabled = OFFER_290_ENABLED

  const [eligible, setEligible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  // KINEO-REBASE-2026-07-10 — countdown anchor (ms): first_video_at OR
  // kineo_exit_seen_at, whichever path armed the banner.
  const [anchorStart, setAnchorStart] = useState<number | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())

  // Load offer inputs from /api/credits (server-side, cookie auth).
  useEffect(() => {
    if (!enabled) return
    // 1x gate — if already shown before, never show again.
    try {
      if (localStorage.getItem(SEEN_KEY)) return
    } catch { /* ignore storage errors */ }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/credits', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        // Server must agree the offer is enabled (defence in depth).
        if (data?.offer290Enabled !== true) return
        // Non-paying + offer never claimed (server-side truth for both paths).
        if (data?.hasPaid === true) return
        if (data?.offer290Used === true) return

        // Path 1 (original) — activated new user: first_video_at + 24h window.
        let start: number | null = null
        const fv: string | null = typeof data?.firstVideoAt === 'string' ? data.firstVideoAt : null
        if (fv) {
          const t = new Date(fv).getTime()
          if (Number.isFinite(t) && Date.now() < t + WINDOW_MS) start = t
        }

        // Path 2 (KINEO-REBASE-2026-07-10) — post-exit-intent: the visitor saw
        // the exit modal, didn't convert, and is back within 24h. Countdown
        // anchors to the moment the exit modal was shown.
        if (start === null) {
          try {
            const raw = localStorage.getItem(EXIT_SEEN_KEY)
            const t = raw ? Number(raw) : NaN
            if (Number.isFinite(t) && t > 0 && Date.now() < t + WINDOW_MS) start = t
          } catch { /* ignore storage errors */ }
        }

        if (start === null) return
        setAnchorStart(start)
        setEligible(true)
        // Mark as shown so it only ever appears ONCE (shared by both paths).
        try { localStorage.setItem(SEEN_KEY, String(Date.now())) } catch { /* ignore */ }
      } catch { /* silent — banner just won't show */ }
    })()
    return () => { cancelled = true }
  }, [enabled])

  // 1s ticking clock for the live countdown (only while eligible & visible).
  useEffect(() => {
    if (!enabled || !eligible || dismissed) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [enabled, eligible, dismissed])

  const remaining = useMemo(() => {
    if (anchorStart === null) return 0
    return anchorStart + WINDOW_MS - now
  }, [anchorStart, now])

  if (!enabled || !eligible || dismissed) return null
  // Countdown expired mid-session → hide.
  if (remaining <= 0) return null

  return (
    <div
      style={{
        background: 'linear-gradient(90deg, rgba(245,158,11,.18), rgba(239,68,68,.10))',
        border: '1px solid rgba(245,158,11,.5)',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: '1 1 240px' }}>
        <span style={{ color: '#fbbf24', fontWeight: 800, fontSize: 14 }}>
          🔥 First pack:{' '}
          <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>$4.90</span>{' '}
          <span style={{ color: '#fff' }}>$2.90</span> — 10 Fast videos
        </span>
        <span style={{ color: '#fca5a5', fontSize: 13, fontWeight: 600 }}>
          Expires in{' '}
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800, color: '#fff' }}>
            {fmt(remaining)}
          </span>{' '}
          · one per account
        </span>
      </div>
      <a
        href="/api/stripe/checkout?pack=starter290"
        style={{
          background: '#f59e0b',
          color: '#111',
          fontWeight: 800,
          fontSize: 14,
          padding: '10px 18px',
          borderRadius: 10,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Claim $2.90 offer →
      </a>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss offer"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,.55)',
          fontSize: 18,
          lineHeight: 1,
          cursor: 'pointer',
          padding: 4,
        }}
      >
        ×
      </button>
    </div>
  )
}
