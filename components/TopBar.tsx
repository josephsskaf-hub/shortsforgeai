'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface TopBarProps {
  title: string
  subtitle?: string
  onMenuToggle?: () => void
  isPro: boolean
}

// Push #080 — top-header auth buttons on dashboard pages.
// The homepage gained working Sign In/Up/Out buttons in push #079 via
// HomePageClient.tsx, but the dashboard layout's TopBar only rendered the Pro
// badge. Add the same auth tail here so every page in the (dashboard) group
// shows working auth controls in the top header — guests see Sign In + Sign
// Up; signed-in users see Sign Out (Dashboard is already the page they're on,
// so we omit it here to keep the bar tight). Detection mirrors HomePageClient:
// initial getSession() check + onAuthStateChange subscription so the UI
// updates immediately on login/logout without a full reload.
export default function TopBar({ title, subtitle, onMenuToggle, isPro }: TopBarProps) {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ? { id: data.session.user.id } : null)
      setAuthChecked(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id } : null)
      setAuthChecked(true)
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      setUser(null)
    } catch {
      // ignore
    } finally {
      setSigningOut(false)
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div
      className="flex items-center gap-4 flex-shrink-0 sticky top-0 z-30 px-6"
      style={{
        height: 64,
        background: 'rgba(11,16,32,0.9)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Hamburger (mobile) */}
      <button
        onClick={onMenuToggle}
        className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
        style={{
          background: 'rgba(255,255,255,.03)',
          border: '1px solid var(--border)',
          color: 'var(--muted2)',
          cursor: 'pointer',
          fontSize: '1rem',
        }}
        aria-label="Toggle menu"
      >
        ☰
      </button>

      {/* Mobile logo link */}
      <Link
        href="/"
        className="md:hidden flex items-center justify-center flex-shrink-0"
        style={{
          width: 32, height: 32, borderRadius: 10, textDecoration: 'none',
          background: '#151C2F',
          border: '1px solid rgba(59,130,246,0.4)',
          boxShadow: '0 0 14px rgba(34,211,238,0.3)',
        }}
        aria-label="Home"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="#22D3EE" />
        </svg>
      </Link>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>ShortsForgeAI</Link>
        <span style={{ opacity: 0.3 }}>›</span>
        <span className="font-semibold" style={{ color: 'var(--text)' }}>
          {title}
        </span>
        {subtitle && (
          <>
            <span style={{ opacity: 0.3 }}>›</span>
            <span>{subtitle}</span>
          </>
        )}
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">
        {isPro && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
            style={{
              background: 'rgba(16,185,129,.08)',
              border: '1px solid rgba(16,185,129,.18)',
              color: '#34d399',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#10b981', boxShadow: '0 0 6px rgba(52,211,153,.5)' }}
            />
            Pro
          </div>
        )}

        {/* Auth buttons — render only after auth check completes so we don't
            flash the wrong state on hydration. */}
        {!authChecked ? (
          <div aria-hidden style={{ height: 36, width: 168 }} />
        ) : user ? (
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/5 disabled:opacity-60"
            style={{ border: '1px solid rgba(255,255,255,0.2)' }}
          >
            {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/5"
              style={{ border: '1px solid rgba(255,255,255,0.2)' }}
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-[#2563EB] px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
