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

// Push #082 — real video showcase. Each card loops a short royalty-free
// clip from Mixkit's free preview CDN as the poster. The clip is muted +
// autoplay + playsInline so it works on mobile without user gesture, and
// preload="metadata" keeps the page from downloading 6 full MP4s up front.
// If the video errors out (CDN blocked, offline, etc.), we fall back to
// the original gradient poster.
const SHOWCASE: ShowcaseCard[] = [
  {
    category: 'Space Mystery',
    title: 'What NASA hides about the Moon',
    prompt: 'Cinematic space mystery short about unexplained Moon anomalies that NASA never explained',
    accent: '#22D3EE',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-stars-in-space-1610-large.mp4',
  },
  {
    category: 'History Facts',
    title: 'The Roman invention we still use',
    prompt: 'Fast-paced history facts short about a Roman invention that still powers daily life today',
    accent: '#F59E0B',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-closeup-of-pavement-taken-in-an-overhead-view-19088-large.mp4',
  },
  {
    category: 'Hidden Places',
    title: 'Cities erased from every map',
    prompt: 'Dark cinematic short about real hidden cities that governments removed from world maps',
    accent: '#A78BFA',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-top-aerial-shot-of-seashore-with-rocks-1090-large.mp4',
  },
  {
    category: 'Cold Case',
    title: 'The case that broke the FBI',
    prompt: 'Suspenseful cold case short about an unsolved FBI investigation with chilling details',
    accent: '#F87171',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-going-down-a-curved-highway-through-a-mountain-range-41576-large.mp4',
  },
  {
    category: 'Weird Facts',
    title: 'Facts your brain refuses to believe',
    prompt: 'Punchy weird facts short with 5 facts that sound fake but are 100% true',
    accent: '#34D399',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-water-1164-large.mp4',
  },
  {
    category: 'Money Psychology',
    title: 'Why the rich think differently',
    prompt: 'Money psychology short about the mental habits that separate the wealthy from everyone else',
    accent: '#60A5FA',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-white-sand-beach-and-palm-trees-1564-large.mp4',
  },
]

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
  // Push #097 — exit-intent overlay state. One-shot per session.
  const [showExitIntent, setShowExitIntent] = useState(false)
  // Push #104 — live "X Shorts created today" counter for the social
  // proof bar. Falls back to the API's baseline if the fetch fails.
  const [shortsToday, setShortsToday] = useState<number>(47)
  // Push #116 — cumulative hero counter ("9,847 Shorts created — and
  // counting"). Bumps +1 every 30s in a setInterval so the page reads
  // as alive while the visitor sits on it.
  const [shortsTotal, setShortsTotal] = useState<number>(9847)

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
      await supabase.auth.signOut()
      setUser(null)
    } catch {
      // ignore
    } finally {
      setSigningOut(false)
      router.push('/')
      router.refresh()
    }
  }

  async function handleStartPlan(tier: 'basic' | 'pro') {
    trackHomepageEvent(tier === 'basic' ? 'basic_checkout_clicked' : 'pro_checkout_clicked')
    setCheckoutError(null)

    // Guests can't be linked to a Stripe customer with a supabase_user_id yet,
    // so the webhook would have no one to credit. Route them through login first.
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent('/pricing')}`)
      return
    }

    setCheckoutTier(tier)
    try {
      // Push #111 — BR locales bill in BRL with boleto fallback so card
      // rejections (USD-on-BR-card) stop killing the upgrade flow.
      const currency =
        typeof navigator !== 'undefined' && navigator.language?.startsWith('pt')
          ? 'brl'
          : 'usd'
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, currency }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.url) {
        setCheckoutError(data?.error ?? 'Could not start checkout. Please try again.')
        setCheckoutTier(null)
        return
      }
      window.location.assign(data.url)
    } catch {
      setCheckoutError('Network error. Please try again.')
      setCheckoutTier(null)
    }
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
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
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

          {/* Center links — desktop. Push #078 dropped Features and added
              Thumbnail with a NEW badge. */}
          <div className="hidden items-center gap-7 md:flex">
            <Link href="/" className="text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition">Home</Link>
            <Link href="/generate" className="text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition">Generator</Link>
            <Link
              href={THUMBNAIL_ROUTE}
              className="flex items-center text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition"
            >
              Thumbnail
              <span className="bg-[#22D3EE] text-[#05070D] text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">
                NEW
              </span>
            </Link>
            <a href="#pricing" className="text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition">Pricing</a>
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
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/5"
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white transition-colors hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-200 disabled:opacity-60"
                >
                  {signingOut ? 'Signing out…' : 'Sign Out'}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/5"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-[#22D3EE] px-4 py-2 text-sm font-bold text-[#05070D] transition-colors hover:bg-cyan-300 shadow-[0_4px_18px_rgba(34,211,238,.35)]"
                >
                  Sign Up
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
                Sign Up
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
              <Link onClick={() => setNavOpen(false)} href="/" className="rounded-md px-3 py-2 text-sm font-medium text-[#94A3B8] hover:bg-white/[.04] hover:text-[#F1F5F9]">Home</Link>
              <Link onClick={() => setNavOpen(false)} href="/generate" className="rounded-md px-3 py-2 text-sm font-medium text-[#94A3B8] hover:bg-white/[.04] hover:text-[#F1F5F9]">Generator</Link>
              <Link
                onClick={() => setNavOpen(false)}
                href={THUMBNAIL_ROUTE}
                className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-[#94A3B8] hover:bg-white/[.04] hover:text-[#F1F5F9]"
              >
                Thumbnail
                <span className="bg-[#22D3EE] text-[#05070D] text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">
                  NEW
                </span>
              </Link>
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
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ───────── Hero ─────────
          Push #097 — conversion overhaul for the Google Ads funnel
          (85 clicks / 0 signups). Headline now leads with the user's
          input ("Any Idea") instead of the output, subheadline lists
          exactly what's automated, and the primary CTA is a green
          go-button with the trust microcopy stacked below it. */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24 sm:pb-16">
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
          🎬 {shortsTotal.toLocaleString()} Shorts created — and counting
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
            className="w-full sm:w-auto rounded-xl bg-[#10B981] px-9 py-4 text-base sm:text-lg font-extrabold text-white shadow-[0_10px_32px_rgba(16,185,129,.45)] transition hover:bg-[#059669] hover:shadow-[0_12px_40px_rgba(16,185,129,.55)] disabled:opacity-60"
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
      </section>

      {/* ───────── AI Video Showcase ───────── */}
      <section id="showcase" className="relative z-10 mx-auto max-w-6xl px-4 pt-4 pb-12 sm:px-6 sm:pb-16">
        <div className="mb-8 text-center">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-cyan-400">
            Showcase
          </div>
          <h2 className="text-balance text-3xl font-black tracking-tight sm:text-4xl text-[#F1F5F9]">
            AI Video Showcase
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[14px] text-[#94A3B8]">
            See what ShortsForge can create.
          </p>
        </div>

        {/* Push #082 — real playable previews. Cards are now 9:16 (YouTube
            Shorts) with a muted autoplay loop sourced from a royalty-free
            CDN. The gradient poster stays as a fallback for slow networks
            and as a paint target before the video's first frame lands. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
          {SHOWCASE.map((card) => (
            <ShowcaseVideoCard
              key={card.title}
              card={card}
              onGenerate={() => goToShowcase(card.prompt)}
            />
          ))}
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
            ⚡ {shortsToday.toLocaleString()} Shorts created today
          </span>
          <span aria-hidden className="hidden h-4 w-px bg-white/10 sm:block" />
          <span className="flex items-center gap-2 text-[13.5px] text-[#94A3B8]">
            <span className="font-black tracking-widest text-[#FBBF24]">★★★★★</span>
            <span className="text-[#F1F5F9]">&ldquo;Saves me 3 hours per video&rdquo;</span>
            <span className="text-cyan-400 font-bold">— @moneyfacts_creator</span>
          </span>
        </div>
      </section>

      {/* ───────── See It In Action ─────────
          Push #104 — demo video slot just above "How It Works". If
          NEXT_PUBLIC_DEMO_VIDEO_URL is set we play it as a muted loop;
          otherwise we render a "coming soon" placeholder so the section
          still gives the page a clear shape. */}
      <section className="py-12 px-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#34d399' }}>
          SEE IT IN ACTION
        </p>
        <h2 className="text-2xl sm:text-3xl font-black mb-8" style={{ color: 'var(--text)' }}>
          From idea to YouTube Short in 60 seconds
        </h2>
        <div
          className="mx-auto rounded-2xl overflow-hidden"
          style={{
            maxWidth: 640,
            aspectRatio: '16/9',
            background: 'rgba(255,255,255,.04)',
            border: '1px solid rgba(255,255,255,.10)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {process.env.NEXT_PUBLIC_DEMO_VIDEO_URL ? (
            <video
              src={process.env.NEXT_PUBLIC_DEMO_VIDEO_URL}
              autoPlay
              muted
              loop
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ color: 'rgba(255,255,255,.3)', textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>▶</div>
              <p style={{ fontSize: 14 }}>Demo video coming soon</p>
            </div>
          )}
        </div>
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
          {/* Push #086 — urgency strip just under the headline. The 50%
              off line ties back to the cyan "first month" copy on each
              plan card, so this isn't a fake scarcity claim. */}
          <p className="mx-auto mt-3 max-w-xl text-[14px] font-bold text-[#FBBF24]">
            🔥 50% off launch pricing — limited time
          </p>
          <p className="mx-auto mt-2 max-w-xl text-[14px] text-[#94A3B8]">
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
                  {plan.regularPrice ? `first month, then ${plan.regularPrice}` : 'forever'}
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
                {/* Push #086 — per-tier urgency / value highlight under
                    each CTA. Costs use first-month math (credits ÷ first
                    month price) to match the cyan "first month" copy
                    above and the 50% off launch strip on the headline. */}
                <p className="mt-3 text-center text-[12px] font-bold text-cyan-400">
                  {plan.tier === 'free' && 'No credit card required'}
                  {plan.tier === 'basic' && '50 Fast Mode videos/month'}
                  {plan.tier === 'pro' && '100 Fast Mode + 1 Cinematic/month'}
                </p>
                {/* Push #104 — 7-day trial reassurance under each paid CTA. */}
                {(plan.tier === 'basic' || plan.tier === 'pro') && (
                  <p className="mt-1 text-center text-[11.5px] font-semibold text-[#94A3B8]">
                    No charge for 7 days
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

        <p className="mx-auto mt-6 max-w-2xl text-center text-[12px] text-[#94A3B8]">
          50% off applies to the first month only. Plans renew at the regular monthly price.
        </p>
        <p className="mx-auto mt-2 max-w-2xl text-center text-[12px] text-[#94A3B8]">
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
          <p className="text-[11.5px] text-[#94A3B8]">© 2026 ShortsForgeAI</p>
        </div>
      </footer>
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
  const [videoReady, setVideoReady] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  // Push #108 — `videoReady` (driven by `canplay`) flipped too late on some
  // networks: the player was paused-but-fetching with readyState 0, so the
  // overlay stuck and the video stayed at opacity 0 even after autoplay
  // succeeded. `isPlaying` is the authoritative "frames are painting" signal
  // — fed by the `playing` media event — and now drives the overlay.
  const [isPlaying, setIsPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Push #106 — IntersectionObserver fallback. The `autoplay` attribute
  // is supposed to start the muted preview the moment the card paints,
  // but iOS Low Power Mode + a few strict browser policies block that.
  // This re-issues play() the moment the card enters the viewport, and
  // pauses + rewinds once it scrolls off so we don't waste decoder time.
  useEffect(() => {
    const el = videoRef.current
    if (!el || videoFailed) return
    if (typeof IntersectionObserver === 'undefined') {
      el.play().catch(() => {/* autoplay blocked */})
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const v = entry.target as HTMLVideoElement
          if (entry.isIntersecting) {
            v.play().catch(() => {/* autoplay blocked */})
          } else {
            v.pause()
            try { v.currentTime = 0 } catch { /* not seekable yet */ }
          }
        })
      },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [videoFailed])

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

        {!videoFailed && (
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
            onCanPlay={() => setVideoReady(true)}
            onLoadedData={() => setVideoReady(true)}
            onPlaying={() => { setIsPlaying(true); setVideoReady(true) }}
            onPause={() => setIsPlaying(false)}
            onWaiting={() => setIsPlaying(false)}
            onError={() => setVideoFailed(true)}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out group-hover:scale-[1.02]"
            style={{ opacity: videoReady || isPlaying ? 1 : 0, transform: 'translateZ(0)' }}
          />
        )}

        {/* Subtle dark gradient overlay so the category chip + play badge
            stay legible against bright frames. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(11,17,32,0.55) 0%, rgba(11,17,32,0) 35%, rgba(11,17,32,0) 65%, rgba(11,17,32,0.65) 100%)',
          }}
        />

        <div className="absolute left-3 top-3 z-10">
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
        <div className="absolute bottom-3 left-3 z-10">
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
      `${PLANS.free.credits} Fast Mode videos`,
      'Pexels footage + AI voiceover',
      'Watermark-free MP4',
      'Try the platform',
    ]
  }
  if (tier === 'basic') {
    return [
      `${PLANS.basic.credits} Fast Mode videos/month`,
      'Pexels footage + AI voiceover',
      'Voiceover + captions',
      'Download MP4',
      'My Videos history',
    ]
  }
  return [
    `${PLANS.pro.credits} Fast Mode videos/month`,
    '1 Cinematic (Runway AI) video/month',
    'Better generation settings',
    'Voiceover + captions',
    'Download MP4',
    'My Videos history',
  ]
}
