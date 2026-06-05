'use client'

// Push #423 — "Install app" banner. The PWA (#422) is installable, but
// almost nobody knows about "Add to Home Screen", so the app offers
// itself:
//   - Android/Chrome: captures the `beforeinstallprompt` event and shows
//     a one-tap "Install app" button that fires the NATIVE install dialog.
//   - iOS Safari: no install API exists, so we show a tiny visual
//     instruction (Share → Add to Home Screen).
//   - Hidden when already running as an installed app (standalone), on
//     desktop without install support, and for 14 days after dismissal.

import { useEffect, useState } from 'react'

const DISMISS_KEY = 'sfai_install_dismissed_at'
const DISMISS_DAYS = 14

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return true
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari legacy flag
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iPadOS 13+ reports as Mac, so also check touch points
  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  )
}

function recentlyDismissed(): boolean {
  try {
    const at = localStorage.getItem(DISMISS_KEY)
    if (!at) return false
    return Date.now() - Number(at) < DISMISS_DAYS * 86400000
  } catch {
    return false
  }
}

export default function InstallAppBanner() {
  const [mode, setMode] = useState<'hidden' | 'android' | 'ios'>('hidden')
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return

    if (isIos()) {
      // Show only in Safari (in-app browsers can't install)
      setMode('ios')
      return
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setMode('android')
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* private mode — banner just reappears next session */
    }
    setMode('hidden')
  }

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    if (choice.outcome === 'accepted') {
      setMode('hidden')
    } else {
      dismiss()
    }
  }

  if (mode === 'hidden') return null

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 16,
        background: 'rgba(11,17,32,0.97)',
        border: '1px solid rgba(34,211,238,0.35)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(10px)',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 11,
          background: 'linear-gradient(135deg,#3B82F6,#2563EB)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        ⚡
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, color: '#e2e8f0', lineHeight: 1.3 }}>
          Get the ShortsForgeAI app
        </p>
        {mode === 'ios' ? (
          <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: '#94a3b8', lineHeight: 1.4 }}>
            Tap <span style={{ color: '#22D3EE', fontWeight: 700 }}>Share</span>{' '}
            <span aria-hidden>⎙</span> then{' '}
            <span style={{ color: '#22D3EE', fontWeight: 700 }}>
              Add to Home Screen
            </span>
          </p>
        ) : (
          <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: '#94a3b8', lineHeight: 1.4 }}>
            Full screen, faster, one tap away
          </p>
        )}
      </div>

      {mode === 'android' && (
        <button
          onClick={install}
          style={{
            padding: '9px 16px',
            borderRadius: 11,
            border: 'none',
            background: 'linear-gradient(135deg,#2563EB,#22D3EE)',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 900,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Install
        </button>
      )}

      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          border: 'none',
          background: 'rgba(255,255,255,0.06)',
          color: '#64748b',
          fontSize: '0.8rem',
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  )
}
