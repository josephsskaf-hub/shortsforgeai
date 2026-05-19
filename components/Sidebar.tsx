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
          ? 'rgba(37,99,235,0.18)'
          : hovered
          ? 'rgba(255,255,255,0.04)'
          : 'transparent',
        color: active ? '#60A5FA' : hovered ? 'var(--text)' : 'var(--muted2)',
        border: active
          ? '1px solid rgba(59,130,246,0.32)'
          : '1px solid transparent',
        textDecoration: 'none',
        fontSize: '0.88rem',
        boxShadow: active ? '0 0 24px rgba(34,211,238,0.12), inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
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
            background: 'linear-gradient(180deg, #3B82F6, #22D3EE)',
            borderRadius: '0 3px 3px 0',
            boxShadow: '0 0 8px rgba(34,211,238,0.6)',
          }}
        />
      )}
      <span
        style={{
          fontSize: '1.2rem',
          flexShrink: 0,
          filter: active ? 'drop-shadow(0 0 5px rgba(34,211,238,0.5))' : 'none',
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
            background: 'rgba(59,130,246,0.18)', color: '#60A5FA',
            padding: '2px 6px', borderRadius: 5, border: '1px solid rgba(59,130,246,0.3)',
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
  // Push #088 — Cinematic tokens are a separate pool (Pro = 1/month) shown
  // next to the regular credits as a subtle "· 🎬 N" suffix. Null while
  // loading; 0 hides the badge so non-Pro users don't see a meaningless
  // zero.
  const [cinematicTokens, setCinematicTokens] = useState<number | null>(null)
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
    if (!isLoggedIn) {
      setCredits(null)
      setCinematicTokens(null)
      setCreditsLoading(false)
      return
    }
    setCreditsLoading(true)
    try {
      const res = await fetch('/api/credits', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setCredits(typeof data.credits === 'number' ? data.credits : 0)
      } else setCredits(0)
    } catch { setCredits(0) }
    finally { setCreditsLoading(false) }
    // Push #088 — fetch cinematic tokens in parallel. We swallow errors so
    // a missing column or 401 never blocks the credit chip from rendering.
    try {
      const planRes = await fetch('/api/me/plan', { cache: 'no-store' })
      if (planRes.ok) {
        const planData = await planRes.json()
        const tokens =
          typeof planData.cinematic_tokens === 'number'
            ? planData.cinematic_tokens
            : 0
        setCinematicTokens(Math.max(0, tokens))
      } else {
        setCinematicTokens(0)
      }
    } catch {
      setCinematicTokens(0)
    }
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
    try {
      // scope:'local' clears the session immediately without a server round-trip
      // so the sign-out never hangs on a slow network.
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ])
    } catch {
      // ignore — always redirect regardless
    } finally {
      // Hard redirect so server renders fresh with no auth cookie
      window.location.href = '/'
    }
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
        className="fixed left-0 top-0 flex flex-col z-50 transition-transform duration-300"
        style={{
          width: 248,
          height: '100dvh',
          background: '#0B1020',
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
              background: '#151C2F',
              border: '1px solid rgba(59,130,246,0.4)',
              boxShadow: '0 0 18px rgba(34,211,238,0.35)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="#22D3EE" stroke="#3B82F6" strokeWidth="0.5" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex flex-col" style={{ gap: 2 }}>
            <div
              className="font-black tracking-tight leading-none"
              style={{ fontSize: '1.1rem' }}
            >
              <span style={{ color: '#F5F7FF' }}>ShortsForge</span>
              <span style={{ color: '#22D3EE' }}>AI</span>
            </div>
            <span
              aria-label="version 1.5"
              style={{
                fontSize: '0.65rem',
                color: '#94A3B8',
                fontWeight: 600,
                letterSpacing: '0.04em',
                lineHeight: 1,
              }}
            >
              v1.5
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
          {/* Push #084 — AI Thumbnails elevated to position #2 with a HOT
              badge. The thumbnail click-through rate is the single biggest
              lever for Shorts performance, so we surface this tool right
              after the generator. */}
          <NavItem href="/thumbnail-generator" icon="🖼️" label="AI Thumbnails" exact={false} pathname={pathname} onClick={onClose} badge="🔥 HOT" />
          <NavItem href="/my-videos" icon="📼" label="My Videos" exact={false} pathname={pathname} onClick={onClose} />
          {/* Push #060 — examples gallery. Static prompt showcase that
              routes to /generate?prompt=…  No auth-gated logic; safe for
              guests too. */}
          <NavItem href="/examples" icon="✨" label="Examples" exact={false} pathname={pathname} onClick={onClose} />
          {/* Push #103 — Pricing surfaced inside the dashboard nav so users
              don't have to leave the app to find the upgrade page. The
              bottom credits card also links here, but that one is gated on
              `isLoggedIn` — this stays visible for guests too. */}
          <NavItem href="/pricing" icon="💎" label="Pricing" exact={false} pathname={pathname} onClick={onClose} />

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
                  : '#151C2F',
                border: creditsZero
                  ? '1px solid rgba(239,68,68,0.32)'
                  : '1px solid rgba(255,255,255,0.08)',
                boxShadow: creditsZero
                  ? '0 0 22px rgba(239,68,68,0.12)'
                  : '0 0 18px rgba(34,211,238,0.10), inset 0 1px 0 rgba(255,255,255,0.05)',
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
                      : 'rgba(59,130,246,0.18)',
                    border: creditsZero
                      ? '1px solid rgba(239,68,68,0.3)'
                      : '1px solid rgba(59,130,246,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: creditsZero ? 'none' : '0 0 12px rgba(34,211,238,0.25)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill={creditsZero ? '#f87171' : '#22D3EE'} />
                  </svg>
                </div>
                {creditsLoading ? (
                  <span className="skeleton" style={{ display: 'inline-block', width: 72, height: 14 }} />
                ) : (
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 900, color: creditsZero ? '#f87171' : '#60A5FA', lineHeight: 1.1 }}>
                      {credits ?? 0} {credits === 1 ? 'credit' : 'credits'}
                      {/* Push #088 — Cinematic token badge. Only show when
                          the user has at least 1 token (Pro plan) so the
                          chip doesn't clutter Free/Basic accounts. */}
                      {isPro && cinematicTokens !== null && cinematicTokens > 0 && (
                        <span
                          title="Cinematic tokens (Runway AI) — 1 per month on Pro"
                          style={{
                            marginLeft: 6,
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            color: '#d8b4fe',
                          }}
                        >
                          · 🎬 {cinematicTokens}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: creditsZero ? 'rgba(248,113,113,0.7)' : '#94A3B8', marginTop: 1 }}>
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
                    : 'rgba(37,99,235,0.18)',
                  border: creditsZero
                    ? '1px solid rgba(239,68,68,0.35)'
                    : '1px solid rgba(59,130,246,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: creditsZero ? '#f87171' : '#60A5FA',
                  fontSize: '1.1rem', fontWeight: 900,
                  boxShadow: creditsZero ? 'none' : '0 0 10px rgba(34,211,238,0.2)',
                }}
              >
                +
              </div>
            </Link>
          </div>
        )}

        {!isLoggedIn ? (
          <div className="px-3 pt-3 pb-3 flex-shrink-0">
            <div style={{ borderRadius: 14, padding: '14px 14px', background: '#151C2F', border: '1px solid rgba(59,130,246,0.25)' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 800, color: '#F5F7FF', marginBottom: 4 }}>⚡ 2 free credits</p>
              <p style={{ fontSize: '0.72rem', color: '#94A3B8', lineHeight: 1.5, marginBottom: 10 }}>Sign up and start generating viral videos instantly.</p>
              <button
                onClick={() => setShowAuthModal(true)}
                style={{ display: 'block', width: '100%', textAlign: 'center', borderRadius: 10, padding: '9px 0', fontSize: '0.8rem', fontWeight: 800, color: '#fff', background: '#2563EB', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(59,130,246,0.35)' }}
              >
                ⚡ Get Started Free →
              </button>
            </div>
          </div>
        ) : creditsZero ? (
          <div className="px-3 pb-2 flex-shrink-0">
            <div style={{ borderRadius: 12, padding: '10px 12px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.22)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fca5a5', margin: 0 }}>⚠️ No credits left</p>
              </div>
              <Link href="/pricing" onClick={onClose} style={{ flexShrink: 0, borderRadius: 8, padding: '6px 12px', fontSize: '0.75rem', fontWeight: 800, color: '#fff', background: '#2563EB', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Buy →
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
                  background: '#151C2F',
                  border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: 12,
                  boxShadow: '0 10px 32px rgba(0,0,0,0.5), 0 0 24px rgba(34,211,238,0.15)',
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
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.14)' }}
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
                background: isLoggedIn ? 'linear-gradient(135deg, #2563EB, #22D3EE)' : 'rgba(255,255,255,0.06)',
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
                  background: settingsOpen ? 'rgba(59,130,246,0.2)' : 'transparent',
                  border: settingsOpen ? '1px solid rgba(59,130,246,0.4)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  color: settingsOpen ? '#60A5FA' : 'var(--muted)',
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
                  background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8,
                  color: '#60A5FA', cursor: 'pointer', padding: '5px 8px', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0,
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
