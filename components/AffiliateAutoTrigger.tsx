'use client'

// #479 — Fires affiliate attribution once per session on any authenticated page.
// The sf_aff cookie is httpOnly (server-only), so we can't pre-check it client-
// side; we just POST once and the route no-ops cheaply if there's no cookie or
// the user is already attributed. Mirrors ReferralAutoTrigger.
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function AffiliateAutoTrigger() {
  const pathname = usePathname()

  useEffect(() => {
    try {
      if (sessionStorage.getItem('sf_aff_attr') === '1') return
    } catch {
      /* sessionStorage blocked — fall through and just fire */
    }
    fetch('/api/affiliate/attribute', { method: 'POST', keepalive: true })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as { ok?: boolean; reason?: string } | null
        const terminalWithoutAttribution = new Set([
          'no_cookie', 'invalid_code', 'unknown_code', 'inactive_affiliate', 'self_referral',
        ])
        // Do not mark transient failures (401, DB/profile race, 5xx) as done.
        // The next authenticated mount must retry so a real affiliate signup
        // cannot be lost because one request arrived too early.
        if (!response.ok || (!result?.ok && !terminalWithoutAttribution.has(result?.reason ?? ''))) return
        try {
          sessionStorage.setItem('sf_aff_attr', '1')
        } catch {
          /* ignore */
        }
      })
      .catch(() => {})
  }, [pathname])

  return null
}
