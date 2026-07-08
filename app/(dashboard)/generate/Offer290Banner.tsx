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

import { useEffect, useMemo, useState } from 'react'
import { OFFER_290_ENABLED } from '@/lib/flags'

const SEEN_KEY = 'kineo_offer290_seen'
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
  const [firstVideoAt, setFirstVideoAt] = useState<string | null>(null)
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
        // Non-paying, offer never claimed, and activated (>=1 video).
        if (data?.hasPaid === true) return
        if (data?.offer290Used === true) return
        const fv: string | null = typeof data?.firstVideoAt === 'string' ? data.firstVideoAt : null
        if (!fv) return
        const start = new Date(fv).getTime()
        if (!Number.isFinite(start)) return
        // Still inside the 24h window?
        if (Date.now() >= start + WINDOW_MS) return
        setFirstVideoAt(fv)
        setEligible(true)
        // Mark as shown so it only ever appears ONCE.
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
    if (!firstVideoAt) return 0
    const start = new Date(firstVideoAt).getTime()
    return start + WINDOW_MS - now
  }, [firstVideoAt, now])

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
