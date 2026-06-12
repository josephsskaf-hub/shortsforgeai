'use client'

// Push #120 — Sticky upgrade bar for free users.
// Fixed bottom bar (above the mobile nav) that shows only for non-Pro users.
// Dismissible via X button — persists until page refresh (useState only,
// no localStorage so it gently re-appears on the next session).
// Hidden on desktop via md:hidden to keep the sidebar-visible layout clean;
// a subtle inline top banner can be added for desktop if desired later.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface StickyUpgradeBarProps {
  isPro: boolean
}

export default function StickyUpgradeBar({ isPro }: StickyUpgradeBarProps) {
  const [dismissed, setDismissed] = useState(false)
  const router = useRouter()

  if (isPro || dismissed) return null

  return (
    <>
      <style>{`
        @keyframes subSlideUp {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .sub-bar { animation: subSlideUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }
      `}</style>

      {/* Mobile: fixed above the bottom-nav (bottom-16 = 64px). Desktop: hidden. */}
      <div
        className="sub-bar fixed left-0 right-0 z-50 md:hidden"
        style={{ bottom: 64 }}
      >
        <div
          style={{
            margin: '0 12px',
            borderRadius: 14,
            background: 'linear-gradient(135deg, rgba(5,150,105,.92) 0%, rgba(5,150,105,.88) 100%)',
            border: '1px solid rgba(255,255,255,.14)',
            boxShadow: '0 -4px 24px rgba(5,150,105,.30)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>✨</span>

          <p
            style={{
              flex: 1,
              margin: 0,
              fontSize: '0.78rem',
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.35,
              minWidth: 0,
            }}
          >
            Upgrade to Pro — unlimited Shorts, HD quality, priority queue
          </p>

          <button
            type="button"
            onClick={() => router.push('/pricing')}
            style={{
              flexShrink: 0,
              padding: '6px 14px',
              borderRadius: 10,
              background: '#fff',
              border: 'none',
              color: '#047857',
              fontSize: '0.75rem',
              fontWeight: 800,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Upgrade Now
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss upgrade bar"
            style={{
              flexShrink: 0,
              width: 26,
              height: 26,
              borderRadius: 8,
              background: 'rgba(255,255,255,.14)',
              border: '1px solid rgba(255,255,255,.22)',
              color: 'rgba(255,255,255,.75)',
              cursor: 'pointer',
              fontSize: '1rem',
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

      {/* Desktop: subtle top banner (shown below the topbar via normal flow, not fixed) */}
      {/* Placed here as a hidden block — can be enabled later if needed */}
    </>
  )
}
