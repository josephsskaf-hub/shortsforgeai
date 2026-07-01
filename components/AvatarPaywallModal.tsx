'use client'

import { useEffect } from 'react'

// feature/ai-avatar CP2 — Avatar Credits paywall ("paywall claro").
// Shown when the user hits Generate with an avatar loaded but 0 avatar
// credits (402 from /api/generate-avatar). One-time packs, no subscription;
// Studio subscribers see the 15% benefit applied. Prices MUST stay in sync
// with AVATAR_PACKS in app/api/stripe/checkout/route.ts (server is the
// source of truth — the discount is recomputed server-side).
interface AvatarPaywallModalProps {
  open: boolean
  onClose: () => void
  isStudio: boolean
}

// Fix 2 (12/06) — repriced with the Hook Avatar economics (margem ~85%),
// aligned with AVATAR_PACKS in app/api/stripe/checkout/route.ts.
const PACKS = [
  { id: 'avatar1', videos: 1, usd: 11.9, perVideo: 11.9, tag: null as string | null },
  { id: 'avatar3', videos: 3, usd: 29.9, perVideo: 9.97, tag: 'Popular' },
  { id: 'avatar10', videos: 10, usd: 79.9, perVideo: 7.99, tag: 'Best value' },
]

function studioPrice(usd: number): string {
  return (Math.round(usd * 85) / 100).toFixed(2)
}

export default function AvatarPaywallModal({ open, onClose, isStudio }: AvatarPaywallModalProps) {
  // Accessibility: close on Escape, reusing the existing onClose handler.
  // Hook must run unconditionally (before the `open` early return) per the
  // Rules of Hooks; it simply no-ops while the modal isn't open.
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="AI Avatar Videos — premium add-on"
    >
      <div
        className="w-full max-w-2xl rounded-2xl p-6"
        style={{ background: '#0d0d1a', border: '1.5px solid rgba(139,92,246,0.45)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <div className="text-lg font-black" style={{ color: '#a7f3d0' }}>
            <span aria-hidden="true">🎭</span> AI Avatar Videos — premium add-on
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-sm font-bold" style={{ color: 'var(--muted)' }}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div className="text-xs mb-5" style={{ color: 'var(--muted2)' }}>
          Your face (or anyone&apos;s, with permission) speaking your script in 720p.
          One-time purchase — separate from your plan credits, they never expire.
          {isStudio && (
            <span className="ml-1 font-bold" style={{ color: '#86efac' }}>
              Studio benefit: 15% off applied. ✓
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PACKS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { window.location.href = `/api/stripe/checkout?pack=${p.id}` }}
              className="relative text-left rounded-xl p-4 transition-all"
              style={{
                background: p.tag === 'Popular' ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.03)',
                border: p.tag === 'Popular' ? '1.5px solid rgba(139,92,246,0.65)' : '1.5px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              {p.tag && (
                <span
                  className="absolute -top-2.5 left-3 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: '#8b5cf6', color: '#fff' }}
                >
                  {p.tag}
                </span>
              )}
              <div className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>
                {p.videos} avatar video{p.videos > 1 ? 's' : ''}
              </div>
              <div className="text-2xl font-black" style={{ color: '#c4b5fd' }}>
                {isStudio ? (
                  <>
                    <span className="text-sm line-through mr-1.5" style={{ color: 'var(--muted2)' }}>${p.usd}</span>
                    ${studioPrice(p.usd)}
                  </>
                ) : (
                  <>${p.usd}</>
                )}
              </div>
              <div className="text-[11px] mt-1" style={{ color: 'var(--muted2)' }}>
                {isStudio
                  ? `$${studioPrice(p.perVideo)} / video`
                  : `$${p.perVideo.toFixed(2).replace(/\.00$/, '')} / video`}
              </div>
            </button>
          ))}
        </div>

        {!isStudio && (
          <div className="text-[11px] mt-4 text-center" style={{ color: 'var(--muted2)' }}>
            <span aria-hidden="true">💎</span> Studio members get <span style={{ color: '#c4b5fd', fontWeight: 700 }}>15% off</span> every avatar pack.
          </div>
        )}
      </div>
    </div>
  )
}
