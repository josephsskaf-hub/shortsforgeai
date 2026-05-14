'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

// Push #062 — Landing page overhaul. The hero, trust strip, "How it
// works", examples grid, launch offer, and social-proof line are all
// driven by simple static arrays below. The Generate Video card stays as
// the primary CTA — it forwards the prompt to /generate via
// sessionStorage rather than running its own pipeline.
//
// Push #061 — fires a `homepage_view` event on mount so /admin/funnel can
// count top-of-funnel impressions.

const PENDING_PROMPT_KEY = 'pendingVideoPrompt'

const LOADING_STEPS = [
  'Analyzing viral hook…',
  'Building retention structure…',
  'Generating cinematic scenes…',
  'Optimizing short pacing…',
]

const TRUST_POINTS = [
  'No editing skills needed',
  'English voiceover + captions included',
  'Download ready-to-post MP4',
  'Credits charged only on success',
  'Works for YouTube Shorts, TikTok and Instagram Reels',
]

const HOW_IT_WORKS = [
  { step: '1', title: 'Enter your video idea', body: 'A single sentence is enough — the AI handles the rest.' },
  { step: '2', title: 'AI creates hook, scenes, voiceover and captions', body: 'A complete story arc from hook to payoff.' },
  { step: '3', title: 'Generate your AI Short', body: 'Voiceover, captions and visuals are stitched into a vertical MP4.' },
  { step: '4', title: 'Download and post', body: 'Ready for YouTube Shorts, TikTok and Instagram Reels.' },
]

interface LandingExample {
  key: string
  title: string
  description: string
  prompt: string
  emoji: string
}

const LANDING_EXAMPLES: LandingExample[] = [
  {
    key: 'space',
    emoji: '🛸',
    title: 'Space Mystery',
    description: 'Dark, cinematic explorations of unexplained signals from deep space.',
    prompt: 'Create a mysterious cinematic YouTube Short about a strange signal coming from deep space.',
  },
  {
    key: 'history',
    emoji: '📜',
    title: 'History Facts',
    description: 'Strange historical facts that sound fake but really happened.',
    prompt: 'Create a cinematic YouTube Short about 5 strange history facts that sound fake but are real.',
  },
  {
    key: 'places',
    emoji: '🌍',
    title: 'Hidden Places',
    description: 'Secret locations on Earth that look like they belong on another planet.',
    prompt: 'Create a cinematic YouTube Short about 5 hidden places on Earth that look impossible.',
  },
  {
    key: 'cold-case',
    emoji: '🕵️',
    title: 'Cold Case',
    description: 'A famous unsolved mystery told as a tight cinematic short.',
    prompt: 'Create a cinematic YouTube Short about a famous unsolved mystery that was never explained.',
  },
  {
    key: 'animals',
    emoji: '🦑',
    title: 'Weird Facts',
    description: 'Nature’s strangest creatures and their unbelievable abilities.',
    prompt: "Create a cinematic YouTube Short about 5 animals that look like they shouldn't exist.",
  },
  {
    key: 'money',
    emoji: '💰',
    title: 'Money Psychology',
    description: 'Money truths that change how you think about wealth.',
    prompt: 'Create a cinematic YouTube Short about 5 money facts that will change how you think about wealth.',
  },
]

const STRIPE_LINKS = {
  basic: 'https://buy.stripe.com/fZu8wP24tePZbareNggjC0n',
  pro: 'https://buy.stripe.com/8x214nbF323ddizcF8gjC0o',
}

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

export default function HomePage() {
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const [user, setUser] = useState<{ id: string } | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [isPro, setIsPro] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  const [prompt, setPrompt] = useState('')
  const [loaderStep, setLoaderStep] = useState<number>(-1)

  // Push #061 — single homepage_view event on first mount.
  useEffect(() => {
    trackHomepageEvent('homepage_view')
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        setUser({ id: user.id })
        setUserEmail(user.email ?? '')
        const { data } = await supabase
          .from('profiles')
          .select('is_pro')
          .eq('id', user.id)
          .single()
        setIsPro(data?.is_pro ?? false)
      } else {
        setUser(null)
      }
      setAuthChecked(true)
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(min-width: 768px)').matches) {
      textareaRef.current?.focus()
    }
  }, [])

  function handleAnalyze() {
    if (loaderStep >= 0) return
    const trimmed = prompt.trim()
    try {
      if (trimmed) sessionStorage.setItem(PENDING_PROMPT_KEY, trimmed)
      else sessionStorage.removeItem(PENDING_PROMPT_KEY)
    } catch {
      // sessionStorage can throw in private mode — fall through to the
      // redirect anyway so the user can still type their idea on /generate.
    }

    setLoaderStep(0)
    const stepMs = 280
    const dest = user ? '/generate' : `/login?redirect=${encodeURIComponent('/generate')}`
    LOADING_STEPS.forEach((_, i) => {
      setTimeout(() => setLoaderStep(i), i * stepMs)
    })
    setTimeout(() => router.push(dest), LOADING_STEPS.length * stepMs)
  }

  function trackCheckoutClick(tier: 'basic' | 'pro') {
    trackHomepageEvent(tier === 'basic' ? 'basic_checkout_clicked' : 'pro_checkout_clicked')
  }

  return (
    <div style={{ display: 'flex', background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="hidden md:block flex-shrink-0" style={{ width: 248 }} />

      <div className="hidden md:block">
        <Sidebar
          userEmail={userEmail}
          isPro={isPro}
          generationsUsed={0}
          isLoggedIn={!!user}
          isOpen={true}
          onClose={() => {}}
        />
      </div>

      <div className="flex-1 min-w-0" style={{ color: 'var(--text)', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {/* Background glows */}
        <div className="fixed pointer-events-none" style={{ width: 800, height: 800, background: 'var(--indigo)', top: -300, right: -200, opacity: 0.045, filter: 'blur(120px)', borderRadius: '50%', zIndex: 0 }} />
        <div className="fixed pointer-events-none" style={{ width: 600, height: 600, background: 'var(--purple)', bottom: -200, left: -100, opacity: 0.04, filter: 'blur(100px)', borderRadius: '50%', zIndex: 0 }} />

        {/* ─── Nav ─── */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 64, borderBottom: '1px solid var(--border)', background: 'rgba(8,8,15,.9)', backdropFilter: 'blur(24px)' }}>
          <Link href={user ? '/generate' : '/'} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #2563EB, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', boxShadow: '0 0 20px rgba(99,102,241,.5)' }}>⚡</div>
            <span style={{ fontWeight: 900, fontSize: '0.95rem', background: 'linear-gradient(135deg, #3B82F6, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ShortsForgeAI</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!authChecked ? (
              <div style={{ width: 160, height: 36 }} aria-hidden="true" />
            ) : user ? (
              <Link href="/generate" style={{ padding: '8px 20px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 800, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #2563EB, #7c3aed)', boxShadow: '0 4px 18px rgba(99,102,241,.4)' }}>Open App</Link>
            ) : (
              <>
                <Link href="/login" style={{ padding: '8px 16px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted2)', textDecoration: 'none', border: '1px solid var(--border)' }}>Sign In</Link>
                <Link href="/signup" style={{ padding: '8px 20px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 800, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #2563EB, #7c3aed)', boxShadow: '0 4px 18px rgba(99,102,241,.4)' }}>Start Free</Link>
              </>
            )}
          </div>
        </nav>

        {/* ─── Hero ─── */}
        <section style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: 'clamp(28px, 6vw, 56px) 20px 18px', maxWidth: 820, margin: '0 auto' }}>
          <h1 style={{ fontSize: 'clamp(2rem, 6.4vw, 3.4rem)', fontWeight: 900, lineHeight: 1.04, letterSpacing: '-0.035em', margin: '0 auto 14px', maxWidth: 760 }}>
            Create{' '}
            <span style={{ background: 'linear-gradient(135deg, #3B82F6, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              AI Shorts
            </span>{' '}
            with voiceover, captions and visuals.
          </h1>

          <p style={{ fontSize: '1rem', color: 'var(--muted2)', maxWidth: 580, margin: '0 auto', lineHeight: 1.55 }}>
            Turn one idea into a ready-to-post vertical video for YouTube Shorts, TikTok and Reels.
          </p>
        </section>

        {/* ─── Generate Video Card ─── */}
        <section style={{ position: 'relative', zIndex: 10, padding: '0 16px 16px', maxWidth: 820, margin: '0 auto' }}>
          <div
            className="hero-card"
            style={{
              background: 'rgba(15,15,30,0.85)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              padding: 'clamp(18px, 4vw, 24px)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(99,102,241,0.08) inset',
            }}
          >
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleAnalyze()
                }
              }}
              placeholder="Type a simple idea like: 5 ocean mysteries no one can explain"
              maxLength={1000}
              disabled={loaderStep >= 0}
              className="hero-prompt-textarea"
              style={{
                width: '100%',
                minHeight: 160,
                background: 'rgba(0,0,0,.3)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                outline: 'none',
                resize: 'none',
                borderRadius: 12,
                padding: '14px 16px',
                fontSize: '1rem',
                lineHeight: 1.55,
                fontFamily: 'inherit',
              }}
            />

            {loaderStep >= 0 && (
              <div
                className="staged-loader"
                aria-live="polite"
                style={{
                  marginTop: 14,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'rgba(37,99,235,.08)',
                  border: '1px solid rgba(37,99,235,.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: '2px solid rgba(147,197,253,.25)',
                    borderTopColor: '#93c5fd',
                    animation: 'sf-spin 0.9s linear infinite',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#93c5fd', letterSpacing: '-0.005em' }}>
                  {LOADING_STEPS[Math.min(loaderStep, LOADING_STEPS.length - 1)]}
                </span>
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={!prompt.trim() || loaderStep >= 0}
              className="hero-cta"
              style={{
                marginTop: 14,
                width: '100%',
                padding: '16px 24px',
                borderRadius: 14,
                fontSize: '1rem',
                fontWeight: 900,
                color: prompt.trim() && loaderStep < 0 ? '#fff' : 'var(--muted)',
                background:
                  prompt.trim() && loaderStep < 0
                    ? 'linear-gradient(135deg, #2563EB 0%, #7c3aed 55%, #a855f7 100%)'
                    : 'rgba(255,255,255,.04)',
                border: 'none',
                cursor: prompt.trim() && loaderStep < 0 ? 'pointer' : 'not-allowed',
                boxShadow: prompt.trim() && loaderStep < 0 ? '0 10px 32px rgba(99,102,241,.45)' : 'none',
                letterSpacing: '-0.01em',
              }}
            >
              {loaderStep >= 0 ? 'Working…' : 'Generate your first AI Short'}
            </button>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
              <Link
                href="/examples"
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#93c5fd',
                  textDecoration: 'none',
                }}
              >
                See examples →
              </Link>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                No editing skills needed.
              </span>
            </div>
          </div>
          <style>{`
            .hero-prompt-textarea::placeholder { color: rgba(255,255,255,.40); }
            @keyframes sf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @media (max-width: 640px) {
              .hero-prompt-textarea { min-height: 140px !important; font-size: 1rem !important; }
              .hero-cta { padding: 18px 24px !important; font-size: 1.05rem !important; }
            }
          `}</style>
        </section>

        {/* ─── Trust strip ─── */}
        <section style={{ position: 'relative', zIndex: 10, padding: '12px 16px 4px', maxWidth: 1080, margin: '0 auto' }}>
          <ul
            className="trust-grid"
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gap: 10,
            }}
          >
            {TRUST_POINTS.map((point) => (
              <li
                key={point}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: '0.82rem',
                  color: 'var(--muted2)',
                  fontWeight: 600,
                  background: 'rgba(15,15,30,0.55)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '8px 12px',
                  lineHeight: 1.3,
                }}
              >
                <span style={{ color: '#34d399', fontWeight: 900, flexShrink: 0 }}>✓</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <style>{`
            .trust-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
            @media (max-width: 980px) { .trust-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
            @media (max-width: 460px) { .trust-grid { grid-template-columns: 1fr; } }
          `}</style>
        </section>

        {/* ─── How it works ─── */}
        <section style={{ position: 'relative', zIndex: 10, padding: '32px 16px 12px', maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.14em', color: 'var(--indigo-light)', textTransform: 'uppercase', marginBottom: 8 }}>
              How it works
            </div>
            <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text)', margin: 0 }}>
              One idea → one ready-to-post AI Short.
            </h2>
          </div>
          <div
            className="hiw-grid"
            style={{
              display: 'grid',
              gap: 12,
            }}
          >
            {HOW_IT_WORKS.map((step) => (
              <div
                key={step.step}
                style={{
                  background: 'rgba(15,15,30,0.85)',
                  border: '1px solid var(--border)',
                  borderRadius: 16,
                  padding: '18px 20px',
                  minHeight: 130,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #2563EB, #7c3aed)',
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: '0.95rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 10,
                    boxShadow: '0 4px 18px rgba(99,102,241,.35)',
                  }}
                >
                  {step.step}
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text)', marginBottom: 4, letterSpacing: '-0.01em' }}>
                  {step.title}
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--muted2)', margin: 0, lineHeight: 1.5 }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
          <style>{`
            .hiw-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
            @media (max-width: 920px) { .hiw-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
            @media (max-width: 460px) { .hiw-grid { grid-template-columns: 1fr; } }
          `}</style>
        </section>

        {/* ─── Examples ─── */}
        <section style={{ position: 'relative', zIndex: 10, padding: '32px 16px 12px', maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.14em', color: 'var(--indigo-light)', textTransform: 'uppercase', marginBottom: 8 }}>
              Examples you can create
            </div>
            <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text)', margin: 0 }}>
              Pick a style — the AI handles the rest.
            </h2>
          </div>
          <div
            className="ex-grid"
            style={{
              display: 'grid',
              gap: 12,
            }}
          >
            {LANDING_EXAMPLES.map((ex) => (
              <div
                key={ex.key}
                style={{
                  background: 'rgba(15,15,30,0.85)',
                  border: '1px solid var(--border)',
                  borderRadius: 16,
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{ex.emoji}</span>
                  <span style={{ fontSize: '0.98rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.01em' }}>{ex.title}</span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--muted2)', margin: 0, lineHeight: 1.5 }}>
                  {ex.description}
                </p>
                <Link
                  href={`/generate?prompt=${encodeURIComponent(ex.prompt)}`}
                  style={{
                    marginTop: 'auto',
                    alignSelf: 'flex-start',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    color: '#93c5fd',
                    background: 'rgba(37,99,235,.10)',
                    border: '1px solid rgba(37,99,235,.30)',
                    padding: '6px 12px',
                    borderRadius: 999,
                    textDecoration: 'none',
                  }}
                >
                  Use this style →
                </Link>
              </div>
            ))}
          </div>
          <style>{`
            .ex-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            @media (max-width: 900px) { .ex-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
            @media (max-width: 520px) { .ex-grid { grid-template-columns: 1fr; } }
          `}</style>
        </section>

        {/* ─── Launch offer ─── */}
        <section style={{ position: 'relative', zIndex: 10, padding: '32px 16px 16px', maxWidth: 980, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div
              style={{
                display: 'inline-block',
                fontSize: '0.65rem',
                fontWeight: 800,
                letterSpacing: '0.14em',
                color: '#fbbf24',
                textTransform: 'uppercase',
                background: 'rgba(251,191,36,.10)',
                border: '1px solid rgba(251,191,36,.30)',
                padding: '6px 12px',
                borderRadius: 999,
                marginBottom: 12,
              }}
            >
              Limited launch offer
            </div>
            <h2 style={{ fontSize: 'clamp(1.5rem, 4.4vw, 2.2rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text)', margin: 0 }}>
              50% off your first month.
            </h2>
            <p style={{ fontSize: '0.92rem', color: 'var(--muted2)', maxWidth: 520, margin: '10px auto 0', lineHeight: 1.5 }}>
              Two plans. Both include the launch offer. Failed generations never consume credits.
            </p>
          </div>

          <div className="lo-grid" style={{ display: 'grid', gap: 16 }}>
            <PlanOfferCard
              tier="basic"
              name="Basic"
              firstPrice="$4.50"
              renew="then $9/month"
              features={[
                '140 credits / month',
                '≈9 videos / month',
                '15 credits per Basic video',
                'Email support',
              ]}
              ctaLabel="Start Basic"
              href={STRIPE_LINKS.basic}
              onClick={() => trackCheckoutClick('basic')}
            />
            <PlanOfferCard
              tier="pro"
              name="Pro"
              firstPrice="$9.50"
              renew="then $19/month"
              features={[
                '350 credits / month',
                '≈17 videos / month',
                '20 credits per Pro video',
                'Better cinematic prompting',
                'Priority support',
              ]}
              ctaLabel="Start Pro"
              href={STRIPE_LINKS.pro}
              onClick={() => trackCheckoutClick('pro')}
              highlight
            />
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--muted)', marginTop: 18, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
            50% off applies to the first month only. Failed generations do not consume credits.
          </p>

          <style>{`
            .lo-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            @media (max-width: 720px) { .lo-grid { grid-template-columns: 1fr; } }
          `}</style>
        </section>

        {/* ─── Social proof ─── */}
        <section style={{ position: 'relative', zIndex: 10, padding: '12px 16px 32px', maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: '0.92rem', color: 'var(--muted2)', margin: 0, lineHeight: 1.55 }}>
            Built for faceless creators, Shorts channels and AI video workflows.
          </p>
        </section>

        {/* ─── Footer ─── */}
        <footer style={{ position: 'relative', zIndex: 10, borderTop: '1px solid var(--border)', padding: '28px 32px', marginTop: 12 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #2563EB, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>⚡</div>
              <span style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--muted2)' }}>ShortsForgeAI</span>
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[
                ['/', 'Home'],
                ['/generate', 'Generate'],
                ['/examples', 'Examples'],
                ['/pricing', 'Pricing'],
                ['/login', 'Sign In'],
              ].map(([href, label]) => (
                <Link key={href} href={href} style={{ fontSize: '0.875rem', color: 'var(--muted)', textDecoration: 'none', fontWeight: 500 }}>{label}</Link>
              ))}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>© 2026 ShortsForgeAI. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  )
}

function PlanOfferCard({
  tier,
  name,
  firstPrice,
  renew,
  features,
  ctaLabel,
  href,
  onClick,
  highlight,
}: {
  tier: 'basic' | 'pro'
  name: string
  firstPrice: string
  renew: string
  features: string[]
  ctaLabel: string
  href: string
  onClick: () => void
  highlight?: boolean
}) {
  return (
    <div
      style={{
        position: 'relative',
        background: highlight
          ? 'linear-gradient(135deg, rgba(37,99,235,.12), rgba(124,58,237,.08))'
          : 'rgba(15,15,30,0.85)',
        border: highlight ? '2px solid rgba(37,99,235,.45)' : '1px solid var(--border)',
        borderRadius: 20,
        padding: 22,
        boxShadow: highlight ? '0 0 50px rgba(37,99,235,.18)' : '0 0 24px rgba(0,0,0,.25)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {highlight && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: '0.65rem',
            fontWeight: 900,
            color: '#fff',
            background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Best Value
        </div>
      )}

      <div
        style={{
          fontSize: '0.65rem',
          fontWeight: 900,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: highlight ? '#93C5FD' : 'var(--muted)',
          marginBottom: 6,
        }}
      >
        {name}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
        <span style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>
          {firstPrice}
        </span>
        <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>first month</span>
      </div>
      <p style={{ fontSize: '0.78rem', color: '#93C5FD', fontWeight: 700, margin: 0 }}>{renew}</p>

      <ul style={{ listStyle: 'none', padding: 0, margin: '14px 0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {features.map((f) => (
          <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.85rem', color: 'var(--text2)' }}>
            <span style={{ color: '#34d399', fontWeight: 900, marginTop: 2 }}>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <a
        href={href}
        onClick={onClick}
        data-tier={tier}
        style={{
          marginTop: 'auto',
          display: 'block',
          textAlign: 'center',
          textDecoration: 'none',
          background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
          color: '#fff',
          fontWeight: 900,
          fontSize: '0.95rem',
          padding: '14px 18px',
          borderRadius: 14,
          boxShadow: '0 8px 26px rgba(37,99,235,.35)',
        }}
      >
        {ctaLabel} →
      </a>
    </div>
  )
}
