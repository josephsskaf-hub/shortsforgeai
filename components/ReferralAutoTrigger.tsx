'use client'

// Push #443 — Referral loop trigger. Mounted in the dashboard layout so it
// covers every authenticated page. Renders nothing.
//
// #444 FIX: the previous version ran ONCE on mount (useRef guard). But the
// dashboard layout PERSISTS across client-side navigation in the App Router, so
// the effect never re-ran after the user made their first video → the reward
// only fired on a hard reload (unreliable for real users). Now it re-runs on
// every pathname change: it attributes the referral once (if arrived via
// ?ref=), and calls qualify on each navigation. qualify is idempotent +
// self-gating server-side (only pays when the referred user is email-confirmed,
// has ≥1 video, and wasn't already paid), so calling it on every route change
// is safe and cheap — and it now fires reliably right after the user makes a
// video and navigates anywhere (or on their next visit).
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { getStoredRef, clearStoredRef } from '@/lib/referral'

export default function ReferralAutoTrigger() {
  const pathname = usePathname()
  const attributedRef = useRef(false)

  useEffect(() => {
    ;(async () => {
      try {
        // Attribute once: if the visitor arrived via ?ref=CODE (captured into
        // localStorage on the homepage), tie this account to the referrer.
        if (!attributedRef.current) {
          attributedRef.current = true
          const ref = getStoredRef()
          if (ref) {
            await fetch('/api/referral/attribute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ref }),
            }).catch(() => {})
            clearStoredRef()
          }
        }
        // Qualify on every route change. Idempotent + self-gating server-side:
        // grants +credits to BOTH only once the referred user is confirmed and
        // has made their first video. Cheap no-op otherwise.
        await fetch('/api/referral/qualify', { method: 'POST' }).catch(() => {})
      } catch {
        // referral is best-effort — never block the app
      }
    })()
  }, [pathname])

  return null
}
