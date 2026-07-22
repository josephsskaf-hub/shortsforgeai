'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { trackEvent } from '@/lib/analytics'

type ResumeOffer = {
  available: true
  resumeUrl: string
  destinationKind: 'open_session' | 'stripe_recovery' | 'internal_retry'
  planName: string
  tier: 'starter' | 'basic' | 'pro'
  billing: 'monthly' | 'annual'
  currency: string
  firstChargeAmount: number
  renewalAmount: number
}

const HIDDEN_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth',
  '/checkout/success',
  '/checkout/cancelled',
]

function shouldHide(pathname: string): boolean {
  return HIDDEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(currency === 'brl' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  } catch {
    return `${currency.toUpperCase()} ${(amount / 100).toFixed(2)}`
  }
}

export default function CheckoutResumeBanner() {
  const pathname = usePathname()
  const [offer, setOffer] = useState<ResumeOffer | null>(null)
  const viewedKey = useRef<string | null>(null)

  useEffect(() => {
    if (shouldHide(pathname)) {
      setOffer(null)
      return
    }

    const controller = new AbortController()
    void fetch('/api/stripe/checkout/resume', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return null
        return response.json() as Promise<ResumeOffer | { available: false }>
      })
      .then((result) => {
        if (!result || result.available !== true) {
          setOffer(null)
          return
        }
        setOffer(result)
        const key = [
          result.tier,
          result.billing,
          result.currency,
          result.firstChargeAmount,
          result.renewalAmount,
          result.destinationKind,
        ].join(':')
        if (viewedKey.current !== key) {
          viewedKey.current = key
          void trackEvent('checkout_resume_banner_viewed', {
            tier: result.tier,
            billing: result.billing,
            currency: result.currency,
            first_charge_amount: result.firstChargeAmount,
            renewal_amount: result.renewalAmount,
            destination_kind: result.destinationKind,
          })
        }
      })
      .catch(() => {
        // Checkout recovery is optional and must never disturb the page.
      })

    return () => controller.abort()
  }, [pathname])

  if (!offer || shouldHide(pathname)) return null

  const firstCharge = formatMoney(offer.firstChargeAmount, offer.currency)
  const renewal = formatMoney(offer.renewalAmount, offer.currency)
  const renewalUnit = offer.billing === 'annual' ? 'year' : 'month'
  const eventMetadata = {
    tier: offer.tier,
    billing: offer.billing,
    currency: offer.currency,
    first_charge_amount: offer.firstChargeAmount,
    renewal_amount: offer.renewalAmount,
    destination_kind: offer.destinationKind,
  }

  const dismiss = () => {
    setOffer(null)
    void trackEvent('checkout_resume_banner_dismissed', eventMetadata)
    void fetch('/api/stripe/checkout/resume', {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => {
      // The in-memory dismissal still prevents a disruptive retry loop.
    })
  }

  return (
    <aside
      aria-label="Resume secure checkout"
      aria-live="polite"
      style={{
        position: 'fixed',
        zIndex: 10050,
        left: '50%',
        bottom: 16,
        transform: 'translateX(-50%)',
        width: 'min(680px, calc(100vw - 24px))',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 14px',
        border: '1px solid rgba(41,151,255,.4)',
        borderRadius: 16,
        background: 'rgba(11,17,32,.97)',
        color: '#f8fafc',
        boxShadow: '0 18px 55px rgba(0,0,0,.48)',
        backdropFilter: 'blur(14px)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '0.88rem', lineHeight: 1.25, fontWeight: 850 }}>
          Your {offer.planName} checkout is saved
        </div>
        <div style={{ marginTop: 3, color: '#aeb9cc', fontSize: '0.76rem', lineHeight: 1.35 }}>
          First charge {firstCharge} · renews at {renewal}/{renewalUnit}. Cancel anytime.
        </div>
      </div>
      <a
        href={offer.resumeUrl}
        onClick={() => {
          void trackEvent('checkout_resume_banner_clicked', eventMetadata)
        }}
        style={{
          flex: '0 0 auto',
          borderRadius: 10,
          padding: '9px 12px',
          background: 'linear-gradient(135deg, #2997ff, #1d6fe0)',
          color: '#fff',
          fontSize: '0.78rem',
          fontWeight: 850,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Resume checkout
      </a>
      <button
        type="button"
        aria-label="Dismiss checkout reminder"
        onClick={dismiss}
        style={{
          flex: '0 0 auto',
          width: 28,
          height: 28,
          padding: 0,
          border: 0,
          borderRadius: 8,
          background: 'transparent',
          color: '#8d99ac',
          cursor: 'pointer',
          fontSize: 20,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </aside>
  )
}
