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
  { id: 'mystery', icon: '🔮', label: 'Mystery', color: 'rgba(168,85,247,' },
  { id: 'mind', icon: '🤯', label: 'Facts', color: 'rgba(59,130,246,' },
  { id: 'money', icon: '💰', label: 'Money', color: 'rgba(16,185,129,' },
  { id: 'ai-tools', icon: '🤖', label: 'AI', color: 'rgba(99,102,241,' },
  { id: 'psychology-facts', icon: '🧠', label: 'Psychology', color: 'rgba(236,72,153,' },
  { id: 'space-mysteries', icon: '🌌', label: 'Space', color: 'rgba(14,165,233,' },
  { id: 'history', icon: '⚔️', label: 'History', color: 'rgba(245,158,11,' },
  { id: 'conspiracy-files', icon: '👁️', label: 'Conspiracy', color: 'rgba(239,68,68,' },
  { id: 'luxury-lifestyle', icon: '💎', label: 'Luxury', color: 'rgba(251,191,36,' },
  { id: 'dark-history', icon: '🌑', label: 'Dark Stories', color: 'rgba(99,102,241,' },
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
    router.push(`/create?niche=${niche.id}&autostart=true`)
  }

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left w-full transition-all"
      style={{
        background: hovered ? `${niche.color}0.12)` : `${niche.color}0.06)`,
        border: `1px solid ${niche.color}${hovered ? '0.4)' : '0.18)'})`,
        color: hovered ? '#fff' : 'var(--muted2)',
        cursor: 'pointer',
        boxShadow: hovered ? `0 0 16px ${niche.color}0.25)` : 'none',
        transform: hovered ? 'translateX(2px)' : 'none',
      }}
    >
      <span style={{ fontSize: '1rem', flexShrink: 0 }}>{niche.icon}</span>
      <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '-0.01em' }}>{niche.label}</span>
      <span style={{ marginLeft: 'auto', fontSize: '0.65rem', opacity: 0.5 }}>→</span>
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
      className="flex items-center gap-3 rounded-xl px-3 py-3 font-semibold transition-all relative"
      style={{
        background: active ? 'rgba(99,102,241,0.13)' : 'transparent',
        color: active ? '#a5b4fc' : 'var(--muted2)',
        border: active ? '1px solid rgba(99,102,241,0.22)' : '1px solid transparent',
        textDecoration: 'none',
        fontSize: '0.88rem',
        boxShadow: active ? '0 0 20px rgba(99,102,241,0.1)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLElement).style.color = 'var(--muted2)'
        }
      }}
    >
      {active && (
        <span
          className="absolute rounded-r"
          style={{ left: -1, top: '20%', height: '60%', width: 3, background: '#818cf8', borderRadius: '0 3px 3px 0' }}
        />
      )}
      <span style={{ fontSize: '1.15rem', flexShrink: 0 }}>{icon}</span>
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
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
          onClick={onClose}
        />
      )}

      <aside
        className="fixed left-0 top-0 h-screen flex flex-col z-50 transition-transform duration-300"
        style={{
          width: 248,
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--border)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {/* Logo */}
        <Link
          href={isLoggedIn ? '/dashboard' : '/'}
          onClick={onClose}
          className="flex items-center gap-3 px-5 flex-shrink-0"
          style={{ height: 72, borderBottom: '1px solid var(--border)', textDecoration: 'none' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
              boxShadow: '0 0 28px rgba(99,102,241,0.5)',
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
                  : 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(124,58,237,0.08))',
                border: creditsZero
                  ? '1px solid rgba(239,68,68,0.3)'
                  : '1px solid rgba(99,102,241,0.28)',
                boxShadow: creditsZero
                  ? '0 0 20px rgba(239,68,68,0.1)'
                  : '0 0 24px rgba(99,102,241,0.15)',
                textDecoration: 'none',
              }}
            >
              <div className="flex items-center gap-2.5">
                <span style={{ fontSize: '1.15rem' }}>⚡</span>
                {creditsLoading ? (
                  <span style={{ display: 'inline-block', width: 64, height: 14, borderRadius: 4, background: 'rgba(255,255,255,0.07)', animation: 'pulse 1.4s ease-in-out infinite' }} />
                ) : (
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 900, color: creditsZero ? '#f87171' : '#a5b4fc', lineHeight: 1.1 }}>
                      {credits ?? 0} {credits === 1 ? 'credit' : 'credits'}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--muted)', marginTop: 1 }}>
                      {creditsZero ? 'No credits left' : 'available'}
                    </div>
                  </div>
                )}
              </div>
              <div
                style={{
                  width: 26, height: 26, borderRadius: 8,
                  background: creditsZero ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.18)',
                  border: creditsZero ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(99,102,241,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: creditsZero ? '#f87171' : '#818cf8', fontSize: '1rem', fontWeight: 900,
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
            style={{ fontSize: '0.62rem', fontWeight: 900, letterSpacing: '0.14em', color: 'var(--muted)', padding: '12px 8px 8px', textTransform: 'uppercase' }}
          >
            🔥 Top Picks
          </div>
          <div className="flex flex-col gap-1 mb-3">
            {TOP_PICKS.map((niche) => (
              <NichePill key={niche.id} niche={niche} onClose={onClose} />
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)', margin: '4px 4px 8px' }} />

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
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px 12px' }}>
          <div className="flex items-center gap-2.5">
            <div
              style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: isLoggedIn ? 'linear-gradient(135deg, #6366f1, #7c3aed)' : 'rgba(255,255,255,0.06)',
                border: isLoggedIn ? 'none' : '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.85rem', fontWeight: 800, color: '#fff',
              }}
            >
              {isLoggedIn ? (userEmail?.[0] ?? 'U').toUpperCase() : '👤'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isLoggedIn ? userEmail : 'Guest User'}
              </div>
              <div style={{ fontSize: '0.62rem', color: isPro ? '#34d399' : 'var(--muted)', marginTop: 1 }}>
                {isLoggedIn ? (isPro ? '✦ Pro Plan' : 'Free Plan') : 'Not signed in'}
              </div>
            </div>
            {isLoggedIn ? (
              <button
                onClick={handleSignOut}
                title="Sign out"
                style={{
                  background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
                  color: 'var(--muted)', cursor: 'pointer', padding: '5px 7px', fontSize: '0.75rem',
                  flexShrink: 0, transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.4)'; (e.currentTarget as HTMLElement).style.color = '#f87171' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--muted)' }}
              >
                🚪
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                style={{
                  background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.22)', borderRadius: 8,
                  color: '#818cf8', cursor: 'pointer', padding: '5px 8px', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0,
                }}
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </aside>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} defaultTab="signup" />}
    </>
  )
}
