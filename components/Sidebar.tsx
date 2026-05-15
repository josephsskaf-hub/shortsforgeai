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

// Push #031 removed the TOPICS section from the sidebar — the nav is now
// just Generate Video + History + the account/settings footer. The
// removed code lived here and used to render a NichePill grid of preset
// prompts. Topic shortcuts are still reachable via the homepage hero
// textarea.

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
  const [displayName, setDisplayName] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(initialLoggedIn)
  const [credits, setCredits] = useState<number | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)

  function extractDisplayName(meta: Record<string, unknown> | undefined | null): string {
    if (!meta) return ''
    const candidates = ['full_name', 'name', 'display_name', 'user_name']
    for (const key of candidates) {
      const v = meta[key]
      if (typeof v === 'string' && v.trim().length > 0) return v.trim()
    }
    return ''
  }

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

  // Self-verify auth on mount so we never render a "Guest" sidebar to a user
  // who is actually signed in. The public homepage (`app/page.tsx`) is a client
  // component whose initial render happens before `supabase.auth.getUser()`
  // resolves; before push #021 it would mount this Sidebar with isLoggedIn=false,
  // making Home navigation flash a logged-out UI even though the session is fine.
  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled) return
      if (user) {
        setIsLoggedIn(true)
        setUserEmail((prev) => prev || user.email || '')
        setDisplayName(extractDisplayName(user.user_metadata as Record<string, unknown> | null))
        // Pull is_pro if the parent didn't already hydrate it correctly.
        const { data } = await supabase.from('profiles').select('is_pro').eq('id', user.id).single()
        if (!cancelled && data) setIsPro(data.is_pro ?? false)
      } else {
        setIsLoggedIn(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setIsLoggedIn(false); setUserEmail(''); setDisplayName(''); setIsPro(false); setCredits(null)
      } else if (event === 'SIGNED_IN' && session?.user) {
        setIsLoggedIn(true); setUserEmail(session.user.email ?? '')
        setDisplayName(extractDisplayName(session.user.user_metadata as Record<string, unknown> | null))
        const { data } = await supabase.from('profiles').select('is_pro').eq('id', session.user.id).single()
        if (data) setIsPro(data.is_pro ?? false)
        fetchCredits()
      }
    })
    return () => { cancelled = true; subscription.unsubscribe() }
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
        {/* Logo — push #040: send the user to the real homepage at "/".
            That route now hosts the hero + Generate Video card + pricing
            (push #033), so it's the correct destination for the logo. */}
        <Link
          href="/"
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
          <div className="flex flex-col" style={{ gap: 2 }}>
            <div
              className="font-black tracking-tight leading-none"
              style={{ fontSize: '1.1rem' }}
            >
              <span style={{ color: '#f5f5f7' }}>ShortsForge</span>
              <span
                style={{
                  background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                AI
              </span>
            </div>
            <span
              aria-label="version 1.2"
              style={{
                fontSize: '0.65rem',
                color: 'rgba(255,255,255,0.4)',
                fontWeight: 600,
                letterSpacing: '0.04em',
                lineHeight: 1,
              }}
            >
              v1.2
            </span>
          </div>
        </Link>

        {/* Scrollable nav */}
        <nav className="flex-1 overflow-y-auto flex flex-col" style={{ padding: '12px 10px 12px' }}>

          {/* Main nav — push #053 swapped the old "History" item (which
              routed to Shorts Packs) for "My Videos" pointing at the new
              AI video library backed by public.videos. /history still
              exists for the legacy Shorts Packs view but is no longer the
              primary entry point. */}
          <NavItem href="/generate" icon="🎬" label="Generate Video" exact={false} pathname={pathname} onClick={onClose} />
          <NavItem href="/my-videos" icon="📼" label="My Videos" exact={false} pathname={pathname} onClick={onClose} />
          {/* Push #060 — examples gallery. Static prompt showcase that
              routes to /generate?prompt=…  No auth-gated logic; safe for
              guests too. */}
          <NavItem href="/examples" icon="✨" label="Examples" exact={false} pathname={pathname} onClick={onClose} />
          {/* AI Thumbnail Generator — DALL-E 3 powered thumbnail creation */}
          <NavItem href="/thumbnail-generator" icon="🖼️" label="AI Thumbnails" exact={false} pathname={pathname} onClick={onClose} badge="NEW" />

        </nav>

        {/* Bottom area: credits card + (guest CTA or no-credits upsell) */}
        {isLoggedIn && (
          <div className="px-3 pt-3 pb-2 flex-shrink-0">
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

        {!isLoggedIn ? (
          <div className="px-3 pt-3 pb-3 flex-shrink-0">
            <div style={{ borderRadius: 14, padding: '14px 14px', background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(124,58,237,0.08))', border: '1px solid rgba(99,102,241,0.22)' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>⚡ 2 free credits</p>
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
          <div className="px-3 pb-2 flex-shrink-0">
            <div style={{ borderRadius: 14, padding: '14px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.22)' }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fca5a5', marginBottom: 4 }}>⚠️ No credits left</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--muted)', lineHeight: 1.45, marginBottom: 10 }}>Buy a pack to keep creating.</p>
              <Link href="/pricing" onClick={onClose} style={{ display: 'block', textAlign: 'center', borderRadius: 10, padding: '9px 0', fontSize: '0.8rem', fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg, #6366f1, #7c3aed)', textDecoration: 'none' }}>
                💳 Buy Credits →
              </Link>
            </div>
          </div>
        ) : null}

        {/* User row + settings menu + small logout */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px 12px', position: 'relative' }}>
          {settingsOpen && (
            <>
              <div
                onClick={() => setSettingsOpen(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'transparent' }}
                aria-hidden="true"
              />
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% - 6px)',
                  left: 12,
                  right: 12,
                  zIndex: 61,
                  background: 'rgba(18,18,30,0.98)',
                  border: '1px solid rgba(99,102,241,0.25)',
                  borderRadius: 12,
                  boxShadow: '0 10px 32px rgba(0,0,0,0.5), 0 0 24px rgba(99,102,241,0.18)',
                  padding: 6,
                }}
              >
                {([
                  { tab: 'members', label: 'Members', icon: '👥' },
                  { tab: 'profile', label: 'Profile', icon: '👤' },
                  { tab: 'manage', label: 'Manage Account', icon: '⚙' },
                  { tab: 'usage', label: 'Usage', icon: '📊' },
                ] as const).map((item) => (
                  <Link
                    key={item.tab}
                    href={`/account?tab=${item.tab}`}
                    onClick={() => { setSettingsOpen(false); onClose?.() }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 10px', borderRadius: 8,
                      fontSize: '0.8rem', fontWeight: 600,
                      color: 'var(--text2)', textDecoration: 'none',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.12)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <span style={{ width: 18, textAlign: 'center' }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </>
          )}

          <div className="flex items-center gap-2.5">
            <div
              style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: isLoggedIn ? 'linear-gradient(135deg, #6366f1, #7c3aed)' : 'rgba(255,255,255,0.06)',
                border: isLoggedIn ? 'none' : '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.85rem', fontWeight: 800, color: '#fff',
              }}
            >
              {isLoggedIn ? ((displayName || userEmail)?.[0] ?? 'U').toUpperCase() : '👤'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {isLoggedIn ? (
                <>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName || (userEmail ? userEmail.split('@')[0] : 'Account')}
                  </div>
                  {userEmail && (
                    <div style={{ fontSize: '0.62rem', color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {userEmail}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Guest User
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--muted)', marginTop: 1 }}>
                    Not signed in
                  </div>
                </>
              )}
            </div>

            {isLoggedIn && (
              <button
                onClick={() => setSettingsOpen((v) => !v)}
                title="Account settings"
                aria-haspopup="menu"
                aria-expanded={settingsOpen}
                style={{
                  background: settingsOpen ? 'rgba(99,102,241,0.18)' : 'transparent',
                  border: settingsOpen ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: settingsOpen ? '#a5b4fc' : 'var(--muted)',
                  cursor: 'pointer', padding: '5px 7px', fontSize: '0.85rem',
                  flexShrink: 0, transition: 'all 0.15s',
                  lineHeight: 1,
                }}
              >
                ⚙
              </button>
            )}

            {isLoggedIn ? (
              <button
                onClick={handleSignOut}
                title="Sign out"
                style={{
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                  color: 'var(--muted)', cursor: 'pointer', padding: '5px 7px', fontSize: '0.75rem',
                  flexShrink: 0, transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.4)'; (e.currentTarget as HTMLElement).style.color = '#f87171' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = 'var(--muted)' }}
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
