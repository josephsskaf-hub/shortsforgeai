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

// Settings v3 (12/06) — practical, Vercel/Linear-shaped account page.
// 3 tabs, every control DOES something: Profile (editable name + sign out),
// Billing (Stripe portal, upgrade, credit packs), Usage (credit meter).
// The old "Members" tab (a coming-soon placeholder) is gone; old deep links
// ?tab=members / ?tab=manage resolve to Billing for back-compat.
type TabKey = 'profile' | 'billing' | 'usage'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'billing', label: 'Billing' },
  { key: 'usage', label: 'Usage' },
]

function isTabKey(v: string | null | undefined): v is TabKey {
  return v === 'profile' || v === 'billing' || v === 'usage'
}

// Push #430 — free tier now starts with 30 welcome credits (30 Fast videos or 1 AI video)
const PLAN_LIMITS = { free: 30, basic: 50, pro: 100 } as const
const PLAN_COLORS = {
  free: { color: '#86868b', bg: 'rgba(134,134,139,.1)', border: 'rgba(134,134,139,.2)' },
  basic: { color: '#2997ff', bg: 'rgba(41,151,255,.1)', border: 'rgba(41,151,255,.2)' },
  pro: { color: '#2997ff', bg: 'rgba(41,151,255,.1)', border: 'rgba(41,151,255,.2)' },
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
  // Legacy aliases — 'members' and 'manage' were folded into Billing.
  const normalizedTab = rawTab === 'members' || rawTab === 'manage' ? 'billing' : rawTab
  const activeTab: TabKey = isTabKey(normalizedTab) ? normalizedTab : 'profile'

  const tier: 'free' | 'basic' | 'pro' = planTier ?? (isPro ? 'pro' : 'free')
  const planLimit = PLAN_LIMITS[tier]
  const planLabel = tier === 'pro' ? '⚡ Pro Plan' : tier === 'basic' ? '🔵 Basic Plan' : '🆓 Free Plan'
  const planStyle = PLAN_COLORS[tier]
  const initial = (email?.[0] ?? 'U').toUpperCase()

  const [fullName, setFullName] = useState('')
  const [credits, setCredits] = useState<number | null>(null)
  // Settings v3.1 — separate AI Avatar credit balance (the add-on packs).
  const [avatarCredits, setAvatarCredits] = useState<number | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)
  // Settings v3 — editable display name (saved to supabase user_metadata).
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  async function handleSaveName() {
    if (savingName) return
    setSavingName(true)
    setNameSaved(false)
    setNameError(null)
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: fullName.trim() } })
      if (error) {
        setNameError('Could not save. Please try again.')
      } else {
        setNameSaved(true)
        setTimeout(() => setNameSaved(false), 2500)
      }
    } catch {
      setNameError('Could not save. Please try again.')
    } finally {
      setSavingName(false)
    }
  }

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
        if (cancelled) return
        setCredits(typeof data.credits === 'number' ? data.credits : 0)
        // Settings v3.1 — same endpoint already carries the avatar balance.
        setAvatarCredits(typeof data.avatarCredits === 'number' ? data.avatarCredits : 0)
      })
      .catch(() => { if (!cancelled) { setCredits(0); setAvatarCredits(null) } })
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
          background: rgba(41,151,255,.12) !important;
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
          style={{ fontSize: '0.65rem', color: '#2997ff' }}
        >
          <span style={{ display: 'inline-block', width: 18, height: 1, background: '#2997ff', verticalAlign: 'middle' }} />
          My Account
          <span style={{ display: 'inline-block', width: 18, height: 1, background: '#2997ff', verticalAlign: 'middle' }} />
        </div>
        <h1
          className="font-black tracking-tight mb-1"
          style={{ fontSize: 'clamp(1.55rem, 4vw, 2rem)', color: 'var(--text)', lineHeight: 1.1 }}
        >
          Account{' '}
          <span style={{ background: 'linear-gradient(180deg,#fff 35%,#a1a1a6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
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
                  ? 'rgba(41,151,255,.16)'
                  : 'transparent',
                border: active ? '1px solid rgba(41,151,255,.3)' : '1px solid transparent',
                color: active ? '#2997ff' : 'var(--muted2)',
                textDecoration: 'none',
                boxShadow: active ? '0 0 14px rgba(41,151,255,.12)' : 'none',
              }}
            >
              <span>{t.label}</span>
            </Link>
          )
        })}
      </div>

      <div style={{ maxWidth: 640 }}>

        {/* Settings v3 — the old "Members" placeholder tab was removed: it
            promised a team feature that doesn't exist. Billing (below)
            absorbed everything actionable from the old Manage tab. */}

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
                  style={{ background: '#2997ff', position: 'relative', zIndex: 1 }}
                >
                  {initial}
                </div>
                <div
                  className="avatar-ring"
                  style={{
                    position: 'absolute', inset: -3, borderRadius: 20,
                    border: '2px solid rgba(41,151,255,.5)',
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

            {/* Settings v3 — display name is actually EDITABLE now (saved to
                Supabase user_metadata; appears on the sidebar + future
                invoices). No more "coming soon" copy on a settings page. */}
            <div className="mb-5">
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--muted2)' }}>
                Display name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  maxLength={80}
                  className="flex-1 rounded-xl px-3.5 py-2.5 text-sm"
                  style={{
                    background: 'rgba(0,0,0,.3)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="rounded-xl px-4 py-2.5 text-sm font-bold"
                  style={{
                    background: nameSaved ? 'rgba(41,151,255,.15)' : 'rgba(255,255,255,.06)',
                    border: nameSaved ? '1px solid rgba(41,151,255,.45)' : '1px solid var(--border2)',
                    color: nameSaved ? '#2997ff' : 'var(--text2)',
                    cursor: savingName ? 'wait' : 'pointer',
                  }}
                >
                  {savingName ? 'Saving…' : nameSaved ? '✓ Saved' : 'Save'}
                </button>
              </div>
              {nameError && <p className="text-xs mt-1.5" style={{ color: '#f87171' }} role="alert">{nameError}</p>}
            </div>

            <div className="flex flex-col gap-1">
              <ReadOnlyRow label="Email" value={email} />
              <ReadOnlyRow label="Plan" value={planLabel.replace(/^[^ ]+ /, '')} />
              <ReadOnlyRow label="Member since" value={formatDate(createdAt)} />
            </div>

            {/* Sign out lives on Profile — the standard placement. */}
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="mt-6 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
              style={{
                background: 'rgba(239,68,68,.07)',
                border: '1px solid rgba(239,68,68,.18)',
                color: '#f87171',
                cursor: signingOut ? 'not-allowed' : 'pointer',
                opacity: signingOut ? 0.7 : 1,
              }}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        )}

        {/* ── Billing tab (Settings v3 — absorbed the old Manage tab) ── */}
        {activeTab === 'billing' && (
          <div className="flex flex-col gap-4">
            <div
              className="acc-card rounded-2xl p-6"
              style={{ background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(255,255,255,.07)', backdropFilter: 'blur(12px)' }}
            >
              <h2 className="font-bold mb-4" style={{ color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.63rem' }}>
                Plan
              </h2>
              <div className="flex flex-col gap-1 mb-5">
                <ReadOnlyRow label="Current plan" value={planLabel.replace(/^[^ ]+ /, '')} />
                <ReadOnlyRow label="Video credits" value={credits === null ? '—' : String(credits)} />
                <ReadOnlyRow label="Avatar credits" value={avatarCredits === null ? '—' : String(avatarCredits)} />
                <ReadOnlyRow label="Member since" value={formatDate(createdAt)} />
              </div>
              {tier !== 'free' ? (
                <>
                  {/* Stripe customer portal — change card, see invoices,
                      upgrade/downgrade or cancel. The real control center. */}
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
                    {portalLoading ? 'Opening…' : 'Manage subscription — payment method, invoices, cancel'}
                  </button>
                  {portalError && (
                    <p className="text-xs mt-2" style={{ color: '#f87171' }} role="alert">{portalError}</p>
                  )}
                </>
              ) : (
                <Link
                  href="/pricing"
                  className="block w-full text-center rounded-xl py-3 text-sm font-black"
                  style={{
                    background: '#2997ff',
                    color: '#FFFFFF',
                    textDecoration: 'none',
                    transition: 'all 0.18s ease',
                  }}
                >
                  Upgrade — plans from $11.90/mo →
                </Link>
              )}
            </div>

            <div
              className="acc-card rounded-2xl p-6"
              style={{ background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(255,255,255,.07)', backdropFilter: 'blur(12px)' }}
            >
              <h2 className="font-bold mb-4" style={{ color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.63rem' }}>
                Add-ons
              </h2>
              {/* Settings v3.1 — avatar credit balance, visible at a glance. */}
              <div
                className="flex items-center justify-between rounded-xl px-4 py-3 mb-3"
                style={{ background: 'rgba(0,0,0,.25)', border: '1px solid var(--border)' }}
              >
                <span className="text-sm font-semibold" style={{ color: 'var(--text2)' }}>🎭 Avatar credits</span>
                <span
                  className="text-lg font-black"
                  style={{ color: (avatarCredits ?? 0) > 0 ? '#2997ff' : 'var(--muted)' }}
                >
                  {avatarCredits === null ? '—' : avatarCredits}
                </span>
              </div>
              <Link
                href="/avatar"
                className="acc-row-btn flex items-center justify-between w-full rounded-xl px-4 py-3 text-sm font-bold"
                style={{
                  background: 'rgba(41,151,255,.07)',
                  border: '1px solid rgba(41,151,255,.3)',
                  color: '#2997ff',
                  textDecoration: 'none',
                }}
              >
                <span>{(avatarCredits ?? 0) > 0 ? 'Buy more avatar credits — from $11.90/video' : 'Get AI Avatar credits — from $11.90/video'}</span>
                <span aria-hidden>→</span>
              </Link>
            </div>

            <div
              className="rounded-2xl p-5"
              style={{ background: 'rgba(239,68,68,.04)', border: '1px dashed rgba(239,68,68,.2)' }}
            >
              <h2 className="font-bold mb-2" style={{ color: '#fca5a5', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: '0.63rem' }}>
                Danger zone
              </h2>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                To delete your account and all data, email{' '}
                <a href="mailto:support@shortsforgeai.com" style={{ color: '#fca5a5' }}>support@shortsforgeai.com</a>
                {' '}— we process deletions within 48h.
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
                      stroke={usagePct >= 90 ? '#EF4444' : '#2997ff'}
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
                          : '#2997ff',
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
                  {/* Settings v3.1 — avatar credits, the separate add-on balance. */}
                  <div>
                    <div className="font-black text-lg" style={{ color: (avatarCredits ?? 0) > 0 ? '#2997ff' : 'var(--text2)', lineHeight: 1 }}>
                      {avatarCredits === null ? '—' : avatarCredits}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>
                      🎭 avatar credits · never expire
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
                        : '#2997ff',
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
