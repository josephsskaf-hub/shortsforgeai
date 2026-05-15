'use client'

// Push #072 — Targeted cleanup of the #071 redesign.
// - Top-nav center links: Features / Templates / Examples / Thumbnail / Pricing
// - Right side: Dashboard (logged in) or Sign In + Start Free
// - Feature strip trimmed to 3 real, link-driven items
// - "Everything you need" section rewritten with 6 real, link-driven cards
// - Accent recolored from purple/blue to amber/gold (#F5B23B) for CTAs,
//   borders, badges; backgrounds stay dark, the ⚡ logo gradient is kept
//   as-is.

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STRIPE_LINKS = {
  basic: 'https://buy.stripe.com/fZu8wP24tePZbareNggjC0n',
  pro: 'https://buy.stripe.com/8x214nbF323ddizcF8gjC0o',
}

const THUMBNAIL_ROUTE = '/thumbnail-generator'

// Compact 3-item strip: each is a real link to a real route.
const FEATURE_STRIP = [
  { icon: '🎬', label: 'Templates',          href: '/templates' },
  { icon: '🖼️', label: 'Thumbnail',          href: THUMBNAIL_ROUTE },
  { icon: '📈', label: 'Viral Intelligence', href: '/generate' },
]

const SOCIAL_PROOF = [
  { title: 'Generate videos with captions', body: 'Vertical MP4s with burned-in captions, ready to upload.' },
  { title: 'Analyze hooks before rendering', body: 'See the hook, structure, and pacing before you spend a credit.' },
  { title: 'Credits charged only on success', body: 'Failed generations never consume credits.' },
  { title: 'Templates for proven formats', body: 'Start from styles that already perform on Shorts and Reels.' },
]

// 6 real, link-driven cards — every card points to a live route.
const FEATURES: { icon: string; title: string; body: string; href: string }[] = [
  { icon: '📐', title: 'Templates',          body: 'Start from proven video formats.',                  href: '/templates' },
  { icon: '🖼️', title: 'Thumbnail Generator', body: 'Create AI thumbnails for stronger hooks.',          href: THUMBNAIL_ROUTE },
  { icon: '⚡', title: 'Viral Intelligence', body: 'Score your idea before spending credits.',          href: '/generate' },
  { icon: '🎬', title: 'My Videos',          body: 'Save, reopen and download your generated videos.', href: '/my-videos' },
  { icon: '🎯', title: 'Examples',           body: 'See what others have created with ShortsForgeAI.', href: '/examples' },
  { icon: '💳', title: 'Pricing',            body: 'Choose the plan that fits your workflow.',         href: '/pricing' },
]

const TEMPLATES = [
  {
    emoji: '🛸',
    title: 'Space Mystery',
    body: 'Dark, cinematic explorations of unexplained signals from deep space.',
    prompt: 'Create a mysterious cinematic YouTube Short about a strange signal coming from deep space.',
  },
  {
    emoji: '📜',
    title: 'History Facts',
    body: 'Strange historical facts that sound fake but really happened.',
    prompt: 'Create a cinematic YouTube Short about 5 strange history facts that sound fake but are real.',
  },
  {
    emoji: '🌍',
    title: 'Hidden Places',
    body: 'Secret locations on Earth that look like they belong on another planet.',
    prompt: 'Create a cinematic YouTube Short about 5 hidden places on Earth that look impossible.',
  },
  {
    emoji: '🕵️',
    title: 'Cold Cases',
    body: 'Famous unsolved mysteries told as tight cinematic shorts.',
    prompt: 'Create a cinematic YouTube Short about a famous unsolved mystery that was never explained.',
  },
  {
    emoji: '🦑',
    title: 'Weird Animals',
    body: "Nature's strangest creatures and their unbelievable abilities.",
    prompt: "Create a cinematic YouTube Short about 5 animals that look like they shouldn't exist.",
  },
  {
    emoji: '💰',
    title: 'Money Psychology',
    body: 'Money truths that change how you think about wealth.',
    prompt: 'Create a cinematic YouTube Short about 5 money facts that will change how you think about wealth.',
  },
]

const HOW_IT_WORKS = [
  { step: '1', title: 'Enter your idea', body: 'A single sentence is enough — the AI handles the rest.' },
  { step: '2', title: 'AI builds hook, scenes, captions', body: 'Complete story arc from hook to payoff, before you render.' },
  { step: '3', title: 'Generate your AI Short', body: 'Voiceover, captions and visuals stitched into a vertical MP4.' },
  { step: '4', title: 'Download and post', body: 'Ready for YouTube Shorts, TikTok and Instagram Reels.' },
]

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
    <div className="min-h-screen bg-[#080808] text-white font-sans">
      {/* Subtle dark background — gold accent does the work, not big glows */}
      <div
        aria-hidden
        className="pointer-events-none fixed -top-[300px] -right-[200px] h-[800px] w-[800px] rounded-full opacity-[0.05]"
        style={{ background: '#F5B23B', filter: 'blur(140px)' }}
      />

      {/* ───────── Top Nav ───────── */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#080808]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#a855f7] text-lg shadow-[0_0_18px_rgba(124,58,237,.55)]">
              ⚡
            </div>
            <span className="text-[15px] font-extrabold tracking-tight">
              ShortsForgeAI
            </span>
          </Link>

          {/* Center links — desktop */}
          <div className="hidden items-center gap-7 md:flex">
            <a href="#features" className="text-sm font-medium text-white/70 hover:text-white transition">Features</a>
            <Link href="/templates" className="text-sm font-medium text-white/70 hover:text-white transition">Templates</Link>
            <Link href="/examples" className="text-sm font-medium text-white/70 hover:text-white transition">Examples</Link>
            <Link href={THUMBNAIL_ROUTE} className="text-sm font-medium text-white/70 hover:text-white transition">Thumbnail</Link>
            <a href="#pricing" className="text-sm font-medium text-white/70 hover:text-white transition">Pricing</a>
          </div>

          {/* Right side */}
          <div className="hidden items-center gap-2 md:flex">
            {!authChecked ? (
              <div aria-hidden className="h-9 w-36" />
            ) : user ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-[#F5B23B] px-4 py-2 text-sm font-bold text-[#1a1100] shadow-[0_4px_18px_rgba(245,178,59,.35)] transition hover:bg-[#FFD166] hover:shadow-[0_6px_24px_rgba(245,178,59,.5)]"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white/80 transition hover:text-white"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-[#F5B23B] px-4 py-2 text-sm font-bold text-[#1a1100] shadow-[0_4px_18px_rgba(245,178,59,.35)] transition hover:bg-[#FFD166] hover:shadow-[0_6px_24px_rgba(245,178,59,.5)]"
                >
                  Start Free
                </Link>
              </>
            )}
          </div>

          {/* Mobile right side: persistent CTA + hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            {authChecked && user ? (
              <Link
                href="/dashboard"
                className="rounded-lg bg-[#F5B23B] px-3 py-2 text-[13px] font-bold text-[#1a1100] shadow-[0_4px_14px_rgba(245,178,59,.35)]"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/signup"
                className="rounded-lg bg-[#F5B23B] px-3 py-2 text-[13px] font-bold text-[#1a1100] shadow-[0_4px_14px_rgba(245,178,59,.35)]"
              >
                Start Free
              </Link>
            )}
            <button
              type="button"
              aria-label="Toggle navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.12] text-white/80 hover:text-white"
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
          <div className="md:hidden border-t border-white/[0.08] bg-[#080808]/95 backdrop-blur-xl">
            <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
              <a onClick={() => setNavOpen(false)} href="#features" className="rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/[.04] hover:text-white">Features</a>
              <Link onClick={() => setNavOpen(false)} href="/templates" className="rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/[.04] hover:text-white">Templates</Link>
              <Link onClick={() => setNavOpen(false)} href="/examples" className="rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/[.04] hover:text-white">Examples</Link>
              <Link onClick={() => setNavOpen(false)} href={THUMBNAIL_ROUTE} className="rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/[.04] hover:text-white">Thumbnail</Link>
              <a onClick={() => setNavOpen(false)} href="#pricing" className="rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/[.04] hover:text-white">Pricing</a>
              {authChecked && user ? (
                <Link onClick={() => setNavOpen(false)} href="/dashboard" className="rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/[.04] hover:text-white">Dashboard</Link>
              ) : (
                <Link onClick={() => setNavOpen(false)} href="/login" className="rounded-md px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/[.04] hover:text-white">Sign In</Link>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ───────── Hero ───────── */}
      <section className="relative z-10 mx-auto max-w-3xl px-4 pt-14 pb-8 text-center sm:pt-20 sm:pb-12">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#F5B23B]/30 bg-[#F5B23B]/[.08] px-3 py-1.5 text-[12px] font-semibold text-[#F5B23B]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#F5B23B] shadow-[0_0_8px_#F5B23B]" />
          AI video generator · YouTube Shorts ready
        </div>

        <h1 className="text-balance text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
          Create{' '}
          <span className="bg-gradient-to-br from-[#FFD166] via-[#F5B23B] to-[#D9941F] bg-clip-text text-transparent">
            AI Shorts
          </span>{' '}
          from one idea.
        </h1>

        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-[#A1A1AA] sm:text-base">
          Generate vertical videos with voiceover, captions, visuals and
          download-ready MP4s for YouTube Shorts, TikTok and Reels.
        </p>

        {/* Idea input */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            goToGenerate()
          }}
          className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#111111]/85 p-3 shadow-[0_18px_50px_rgba(0,0,0,.5),0_0_0_1px_rgba(245,178,59,.10)_inset] sm:flex-row sm:items-center sm:gap-2 sm:p-2.5"
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Describe your video idea…"
            maxLength={500}
            className="flex-1 rounded-xl bg-transparent px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="shrink-0 rounded-xl bg-[#F5B23B] px-5 py-3 text-sm font-bold text-[#1a1100] shadow-[0_8px_24px_rgba(245,178,59,.35)] transition hover:bg-[#FFD166] hover:shadow-[0_10px_30px_rgba(245,178,59,.5)] disabled:opacity-60"
          >
            {submitting ? 'Loading…' : 'Analyze Idea →'}
          </button>
        </form>

        {/* CTAs */}
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => goToGenerate()}
            className="w-full rounded-xl bg-[#F5B23B] px-6 py-3.5 text-sm font-extrabold text-[#1a1100] shadow-[0_8px_28px_rgba(245,178,59,.4)] transition hover:bg-[#FFD166] hover:shadow-[0_10px_36px_rgba(245,178,59,.55)] sm:w-auto"
          >
            Generate your first video
          </button>
          <Link
            href="/examples"
            className="w-full rounded-xl border border-white/[0.12] px-6 py-3.5 text-center text-sm font-bold text-white/85 transition hover:border-white/[0.2] hover:text-white sm:w-auto"
          >
            See examples
          </Link>
        </div>
      </section>

      {/* ───────── Feature strip (3 compact link tiles) ───────── */}
      <section className="relative z-10 border-y border-white/[0.06] bg-[#0c0c0c]/60">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {FEATURE_STRIP.map((f) => (
              <li key={f.label}>
                <Link
                  href={f.href}
                  className="flex items-center gap-2.5 rounded-lg border border-white/[0.08] bg-[#111111]/70 px-4 py-3 transition hover:border-[#F5B23B]/35 hover:bg-[#F5B23B]/[0.04]"
                >
                  <span className="text-base">{f.icon}</span>
                  <span className="text-[13px] font-semibold text-white/80">
                    {f.label}
                  </span>
                  <span className="ml-auto text-[12px] font-bold text-[#F5B23B]">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── Social proof ───────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-16 pb-6 sm:px-6">
        <p className="text-center text-[15px] font-medium text-[#A1A1AA]">
          Built for faceless creators, Shorts channels and AI video workflows.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SOCIAL_PROOF.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-white/[0.08] bg-[#111111]/70 p-5 transition hover:border-[#F5B23B]/30"
            >
              <div className="text-[14px] font-bold text-white">{s.title}</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── Features ("Everything you need") ───────── */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-4 pt-16 pb-8 sm:px-6">
        <div className="mb-10 text-center">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#F5B23B]">
            Features
          </div>
          <h2 className="text-balance text-3xl font-black tracking-tight sm:text-4xl">
            Everything you need to create Shorts faster.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Link
              key={f.title}
              href={f.href}
              className="group flex flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#121212] to-[#0e0e0e] p-6 transition hover:border-[#F5B23B]/45 hover:shadow-[0_0_30px_rgba(245,178,59,.12)]"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5B23B]/[.12] text-lg ring-1 ring-[#F5B23B]/30">
                {f.icon}
              </div>
              <div className="text-[15px] font-bold text-white">{f.title}</div>
              <p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-white/60">
                {f.body}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-bold text-[#F5B23B] transition group-hover:text-[#FFD166]">
                Open <span aria-hidden>→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ───────── Templates ───────── */}
      <section id="templates" className="relative z-10 mx-auto max-w-6xl px-4 pt-16 pb-8 sm:px-6">
        <div className="mb-10 text-center">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#F5B23B]">
            Templates
          </div>
          <h2 className="text-balance text-3xl font-black tracking-tight sm:text-4xl">
            Start from a proven style.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[14px] text-white/55">
            Pick a template — the AI fills in the hook, scenes, captions and voiceover.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <div
              key={t.title}
              className="flex flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#121212] to-[#0e0e0e] p-6 transition hover:border-[#F5B23B]/45 hover:shadow-[0_0_30px_rgba(245,178,59,.12)]"
            >
              <div className="mb-3 flex items-center gap-2.5">
                <span className="text-2xl leading-none">{t.emoji}</span>
                <span className="text-[15px] font-bold text-white">{t.title}</span>
              </div>
              <p className="text-[13.5px] leading-relaxed text-white/60">{t.body}</p>
              <button
                type="button"
                onClick={() => goToGenerate(t.prompt)}
                className="mt-5 inline-flex w-fit items-center gap-1.5 rounded-full border border-[#F5B23B]/40 bg-[#F5B23B]/[.10] px-3.5 py-1.5 text-[12.5px] font-bold text-[#F5B23B] transition hover:bg-[#F5B23B]/[.18] hover:text-[#FFD166]"
              >
                Use this style →
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── How it works ───────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-16 pb-8 sm:px-6">
        <div className="mb-10 text-center">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#F5B23B]">
            How it works
          </div>
          <h2 className="text-balance text-3xl font-black tracking-tight sm:text-4xl">
            One idea → one ready-to-post AI Short.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((s) => (
            <div
              key={s.step}
              className="rounded-2xl border border-white/[0.08] bg-[#111111]/70 p-6"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#F5B23B] text-sm font-black text-[#1a1100] shadow-[0_4px_18px_rgba(245,178,59,.35)]">
                {s.step}
              </div>
              <div className="text-[14.5px] font-bold text-white">{s.title}</div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── Pricing ───────── */}
      <section id="pricing" className="relative z-10 mx-auto max-w-5xl px-4 pt-16 pb-8 sm:px-6">
        <div className="mb-10 text-center">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#F5B23B]">
            Pricing
          </div>
          <h2 className="text-balance text-3xl font-black tracking-tight sm:text-4xl">
            Simple, credit-based pricing.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[14px] text-white/55">
            Two paid plans, 50% off the first month. Failed generations never consume credits.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {PRICING.map((p) => (
            <div
              key={p.tier}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                p.highlight
                  ? 'border-[#F5B23B]/55 bg-gradient-to-b from-[#1e1605] to-[#0f0c05] shadow-[0_0_40px_rgba(245,178,59,.15)]'
                  : 'border-white/[0.08] bg-[#111111]/70'
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#F5B23B] px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-[#1a1100] shadow-[0_4px_18px_rgba(245,178,59,.45)]">
                  Best Value
                </div>
              )}
              <div className="text-[11px] font-extrabold uppercase tracking-[.14em] text-white/55">
                {p.name}
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-[2.4rem] font-black leading-none tracking-tight text-white">
                  {p.price}
                </span>
              </div>
              <div className="mt-1 text-[12.5px] font-semibold text-[#F5B23B]">
                {p.priceSub}
              </div>
              <ul className="mt-5 mb-6 flex flex-col gap-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13.5px] text-white/75">
                    <span className="mt-[3px] text-[#F5B23B]">✓</span>
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
                    ? 'bg-[#F5B23B] text-[#1a1100] shadow-[0_8px_24px_rgba(245,178,59,.4)] hover:bg-[#FFD166] hover:shadow-[0_10px_32px_rgba(245,178,59,.55)]'
                    : 'border border-white/[0.12] text-white hover:border-[#F5B23B]/45 hover:text-[#F5B23B]'
                }`}
              >
                {p.cta.label} →
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="relative z-10 mt-16 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#a855f7] text-sm">
              ⚡
            </div>
            <span className="text-[13px] font-bold text-white/80">ShortsForgeAI</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link href="/" className="text-[12.5px] font-medium text-white/55 hover:text-white">Home</Link>
            <Link href="/templates" className="text-[12.5px] font-medium text-white/55 hover:text-white">Templates</Link>
            <Link href="/examples" className="text-[12.5px] font-medium text-white/55 hover:text-white">Examples</Link>
            <Link href={THUMBNAIL_ROUTE} className="text-[12.5px] font-medium text-white/55 hover:text-white">Thumbnail</Link>
            <Link href="/pricing" className="text-[12.5px] font-medium text-white/55 hover:text-white">Pricing</Link>
            <Link href="/login" className="text-[12.5px] font-medium text-white/55 hover:text-white">Sign In</Link>
          </div>
          <p className="text-[11.5px] text-white/40">© 2026 ShortsForgeAI</p>
        </div>
      </footer>
    </div>
  )
}
