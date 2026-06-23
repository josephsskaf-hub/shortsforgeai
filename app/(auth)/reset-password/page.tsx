'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase puts the token in the URL hash — wait for auth state to process it
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    // Also try to detect from URL hash directly
    const hash = window.location.hash
    if (hash.includes('type=recovery') || hash.includes('access_token')) {
      setReady(true)
    }
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/generate'), 2000)
    }
  }

  const inputStyle = {
    background: 'rgba(255,255,255,.03)',
    border: '1px solid var(--border2)',
    color: 'var(--text)',
    fontFamily: 'inherit',
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="fixed rounded-full pointer-events-none" style={{ width: 600, height: 600, background: 'var(--indigo)', top: -200, right: -150, opacity: 0.04, filter: 'blur(90px)', zIndex: 0 }} />
      <div className="fixed rounded-full pointer-events-none" style={{ width: 500, height: 500, background: 'var(--purple)', bottom: -150, left: 300, opacity: 0.035, filter: 'blur(90px)', zIndex: 0 }} />

      <div className="w-full max-w-md relative z-10">
        <Link href="/" className="flex items-center justify-center gap-3 mb-8" style={{ textDecoration: 'none' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'linear-gradient(135deg, var(--indigo), var(--purple))', boxShadow: '0 0 24px rgba(16, 185, 129,.45)' }}>
            ⚡
          </div>
          <div className="font-black text-sm tracking-tight" style={{ background: 'linear-gradient(135deg, #A78BFA, #22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ShortsForgeAI
          </div>
        </Link>

        <div className="rounded-2xl p-8" style={{ background: 'var(--card)', border: '1px solid var(--border2)', boxShadow: '0 0 80px rgba(16, 185, 129,.08)' }}>
          {success ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">✅</div>
              <h2 className="text-xl font-black mb-2" style={{ color: 'var(--text)' }}>Password updated!</h2>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Redirecting you to the dashboard...
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-black mb-1 tracking-tight" style={{ color: 'var(--text)' }}>Set new password</h1>
              <p className="text-sm mb-7" style={{ color: 'var(--muted)' }}>
                Choose a strong password for your account.
              </p>

              {!ready && (
                <div className="rounded-xl px-4 py-3 text-sm mb-5" style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', color: '#22D3EE' }}>
                  ⚠️ If this page looks stuck, go back and click the reset link from your email again.
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Min. 6 characters"
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(16, 185, 129,.5)'; e.target.style.background = 'rgba(16, 185, 129,.04)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border2)'; e.target.style.background = 'rgba(255,255,255,.03)' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--muted2)' }}>
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Repeat your password"
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                    style={inputStyle}
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(16, 185, 129,.5)'; e.target.style.background = 'rgba(16, 185, 129,.04)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border2)'; e.target.style.background = 'rgba(255,255,255,.03)' }}
                  />
                </div>

                {error && (
                  <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !ready}
                  className="w-full rounded-xl py-3.5 font-bold text-sm transition-all mt-1"
                  style={{
                    background: '#8B5CF6',
                    color: '#FFFFFF',
                    boxShadow: '0 4px 22px rgba(16, 185, 129,.3)',
                    opacity: (loading || !ready) ? 0.7 : 1,
                    cursor: (loading || !ready) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Saving...' : '🔐 Update Password'}
                </button>
              </form>

              <p className="text-center text-sm mt-6" style={{ color: 'var(--muted)' }}>
                <Link href="/login" className="font-semibold" style={{ color: 'var(--indigo-light)', textDecoration: 'none' }}>
                  ← Back to Sign In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
