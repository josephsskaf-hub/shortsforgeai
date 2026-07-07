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
import { captureSourceOnce } from '@/lib/analytics'

export default function SourceCapture() {
  useEffect(() => {
    captureSourceOnce()
  }, [])
  return null
}
