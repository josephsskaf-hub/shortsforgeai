'use client'

// ROBO1-CONV-2026-06-29b — Public sticky "first Short free" CTA.
// Persistent bottom bar shown on high-intent SEO/marketing pages (alternatives,
// cheapest-ai-shorts-maker, youtube-shorts-from-topic) so a scrolling buyer always
// has a one-tap path to start — captures intent between the top and bottom CTAs.
// Honest copy mirrors the real offer: first Short free, no credit card.
// Dismissible (useState only, no localStorage → it gently reappears next session,
// matching StickyUpgradeBar). pointer-events:none on the wrapper so it never blocks
// clicks on page content behind the gutters.

import { useState } from 'react'
import Link from 'next/link'

export default function StickyFreeShortCTA({
  href = '/start',
  label = 'Generate your first Short — free, no card',
  cta = 'Start free',
}: {
  href?: string
  label?: string
  cta?: string
}) {
  const [dismissed, setDismissed] = useState(false)
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
            background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.92))',
            border: '1px solid rgba(34,211,238,0.35)',
            boxShadow: '0 -6px 28px rgba(8,12,24,0.55)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <span style={{ fontSize: '1.15rem', flexShrink: 0 }} aria-hidden>
            ⚡
          </span>
          <p style={{ flex: 1, margin: 0, minWidth: 0, fontSize: '0.84rem', fontWeight: 700, color: '#F1F5F9', lineHeight: 1.3 }}>
            {label}
          </p>
          <Link
            href={href}
            style={{
              flexShrink: 0,
              padding: '9px 18px',
              borderRadius: 11,
              background: 'linear-gradient(135deg,#22D3EE,#8B5CF6)',
              color: '#0A0A0B',
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
