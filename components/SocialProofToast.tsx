'use client'

// Push #118 — Product highlight notification toast.
// Floating bottom-left toast that auto-cycles through honest product-fact
// messages every 45–90 seconds. Fades in / slides up on show, fades out
// after 4 s. Only mounts on /pricing, /generate, and /start routes.

import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'

const MESSAGES = [
  { emoji: '⚡', text: 'Script, voiceover, footage & captions in a few minutes' },
  { emoji: '🎬', text: 'Faceless YouTube Shorts — no camera, no editing' },
  { emoji: '🚀', text: 'Up to 3 Fast previews every 24h — no card' },
  { emoji: '💎', text: 'AI voiceover + auto captions on every Short' },
  { emoji: '🎉', text: 'New topic in, ready-to-post Short out' },
  { emoji: '⚡', text: 'Built for daily YouTube Shorts creators' },
]

const ALLOWED_PATHS = ['/pricing', '/generate', '/start']

// Random integer in [min, max]
function randBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

interface ToastEntry {
  id: number
  emoji: string
  text: string
  visible: boolean // true = fading in/shown, false = fading out
}

export default function SocialProofToast() {
  const pathname = usePathname()
  const [toast, setToast] = useState<ToastEntry | null>(null)
  const [msgIndex, setMsgIndex] = useState(() => randBetween(0, MESSAGES.length - 1))
  const idRef = { current: 0 }

  const show = useCallback(() => {
    const idx = msgIndex % MESSAGES.length
    const msg = MESSAGES[idx]
    const id = ++idRef.current

    setToast({ id, emoji: msg.emoji, text: msg.text, visible: true })
    setMsgIndex((i) => (i + 1) % MESSAGES.length)

    // Fade out after 4 s
    setTimeout(() => {
      setToast((t) => (t && t.id === id ? { ...t, visible: false } : t))
    }, 4000)

    // Remove from DOM after fade-out animation (0.4 s)
    setTimeout(() => {
      setToast((t) => (t && t.id === id ? null : t))
    }, 4400)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgIndex])

  useEffect(() => {
    if (!ALLOWED_PATHS.some((p) => pathname?.startsWith(p))) return

    // Wait a short initial delay before the first toast so it doesn't appear
    // the moment the page loads (feels less fake).
    const initialDelay = randBetween(6000, 14000)
    let timer: ReturnType<typeof setTimeout>

    function schedule() {
      const interval = randBetween(45000, 90000)
      timer = setTimeout(() => {
        show()
        schedule()
      }, interval)
    }

    const firstTimer = setTimeout(() => {
      show()
      schedule()
    }, initialDelay)

    return () => {
      clearTimeout(firstTimer)
      clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (!toast) return null

  return (
    <>
      <style>{`
        @keyframes spToastIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spToastOut {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(8px); }
        }
        .sp-toast-enter { animation: spToastIn 0.35s cubic-bezier(0.22,1,0.36,1) both; }
        .sp-toast-exit  { animation: spToastOut 0.4s ease both; }
      `}</style>
      <div
        role="status"
        aria-live="polite"
        className={toast.visible ? 'sp-toast-enter' : 'sp-toast-exit'}
        style={{
          position: 'fixed',
          bottom: 80,          // above mobile nav bar
          left: 16,
          zIndex: 9999,
          maxWidth: 'min(320px, calc(100vw - 32px))',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 14,
          background: 'rgba(15, 15, 28, 0.96)',
          border: '1px solid rgba(41,151,255,.22)',
          boxShadow: '0 8px 32px rgba(0,0,0,.55), 0 0 0 1px rgba(41,151,255,.08)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          pointerEvents: 'none',
        }}
      >
        <span style={{ fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 }}>{toast.emoji}</span>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#F5F7FF',
              lineHeight: 1.35,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {toast.text}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: '0.65rem',
              color: 'rgba(245,247,255,.45)',
              marginTop: 2,
            }}
          >
            Kineo
          </p>
        </div>
      </div>
    </>
  )
}
