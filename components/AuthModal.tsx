'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface AuthModalProps {
  onClose: () => void
  defaultTab?: 'login' | 'signup'
}

export default function AuthModal({ onClose, defaultTab = 'signup' }: AuthModalProps) {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<'login' | 'signup'>(defaultTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailAlreadyExists, setEmailAlreadyExists] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  function switchTab(t: 'login' | 'signup') {
    setTab(t)
    setError(null)
    setEmailAlreadyExists(false)
    setEmailSent(false)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.refresh()
      onClose()
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setEmailAlreadyExists(false)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
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

    // Try immediate sign-in (if email confirmation is disabled)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (!signInError) {
      router.refresh()
      onClose()
    } else {
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
    >
      <div
        className="w-full max-w-md rounded-2xl relative overflow-hidden"
        style={{
          background: 'var(--card2)',
          border: '1px solid rgba(99,102,241,.25)',
          boxShadow: '0 0 100px rgba(99,102,241,.22), 0 30px 80px rgba(0,0,0,.5)',
        }}
      >
        {/* Top accent */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5 pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, #6366f1, #a855f7, transparent)' }}
        />
        {/* Glow orb */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: 300, height: 300,
            background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
            top: -100, right: -80, borderRadius: '50%',
          }}
        />

        <div className="relative z-10 p-7">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all"
            style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--muted2)', cursor: 'pointer' }}
          >
            ✕
          </button>

          {/* Logo */}
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--indigo), var(--purple))', boxShadow: '0 0 24px rgba(99,102,241,.45)' }}
            >
              ⚡
            </div>
            <div>
              <div className="font-black text-sm tracking-tight" style={{ background: 'linear-gradient(135deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                ShortsForgeAI
              </div>
              <div className="text-xs" style={{ color: 'var(--muted)', marginTop: 1 }}>
                Generate 5 viral scripts in 30 seconds
              </div>
            </div>
          </div>

          {/* Email sent state */}
          {emailSent ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-4">✅</div>
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
                  style={{ background: 'rgba(16,185,129,.07)', border: '1px solid rgba(16,185,129,.18)', color: '#34d399' }}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse-dot" style={{ background: '#34d399', boxShadow: '0 0 6px rgba(52,211,153,.5)' }} />
                  Free tier · 5 viral scripts included — no card required
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
                      background: tab === t ? 'linear-gradient(135deg, rgba(99,102,241,.25), rgba(124,58,237,.2))' : 'transparent',
                      border: tab === t ? '1px solid rgba(99,102,241,.25)' : '1px solid transparent',
                      color: tab === t ? 'var(--indigo-light)' : 'var(--muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {t === 'signup' ? '⚡ Create Account' : '🔑 Sign In'}
                  </button>
                ))}
              </div>

              {/* Heading */}
              <div className="mb-5">
                <h2 className="text-xl font-black tracking-tight mb-1" style={{ color: 'var(--text)' }}>
                  {tab === 'signup' ? 'Start creating viral shorts' : 'Welcome back'}
                </h2>
                <p className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
                  {tab === 'signup'
                    ? 'Create your free account and get 5 viral scripts instantly.'
                    : 'Sign in to access your account and continue generating.'}
                </p>
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
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(99,102,241,.5)'; e.target.style.background = 'rgba(99,102,241,.04)' }}
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
                    onFocus={(e) => { e.target.style.borderColor = 'rgba(99,102,241,.5)'; e.target.style.background = 'rgba(99,102,241,.04)' }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border2)'; e.target.style.background = 'rgba(255,255,255,.03)' }}
                  />
                </div>

                {/* Email already exists — friendly message */}
                {emailAlreadyExists && (
                  <div
                    className="rounded-xl px-4 py-3 text-xs"
                    style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.22)', color: '#fbbf24' }}
                  >
                    <span className="font-bold">Email já cadastrado.</span>{' '}
                    <button
                      type="button"
                      onClick={() => switchTab('login')}
                      className="font-bold underline"
                      style={{ color: '#fbbf24', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Faça login →
                    </button>
                  </div>
                )}

                {/* Generic error */}
                {error && !emailAlreadyExists && (
                  <div
                    className="rounded-xl px-4 py-3 text-xs flex items-center gap-2"
                    style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171' }}
                  >
                    <span>⚠️</span> {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl py-3.5 font-black text-sm text-white transition-all mt-1 flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)',
                    boxShadow: loading ? 'none' : '0 4px 28px rgba(99,102,241,.45)',
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
                  ) : tab === 'signup' ? '⚡ Create Free Account' : '🔑 Sign In'}
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
