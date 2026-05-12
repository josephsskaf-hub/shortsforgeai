'use client'

import Link from 'next/link'

interface TopBarProps {
  title: string
  subtitle?: string
  onMenuToggle?: () => void
  isPro: boolean
}

export default function TopBar({ title, subtitle, onMenuToggle, isPro }: TopBarProps) {
  return (
    <div
      className="flex items-center gap-4 flex-shrink-0 sticky top-0 z-30 px-6"
      style={{
        height: 64,
        background: 'rgba(8,8,15,.88)',
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
          background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
          boxShadow: '0 0 16px rgba(99,102,241,.4)',
          fontSize: '1rem',
        }}
        aria-label="Home"
      >
        ⚡
      </Link>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
        <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>ShortsForge</Link>
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

      </div>
    </div>
  )
}
