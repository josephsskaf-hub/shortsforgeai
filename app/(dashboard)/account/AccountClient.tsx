'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface AccountClientProps {
  email: string
  isPro: boolean
  generationsUsed: number
  hasStripeCustomer: boolean
  createdAt: string | null
  planTier?: 'free' | 'basic' | 'pro'
}

type TabKey = 'members' | 'profile' | 'manage' | 'usage'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'members', label: 'Members', icon: '👥' },
  { key: 'profile', label: 'Profile', icon: '👤' },
  { key: 'manage', label: 'Manage Account', icon: '⚙' },
  { key: 'usage', label: 'Usage', icon: '📊' },
]

function isTabKey(v: string | null | undefined): v is TabKey {
  return v === 'members' || v === 'profile' || v === 'manage' || v === 'usage'
}

// Plan credit caps for the usage card. Kept in sync with lib/pricing.ts:
// Free = 2, Basic = 50/mo, Pro = 100/mo.
const PLAN_LIMITS = { free: 2, basic: 50, pro: 100 } as const

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function AccountClient(props: AccountClientProps) {
  return (
    <Suspense fallback={null}>
      <AccountInner {...props} />
    </Suspense>
  )
}

function AccountInner({ email, isPro, createdAt, planTier }: AccountClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const rawTab = searchParams.get('tab')
  const activeTab: TabKey = isTabKey(rawTab) ? rawTab : 'profile'

  const tier: 'free' | 'basic' | 'pro' = planTier ?? (isPro ? 'pro' : 'free')
  const planLimit = PLAN_LIMITS[tier]
  const planLabel = tier === 'pro' ? 'Pro Plan' : tier === 'basic' ? 'Basic Plan' : 'Free Plan'
  const initial = (email?.[0] ?? 'U').toUpperCase()

  // Pull the user's display name from supabase auth metadata, plus their
  // current credit balance for the Usage tab.
  const [fullName, setFullName] = useState('')
  const [credits, setCredits] = useState<number | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return
      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>
      const name =
        (typeof meta.full_name === 'string' && meta.full_name) ||
        (typeof meta.name === 'string' && meta.name) ||
        ''
      setFullName(name)
    })
    return () => { cancelled = true }
  }, [supabase])

  useEffect(() => {
    let cancelled = false
    fetch('/api/credits', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setCredits(typeof data.credits === 'number' ? data.credits : 0)
      })
      .catch(() => { if (!cancelled) setCredits(0) })
    return () => { cancelled = true }
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

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
      setPortalError(data?.error || 'Could not open the billing portal. Please retry.')
    } catch {
      setPortalError('Could not open the billing portal. Please retry.')
    } finally {
      setPortalLoading(false)
    }
  }

  const creditsRemaining = credits ?? 0
  // We don't track per-cycle used credits in the DB, so "used this cycle" is
  // a best-effort derivation: plan cap minus remaining. For Free this is just
  // "starter credits used".
  const usedThisCycle = Math.max(0, planLimit - creditsRemaining)
  const usagePct = planLimit > 0 ? Math.min(100, (usedThisCycle / planLimit) * 100) : 0

  return (
    // Push #052 — tighter horizontal padding on mobile so cards don't get
    // squeezed against the viewport edge on iPhone widths.
    <div className="px-4 sm:px-6 py-7 pb-20">
      {/* Header */}
      <div className="mb-6">
        <div className="font-black uppercase tracking-widest mb-1" style={{ fontSize: '0.62rem', color: 'var(--indigo-light)' }}>
          My Account
        </div>
        <h1 className="font-black tracking-tight mb-2" style={{ fontSize: '1.45rem', color: 'var(--text)', lineHeight: 1.15 }}>
          Account <span style={{ background: 'linear-gradient(135deg, #60A5FA, #22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Settings</span>
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
          Signed in as <span style={{ color: 'var(--text2)' }}>{email}</span>
        </p>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 mb-6 rounded-xl p-1 overflow-x-auto"
        style={{ background: 'rgba(15,15,30,0.7)', border: '1px solid var(--border)', maxWidth: 640 }}
      >
        {TABS.map((t) => {
          const active = t.key === activeTab
          return (
            <Link
              key={t.key}
              href={`/account?tab=${t.key}`}
              scroll={false}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold flex-shrink-0"
              style={{
                background: active ? 'linear-gradient(135deg, rgba(59, 130, 246,.25), rgba(37, 99, 235,.18))' : 'transparent',
                border: active ? '1px solid rgba(59, 130, 246,.32)' : '1px solid transparent',
                color: active ? '#60A5FA' : 'var(--muted2)',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </Link>
          )
        })}
      </div>

      <div style={{ maxWidth: 640 }}>
        {/* ── Members ── */}
        {activeTab === 'members' && (
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h2 className="font-bold mb-5" style={{ color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.65rem' }}>Owner</h2>
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', boxShadow: '0 4px 18px rgba(59, 130, 246,.4)' }}
                >
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                    {fullName || email.split('@')[0]}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{email}</div>
                </div>
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-bold flex-shrink-0"
                  style={{
                    background: 'rgba(16,185,129,.1)',
                    border: '1px solid rgba(16,185,129,.25)',
                    color: '#34d399',
                  }}
                >
                  Owner
                </span>
              </div>
            </div>

            <div
              className="rounded-2xl p-6"
              style={{ background: 'rgba(59, 130, 246,.05)', border: '1px dashed rgba(59, 130, 246,.25)' }}
            >
              <p className="text-sm" style={{ color: 'var(--text2)' }}>
                Team members will be available soon.
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                You&apos;ll be able to invite collaborators to share credits and projects in a future update.
              </p>
            </div>
          </div>
        )}

        {/* ── Profile ── */}
        {activeTab === 'profile' && (
          <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <h2 className="font-bold mb-5" style={{ color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.65rem' }}>Profile</h2>
            <div className="flex items-center gap-4 mb-6">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', boxShadow: '0 4px 18px rgba(59, 130, 246,.4)' }}
              >
                {initial}
              </div>
              <div>
                <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>{fullName || email.split('@')[0]}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{email}</div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <ReadOnlyRow label="Full name" value={fullName || '—'} />
              <ReadOnlyRow label="Email" value={email} />
              <ReadOnlyRow label="Plan" value={planLabel} />
              <ReadOnlyRow label="Member since" value={formatDate(createdAt)} />
            </div>

            <p className="text-xs mt-5" style={{ color: 'var(--muted)' }}>
              Profile editing will be available soon. Email and plan are managed automatically.
            </p>
          </div>
        )}

        {/* ── Manage Account ── */}
        {activeTab === 'manage' && (
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h2 className="font-bold mb-5" style={{ color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.65rem' }}>Account</h2>
              <div className="flex flex-col gap-3">
                <ReadOnlyRow label="Account email" value={email} />
                <ReadOnlyRow label="Plan" value={planLabel} />
                <ReadOnlyRow label="Member since" value={formatDate(createdAt)} />
              </div>
            </div>

            <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h2 className="font-bold mb-4" style={{ color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.65rem' }}>Billing</h2>
              {tier !== 'free' ? (
                <>
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
                    {portalLoading ? 'Opening…' : '⚙ Manage Billing'}
                  </button>
                  {portalError && (
                    <p className="text-xs mt-2" style={{ color: '#f87171' }} role="alert">{portalError}</p>
                  )}
                </>
              ) : (
                <Link
                  href="/pricing"
                  className="block w-full text-center rounded-xl py-3 text-sm font-black text-white"
                  style={{
                    background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 55%, #22D3EE 100%)',
                    boxShadow: '0 4px 22px rgba(59, 130, 246,.35)',
                    textDecoration: 'none',
                  }}
                >
                  🎬 Upgrade to Pro
                </Link>
              )}
            </div>

            <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h2 className="font-bold mb-4" style={{ color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.65rem' }}>Session</h2>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold"
                style={{
                  background: 'rgba(239,68,68,.06)',
                  border: '1px solid rgba(239,68,68,.16)',
                  color: '#f87171',
                  cursor: signingOut ? 'not-allowed' : 'pointer',
                  opacity: signingOut ? 0.7 : 1,
                }}
              >
                <span>🚪</span>
                {signingOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </div>

            <div
              className="rounded-2xl p-6"
              style={{ background: 'rgba(239,68,68,.04)', border: '1px dashed rgba(239,68,68,.2)' }}
            >
              <h2 className="font-bold mb-2" style={{ color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.65rem' }}>Danger zone</h2>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Account deletion is not available from here yet. Email{' '}
                <a href="mailto:josephsskaf@gmail.com" style={{ color: '#fca5a5' }}>josephsskaf@gmail.com</a>{' '}
                to request deletion.
              </p>
            </div>
          </div>
        )}

        {/* ── Usage ── */}
        {activeTab === 'usage' && (
          <div className="flex flex-col gap-5">
            <div className="rounded-2xl p-6" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              <h2 className="font-bold mb-5" style={{ color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.65rem' }}>Credits</h2>

              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="rounded-xl p-4" style={{ background: 'rgba(59, 130, 246,.06)', border: '1px solid rgba(59, 130, 246,.12)' }}>
                  <div className="font-black text-xl" style={{ color: 'var(--text)' }}>{creditsRemaining}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Available credits</div>
                </div>
                <div className="rounded-xl p-4" style={{ background: 'rgba(59, 130, 246,.06)', border: '1px solid rgba(59, 130, 246,.12)' }}>
                  <div className="font-black text-xl" style={{ color: 'var(--text)' }}>{planLimit}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    {tier === 'free' ? 'Free plan credits' : 'Monthly included'}
                  </div>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}>
                <div className="px-4 py-2 flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    {tier === 'free' ? 'Free tier usage' : 'This month'}
                  </span>
                  <span className="text-xs font-bold" style={{ color: 'var(--text2)' }}>
                    {creditsRemaining} / {planLimit} left
                  </span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,.06)' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${usagePct}%`,
                      background: usagePct >= 90
                        ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                        : 'linear-gradient(90deg, #3B82F6, #2563EB)',
                      transition: 'width .4s ease',
                    }}
                  />
                </div>
              </div>

              <ul className="text-xs mt-5 space-y-1.5" style={{ color: 'var(--muted2)', paddingLeft: 18 }}>
                <li>Basic = <strong style={{ color: 'var(--text)' }}>50 Fast Mode videos / month</strong></li>
                <li>Pro = <strong style={{ color: 'var(--text)' }}>100 Fast Mode videos + 1 Cinematic / month</strong></li>
              </ul>

              <p className="text-xs mt-4" style={{ color: 'var(--muted)' }}>
                Credits are charged only when a video is successfully generated. Failed or cancelled generations don&apos;t use credits.
              </p>
            </div>

            <div
              className="rounded-2xl p-5"
              style={{ background: 'rgba(15,15,30,0.7)', border: '1px dashed var(--border)' }}
            >
              <div className="text-xs font-bold mb-1" style={{ color: 'var(--text2)' }}>Stock library</div>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Stock usage tracking is not connected yet.
              </p>
            </div>

            <div
              className="rounded-2xl p-5"
              style={{ background: 'rgba(15,15,30,0.7)', border: '1px dashed var(--border)' }}
            >
              <div className="text-xs font-bold mb-1" style={{ color: 'var(--text2)' }}>Storage</div>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Storage tracking is not connected yet.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 gap-4" style={{ borderTop: '1px solid var(--border)' }}>
      <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>{label}</span>
      <span
        className="text-xs font-semibold text-right"
        style={{ color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {value}
      </span>
    </div>
  )
}
