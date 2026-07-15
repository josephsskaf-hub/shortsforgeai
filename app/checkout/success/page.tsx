'use client'

// Push #063 — Checkout success page.
// Push #123 — auto-redirect to /generate after 5 seconds.

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CheckoutSuccessPage() {
  const router = useRouter()
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const sessionId = sp.get('session_id') || ''
    const purchaseCurrency = (sp.get('currency') ?? 'usd').toUpperCase()
    const purchaseAmountTotal = Number(sp.get('amount') ?? 490)
    const purchaseValue = purchaseAmountTotal / 100

    // KINEO-PAYMENT-EVENT-2026-07-15 — `payment_success` is now written once
    // by the verified Stripe webhook. This client event only measures whether
    // the buyer actually saw the success page, so refreshes cannot inflate
    // canonical payment counts.
    try {
      void fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: 'checkout_success_viewed',
          name: 'checkout_success_viewed',
          path: window.location?.pathname,
          session_id: sessionId,
          metadata: {
            stripe_session_id: sessionId,
            amount_total: purchaseAmountTotal,
            currency: purchaseCurrency.toLowerCase(),
          },
        }),
        keepalive: true,
      }).catch(() => {})
    } catch {
      // ignore
    }

    // #376 — read Stripe checkout_session_id from the URL and use it as the
    // transaction_id so Google Ads + TikTok DEDUPLICATE the purchase if the
    // user refreshes the success page (same session_id = same conversion).
    // Google Ads purchase conversion — fires once per checkout session.
    // currency and amount come from the Stripe checkout route via URL params
    // so the value is always correct (USD for international, BRL for Brazil).
    // transaction_id (Stripe session id) makes Google dedup refreshes.
    try {
      const gtag = (window as unknown as { gtag?: Function }).gtag
      if (typeof gtag === 'function') {
        gtag('event', 'conversion', {
          send_to: 'AW-18156258081/NL4bCKXEwa4cEKGGytFD',
          value: purchaseValue,
          currency: purchaseCurrency,
          transaction_id: sessionId,
        })
      }
    } catch {
      // silent — never break the page
    }

    // #375/#376 — TikTok Pixel: Purchase conversion. event_id = Stripe session id
    // so TikTok dedups refreshes (and matches server events if added later).
    try {
      const ttq = (window as Window & { ttq?: { track: Function } }).ttq
      if (ttq && typeof ttq.track === 'function') {
        ttq.track('Purchase', {
          value: purchaseValue,
          currency: purchaseCurrency,
          content_type: 'product',
          content_name: 'Kineo subscription',
        }, { event_id: sessionId })
      }
    } catch {
      // silent — never break the page
    }
  }, [])

  useEffect(() => {
    if (countdown <= 0) {
      router.push('/generate')
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown, router])

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
          background: 'rgba(11,17,32,0.85)',
          border: '1px solid var(--border)',
          borderRadius: 22,
          padding: 'clamp(24px, 5vw, 36px)',
          boxShadow: '0 16px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(20,184,166,0.08) inset',
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
            background: 'linear-gradient(135deg, rgba(41,151,255,.25), rgba(41,151,255,.10))',
            border: '1px solid rgba(41,151,255,.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            color: '#2997ff',
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
          Welcome to Kineo.
        </h1>
        <p
          style={{
            marginTop: 10,
            fontSize: '1rem',
            color: 'var(--muted2)',
            lineHeight: 1.55,
          }}
        >
          Your plan is being activated.
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
        <p
          style={{
            marginTop: 14,
            fontSize: '0.9rem',
            color: '#2997ff',
            fontWeight: 700,
            letterSpacing: '-0.01em',
          }}
        >
          Redirecting to the app in {countdown}…
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
              color: '#fff',
              background: 'linear-gradient(135deg, #2997ff 0%, #2997ff 55%, #2997ff 100%)',
              boxShadow: '0 10px 32px rgba(41,151,255,.45)',
              letterSpacing: '-0.01em',
            }}
          >
            Go to Generate Video
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
