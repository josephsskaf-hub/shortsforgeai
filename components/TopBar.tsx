'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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
        // Neon redesign (12/06) — violet-black glass bar.
        background: 'rgba(8,5,18,0.88)',
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
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect y="2" width="16" height="1.5" rx="1" fill="currentColor" />
          <rect y="7.25" width="16" height="1.5" rx="1" fill="currentColor" />
          <rect y="12.5" width="16" height="1.5" rx="1" fill="currentColor" />
        </svg>
      </button>

      {/* Mobile logo link */}
      <Link
        href="/"
        className="md:hidden flex items-center justify-center flex-shrink-0"
        style={{
          width: 32, height: 32, borderRadius: 10, textDecoration: 'none',
          background: 'rgba(34,211,238,0.08)',
          border: '1px solid rgba(34,211,238,0.35)',
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

      {/* Right side — AI Avatar shortcut + credits badge + Pro badge. */}
      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        {/* Face-app (12/06) — AI Avatar entry in every creation environment.
            Deep-links to /generate with the avatar panel auto-open. */}
        <Link
          href="/avatar"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all hover:scale-[1.03]"
          style={{
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(52,211,153,0.35)',
            color: '#34D399',
            textDecoration: 'none',
          }}
        >
          🎭 AI Avatar
          <span
            className="rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider"
            style={{ background: 'rgba(52,211,153,0.18)', color: '#6EE7B7' }}
          >
            New
          </span>
        </Link>
        {/* Push #098 — header credits badge. Red link to /pricing when 0,
            amber when <=5 and not Pro, neutral otherwise. */}
        <CreditsBadge isPro={isPro} />
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

// ─── Push #098 — Credits badge ──────────────────────────────────────────────
// Fetches /api/credits (same endpoint the Sidebar uses) and listens for the
// `creditsChanged` event so it stays in sync after every generation. Three
// visual states: empty (red, links to /pricing), low (amber, not-Pro), and
// neutral (subtle slate chip).
function CreditsBadge({ isPro }: { isPro: boolean }) {
  const [credits, setCredits] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function fetchCredits() {
      try {
        const res = await fetch('/api/credits', { cache: 'no-store' })
        if (res.status === 401) {
          if (!cancelled) setCredits(null)
          return
        }
        const data = await res.json()
        if (!cancelled) {
          setCredits(typeof data.credits === 'number' ? data.credits : 0)
        }
      } catch {
        if (!cancelled) setCredits(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchCredits()
    window.addEventListener('creditsChanged', fetchCredits)
    return () => {
      cancelled = true
      window.removeEventListener('creditsChanged', fetchCredits)
    }
  }, [])

  // Supabase Realtime — pushes the new balance to this client whenever the
  // user's profiles row changes in the DB, so the header badge updates on
  // every device/tab without a refresh (the `creditsChanged` event above only
  // fires within the same window).
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return
      channel = supabase
        .channel('credits-realtime-topbar')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          (payload) => {
            const row = payload.new as { video_credits?: number }
            if (typeof row.video_credits === 'number') setCredits(row.video_credits)
          },
        )
        .subscribe()
    })
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  if (loading || credits === null) return null

  const isZero = credits <= 0
  const isLow = !isZero && credits <= 5 && !isPro

  const colors = isZero
    ? { fg: '#f87171', bg: 'rgba(239,68,68,.10)', border: 'rgba(239,68,68,.35)' }
    : isLow
    ? { fg: '#fbbf24', bg: 'rgba(251,191,36,.10)', border: 'rgba(251,191,36,.35)' }
    : { fg: '#cbd5e1', bg: 'rgba(255,255,255,.04)', border: 'rgba(255,255,255,.08)' }

  const label = (
    <span
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.fg,
      }}
    >
      <span aria-hidden="true">⚡</span>
      {credits} credit{credits === 1 ? '' : 's'}
    </span>
  )

  if (isZero) {
    return (
      <Link href="/pricing" style={{ textDecoration: 'none' }} aria-label="Out of credits — view pricing">
        {label}
      </Link>
    )
  }
  return label
}
