'use client'

// KINEO-REBASE-2026-07-10 — one-time conversion banner for the 2:1 credit
// rebase. Existing users open the dashboard and see HALF the credit number
// they remember; without an explanation that reads as "Kineo took my
// credits". This banner tells them the truth in one line: every credit is
// now worth 2× more and the balance was converted automatically (migration
// 011_credit_rebase.sql, ceil in the user's favor).
//
// Mechanics:
//   • dismissible — X stores `kineo_rebase_seen` in localStorage, never
//     renders again on that device;
//   • self-expiring — hard-stops rendering after SHOW_UNTIL (2026-07-24,
//     two weeks), so the code can be left in place and removed at leisure;
//   • pure UI — no fetch, no credit logic; renders for logged-out visitors
//     too (harmless: it's one informative line, Kineo-blue, on-brand).

import { useEffect, useState } from 'react'

const SEEN_KEY = 'kineo_rebase_seen'
// KINEO-REBASE-2026-07-10 — banner sunset: stop rendering after 2026-07-24.
const SHOW_UNTIL_MS = Date.UTC(2026, 6, 24, 23, 59, 59) // months are 0-based → 6 = July

export default function CreditRebaseBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (Date.now() > SHOW_UNTIL_MS) return
    try {
      if (localStorage.getItem(SEEN_KEY)) return
    } catch {
      // storage unavailable (private mode) — still show this mount
    }
    setVisible(true)
  }, [])

  function dismiss() {
    setVisible(false)
    try {
      localStorage.setItem(SEEN_KEY, String(Date.now()))
    } catch {
      // ignore — worst case it shows again next visit
    }
  }

  if (!visible) return null

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'rgba(41,151,255,0.10)',
        border: '1px solid rgba(41,151,255,0.35)',
        borderRadius: 12,
        padding: '10px 14px',
        margin: '10px 16px 0',
      }}
    >
      <span aria-hidden style={{ fontSize: 16 }}>✨</span>
      <p style={{ flex: 1, margin: 0, fontSize: 13, lineHeight: 1.5, color: '#cfe7ff' }}>
        <strong style={{ color: '#2997ff' }}>Credits just got simpler:</strong>{' '}
        1 credit is now worth 2× more. Your balance was converted automatically —
        same value, smaller numbers.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss credit update notice"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,.55)',
          fontSize: 18,
          lineHeight: 1,
          cursor: 'pointer',
          padding: '4px 6px',
        }}
      >
        ×
      </button>
    </div>
  )
}
