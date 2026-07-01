'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.shortsforgeai.com'

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      {/* Glow orbs — subtle Kineo blue */}
      <div className="fixed rounded-full pointer-events-none" style={{ width: 600, height: 600, background: '#2997ff', top: -200, right: -150, opacity: 0.04, filter: 'blur(90px)', zIndex: 0 }} />
      <div className="fixed rounded-full pointer-events-none" style={{ width: 500, height: 500, background: '#2997ff', bottom: -150, left: 300, opacity: 0.035, filter: 'blur(90px)', zIndex: 0 }} />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-8" style={{ textDecoration: 'none' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: '#2997ff', boxShadow: '0 0 24px rgba(41,151,255,.45)' }}>
            ⚡
          </div>
          <div>
            <div className="font-black text-sm tracking-tight" style={{ color: '#f5f5f7' }}>
              Kineo
            </div>
          </div>
        </Link>

        <div className="rounded-2xl p-8" style={{ background: '#161618', border: '1px solid #2a2a2d', boxShadow: '0 0 80px rgba(41,151,255,.08)' }}>
          {sent ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">📧</div>
              <h2 className="text-xl font-black mb-2" style={{ color: 'var(--text)' }}>Check your inbox!</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                We sent a password reset link to{' '}
                <strong style={{ color: 'var(--text2)' }}>{email}</strong>.
                <br />Click it to set a new password.
              </p>
              <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: '#2997ff', textDecoration: 'none' }}>
                ← Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-black mb-1 tracking-tight" style={{ color: 'var(--text)' }}>Forgot password?</h1>
              <p className="text-sm mb-7" style={{ color: 'var(--muted)' }}>
                Enter your email and we&apos;ll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="forgot-email" className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
                    Email
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    aria-describedby={error ? 'forgot-error' : undefined}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                    style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border2)', color: 'var(--text)', fontFamily: 'inherit' }}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(41,151,255,.5)'; e.target.style.background = 'rgba(41,151,255,.04)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border2)'; e.target.style.background = 'rgba(255,255,255,.03)' }}
                  />
                </div>

                {error && (
                  <div id="forgot-error" role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl py-3.5 font-bold text-sm transition-all mt-1"
                  style={{ background: '#f5f5f7', color: '#000', boxShadow: '0 4px 22px rgba(41,151,255,.3)', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                  {loading ? 'Sending...' : '📧 Send Reset Link'}
                </button>
              </form>

              <p className="text-center text-sm mt-6" style={{ color: 'var(--muted)' }}>
                Remember your password?{' '}
                <Link href="/login" className="font-semibold" style={{ color: '#2997ff', textDecoration: 'none' }}>
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
