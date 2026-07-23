'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Footer from '@/components/Footer'
import GoogleSignInButton from '@/components/GoogleSignInButton'
import AppleSignInButton from '@/components/AppleSignInButton'
import { trackSignupSource } from '@/lib/analytics'
import { resolveAuthRedirect } from '@/lib/authRedirect'
import { trackCheckoutAuthStep } from '@/lib/authAnalytics'

// Only honor redirects that stay on our own site, so a malicious referrer
// can't bounce a logged-in user out to an external phishing page.
function getRedirect(): string {
  if (typeof window === 'undefined') return '/dashboard'
  const params = new URLSearchParams(window.location.search)
  return resolveAuthRedirect(params.get('redirect'))
}

// KINEO-CHECKOUT-RESUME-2026-07-07 — when checkout bounces a buyer here
// (?reason=checkout), show a "finish your purchase" banner so the redirect
// doesn't feel like a broken button, and resume checkout after sign-in.
function isCheckoutResume(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('reason') === 'checkout'
}

export default function LoginPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // KINEO-CHECKOUT-RESUME-2026-07-07 — read once on mount (client-only param).
  const [checkoutResume, setCheckoutResume] = useState(false)
  // Query string forwarded to /signup so the pending checkout survives the hop
  // (state, not inline window read, to avoid an SSR hydration mismatch).
  const [authSearch, setAuthSearch] = useState('')
  useEffect(() => {
    const resumingCheckout = isCheckoutResume()
    setCheckoutResume(resumingCheckout)
    setAuthSearch(window.location.search)
    if (resumingCheckout) {
      trackCheckoutAuthStep('page_view', 'login_page', getRedirect())
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session) return
      window.location.replace(getRedirect())
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const destination = getRedirect()
    trackCheckoutAuthStep('method_selected', 'login_page', destination, 'email')

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

    // #383 — robust attribution: record signup source on first login too (covers
    // users who confirm email later, then log in). Fire-and-forget, de-duped per
    // session, only fills null columns — never blocks or breaks login.
    trackSignupSource()
    trackCheckoutAuthStep('completed', 'login_page', destination, 'email')

    // Hard navigate so the Next.js middleware sees the freshly-set Supabase
    // auth cookies on the next request.
    window.location.assign(destination)
  }

  return (
    <>
      <div
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{ background: 'var(--bg)' }}
      >
        {/* Glow orbs — subtle Kineo blue */}
        <div
          className="fixed rounded-full pointer-events-none"
          style={{
            width: 600,
            height: 600,
            background: '#2997ff',
            top: -200,
            right: -150,
            opacity: 0.08,
            filter: 'blur(90px)',
            zIndex: 0,
          }}
        />
        <div
          className="fixed rounded-full pointer-events-none"
          style={{
            width: 500,
            height: 500,
            background: '#2997ff',
            bottom: -150,
            left: 300,
            opacity: 0.06,
            filter: 'blur(90px)',
            zIndex: 0,
          }}
        />

        <div
          className="w-full max-w-4xl relative z-10 rounded-2xl overflow-hidden grid md:grid-cols-2"
          style={{
            background: '#161618',
            border: '1px solid #2a2a2d',
            boxShadow: '0 0 80px rgba(41,151,255,.08)',
          }}
        >
          {/* LEFT — value prop panel (desktop only) */}
          <div
            className="hidden md:flex flex-col justify-between p-10 relative overflow-hidden"
            style={{
              background:
                'radial-gradient(circle at top left, rgba(41,151,255,0.18), transparent 55%), linear-gradient(135deg, #0c0c0e 0%, #000000 50%, #0c0c0e 100%)',
            }}
          >
            {/* Dot pattern overlay */}
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  'radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)',
                backgroundSize: '22px 22px',
                opacity: 0.06,
              }}
            />

            <div className="relative z-10">
              <Link
                href="/"
                className="flex items-center gap-3 mb-10"
                style={{ textDecoration: 'none' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{
                    background: '#2997ff',
                    boxShadow: '0 0 24px rgba(41,151,255,.45)',
                  }}
                >
                  ⚡
                </div>
                <div>
                  <div
                    className="font-black text-sm tracking-tight"
                    style={{ color: '#f5f5f7' }}
                  >
                    Kineo
                  </div>
                  <div
                    className="text-xs font-bold tracking-widest px-1.5 py-0.5 rounded w-fit mt-1"
                    style={{
                      background: 'rgba(41,151,255,.15)',
                      border: '1px solid rgba(41,151,255,.3)',
                      color: '#2997ff',
                      fontSize: '0.52rem',
                    }}
                  >
                    AI
                  </div>
                </div>
              </Link>

              <h2
                className="text-2xl font-black tracking-tight mb-2"
                style={{ color: 'var(--text)' }}
              >
                Turn ideas into viral Shorts.
              </h2>
              <p className="text-sm mb-8" style={{ color: 'var(--muted2)' }}>
                AI script, footage, voiceover — usually done in 2–4 minutes.
              </p>

              <ul className="flex flex-col gap-4">
                {[
                  'AI writes the script for you',
                  'Stock footage + voiceover included',
                  'New free accounts: 3 watermarked Fast videos / 24h',
                ].map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-3 text-sm"
                    style={{ color: 'var(--text2)' }}
                  >
                    <span
                      className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: 'rgba(41,151,255,.18)',
                        border: '1px solid rgba(41,151,255,.35)',
                        color: '#2997ff',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                      }}
                    >
                      ✓
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div
              className="relative z-10 mt-10 rounded-xl p-4"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: 'var(--text2)' }}
              >
                7-day money-back guarantee
              </p>
              <p className="text-xs" style={{ color: 'var(--muted2)' }}>
                Free downloads include a watermark. Paid plans unlock clean MP4s.
              </p>
            </div>
          </div>

          {/* RIGHT — form panel */}
          <div className="p-8 md:p-10 animate-fade-in-up">
            <Link
              href="/"
              className="inline-block text-xs font-bold mb-4"
              style={{
                color: 'var(--muted)',
                textDecoration: 'none',
                letterSpacing: '0.02em',
              }}
            >
              ← Back to Home
            </Link>

            {/* Mobile-only logo (desktop sees logo in left panel) */}
            <Link
              href="/"
              className="md:hidden flex items-center justify-center gap-3 mb-6"
              style={{ textDecoration: 'none' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{
                  background: '#2997ff',
                  boxShadow: '0 0 24px rgba(41,151,255,.45)',
                }}
              >
                ⚡
              </div>
              <div
                className="font-black text-sm tracking-tight"
                style={{ color: '#f5f5f7' }}
              >
                Kineo
              </div>
            </Link>

            <h1
              className="text-2xl font-black mb-1 tracking-tight"
              style={{ color: 'var(--text)' }}
            >
              Welcome back
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
              Sign in to keep creating Shorts.
            </p>

            {/* KINEO-CHECKOUT-RESUME-2026-07-07 — buyer bounced off checkout */}
            {checkoutResume && (
              <div
                role="status"
                className="rounded-xl px-4 py-3 text-sm mb-5"
                style={{
                  background: 'rgba(41,151,255,.08)',
                  border: '1px solid rgba(41,151,255,.3)',
                  color: '#2997ff',
                  fontWeight: 600,
                }}
              >
                🔒 Your session expired — sign in and we&apos;ll take you straight
                back to secure checkout to finish your purchase.
              </div>
            )}

            <GoogleSignInButton redirectTo={getRedirect()} analyticsSurface="login_page" onError={(msg) => setError(msg)} />

            {/* Apple Sign In — kept in code, hidden until Apple Developer is configured.
                Reactivate by setting NEXT_PUBLIC_ENABLE_APPLE=true (see docs/oauth-setup.md). */}
            {process.env.NEXT_PUBLIC_ENABLE_APPLE === 'true' && (
              <div className="mt-3">
                <AppleSignInButton redirectTo={getRedirect()} onError={(msg) => setError(msg)} />
              </div>
            )}

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px" style={{ background: 'var(--border2)' }} />
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: 'var(--muted)' }}
              >
                or continue with email
              </span>
              <div className="flex-1 h-px" style={{ background: 'var(--border2)' }} />
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-bold mb-2 uppercase tracking-wider"
                  style={{ color: 'var(--muted2)' }}
                >
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-describedby={error ? 'login-error' : undefined}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,.03)',
                    border: '1px solid var(--border2)',
                    color: 'var(--text)',
                    fontFamily: 'inherit',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(41,151,255,.5)'
                    e.target.style.background = 'rgba(41,151,255,.04)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border2)'
                    e.target.style.background = 'rgba(255,255,255,.03)'
                  }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-bold uppercase tracking-wider"
                    style={{ color: 'var(--muted2)' }}
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-semibold"
                    style={{
                      color: '#2997ff',
                      textDecoration: 'none',
                    }}
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    aria-describedby={error ? 'login-error' : undefined}
                    className="w-full rounded-xl px-4 py-3 pr-12 text-sm outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,.03)',
                      border: '1px solid var(--border2)',
                      color: 'var(--text)',
                      fontFamily: 'inherit',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'rgba(41,151,255,.5)'
                      e.target.style.background = 'rgba(41,151,255,.04)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--border2)'
                      e.target.style.background = 'rgba(255,255,255,.03)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
                    style={{
                      color: 'var(--muted2)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {showPassword ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  id="login-error"
                  role="alert"
                  className="rounded-xl px-4 py-3 text-sm"
                  style={{
                    background: 'rgba(239,68,68,.08)',
                    border: '1px solid rgba(239,68,68,.2)',
                    color: '#f87171',
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl py-3.5 font-bold text-sm transition-all mt-1"
                style={{
                  background: '#f5f5f7',
                  color: '#000',
                  boxShadow: '0 4px 22px rgba(41,151,255,.3)',
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-sm mt-6" style={{ color: 'var(--muted)' }}>
              Don&apos;t have an account?{' '}
              {/* KINEO-CHECKOUT-RESUME-2026-07-07 — carry the pending checkout
                  redirect into signup so new buyers also resume the purchase. */}
              <Link
                href={`/signup${authSearch}`}
                className="font-semibold transition-colors"
                style={{ color: '#2997ff' }}
              >
                Sign up free
              </Link>
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
