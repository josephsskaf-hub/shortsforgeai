'use client'

// #479 — Fires affiliate attribution once per session on any authenticated page.
// The sf_aff cookie is httpOnly (server-only), so we can't pre-check it client-
// side; we just POST once and the route no-ops cheaply if there's no cookie or
// the user is already attributed. Mirrors ReferralAutoTrigger.
import { useEffect } from 'react'

export default function AffiliateAutoTrigger() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('sf_aff_attr') === '1') return
    } catch {
      /* sessionStorage blocked — fall through and just fire */
    }
    fetch('/api/affiliate/attribute', { method: 'POST', keepalive: true })
      .then(() => {
        try {
          sessionStorage.setItem('sf_aff_attr', '1')
        } catch {
          /* ignore */
        }
      })
      .catch(() => {})
  }, [])

  return null
}
