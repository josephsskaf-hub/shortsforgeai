'use client'

// Push #063 — Checkout cancelled page.
// Push #123 — auto-redirect to /pricing after 5 seconds.

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const STRIPE_LINKS = {
    basic: 'https://buy.stripe.com/fZu8wP24tePZbareNggjC0n',
    pro: 'https://buy.stripe.com/8x214nbF323ddizcF8gjC0o',
}

function trackEvent(name: string) {
    try {
          void fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_name: name, name }), keepalive: true }).catch(() => {})
    } catch { /* ignore */ }
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
                <div style={{ width: '100%', maxWidth: 560, background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)', borderRadius: 22, padding: 'clamp(24px, 5vw, 36px)', boxShadow: '0 16px 60px rgba(0,0,0,.5)' }}>
                          <div style={{ textAlign: 'center' }}>
                                      <h1 style={{ fontSize: 'clamp(1.5rem, 4.5vw, 1.9rem)', fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>Payment was not completed.</h1>h1>
                                      <p style={{ marginTop: 10, fontSize: '0.95rem', color: 'var(--muted2)', lineHeight: 1.55 }}>Your card was not charged if checkout was not completed.</p>p>
                                      <p style={{ marginTop: 10, fontSize: '0.88rem', color: '#93c5fd', fontWeight: 700 }}>Redirecting to pricing in {countdown}…</p>p>
                          </div>div>
                          <div style={{ marginTop: 22, background: 'linear-gradient(135deg, rgba(37,99,235,.10), rgba(124,58,237,.06))', border: '1px solid rgba(37,99,235,.30)', borderRadius: 16, padding: 18 }}>
                                      <div style={{ fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.14em', color: '#93C5FD', textTransform: 'uppercase', marginBottom: 8 }}>Launch offer still available</div>div>
                                      <p style={{ fontSize: '0.92rem', color: 'var(--text)', fontWeight: 700, margin: 0 }}>Still want to create more videos?</p>p>
                                      <p style={{ fontSize: '0.82rem', color: 'var(--muted2)', margin: '4px 0 14px', lineHeight: 1.5 }}>50% off your first month — failed generations never consume credits.</p>p>
                                      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                                                    <a href={STRIPE_LINKS.basic} onClick={() => trackEvent('basic_checkout_clicked')} style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '12px 14px', borderRadius: 12, fontSize: '0.88rem', fontWeight: 900, color: '#fff', background: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}>Try Basic — $4.50 →</a>a>
                                                    <a href={STRIPE_LINKS.pro} onClick={() => trackEvent('pro_checkout_clicked')} style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '12px 14px', borderRadius: 12, fontSize: '0.88rem', fontWeight: 900, color: '#fff', background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>Try Pro — $9.50 →</a>a>
                                      </div>div>
                          </div>div>
                          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, fontSize: '0.85rem' }}>
                                      <Link href="/pricing" style={{ color: '#93c5fd', textDecoration: 'none', fontWeight: 700 }}>← Go back to pricing</Link>Link>
                                      <a href="mailto:hello@shortsforgeai.com" style={{ color: 'var(--muted2)', textDecoration: 'none', fontWeight: 600 }}>Contact support</a>a>
                          </div>div>
                </div>div>
        </main>main>
      )
}
