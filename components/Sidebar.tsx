'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'
import AuthModal from '@/components/AuthModal'

interface SidebarProps {
  userEmail: string
  isPro: boolean
  generationsUsed: number
  isLoggedIn: boolean
  isOpen?: boolean
  onClose?: () => void
}

const mainNavItems = [
  { href: '/', icon: '🏠', label: 'Home', badge: null, exact: true },
  { href: '/dashboard', icon: '⚡', label: 'Dashboard', badge: '5 Niches', exact: false },
  { href: '/history', icon: '📋', label: 'History', badge: null, exact: false },
  { href: '/templates', icon: '🧩', label: 'Templates', badge: 'New', exact: false },
]

const accountNavItems = [
  { href: '/pricing', icon: '✨', label: 'Pricing', badge: null, exact: false },
  { href: '/account', icon: '👤', label: 'Account', badge: null, exact: false },
]

function NavLink({ href, icon, label, badge, exact, pathname, onClick }: {
  href: string; icon: string; label: string; badge: string | null; exact: boolean; pathname: string; onClick?: () => void
}) {
  const active = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'))

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
  generationsUsed: initialUsed,
  isLoggedIn: initialLoggedIn,
  isOpen = true,
  onClose,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [generationsUsed, setGenerationsUsed] = useState(initialUsed)
  const [isPro, setIsPro] = useState(initialIsPro)
  const [userEmail, setUserEmail] = useState(initialEmail)
  const [isLoggedIn, setIsLoggedIn] = useState(initialLoggedIn)

  const initial = (userEmail?.[0] ?? 'G').toUpperCase()
  const FREE_LIMIT = 2
  const PRO_LIMIT = 200
  const freeRemaining = Math.max(0, FREE_LIMIT - generationsUsed)
  const freeUsedPct = Math.min(100, (generationsUsed / FREE_LIMIT) * 100)
  const proUsedPct = Math.min(100, (generationsUsed / PRO_LIMIT) * 100)

  // Listen for generation events from DashboardClient
  useEffect(() => {
    function handleGenerationComplete() {
      if (!isPro) {
        setGenerationsUsed((prev) => prev + 1)
      }
    }
    window.addEventListener('generationComplete', handleGenerationComplete)
    return () => window.removeEventListener('generationComplete', handleGenerationComplete)
  }, [isPro])

  // Subscribe to auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setIsLoggedIn(false)
        setUserEmail('')
        setIsPro(false)
        setGenerationsUsed(0)
      } else if (event === 'SIGNED_IN' && session?.user) {
        setIsLoggedIn(true)
        setUserEmail(session.user.email ?? '')
        // Fetch fresh profile
        const { data } = await supabase
          .from('profiles')
          .select('is_pro, generations_used')
          .eq('id', session.user.id)
          .single()
        if (data) {
          setIsPro(data.is_pro ?? false)
          setGenerationsUsed(data.generations_used ?? 0)
        }
      }
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

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
        {/* Logo — clickable, goes to / */}
        <Link
          href="/"
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

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto flex flex-col gap-px" style={{ padding: '10px 10px' }}>
          {/* Main section */}
          <div className="px-2.5 pb-1.5 pt-2 font-bold uppercase tracking-widest" style={{ color: 'var(--muted)', fontSize: '0.58rem', letterSpacing: '0.14em' }}>
            Main
          </div>

          {mainNavItems.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} onClick={onClose} />
          ))}

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

        {/* Bottom CTA */}
        {!isLoggedIn ? (
          <div className="px-3 pb-3 flex-shrink-0">
            <div className="rounded-xl p-3" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,.12), rgba(124,58,237,.08))', border: '1px solid rgba(99,102,241,.22)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--text)', fontWeight: 700 }}>⚡ 5 free scripts included</p>
              <p className="text-xs mb-2.5" style={{ color: 'var(--muted)', lineHeight: 1.45 }}>Create a free account to start generating viral shorts now.</p>
              <button
                onClick={() => setShowAuthModal(true)}
                className="block w-full text-center rounded-lg py-2 text-xs font-bold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, var(--indigo), var(--purple))', border: 'none', cursor: 'pointer' }}
              >
                ⚡ Get Started Free →
              </button>
            </div>
          </div>
        ) : !isPro ? (
          <div className="px-3 pb-3 flex-shrink-0">
            <div className="rounded-xl p-3" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,.1), rgba(124,58,237,.06))', border: '1px solid rgba(99,102,241,.18)' }}>
              {/* Usage label */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold" style={{ color: 'var(--muted2)', fontSize: '0.68rem' }}>Free generations</span>
                <span className="text-xs font-black" style={{ color: freeRemaining === 0 ? '#f87171' : 'var(--indigo-light)', fontSize: '0.68rem' }}>
                  {generationsUsed} / {FREE_LIMIT} used
                </span>
              </div>
              {/* Progress bar */}
              <div className="rounded-full overflow-hidden mb-2" style={{ height: 5, background: 'rgba(255,255,255,.07)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${freeUsedPct}%`,
                    background: freeRemaining === 0
                      ? 'linear-gradient(90deg, #ef4444, #f87171)'
                      : 'linear-gradient(90deg, #6366f1, #a855f7)',
                  }}
                />
              </div>
              {freeRemaining === 0 ? (
                <p className="text-xs mb-2" style={{ color: '#f87171', lineHeight: 1.45, fontSize: '0.68rem' }}>
                  You&apos;ve used all free generations. Upgrade to continue.
                </p>
              ) : (
                <p className="text-xs mb-2" style={{ color: 'var(--muted)', lineHeight: 1.45, fontSize: '0.68rem' }}>
                  {freeRemaining} generation{freeRemaining !== 1 ? 's' : ''} left — upgrade for 200/month
                </p>
              )}
              <Link href="/pricing" className="block w-full text-center rounded-lg py-2 text-xs font-bold text-white transition-all" style={{ background: 'linear-gradient(135deg, var(--indigo), var(--purple))', textDecoration: 'none' }} onClick={onClose}>
                ⭐ Upgrade to Pro — $5/mo →
              </Link>
            </div>
          </div>
        ) : (
          /* Pro user usage display */
          <div className="px-3 pb-3 flex-shrink-0">
            <div className="rounded-xl p-3" style={{ background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.15)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold" style={{ color: 'var(--muted2)', fontSize: '0.68rem' }}>Pro generations</span>
                <span className="text-xs font-black" style={{ color: generationsUsed >= PRO_LIMIT ? '#f87171' : '#34d399', fontSize: '0.68rem' }}>
                  {generationsUsed} / {PRO_LIMIT}
                </span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(255,255,255,.07)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${proUsedPct}%`,
                    background: generationsUsed >= PRO_LIMIT
                      ? 'linear-gradient(90deg, #ef4444, #f87171)'
                      : 'linear-gradient(90deg, #10b981, #34d399)',
                  }}
                />
              </div>
              {generationsUsed >= PRO_LIMIT && (
                <p className="text-xs mt-1.5" style={{ color: '#f87171', lineHeight: 1.45, fontSize: '0.65rem' }}>
                  Monthly limit reached. Resets next billing cycle.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Trust signal footer */}
        <div
          className="px-4 py-2.5 flex-shrink-0 text-center"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <span
            className="text-xs font-semibold"
            style={{ color: 'var(--muted)', fontSize: '0.65rem' }}
          >
            🔥 1,200+ active creators
          </span>
        </div>

        {/* User card */}
        <div className="px-3 pb-3 flex-shrink-0">
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
