'use client'

// Push #063 — Checkout cancelled page.
// Push #123 — auto-redirect to /pricing after 5 seconds.

import Link from 'next/link'
import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { trackCheckoutClick } from '@/lib/trackClick'

// Push #175 — use checkout GET route instead of hardcoded Stripe links.
// KINEO-SPRINT-FIX-2026-07-15 — plan/offer preservation: buyers who abandon an
// intro-month checkout land HERE via cancel_url, and the old retry link
// re-entered checkout at FULL price (intro dropped → second-chance conversion
// killed). Carry ?intro=1 on the Creator retry; the server validates
// eligibility (1 per customer, monthly only), so this can never double-apply.
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
  return (
    <Suspense fallback={<main style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
      <CheckoutCancelledContent />
    </Suspense>
  )
}

function CheckoutCancelledContent() {
  const searchParams = useSearchParams()
  const rawTier = searchParams.get('tier')
  const tier: 'starter' | 'basic' | 'pro' =
    rawTier === 'starter' || rawTier === 'pro' ? rawTier : 'basic'
  const billing = searchParams.get('billing') === 'annual' ? 'annual' : 'monthly'
  const intro = searchParams.get('intro') === '1' && billing === 'monthly' && tier !== 'pro'
  const returnToWatermark = searchParams.get('return') === 'wm'
  const retryParams = new URLSearchParams({ tier, billing })
  if (intro) retryParams.set('intro', '1')
  if (returnToWatermark) retryParams.set('return', 'wm')
  const retryHref = `/api/stripe/checkout?${retryParams.toString()}`
  const planName = tier === 'starter' ? 'Starter' : tier === 'pro' ? 'Studio' : 'Creator'
  const todayPrice = intro
    ? tier === 'starter' ? '$4.90 today' : '$9.90 today'
    : tier === 'starter' ? '$9.90/month' : tier === 'pro' ? '$37.90/month' : '$24.90/month'
  const renewalCopy = intro
    ? tier === 'starter'
      ? 'Renews at $9.90/month in 30 days. Cancel anytime.'
      : 'Renews at $24.90/month in 30 days. Cancel anytime.'
    : 'Your saved plan and billing period will be preserved.'

  useEffect(() => { trackEvent('checkout_cancelled') }, [])

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
      <div style={{ width: '100%', maxWidth: 560, background: 'rgba(11,17,32,0.85)', border: '1px solid var(--border)', borderRadius: 22, padding: 'clamp(24px, 5vw, 36px)', boxShadow: '0 16px 60px rgba(0,0,0,.5)' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 'clamp(1.5rem, 4.5vw, 1.9rem)', fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>Payment was not completed.</h1>
          <p style={{ marginTop: 10, fontSize: '0.95rem', color: 'var(--muted2)', lineHeight: 1.55 }}>Your card was not charged if checkout was not completed.</p>
          <p style={{ marginTop: 10, fontSize: '0.88rem', color: '#2997ff', fontWeight: 700 }}>Your selected plan is saved below.</p>
        </div>
        <div style={{ marginTop: 22, background: 'linear-gradient(135deg, rgba(5,150,105,.10), rgba(5,150,105,.06))', border: '1px solid rgba(5,150,105,.30)', borderRadius: 16, padding: 18 }}>
          <p style={{ fontSize: '0.92rem', color: 'var(--text)', fontWeight: 700, margin: 0 }}>{planName} — {todayPrice}</p>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted2)', margin: '4px 0 14px', lineHeight: 1.5 }}>{renewalCopy}</p>
          <a
            href={retryHref}
            onClick={() => { trackEvent(`${tier}_checkout_retry_clicked`); trackCheckoutClick(tier) }}
            style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '13px 14px', borderRadius: 12, fontSize: '0.9rem', fontWeight: 900, color: '#fff', background: 'linear-gradient(135deg, #2997ff, #1d6fe0)', boxShadow: '0 8px 24px rgba(41,151,255,.28)' }}
          >
            Try secure checkout again →
          </a>
        </div>
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, fontSize: '0.85rem' }}>
          <Link href="/pricing" style={{ color: '#2997ff', textDecoration: 'none', fontWeight: 700 }}>← Go back to pricing</Link>
          <a href="mailto:support@usekineo.com" style={{ color: 'var(--muted2)', textDecoration: 'none', fontWeight: 600 }}>Contact support</a>
        </div>
      </div>
    </main>
  )
}
