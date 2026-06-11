'use client'

// AI Avatar launch banner (item 3 do lançamento) — shown across the dashboard
// shell until dismissed. Links to /generate?avatar=1 (auto-opens the panel).
// Dismissal persists in localStorage so it never nags a user twice.
import { useEffect, useState } from 'react'

const DISMISS_KEY = 'sf_avatar_launch_dismissed'

export default function AvatarLaunchBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISMISS_KEY)) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className="relative z-20 flex items-center gap-3 px-4 py-2.5 text-sm"
      style={{
        background: 'linear-gradient(90deg, rgba(168,85,247,0.18), rgba(99,102,241,0.18))',
        borderBottom: '1px solid rgba(168,85,247,0.35)',
      }}
    >
      <span className="text-base">🎭</span>
      <span className="flex-1 min-w-0" style={{ color: '#e9d5ff' }}>
        <b>NEW — AI Avatar Video:</b>{' '}
        <span className="hidden sm:inline">upload a photo and it speaks your script, lip-synced in 720p.</span>{' '}
        <a
          href="/generate?avatar=1"
          className="font-bold underline"
          style={{ color: '#d8b4fe' }}
        >
          Try it →
        </a>
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        className="shrink-0 font-bold"
        style={{ color: 'var(--muted)', cursor: 'pointer' }}
        onClick={() => {
          try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
          setVisible(false)
        }}
      >
        ✕
      </button>
    </div>
  )
}
