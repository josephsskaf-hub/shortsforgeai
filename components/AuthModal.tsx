'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import GoogleSignInButton from '@/components/GoogleSignInButton'
import { normalizeInternalRedirect } from '@/lib/authRedirect'
import { trackCheckoutAuthStep } from '@/lib/authAnalytics'

interface AuthModalProps {
  onClose: () => void
  defaultTab?: 'login' | 'signup'
  redirectTo?: string
}

function getModalDestination(explicitRedirect?: string): string {
  const explicit = normalizeInternalRedirect(explicitRedirect)
  if (explicit) return explicit
  if (typeof window === 'undefined') return '/generate'

  const current = normalizeInternalRedirect(
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  )
  if (!current || /^\/(?:login|signup)(?:[/?#]|$)/.test(current)) return '/generate'
  return current
}

export default function AuthModal({ onClose, defaultTab = 'signup', redirectTo }: AuthModalProps) {
  const supabase = createClient()

  const [tab, setTab] = useState<'login' | 'signup'>(defaultTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailAlreadyExists, setEmailAlreadyExists] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [destination, setDestination] = useState('/generate')

  function switchTab(t: 'login' | 'signup') {
    setTab(t)
    setError(null)
    setEmailAlreadyExists(false)
    setEmailSent(false)
  }

  // Accessibility: close on Escape, reusing the existing onClose handler.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Keep the exact in-app intent alive across password auth, email
  // confirmation and OAuth. This includes prompt, plan, intro and attribution
  // parameters, but never accepts an external destination.
  useEffect(() => {
    const nextDestination = getModalDestination(redirectTo)
    setDestination(nextDestination)
    trackCheckoutAuthStep('page_view', 'auth_modal', nextDestination)
  }, [redirectTo])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    trackCheckoutAuthStep('method_selected', 'auth_modal', destination, 'email')

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        const lowered = error.message.toLowerCase()
        const isCreds =
          lowered.includes('invalid login credentials') ||
          lowered.includes('invalid email or password')
        setError(isCreds ? 'Invalid email or password.' : error.message)
        setLoading(false)
        return
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please try again.'
      setError(msg)
      setLoading(false)
      return
    }

    // Hard navigate so the Next.js middleware sees the freshly-set Supabase
    // auth cookies on the next request. router.refresh raced the cookie sync
    // and left the modal stuck on the loading button.
    trackCheckoutAuthStep('completed', 'auth_modal', destination, 'email')
    window.location.assign(destination)
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setEmailAlreadyExists(false)
    trackCheckoutAuthStep('method_selected', 'auth_modal', destination, 'email')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`,
      },
    })

    if (error) {
      // Detect "already registered" error
      const msg = error.message.toLowerCase()
      if (
        msg.includes('user already registered') ||
        msg.includes('already registered') ||
        msg.includes('already been registered') ||
        msg.includes('email already in use')
      ) {
        setEmailAlreadyExists(true)
        setLoading(false)
        return
      }
      setError(error.message)
      setLoading(false)
      return
    }

    // Supabase sometimes returns a user with identities=[] when email already exists
    // (when email confirmation is enabled) — this is a false-success
    if (data?.user && data.user.identities && data.user.identities.length === 0) {
      setEmailAlreadyExists(true)
      setLoading(false)
      return
    }

    // Fire welcome email (non-blocking — never fails signup)
    fetch('/api/send-welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, activationPath: destination }),
    }).catch(() => {/* ignore email errors */})

    // Try immediate sign-in (if email confirmation is disabled).
    // After signup we send users to the home page so they land in the marketing
    // funnel — not straight into the generator.
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (!signInError) {
      trackCheckoutAuthStep('completed', 'auth_modal', destination, 'email')
      window.location.assign(destination)
    } else {
      trackCheckoutAuthStep('confirmation_required', 'auth_modal', destination, 'email')
      setEmailSent(true)
      setLoading(false)
    }
  }

  const inputStyle = {
    background: 'rgba(255,255,255,.03)',
    border: '1px solid var(--border2)',
    color: 'var(--text)',
    fontFamily: 'inherit',
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(8,8,15,.92)', backdropFilter: 'blur(24px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={tab === 'signup' ? 'Create account' : 'Sign in'}
    >
      <div
        className="w-full max-w-md rounded-2xl relative overflow-hidden"
        style={{
          background: 'var(--card2)',
          border: '1px solid rgba(16, 185, 129,.25)',
          boxShadow: '0 0 100px rgba(16, 185, 129,.22), 0 30px 80px rgba(0,0,0,.5)',
        }}
      >
        {/* Top accent */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5 pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, #2997ff, #2997ff, transparent)' }}
        />
        {/* Glow orb */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: 300, height: 300,
            background: 'radial-gradient(circle, rgba(16, 185, 129,0.12) 0%, transparent 70%)',
            top: -100, right: -80, borderRadius: '50%',
          }}
        />

        <div className="relative z-10 p-7">
          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all"
            style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--muted2)', cursor: 'pointer' }}
          >
            <span aria-hidden="true">✕</span>
          </button>

          {/* Logo */}
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--indigo), var(--purple))', boxShadow: '0 0 24px rgba(16, 185, 129,.45)' }}
              aria-hidden="true"
            >
              ⚡
            </div>
            <div>
              <div className="font-black text-sm tracking-tight" style={{ background: 'linear-gradient(135deg, #2997ff, #2997ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Kineo
              </div>
              <div className="text-xs" style={{ color: 'var(--muted)', marginTop: 1 }}>
                Create AI Shorts with video generation
              </div>
            </div>
          </div>

          {/* Email sent state */}
          {emailSent ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-4" aria-hidden="true">✅</div>
              <h2 className="text-xl font-black mb-2 tracking-tight" style={{ color: 'var(--text)' }}>
                Check your email!
              </h2>
              <p className="text-sm mb-6" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                We sent a confirmation link to{' '}
                <strong style={{ color: 'var(--text2)' }}>{email}</strong>.
                <br />Click it to activate your account and start generating.
              </p>
              <button
                onClick={() => { setEmailSent(false); switchTab('login') }}
                className="text-sm font-semibold"
                style={{ color: 'var(--indigo-light)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ← Back to Sign In
              </button>
            </div>
          ) : (
            <>
              {/* Incentive banner */}
              {tab === 'signup' && (
                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold mb-5"
                  style={{ background: 'rgba(41,151,255,.07)', border: '1px solid rgba(41,151,255,.18)', color: '#2997ff' }}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse-dot" style={{ background: '#2997ff', boxShadow: '0 0 6px rgba(41,151,255,.5)' }} aria-hidden="true" />
                  Free tier · 1 AI video credit — no card required
                </div>
              )}

              {/* Tab switcher */}
              <div className="flex rounded-xl p-1 mb-6" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)' }}>
                {(['signup', 'login'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => switchTab(t)}
                    className="flex-1 rounded-lg py-2 text-xs font-bold transition-all"
                    style={{
                      background: tab === t ? 'linear-gradient(135deg, rgba(16, 185, 129,.25), rgba(5, 150, 105,.2))' : 'transparent',
                      border: tab === t ? '1px solid rgba(16, 185, 129,.25)' : '1px solid transparent',
                      color: tab === t ? 'var(--indigo-light)' : 'var(--muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <span aria-hidden="true">{t === 'signup' ? '⚡' : '🔑'} </span>{t === 'signup' ? 'Create Account' : 'Sign In'}
                  </button>
                ))}
              </div>

              {/* Heading */}
              <div className="mb-5">
                <h2 className="text-xl font-black tracking-tight mb-1" style={{ color: 'var(--text)' }}>
                  {tab === 'signup' ? 'Start creating AI Shorts' : 'Welcome back'}
                </h2>
                <p className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
                  {tab === 'signup'
                    ? 'Create your free account and start generating faceless videos in minutes.'
                    : 'Sign in to access your account and continue creating videos.'}
                </p>
              </div>

              {destination.startsWith('/api/stripe/checkout') && (
                <div
                  role="status"
                  className="rounded-xl px-4 py-3 text-xs mb-4"
                  style={{ background: 'rgba(41,151,255,.08)', border: '1px solid rgba(41,151,255,.28)', color: '#2997ff', lineHeight: 1.5 }}
                >
                  Your selected plan and intro price are saved. Continue below and we&apos;ll take you straight back to secure checkout.
                </div>
              )}

              <GoogleSignInButton
                redirectTo={destination}
                analyticsSurface="auth_modal"
                onError={(message) => setError(message)}
                label={tab === 'signup' ? 'Create account with Google' : 'Sign in with Google'}
              />

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px" style={{ background: 'var(--border2)' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                  or continue with email
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--border2)' }} />
              </div>

              {/* Form */}
              <form onSubmit={tab === 'login' ? handleLogin : handleSignup} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(16, 185, 129,.5)'; e.target.style.background = 'rgba(16, 185, 129,.04)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border2)'; e.target.style.background = 'rgba(255,255,255,.03)' }}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
                      Password
                    </label>
                    {tab === 'login' && (
                      <a
                        href="/forgot-password"
                        className="text-xs font-semibold"
                        style={{ color: 'var(--indigo-light)', textDecoration: 'none' }}
                        onClick={onClose}
                      >
                        Forgot password?
                      </a>
                    )}
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={tab === 'signup' ? 6 : undefined}
                    placeholder={tab === 'signup' ? 'Min. 6 characters' : '••••••••'}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(16, 185, 129,.5)'; e.target.style.background = 'rgba(16, 185, 129,.04)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border2)'; e.target.style.background = 'rgba(255,255,255,.03)' }}
                  />
                </div>

                {/* Email already exists — friendly message */}
                {emailAlreadyExists && (
                  <div
                    className="rounded-xl px-4 py-3 text-xs"
                    style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.22)', color: '#2997ff' }}
                  >
                    <span className="font-bold">Email already registered.</span>{' '}
                    <button
                      type="button"
                      onClick={() => switchTab('login')}
                      className="font-bold underline"
                      style={{ color: '#2997ff', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Sign in →
                    </button>
                  </div>
                )}

                {/* Generic error */}
                {error && !emailAlreadyExists && (
                  <div
                    className="rounded-xl px-4 py-3 text-xs flex items-center gap-2"
                    style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171' }}
                  >
                    <span aria-hidden="true">⚠️</span> {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl py-3.5 font-black text-sm text-white transition-all mt-1 flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #2997ff 0%, #2997ff 55%, #2997ff 100%)',
                    boxShadow: loading ? 'none' : '0 4px 28px rgba(16, 185, 129,.45)',
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    animation: loading ? 'none' : 'btn-pulse 2.8s ease-in-out infinite',
                  }}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 rounded-full border border-white/20" style={{ borderTopColor: 'white', animation: 'spin 0.65s linear infinite' }} />
                      {tab === 'signup' ? 'Creating account...' : 'Signing in...'}
                    </>
                  ) : (
                    <><span aria-hidden="true">{tab === 'signup' ? '⚡' : '🔑'} </span>{tab === 'signup' ? 'Create Free Account' : 'Sign In'}</>
                  )}
                </button>
              </form>

              {/* Footer link */}
              <p className="text-center text-xs mt-5" style={{ color: 'var(--muted)' }}>
                {tab === 'signup' ? (
                  <>
                    Already have an account?{' '}
                    <button onClick={() => switchTab('login')} className="font-semibold" style={{ color: 'var(--indigo-light)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    Don&apos;t have an account?{' '}
                    <button onClick={() => switchTab('signup')} className="font-semibold" style={{ color: 'var(--indigo-light)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Sign up free
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
