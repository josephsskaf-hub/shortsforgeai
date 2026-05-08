'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useCallback } from 'react'
import AuthModal from '@/components/AuthModal'

interface SidebarProps {
  userEmail: string
  isPro: boolean
  generationsUsed: number
  isLoggedIn: boolean
  isOpen?: boolean
  onClose?: () => void
}

const TOP_PICKS = [
  { id: 'mystery', icon: '🔮', label: 'Mystery', hex: '#a855f7', glow: 'rgba(168,85,247,' },
  { id: 'strange-facts', icon: '🤯', label: 'Facts', hex: '#6366f1', glow: 'rgba(99,102,241,' },
  { id: 'money', icon: '💰', label: 'Money', hex: '#10b981', glow: 'rgba(16,185,129,' },
  { id: 'ai-tools', icon: '🤖', label: 'AI Tools', hex: '#6366f1', glow: 'rgba(99,102,241,' },
  { id: 'psychology-facts', icon: '🧠', label: 'Psychology', hex: '#ec4899', glow: 'rgba(236,72,153,' },
  { id: 'space-mysteries', icon: '🌌', label: 'Space', hex: '#0ea5e9', glow: 'rgba(14,165,233,' },
  { id: 'history', icon: '⚔️', label: 'History', hex: '#f59e0b', glow: 'rgba(245,158,11,' },
  { id: 'conspiracy-files', icon: '👁️', label: 'Conspiracy', hex: '#ef4444', glow: 'rgba(239,68,68,' },
  { id: 'luxury-lifestyle', icon: '💎', label: 'Luxury', hex: '#fbbf24', glow: 'rgba(251,191,36,' },
  { id: 'dark-history', icon: '🌑', label: 'Dark Stories', hex: '#818cf8', glow: 'rgba(129,140,248,' },
]

function NichePill({
  niche,
  onClose,
}: {
  niche: typeof TOP_PICKS[0]
  onClose?: () => void
}) {
  const router = useRouter()
  const [hovered, setHovered] = useState(false)

  function handleClick() {
    onClose?.()
    router.push(`/create?niche=${niche.id}`)
  }

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left w-full transition-all"
      style={{
        background: hovered
          ? `linear-gradient(135deg, ${niche.glow}0.15), rgba(255,255,255,0.03))`
          : `${niche.glow}0.07)`,
        border: `1px solid ${niche.glow}${hovered ? '0.45)' : '0.2)'})`,
        color: hovered ? '#fff' : 'var(--muted2)',
        cursor: 'pointer',
        boxShadow: hovered
          ? `0 0 18px ${niche.glow}0.28), inset 0 1px 0 rgba(255,255,255,0.07)`
          : '0 0 0 transparent',
        transform: hovered ? 'translateX(3px)' : 'translateX(0)',
        transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <span
        style={{
          fontSize: '1.15rem',
          flexShrink: 0,
          filter: hovered ? `drop-shadow(0 0 6px ${niche.hex}99)` : 'none',
          transition: 'filter 0.18s ease',
        }}
      >
        {niche.icon}
      </span>
      <span
        style={{
          fontSize: '0.8rem',
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: hovered ? '#fff' : 'var(--muted2)',
          transition: 'color 0.18s ease',
        }}
      >
        {niche.label}
      </span>
      <span
        style={{
          marginLeft: 'auto',
          fontSize: '0.65rem',
          opacity: hovered ? 0.8 : 0.4,
          color: hovered ? niche.hex : 'inherit',
          transition: 'all 0.18s ease',
        }}
      >
        →
      </span>
    </button>
  )
}

function NavItem({
  href,
  icon,
  label,
  exact,
  pathname,
  onClick,
  badge,
}: {
  href: string
  icon: string
  label: string
  exact: boolean
  pathname: string
  onClick?: () => void
  badge?: string
}) {
  const router = useRouter()
  const [hovered, setHovered] = useState(false)
  const hrefPath = href.split('?')[0]
  const active = exact
    ? pathname === hrefPath
    : pathname === hrefPath || pathname.startsWith(hrefPath + '/')

  function handleClick(e: React.MouseEvent) {
    if (active) {
      e.preventDefault()
      router.refresh()
    }
    onClick?.()
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold relative"
      style={{
        background: active
          ? 'linear-gradient(135deg, rgba(99,102,241,0.16), rgba(124,58,237,0.1))'
          : hovered
          ? 'rgba(255,255,255,0.04)'
          : 'transparent',
        color: active ? '#a5b4fc' : hovered ? 'var(--text)' : 'var(--muted2)',
        border: active
          ? '1px solid rgba(99,102,241,0.28)'
          : '1px solid transparent',
        textDecoration: 'none',
        fontSize: '0.88rem',
        boxShadow: active ? '0 0 24px rgba(99,102,241,0.14), inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
        transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {active && (
        <span
          className="absolute"
          style={{
            left: -1,
            top: '18%',
            height: '64%',
            width: 3,
            background: 'linear-gradient(180deg, #818cf8, #a78bfa)',
            borderRadius: '0 3px 3px 0',
            boxShadow: '0 0 8px rgba(129,140,248,0.6)',
          }}
        />
      )}
      <span
        style={{
          fontSize: '1.2rem',
          flexShrink: 0,
          filter: active ? 'drop-shadow(0 0 5px rgba(129,140,248,0.5))' : 'none',
          transition: 'filter 0.18s ease',
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span
          style={{
            fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.06em',
            background: 'rgba(99,102,241,0.15)', color: '#818cf8',
            padding: '2px 6px', borderRadius: 5, border: '1px solid rgba(99,102,241,0.25)',
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}

export default function Sidebar({
  userEmail: initialEmail,
  isPro: initialIsPro,
  isLoggedIn: initialLoggedIn,
  isOpen = true,
  onClose,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [isPro, setIsPro] = useState(initialIsPro)
  const [userEmail, setUserEmail] = useState(initialEmail)
  const [isLoggedIn, setIsLoggedIn] = useState(initialLoggedIn)
  const [credits, setCredits] = useState<number | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(true)

  const fetchCredits = useCallback(async () => {
    if (!isLoggedIn) { setCredits(null); setCreditsLoading(false); return }
    setCreditsLoading(true)
    try {
      const res = await fetch('/api/credits', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setCredits(typeof data.credits === 'number' ? data.credits : 0)
      } else setCredits(0)
    } catch { setCredits(0) }
    finally { setCreditsLoading(false) }
  }, [isLoggedIn])

  useEffect(() => {
    fetchCredits()
    window.addEventListener('creditsChanged', fetchCredits)
    return () => window.removeEventListener('creditsChanged', fetchCredits)
  }, [fetchCredits])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setIsLoggedIn(false); setUserEmail(''); setIsPro(false); setCredits(null)
      } else if (event === 'SIGNED_IN' && session?.user) {
        setIsLoggedIn(true); setUserEmail(session.user.email ?? '')
        const { data } = await supabase.from('profiles').select('is_pro').eq('id', session.user.id).single()
        if (data) setIsPro(data.is_pro ?? false)
        fetchCredits()
      }
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const creditsZero = credits !== null && credits <= 0

  return (
    <>
      {isOpen && onClose && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        />
      )}

      <aside
        className="fixed left-0 top-0 h-screen flex flex-col z-50 transition-transform duration-300"
        style={{
          width: 248,
          background: 'linear-gradient(180deg, rgba(10,10,20,0.98) 0%, rgba(8,8,16,0.99) 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {/* Logo */}
        <Link
          href={isLoggedIn ? '/dashboard' : '/'}
          onClick={onClose}
          className="flex items-center gap-3 px-5 flex-shrink-0"
          style={{ height: 72, borderBottom: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
              boxShadow: '0 0 30px rgba(99,102,241,0.55)',
              fontSize: '1.3rem',
            }}
          >
            ⚡
          </div>
          <div className="flex flex-col gap-1">
            <span
              className="font-black tracking-tight leading-none"
              style={{
                fontSize: '0.95rem',
                background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              ShortsForge
            </span>
            <span
              style={{
                fontSize: '0.52rem', fontWeight: 900, letterSpacing: '0.12em',
                background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.32)',
                color: '#818cf8', padding: '1px 5px', borderRadius: 4,
              }}
            >
              AI
            </span>
          </div>
        </Link>

        {/* Credits Card */}
        {isLoggedIn && (
          <div className="px-3 pt-4 pb-2 flex-shrink-0">
            <Link
              href="/pricing"
              onClick={onClose}
              className="flex items-center justify-between rounded-xl px-4 py-3 transition-all"
              style={{
                background: creditsZero
                  ? 'rgba(239,68,68,0.08)'
                  : 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(124,58,237,0.1))',
                border: creditsZero
                  ? '1px solid rgba(239,68,68,0.32)'
                  : '1px solid rgba(99,102,241,0.32)',
                boxShadow: creditsZero
                  ? '0 0 22px rgba(239,68,68,0.12)'
                  : '0 0 28px rgba(99,102,241,0.2), inset 0 1px 0 rgba(255,255,255,0.06)',
                textDecoration: 'none',
                transition: 'all 0.18s ease',
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    background: creditsZero
                      ? 'rgba(239,68,68,0.15)'
                      : 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(124,58,237,0.2))',
                    border: creditsZero
                      ? '1px solid rgba(239,68,68,0.3)'
                      : '1px solid rgba(99,102,241,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.1rem',
                    boxShadow: creditsZero ? 'none' : '0 0 12px rgba(99,102,241,0.3)',
                  }}
                >
                  ⚡
                </div>
                {creditsLoading ? (
                  <span style={{ display: 'inline-block', width: 64, height: 14, borderRadius: 4, background: 'rgba(255,255,255,0.07)', animation: 'pulse 1.4s ease-in-out infinite' }} />
                ) : (
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 900, color: creditsZero ? '#f87171' : '#a5b4fc', lineHeight: 1.1 }}>
                      {credits ?? 0} {credits === 1 ? 'credit' : 'credits'}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: creditsZero ? 'rgba(248,113,113,0.7)' : 'var(--muted)', marginTop: 1 }}>
                      {creditsZero ? 'No credits left' : 'available'}
                    </div>
                  </div>
                )}
              </div>
              <div
                style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: creditsZero
                    ? 'rgba(239,68,68,0.18)'
                    : 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(124,58,237,0.2))',
                  border: creditsZero
                    ? '1px solid rgba(239,68,68,0.35)'
                    : '1px solid rgba(99,102,241,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: creditsZero ? '#f87171' : '#a5b4fc',
                  fontSize: '1.1rem', fontWeight: 900,
                  boxShadow: creditsZero ? 'none' : '0 0 10px rgba(99,102,241,0.25)',
                }}
              >
                +
              </div>
            </Link>
          </div>
        )}

        {/* Scrollable nav */}
        <nav className="flex-1 overflow-y-auto flex flex-col" style={{ padding: '8px 10px 12px' }}>

          {/* Top Picks */}
          <div
            style={{
              fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.15em',
              color: 'rgba(255,255,255,0.35)', padding: '12px 8px 8px',
              textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <span style={{ fontSize: '0.75rem' }}>🔥</span>
            Top Picks
          </div>
          <div className="flex flex-col gap-1 mb-3">
            {TOP_PICKS.map((niche) => (
              <NichePill key={niche.id} niche={niche} onClose={onClose} />
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 4px 8px' }} />

          {/* Main nav */}
          <NavItem href="/create" icon="⚡" label="Generate" exact={false} pathname={pathname} onClick={onClose} />
          <NavItem href="/history" icon="📋" label="History" exact={false} pathname={pathname} onClick={onClose} />

        </nav>

        {/* Bottom: guest CTA or no-credits upsell */}
        {!isLoggedIn ? (
          <div className="px-3 pb-3 flex-shrink-0">
            <div style={{ borderRadius: 14, padding: '14px 14px', background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(124,58,237,0.08))', border: '1px solid rgba(99,102,241,0.22)' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>⚡ 3 free credits</p>
              <p style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.5, marginBottom: 10 }}>Sign up and start generating viral videos instantly.</p>
              <button
                onClick={() => setShowAuthModal(true)}
                style={{ display: 'block', width: '100%', textAlign: 'center', borderRadius: 10, padding: '9px 0', fontSize: '0.8rem', fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg, #6366f1, #7c3aed)', border: 'none', cursor: 'pointer' }}
              >
                ⚡ Get Started Free →
              </button>
            </div>
          </div>
        ) : creditsZero ? (
          <div className="px-3 pb-3 flex-shrink-0">
            <div style={{ borderRadius: 14, padding: '14px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.22)' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fca5a5', marginBottom: 4 }}>⚠️ No credits left</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--muted)', lineHeight: 1.45, marginBottom: 10 }}>Buy a pack to keep creating.</p>
              <Link href="/pricing" onClick={onClose} style={{ display: 'block', textAlign: 'center', borderRadius: 10, padding: '9px 0', fontSize: '0.8rem', fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg, #6366f1, #7c3aed)', textDecoration: 'none' }}>
                💳 Buy Credits →
              </Link>
            </div>
          </div>
        ) : null}

        {/* User row + small logout */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px 12px' }}>
          <div className="flex items-center gap-2.5">
            <div
              style={{
                width