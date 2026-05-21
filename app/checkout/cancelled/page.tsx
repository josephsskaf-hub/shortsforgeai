'use client'

// Push #063 — Checkout cancelled page.
// Push #123 — auto-redirect to /pricing after 5 seconds.

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Push #175 — use checkout GET route instead of hardcoded Stripe links.
const STRIPE_LINKS = {
  basic: '/api/stripe/checkout?tier=basic',
  pro: '/api/stripe/checkout?tier=pro',
}

function trackEvent(name: string) {
  try {
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_name: name, name }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // ignore
  }
}

export default function CheckoutCancelledPage() {
  const router = useRouter()
  const [countdown, setCountdown] = useState(5)

  useEffect(() => { trackEvent('checkout_cancelled') }, [])

  useEffect(() => {
    if (countdown <= 0) { router.push('/pricing'); return }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown, router])

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
      <div style={{ width: '100%', maxWidth: 560, background: 'rgba(11,17,32,0.85)', border: '1px solid var(--border)', borderRadius: 22, padding: 'clamp(24px, 5vw, 36px)', boxShadow: '0 16px 60px rgba(0,0,0,.5)' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 'clamp(1.5rem, 4.5vw, 1.9rem)', fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>Payment was not completed.</h1>
          <p style={{ marginTop: 10, fontSize: '0.95rem', color: 'var(--muted2)', lineHeight: 1.55 }}>Your card was not charged if checkout was not completed.</p>
          <p style={{ marginTop: 10, fontSize: '0.88rem', color: '#93c5fd', fontWeight: 700 }}>Redirecting to pricing in {countdown}…</p>
        </div>
        <div style={{ marginTop: 22, background: 'linear-gradient(135deg, rgba(37,99,235,.10), rgba(124,58,237,.06))', border: '1px solid rgba(37,99,235,.30)', borderRadius: 16, padding: 18 }}>
          <p style={{ fontSize: '0.92rem', color: 'var(--text)', fontWeight: 700, margin: 0 }}>Still want to create more videos?</p>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted2)', margin: '4px 0 14px', lineHeight: 1.5 }}>Failed generations never consume credits. Start a plan and keep creating.</p>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <a href={STRIPE_LINKS.basic} onClick={() => trackEvent('basic_checkout_clicked')} style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '12px 14px', borderRadius: 12, fontSize: '0.88rem', fontWeight: 900, color: '#fff', background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>Basic — $9.90/mo →</a>
            <a href={STRIPE_LINKS.pro} onClick={() => trackEvent('pro_checkout_clicked')} style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '12px 14px', borderRadius: 12, fontSize: '0.88rem', fontWeight: 900, color: '#fff', background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>Pro — $19.90/mo →</a>
          </div>
        </div>
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, fontSize: '0.85rem' }}>
          <Link href="/pricing" style={{ color: '#93c5fd', textDecoration: 'none', fontWeight: 700 }}>← Go back to pricing</Link>
          <a href="mailto:hello@shortsforgeai.com" style={{ color: 'var(--muted2)', textDecoration: 'none', fontWeight: 600 }}>Contact support</a>
        </div>
      </div>
    </main>
  )
}
