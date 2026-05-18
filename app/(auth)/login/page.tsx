'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Footer from '@/components/Footer'

// Only honor redirects that stay on our own site, so a malicious referrer
// can't bounce a logged-in user out to an external phishing page.
function safeRedirect(raw: string | null): string {
  if (!raw) return '/generate'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/generate'
  return raw
}

// Read the ?redirect= param at call time from window.location. Avoiding
// useSearchParams keeps the page out of Next.js' prerender Suspense path —
// otherwise the form renders as an empty body on first paint.
function getRedirect(): string {
  if (typeof window === 'undefined') return '/dashboard'
  const params = new URLSearchParams(window.location.search)
  return safeRedirect(params.get('redirect'))
}

export default function LoginPage() {
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL)

  // If a session already exists in cookies (e.g. the user opened /login while
  // already signed in, or returned via a bookmark), jump straight into the
  // app without waiting for an onAuthStateChange event. The bug we were
  // chasing — the button stuck on "Signing in..." even though Supabase had
  // already set the cookie — went away once we stopped depending on
  // router.push/router.refresh after the cookie was set.
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

  async function handleGoogleLogin() {
    if (!supabaseConfigured) {
      setError('Google login unavailable — use email instead.')
      return
    }
    setGoogleLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setError('Google login unavailable — use email instead.')
        setGoogleLoading(false)
      }
    } catch {
      setError('Google login unavailable — use email instead.')
      setGoogleLoading(false)
    }
  }

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
    // auth cookies on the next request. router.push + router.refresh used to
    // race the cookie sync and leave the UI stuck on "Signing in...".
    window.location.assign(getRedirect())
  }

  return (
    <>
    <div
      className="min-h-screen flex items-center justify-center p-4"
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
          opacity: 0.04,
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
          opacity: 0.035,
          filter: 'blur(90px)',
          zIndex: 0,
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Push #116 — explicit back-to-home link above the card. The
            wordmark logo already routes to /, but the explicit text
            anchor reads as a clear escape hatch for visitors who landed
            here from an ad. */}
        <Link
          href="/"
          className="block text-xs font-bold mb-3"
          style={{
            color: 'var(--muted)',
            textDecoration: 'none',
            letterSpacing: '0.02em',
          }}
        >
          ← Back to Home
        </Link>
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-8" style={{ textDecoration: 'none' }}>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{
              background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
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
              className="text-xs font-bold tracking-widest px-1.5 py-0.5 rounded w-fit"
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

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border2)',
            boxShadow: '0 0 80px rgba(59, 130, 246,.08)',
          }}
        >
          <h1
            className="text-2xl font-black mb-1 tracking-tight"
            style={{ color: 'var(--text)' }}
          >
            Welcome back
          </h1>
          <p className="text-sm mb-7" style={{ color: 'var(--muted)' }}>
            Sign in to keep generating videos.
          </p>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="w-full rounded-xl py-3 font-bold text-sm transition-all flex items-center justify-center gap-3"
            style={{
              background: 'rgba(255,255,255,.03)',
              color: 'var(--text)',
              border: '1px solid var(--border2)',
              opacity: googleLoading ? 0.7 : 1,
              cursor: googleLoading || loading ? 'not-allowed' : 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {googleLoading ? 'Connecting to Google…' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: 'var(--border2)' }} />
            <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border2)' }} />
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label
                className="block text-xs font-700 mb-2 uppercase tracking-wider"
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
                <label className="block text-xs font-700 uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs font-semibold" style={{ color: 'var(--indigo-light)', textDecoration: 'none' }}>
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
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
