'use client'

// Push #427 — "get notified when your video is ready" opt-in.
// - Registers /sw.js (also strengthens PWA installability).
// - Permission already granted → silently (re)subscribes, renders nothing.
// - Permission 'default' → compact banner with an Enable button.
// - Permission 'denied' or unsupported browser → renders nothing.
// - Dismissal is remembered for 14 days.

import { useEffect, useState } from 'react'
import { VAPID_PUBLIC_KEY } from '@/lib/push'

const DISMISS_KEY = 'sfai_push_dismissed_at'
const DISMISS_DAYS = 14

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
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

async function subscribeAndSave(): Promise<boolean> {
  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
    })
  }
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub.toJSON()),
  })
  return res.ok
}

export default function EnablePushBanner() {
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    )
      return

    if (Notification.permission === 'granted') {
      // Keep the subscription fresh, invisibly.
      subscribeAndSave().catch(() => {/* best-effort */})
      return
    }
    if (Notification.permission === 'default' && !recentlyDismissed()) {
      setShow(true)
    }
  }, [])

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {/* private mode */}
    setShow(false)
  }

  async function enable() {
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') {
        await subscribeAndSave()
        setShow(false)
      } else {
        dismiss()
      }
    } catch {
      dismiss()
    } finally {
      setBusy(false)
    }
  }

  if (!show) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 76, // sits above the install banner when both are visible
        zIndex: 69,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 16,
        background: 'rgba(11,17,32,0.97)',
        border: '1px solid rgba(167,139,250,0.35)',
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
          background: 'linear-gradient(135deg,#7C3AED,#a78bfa)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        🔔
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, color: '#e2e8f0', lineHeight: 1.3 }}>
          Know when your video is ready
        </p>
        <p style={{ margin: '2px 0 0', fontSize: '0.68rem', color: '#94a3b8', lineHeight: 1.4 }}>
          Renders take a few minutes — we&apos;ll ping you the second it&apos;s done
        </p>
      </div>

      <button
        onClick={enable}
        disabled={busy}
        style={{
          padding: '9px 16px',
          borderRadius: 11,
          border: 'none',
          background: 'linear-gradient(135deg,#7C3AED,#a78bfa)',
          color: '#fff',
          fontSize: '0.75rem',
          fontWeight: 900,
          cursor: busy ? 'wait' : 'pointer',
          flexShrink: 0,
        }}
      >
        {busy ? '…' : 'Notify me'}
      </button>

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
