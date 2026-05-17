'use client'

// Push #063 — Checkout success page. Confirms the plan is being
// activated and nudges the user back into the product. Fires a
// `payment_success` event on mount so /admin/funnel can close the loop.
// Stripe redirects here via the `success_url` set in
// app/api/stripe/checkout/route.ts.

import Link from 'next/link'
import { useEffect } from 'react'

export default function CheckoutSuccessPage() {
  useEffect(() => {
    // Push #110 — Google Ads purchase conversion. Stripe success_url
    // appends ?success=true (Push #105) so we can fire only on the
    // real redirect, not on an accidental direct visit. gtag itself
    // is loaded globally from app/layout.tsx.
    if (typeof window !== 'undefined' && window.location.search.includes('success=true')) {
      if (typeof (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag === 'function') {
        ;(window as unknown as { gtag: (...args: unknown[]) => void }).gtag('event', 'conversion', {
          send_to: 'AW-18156258081/purchase',
          value: 4.50,
          currency: 'USD',
        })
      }
    }
    try {
      void fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: 'payment_success',
          name: 'payment_success',
          path: typeof window !== 'undefined' ? window.location?.pathname : undefined,
        }),
        keepalive: true,
      }).catch(() => {})
    } catch {
      // ignore
    }
  }, [])

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        color: 'var(--text)',
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'rgba(15,15,30,0.85)',
          border: '1px solid var(--border)',
          borderRadius: 22,
          padding: 'clamp(24px, 5vw, 36px)',
          boxShadow: '0 16px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(59, 130, 246,0.08) inset',
          textAlign: 'center',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            margin: '0 auto 14px',
            background: 'linear-gradient(135deg, rgba(52,211,153,.25), rgba(52,211,153,.10))',
            border: '1px solid rgba(52,211,153,.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            color: '#34d399',
            fontWeight: 900,
          }}
        >
          ✓
        </div>
        <h1
          style={{
            fontSize: 'clamp(1.6rem, 5vw, 2rem)',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          You&apos;re in! 🎉
        </h1>
        <p
          style={{
            marginTop: 10,
            fontSize: '1rem',
            color: 'var(--muted2)',
            lineHeight: 1.55,
          }}
        >
          Your 7-day trial has started. Make your first viral Short now.
        </p>
        <p
          style={{
            marginTop: 6,
            fontSize: '0.9rem',
            color: 'var(--muted2)',
            lineHeight: 1.55,
          }}
        >
          Credits charged only on successful videos.
        </p>
        <p
          style={{
            marginTop: 8,
            fontSize: '0.85rem',
            color: 'var(--muted)',
            lineHeight: 1.55,
          }}
        >
          If your credits do not appear immediately, refresh in a few seconds.
        </p>

        <div
          style={{
            marginTop: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <Link
            href="/generate"
            style={{
              display: 'block',
              textAlign: 'center',
              textDecoration: 'none',
              padding: '14px 22px',
              borderRadius: 14,
              fontSize: '0.95rem',
              fontWeight: 900,
              color: '#FFFFFF',
              background: '#3B82F6',
              boxShadow: '0 10px 32px rgba(59, 130, 246,.4)',
              letterSpacing: '-0.01em',
            }}
          >
            Generate Your First Video →
          </Link>
          <Link
            href="/my-videos"
            style={{
              display: 'block',
              textAlign: 'center',
              textDecoration: 'none',
              padding: '12px 22px',
              borderRadius: 14,
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'var(--muted2)',
              background: 'rgba(255,255,255,.03)',
              border: '1px solid var(--border)',
            }}
          >
            View My Videos
          </Link>
        </div>
      </div>
    </main>
  )
}
