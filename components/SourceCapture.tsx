'use client'

// KINEO-SOURCE-TRACK-2026-07-06 — Block 3.3 acquisition source tracking.
//
// Tiny render-nothing client component mounted once in the root layout so the
// first-touch source capture runs on EVERY landing, regardless of which page
// component renders. This matters because the live homepage (app/page.tsx →
// KineoLanding) is a server component with no client capture of its own — the
// legacy captureUtmsOnce() call lives in app/HomePageClient.tsx, which is no
// longer the homepage. Mounting here guarantees capture fires for directory /
// UTM / social landings on any route.
//
// captureSourceOnce() is first-touch (never overwrites), SSR-safe, and never
// throws — it can never block or break page render.

import { useEffect } from 'react'
import { captureSourceOnce, trackEvent } from '@/lib/analytics'
import { captureRefOnce } from '@/lib/referral'
import { acquisitionSource, sanitizeAcquisitionReferrer } from '@/lib/acquisitionSource'

export default function SourceCapture() {
  useEffect(() => {
    captureSourceOnce()
    // Referral links can land on a public video page (/v/[id]), not only the
    // homepage. Capture ?ref= globally so the code survives signup/OAuth and
    // ReferralAutoTrigger can attribute the new account after authentication.
    captureRefOnce()

    // One anonymous landing anchor per browser tab. The shared session_id in
    // trackEvent connects this entry route to later signup/generation/checkout
    // events without storing email, prompt or the full query string.
    try {
      const marker = 'kineo_landing_session_recorded'
      if (!sessionStorage.getItem(marker)) {
        sessionStorage.setItem(marker, '1')
        let referrerHost: string | null = null
        try {
          const referrer = sanitizeAcquisitionReferrer(document.referrer, window.location.hostname)
          if (referrer) referrerHost = acquisitionSource({ referrer }).slice(0, 120)
        } catch {
          // Referrer is optional.
        }
        void trackEvent('landing_session_started', { referrer_host: referrerHost })
      }
    } catch {
      // Storage or analytics failures must never affect page rendering.
    }
  }, [])
  return null
}
