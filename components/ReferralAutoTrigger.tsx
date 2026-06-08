'use client'

// Push #443 — Referral loop trigger. Mounted in the dashboard layout so it
// fires on ANY authenticated page (the /dashboard page itself redirects to
// /generate, so the trigger can't live there). Renders nothing.
//
// On first mount for a logged-in user it:
//  1) attributes the referral (if the visitor arrived via ?ref=CODE, captured
//     into localStorage on the homepage) — server no-ops if already referred,
//     self-referral, or unknown code.
//  2) calls qualify — server self-gates: only pays the reward when the user is
//     email-confirmed AND has made their first video AND wasn't already paid.
// Both are best-effort and never affect the page if they fail.
import { useEffect, useRef } from 'react'
import { getStoredRef, clearStoredRef } from '@/lib/referral'

export default function ReferralAutoTrigger() {
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    ;(async () => {
      try {
        const ref = getStoredRef()
        if (ref) {
          await fetch('/api/referral/attribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ref }),
          }).catch(() => {})
          clearStoredRef()
        }
        // Idempotent + self-gating server-side; safe to call on every load.
        await fetch('/api/referral/qualify', { method: 'POST' }).catch(() => {})
      } catch {
        // referral is best-effort — never block the app
      }
    })()
  }, [])
  return null
}
