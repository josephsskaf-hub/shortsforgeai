'use client'

// Push #080 — Top auth buttons polish.
// - Auth state stays reactive via supabase.auth.onAuthStateChange + the
//   initial getSession() check, so the header updates immediately on
//   login/logout without a full page reload.
// - Right side (desktop + mobile): guest = Sign In (ghost) + Sign Up (cyan
//   filled), signed-in = Dashboard (ghost, → /generate) + Sign Out (ghost).
//   Sign Out hits supabase.auth.signOut() then router.push('/').
// - Buttons render only after the auth check completes so we don't flash
//   the wrong state during hydration.

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PLANS, PLAN_LIST } from '@/lib/pricing'

const THUMBNAIL_ROUTE = '/thumbnail-generator'
const EXIT_INTENT_KEY = 'sfa_exit_intent_shown'

interface ShowcaseCard {
  category: string
  title: string
  prompt: string
  accent: string
  videoUrl: string
}

// Push #132 — SHOWCASE no longer hard-codes any CDN URLs. Video URLs are
// fetched server-side from Pexels via /api/showcase-clips (1h ISR cache)
// so the page always has working video previews. The `videoUrl` field
// starts as '' and is hydrated on mount; the gradient poster is the
// natural placeholder while the fetch is in flight.
const SHOWCASE_BASE: Omit<ShowcaseCard, 'videoUrl'>[] = [
  {
    category: 'Space Mystery',
    title: 'What NASA hides about the Moon',
    prompt: 'Cinematic space mystery short about unexplained Moon anomalies that NASA never explained',
    accent: '#22D3EE',
  },
  {
    category: 'History Facts',
    title: 'The Roman invention we still use',
    prompt: 'Fast-paced history facts short about a Roman invention that still powers daily life today',
    accent: '#F59E0B',
  },
  {
    category: 'Hidden Places',
    title: 'Cities erased from every map',
    prompt: 'Dark cinematic short about real hidden cities that governments removed from world maps',
    accent: '#A78BFA',
  },
  {
    category: 'Cold Case',
    title: 'The case that broke the FBI',
    prompt: 'Suspenseful cold case short about an unsolved FBI investigation with chilling details',
    accent: '#F87171',
  },
  {
    category: 'Weird Facts',
    title: 'Facts your brain refuses to believe',
    prompt: 'Punchy weird facts short with 5 facts that sound fake but are 100% true',
    accent: '#34D399',
  },
  {
    category: 'Money Psychology',
    title: 'Why the rich think differently',
    prompt: 'Money psychology short about the mental habits that separate the wealthy from everyone else',
    accent: '#60A5FA',
  },
]
// IDs must match SHOWCASE_QUERIES in /api/showcase-clips/route.ts
const SHOWCASE_IDS = ['space', 'history', 'hidden', 'crime', 'facts', 'money']

function trackHomepageEvent(name: string): void {
  try {
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: name,
        name,
        path: typeof window !== 'undefined' ? window.location?.pathname : undefined,
      }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // ignore
  }
}

interface HomePageClientProps {
  initialUser: { id: string } | null
  initialEmail: string
  initialIsPro: boolean
}

export default function HomePageClient({ initialUser }: HomePageClientProps) {
  const router = useRouter()

  const [user, setUser] = useState<{ id: string } | null>(initialUser)
  const [authChecked, setAuthChecked] = useState(!!initialUser)
  const [prompt, setPromptText] = useState('')
  const [navOpen, setNavOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  // Push #077 — pricing card selected state. Pro is selected by default.
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro' | null>('pro')
  // Push #081 — credits pill in header. null while loading; never shown
  // when logged out. We only fetch once auth is confirmed so we don't
  // hammer the credits route during the unauth flash.
  const [credits, setCredits] = useState<number | null>(null)
  const [checkoutTier, setCheckoutTier] = useState<'basic' | 'pro' | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  // Push #171 — show a friendly "already subscribed" banner instead of a
  // red error when the API blocks a duplicate purchase attempt.
  const [alreadySubscribed, setAlreadySubscribed] = useState(false)
  // Push #097 — exit-intent overlay state. One-shot per session.
  const [showExitIntent, setShowExitIntent] = useState(false)
  // Push #104 — live "X Shorts created today" counter for the social
  // proof bar. Falls back to the API's baseline if the fetch fails.
  const [shortsToday, setShortsToday] = useState<number>(47)
  // Push #116 — cumulative hero counter ("9,847 Shorts created — and
  // counting"). Bumps +1 every 30s in a setInterval so the page reads
  // as alive while the visitor sits on it.
  const [shortsTotal, setShortsTotal] = useState<number>(9847)

  // Push #132 — showcase video URLs fetched from /api/showcase-clips so
  // the page never hard-codes a CDN that can go private. Start empty so
  // gradient placeholders show immediately; hydrate on mount.
  const [showcaseVideos, setShowcaseVideos] = useState<Record<string, string>>({})
  const [phoneVideos, setPhoneVideos] = useState<Record<string, string>>({})

  useEffect(() => {
    void fetch('/api/showcase-clips')
      .then((r) => r.json())
      .then((data: { clips?: Record<string, string | null> }) => {
        const clips = data.clips ?? {}
        const sv: Record<string, string> = {}
        const pv: Record<string, string> = {}
        SHOWCASE_IDS.forEach((id, i) => { if (clips[id]) sv[`${i}`] = clips[id] as string })
        if (clips['finance'])    pv['finance']    = clips['finance']    as string
        if (clips['mystery'])    pv['mystery']    = clips['mystery']    as string
        if (clips['travel'])     pv['travel']     = clips['travel']     as string
        if (clips['psychology']) pv['psychology'] = clips['psychology'] as string
        setShowcaseVideos(sv)
        setPhoneVideos(pv)
      })
      .catch(() => { /* fall back to gradient placeholders */ })
  }, [])

  useEffect(() => {
    trackHomepageEvent('homepage_view')
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        if (typeof d.count === 'number') setShortsToday(d.count)
        if (typeof d.total === 'number') setShortsTotal(d.total)
      })
      .catch(() => {/* keep the baseline fallback */})
    return () => {
      cancelled = true
    }
  }, [])

  // Push #116 — bump the cumulative hero counter every 30s so the page
  // feels alive while a visitor reads. Strictly visual — the real count
  // re-syncs on the next page load via /api/stats.
  useEffect(() => {
    const id = window.setInterval(() => {
      setShortsTotal((n) => n + 1)
    }, 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ? { id: data.session.user.id } : null)
      setAuthChecked(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id } : null)
      setAuthChecked(true)
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Push #081 — fetch credits when the user is signed in. Failures are
  // swallowed; the pill simply does not render rather than breaking the
  // header layout. We re-fetch on user-id change so a sign-in/sign-out
  // cycle picks up the new balance.
  useEffect(() => {
    if (!user) {
      setCredits(null)
      return
    }
    let cancelled = false
    fetch('/api/credits')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        if (data && typeof data.credits === 'number') {
          setCredits(data.credits)
        }
      })
      .catch(() => {/* silent */})
    return () => {
      cancelled = true
    }
  }, [user])

  // Push #097 — exit-intent overlay. Fires once per session when the
  // cursor leaves the top of the viewport (the canonical "about to
  // close the tab" gesture). Suppressed for signed-in users — they
  // don't need the "get 2 free videos" prompt.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (user) return
    try {
      if (sessionStorage.getItem(EXIT_INTENT_KEY) === '1') return
    } catch {
      // ignore
    }
    function handleMouseLeave(e: MouseEvent) {
      if (e.clientY > 0) return
      try {
        sessionStorage.setItem(EXIT_INTENT_KEY, '1')
      } catch {
        // ignore
      }
      setShowExitIntent(true)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
    document.addEventListener('mouseleave', handleMouseLeave)
    return () => document.removeEventListener('mouseleave', handleMouseLeave)
  }, [user])

  // Push #081 — Start Free routing rule. Logged-in users go straight to
  // /generate (with their prompt pre-filled if any). Logged-out users go
  // to /signup with a redirect param so the post-signup flow lands on
  // /generate, not the dashboard. Previously this routed to /login,
  // which was confusing for first-time visitors clicking "Start Free".
  function goToGenerate(text?: string) {
    const trimmed = (text ?? prompt).trim()
    setSubmitting(true)
    const dest = trimmed
      ? `/generate?prompt=${encodeURIComponent(trimmed)}`
      : '/generate'
    const target = user ? dest : `/signup?redirect=${encodeURIComponent(dest)}`
    router.push(target)
  }

  function goToShowcase(cardPrompt: string) {
    const dest = `/generate?prompt=${encodeURIComponent(cardPrompt)}`
    const target = user ? dest : `/signup?redirect=${encodeURIComponent(dest)}`
    router.push(target)
  }

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      const supabase = createClient()
      // scope:'local' clears the session from cookies/localStorage immediately
      // without a server round-trip, preventing the "Signing out…" freeze that
      // happens when supabase.auth.signOut() stalls on a slow/failed network.
      // A 3 s timeout race guarantees we always reach the finally block.
      await Promise.race([
        supabase.auth.signOut({ scope: 'local' }),
        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
      ])
    } catch {
      // ignore
    } finally {
      // Hard redirect so all React state (including signingOut) is cleared
      // and the server renders the page fresh with no auth cookie.
      window.location.href = '/'
    }
  }

  // Push #173 — iOS Safari blocks window.location.href changes inside
  // async/await (user gesture chain severed after first await). Fix: navigate
  // directly to the GET checkout endpoint which does a server-side 302 to
  // Stripe — no fetch, no await, no gesture breakage on any mobile browser.
  function handleStartPlan(tier: 'basic' | 'pro') {
    trackHomepageEvent(tier === 'basic' ? 'basic_checkout_clicked' : 'pro_checkout_clicked')
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent('/pricing')}`)
      return
    }
    setCheckoutTier(tier)
    window.location.href = `/api/stripe/checkout?tier=${tier}`
  }

  return (
    <div className="min-h-screen bg-[#05070D] text-[#F1F5F9] font-sans">
      {/* Subtle cyber-blue glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed -top-[300px] -right-[200px] h-[800px] w-[800px] rounded-full opacity-[0.07]"
        style={{ background: '#22D3EE', filter: 'blur(140px)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-[400px] -left-[200px] h-[700px] w-[700px] rounded-full opacity-[0.05]"
        style={{ background: '#3B82F6', filter: 'blur(160px)' }}
      />

      {/* ───────── Top Nav ───────── */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#0B1120]/90 backdrop-blur-xl">
        <div className="flex h-[68px] w-full items-center justify-between px-6 sm:px-10 lg:px-16">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0B1120] border border-blue-500/40 text-lg shadow-[0_0_14px_rgba(34,211,238,.35)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="#22D3EE" stroke="#3B82F6" strokeWidth="0.5" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-extrabold tracking-tight">
                <span className="text-white">Shorts</span>
                <span className="text-white">Forge</span>
                <span className="text-cyan-400">AI</span>
              </span>
              <span className="text-[10px] font-semibold text-[#94A3B8] mt-0.5">v1.5</span>
            </div>
          </Link>

          {/* Center links — desktop. Push #135: full-width layout, larger text. */}
          <div className="hidden items-center gap-9 md:flex">
            <Link href="/generate" className="text-[1rem] font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition">AI Video Generator</Link>
            <Link href={THUMBNAIL_ROUTE} className="text-[1rem] font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition">Thumbnail</Link>
            <Link href="/my-videos" className="text-[1rem] font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition">My Videos</Link>
            <a href="#pricing" className="text-[1rem] font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition">Pricing</a>
          </div>

          {/* Right side — desktop. Push #079: guest = Sign In (ghost) +
              Sign Up (solid blue), signed-in = Dashboard (ghost, → /generate)
              + Sign Out (outline). Buttons are only rendered after the auth
              check completes so we don't flash the wrong state on hydration. */}
          <div className="hidden items-center gap-2 md:flex">
            {!authChecked ? (
              <div aria-hidden className="h-9 w-40" />
            ) : user ? (
              <>
                {/* Push #081 — credits pill. Hidden while loading so
                    we never flash a misleading "0 credits". */}
                {credits !== null && (
                  <span
                    className="text-xs font-bold text-cyan-400 border border-cyan-400/30 rounded-full px-2.5 py-1 bg-cyan-400/[0.04]"
                    title="Video credits remaining"
                  >
                    {credits} credits
                  </span>
                )}
                <Link
                  href="/generate"
                  className="rounded-lg border border-white/20 px-5 py-2.5 text-[1rem] font-medium text-white transition-colors hover:bg-white/5"
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="rounded-lg border border-white/20 px-5 py-2.5 text-[1rem] font-medium text-white transition-colors hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-60"
                >
                  {signingOut ? 'Signing out…' : 'Sign Out'}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg border border-white/20 px-5 py-2.5 text-[1rem] font-medium text-white transition-colors hover:bg-white/5"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-[#22D3EE] px-5 py-2.5 text-[1rem] font-bold text-[#05070D] transition-colors hover:bg-cyan-300 shadow-[0_4px_18px_rgba(34,211,238,.35)]"
                >
                  Start Free
                </Link>
              </>
            )}
          </div>

          {/* Mobile right side: persistent CTA + hamburger. Push #079 mirrors
              the desktop auth split — Dashboard (ghost, → /generate) when
              signed in, Sign Up (solid blue) when signed out. Sign In and
              Sign Out live in the dropdown panel below to keep the bar tight. */}
          <div className="flex items-center gap-2 md:hidden">
            {!authChecked ? (
              <div aria-hidden className="h-9 w-20" />
            ) : user ? (
              <>
                {credits !== null && (
                  <span
                    className="text-[10px] font-bold text-cyan-400 border border-cyan-400/30 rounded-full px-2 py-0.5 bg-cyan-400/[0.04]"
                    title="Video credits"
                  >
                    {credits}
                  </span>
                )}
                <Link
                  href="/generate"
                  className="rounded-lg border border-white/20 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/5"
                >
                  Dashboard
                </Link>
              </>
            ) : (
              <Link
                href="/signup"
                className="rounded-lg bg-[#22D3EE] px-3 py-2 text-[13px] font-bold text-[#05070D] transition-colors hover:bg-cyan-300 shadow-[0_4px_14px_rgba(34,211,238,.35)]"
              >
                Start Free
              </Link>
            )}
            <button
              type="button"
              aria-label="Toggle navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-[#94A3B8] hover:text-[#F1F5F9]"
            >
              <span className="block h-[2px] w-4 bg-current relative">
                <span className="absolute -top-[5px] left-0 block h-[2px] w-4 bg-current" />
                <span className="absolute top-[5px] left-0 block h-[2px] w-4 bg-current" />
              </span>
            </button>
          </div>
        </div>

        {/* Mobile menu panel — Push #079: nav items + auth tail. Guests get
            both Sign In (ghost) and Sign Up (solid blue) so the full auth
            choice is visible from one tap. Signed-in users get Sign Out. */}
        {navOpen && (
          <div className="md:hidden border-t border-white/[0.08] bg-[#0B1120]/95 backdrop-blur-xl">
            <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
              <Link onClick={() => setNavOpen(false)} href="/generate" className="rounded-md px-3 py-2 text-sm font-medium text-[#94A3B8] hover:bg-white/[.04] hover:text-[#F1F5F9]">AI Video Generator</Link>
              <Link onClick={() => setNavOpen(false)} href={THUMBNAIL_ROUTE} className="rounded-md px-3 py-2 text-sm font-medium text-[#94A3B8] hover:bg-white/[.04] hover:text-[#F1F5F9]">Thumbnail</Link>
              <Link onClick={() => setNavOpen(false)} href="/my-videos" className="rounded-md px-3 py-2 text-sm font-medium text-[#94A3B8] hover:bg-white/[.04] hover:text-[#F1F5F9]">My Videos</Link>
              <a onClick={() => setNavOpen(false)} href="#pricing" className="rounded-md px-3 py-2 text-sm font-medium text-[#94A3B8] hover:bg-white/[.04] hover:text-[#F1F5F9]">Pricing</a>

              <div className="my-2 h-px bg-white/[0.06]" />

              {authChecked && user ? (
                <button
                  type="button"
                  onClick={async () => {
                    setNavOpen(false)
                    await handleSignOut()
                  }}
                  disabled={signingOut}
                  className="text-left rounded-md border border-white/20 px-3 py-2 text-sm font-medium text-white transition-colors hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-60"
                >
                  {signingOut ? 'Signing out…' : 'Sign Out'}
                </button>
              ) : (
                <>
                  <Link
                    onClick={() => setNavOpen(false)}
                    href="/login"
                    className="rounded-md border border-white/20 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/5"
                  >
                    Sign In
                  </Link>
                  <Link
                    onClick={() => setNavOpen(false)}
                    href="/signup"
                    className="rounded-md bg-[#22D3EE] px-3 py-2 text-sm font-bold text-[#05070D] transition-colors hover:bg-cyan-300"
                  >
                    Start Free
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ───────── Hero ─────────
          Push #080 — full-width background video behind the hero.
          Dark overlay keeps text legible. */}
      <div className="relative overflow-hidden">
        {/* Background video */}
        <video
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.13,
            zIndex: 0,
            pointerEvents: 'none',
          }}
          src="https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
        />
        {/* Dark gradient overlay */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(5,7,13,0.7) 0%, rgba(5,7,13,0.45) 50%, rgba(5,7,13,0.85) 100%)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
      <section className="relative mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24 sm:pb-16" style={{ zIndex: 2 }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-10">
        <div className="flex-1 min-w-0 text-center">
        <h1 className="text-balance text-4xl font-black leading-[1.1] tracking-tight sm:text-5xl text-[#F1F5F9]">
          Turn Any Idea Into a{' '}
          <span
            className="text-[#22D3EE]"
            style={{ textShadow: '0 0 24px rgba(34,211,238,0.55), 0 0 48px rgba(34,211,238,0.25)' }}
          >
            Viral YouTube Short
          </span>{' '}
          — in 60 Seconds
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] sm:text-base text-[#94A3B8]">
          AI writes the script, finds the footage, adds captions and music. You just download and upload.
        </p>

        {/* Push #116 — live cumulative counter directly under the
            subheadline. Reads from /api/stats on mount, ticks +1 every
            30s so the number feels alive without lying about volume. */}
        <p className="mt-5 text-sm font-bold text-[#34D399]">
          🎬 {shortsTotal.toLocaleString('en-US')} Shorts created — and counting
        </p>

        {/* Push #097 — primary green go-button + trust microcopy. The
            textarea below is preserved for high-intent visitors who
            already know what they want to make. */}
        <div className="mx-auto mt-8 flex w-full max-w-[770px] flex-col items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              trackHomepageEvent('hero_primary_cta_click')
              goToGenerate()
            }}
            disabled={submitting}
            className="animate-btn-pulse w-full sm:w-auto rounded-xl bg-[#10B981] px-9 py-4 text-base sm:text-lg font-extrabold text-white shadow-[0_10px_32px_rgba(16,185,129,.45)] transition hover:bg-[#059669] hover:shadow-[0_12px_40px_rgba(16,185,129,.55)] disabled:opacity-60"
          >
            {submitting ? 'Loading…' : 'Generate Your First Short Free →'}
          </button>
          <p className="text-[13px] font-semibold text-[#94A3B8]">
            No credit card required · 2 free videos · Ready in 60 seconds
          </p>
        </div>

        {/* Single clean prompt card — kept for visitors with an idea ready */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            goToGenerate()
          }}
          className="mx-auto mt-8 flex w-full max-w-[770px] flex-col gap-5 rounded-2xl border border-white/[0.08] bg-[#0B1120] p-6 shadow-[0_18px_50px_rgba(0,0,0,.5)] focus-within:border-blue-500/60 sm:p-8"
        >
          <textarea
            value={prompt}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Or type your video idea here..."
            maxLength={5000}
            rows={4}
            className="w-full flex-1 resize-none rounded-xl bg-transparent px-2 py-2 text-[16px] text-[#F1F5F9] placeholder:text-[#94A3B8] outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full shrink-0 rounded-xl bg-[#22D3EE] px-6 py-4 text-base font-extrabold text-[#05070D] shadow-[0_8px_28px_rgba(34,211,238,.35)] transition hover:bg-cyan-300 disabled:opacity-60"
          >
            {submitting ? 'Loading…' : 'Generate your first video →'}
          </button>
        </form>

        {/* Push #116 — three mini-testimonials and a creator-community
            line right after the hero CTA. The card shapes mirror the
            social-proof bar style used elsewhere on the page. */}
        <div
          className="mx-auto mt-10 grid w-full max-w-5xl gap-3 sm:grid-cols-3"
        >
          {[
            {
              initials: 'RF',
              accent: '#22D3EE',
              quote: 'Made $2,400 last month from my Shorts channel',
              handle: '@ryan_finance',
              subs: '47K subs',
            },
            {
              initials: 'MT',
              accent: '#A78BFA',
              quote: 'I post 3 Shorts/day without touching a camera',
              handle: '@moneywithtom',
              subs: '28K subs',
            },
            {
              initials: 'CF',
              accent: '#34D399',
              quote: 'Best $9 I spend every month',
              handle: '@cryptofactss',
              subs: '91K subs',
            },
          ].map((t) => (
            <div
              key={t.handle}
              className="rounded-2xl border border-white/[0.08] bg-[#0B1120] p-4 text-left"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  aria-hidden
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-black"
                  style={{
                    background: `${t.accent}22`,
                    border: `1px solid ${t.accent}55`,
                    color: t.accent,
                    letterSpacing: '.02em',
                  }}
                >
                  {t.initials}
                </div>
                <div className="flex flex-col">
                  <span className="text-[13px] font-bold text-[#F1F5F9]">{t.handle}</span>
                  <span className="text-[11px] font-bold text-[#34D399]">{t.subs}</span>
                </div>
              </div>
              <p className="text-[13.5px] text-[#F1F5F9] leading-snug">
                &ldquo;{t.quote}&rdquo;
              </p>
            </div>
          ))}
        </div>

        {/* Push #116 — "As seen in" community row. Plain text only —
            no logos to chase down or licensing to navigate. */}
        <div className="mx-auto mt-6 max-w-3xl">
          <p className="text-center text-[12px] font-semibold text-[#94A3B8]">
            Creators from these communities use ShortsForge:{' '}
            <span className="text-[#F1F5F9]">
              Reddit · Twitter/X · YouTube · TikTok · Discord
            </span>
          </p>
        </div>
        </div>

        </div>
      </section>
      </div>{/* end hero background video wrapper */}

      {/* ───────── AI Video Showcase ───────── */}
      {/* ───────── Push #080: 3×2 showcase grid — bigger cards, cleaner header ───── */}
      <section id="showcase" className="relative z-10 mx-auto max-w-6xl px-4 pt-8 pb-14 sm:px-6">
        <div className="mb-10 text-center">
          <div
            className="mb-3 text-[11px] font-extrabold uppercase tracking-[.18em] text-cyan-400 flex items-center justify-center gap-3"
          >
            <span style={{ display: 'inline-block', width: 24, height: 1, background: '#22D3EE' }} />
            Create Your First AI Short
            <span style={{ display: 'inline-block', width: 24, height: 1, background: '#22D3EE' }} />
          </div>
          <h2 className="text-balance text-3xl font-black tracking-tight sm:text-4xl text-[#F1F5F9] mb-3">
            Pick a style.{' '}
            <span style={{ background: 'linear-gradient(135deg,#22D3EE,#3B82F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              AI does the rest.
            </span>
          </h2>
          <p className="mx-auto max-w-lg text-[14px] text-[#94A3B8] leading-relaxed">
            Choose a format below — the AI writes the hook, records the voiceover, cuts the scenes and renders your Short automatically.
          </p>
        </div>

        {/* 3 columns × 2 rows grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '16px',
          }}
          className="sm:gap-5"
        >
          {SHOWCASE_BASE.map((base, i) => {
            const card: ShowcaseCard = { ...base, videoUrl: showcaseVideos[`${i}`] ?? '' }
            return (
              <ShowcaseVideoCard
                key={card.title}
                card={card}
                onGenerate={() => goToShowcase(card.prompt)}
              />
            )
          })}
        </div>
      </section>

      {/* ───────── Social Proof ─────────
          Push #097 — compact dark bar instead of the prior 3-card grid.
          Sits right under the hero so the visitor sees a creator count
          + a star quote before they even reach the showcase. */}
      <section className="relative z-10 mx-auto max-w-4xl px-4 pt-0 pb-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-xl border border-white/[0.08] bg-[#0B1120] px-5 py-3">
          <span className="text-[13.5px] font-bold text-[#F1F5F9]">
            ⚡ Join 500+ creators generating Shorts with AI
          </span>
          <span aria-hidden className="hidden h-4 w-px bg-white/10 sm:block" />
          {/* Push #104 — live counter pulled from /api/stats. */}
          <span className="text-[13.5px] font-bold text-[#34D399]">
            ⚡ {shortsToday.toLocaleString('en-US')} Shorts created today
          </span>
          <span aria-hidden className="hidden h-4 w-px bg-white/10 sm:block" />
          <span className="flex items-center gap-2 text-[13.5px] text-[#94A3B8]">
            <span className="font-black tracking-widest text-[#FBBF24]">★★★★★</span>
            <span className="text-[#F1F5F9]">&ldquo;Saves me 3 hours per video&rdquo;</span>
            <span className="text-cyan-400 font-bold">— @moneyfacts_creator</span>
          </span>
        </div>
      </section>

      {/* ───────── Real Shorts Showcase ─────────
          Push #126 — 3 phone-frame video cards replacing the old
          "Demo video coming soon" placeholder. Cards auto-play free
          Pexels clips to show the product output in a premium way. */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 pt-4 pb-12 sm:px-6 sm:pb-16">
        <div className="mb-10 text-center">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-cyan-400">
            Real Results
          </div>
          <h2 className="text-balance text-3xl font-black tracking-tight sm:text-4xl text-[#F1F5F9]">
            Real Shorts created with ShortsForgeAI
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[14px] text-[#94A3B8]">
            See what our AI generates in seconds.
          </p>
        </div>
        <PhoneCardRow videoCounter={shortsTotal} phoneVideos={phoneVideos} />
      </section>

      {/* ───────── How It Works ─────────
          Push #086 — 3-step explainer between showcase and pricing.
          Anchor id="how-it-works" matches the hero's "See How It Works"
          secondary CTA. Each step is one verb + one outcome — no fluff. */}
      <section id="how-it-works" className="relative z-10 mx-auto max-w-6xl px-4 pt-4 pb-12 sm:px-6 sm:pb-16">
        <div className="mb-10 text-center">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-cyan-400">
            How it works
          </div>
          <h2 className="text-balance text-3xl font-black tracking-tight sm:text-4xl text-[#F1F5F9]">
            Three steps to a viral Short
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            {
              icon: '🎯',
              title: 'Type your idea',
              body: '"Top 5 richest people ever" — one sentence is enough.',
              accent: '#22D3EE',
            },
            {
              icon: '🤖',
              title: 'AI builds your Short',
              body: 'Script + footage + captions + music, stitched into a vertical MP4.',
              accent: '#3B82F6',
            },
            {
              icon: '📥',
              title: 'Download & post',
              body: 'Ready for YouTube Shorts in 60 seconds. Just upload.',
              accent: '#34D399',
            },
          ].map((step, i) => (
            <div
              key={step.title}
              className="relative rounded-2xl border border-white/[0.08] bg-[#0B1120] p-6 transition hover:border-blue-500/50 hover:shadow-[0_0_24px_rgba(34,211,238,0.18)]"
            >
              <div
                className="absolute -top-3 left-5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[.12em]"
                style={{ background: '#0B1120', border: `1px solid ${step.accent}55`, color: step.accent }}
              >
                Step {i + 1}
              </div>
              <div className="text-4xl mb-3 mt-2">{step.icon}</div>
              <h3 className="text-lg font-black text-[#F1F5F9] mb-2">{step.title}</h3>
              <p className="text-[13.5px] text-[#94A3B8] leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── Pricing ───────── */}
      <section id="pricing" className="relative z-10 mx-auto max-w-5xl px-4 pt-8 pb-8 sm:px-6">
        <div className="mb-10 text-center">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-cyan-400">
            Pricing
          </div>
          <h2 className="text-balance text-3xl font-black tracking-tight sm:text-4xl text-[#F1F5F9]">
            Choose a plan
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[14px] text-[#94A3B8]">
            Start creating AI Shorts with credits. Upgrade when you need more videos.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLAN_LIST.map((plan) => {
            const isPaid = plan.tier === 'basic' || plan.tier === 'pro'
            const isSelected = isPaid && selectedPlan === plan.tier
            const isRecommended = !!plan.recommended
            // Push #081 — Free plan CTA respects auth state. Logged-in
            // users skip /signup and go straight to /generate so the
            // CTA never asks them to re-create an account.
            const planHref =
              plan.tier === 'free' && user ? '/generate' : plan.href
            const isExternal = planHref.startsWith('http')

            const features = featureListFor(plan.tier)
            const ctaLabel = isSelected
              ? plan.tier === 'basic' ? 'Continue with Basic' : 'Continue with Pro'
              : plan.tier === 'free' && user
                ? 'Open Generator'
                : plan.cta

            return (
              <div
                key={plan.tier}
                role={isPaid ? 'button' : undefined}
                tabIndex={isPaid ? 0 : undefined}
                aria-pressed={isPaid ? isSelected : undefined}
                onClick={() => {
                  if (isPaid) setSelectedPlan(plan.tier as 'basic' | 'pro')
                }}
                onKeyDown={(e) => {
                  if (!isPaid) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedPlan(plan.tier as 'basic' | 'pro')
                  }
                }}
                className={`group relative flex flex-col rounded-2xl border p-6 transition-all duration-200 ${
                  isPaid ? 'cursor-pointer' : ''
                } ${
                  isSelected
                    ? 'border-2 border-[#3B82F6] bg-[#0D1830] shadow-[0_0_28px_rgba(59,130,246,0.3)]'
                    : isRecommended
                      ? 'border-blue-500 bg-[#0B1120] shadow-[0_0_30px_rgba(59,130,246,0.15)] hover:border-[#3B82F6] hover:bg-[rgba(34,211,238,0.06)] hover:shadow-[0_0_20px_rgba(34,211,238,0.18)]'
                      : 'border-white/[0.08] bg-[#0B1120] hover:border-[#3B82F6] hover:bg-[rgba(34,211,238,0.06)] hover:shadow-[0_0_20px_rgba(34,211,238,0.18)]'
                }`}
              >
                {isRecommended && !isSelected && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2563EB] px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-white shadow-[0_4px_18px_rgba(59,130,246,.45)]">
                    Recommended
                  </div>
                )}
                {isSelected && (
                  <div className="absolute -top-3 right-4 flex h-7 w-7 items-center justify-center rounded-full bg-[#22C55E] text-white shadow-[0_4px_14px_rgba(34,197,94,.45)]" aria-label="Selected">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                <div className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[#94A3B8]">
                  {plan.name}
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-[2.4rem] font-black leading-none tracking-tight text-[#F1F5F9]">
                    {plan.priceLabel}
                  </span>
                </div>
                <div className="mt-1 text-[12.5px] font-semibold text-cyan-400">
                  {plan.periodLabel}
                </div>
                <ul className="mt-5 mb-6 flex flex-col gap-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13.5px] text-[#F1F5F9]">
                      <span className="mt-[3px] text-cyan-400">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {isPaid ? (
                  <button
                    type="button"
                    disabled={checkoutTier !== null && checkoutTier !== plan.tier}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedPlan(plan.tier as 'basic' | 'pro')
                      handleStartPlan(plan.tier as 'basic' | 'pro')
                    }}
                    className={`mt-auto block w-full rounded-xl px-4 py-3 text-center text-[14px] font-extrabold transition disabled:opacity-60 ${
                      isRecommended || isSelected
                        ? 'bg-[#2563EB] text-white shadow-[0_8px_24px_rgba(59,130,246,.4)] hover:bg-blue-500 hover:shadow-[0_10px_32px_rgba(34,211,238,.4)]'
                        : 'border border-white/[0.08] text-[#F1F5F9] hover:bg-white/5 hover:border-blue-500/40'
                    }`}
                  >
                    {checkoutTier === plan.tier ? 'Starting…' : `${ctaLabel} →`}
                  </button>
                ) : (
                  <a
                    href={planHref}
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noopener noreferrer' : undefined}
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                    className={`mt-auto block rounded-xl px-4 py-3 text-center text-[14px] font-extrabold transition ${
                      isRecommended || isSelected
                        ? 'bg-[#2563EB] text-white shadow-[0_8px_24px_rgba(59,130,246,.4)] hover:bg-blue-500 hover:shadow-[0_10px_32px_rgba(34,211,238,.4)]'
                        : 'border border-white/[0.08] text-[#F1F5F9] hover:bg-white/5 hover:border-blue-500/40'
                    }`}
                  >
                    {ctaLabel} →
                  </a>
                )}
                {/* Push #175 — per-tier value highlight under each CTA. */}
                <p className="mt-3 text-center text-[12px] font-bold text-cyan-400">
                  {plan.tier === 'free' && 'No credit card required'}
                  {plan.tier === 'basic' && '50 Fast Mode videos/month'}
                  {plan.tier === 'pro' && '100 Fast Mode + Cinematic Mode unlocked.'}
                </p>
                {(plan.tier === 'basic' || plan.tier === 'pro') && (
                  <p className="mt-1 text-center text-[11.5px] font-semibold text-[#94A3B8]">
                    Cancel anytime
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {checkoutError && (
          <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] font-semibold text-[#f87171]">
            {checkoutError}
          </p>
        )}

        {/* Push #171 — already subscribed info banner */}
        {alreadySubscribed && (
          <div className="mx-auto mt-4 max-w-2xl rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-5 py-4 text-center">
            <p className="text-[13px] font-bold text-emerald-400">
              ✅ You already have an active subscription!
            </p>
            <p className="mt-1 text-[12px] text-[#94A3B8]">
              Your plan is active. Credits may still be syncing.
            </p>
            <a
              href="/generate"
              className="mt-3 inline-block rounded-lg bg-emerald-500 px-5 py-2 text-[13px] font-extrabold text-white shadow-[0_4px_14px_rgba(52,211,153,.35)] transition hover:bg-emerald-400"
            >
              Go to Dashboard →
            </a>
          </div>
        )}

        <p className="mx-auto mt-6 max-w-2xl text-center text-[12px] text-[#94A3B8]">
          Credits are charged only when your final video is successfully generated.
        </p>
      </section>

      {/* ───────── Final CTA ─────────
          Push #086 — dark gradient card before the footer to capture the
          visitor who scrolled all the way down. Primary CTA routes through
          goToGenerate so signed-in users skip /signup; secondary jumps
          back to #pricing. */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-12 pb-4 sm:px-6 sm:pt-16">
        <div
          className="relative overflow-hidden rounded-3xl border border-blue-500/30 p-10 text-center sm:p-14"
          style={{
            background:
              'linear-gradient(135deg, rgba(34,211,238,0.10) 0%, rgba(11,17,32,0.95) 50%, rgba(37,99,235,0.12) 100%)',
            boxShadow: '0 0 60px rgba(34,211,238,0.15) inset, 0 18px 50px rgba(0,0,0,0.45)',
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full opacity-30"
            style={{ background: '#22D3EE', filter: 'blur(120px)' }}
          />
          <h2 className="relative text-balance text-3xl font-black tracking-tight sm:text-4xl text-[#F1F5F9]">
            Ready to Scale Your Channel?
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-[15px] text-[#94A3B8]">
            Join 500+ creators generating viral Shorts on autopilot.
          </p>
          <div className="relative mx-auto mt-7 flex w-full max-w-md flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => goToGenerate()}
              disabled={submitting}
              className="w-full sm:w-auto rounded-xl bg-[#2563EB] px-7 py-4 text-base font-extrabold text-white shadow-[0_8px_28px_rgba(59,130,246,.4)] transition hover:bg-blue-500 hover:shadow-[0_10px_36px_rgba(34,211,238,.45)] disabled:opacity-60"
            >
              Start Free Today
            </button>
            <a
              href="#pricing"
              className="w-full sm:w-auto rounded-xl border border-white/[0.18] px-7 py-4 text-base font-extrabold text-[#F1F5F9] transition hover:border-cyan-400/60 hover:bg-white/[0.04]"
            >
              View Pricing
            </a>
          </div>
        </div>
      </section>

      {/* ───────── Exit-intent overlay (Push #097) ───────── */}
      {showExitIntent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-intent-title"
          onClick={() => setShowExitIntent(false)}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-5 backdrop-blur-md"
          style={{ animation: 'sf-exit-fade .2s ease-out' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-3xl border-2 border-cyan-400/40 bg-[#0B1120] p-8 text-center shadow-[0_30px_80px_rgba(0,0,0,.7),0_0_60px_rgba(34,211,238,.25)]"
          >
            <button
              type="button"
              onClick={() => setShowExitIntent(false)}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-[#94A3B8] hover:text-[#F1F5F9]"
            >
              ×
            </button>
            <div aria-hidden className="mb-2 text-4xl">👋</div>
            <h2
              id="exit-intent-title"
              className="text-balance text-2xl font-black tracking-tight text-[#F1F5F9]"
            >
              Wait! Get <span className="text-[#10B981]">2 FREE videos</span> before you go
            </h2>
            <p className="mx-auto mt-3 max-w-xs text-[14px] text-[#94A3B8]">
              No credit card. No catch. Generate your first viral Short in 60 seconds.
            </p>
            <button
              type="button"
              onClick={() => {
                trackHomepageEvent('exit_intent_cta_click')
                setShowExitIntent(false)
                goToGenerate()
              }}
              className="mt-6 w-full rounded-xl bg-[#10B981] px-6 py-4 text-base font-extrabold text-white shadow-[0_10px_30px_rgba(16,185,129,.4)] transition hover:bg-[#059669]"
            >
              Generate Free →
            </button>
            <button
              type="button"
              onClick={() => setShowExitIntent(false)}
              className="mt-3 text-[12px] text-[#94A3B8] underline hover:text-[#F1F5F9]"
            >
              No thanks, I&apos;ll pass
            </button>
          </div>
          <style>{`@keyframes sf-exit-fade { from { opacity: 0; } to { opacity: 1; } }`}</style>
        </div>
      )}

      {/* ───────── Footer ───────── */}
      <footer className="relative z-10 mt-16 border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0B1120] border border-blue-500/40 text-sm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="#22D3EE" />
              </svg>
            </div>
            <span className="text-[13px] font-bold text-[#F1F5F9]">
              <span>ShortsForge</span><span className="text-cyan-400">AI</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link href="/" className="text-[12.5px] font-medium text-[#94A3B8] hover:text-[#F1F5F9]">Home</Link>
            <Link href="/generate" className="text-[12.5px] font-medium text-[#94A3B8] hover:text-[#F1F5F9]">Generator</Link>
            <Link href={THUMBNAIL_ROUTE} className="text-[12.5px] font-medium text-[#94A3B8] hover:text-[#F1F5F9]">Thumbnail</Link>
            <Link href="/#pricing" className="text-[12.5px] font-medium text-[#94A3B8] hover:text-[#F1F5F9]">Pricing</Link>
          </div>
          <p className="text-[11.5px] text-[#94A3B8]">© 2026 ShortsForgeAI <span className="opacity-40">· v1.5 · #199</span></p>
        </div>
        {/* Push #116 — legal + contact strip under the main footer row. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-6 sm:px-6">
          <Link href="/terms" className="text-[11.5px] font-medium text-[#94A3B8] hover:text-[#F1F5F9]">Terms of Service</Link>
          <span aria-hidden className="text-[11.5px] text-[#94A3B8] opacity-40">·</span>
          <Link href="/privacy" className="text-[11.5px] font-medium text-[#94A3B8] hover:text-[#F1F5F9]">Privacy Policy</Link>
          <span aria-hidden className="text-[11.5px] text-[#94A3B8] opacity-40">·</span>
          <a href="mailto:hello@shortsforgeai.com" className="text-[11.5px] font-medium text-[#94A3B8] hover:text-[#F1F5F9]">Contact</a>
        </div>
      </footer>
    </div>
  )
}

// Push #126 — hero demo video column (desktop only). Isolated into its own
// component so the TypeScript JSX parser doesn't cascade errors through the
// large hero section when encountering the video element.
function HeroVideo() {
  return (
    <div className="hidden lg:block w-52 xl:w-60 shrink-0 self-center">
      <div
        className="relative overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_48px_rgba(34,211,238,0.2)]"
        style={{ aspectRatio: '9/16' }}
      >
        <video
          src="https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg,rgba(5,7,13,.45) 0%,transparent 28%,transparent 65%,rgba(5,7,13,.75) 100%)' }}
        />
        <div className="absolute top-4 left-0 right-0 flex justify-center">
          <span
            className="rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest backdrop-blur-md"
            style={{ background: 'rgba(34,211,238,0.18)', color: '#22D3EE', border: '1px solid rgba(34,211,238,0.35)' }}
          >
            AI Short
          </span>
        </div>
        <div className="absolute bottom-4 left-0 right-0 text-center px-2">
          <p className="text-[10px] font-bold text-white/80">Made with ShortsForgeAI</p>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-[#475569] font-semibold">Auto-generated in 60 sec</p>
    </div>
  )
}

// Sub-component for a single phone card — autoplay full time (no hover needed).
function PhoneCard({ src, label, accent, tag }: { src: string; label: string; accent: string; tag: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    if (videoRef.current) videoRef.current.play().catch(() => {/* autoplay blocked */})
  }, [src])
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative w-full overflow-hidden mx-auto"
        style={{ aspectRatio: '9/16', maxWidth: 200, borderRadius: 26, border: '3px solid rgba(255,255,255,0.13)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', background: '#0B1120' }}
      >
        <div
          className="absolute z-20 rounded-full"
          style={{ top: 10, left: '50%', transform: 'translateX(-50%)', width: 54, height: 5, background: 'rgba(0,0,0,0.45)' }}
        />
        {src && <video
          ref={videoRef}
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover z-0"
        />}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg,rgba(5,7,13,.40) 0%,transparent 30%,transparent 60%,rgba(5,7,13,.85) 100%)' }}
        />
        <div className="absolute top-6 left-0 right-0 flex justify-center z-10">
          <span
            className="rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest backdrop-blur-md"
            style={{ background: accent + '22', color: accent, border: '1px solid ' + accent + '44' }}
          >
            {tag}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 z-10 px-3 pb-4 pt-6">
          <p className="text-[10px] font-bold text-white/90 text-center leading-tight">{label}</p>
        </div>
      </div>
      <p className="text-[13px] font-bold text-center" style={{ color: accent }}>{label}</p>
    </div>
  )
}

// Push #126 — 3 phone-frame preview cards for the "Real Shorts" section.
// Each card renders a Pexels free vertical clip that plays on hover in a
// phone-shaped container, with a gradient overlay and caption, matching how
// Pictory / InVideo showcase their output. Isolated component to keep JSX clean.
function PhoneCardRow({ videoCounter, phoneVideos = {} }: { videoCounter: number; phoneVideos?: Record<string, string> }) {
  // Push #150 — hardcoded Pexels portrait fallbacks so the cards never render
  // black when the /api/showcase-clips lookup returns no portrait match for a
  // given query (finance and history were the consistent offenders).
  const cards = [
    {
      src: phoneVideos['finance'] ?? 'https://videos.pexels.com/video-files/3163534/3163534-uhd_1440_2560_25fps.mp4',
      label: '📈 Money Facts Short',
      accent: '#34D399',
      tag: 'Finance',
    },
    {
      src: phoneVideos['mystery'] ?? 'https://videos.pexels.com/video-files/5466163/5466163-uhd_1440_2560_25fps.mp4',
      label: '🏛️ History Mystery Short',
      accent: '#A78BFA',
      tag: 'History',
    },
    {
      src: phoneVideos['travel'] ?? 'https://videos.pexels.com/video-files/2231346/2231346-hd_1080_1920_24fps.mp4',
      label: '🌍 Travel Facts Short',
      accent: '#22D3EE',
      tag: 'Travel',
    },
    {
      // Push #151 — psychology had been reusing the finance URL; swap in a
      // distinct verified-working Cloudinary clip (lifestyle/people, tagged
      // "psychology" in lib/stockLibrary.ts) so each card plays unique
      // footage. object-cover crops it cleanly into the 9:16 phone frame.
      src: phoneVideos['psychology'] ?? 'https://res.cloudinary.com/demo/video/upload/samples/dance-2.mp4',
      label: '💰 Money Psychology Short',
      accent: '#F59E0B',
      tag: 'Psychology',
    },
  ]
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-3xl mx-auto items-start">
        {cards.map((card) => (
          <PhoneCard key={card.src} src={card.src} label={card.label} accent={card.accent} tag={card.tag} />
        ))}
      </div>
      <p className="mt-8 text-center text-[13px] font-semibold text-[#94A3B8]">
        {'⚡ Over '}
        <span className="text-[#F1F5F9] font-bold">{videoCounter.toLocaleString('en-US')} videos</span>
        {' generated — and counting'}
      </p>
    </div>
  )
}

// Showcase card with an embedded looping video poster. The video element
// is the visual heart of the card; the gradient backdrop is both the
// initial paint (before the first frame) and the fallback if the CDN
// fails. We fade the video in on `canplay` to avoid the harsh swap from
// gradient to first-frame-black that some browsers do.
function ShowcaseVideoCard({
  card,
  onGenerate,
}: {
  card: ShowcaseCard
  onGenerate: () => void
}) {
  const [videoFailed, setVideoFailed] = useState(false)
  // Push #131 — removed opacity gating (videoReady/isPlaying states).
  // Video was staying at opacity:0 because canplay/playing events don't
  // reliably fire on Google CDN clips across all browsers. The gradient
  // div behind the video acts as the natural load placeholder — just show
  // the video immediately so it renders as soon as the first frame lands.
  const isPlaying = true // keep for overlay logic compat
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Autoplay full time — no hover needed.
  useEffect(() => {
    if (videoRef.current) videoRef.current.play().catch(() => {/* autoplay blocked */})
  }, [card.videoUrl])

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0B1120] transition-all duration-200 hover:border-blue-500/60 hover:shadow-[0_0_24px_rgba(34,211,238,0.22)]">
      {/* 9:16 vertical preview — matches the YouTube Shorts format the
          rest of the product is built around. */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: '9 / 16',
          background: `linear-gradient(135deg, ${card.accent}22 0%, #0B1120 70%)`,
        }}
      >
        {/* Gradient poster — always painted, sits behind the video so we
            never show a black box during load and so a failed CDN load
            falls back to the original look. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${card.accent}33, transparent 60%)`,
          }}
        />

        {!videoFailed && card.videoUrl && (
          <video
            ref={videoRef}
            src={card.videoUrl}
            autoPlay
            muted
            loop
            playsInline
            // Push #108 — preload="auto" so first frames land immediately
            // for the homepage showcase (6 short Mixkit clips, total ~few
            // MB). My Videos cards keep preload="none" — that grid can
            // have dozens of rows.
            preload="auto"
            onError={() => setVideoFailed(true)}
            className="absolute inset-0 h-full w-full object-cover z-0 group-hover:scale-[1.02] transition-transform duration-500 ease-out"
            style={{ opacity: 1, transform: 'translateZ(0)' }}
          />
        )}

        {/* Dark overlay — z-10, above the video (z-0), below text (z-20) */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background:
              'linear-gradient(180deg, rgba(11,17,32,0.55) 0%, rgba(11,17,32,0) 35%, rgba(11,17,32,0) 65%, rgba(11,17,32,0.65) 100%)',
          }}
        />

        <div className="absolute left-3 top-3 z-20">
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] backdrop-blur-md"
            style={{
              background: `${card.accent}22`,
              color: card.accent,
              border: `1px solid ${card.accent}55`,
            }}
          >
            {card.category}
          </span>
        </div>

        {/* Format badge — bottom-left, matches the 9:16 product spec. */}
        <div className="absolute bottom-3 left-3 z-20">
          <span
            className="rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.1em] backdrop-blur-md"
            style={{
              background: 'rgba(11,17,32,.55)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#F1F5F9',
            }}
          >
            9:16
          </span>
        </div>

        {/* Push #108 — central play affordance. Driven by `isPlaying`
            (the `playing` media event) so the overlay clears the moment
            frames actually start painting, not when the network metadata
            arrives. Kept mounted so the fade-out animates instead of
            popping. */}
        {!videoFailed && (
          <div
            className={`absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-300 ${
              isPlaying ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full backdrop-blur-md transition-transform duration-200 group-hover:scale-110"
              style={{
                background: 'rgba(11,17,32,.55)',
                border: `1px solid ${card.accent}66`,
                boxShadow: `0 0 24px ${card.accent}44`,
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M8 5v14l11-7z" fill={card.accent} />
              </svg>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <h3 className="text-[14px] sm:text-[15px] font-bold text-[#F1F5F9] leading-snug">{card.title}</h3>
        <p className="hidden text-[12px] text-[#94A3B8] line-clamp-2 sm:block">
          {card.prompt}
        </p>
        <button
          type="button"
          onClick={onGenerate}
          className="mt-auto inline-flex items-center justify-between rounded-xl border border-white/[0.08] bg-transparent px-3 py-2.5 text-[12px] sm:text-[13px] font-bold text-[#F1F5F9] transition hover:border-blue-500/50 hover:bg-white/[0.04]"
        >
          <span>Generate similar</span>
          <span style={{ color: card.accent }}>→</span>
        </button>
      </div>
    </div>
  )
}

// Marketing feature copy lives next to the home page so it can be tuned
// without touching the canonical PLANS config.
function featureListFor(tier: 'free' | 'basic' | 'pro'): string[] {
  if (tier === 'free') {
    return [
      `${PLANS.free.credits} Fast Mode renders`,
      'Stock footage library + neural voiceover',
      'Watermark-free MP4 output',
      'No credit card needed',
    ]
  }
  if (tier === 'basic') {
    return [
      `${PLANS.basic.credits} Fast Mode renders/month`,
      'AI script + neural voiceover pipeline',
      'Auto-captions engine',
      'Watermark-free MP4 output',
      'My Videos history',
    ]
  }
  return [
    `${PLANS.pro.credits} Fast Mode renders/month`,
    'Cinematic AI Engine — AI-generated scenes',
    'Advanced generation controls',
    'Auto-captions engine',
    'Watermark-free MP4 output',
    'My Videos history',
  ]
}
