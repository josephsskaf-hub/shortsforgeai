'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Footer from '@/components/Footer'
import GoogleSignInButton from '@/components/GoogleSignInButton'
import AppleSignInButton from '@/components/AppleSignInButton'

type Strength = { level: 0 | 1 | 2 | 3 | 4; label: string; color: string }

function scorePassword(pw: string): Strength {
  if (!pw) return { level: 0, label: '', color: '#475569' }
  if (pw.length < 6)
    return { level: 1, label: 'Too short', color: '#ef4444' }

  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++

  if (score <= 1) return { level: 2, label: 'Weak', color: '#f59e0b' }
  if (score === 2 || score === 3)
    return { level: 3, label: 'Good', color: '#3b82f6' }
  return { level: 4, label: 'Strong', color: '#10b981' }
}

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const strength = scorePassword(password)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Push #281 — redirect new users to /pricing after email confirmation
        // so they see the plans before trying to generate (0 credits at signup).
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.shortsforgeai.com'}/pricing`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Supabase returns a successful response with an empty identities array
    // when the email is already registered.
    const identities = data.user?.identities
    if (data.user && Array.isArray(identities) && identities.length === 0) {
      setSuccess(true)
      setLoading(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (signInError) {
      setSuccess(true)
      setLoading(false)
      return
    }

    fetch('/api/send-welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => {
      /* non-blocking */
    })

    // Push #188 — fire Google Ads conversion on successful signup
    try {
      if (typeof window !== 'undefined' && typeof (window as unknown as { gtag?: Function }).gtag === 'function') {
        ;(window as unknown as { gtag: Function }).gtag('event', 'conversion', {
          send_to: 'AW-18156258081/SXGYCk_VlrEcEKGGytFD',
          value: 1.0,
          currency: 'BRL',
        })
      }
    } catch {
      /* non-blocking */
    }

    // Push #281 — send new users to pricing, not generate (0 credits until paid)
    router.push('/pricing')
    router.refresh()
  }

  return (
    <>
      <div
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{ background: 'var(--bg)' }}
      >
        {/* Glow orbs */}
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
                className="text-2xl font-black tracking-tight mb-1"
                style={{ color: 'var(--text)' }}
              >
                Join 9,847+ creators
              </h2>
              <p className="text-sm mb-8" style={{ color: 'var(--muted2)' }}>
                Already building Shorts with AI — every single day.
              </p>

              <div
                className="inline-flex items-center gap-2 mb-7 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{
                  background: 'rgba(16,185,129,.12)',
                  border: '1px solid rgba(16,185,129,.3)',
                  color: '#34d399',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full animate-pulse-dot"
                  style={{
                    background: '#34d399',
                    boxShadow: '0 0 6px rgba(52,211,153,.6)',
                  }}
                />
                🎁 7-day free trial · No credit card
              </div>

              <ul className="flex flex-col gap-4">
                {[
                  'AI writes the script in 60 seconds',
                  'Stock footage + voiceover included',
                  '2 free videos, no credit card',
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
              <p
                className="text-xs font-semibold"
                style={{ color: 'var(--muted2)' }}
              >
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

            {/* Mobile-only logo */}
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

            {success ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">✅</div>
                <h2
                  className="text-xl font-black mb-2"
                  style={{ color: 'var(--text)' }}
                >
                  Check your email!
                </h2>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  We sent a confirmation link to{' '}
                  <strong style={{ color: 'var(--text2)' }}>{email}</strong>.
                  Click it to activate your account.
                </p>
                <Link
                  href="/login"
                  className="inline-block mt-6 text-sm font-semibold"
                  style={{ color: 'var(--indigo-light)' }}
                >
                  Back to Sign In
                </Link>
              </div>
            ) : (
              <>
                <h1
                  className="text-2xl font-black mb-1 tracking-tight"
                  style={{ color: 'var(--text)' }}
                >
                  Create your AI Short
                </h1>
                <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
                  Free trial, 1 video included.
                </p>

                <GoogleSignInButton onError={(msg) => setError(msg)} />

                {/* Apple Sign In — kept in code, hidden until Apple Developer is configured.
                    Reactivate by setting NEXT_PUBLIC_ENABLE_APPLE=true (see docs/oauth-setup.md). */}
                {process.env.NEXT_PUBLIC_ENABLE_APPLE === 'true' && (
                  <div className="mt-3">
                    <AppleSignInButton onError={(msg) => setError(msg)} />
                  </div>
                )}

                <div className="flex items-center gap-3 my-5">
                  <div
                    className="flex-1 h-px"
                    style={{ background: 'var(--border2)' }}
                  />
                  <span
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--muted)' }}
                  >
                    or sign up with email
                  </span>
                  <div
                    className="flex-1 h-px"
                    style={{ background: 'var(--border2)' }}
                  />
                </div>

                <form onSubmit={handleSignup} className="flex flex-col gap-4">
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
                    <label
                      className="block text-xs font-bold mb-2 uppercase tracking-wider"
                      style={{ color: 'var(--muted2)' }}
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder="Min. 6 characters"
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
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
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

                    {password.length > 0 && (
                      <div className="mt-2">
                        <div className="flex gap-1.5">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className="h-1 flex-1 rounded-full transition-colors"
                              style={{
                                background:
                                  strength.level >= i
                                    ? strength.color
                                    : 'rgba(255,255,255,.08)',
                              }}
                            />
                          ))}
                        </div>
                        {strength.label && (
                          <p
                            className="text-xs mt-1.5 font-semibold"
                            style={{ color: strength.color }}
                          >
                            {strength.label}
                          </p>
                        )}
                      </div>
                    )}
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
                    {loading ? 'Creating account...' : '⚡ Create Free Account'}
                  </button>
                </form>

                <p
                  className="text-center text-sm mt-6"
                  style={{ color: 'var(--muted)' }}
                >
                  Already have an account?{' '}
                  <Link
                    href="/login"
                    className="font-semibold transition-colors"
                    style={{ color: 'var(--indigo-light)' }}
                  >
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  )
}
