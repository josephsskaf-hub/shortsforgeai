'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface AccountClientProps {
  email: string
  isPro: boolean
  generationsUsed: number
  hasStripeCustomer: boolean
  createdAt: string | null
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function AccountClient({ email, isPro, generationsUsed, hasStripeCustomer, createdAt }: AccountClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const [portalLoading, setPortalLoading] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // Free-tier video credits — kept in sync with DEFAULT_CREDITS in
  // app/api/credits/route.ts and the signup/welcome-email copy.
  const FREE_LIMIT = 3
  const freeRemaining = Math.max(0, FREE_LIMIT - generationsUsed)
  const initial = (email?.[0] ?? 'U').toUpperCase()

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const [portalError, setPortalError] = useState<string | null>(null)
  async function handlePortal() {
    setPortalLoading(true)
    setPortalError(null)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.url) {
        window.location.href = data.url
        return
      }
      // No URL means the request failed — show the user instead of leaving the
      // button spinning forever.
      setPortalError(data?.error || 'Could not open the billing portal. Please retry.')
    } catch {
      setPortalError('Could not open the billing portal. Please retry.')
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <div className="px-6 py-7 pb-20">
      {/* Header */}
      <div className="mb-8">
        <div className="font-black uppercase tracking-widest mb-1" style={{ fontSize: '0.62rem', color: 'var(--indigo-light)' }}>
          My Account
        </div>
        <h1 className="font-black tracking-tight mb-2" style={{ fontSize: '1.45rem', color: 'var(--text)', lineHeight: 1.15 }}>
          Account <span style={{ background: 'linear-gradient(135deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Settings</span>
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Manage your account and video credits</p>
      </div>

      <div className="flex flex-col gap-5" style={{ maxWidth: 640 }}>
        {/* Profile card */}
        <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="font-bold text-sm mb-5" style={{ color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.65rem' }}>Profile</h2>
          <div className="flex items-center gap-4 mb-5">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)', boxShadow: '0 4px 18px rgba(99,102,241,.4)', fontSize: '1.3rem' }}
            >
              {initial}
            </div>
            <div>
              <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>{email}</div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-bold"
                  style={{
                    background: isPro ? 'rgba(16,185,129,.1)' : 'rgba(99,102,241,.1)',
                    border: isPro ? '1px solid rgba(16,185,129,.25)' : '1px solid rgba(99,102,241,.2)',
                    color: isPro ? '#34d399' : 'var(--indigo-light)',
                  }}
                >
                  {isPro ? '⭐ Pro Plan' : 'Free Plan'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between py-3" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Email</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--text2)' }}>{email}</span>
            </div>
            <div className="flex items-center justify-between py-3" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Member since</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--text2)' }}>{formatDate(createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Usage card */}
        <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="font-bold text-sm mb-5" style={{ color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.65rem' }}>Usage</h2>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="rounded-xl p-4" style={{ background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.12)' }}>
              <div className="font-black text-xl" style={{ color: 'var(--text)' }}>{generationsUsed}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Scripts Generated</div>
            </div>
            <div className="rounded-xl p-4" style={{ background: isPro ? 'rgba(16,185,129,.06)' : 'rgba(99,102,241,.06)', border: isPro ? '1px solid rgba(16,185,129,.12)' : '1px solid rgba(99,102,241,.12)' }}>
              <div className="font-black text-xl" style={{ color: isPro ? '#34d399' : 'var(--text)' }}>
                {isPro ? '∞' : freeRemaining}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                {isPro ? 'Unlimited (Pro)' : 'Free Left'}
              </div>
            </div>
          </div>

          {!isPro && (
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}>
              <div className="px-4 py-2 flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Free tier usage</span>
                <span className="text-xs font-bold" style={{ color: 'var(--text2)' }}>{generationsUsed} / {FREE_LIMIT}</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,.06)' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (generationsUsed / FREE_LIMIT) * 100)}%`,
                    background: generationsUsed >= FREE_LIMIT
                      ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                      : 'linear-gradient(90deg, #6366f1, #7c3aed)',
                    transition: 'width .4s ease',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Subscription card */}
        <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="font-bold text-sm mb-5" style={{ color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.65rem' }}>Plan & Credits</h2>

          {isPro ? (
            <div>
              <div className="flex items-center gap-3 mb-5 p-4 rounded-xl" style={{ background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.18)' }}>
                <span className="text-2xl">✅</span>
                <div>
                  <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>Pro Plan — Active</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Unlimited generations included</div>
                </div>
              </div>
              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="w-full rounded-xl py-3 text-sm font-bold transition-all"
                style={{
                  background: 'rgba(255,255,255,.05)',
                  border: '1px solid var(--border2)',
                  color: 'var(--text2)',
                  cursor: portalLoading ? 'not-allowed' : 'pointer',
                  opacity: portalLoading ? 0.7 : 1,
                }}
              >
                {portalLoading ? 'Opening...' : '⚙️ Manage Billing'}
              </button>
              {portalError && (
                <p className="text-xs mt-2" style={{ color: '#f87171' }} role="alert">
                  {portalError}
                </p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-5 p-4 rounded-xl" style={{ background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.14)' }}>
                <span className="text-2xl">⚡</span>
                <div>
                  <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>Free Plan</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>3 free video credits · Upgrade to go unlimited</div>
                </div>
              </div>
              <Link
                href="/pricing"
                className="block w-full text-center rounded-xl py-3 text-sm font-black text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)', boxShadow: '0 4px 22px rgba(99,102,241,.35)', textDecoration: 'none' }}
              >
                🎬 Get 10 Videos — $9 (one-time)
              </Link>
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.65rem' }}>Session</h2>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold transition-all"
            style={{
              background: 'rgba(239,68,68,.06)',
              border: '1px solid rgba(239,68,68,.16)',
              color: '#f87171',
              cursor: signingOut ? 'not-allowed' : 'pointer',
              opacity: signingOut ? 0.7 : 1,
            }}
          >
            <span>🚪</span>
            {signingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  )
}
