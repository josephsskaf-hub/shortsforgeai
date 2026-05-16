'use client'

import Link from 'next/link'

interface TopBarProps {
  title: string
  subtitle?: string
  onMenuToggle?: () => void
  isPro: boolean
}

// Push #082 — auth UI consolidated to the Sidebar inside the dashboard layout.
// The TopBar used to also render Sign In / Sign Up / Sign Out, which meant
// every dashboard page showed two auth controls (one in the sidebar, one in
// the header). The sidebar already exposes the avatar, email, settings menu,
// and sign-out button for signed-in users, plus a "Get Started Free" CTA and
// inline Sign in button for guests, so the duplicate header tail was just
// noise. The TopBar now keeps only the breadcrumb + Pro badge.
export default function TopBar({ title, subtitle, onMenuToggle, isPro }: TopBarProps) {
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
      <div className="flex items-center gap-2 text-xs min-w-0" style={{ color: 'var(--muted)' }}>
        <Link href="/" className="hidden sm:inline" style={{ textDecoration: 'none', color: 'inherit' }}>ShortsForgeAI</Link>
        <span className="hidden sm:inline" style={{ opacity: 0.3 }}>›</span>
        <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>
          {title}
        </span>
        {subtitle && (
          <>
            <span style={{ opacity: 0.3 }}>›</span>
            <span className="truncate">{subtitle}</span>
          </>
        )}
      </div>

      {/* Right side — Pro badge only. Auth controls live in the Sidebar. */}
      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
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
      </div>
    </div>
  )
}
