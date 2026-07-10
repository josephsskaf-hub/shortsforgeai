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

// Mono premium (12/06) — refined line-icon set for the nav. 17px, 1.7 stroke,
// currentColor so active/hover states tint them automatically. Replaces the
// emoji tiles, which read playful-but-cheap next to the new theme.
const NAV_ICONS: Record<string, JSX.Element> = {
  generate: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="5" width="14" height="14" rx="3" />
      <path d="M16.5 10.5 21.5 7v10l-5-3.5" />
    </svg>
  ),
  thumbnails: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m3.5 17 5-5 4 4 3-3 5 5" />
    </svg>
  ),
  viral: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3c1 3-3 5-3 8.5a3.5 3.5 0 0 0 7 0c0-1-.4-2-1-2.8.2 2-1 2.6-1 1.3 0-2.5-1-5.5-2-7Z" />
      <path d="M8 14.5A6.5 6.5 0 1 0 18.5 14" />
    </svg>
  ),
  videos: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M3 9h18M8 4v5M16 4v5" />
    </svg>
  ),
  referral: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="8" width="17" height="4.5" rx="1.5" />
      <path d="M5 12.5V19a1.8 1.8 0 0 0 1.8 1.8h10.4A1.8 1.8 0 0 0 19 19v-6.5M12 8v12.8M12 8c-1.8 0-3.5-1-3.5-2.6S10.4 3 12 5c1.6-2 3.5-1.2 3.5.4S13.8 8 12 8Z" />
    </svg>
  ),
  pricing: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3.5h12l3.5 5.5L12 21 2.5 9 6 3.5Z" />
      <path d="M2.5 9h19M9 9l3 12M15 9l-3 12" />
    </svg>
  ),
  avatar: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10" cy="9" r="3.4" />
      <path d="M3.5 19.5c1.2-2.9 3.7-4.5 6.5-4.5s5.3 1.6 6.5 4.5" />
      <path d="M17.5 5.5c1 1 1.6 2.3 1.6 3.7M20 3.5c1.6 1.6 2.5 3.6 2.5 5.7" />
    </svg>
  ),
  animate: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4.5" width="13" height="15" rx="2.5" />
      <path d="m8 9.5 4.5 2.5L8 14.5v-5Z" />
      <path d="M19.5 7.5 21 6M19.5 12h2M19.5 16.5 21 18" />
    </svg>
  ),
  // KINEO-NAV-REDESIGN-2026-07-10 — Channel Builder (was only on the landing
  // toolkit; now reachable from the app nav too).
  channel: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </svg>
  ),
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
  icon: React.ReactNode
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

  // Push #435 — badge palette: all variants use the single Kineo accent blue.
  const isHot = !!badge && /hot/i.test(badge)
  const isNew = !!badge && /new/i.test(badge)
  const badgeColor = isHot ? '41,151,255' : isNew ? '41,151,255' : '41,151,255'

  // KINEO-NAV-REDESIGN-2026-07-10 (Joseph) — professional/clean pass matching
  // the landing's language: calmer surfaces, one clear ACTIVE state (soft blue
  // pill + slim accent bar), neutral hover, no neon glow stacking, icons that
  // only light up when they mean something.
  return (
    <Link
      href={href}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-3 relative"
      style={{
        borderRadius: 10,
        padding: '8px 10px',
        margin: '1px 0',
        background: active
          ? 'rgba(41,151,255,0.10)'
          : hovered
          ? 'rgba(255,255,255,0.045)'
          : 'transparent',
        color: active ? '#f5f5f7' : hovered ? 'var(--text)' : 'var(--muted2)',
        border: active ? '1px solid rgba(41,151,255,0.28)' : '1px solid transparent',
        textDecoration: 'none',
        fontSize: '0.86rem',
        fontWeight: active ? 700 : 600,
        transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
      }}
    >
      {active && (
        <span
          className="absolute"
          style={{
            left: -10,
            top: '22%',
            height: '56%',
            width: 2.5,
            background: '#2997ff',
            borderRadius: '0 3px 3px 0',
          }}
        />
      )}
      {/* Icon — quiet by default, tinted only on hover/active (clean pass). */}
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: active ? '#2997ff' : 'inherit',
          background: active ? 'rgba(41,151,255,0.14)' : 'transparent',
          transition: 'background 0.15s ease, color 0.15s ease',
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, letterSpacing: '0.01em' }}>{label}</span>
      {badge && (
        <span
          style={{
            fontSize: '0.55rem', fontWeight: 900, letterSpacing: '0.08em',
            background: `rgba(${badgeColor},0.12)`, color: `rgb(${badgeColor})`,
            padding: '2.5px 6px', borderRadius: 5, border: `1px solid rgba(${badgeColor},0.3)`,
            textTransform: 'uppercase', flexShrink: 0,
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}

/** KINEO-NAV-REDESIGN-2026-07-10 — landing-style section kicker (like the
 *  homepage's uppercase micro-labels) to give the nav a clear hierarchy. */
function NavSection({ label, first }: { label: string; first?: boolean }) {
  return (
    <div
      style={{
        padding: first ? '2px 12px 6px' : '16px 12px 6px',
        fontSize: '0.58rem',
        fontWeight: 900,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: 'rgba(134,134,139,0.75)',
        userSelect: 'none',
      }}
    >
      {label}
    </div>
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

  // Supabase Realtime — when this user's profiles row changes in the DB
  // (purchase, deduction, top-up) the new balance is pushed to this client
  // instantly. Unlike the `creditsChanged` DOM event above (same-window only),
  // this reaches every connected client: other tabs and a phone browser.
  useEffect(() => {
    if (!isLoggedIn) return
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return
      channel = supabase
        .channel('credits-realtime-sidebar')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          (payload) => {
            const row = payload.new as { video_credits?: number; cinematic_tokens?: number }
            if (typeof row.video_credits === 'number') setCredits(row.video_credits)
            if (typeof row.cinematic_tokens === 'number') setCinematicTokens(Math.max(0, row.cinematic_tokens))
          },
        )
        .subscribe()
    })
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [isLoggedIn]) // eslint-disable-line react-hooks/exhaustive-deps

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
          // Neon redesign (12/06) — violet-black glass column with a faint
          // top-down violet wash instead of the flat navy slab.
          background: 'linear-gradient(180deg, #161618 0%, #000000 55%, #0E0E10 100%)',
          borderRight: '1px solid rgba(41,151,255,0.12)',
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
              background: 'linear-gradient(135deg, #17171A, #161618)',
              border: '1px solid rgba(41,151,255,0.45)',
              boxShadow: '0 0 18px rgba(41,151,255,0.4), 0 0 8px rgba(41,151,255,0.25)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="#2997ff" stroke="#2997ff" strokeWidth="0.5" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex flex-col" style={{ gap: 2 }}>
            <div
              className="font-black tracking-tight leading-none"
              style={{ fontSize: '1.1rem' }}
            >
              <span style={{ color: '#F5F7FF' }}>Kineo</span>
            </div>
          </div>
        </Link>

        {/* Scrollable nav */}
        <nav className="flex-1 overflow-y-auto flex flex-col" style={{ padding: '12px 10px 12px' }}>

          {/* Main nav — push #053 swapped the old "History" item (which
              routed to Shorts Packs) for "My Videos" pointing at the new
              AI video library backed by public.videos. /history still
              exists for the legacy Shorts Packs view but is no longer the
              primary entry point. */}
          {/* Mono premium (12/06) — refined line icons (NAV_ICONS) replace the
              emoji tiles. Badge cleanup: every NEW removed per Joseph — the
              ONLY New badge in the product now lives on the AI Avatar entry. */}
          {/* KINEO-NAV-REDESIGN-2026-07-10 (Joseph) — landing-style hierarchy:
              CREATE (the engines) · GROW (audience tools) · ACCOUNT. */}
          <NavSection label="Create" first />
          <NavItem href="/generate" icon={NAV_ICONS.generate} label="Generate Video" exact={false} pathname={pathname} onClick={onClose} />
          <NavItem href="/avatar" icon={NAV_ICONS.avatar} label="AI Presenter" exact={false} pathname={pathname} onClick={onClose} badge="NEW" />
          <NavItem href="/animate" icon={NAV_ICONS.animate} label="Animate a Photo" exact={false} pathname={pathname} onClick={onClose} />
          <NavItem href="/thumbnail-generator" icon={NAV_ICONS.thumbnails} label="AI Thumbnails" exact={false} pathname={pathname} onClick={onClose} badge="HOT" />

          <NavSection label="Grow" />
          <NavItem href="/viral-now" icon={NAV_ICONS.viral} label="Viral Now" exact={false} pathname={pathname} onClick={onClose} />
          <NavItem href="/channel" icon={NAV_ICONS.channel} label="Channel Builder" exact={false} pathname={pathname} onClick={onClose} />
          <NavItem href="/history" icon={NAV_ICONS.videos} label="My Videos" exact={false} pathname={pathname} onClick={onClose} />
          {isLoggedIn && (
            <NavItem href="/referral" icon={NAV_ICONS.referral} label="Invite & Earn" exact={false} pathname={pathname} onClick={onClose} />
          )}

          <NavSection label="Account" />
          <NavItem href="/pricing" icon={NAV_ICONS.pricing} label="Pricing" exact={false} pathname={pathname} onClick={onClose} />

        </nav>

        {/* Bottom area: credits card + (guest CTA or no-credits upsell) */}
        {isLoggedIn && (
          <div className="px-3 pt-3 pb-2 flex-shrink-0">
            <Link
              href="/pricing"
              onClick={onClose}
              className="flex items-center justify-between rounded-xl px-4 py-3 transition-all"
              style={{
                // KINEO-NAV-REDESIGN-2026-07-10 — landing-card surface (quiet
                // border, no neon halo) so the column reads clean.
                background: '#131316',
                border: '1px solid rgba(255,255,255,0.08)',
                textDecoration: 'none',
                transition: 'border-color 0.18s ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(41,151,255,0.35)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    background: 'rgba(41,151,255,0.12)',
                    border: '1px solid rgba(41,151,255,0.30)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="#2997ff" />
                  </svg>
                </div>
                {creditsLoading ? (
                  <span style={{ display: 'inline-block', width: 64, height: 14, borderRadius: 4, background: 'rgba(255,255,255,0.07)', animation: 'pulse 1.4s ease-in-out infinite' }} />
                ) : (
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 900, color: '#2997ff', lineHeight: 1.1 }}>
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
                            color: '#2997ff',
                          }}
                        >
                          · 🎬 {cinematicTokens}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#86868b', marginTop: 1 }}>
                      {creditsZero ? 'Buy more with +' : 'available'}
                    </div>
                  </div>
                )}
              </div>
              <div
                style={{
                  width: 30, height: 30, borderRadius: 9,
                  background: 'rgba(41,151,255,0.12)',
                  border: '1px solid rgba(41,151,255,0.30)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#2997ff',
                  fontSize: '1.1rem', fontWeight: 900,
                  boxShadow: '0 0 10px rgba(41,151,255,0.2)',
                }}
              >
                +
              </div>
            </Link>
          </div>
        )}

        {!isLoggedIn ? (
          <div className="px-3 pt-3 pb-3 flex-shrink-0">
            <div style={{ borderRadius: 14, padding: '14px 14px', background: 'rgba(41,151,255,0.05)', border: '1px solid rgba(41,151,255,0.18)' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 800, color: '#F5F7FF', marginBottom: 4 }}>⚡ 1 free credit</p>
              <p style={{ fontSize: '0.72rem', color: '#86868b', lineHeight: 1.5, marginBottom: 10 }}>Sign up and start generating viral videos instantly.</p>
              <button
                onClick={() => setShowAuthModal(true)}
                aria-label="Get started free — sign up"
                style={{ display: 'block', width: '100%', textAlign: 'center', borderRadius: 10, padding: '9px 0', fontSize: '0.8rem', fontWeight: 800, color: '#0A0A0B', background: '#2997ff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(41,151,255,0.35)' }}
              >
                <span aria-hidden="true">⚡ </span>Get Started Free →
              </button>
            </div>
          </div>
        ) : null}
        {/* KINEO-ZERO-SIGNUP follow-up (Joseph 09/07): duplicate "No credits
            left / Buy →" box REMOVED — the credits chip above (with the +
            button) is the single purchase surface, and it stays BLUE at 0
            (red reads as an error; 0 credits is the normal free-tier state). */}

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
                  // KINEO-NAV-REDESIGN-2026-07-10 — quiet, professional menu
                  // (neutral border, soft shadow) + Sign out lives HERE now,
                  // so the user row below stays a single clean control.
                  position: 'absolute',
                  bottom: 'calc(100% - 6px)',
                  left: 12,
                  right: 12,
                  zIndex: 61,
                  background: '#161618',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 14,
                  boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
                  padding: 6,
                }}
              >
                {/* Settings v3 (12/06) — menu mirrors the real account tabs:
                    Profile · Billing · Usage. "Members" (placeholder) is gone
                    and "Manage Account" became Billing. Refined line icons. */}
                {([
                  {
                    tab: 'profile',
                    label: 'Profile',
                    icon: (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="8" r="3.6" />
                        <path d="M4.5 20c1.4-3.2 4.2-5 7.5-5s6.1 1.8 7.5 5" />
                      </svg>
                    ),
                  },
                  {
                    tab: 'billing',
                    label: 'Billing',
                    icon: (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
                        <path d="M3 10h18M7 14.5h4" />
                      </svg>
                    ),
                  },
                  {
                    tab: 'usage',
                    label: 'Usage',
                    icon: (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 19.5V12M10 19.5V5.5M16 19.5V9M21 19.5H3.5" />
                      </svg>
                    ),
                  },
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
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(41,151,255,0.14)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    <span style={{ width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
                {/* KINEO-NAV-REDESIGN-2026-07-10 — Sign out moved INTO the
                    menu (the old door-emoji button next to the profile row
                    read cheap and crowded the footer). */}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '5px 8px' }} />
                <button
                  onClick={() => { setSettingsOpen(false); handleSignOut() }}
                  role="menuitem"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '9px 10px', borderRadius: 8,
                    fontSize: '0.8rem', fontWeight: 600,
                    color: 'var(--text2)', background: 'transparent', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'background 0.12s ease, color 0.12s ease',
                  }}
                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(239,68,68,0.10)'; el.style.color = '#f87171' }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--text2)' }}
                >
                  <span style={{ width: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M9 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3H9" />
                      <path d="m15 16.5 4.5-4.5L15 7.5M19.5 12H9" />
                    </svg>
                  </span>
                  <span>Sign out</span>
                </button>
              </div>
            </>
          )}

          <div className="flex items-center gap-2.5">
            <div
              style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: isLoggedIn ? 'linear-gradient(135deg, #2997ff, #2997ff)' : 'rgba(255,255,255,0.06)',
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
                  <div className="flex items-center gap-1.5" style={{ minWidth: 0 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayName || (userEmail ? userEmail.split('@')[0] : 'Account')}
                    </span>
                    {/* KINEO-NAV-REDESIGN-2026-07-10 — plan chip beside the name. */}
                    {isPro && (
                      <span style={{ fontSize: '0.52rem', fontWeight: 900, letterSpacing: '0.08em', color: '#2997ff', background: 'rgba(41,151,255,0.12)', border: '1px solid rgba(41,151,255,0.3)', borderRadius: 5, padding: '1.5px 5px', textTransform: 'uppercase', flexShrink: 0 }}>
                        Pro
                      </span>
                    )}
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

            {/* KINEO-NAV-REDESIGN-2026-07-10 — one clean control: an SVG gear
                that opens the account menu (Profile · Billing · Usage · Sign
                out). The old emoji gear + door-emoji Sign out button are gone. */}
            {isLoggedIn ? (
              <button
                onClick={() => setSettingsOpen((v) => !v)}
                title="Account settings"
                aria-label="Account settings"
                aria-haspopup="menu"
                aria-expanded={settingsOpen}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 30, height: 30,
                  background: settingsOpen ? 'rgba(41,151,255,0.14)' : 'transparent',
                  border: settingsOpen ? '1px solid rgba(41,151,255,0.35)' : '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 8,
                  color: settingsOpen ? '#2997ff' : 'var(--muted)',
                  cursor: 'pointer',
                  flexShrink: 0, transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { if (!settingsOpen) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.22)' }}
                onMouseLeave={(e) => { if (!settingsOpen) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.10)' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3.2" />
                  <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.76l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.76-.32 1.6 1.6 0 0 0-.97 1.46V21a2 2 0 1 1-4 0v-.09a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.76.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.46-.97H3a2 2 0 1 1 0-4h.09A1.6 1.6 0 0 0 4.55 9a1.6 1.6 0 0 0-.32-1.76l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.76.32H9a1.6 1.6 0 0 0 .97-1.46V3a2 2 0 1 1 4 0v.09a1.6 1.6 0 0 0 .97 1.46 1.6 1.6 0 0 0 1.76-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.76V9c.2.6.76 1 1.46.97H21a2 2 0 1 1 0 4h-.09a1.6 1.6 0 0 0-1.51 1.03Z" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                aria-label="Sign in"
                style={{
                  background: 'rgba(41,151,255,0.12)', border: '1px solid rgba(41,151,255,0.3)', borderRadius: 8,
                  color: '#2997ff', cursor: 'pointer', padding: '5px 8px', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0,
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
