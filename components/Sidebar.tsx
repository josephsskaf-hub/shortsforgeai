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

const quickCreateItems = [
  { href: '/create', icon: '⚡', label: 'Create Video', exact: false },
  { href: '/create?niche=history&autostart=true', icon: '📖', label: 'History', exact: false },
  { href: '/create?niche=mystery&autostart=true', icon: '🔮', label: 'Mystery', exact: false },
]

const accountNavItems = [
  { href: '/pricing', icon: '💳', label: 'Pricing', exact: false },
  { href: '/account', icon: '👤', label: 'Account', exact: false },
]

function NavLink({
  href,
  icon,
  label,
  badge,
  exact,
  pathname,
  searchKey,
  onClick,
}: {
  href: string
  icon: string
  label: string
  badge?: string | null
  exact: boolean
  pathname: string
  searchKey?: string
  onClick?: () => void
}) {
  // Strip query for path comparison (next/navigation pathname has no search)
  const hrefPath = href.split('?')[0]
  let active = exact
    ? pathname === hrefPath
    : pathname === hrefPath || pathname.startsWith(hrefPath + '/')

  // For /create entries, match active by current ?niche= query as well
  if (active && hrefPath === '/create' && typeof window !== 'undefined') {
    const cur = new URLSearchParams(window.location.search).get('niche') ?? ''
    const want = searchKey ?? ''
    if (cur !== want) active = false
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-xs font-medium transition-all relative"
      style={{
        background: active ? 'rgba(99,102,241,.1)' : 'transparent',
        color: active ? 'var(--indigo-light)' : 'var(--muted2)',
        border: active ? '1px solid rgba(99,102,241,.15)' : '1px solid transparent',
        textDecoration: 'none',
      }}
    >
      {active && (
        <span
          className="absolute rounded-r"
          style={{ left: -10, top: '50%', transform: 'translateY(-50%)', width: 3, height: '55%', background: 'var(--indigo-light)' }}
        />
      )}
      <span className="text-sm flex-shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span
          className="text-xs font-bold px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(99,102,241,.12)', color: 'var(--indigo-light)', fontSize: '0.58rem' }}
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

  const initial = (userEmail?.[0] ?? 'G').toUpperCase()

  const fetchCredits = useCallback(async () => {
    if (!isLoggedIn) {
      setCredits(null)
      setCreditsLoading(false)
      return
    }
    setCreditsLoading(true)
    try {
      const res = await fetch('/api/credits', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setCredits(typeof data.credits === 'number' ? data.credits : 0)
      } else {
        setCredits(0)
      }
    } catch {
      setCredits(0)
    } finally {
      setCreditsLoading(false)
    }
  }, [isLoggedIn])

  // Initial credit fetch + listen for credit-change events
  useEffect(() => {
    fetchCredits()
    function refresh() {
      fetchCredits()
    }
    window.addEventListener('creditsChanged', refresh)
    return () => window.removeEventListener('creditsChanged', refresh)
  }, [fetchCredits])

  // Subscribe to auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setIsLoggedIn(false)
        setUserEmail('')
        setIsPro(false)
        setCredits(null)
      } else if (event === 'SIGNED_IN' && session?.user) {
        setIsLoggedIn(true)
        setUserEmail(session.user.email ?? '')
        const { data } = await supabase
          .from('profiles')
          .select('is_pro')
          .eq('id', session.user.id)
          .single()
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
  const creditColor = creditsZero ? '#f87171' : '#34d399'

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)' }}
          onClick={onClose}
        />
      )}

      <aside
        className="fixed left-0 top-0 h-screen flex flex-col z-50 transition-transform duration-300"
        style={{
          width: 240,
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
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--indigo), var(--purple))', boxShadow: '0 0 24px rgba(99,102,241,.45)' }}
          >
            ⚡
          </div>
          <div className="flex flex-col gap-0.5">
            <span
              className="font-black text-sm tracking-tight leading-none"
              style={{ background: 'linear-gradient(135deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              ShortsForge
            </span>
            <span
              className="font-black tracking-widest w-fit px-1 py-0.5 rounded"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,.2), rgba(124,58,237,.2))', border: '1px solid rgba(99,102,241,.3)', color: 'var(--indigo-light)', fontSize: '0.5rem', letterSpacing: '0.1em' }}
            >
              AI
            </span>
          </div>
        </Link>

        {/* Credit balance indicator */}
        {isLoggedIn && (
          <div className="px-3 pt-3 pb-2 flex-shrink-0">
            <Link
              href="/pricing"
              onClick={onClose}
              className="flex items-center justify-between rounded-[10px] px-3 py-2.5 transition-all"
              style={{
                background: creditsZero
                  ? 'rgba(239,68,68,.08)'
                  : 'rgba(16,185,129,.07)',
                border: creditsZero
                  ? '1px solid rgba(239,68,68,.25)'
                  : '1px solid rgba(16,185,129,.18)',
                textDecoration: 'none',
              }}
            >
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '0.95rem' }}>⚡</span>
                {creditsLoading ? (
                  <span
                    className="rounded"
                    style={{
                      display: 'inline-block',
                      width: 60,
                      height: 12,
                      background: 'rgba(255,255,255,.08)',
                      animation: 'pulse 1.4s ease-in-out infinite',
                    }}
                  />
                ) : (
                  <span
                    className="text-xs font-black"
                    style={{ color: creditColor, fontSize: '0.78rem' }}
                  >
                    {credits ?? 0} {credits === 1 ? 'credit' : 'credits'}
                  </span>
                )}
              </div>
              <span
                className="text-xs font-bold"
                style={{ color: creditsZero ? '#f87171' : 'var(--muted2)', fontSize: '0.62rem' }}
              >
                {creditsZero ? 'Buy' : '+'}
              </span>
            </Link>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto flex flex-col gap-px" style={{ padding: '6px 10px 10px' }}>
          {/* Quick Create section */}
          <div className="px-2.5 pb-1.5 pt-2 font-bold uppercase tracking-widest" style={{ color: 'var(--muted)', fontSize: '0.58rem', letterSpacing: '0.14em' }}>
            Quick Create
          </div>

          {quickCreateItems.map((item) => {
            const url = new URL(item.href, 'http://x')
            const niche = url.searchParams.get('niche') ?? undefined
            return (
              <NavLink
                key={item.href}
                {...item}
                pathname={pathname}
                searchKey={niche}
                onClick={onClose}
              />
            )
          })}

          <div className="mx-2.5 my-1.5" style={{ height: 1, background: 'var(--border)' }} />

          {/* Tools section — keep existing pages reachable */}
          <div className="px-2.5 pb-1.5 pt-2 font-bold uppercase tracking-widest" style={{ color: 'var(--muted)', fontSize: '0.58rem', letterSpacing: '0.14em' }}>
            Tools
          </div>
          <NavLink href="/dashboard" icon="⚡" label="Creator Hub" exact={false} pathname={pathname} onClick={onClose} />
          <NavLink href="/video" icon="🎞️" label="Video Studio" badge="Beta" exact={false} pathname={pathname} onClick={onClose} />
          <NavLink href="/channel" icon="📺" label="Channel Builder" exact={false} pathname={pathname} onClick={onClose} />
          <NavLink href="/templates" icon="🧩" label="Templates" exact={false} pathname={pathname} onClick={onClose} />
          <NavLink href="/history" icon="📋" label="History" exact={false} pathname={pathname} onClick={onClose} />

          <div className="mx-2.5 my-1.5" style={{ height: 1, background: 'var(--border)' }} />

          {/* Account section */}
          <div className="px-2.5 pb-1.5 pt-2 font-bold uppercase tracking-widest" style={{ color: 'var(--muted)', fontSize: '0.58rem', letterSpacing: '0.14em' }}>
            Account
          </div>

          {accountNavItems.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} onClick={onClose} />
          ))}

          {isLoggedIn ? (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-xs font-medium transition-all w-full text-left"
              style={{ background: 'transparent', color: 'var(--muted2)', border: '1px solid transparent', cursor: 'pointer' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,.07)'; (e.currentTarget as HTMLElement).style.color = '#f87171' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--muted2)' }}
            >
              <span className="text-sm">🚪</span>
              Sign Out
            </button>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-xs font-medium transition-all w-full text-left"
              style={{ background: 'rgba(99,102,241,.07)', color: 'var(--indigo-light)', border: '1px solid rgba(99,102,241,.15)', cursor: 'pointer' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,.14)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,.07)' }}
            >
              <span className="text-sm">🔑</span>
              Sign In / Sign Up
            </button>
          )}
        </nav>

        {/* Bottom CTA — guest sign-up, or low-credit upsell */}
        {!isLoggedIn ? (
          <div className="px-3 pb-3 flex-shrink-0">
            <div className="rounded-xl p-3" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,.12), rgba(124,58,237,.08))', border: '1px solid rgba(99,102,241,.22)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--text)', fontWeight: 700 }}>⚡ 3 free video credits</p>
              <p className="text-xs mb-2.5" style={{ color: 'var(--muted)', lineHeight: 1.45 }}>Create your free account and generate your first Short.</p>
              <button
                onClick={() => setShowAuthModal(true)}
                className="block w-full text-center rounded-lg py-2 text-xs font-bold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, var(--indigo), var(--purple))', border: 'none', cursor: 'pointer' }}
              >
                ⚡ Get Started Free →
              </button>
            </div>
          </div>
        ) : creditsZero ? (
          <div className="px-3 pb-3 flex-shrink-0">
            <div className="rounded-xl p-3" style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.22)' }}>
              <p className="text-xs mb-1" style={{ color: '#fca5a5', fontWeight: 800, fontSize: '0.7rem' }}>⚠️ No credits left</p>
              <p className="text-xs mb-2.5" style={{ color: 'var(--muted)', lineHeight: 1.45, fontSize: '0.68rem' }}>
                Buy a pack to keep creating videos.
              </p>
              <Link href="/pricing" onClick={onClose} className="block w-full text-center rounded-lg py-2 text-xs font-bold text-white transition-all" style={{ background: 'linear-gradient(135deg, var(--indigo), var(--purple))', textDecoration: 'none' }}>
                💳 Buy Credits →
              </Link>
            </div>
          </div>
        ) : null}

        {/* User card */}
        <div className="px-3 pb-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5">
            <div
              className="w-8 h-8 rounded-[9px] flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: isLoggedIn ? 'linear-gradient(135deg, var(--indigo), var(--purple))' : 'rgba(255,255,255,.06)', border: isLoggedIn ? 'none' : '1px solid var(--border)' }}
            >
              {isLoggedIn ? initial : '👤'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>
                {isLoggedIn ? userEmail : 'Guest User'}
              </div>
              <div className="flex items-center gap-1 mt-0.5" style={{ color: isLoggedIn ? (isPro ? '#34d399' : 'var(--muted)') : 'var(--muted)', fontSize: '0.62rem' }}>
                {isLoggedIn ? (isPro ? <><span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} />Pro Plan</> : 'Free Plan') : 'Not signed in'}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} defaultTab="signup" />
      )}
    </>
  )
}
