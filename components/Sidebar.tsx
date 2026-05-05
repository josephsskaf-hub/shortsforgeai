'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import AuthModal from '@/components/AuthModal'

interface SidebarProps {
  userEmail: string
  isPro: boolean
  generationsUsed: number
  isLoggedIn: boolean
  isOpen?: boolean
  onClose?: () => void
}

const navItems = [
  { href: '/dashboard', icon: '⚡', label: 'Dashboard', badge: '5 Niches' },
  { href: '/history', icon: '📋', label: 'History', badge: null },
  { href: '/pricing', icon: '✨', label: 'Pricing', badge: null },
]

export default function Sidebar({
  userEmail,
  isPro,
  generationsUsed,
  isLoggedIn,
  isOpen = true,
  onClose,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [showAuthModal, setShowAuthModal] = useState(false)

  const initial = (userEmail?.[0] ?? 'G').toUpperCase()
  const freeRemaining = Math.max(0, 5 - generationsUsed)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/dashboard')
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
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-5 flex-shrink-0"
          style={{
            height: 72,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
              boxShadow: '0 0 24px rgba(99,102,241,.45)',
            }}
          >
            ⚡
          </div>
          <div className="flex flex-col gap-0.5">
            <span
              className="font-black text-sm tracking-tight leading-none"
              style={{
                background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              ShortsForge
            </span>
            <span
              className="font-black tracking-widest w-fit px-1 py-0.5 rounded"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,.2), rgba(124,58,237,.2))',
                border: '1px solid rgba(99,102,241,.3)',
                color: 'var(--indigo-light)',
                fontSize: '0.5rem',
                letterSpacing: '0.1em',
              }}
            >
              AI
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav
          className="flex-1 overflow-y-auto flex flex-col gap-px"
          style={{ padding: '10px 10px' }}
        >
          <div
            className="px-2.5 pb-1.5 pt-2 font-bold uppercase tracking-widest"
            style={{ color: 'var(--muted)', fontSize: '0.58rem', letterSpacing: '0.14em' }}
          >
            Main
          </div>

          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
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
                    style={{
                      left: -10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3,
                      height: '55%',
                      background: 'var(--indigo-light)',
                    }}
                  />
                )}
                <span className="text-sm flex-shrink-0">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded"
                    style={{
                      background: 'rgba(99,102,241,.12)',
                      color: 'var(--indigo-light)',
                      fontSize: '0.58rem',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}

          <div
            className="mx-2.5 my-1.5"
            style={{ height: 1, background: 'var(--border)' }}
          />

          <div
            className="px-2.5 pb-1.5 pt-2 font-bold uppercase tracking-widest"
            style={{ color: 'var(--muted)', fontSize: '0.58rem', letterSpacing: '0.14em' }}
          >
            Account
          </div>

          {isLoggedIn ? (
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-xs font-medium transition-all w-full text-left"
              style={{
                background: 'transparent',
                color: 'var(--muted2)',
                border: '1px solid transparent',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--text2)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--muted2)'
              }}
            >
              <span className="text-sm">🚪</span>
              Sign Out
            </button>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-xs font-medium transition-all w-full text-left"
              style={{
                background: 'rgba(99,102,241,.07)',
                color: 'var(--indigo-light)',
                border: '1px solid rgba(99,102,241,.15)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,.14)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,.07)'
              }}
            >
              <span className="text-sm">🔑</span>
              Sign In / Sign Up
            </button>
          )}
        </nav>

        {/* Bottom CTA — changes based on auth state */}
        {!isLoggedIn ? (
          <div className="px-3 pb-3 flex-shrink-0">
            <div
              className="rounded-xl p-3"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,.12), rgba(124,58,237,.08))',
                border: '1px solid rgba(99,102,241,.22)',
              }}
            >
              <p className="text-xs mb-1" style={{ color: 'var(--text)', fontWeight: 700 }}>
                ⚡ 5 free scripts included
              </p>
              <p className="text-xs mb-2.5" style={{ color: 'var(--muted)', lineHeight: 1.45 }}>
                Create a free account to start generating viral shorts now.
              </p>
              <button
                onClick={() => setShowAuthModal(true)}
                className="block w-full text-center rounded-lg py-2 text-xs font-bold text-white transition-all"
                style={{
                  background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                ⚡ Get Started Free →
              </button>
            </div>
          </div>
        ) : !isPro ? (
          <div className="px-3 pb-3 flex-shrink-0">
            <div
              className="rounded-xl p-3"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,.1), rgba(124,58,237,.06))',
                border: '1px solid rgba(99,102,241,.18)',
              }}
            >
              <p className="text-xs mb-1" style={{ color: 'var(--muted2)', lineHeight: 1.45 }}>
                <strong style={{ color: 'var(--text)' }}>
                  {freeRemaining} free generation{freeRemaining !== 1 ? 's' : ''} left
                </strong>
              </p>
              <p className="text-xs mb-2.5" style={{ color: 'var(--muted)', lineHeight: 1.45 }}>
                Upgrade for unlimited access — just $5/mo
              </p>
              <Link
                href="/pricing"
                className="block w-full text-center rounded-lg py-2 text-xs font-bold text-white transition-all"
                style={{
                  background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
                  textDecoration: 'none',
                }}
                onClick={onClose}
              >
                ⭐ Upgrade to Pro →
              </Link>
            </div>
          </div>
        ) : null}

        {/* User card */}
        <div
          className="px-3 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div
            className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 transition-all"
            style={{ cursor: 'default' }}
          >
            <div
              className="w-8 h-8 rounded-[9px] flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{
                background: isLoggedIn
                  ? 'linear-gradient(135deg, var(--indigo), var(--purple))'
                  : 'rgba(255,255,255,.06)',
                border: isLoggedIn ? 'none' : '1px solid var(--border)',
              }}
            >
              {isLoggedIn ? initial : '👤'}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-xs font-semibold truncate"
                style={{ color: 'var(--text)' }}
              >
                {isLoggedIn ? userEmail : 'Guest User'}
              </div>
              <div
                className="flex items-center gap-1 mt-0.5"
                style={{
                  color: isLoggedIn
                    ? isPro ? '#34d399' : 'var(--muted)'
                    : 'var(--muted)',
                  fontSize: '0.62rem',
                }}
              >
                {isLoggedIn ? (
                  isPro ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} />
                      Pro Plan
                    </>
                  ) : (
                    'Free Plan'
                  )
                ) : (
                  'Not signed in'
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Auth modal triggered from sidebar */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          defaultTab="signup"
        />
      )}
    </>
  )
}
