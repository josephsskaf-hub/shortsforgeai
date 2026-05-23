'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Footer from '@/components/Footer'
import GoogleSignInButton from '@/components/GoogleSignInButton'

// Only honor redirects that stay on our own site, so a malicious referrer
// can't bounce a logged-in user out to an external phishing page.
function safeRedirect(raw: string | null): string {
  if (!raw) return '/generate'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/generate'
  return raw
}

function getRedirect(): string {
  if (typeof window === 'undefined') return '/dashboard'
  const params = new URLSearchParams(window.location.search)
  return safeRedirect(params.get('redirect'))
}

export default function LoginPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    // auth cookies on the next request.
    window.location.assign(getRedirect())
  }

  return (
    <>
      <div
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{ background: 'var(--bg)' }}
      >
        {/* Glow orbs — pushed to 0.08 / 0.06 for more vivid background */}
        <div
          className="fixed rounded-full pointer-events-none"
          style={{
            width: 600,
            height: 600,
            background: 'var(--indigo)',
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
            background: 'var(--purple)',
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
            background: 'var(--card)',
            border: '1px solid var(--border2)',
            boxShadow: '0 0 80px rgba(59, 130, 246,.08)',
          }}
        >
          {/* LEFT — value prop panel (desktop only) */}
          <div
            className="hidden md:flex flex-col justify-between p-10 relative overflow-hidden"
            style={{
              background:
                'radial-gradient(circle at top left, rgba(59,130,246,0.22), transparent 55%), linear-gradient(135deg, #0f1629 0%, #0b1020 50%, #060c1a 100%)',
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
                    background:
                      'linear-gradient(135deg, var(--indigo), var(--purple))',
                    boxShadow: '0 0 24px rgba(59, 130, 246,.45)',
                  }}
                >
                  ⚡
                </div>
                <div>
                  <div
                    className="font-black text-sm tracking-tight"
                    style={{
                      background: 'linear-gradient(135deg, #60A5FA, #22D3EE)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    ShortsForgeAI
                  </div>
                  <div
                    className="text-xs font-bold tracking-widest px-1.5 py-0.5 rounded w-fit mt-1"
                    style={{
                      background: 'rgba(59, 130, 246,.15)',
                      border: '1px solid rgba(59, 130, 246,.3)',
                      color: 'var(--indigo-light)',
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
                AI script, footage, voiceover — done in 60 seconds.
              </p>

              <ul className="flex flex-col gap-4">
                {[
                  'AI writes the script in 60 seconds',
                  'Stock footage + voiceover included',
                  '1 free video, no credit card',
                ].map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-3 text-sm"
                    style={{ color: 'var(--text2)' }}
                  >
                    <span
                      className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: 'rgba(16,185,129,.18)',
                        border: '1px solid rgba(16,185,129,.35)',
                        color: '#34d399',
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
                className="text-sm italic mb-2"
                style={{ color: 'var(--text2)' }}
              >
                &ldquo;Made $2,400 last month from my Shorts.&rdquo;
              </p>
              <p className="text-xs font-semibold" style={{ color: 'var(--muted2)' }}>
                — @ryan_finance · 47K subs
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
                  background:
                    'linear-gradient(135deg, var(--indigo), var(--purple))',
                  boxShadow: '0 0 24px rgba(59, 130, 246,.45)',
                }}
              >
                ⚡
              </div>
              <div
                className="font-black text-sm tracking-tight"
                style={{
                  background: 'linear-gradient(135deg, #60A5FA, #22D3EE)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                ShortsForgeAI
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

            <GoogleSignInButton onError={(msg) => setError(msg)} />

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
                  className="block text-xs font-bold mb-2 uppercase tracking-wider"
                  style={{ color: 'var(--muted2)' }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,.03)',
                    border: '1px solid var(--border2)',
                    color: 'var(--text)',
                    fontFamily: 'inherit',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(59, 130, 246,.5)'
                    e.target.style.background = 'rgba(59, 130, 246,.04)'
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
                    className="block text-xs font-bold uppercase tracking-wider"
                    style={{ color: 'var(--muted2)' }}
                  >
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-semibold"
                    style={{
                      color: 'var(--indigo-light)',
                      textDecoration: 'none',
                    }}
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full rounded-xl px-4 py-3 pr-12 text-sm outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,.03)',
                      border: '1px solid var(--border2)',
                      color: 'var(--text)',
                      fontFamily: 'inherit',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'rgba(59, 130, 246,.5)'
                      e.target.style.background = 'rgba(59, 130, 246,.04)'
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
                  background: '#3B82F6',
                  color: '#FFFFFF',
                  boxShadow: '0 4px 22px rgba(59, 130, 246,.3)',
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-sm mt-6" style={{ color: 'var(--muted)' }}>
              Don&apos;t have an account?{' '}
              <Link
                href="/signup"
                className="font-semibold transition-colors"
                style={{ color: 'var(--indigo-light)' }}
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
