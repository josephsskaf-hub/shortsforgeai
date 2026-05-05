'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      // Try to sign in immediately (if email confirmation is off)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (!signInError) {
        router.push('/dashboard')
        router.refresh()
      } else {
        setSuccess(true)
        setLoading(false)
      }
    }
  }

  return (
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
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{
              background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
              boxShadow: '0 0 24px rgba(99,102,241,.45)',
            }}
          >
            ⚡
          </div>
          <div>
            <div
              className="font-black text-sm tracking-tight"
              style={{
                background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              ShortsForgeAI
            </div>
            <div
              className="text-xs font-bold tracking-widest px-1.5 py-0.5 rounded w-fit"
              style={{
                background: 'rgba(99,102,241,.15)',
                border: '1px solid rgba(99,102,241,.3)',
                color: 'var(--indigo-light)',
                fontSize: '0.52rem',
              }}
            >
              AI
            </div>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border2)',
            boxShadow: '0 0 80px rgba(99,102,241,.08)',
          }}
        >
          {success ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">✅</div>
              <h2 className="text-xl font-black mb-2" style={{ color: 'var(--text)' }}>
                Check your email!
              </h2>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                We sent a confirmation link to <strong style={{ color: 'var(--text2)' }}>{email}</strong>. Click it to activate your account.
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
                Create your account
              </h1>
              <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>
                Start with 5 free generations — no credit card required
              </p>
              <div
                className="flex items-center gap-2 mb-7 px-3 py-2 rounded-lg text-xs font-semibold"
                style={{
                  background: 'rgba(16,185,129,.08)',
                  border: '1px solid rgba(16,185,129,.18)',
                  color: '#34d399',
                }}
              >
                <span
                  className="w-2 h-2 rounded-full animate-pulse-dot"
                  style={{ background: '#34d399', boxShadow: '0 0 6px rgba(52,211,153,.5)' }}
                />
                Free tier · 5 viral scripts included
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
                      e.target.style.borderColor = 'rgba(99,102,241,.5)'
                      e.target.style.background = 'rgba(99,102,241,.04)'
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
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Min. 6 characters"
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,.03)',
                      border: '1px solid var(--border2)',
                      color: 'var(--text)',
                      fontFamily: 'inherit',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'rgba(99,102,241,.5)'
                      e.target.style.background = 'rgba(99,102,241,.04)'
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
                  className="w-full rounded-xl py-3.5 font-bold text-sm text-white transition-all mt-1"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
                    boxShadow: '0 4px 22px rgba(99,102,241,.3)',
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Creating account...' : '⚡ Create Free Account'}
                </button>
              </form>

              <p className="text-center text-sm mt-6" style={{ color: 'var(--muted)' }}>
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
  )
}
