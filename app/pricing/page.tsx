'use client'

// Push #076 — Standalone /pricing page (real route, not just an anchor).
// Mirrors the Cyber Blue theme used by HomePageClient.
//
// Push #097 — added launch-offer banner with live countdown, a "Most
// Popular" badge on Basic, and a cancel/instant-access/money-back trust
// row directly under the plan cards. The countdown is a UX/urgency
// device; the underlying Stripe discount is the open 50%-off-first-month
// launch offer.

import Link from 'next/link'
import { useEffect, useState } from 'react'

const COUNTDOWN_START_SECONDS = 23 * 3600 + 47 * 60 + 12

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds)
  const h = Math.floor(safe / 3600)
  const m = Math.floor((safe % 3600) / 60)
  const s = safe % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const STRIPE_LINKS = {
  basic: 'https://buy.stripe.com/fZu8wP24tePZbareNggjC0n',
  pro: 'https://buy.stripe.com/8x214nbF323ddizcF8gjC0o',
}

// Push #099 — FAQ entries shown below the pricing comparison table. Pure
// content array so the accordion renders from one source of truth.
const FAQS: { q: string; a: string }[] = [
  {
    q: 'Do I need a credit card to start?',
    a: 'No! Sign up free and get 2 videos included. No card required.',
  },
  {
    q: 'How fast are videos generated?',
    a: 'Fast Mode videos are ready in about 60 seconds. We use AI to write, voice, and edit everything automatically.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes, cancel from your account settings at any time. No contracts, no commitments.',
  },
  {
    q: 'What’s the difference between Fast Mode and Cinematic Mode?',
    a: 'Fast Mode uses AI + stock footage and is included in all plans. Cinematic Mode uses Runway AI to generate custom scenes — available on Pro.',
  },
  {
    q: 'What counts as 1 credit?',
    a: 'Each video you generate uses 1 credit, whether it’s 15 seconds or 60 seconds.',
  },
]

const PRICING = [
  {
    tier: 'free',
    name: 'Free',
    price: '$0',
    priceSub: 'forever',
    features: [
      '2 Fast Mode videos to try',
      'Pexels footage + AI voiceover',
      'Watermark-free MP4',
    ],
    cta: { label: 'Start Free', href: '/signup' },
  },
  {
    tier: 'basic',
    name: 'Basic',
    price: '$4.50',
    priceSub: 'first month, then $9/mo',
    features: [
      '50 Fast Mode videos/month',
      'Pexels footage + AI voiceover',
      'Voiceover + captions',
      'Download MP4',
      'My Videos history',
    ],
    // Push #104 — Stripe checkout adds a 7-day trial so we frame the CTA
    // around the trial entry, not the discounted first-month price.
    cta: { label: 'Start Free Trial', href: STRIPE_LINKS.basic },
    popular: true,
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: '$9.50',
    priceSub: 'first month, then $19/mo',
    features: [
      '100 Fast Mode videos/month',
      '1 Cinematic (Runway AI) video/month',
      'Better generation settings',
      'Voiceover + captions',
      'Download MP4',
      'My Videos history',
    ],
    cta: { label: 'Start Free Trial', href: STRIPE_LINKS.pro },
    highlight: true,
  },
]

function trackPricingEvent(name: string): void {
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

export default function PricingPage() {
  // Push #077 — pricing card selected state. Pro is selected by default
  // (Recommended). Card click toggles selection; CTA still drives the
  // Stripe link so users can either click-then-confirm or click-CTA-direct.
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro' | null>('pro')
  // Push #097 — live countdown for the launch-offer banner.
  const [countdown, setCountdown] = useState<number>(COUNTDOWN_START_SECONDS)
  // Push #099 — open FAQ index for the accordion (null = all collapsed). First
  // question is open by default so the section reads as scannable, not empty.
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  useEffect(() => {
    const id = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? COUNTDOWN_START_SECONDS : prev - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [])

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

      {/* ───────── Top Nav (simple) ───────── */}
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

          <Link
            href="/"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/[.04] transition"
          >
            ← Back to Home
          </Link>
        </div>
      </nav>

      {/* ───────── Pricing ───────── */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 pt-12 pb-16 sm:px-6 sm:pt-16">
        {/* Push #097 — Launch-offer banner with live countdown */}
        <div
          className="mx-auto mb-8 flex max-w-2xl flex-col items-center justify-center gap-3 rounded-2xl border border-[#FBBF24]/40 px-5 py-3 text-center sm:flex-row"
          style={{
            background: 'linear-gradient(135deg, rgba(251,191,36,.14), rgba(239,68,68,.10))',
            boxShadow: '0 8px 32px rgba(251,191,36,.12)',
          }}
        >
          <div className="text-[14px] font-black tracking-tight text-[#FBBF24]">
            🔥 Launch Offer — 50% off first month
          </div>
          <div
            className="flex items-center gap-2 rounded-lg border border-[#FBBF24]/30 px-3 py-1.5"
            style={{ background: 'rgba(0,0,0,.45)', fontVariantNumeric: 'tabular-nums' }}
          >
            <span className="text-[10px] font-bold uppercase tracking-[.08em] text-[#94A3B8]">
              Ends in
            </span>
            <span className="text-[14px] font-black tracking-wider text-white">
              {formatCountdown(countdown)}
            </span>
          </div>
        </div>

        <div className="mb-10 text-center">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-cyan-400">
            Pricing
          </div>
          <h1 className="text-balance text-4xl font-black tracking-tight sm:text-5xl text-[#F1F5F9]">
            Simple, credit-based pricing.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[14px] text-[#94A3B8]">
            Two paid plans, 50% off the first month. Failed generations never consume credits.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PRICING.map((p) => {
            const isPaid = p.tier === 'basic' || p.tier === 'pro'
            const isSelected = isPaid && selectedPlan === p.tier
            const ctaLabel = isSelected
              ? p.tier === 'basic' ? 'Continue with Basic' : 'Continue with Pro'
              : p.cta.label
            const isExternal = p.cta.href.startsWith('http')
            return (
              <div
                key={p.tier}
                role={isPaid ? 'button' : undefined}
                tabIndex={isPaid ? 0 : undefined}
                aria-pressed={isPaid ? isSelected : undefined}
                onClick={() => {
                  if (isPaid) setSelectedPlan(p.tier as 'basic' | 'pro')
                }}
                onKeyDown={(e) => {
                  if (!isPaid) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedPlan(p.tier as 'basic' | 'pro')
                  }
                }}
                className={`group relative flex flex-col rounded-2xl border p-6 transition-all duration-200 ${
                  isPaid ? 'cursor-pointer' : ''
                } ${
                  isSelected
                    ? 'border-2 border-[#3B82F6] bg-[#0D1830] shadow-[0_0_28px_rgba(59,130,246,0.3)]'
                    : p.highlight
                      ? 'border-blue-500 bg-[#0B1120] shadow-[0_0_30px_rgba(59,130,246,0.15)] hover:border-[#3B82F6] hover:bg-[rgba(34,211,238,0.06)] hover:shadow-[0_0_20px_rgba(34,211,238,0.18)]'
                      : 'border-white/[0.08] bg-[#0B1120] hover:border-[#3B82F6] hover:bg-[rgba(34,211,238,0.06)] hover:shadow-[0_0_20px_rgba(34,211,238,0.18)]'
                }`}
              >
                {p.highlight && !isSelected && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2563EB] px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-white shadow-[0_4px_18px_rgba(59,130,246,.45)]">
                    Best Value
                  </div>
                )}
                {p.popular && !isSelected && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#22D3EE] px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-[#05070D] shadow-[0_4px_18px_rgba(34,211,238,.45)]">
                    🔥 Most Popular
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
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noopener noreferrer' : undefined}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isPaid) setSelectedPlan(p.tier as 'basic' | 'pro')
                    if (p.tier === 'basic') trackPricingEvent('basic_checkout_clicked')
                    if (p.tier === 'pro') trackPricingEvent('pro_checkout_clicked')
                  }}
                  className={`mt-auto block rounded-xl px-4 py-3 text-center text-[14px] font-extrabold transition ${
                    p.highlight || isSelected
                      ? 'bg-[#2563EB] text-white shadow-[0_8px_24px_rgba(59,130,246,.4)] hover:bg-blue-500 hover:shadow-[0_10px_32px_rgba(34,211,238,.4)]'
                      : 'border border-white/[0.08] text-[#F1F5F9] hover:bg-white/5 hover:border-blue-500/40'
                  }`}
                >
                  {ctaLabel} →
                </a>
                {/* Push #104 — trial reassurance microcopy under paid CTAs. */}
                {isPaid && (
                  <p className="mt-2 text-center text-[12px] font-semibold text-[#94A3B8]">
                    No charge for 7 days
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Push #097 — Guarantee row directly under the plan cards.
            Reinforces buyer confidence between the CTA and the comparison
            table below. */}
        <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13.5px] font-bold text-[#F1F5F9]">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[#34D399]">✓</span> Cancel anytime
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[#34D399]">✓</span> Instant access
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[#34D399]">✓</span> Money-back guarantee
          </span>
        </div>

        {/* Push #087 — feature comparison table. Makes the Fast vs.
            Cinematic split explicit so users understand exactly what
            they're paying for at each tier. Scrolls horizontally on
            small viewports so the table never breaks layout. */}
        <div className="mt-16">
          <div className="mb-6 text-center">
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-cyan-400">
              Compare plans
            </div>
            <h2 className="text-balance text-2xl font-black tracking-tight sm:text-3xl text-[#F1F5F9]">
              What you get at each tier
            </h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0B1120]">
            <table className="w-full min-w-[640px] text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="px-5 py-4 text-[11px] font-extrabold uppercase tracking-[.14em] text-[#94A3B8]">
                    Feature
                  </th>
                  <th className="px-5 py-4 text-center text-[11px] font-extrabold uppercase tracking-[.14em] text-[#94A3B8]">
                    Free
                  </th>
                  <th className="px-5 py-4 text-center text-[11px] font-extrabold uppercase tracking-[.14em] text-[#94A3B8]">
                    Basic
                  </th>
                  <th className="px-5 py-4 text-center text-[11px] font-extrabold uppercase tracking-[.14em] text-cyan-400">
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    label: 'Fast Mode (Pexels + AI voiceover)',
                    free: '✅ 2 videos',
                    basic: '✅ 50 / month',
                    pro: '✅ 100 / month',
                  },
                  {
                    label: 'Cinematic Mode (Runway AI)',
                    free: '—',
                    basic: '—',
                    pro: '✅ 1 / month',
                  },
                  {
                    label: 'Render time',
                    free: '~60s',
                    basic: '~60s',
                    pro: '60s or ~5 min',
                  },
                  {
                    label: 'Watermark-free MP4',
                    free: '✅',
                    basic: '✅',
                    pro: '✅',
                  },
                  {
                    label: 'Priority support',
                    free: '—',
                    basic: 'Email',
                    pro: 'Priority',
                  },
                ].map((row) => (
                  <tr key={row.label} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-5 py-3.5 font-semibold text-[#F1F5F9]">{row.label}</td>
                    <td className="px-5 py-3.5 text-center text-[#94A3B8]">{row.free}</td>
                    <td className="px-5 py-3.5 text-center text-[#94A3B8]">{row.basic}</td>
                    <td className="px-5 py-3.5 text-center font-bold text-cyan-300">{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-center text-[12px] text-[#94A3B8]">
            Cinematic Mode uses Runway AI to generate fully synthetic scenes
            — included on Pro as 1 token per month, resets on each renewal.
            Fast Mode stays unlimited within your monthly Fast credits.
          </p>
        </div>

        {/* Push #099 — FAQ accordion. Five evergreen objections lifted from
            support tickets and the homepage CRO copy. Pure client-side
            useState toggle so the page stays static-renderable. */}
        <div className="mt-16">
          <div className="mb-6 text-center">
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-cyan-400">
              FAQ
            </div>
            <h2 className="text-balance text-2xl font-black tracking-tight sm:text-3xl text-[#F1F5F9]">
              💬 Frequently Asked Questions
            </h2>
          </div>

          <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0B1120]">
            {FAQS.map((item, i) => {
              const isOpen = openFaq === i
              return (
                <div
                  key={item.q}
                  className="border-b border-white/[0.06] last:border-0"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[.02]"
                  >
                    <span className="text-[14.5px] font-bold text-[#F1F5F9]">
                      {item.q}
                    </span>
                    <span
                      aria-hidden
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.08] text-cyan-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-45' : ''
                      }`}
                      style={{ fontSize: 16, lineHeight: 1 }}
                    >
                      +
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 -mt-1">
                      <p className="text-[13.5px] leading-relaxed text-[#94A3B8]">
                        {item.a}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <p className="mt-5 text-center text-[12.5px] text-[#94A3B8]">
            Still have questions?{' '}
            <a
              href="mailto:hello@shortsforgeai.com"
              className="font-bold text-cyan-400 hover:text-cyan-300"
            >
              Email us →
            </a>
          </p>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="relative z-10 border-t border-white/[0.08]">
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
          <p className="text-[11.5px] text-[#94A3B8]">© 2026 ShortsForgeAI</p>
        </div>
      </footer>
    </div>
  )
}
