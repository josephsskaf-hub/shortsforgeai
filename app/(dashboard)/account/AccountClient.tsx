'use client'

// Push #080 — Account v2: homepage-quality UI, animated credit ring, glowing avatar, polished tabs

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
  { key: 'manage', label: 'Manage', icon: '⚙️' },
  { key: 'usage', label: 'Usage', icon: '📊' },
]

function isTabKey(v: string | null | undefined): v is TabKey {
  return v === 'members' || v === 'profile' || v === 'manage' || v === 'usage'
}

// Push #430 — free tier now starts with 30 welcome credits (30 Fast videos or 1 AI video)
const PLAN_LIMITS = { free: 30, basic: 50, pro: 100 } as const
const PLAN_COLORS = {
  free: { color: '#94A3B8', bg: 'rgba(148,163,184,.1)', border: 'rgba(148,163,184,.2)' },
  basic: { color: '#22D3EE', bg: 'rgba(34,211,238,.1)', border: 'rgba(34,211,238,.2)' },
  pro: { color: '#F59E0B', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.2)' },
}

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
  const planLabel = tier === 'pro' ? '⚡ Pro Plan' : tier === 'basic' ? '🔵 Basic Plan' : '🆓 Free Plan'
  const planStyle = PLAN_COLORS[tier]
  const initial = (email?.[0] ?? 'U').toUpperCase()

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
    try {
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ])
    } catch {
      // ignore
    } finally {
      window.location.href = '/'
    }
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
      setPortalError(data?.error || 'Could not open billing portal. Please retry.')
    } catch {
      setPortalError('Could not open billing portal. Please retry.')
    } finally {
      setPortalLoading(false)
    }
  }

  const creditsRemaining = credits ?? 0
  const usedThisCycle = Math.max(0, planLimit - creditsRemaining)
  const usagePct = planLimit > 0 ? Math.min(100, (usedThisCycle / planLimit) * 100) : 0

  // SVG ring for usage visualization
  const ringR = 36
  const ringCirc = 2 * Math.PI * ringR
  const ringDash = ((100 - usagePct) / 100) * ringCirc

  return (
    <div className="px-4 sm:px-6 py-7 pb-20">
      <style>{`
        .acc-tab {
          transition: all 0.15s ease;
        }
        .acc-tab:hover {
          color: var(--text) !important;
        }
        .acc-card {
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .acc-row-btn {
          transition: all 0.15s ease;
        }
        .acc-row-btn:hover {
          background: rgba(16,185,129,.12) !important;
          transform: translateY(-1px);
        }
        @keyframes ring-fill {
          from { stroke-dashoffset: ${ringCirc}; }
          to   { stroke-dashoffset: ${ringDash}; }
        }
        .credit-ring {
          animation: ring-fill 1s ease-out forwards;
        }
        .avatar-ring {
          animation: pulse-ring 3s ease-in-out infinite;
        }
        @keyframes pulse-ring {
          0%, 100% { opacity: .6; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* ── Header ── */}
      <div className="mb-7">
        <div
          className="font-black uppercase tracking-[.18em] mb-2 flex items-center gap-2"
          style={{ fontSize: '0.65rem', color: '#22D3EE' }}
        >
          <span style={{ display: 'inline-block', width: 18, height: 1, background: '#22D3EE', verticalAlign: 'middle' }} />
          My Account
          <span style={{ display: 'inline-block', width: 18, height: 1, background: '#22D3EE', verticalAlign: 'middle' }} />
        </div>
        <h1
          className="font-black tracking-tight mb-1"
          style={{ fontSize: 'clamp(1.55rem, 4vw, 2rem)', color: 'var(--text)', lineHeight: 1.1 }}
        >
          Account{' '}
          <span style={{ background: 'linear-gradient(135deg,#22D3EE,#10B981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Settings
          </span>
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
          Signed in as <span style={{ color: 'var(--text2)' }}>{email}</span>
        </p>
      </div>

      {/* ── Tabs ── */}
      <div
        className="flex gap-1 mb-6 rounded-2xl p-1 overflow-x-auto"
        style={{ background: 'rgba(11,17,32,0.8)', border: '1px solid rgba(255,255,255,0.07)', maxWidth: 640 }}
      >
        {TABS.map((t) => {
          const active = t.key === activeTab
          return (
            <Link
              key={t.key}
              href={`/account?tab=${t.key}`}
              scroll={false}
              className="acc-tab flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold flex-shrink-0"
              style={{
                background: active
                  ? 'linear-gradient(135deg, rgba(34,211,238,.18), rgba(16,185,129,.12))'
                  : 'transparent',
                border: active ? '1px solid rgba(34,211,238,.3)' : '1px solid transparent',
                color: active ? '#22D3EE' : 'var(--muted2)',
                textDecoration: 'none',
                boxShadow: active ? '0 0 14px rgba(34,211,238,.12)' : 'none',
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </Link>
          )
        })}
      </div>

      <div style={{ maxWidth: 640 }}>

        {/* ── Members tab ── */}
        {activeTab === 'members' && (
          <div className="flex flex-col gap-4">
            <div
              className="acc-card rounded-2xl p-6"
              style={{ background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(255,255,255,.07)', backdropFilter: 'blur(12px)' }}
            >
              <h2 className="font-bold mb-5" style={{ color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.63rem' }}>
                Owner
              </h2>
              <div className="flex items-center gap-4">
                {/* Glowing avatar */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black text-white"
                    style={{ background: 'linear-gradient(135deg, #22D3EE, #10B981)', zIndex: 1, position: 'relative' }}
                  >
                    {initial}
                  </div>
                  <div
                    className="avatar-ring"
                    style={{
                      position: 'absolute', inset: -3, borderRadius: 18,
                      border: '2px solid rgba(34,211,238,.5)',
                      pointerEvents: 'none',
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                    {fullName || email.split('@')[0]}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{email}</div>
                </div>
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-bold flex-shrink-0"
                  style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)', color: '#34d399' }}
                >
                  Owner
                </span>
              </div>
            </div>

            <div
              className="rounded-2xl p-5"
              style={{ background: 'rgba(16,185,129,.04)', border: '1px dashed rgba(16,185,129,.2)', backdropFilter: 'blur(12px)' }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text2)' }}>
                👥 Team collaboration — coming soon
              </p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Invite collaborators to share credits and manage projects together in a future update.
              </p>
            </div>
          </div>
        )}

        {/* ── Profile tab ── */}
        {activeTab === 'profile' && (
          <div
            className="acc-card rounded-2xl p-6"
            style={{ background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(255,255,255,.07)', backdropFilter: 'blur(12px)' }}
          >
            <h2 className="font-bold mb-5" style={{ color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.63rem' }}>
              Profile
            </h2>

            <div className="flex items-center gap-4 mb-6">
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white"
                  style={{ background: 'linear-gradient(135deg, #22D3EE, #10B981)', position: 'relative', zIndex: 1 }}
                >
                  {initial}
                </div>
                <div
                  className="avatar-ring"
                  style={{
                    position: 'absolute', inset: -3, borderRadius: 20,
                    border: '2px solid rgba(34,211,238,.5)',
                    pointerEvents: 'none',
                  }}
                />
              </div>
              <div>
                <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>{fullName || email.split('@')[0]}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{email}</div>
                <span
                  className="inline-flex items-center mt-1.5 text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: planStyle.bg, border: `1px solid ${planStyle.border}`, color: planStyle.color }}
                >
                  {planLabel}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <ReadOnlyRow label="Full name" value={fullName || '—'} />
              <ReadOnlyRow label="Email" value={email} />
              <ReadOnlyRow label="Plan" value={planLabel.replace(/^[^ ]+ /, '')} />
              <ReadOnlyRow label="Member since" value={formatDate(createdAt)} />
            </div>

            <p className="text-xs mt-5" style={{ color: 'var(--muted)' }}>
              Profile editing coming soon. Email and plan are managed automatically.
            </p>
          </div>
        )}

        {/* ── Manage tab ── */}
        {activeTab === 'manage' && (
          <div className="flex flex-col gap-4">
            <div
              className="acc-card rounded-2xl p-6"
              style={{ background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(255,255,255,.07)', backdropFilter: 'blur(12px)' }}
            >
              <h2 className="font-bold mb-4" style={{ color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.63rem' }}>
                Account
              </h2>
              <div className="flex flex-col gap-1">
                <ReadOnlyRow label="Email" value={email} />
                <ReadOnlyRow label="Plan" value={planLabel.replace(/^[^ ]+ /, '')} />
                <ReadOnlyRow label="Member since" value={formatDate(createdAt)} />
              </div>
            </div>

            <div
              className="acc-card rounded-2xl p-6"
              style={{ background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(255,255,255,.07)', backdropFilter: 'blur(12px)' }}
            >
              <h2 className="font-bold mb-4" style={{ color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.63rem' }}>
                Billing
              </h2>
              {tier !== 'free' ? (
                <>
                  <button
                    onClick={handlePortal}
                    disabled={portalLoading}
                    className="acc-row-btn w-full rounded-xl py-3 text-sm font-bold"
                    style={{
                      background: 'rgba(255,255,255,.05)',
                      border: '1px solid rgba(255,255,255,.1)',
                      color: 'var(--text2)',
                      cursor: portalLoading ? 'not-allowed' : 'pointer',
                      opacity: portalLoading ? 0.7 : 1,
                    }}
                  >
                    {portalLoading ? 'Opening…' : '⚙️ Manage Billing'}
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
                    background: 'linear-gradient(135deg, #059669, #22D3EE)',
                    boxShadow: '0 6px 28px rgba(16,185,129,.4)',
                    textDecoration: 'none',
                    transition: 'all 0.18s ease',
                  }}
                >
                  🎬 Upgrade to Pro
                </Link>
              )}
            </div>

            <div
              className="acc-card rounded-2xl p-6"
              style={{ background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(255,255,255,.07)', backdropFilter: 'blur(12px)' }}
            >
              <h2 className="font-bold mb-4" style={{ color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.63rem' }}>
                Session
              </h2>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold"
                style={{
                  background: 'rgba(239,68,68,.07)',
                  border: '1px solid rgba(239,68,68,.18)',
                  color: '#f87171',
                  cursor: signingOut ? 'not-allowed' : 'pointer',
                  opacity: signingOut ? 0.7 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                <span>🚪</span>
                {signingOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </div>

            <div
              className="rounded-2xl p-5"
              style={{ background: 'rgba(239,68,68,.04)', border: '1px dashed rgba(239,68,68,.2)' }}
            >
              <h2 className="font-bold mb-2" style={{ color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.63rem' }}>
                Danger Zone
              </h2>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Account deletion is not available here yet. Email{' '}
                <a href="mailto:josephsskaf@gmail.com" style={{ color: '#fca5a5' }}>josephsskaf@gmail.com</a>{' '}
                to request deletion.
              </p>
            </div>
          </div>
        )}

        {/* ── Usage tab ── */}
        {activeTab === 'usage' && (
          <div className="flex flex-col gap-4">
            <div
              className="acc-card rounded-2xl p-6"
              style={{ background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(255,255,255,.07)', backdropFilter: 'blur(12px)' }}
            >
              <h2 className="font-bold mb-5" style={{ color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.63rem' }}>
                Credits
              </h2>

              {/* Credit ring + stats */}
              <div className="flex items-center gap-6 mb-5">
                {/* Animated ring */}
                <div style={{ flexShrink: 0 }}>
                  <svg width={96} height={96} viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
                    {/* Track */}
                    <circle cx={48} cy={48} r={ringR} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={7} />
                    {/* Fill */}
                    <circle
                      className="credit-ring"
                      cx={48} cy={48} r={ringR}
                      fill="none"
                      stroke={usagePct >= 90 ? '#EF4444' : '#22D3EE'}
                      strokeWidth={7}
                      strokeLinecap="round"
                      strokeDasharray={ringCirc}
                      strokeDashoffset={ringDash}
                    />
                  </svg>
                  <div
                    style={{
                      position: 'absolute',
                      // We'll use a different approach: center content over the SVG using margin trick
                    }}
                  />
                </div>

                <div className="flex flex-col gap-3 flex-1">
                  <div>
                    <div
                      className="font-black"
                      style={{
                        fontSize: '2.2rem',
                        lineHeight: 1,
                        background: usagePct >= 90
                          ? 'linear-gradient(135deg,#EF4444,#f87171)'
                          : 'linear-gradient(135deg,#22D3EE,#10B981)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }}
                    >
                      {creditsRemaining}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>credits remaining</div>
                  </div>
                  <div>
                    <div className="font-black text-lg" style={{ color: 'var(--text2)', lineHeight: 1 }}>{planLimit}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>
                      {tier === 'free' ? 'free plan total' : 'monthly included'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="rounded-xl overflow-hidden mb-4" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
                <div className="px-4 py-2 flex items-center justify-between">
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                    {tier === 'free' ? 'Free tier usage' : 'This cycle'}
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text2)' }}>
                    {creditsRemaining} / {planLimit} left
                  </span>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,.06)' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${100 - usagePct}%`,
                      background: usagePct >= 90
                        ? 'linear-gradient(90deg,#ef4444,#dc2626)'
                        : 'linear-gradient(90deg,#22D3EE,#10B981)',
                      transition: 'width 1s ease',
                      borderRadius: '0 4px 4px 0',
                    }}
                  />
                </div>
              </div>

              <ul style={{ fontSize: '0.77rem', color: 'var(--muted2)', listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li>🔵 Basic = <strong style={{ color: 'var(--text)' }}>50 Fast Mode videos / month</strong></li>
                <li>⚡ Pro = <strong style={{ color: 'var(--text)' }}>100 Fast Mode videos + 1 Cinematic / month</strong></li>
              </ul>

              <p className="text-xs mt-4" style={{ color: 'var(--muted)' }}>
                Credits are charged only when a video is successfully generated.
              </p>
            </div>

            {[
              { title: 'Stock library', text: 'Stock usage tracking coming soon.' },
              { title: 'Storage', text: 'Storage tracking coming soon.' },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl p-5"
                style={{ background: 'rgba(11,17,32,0.7)', border: '1px dashed rgba(255,255,255,.07)' }}
              >
                <div className="text-xs font-bold mb-1" style={{ color: 'var(--text2)' }}>{item.title}</div>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{item.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between py-3 gap-4"
      style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}
    >
      <span style={{ fontSize: '0.77rem', color: 'var(--muted)', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: '0.77rem',
          fontWeight: 600,
          color: 'var(--text2)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  )
}
