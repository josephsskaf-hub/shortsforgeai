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
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PLANS, PLAN_LIST } from '@/lib/pricing'

const THUMBNAIL_ROUTE = '/thumbnail-generator'

interface ShowcaseCard {
  category: string
  title: string
  prompt: string
  accent: string
}

const SHOWCASE: ShowcaseCard[] = [
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

  useEffect(() => {
    trackHomepageEvent('homepage_view')
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

  function goToGenerate(text?: string) {
    const trimmed = (text ?? prompt).trim()
    setSubmitting(true)
    const dest = trimmed
      ? `/generate?prompt=${encodeURIComponent(trimmed)}`
      : '/generate'
    const target = user ? dest : `/login?redirect=${encodeURIComponent(dest)}`
    router.push(target)
  }

  function goToShowcase(cardPrompt: string) {
    const dest = `/generate?prompt=${encodeURIComponent(cardPrompt)}`
    const target = user ? dest : `/login?redirect=${encodeURIComponent(dest)}`
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
              <span className="text-[10px] font-semibold text-[#94A3B8] mt-0.5">v1.2</span>
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
              <Link
                href="/generate"
                className="rounded-lg border border-white/20 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/5"
              >
                Dashboard
              </Link>
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

      {/* ───────── Hero ───────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24 sm:pb-16">
        <h1 className="text-balance text-4xl font-black leading-[1.1] tracking-tight sm:text-5xl text-[#F1F5F9]">
          Create videos{' '}
          <span
            className="text-[#22D3EE]"
            style={{ textShadow: '0 0 24px rgba(34,211,238,0.55), 0 0 48px rgba(34,211,238,0.25)' }}
          >
            10x faster
          </span>{' '}
          with AI
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] sm:text-base text-[#94A3B8]">
          Turn one idea into a ready-to-post Short with voiceover, captions, visuals and download.
        </p>

        {/* Single clean prompt card */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            goToGenerate()
          }}
          className="mx-auto mt-10 flex w-full max-w-[770px] flex-col gap-5 rounded-2xl border border-white/[0.08] bg-[#0B1120] p-6 shadow-[0_18px_50px_rgba(0,0,0,.5)] focus-within:border-blue-500/60 sm:p-8"
        >
          <textarea
            value={prompt}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Describe your video idea..."
            maxLength={500}
            rows={5}
            className="w-full flex-1 resize-none rounded-xl bg-transparent px-2 py-2 text-[16px] text-[#F1F5F9] placeholder:text-[#94A3B8] outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full shrink-0 rounded-xl bg-[#2563EB] px-6 py-4 text-base font-extrabold text-white shadow-[0_8px_28px_rgba(59,130,246,.4)] transition hover:bg-blue-500 hover:shadow-[0_10px_36px_rgba(34,211,238,.45)] disabled:opacity-60"
          >
            {submitting ? 'Loading…' : 'Generate your first video'}
          </button>
        </form>
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

        {/* Horizontal scroll on mobile, 3-col grid on desktop. */}
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-3">
          {SHOWCASE.map((card) => (
            <div
              key={card.title}
              className="group flex w-[78%] min-w-[260px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0B1120] transition-all duration-200 hover:border-blue-500/60 hover:shadow-[0_0_24px_rgba(34,211,238,0.22)] sm:w-auto sm:min-w-0"
            >
              {/* Static "thumbnail" — no autoplay video, just a gradient
                  block tinted with the card's accent so the grid reads as
                  a video-thumbnail wall without the perf cost. */}
              <div
                aria-hidden
                className="relative aspect-video w-full overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${card.accent}22 0%, #0B1120 70%)`,
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${card.accent}33, transparent 60%)`,
                  }}
                />
                <div className="absolute left-3 top-3">
                  <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em]"
                    style={{
                      background: `${card.accent}22`,
                      color: card.accent,
                      border: `1px solid ${card.accent}55`,
                    }}
                  >
                    {card.category}
                  </span>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-full backdrop-blur-md"
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
              </div>

              <div className="flex flex-1 flex-col gap-3 p-5">
                <h3 className="text-[15px] font-bold text-[#F1F5F9]">{card.title}</h3>
                <button
                  type="button"
                  onClick={() => goToShowcase(card.prompt)}
                  className="mt-auto inline-flex items-center justify-between rounded-xl border border-white/[0.08] bg-transparent px-3 py-2.5 text-[13px] font-bold text-[#F1F5F9] transition hover:border-blue-500/50 hover:bg-white/[0.04]"
                >
                  <span>Generate similar</span>
                  <span style={{ color: card.accent }}>→</span>
                </button>
              </div>
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
            const isExternal = plan.href.startsWith('http')

            const features = featureListFor(plan.tier)
            const ctaLabel = isSelected
              ? plan.tier === 'basic' ? 'Continue with Basic' : 'Continue with Pro'
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
                <a
                  href={plan.href}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noopener noreferrer' : undefined}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isPaid) setSelectedPlan(plan.tier as 'basic' | 'pro')
                    if (plan.tier === 'basic') trackHomepageEvent('basic_checkout_clicked')
                    if (plan.tier === 'pro') trackHomepageEvent('pro_checkout_clicked')
                  }}
                  className={`mt-auto block rounded-xl px-4 py-3 text-center text-[14px] font-extrabold transition ${
                    isRecommended || isSelected
                      ? 'bg-[#2563EB] text-white shadow-[0_8px_24px_rgba(59,130,246,.4)] hover:bg-blue-500 hover:shadow-[0_10px_32px_rgba(34,211,238,.4)]'
                      : 'border border-white/[0.08] text-[#F1F5F9] hover:bg-white/5 hover:border-blue-500/40'
                  }`}
                >
                  {ctaLabel} →
                </a>
              </div>
            )
          })}
        </div>

        <p className="mx-auto mt-6 max-w-2xl text-center text-[12px] text-[#94A3B8]">
          50% off applies to the first month only. Plans renew at the regular monthly price.
        </p>
        <p className="mx-auto mt-2 max-w-2xl text-center text-[12px] text-[#94A3B8]">
          Credits are charged only when your final video is successfully generated.
        </p>
      </section>

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

// Marketing feature copy lives next to the home page so it can be tuned
// without touching the canonical PLANS config.
function featureListFor(tier: 'free' | 'basic' | 'pro'): string[] {
  if (tier === 'free') {
    return [
      `${PLANS.free.credits} credits`,
      'Analyze ideas before rendering',
      'Try AI video generation',
      'Credits charged only on successful video',
    ]
  }
  if (tier === 'basic') {
    return [
      `${PLANS.basic.credits} credits/month`,
      `≈9 Basic videos/month (${PLANS.basic.videoCredits} credits each)`,
      'Voiceover + captions',
      'Download MP4',
      'My Videos history',
    ]
  }
  return [
    `${PLANS.pro.credits} credits/month`,
    `≈17 Pro videos/month (${PLANS.pro.videoCredits} credits each)`,
    'Better generation settings',
    'Voiceover + captions',
    'Download MP4',
    'My Videos history',
  ]
}
