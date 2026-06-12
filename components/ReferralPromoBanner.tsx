'use client'

// Push #452 — Referral growth banner. The referral loop (#443) is live but
// nobody knows it exists. This dismissible banner on the dashboard surfaces it
// so users actually grab their link and invite friends (free top-of-funnel
// growth → more conversion candidates). Mirrors InstallAppBanner/EnablePush
// pattern: localStorage dismiss so it never nags after the user acts/dismisses.
import { useEffect, useState } from 'react'
import Link from 'next/link'

const DISMISS_KEY = 'sf_referral_promo_dismissed'

export default function ReferralPromoBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISMISS_KEY)) setShow(true)
    } catch {
      // localStorage blocked — just don't show, never crash
    }
  }, [])

  if (!show) return null

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
    setShow(false)
  }

  return (
    <div
      role="status"
      className="mx-auto mt-4 flex w-full max-w-3xl items-center gap-3 rounded-xl px-4 py-3"
      style={{
        background: 'rgba(34, 211, 238, 0.10)',
        border: '1px solid rgba(34, 211, 238, 0.35)',
      }}
    >
      <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🎁</span>
      <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 700, color: '#E2F6FB', lineHeight: 1.4 }}>
        Invite a friend — you <span style={{ color: '#22D3EE' }}>both get 30 free credits</span> when they
        make their first video. No limit.
      </span>
      <Link
        href="/referral"
        onClick={dismiss}
        className="shrink-0 rounded-lg px-4 py-2 text-xs font-extrabold"
        style={{ background: '#22D3EE', color: '#0A0A0B' }}
      >
        Get my link →
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0"
        style={{
          width: 26, height: 26, borderRadius: 8,
          background: 'transparent', border: '1px solid rgba(34,211,238,0.35)',
          color: '#22D3EE', fontWeight: 900, fontSize: '0.85rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ×
      </button>
    </div>
  )
}
