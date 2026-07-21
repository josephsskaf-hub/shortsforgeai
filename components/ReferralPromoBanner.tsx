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
        background: '#161618',
        border: '1px solid #2a2a2d',
      }}
    >
      <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>🎁</span>
      <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 700, color: '#f5f5f7', lineHeight: 1.4 }}>
        Invite a friend — you <span style={{ color: 'var(--blue, #2997ff)' }}>both get 30 free credits</span> when they
        make their first video. Earn referral rewards for up to 20 friends.
      </span>
      <Link
        href="/referral"
        onClick={dismiss}
        className="shrink-0 rounded-lg px-4 py-2 text-xs font-extrabold"
        style={{ background: '#f5f5f7', color: '#000', borderRadius: 980 }}
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
          background: 'transparent', border: '1px solid #3a3a3d',
          color: '#86868b', fontWeight: 900, fontSize: '0.85rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ×
      </button>
    </div>
  )
}
