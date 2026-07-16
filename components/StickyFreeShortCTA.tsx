'use client'

// ROBO1-CONV-2026-06-29b — Public Fast-preview CTA.
// Persistent bottom bar shown on high-intent SEO/marketing pages (alternatives,
// cheapest-ai-shorts-maker, youtube-shorts-from-topic) so a scrolling buyer always
// has a one-tap path to start — captures intent between the top and bottom CTAs.
// Honest copy mirrors the real offer: up to 3 watermarked Fast videos / 24h,
// no credit card.
// Dismissible (useState only, no localStorage → it gently reappears next session,
// matching StickyUpgradeBar). pointer-events:none on the wrapper so it never blocks
// clicks on page content behind the gutters.

import { useState } from 'react'
import Link from 'next/link'

export default function StickyFreeShortCTA({
  href = '/start',
  label = 'Create up to 3 watermarked Fast videos every 24h — no card',
  cta = 'Start free',
}: {
  href?: string
  label?: string
  cta?: string
}) {
  const [dismissed, setDismissed] = useState(false)
  // KINEO-DL-PAYWALL-2026-07-09 — sticky bar DISABLED per Joseph ("bem feio"),
  // and its "free, no card" promise no longer matches the paid-download model.
  // Killed at the source (rendered on 10 marketing pages) instead of editing
  // every page. Flip DISABLED to false to bring it back.
  const DISABLED = true
  if (DISABLED) return null
  if (dismissed) return null

  return (
    <>
      <style>{`
        @keyframes sfaCtaUp { from { opacity: 0; transform: translateY(120%); } to { opacity: 1; transform: translateY(0); } }
        .sfa-cta { animation: sfaCtaUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
      `}</style>
      <div
        className="sfa-cta"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 60,
          display: 'flex',
          justifyContent: 'center',
          padding: '0 12px calc(12px + env(safe-area-inset-bottom))',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            pointerEvents: 'auto',
            width: '100%',
            maxWidth: 680,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px 10px 16px',
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(22,22,24,0.96), rgba(22,22,24,0.92))',
            border: '1px solid rgba(41,151,255,0.35)',
            boxShadow: '0 -6px 28px rgba(0,0,0,0.55)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <span style={{ fontSize: '1.15rem', flexShrink: 0 }} aria-hidden>
            ⚡
          </span>
          <p style={{ flex: 1, margin: 0, minWidth: 0, fontSize: '0.84rem', fontWeight: 700, color: '#f5f5f7', lineHeight: 1.3 }}>
            {label}
          </p>
          <Link
            href={href}
            style={{
              flexShrink: 0,
              padding: '9px 18px',
              borderRadius: 980,
              background: '#f5f5f7',
              color: '#000',
              fontWeight: 900,
              fontSize: '0.82rem',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {cta} →
          </Link>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.16)',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              fontSize: '1.05rem',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
      </div>
    </>
  )
}
