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
    // Internal analytics event
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

    // Google Ads purchase conversion — fires once per checkout session.
    // The base gtag tag (AW-18156258081) is already loaded in app/layout.tsx.
    // send_to format: 'AW-<CONVERSION_ID>/<CONVERSION_LABEL>'
    // To get the label: Google Ads → Metas → Resumo → click "Compra" →
    //   Ações de conversão → click "Compra" row → Tab "Configuração da tag"
    //   Copy the label from the gtag snippet, e.g. 'AW-18156258081/AbCdEfGhIjKl'
    try {
      if (typeof window !== 'undefined' && typeof (window as Window & { gtag?: Function }).gtag === 'function') {
        ;(window as Window & { gtag: Function }).gtag('event', 'conversion', {
          send_to: 'AW-18156258081/REPLACE_WITH_COMPRA_LABEL',
          // value and currency are optional but improve bid optimisation
          // value: 4.90,
          // currency: 'BRL',
        })
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
          boxShadow: '0 16px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(99,102,241,0.08) inset',
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
          Welcome to ShortsForgeAI.
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
            color: '#34d399',
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
              background: 'linear-gradient(135deg, #2563EB 0%, #7c3aed 55%, #a855f7 100%)',
              boxShadow: '0 10px 32px rgba(99,102,241,.45)',
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
