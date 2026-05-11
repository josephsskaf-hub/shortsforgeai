'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
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
        <Link href="/" className="flex items-center justify-center gap-3 mb-8" style={{ textDecoration: 'none' }}>
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
        </Link>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border2)',
            boxShadow: '0 0 80px rgba(99,102,241,.08)',
          }}
        >
          <h1
            className="text-2xl font-black mb-1 tracking-tight"
            style={{ color: 'var(--text)' }}
          >
            Welcome Back, Creator
          </h1>
          <p className="text-sm mb-7" style={{ color: 'var(--muted)' }}>
            Continue building your viral Shorts empire.
          </p>

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
  )
}
