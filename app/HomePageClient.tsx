'use client'

// Push #075 — Homepage nav simplification + hero card redesign.
// - Top-nav center links reduced to: Pricing / Generate / Features
// - Right side: single button (Dashboard if logged in, Sign In if guest)
// - Hero collapsed to a single clean card (prompt + generate) under the H1
// - Removed: feature strip, social proof, feature cards grid, templates,
//   how-it-works. Pricing kept at bottom, footer unchanged.

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STRIPE_LINKS = {
  basic: 'https://buy.stripe.com/fZu8wP24tePZbareNggjC0n',
  pro: 'https://buy.stripe.com/8x214nbF323ddizcF8gjC0o',
}

const THUMBNAIL_ROUTE = '/thumbnail-generator'

const PRICING = [
  {
    tier: 'free',
    name: 'Free',
    price: '$0',
    priceSub: 'forever',
    features: ['2 credits to try', 'Full AI pipeline', 'Watermark-free MP4'],
    cta: { label: 'Start Free', href: '/signup' },
  },
  {
    tier: 'basic',
    name: 'Basic',
    price: '$4.50',
    priceSub: 'first month, then $9/mo',
    features: ['140 credits / month', '≈9 videos / month', '15 credits per video', 'Email support'],
    cta: { label: 'Start Basic', href: STRIPE_LINKS.basic },
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: '$9.50',
    priceSub: 'first month, then $19/mo',
    features: [
      '350 credits / month',
      '≈17 videos / month',
      '20 credits per video',
      'Cinematic prompting',
      'Priority support',
    ],
    cta: { label: 'Start Pro', href: STRIPE_LINKS.pro },
    highlight: true,
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

  useEffect(() => {
    trackHomepageEvent('homepage_view')
  }, [])

  useEffect(() => {
    if (initialUser) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user ? { id: user.id } : null)
      setAuthChecked(true)
    })
  }, [initialUser])

  function goToGenerate(text?: string) {
    const trimmed = (text ?? prompt).trim()
    setSubmitting(true)
    const dest = trimmed
      ? `/generate?prompt=${encodeURIComponent(trimmed)}`
      : '/generate'
    const target = user ? dest : `/login?redirect=${encodeURIComponent(dest)}`
    router.push(target)
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

          {/* Center links — desktop */}
          <div className="hidden items-center gap-7 md:flex">
            <a href="#pricing" className="text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition">Pricing</a>
            <Link href="/generate" className="text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition">Generate</Link>
            <a href="#pricing" className="text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition">Features</a>
          </div>

          {/* Right side */}
          <div className="hidden items-center gap-2 md:flex">
            {!authChecked ? (
              <div aria-hidden className="h-9 w-28" />
            ) : user ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-bold text-white shadow-[0_4px_18px_rgba(59,130,246,.35)] transition hover:bg-blue-500 hover:shadow-[0_6px_24px_rgba(34,211,238,.4)]"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-bold text-white shadow-[0_4px_18px_rgba(59,130,246,.35)] transition hover:bg-blue-500 hover:shadow-[0_6px_24px_rgba(34,211,238,.4)]"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile right side: persistent CTA + hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            {authChecked && user ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-[#2563EB] px-3 py-2 text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(59,130,246,.35)]"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-[#2563EB] px-3 py-2 text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(59,130,246,.35)]"
              >
                Sign In
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

        {/* Mobile menu panel */}
        {navOpen && (
          <div className="md:hidden border-t border-white/[0.08] bg-[#0B1120]/95 backdrop-blur-xl">
            <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
              <a onClick={() => setNavOpen(false)} href="#pricing" className="rounded-md px-3 py-2 text-sm font-medium text-[#94A3B8] hover:bg-white/[.04] hover:text-[#F1F5F9]">Pricing</a>
              <Link onClick={() => setNavOpen(false)} href="/generate" className="rounded-md px-3 py-2 text-sm font-medium text-[#94A3B8] hover:bg-white/[.04] hover:text-[#F1F5F9]">Generate</Link>
              <a onClick={() => setNavOpen(false)} href="#pricing" className="rounded-md px-3 py-2 text-sm font-medium text-[#94A3B8] hover:bg-white/[.04] hover:text-[#F1F5F9]">Features</a>
            </div>
          </div>
        )}
      </nav>

      {/* ───────── Hero ───────── */}
      <section className="relative z-10 mx-auto max-w-3xl px-4 pt-16 pb-12 text-center sm:pt-24 sm:pb-16">
        <h1 className="text-balance text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl md:text-6xl text-[#F1F5F9]">
          Create{' '}
          <span className="bg-gradient-to-br from-cyan-300 via-blue-400 to-blue-600 bg-clip-text text-transparent">
            AI Shorts
          </span>{' '}
          from one idea.
        </h1>

        {/* Single clean prompt card */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            goToGenerate()
          }}
          className="mx-auto mt-10 flex min-h-[360px] w-full max-w-2xl flex-col justify-center gap-5 rounded-2xl border border-white/[0.08] bg-[#0B1120] p-8 shadow-[0_18px_50px_rgba(0,0,0,.5)] focus-within:border-blue-500/60 sm:p-10"
        >
          <textarea
            value={prompt}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Describe your video idea…"
            maxLength={500}
            rows={5}
            className="w-full flex-1 resize-none rounded-xl bg-transparent px-2 py-2 text-[16px] text-[#F1F5F9] placeholder:text-[#94A3B8] outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full shrink-0 rounded-xl bg-[#2563EB] px-6 py-4 text-base font-extrabold text-white shadow-[0_8px_28px_rgba(59,130,246,.4)] transition hover:bg-blue-500 hover:shadow-[0_10px_36px_rgba(34,211,238,.45)] disabled:opacity-60"
          >
            {submitting ? 'Loading…' : 'Generate Video →'}
          </button>
        </form>
      </section>

      {/* ───────── Pricing ───────── */}
      <section id="pricing" className="relative z-10 mx-auto max-w-5xl px-4 pt-12 pb-8 sm:px-6">
        <div className="mb-10 text-center">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-cyan-400">
            Pricing
          </div>
          <h2 className="text-balance text-3xl font-black tracking-tight sm:text-4xl text-[#F1F5F9]">
            Simple, credit-based pricing.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[14px] text-[#94A3B8]">
            Two paid plans, 50% off the first month. Failed generations never consume credits.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PRICING.map((p) => (
            <div
              key={p.tier}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                p.highlight
                  ? 'border-blue-500 bg-[#0B1120] shadow-[0_0_30px_rgba(59,130,246,0.15)]'
                  : 'border-white/[0.08] bg-[#0B1120]'
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2563EB] px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-white shadow-[0_4px_18px_rgba(59,130,246,.45)]">
                  Best Value
                </div>
              )}
              <div className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[#94A3B8]">
                {p.name}
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-[2.4rem] font-black leading-none tracking-tight text-[#F1F5F9]">
                  {p.price}
                </span>
              </div>
              <div className="mt-1 text-[12.5px] font-semibold text-cyan-400">
                {p.priceSub}
              </div>
              <ul className="mt-5 mb-6 flex flex-col gap-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13.5px] text-[#F1F5F9]">
                    <span className="mt-[3px] text-cyan-400">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={p.cta.href}
                onClick={() => {
                  if (p.tier === 'basic') trackHomepageEvent('basic_checkout_clicked')
                  if (p.tier === 'pro') trackHomepageEvent('pro_checkout_clicked')
                }}
                className={`mt-auto block rounded-xl px-4 py-3 text-center text-[14px] font-extrabold transition ${
                  p.highlight
                    ? 'bg-[#2563EB] text-white shadow-[0_8px_24px_rgba(59,130,246,.4)] hover:bg-blue-500 hover:shadow-[0_10px_32px_rgba(34,211,238,.4)]'
                    : 'border border-white/[0.08] text-[#F1F5F9] hover:bg-white/5 hover:border-blue-500/40'
                }`}
              >
                {p.cta.label} →
              </a>
            </div>
          ))}
        </div>
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
            <Link href="/templates" className="text-[12.5px] font-medium text-[#94A3B8] hover:text-[#F1F5F9]">Templates</Link>
            <Link href="/examples" className="text-[12.5px] font-medium text-[#94A3B8] hover:text-[#F1F5F9]">Examples</Link>
            <Link href={THUMBNAIL_ROUTE} className="text-[12.5px] font-medium text-[#94A3B8] hover:text-[#F1F5F9]">Thumbnail</Link>
            <Link href="/pricing" className="text-[12.5px] font-medium text-[#94A3B8] hover:text-[#F1F5F9]">Pricing</Link>
            <Link href="/login" className="text-[12.5px] font-medium text-[#94A3B8] hover:text-[#F1F5F9]">Sign In</Link>
          </div>
          <p className="text-[11.5px] text-[#94A3B8]">© 2026 ShortsForgeAI</p>
        </div>
      </footer>
    </div>
  )
}
