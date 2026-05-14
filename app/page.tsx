'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import PricingCards from '@/components/PricingCards'

// Push #033: video-first landing. The page is visible to BOTH guests and
// logged-in users (the push #032 auto-redirect to /generate was removed
// — the lightning logo in the sidebar handles "jump to the app" for
// logged-in users instead). The Generate Video card on this page is a
// thin shortcut: it forwards the prompt to /generate via sessionStorage
// rather than running its own pipeline.
//
// Push #046 — Conversion Upgrade V1
//   - Stronger hero copy + autofocused, prominent input
//   - Staged "instant feeling" loader between click and redirect
//   - Before/After visual proof section (input vs. output)
//   - Trending Niches social proof section above pricing

const PENDING_PROMPT_KEY = 'pendingVideoPrompt'

const LOADING_STEPS = [
  'Analyzing viral hook…',
  'Building retention structure…',
  'Generating cinematic scenes…',
  'Optimizing short pacing…',
]

const TRENDING_NICHES: { title: string; tag: string; tagColor: string; emoji: string }[] = [
  { title: 'Mystery Videos', tag: '+38% engagement trend', tagColor: '#34d399', emoji: '🛸' },
  { title: 'History Secrets', tag: 'High retention format', tagColor: '#93c5fd', emoji: '📜' },
  { title: 'Strange Facts', tag: 'Fastest to produce', tagColor: '#fbbf24', emoji: '🤯' },
  { title: 'Ocean Mysteries', tag: 'Strong hook potential', tagColor: '#a78bfa', emoji: '🌊' },
]

export default function HomePage() {
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const [user, setUser] = useState<{ id: string } | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [isPro, setIsPro] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  const [prompt, setPrompt] = useState('')

  // Staged-loader state — drives the 4-step "feels like it's working"
  // overlay we show between Analyze click and the /generate redirect.
  const [loaderStep, setLoaderStep] = useState<number>(-1)

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

  // Autofocus the textarea on mount, but only on viewports where it won't
  // pop the mobile keyboard the moment the page loads.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(min-width: 768px)').matches) {
      textareaRef.current?.focus()
    }
  }, [])

  function handleAnalyze() {
    if (loaderStep >= 0) return // already in progress
    const trimmed = prompt.trim()
    try {
      if (trimmed) sessionStorage.setItem(PENDING_PROMPT_KEY, trimmed)
      else sessionStorage.removeItem(PENDING_PROMPT_KEY)
    } catch {
      // sessionStorage can throw in private mode — fall through to the
      // redirect anyway so the user can still type their idea on /generate.
    }

    // Staged loader: 4 steps × ~280ms ≈ 1.1s perceived progress before the
    // actual /generate route takes over. Kept short on purpose so we never
    // make the app feel slower than it already is.
    setLoaderStep(0)
    const stepMs = 280
    const dest = user ? '/generate' : `/login?redirect=${encodeURIComponent('/generate')}`
    LOADING_STEPS.forEach((_, i) => {
      setTimeout(() => setLoaderStep(i), i * stepMs)
    })
    setTimeout(() => router.push(dest), LOADING_STEPS.length * stepMs)
  }

  return (
    <div style={{ display: 'flex', background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Desktop sidebar spacer */}
      <div className="hidden md:block flex-shrink-0" style={{ width: 248 }} />

      {/* Push #052 — wrapped in `hidden md:block` so the fixed 248px aside
          no longer overlays the public homepage on iPhone widths. The top
          <nav> below already provides mobile auth/jump-to-app actions. */}
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
            Turn Any Idea Into a{' '}
            <span style={{ background: 'linear-gradient(135deg, #3B82F6, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Viral Short
            </span>
          </h1>

          <p style={{ fontSize: '1rem', color: 'var(--muted2)', maxWidth: 560, margin: '0 auto', lineHeight: 1.55 }}>
            Generate hooks, scripts, scenes, captions and hashtags for faceless YouTube Shorts in seconds.
          </p>
        </section>

        {/* ─── Generate Video Card ─── */}
        <section style={{ position: 'relative', zIndex: 10, padding: '0 16px 24px', maxWidth: 820, margin: '0 auto' }}>
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
              {loaderStep >= 0 ? 'Working…' : 'Generate My Short'}
            </button>
            <p style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center' }}>
              No editing skills needed. Start with a simple idea.
            </p>
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

        {/* ─── Before / After proof ─── */}
        <section style={{ position: 'relative', zIndex: 10, padding: '20px 16px 8px', maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.14em', color: 'var(--indigo-light)', textTransform: 'uppercase', marginBottom: 10 }}>
              Live Example
            </div>
            <h2 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text)', margin: 0 }}>
              From Simple Idea to Ready-to-Post Short
            </h2>
          </div>

          <div className="ba-grid">
            {/* Input */}
            <div className="ba-card" style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)', borderRadius: 18, padding: '20px 22px' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.14em', color: '#93c5fd', textTransform: 'uppercase', marginBottom: 10 }}>
                Input
              </div>
              <p style={{ fontSize: '1.05rem', color: 'var(--text)', lineHeight: 1.5, fontWeight: 600, margin: 0 }}>
                Ancient ocean mysteries
              </p>
            </div>

            {/* Output */}
            <div className="ba-card" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,.10), rgba(124,58,237,.06))', border: '1px solid rgba(99,102,241,.30)', borderRadius: 18, padding: '20px 22px', boxShadow: '0 0 32px rgba(99,102,241,.10)' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.14em', color: '#a78bfa', textTransform: 'uppercase', marginBottom: 10 }}>
                Output
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Hook</div>
                <p style={{ fontSize: '0.92rem', color: 'var(--text)', lineHeight: 1.5, fontWeight: 700, margin: 0 }}>
                  “Scientists found signals beneath the ocean… and no one can explain them.”
                </p>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Script</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--muted2)', lineHeight: 1.55, margin: 0 }}>
                  Deep below the ocean, strange sounds have been recorded for decades. Some were linked to ice, others to unknown movement. But a few remain unexplained. The deeper we listen, the less we understand.
                </p>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Visual scenes</div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.82rem', color: 'var(--muted2)', lineHeight: 1.55 }}>
                  <li>Dark ocean satellite view</li>
                  <li>Deep-sea sonar animation</li>
                  <li>Mysterious underwater lights</li>
                </ul>
              </div>

              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>CTA</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.5, fontWeight: 600, margin: 0 }}>
                  “Follow for more hidden mysteries.”
                </p>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Hashtags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['#shorts', '#mystery', '#ocean', '#facts'].map((h) => (
                    <span
                      key={h}
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#93c5fd',
                        padding: '3px 10px',
                        borderRadius: 999,
                        background: 'rgba(37,99,235,.12)',
                        border: '1px solid rgba(37,99,235,.30)',
                      }}
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <style>{`
            .ba-grid {
              display: grid;
              grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
              gap: 16px;
              align-items: stretch;
            }
            @media (max-width: 760px) {
              .ba-grid { grid-template-columns: 1fr; gap: 12px; }
            }
          `}</style>
        </section>

        {/* ─── Trending niches / social proof ─── */}
        <section style={{ position: 'relative', zIndex: 10, padding: '32px 16px 8px', maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.14em', color: 'var(--indigo-light)', textTransform: 'uppercase', marginBottom: 6 }}>
                Trending Niches This Week
              </div>
              <h2 style={{ fontSize: 'clamp(1.2rem, 3.4vw, 1.6rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text)', margin: 0 }}>
                What faceless creators are shipping right now
              </h2>
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 14px',
                borderRadius: 999,
                background: 'rgba(52,211,153,.08)',
                border: '1px solid rgba(52,211,153,.28)',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#34d399',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,.6)', display: 'inline-block' }} />
              2,184 shorts generated this week
            </div>
          </div>

          <div className="trending-grid">
            {TRENDING_NICHES.map((n) => (
              <div
                key={n.title}
                style={{
                  background: 'rgba(15,15,30,0.85)',
                  border: '1px solid var(--border)',
                  borderRadius: 16,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  minHeight: 110,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{n.emoji}</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.01em' }}>{n.title}</span>
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: n.tagColor,
                    background: 'rgba(255,255,255,.03)',
                    border: '1px solid rgba(255,255,255,.08)',
                    padding: '4px 10px',
                    borderRadius: 999,
                    alignSelf: 'flex-start',
                  }}
                >
                  {n.tag}
                </span>
              </div>
            ))}
          </div>

          <style>{`
            .trending-grid {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 12px;
            }
            @media (max-width: 900px) { .trending-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
            @media (max-width: 460px) { .trending-grid { grid-template-columns: 1fr; } }
          `}</style>
        </section>

        {/* ─── Pricing ─── */}
        <section style={{ position: 'relative', zIndex: 10, padding: '32px 16px 16px', maxWidth: 1100, margin: '0 auto' }}>
          <PricingCards />
          <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--muted)', marginTop: 18, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
            50% off applies to the first month only. Failed generations do not consume credits.
          </p>
        </section>

        {/* ─── Footer ─── */}
        <footer style={{ position: 'relative', zIndex: 10, borderTop: '1px solid var(--border)', padding: '28px 32px', marginTop: 24 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #2563EB, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>⚡</div>
              <span style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--muted2)' }}>ShortsForgeAI</span>
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[
                ['/', 'Home'],
                ['/generate', 'Generate'],
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
