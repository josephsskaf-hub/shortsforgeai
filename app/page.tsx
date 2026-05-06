'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NicheCard from '@/components/NicheCard'

// ─── Niche data (mirrors dashboard IDs exactly) ───────────────────────────────
const DEFAULT_PILLS = ['🎬 YouTube Shorts', '🔥 High Engagement', '📋 Ready to Copy']

const NICHES_HOME = [
  {
    id: 'money',
    emoji: '💰',
    name: 'Money Facts',
    description: 'Finance niche, top CPM, huge audience & viral potential',
    tags: ['High RPM', 'Finance', 'Monetization'],
    pills: DEFAULT_PILLS,
    badge: 'Popular',
  },
  {
    id: 'mind',
    emoji: '🤯',
    name: 'Mind Blowing Facts',
    description: 'Education niche with massive shareability & saves',
    tags: ['Viral', 'Curiosity', 'Fast Views'],
    pills: DEFAULT_PILLS,
    badge: 'Viral',
  },
  {
    id: 'dark',
    emoji: '😱',
    name: 'Dark Mysteries',
    description: 'Horror & mystery niche that creates binge-watch loops',
    tags: ['Mystery', 'High Retention', 'Suspense'],
    pills: DEFAULT_PILLS,
    badge: 'High Retention',
  },
  {
    id: 'motivation',
    emoji: '🎯',
    name: 'Motivation',
    description: 'Lifestyle niche — save & share magnet, evergreen content',
    tags: ['Evergreen', 'Daily Content', 'Reels/TikTok'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'ancient',
    emoji: '🏛️',
    name: 'Ancient Civilizations',
    description: 'Lost empires, hidden ruins, and forgotten history',
    tags: ['History', 'Viral', 'Mystery'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'space',
    emoji: '🚀',
    name: 'Space Mysteries',
    description: 'Black holes, alien theories & cosmic wonders',
    tags: ['Science', 'Viral', 'Curiosity'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'truecrime',
    emoji: '🔍',
    name: 'True Crime',
    description: 'Real cases that shocked the world',
    tags: ['True Crime', 'High Retention', 'Suspense'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'psychology',
    emoji: '🧠',
    name: 'Psychology Facts',
    description: 'Mind tricks, biases & human behavior',
    tags: ['Psychology', 'Saves', 'Viral'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'business',
    emoji: '💼',
    name: 'Money & Business',
    description: 'Wealth secrets, startups & passive income',
    tags: ['Finance', 'High RPM', 'Viral'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'ai',
    emoji: '🤖',
    name: 'AI & Technology',
    description: 'Future tech, AI breakthroughs & disruption',
    tags: ['Tech', 'Trending', 'Future'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'celebrity',
    emoji: '⭐',
    name: 'Celebrity Secrets',
    description: 'Untold stories behind famous names',
    tags: ['Entertainment', 'Gossip', 'Viral'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'mideast',
    emoji: '🌍',
    name: 'Middle East Secrets',
    description: 'Hidden stories, geopolitics & untold facts from the region',
    tags: ['High RPM', 'Viral', 'Geopolitics'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'darkhistory',
    emoji: '📚',
    name: 'History Facts',
    description: 'Disturbing events and secrets the textbooks skip',
    tags: ['History', 'Shocking', 'Viral'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'health',
    emoji: '🤔',
    name: 'Weird Facts',
    description: 'Strange truths about the world you never expected',
    tags: ['Facts', 'Curiosity', 'Saves'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'luxury',
    emoji: '💎',
    name: 'Luxury Facts',
    description: 'Billionaire habits, ultra-luxury & wealth flex',
    tags: ['Luxury', 'Aspirational', 'Viral'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'science',
    emoji: '🔬',
    name: 'Science Facts',
    description: 'Jaw-dropping discoveries and mind-bending science',
    tags: ['Science', 'Education', 'Viral'],
    pills: DEFAULT_PILLS,
  },
]

const FREE_NICHE_ID = 'money'

// ─── Animated demo card ───────────────────────────────────────────────────────
function LiveDemoCard() {
  const TYPED_TEXT = 'Ancient Rome secrets'
  const [displayed, setDisplayed] = useState('')
  const [phase, setPhase] = useState<'typing' | 'showing' | 'erasing' | 'waiting'>('typing')
  const idxRef = useRef(0)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    if (phase === 'typing') {
      if (idxRef.current < TYPED_TEXT.length) {
        timer = setTimeout(() => {
          idxRef.current += 1
          setDisplayed(TYPED_TEXT.slice(0, idxRef.current))
        }, 72)
      } else {
        timer = setTimeout(() => setPhase('showing'), 1200)
      }
    } else if (phase === 'showing') {
      timer = setTimeout(() => setPhase('erasing'), 3200)
    } else if (phase === 'erasing') {
      if (idxRef.current > 0) {
        timer = setTimeout(() => {
          idxRef.current -= 1
          setDisplayed(TYPED_TEXT.slice(0, idxRef.current))
        }, 38)
      } else {
        timer = setTimeout(() => setPhase('waiting'), 600)
      }
    } else {
      timer = setTimeout(() => setPhase('typing'), 800)
    }
    return () => clearTimeout(timer)
  }, [phase, displayed])

  const outputVisible = phase === 'showing' || phase === 'erasing'

  return (
    <div
      id="demo"
      style={{
        maxWidth: 600,
        margin: '0 auto',
        borderRadius: 24,
        border: '1px solid rgba(99,102,241,.3)',
        background: 'rgba(13,13,28,.9)',
        boxShadow: '0 0 60px rgba(99,102,241,.2), 0 0 0 1px rgba(99,102,241,.1) inset',
        padding: '28px 28px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 400, height: 200, background: 'radial-gradient(ellipse, rgba(99,102,241,.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>⚡</div>
        <span style={{ fontWeight: 900, fontSize: '0.82rem', color: 'var(--muted2)', letterSpacing: '-0.01em' }}>Live Script Preview</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.65rem', fontWeight: 700, color: '#34d399' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px rgba(52,211,153,.6)', display: 'inline-block', animation: 'pulse-dot-demo 1.4s ease-in-out infinite' }} />
          AI LIVE
        </span>
      </div>
      <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(99,102,241,.35)', borderRadius: 12, padding: '12px 16px', fontSize: '0.9rem', color: 'var(--text)', fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, minHeight: 46 }}>
        <span style={{ color: 'var(--indigo-light)', fontSize: '0.75rem', flexShrink: 0 }}>Topic →</span>
        <span style={{ flex: 1 }}>
          {displayed}
          <span style={{ display: 'inline-block', width: 2, height: 16, background: '#818cf8', borderRadius: 2, marginLeft: 1, animation: 'blink-caret 0.9s step-end infinite', verticalAlign: 'middle' }} />
        </span>
      </div>
      <div style={{ display: 'grid', gap: 10, opacity: outputVisible ? 1 : 0, transform: outputVisible ? 'translateY(0)' : 'translateY(8px)', transition: 'opacity 0.5s ease, transform 0.5s ease' }}>
        {[
          { label: '🪝 Hook', value: '"The Roman secret historians tried to erase…"', color: '#818cf8' },
          { label: '🎬 Title', value: '3 Ancient Rome Facts That Sound Fake', color: '#a78bfa' },
          { label: '📦 Format', value: 'Mystery / History Short', color: '#34d399' },
          { label: '#️⃣ Hashtags', value: '#shorts #history #ancientrome #mystery', color: '#60a5fa' },
        ].map((row) => (
          <div key={row.label} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: row.color, minWidth: 72, flexShrink: 0 }}>{row.label}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text2)', lineHeight: 1.4 }}>{row.value}</span>
          </div>
        ))}
      </div>
      {!outputVisible && (
        <div style={{ textAlign: 'center', padding: '10px 0', fontSize: '0.8rem', color: 'var(--muted)', opacity: 0.6 }}>Generating output…</div>
      )}
      <style>{`
        @keyframes blink-caret { 0%,100%{opacity:1}50%{opacity:0} }
        @keyframes pulse-dot-demo { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(0.85)} }
      `}</style>
    </div>
  )
}

// ─── Homepage ─────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter()
  const nicheGridRef = useRef<HTMLDivElement>(null)

  // Auth state
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [isPro, setIsPro] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user ? { id: user.id } : null)
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('is_pro')
          .eq('id', user.id)
          .single()
        setIsPro(data?.is_pro ?? false)
      }
      setAuthChecked(true)
    })
  }, [])

  // Handle niche card CTA click with auth-aware routing
  function handleNicheClick(nicheId: string) {
    if (!user) {
      router.push('/login')
      return
    }
    if (nicheId !== FREE_NICHE_ID && !isPro) {
      router.push('/pricing')
      return
    }
    router.push('/dashboard')
  }

  // Determine if a card should show as locked
  function isCardDisabled(nicheId: string): boolean {
    if (!authChecked) return nicheId !== FREE_NICHE_ID
    if (!user) return nicheId !== FREE_NICHE_ID
    if (isPro) return false
    return nicheId !== FREE_NICHE_ID
  }

  function scrollToGrid(e: React.MouseEvent) {
    e.preventDefault()
    nicheGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Background glows */}
      <div className="fixed pointer-events-none" style={{ width: 800, height: 800, background: 'var(--indigo)', top: -300, right: -200, opacity: 0.045, filter: 'blur(120px)', borderRadius: '50%', zIndex: 0 }} />
      <div className="fixed pointer-events-none" style={{ width: 600, height: 600, background: 'var(--purple)', bottom: -200, left: -100, opacity: 0.04, filter: 'blur(100px)', borderRadius: '50%', zIndex: 0 }} />

      {/* ─── Nav ─── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', height: 72, borderBottom: '1px solid var(--border)', background: 'rgba(8,8,15,.9)', backdropFilter: 'blur(24px)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', boxShadow: '0 0 20px rgba(99,102,241,.5)' }}>⚡</div>
          <span style={{ fontWeight: 900, fontSize: '0.95rem', background: 'linear-gradient(135deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ShortsForgeAI</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/login" style={{ padding: '8px 16px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted2)', textDecoration: 'none', border: '1px solid var(--border)' }}>Sign In</Link>
          <Link href="/dashboard" style={{ padding: '8px 20px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 800, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #6366f1, #7c3aed)', boxShadow: '0 4px 18px rgba(99,102,241,.4)' }}>Dashboard</Link>
        </div>
      </nav>

      {/* ─── Sticky CTA bar (just below nav) ─── */}
      <div
        style={{
          position: 'sticky',
          top: 72,
          zIndex: 40,
          background: 'linear-gradient(90deg, rgba(99,102,241,.12), rgba(124,58,237,.10))',
          borderBottom: '1px solid rgba(99,102,241,.18)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px',
          height: 42,
        }}
      >
        <button
          onClick={scrollToGrid}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: '0.79rem', fontWeight: 800, color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '-0.01em' }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px rgba(52,211,153,.6)', display: 'inline-block', animation: 'pulse-dot-bar 1.4s ease-in-out infinite' }} />
          ⚡ Generate Scripts →
        </button>
        <style>{`@keyframes pulse-dot-bar { 0%,100%{opacity:1}50%{opacity:.4} }`}</style>
      </div>

      {/* ─── Hero ─── */}
      <section style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '72px 24px 40px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 999, background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.25)', marginBottom: 28 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,.6)', display: 'inline-block' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399' }}>16 Niches · Generate up to 1,000 Shorts/month · Built for serious creators</span>
        </div>

        <h1 style={{ fontSize: 'clamp(2rem, 5.5vw, 3.4rem)', fontWeight: 900, lineHeight: 1.06, letterSpacing: '-0.03em', margin: '0 auto 18px', maxWidth: 780 }}>
          Choose your niche →{' '}
          <span style={{ background: 'linear-gradient(135deg, #818cf8, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Generate 5 viral Shorts scripts
          </span>
        </h1>

        <p style={{ fontSize: '1.05rem', color: 'var(--muted2)', maxWidth: 560, margin: '0 auto 36px', lineHeight: 1.65 }}>
          Pick a niche and get hooks, titles, scripts, hashtags and descriptions ready to post.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <button
            onClick={scrollToGrid}
            style={{ padding: '15px 36px', borderRadius: 14, fontSize: '0.95rem', fontWeight: 900, color: '#fff', background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)', boxShadow: '0 6px 36px rgba(99,102,241,.5)', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            ⚡ Pick a Niche Free
          </button>
          <Link href="/pricing" style={{ padding: '15px 28px', borderRadius: 14, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text2)', textDecoration: 'none', border: '1px solid var(--border2)', background: 'rgba(255,255,255,.03)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            See Pricing →
          </Link>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--muted)', letterSpacing: '0.01em' }}>
          Money Facts is free &nbsp;•&nbsp; No credit card required
        </p>
      </section>

      {/* ─── Niche Grid ─── */}
      <section
        id="niche-grid"
        ref={nicheGridRef}
        style={{ position: 'relative', zIndex: 10, padding: '0 24px 72px', maxWidth: 1400, margin: '0 auto' }}
      >
        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.14em', color: 'var(--indigo-light)', textTransform: 'uppercase', marginBottom: 4 }}>Step 1 — Pick a niche</div>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text)', letterSpacing: '-0.02em' }}>Choose your niche → click Generate</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10, background: 'rgba(99,102,241,.07)', border: '1px solid rgba(99,102,241,.13)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--indigo-light)' }}>
            ⚡ 5 scripts per package
          </div>
        </div>

        {/* 4 cols desktop, 2 tablet, 1 mobile */}
        <div className="niche-home-grid">
          {NICHES_HOME.map((niche) => (
            <NicheCard
              key={niche.id}
              {...niche}
              onGenerate={handleNicheClick}
              loading={false}
              disabled={isCardDisabled(niche.id)}
              selected={false}
              badge={niche.badge}
            />
          ))}
        </div>

        <style>{`
          .niche-home-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 16px;
          }
          @media (max-width: 1200px) { .niche-home-grid { grid-template-columns: repeat(3, 1fr); } }
          @media (max-width: 860px)  { .niche-home-grid { grid-template-columns: repeat(2, 1fr); } }
          @media (max-width: 520px)  { .niche-home-grid { grid-template-columns: 1fr; } }
        `}</style>

        {/* Upgrade nudge for free users */}
        {authChecked && !isPro && (
          <div style={{ marginTop: 24, borderRadius: 16, padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.18)' }}>
            <div>
              <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                🔒 Unlock all 16 niches for just $5/month
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                Generate unlimited scripts across every niche — cancel anytime.
              </p>
            </div>
            <Link href="/pricing" style={{ padding: '10px 24px', borderRadius: 12, fontSize: '0.875rem', fontWeight: 900, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #6366f1, #7c3aed)', boxShadow: '0 4px 22px rgba(99,102,241,.35)', flexShrink: 0 }}>
              ⭐ Upgrade to Pro
            </Link>
          </div>
        )}
      </section>

      {/* ─── Value Section ─── */}
      <section style={{ position: 'relative', zIndex: 10, padding: '0 24px 72px', maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,.08), rgba(124,58,237,.05))', border: '1px solid rgba(99,102,241,.18)', borderRadius: 24, padding: '52px 40px', boxShadow: '0 0 60px rgba(99,102,241,.08)' }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.14em', color: 'var(--indigo-light)', textTransform: 'uppercase', marginBottom: 14 }}>What You Get</div>
          <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 32 }}>
            Start generating{' '}
            <span style={{ background: 'linear-gradient(135deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>faster</span>
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 36, textAlign: 'left' }}>
            {[
              { icon: '📦', text: '5 scripts per package', sub: 'Every generation delivers 5 complete viral Shorts packages' },
              { icon: '🪝', text: 'Hooks, titles, scripts & hashtags', sub: 'Everything included — copy and paste straight to your editor' },
              { icon: '🎬', text: 'Built for Shorts, TikTok & Reels', sub: 'Optimized for YouTube Shorts, TikTok and Instagram Reels' },
            ].map((item) => (
              <div key={item.text} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
                <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text)', marginBottom: 4 }}>{item.text}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5 }}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
          <Link href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 36px', borderRadius: 14, fontSize: '0.95rem', fontWeight: 900, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)', boxShadow: '0 6px 32px rgba(99,102,241,.45)' }}>
            ⭐ Start for $5 →
          </Link>
          <p style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: 12 }}>Cancel anytime · No hidden fees</p>
        </div>
      </section>

      {/* ─── Live Script Preview Demo ─── */}
      <section style={{ position: 'relative', zIndex: 10, padding: '0 24px 72px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.14em', color: 'var(--indigo-light)', textTransform: 'uppercase', marginBottom: 8 }}>Watch It Work</div>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted2)', fontWeight: 600 }}>See exactly what you get — in real time</p>
        </div>
        <LiveDemoCard />
      </section>

      {/* ─── Benefits ─── */}
      <section style={{ position: 'relative', zIndex: 10, padding: '56px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.14em', color: 'var(--indigo-light)', textTransform: 'uppercase', marginBottom: 10 }}>Why ShortsForgeAI</div>
          <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.3rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Stop overthinking. Start{' '}
            <span style={{ background: 'linear-gradient(135deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>posting</span>.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {[
            { icon: '⚡', title: 'Save Hours Every Week', desc: 'What used to take 2 hours of research and writing now takes 30 seconds. Generate 5 complete scripts with a single click.', color: '#818cf8' },
            { icon: '🔥', title: 'Engineered to Go Viral', desc: 'Every script is built with proven viral hooks, high-retention structures, and platform-native formats that algorithms love.', color: '#a855f7' },
            { icon: '🎬', title: 'Multi-Platform Ready', desc: 'Scripts, titles, hashtags, and AI video prompts — everything you need to post on YouTube Shorts, TikTok, and Reels today.', color: '#ec4899' },
          ].map((b) => (
            <div
              key={b.title}
              style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '30px 28px 34px', boxShadow: '0 0 30px rgba(139,92,246,.1)', transition: 'border-color .2s, box-shadow .2s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${b.color}50`; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 40px ${b.color}18, 0 0 30px rgba(139,92,246,.15)` }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 30px rgba(139,92,246,.1)' }}
            >
              <div style={{ width: 50, height: 50, borderRadius: 14, background: `${b.color}18`, border: `1px solid ${b.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', marginBottom: 18 }}>
                {b.icon}
              </div>
              <h3 style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 10, color: 'var(--text)' }}>{b.title}</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--muted)', lineHeight: 1.65 }}>{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section style={{ position: 'relative', zIndex: 10, padding: '56px 24px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.14em', color: 'var(--indigo-light)', textTransform: 'uppercase', marginBottom: 10 }}>How It Works</div>
          <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.3rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text)' }}>3 steps to viral content</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {[
            { step: '01', icon: '🎯', title: 'Choose Your Niche', desc: 'Pick from 16 proven viral niches: History, Finance, True Crime, AI, Luxury, and many more.' },
            { step: '02', icon: '🤖', title: 'AI Generates', desc: 'GPT-4o crafts 5 unique scripts with hooks, titles, hashtags, and video prompts in under 30 seconds.' },
            { step: '03', icon: '🚀', title: 'Post & Go Viral', desc: 'Copy your scripts and paste directly into your video tool. Start posting and watch the views roll in.' },
          ].map((s) => (
            <div key={s.step} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '26px 24px 30px', position: 'relative', overflow: 'hidden', boxShadow: '0 0 30px rgba(139,92,246,.08)' }}>
              <div style={{ fontSize: '3.5rem', fontWeight: 900, color: 'rgba(99,102,241,.07)', position: 'absolute', top: 8, right: 14, lineHeight: 1, userSelect: 'none' }}>{s.step}</div>
              <div style={{ fontSize: '2rem', marginBottom: 16 }}>{s.icon}</div>
              <h3 style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 8, color: 'var(--text)' }}>{s.title}</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--muted)', lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section style={{ position: 'relative', zIndex: 10, padding: '56px 24px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.14em', color: 'var(--indigo-light)', textTransform: 'uppercase', marginBottom: 10 }}>Pricing</div>
          <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.3rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text)' }}>Simple &amp; transparent</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, alignItems: 'start' }}>
          {/* Free */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '30px 28px 34px', boxShadow: '0 0 30px rgba(139,92,246,.08)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Free</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: '2.8rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>$0</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>/forever</span>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: 22 }}>Perfect to try it out</p>
            {['2 free generations', '5 scripts per package', 'Viral hooks + titles + hashtags', 'Descriptions & video prompts', 'Money Facts niche included'].map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--text2)', marginBottom: 10 }}>
                <span style={{ color: '#34d399' }}>✓</span> {f}
              </div>
            ))}
            <Link href="/dashboard" style={{ display: 'block', marginTop: 22, padding: '12px 0', borderRadius: 12, textAlign: 'center', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text2)', textDecoration: 'none', background: 'rgba(255,255,255,.05)', border: '1px solid var(--border2)' }}>
              Start Free
            </Link>
          </div>
          {/* Creator Pro */}
          <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,.1), rgba(124,58,237,.06))', border: '2px solid rgba(99,102,241,.35)', borderRadius: 20, padding: '30px 28px 34px', position: 'relative', overflow: 'hidden', boxShadow: '0 0 60px rgba(99,102,241,.15)' }}>
            <div style={{ position: 'absolute', top: 16, right: 16, padding: '3px 12px', borderRadius: 999, background: 'linear-gradient(135deg, #6366f1, #7c3aed)', fontSize: '0.65rem', fontWeight: 900, color: '#fff' }}>Most Popular</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--indigo-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Creator Pro</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: '2.8rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>$5</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>/month</span>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: 22 }}>Cancel anytime. No hidden fees.</p>
            {[
              '200 generations per month',
              'Up to 1,000 Shorts scripts/month',
              'Hooks, titles, scripts & hashtags',
              'Descriptions & video prompts',
              '16 viral niches unlocked',
              'Beta access: AI Video Generator',
            ].map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--text2)', marginBottom: 10 }}>
                <span style={{ color: '#34d399' }}>✓</span> {f}
              </div>
            ))}
            <Link href="/pricing" style={{ display: 'block', marginTop: 22, padding: '14px 0', borderRadius: 12, textAlign: 'center', fontSize: '0.875rem', fontWeight: 900, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)', boxShadow: '0 4px 24px rgba(99,102,241,.45)' }}>
              ⭐ Start for $5
            </Link>
            <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--muted)', marginTop: 10 }}>Cancel anytime. No hidden fees.</p>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '56px 24px 88px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', background: 'linear-gradient(135deg, rgba(99,102,241,.1), rgba(124,58,237,.06))', border: '1px solid rgba(99,102,241,.25)', borderRadius: 24, padding: '56px 40px', boxShadow: '0 0 60px rgba(99,102,241,.12)' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.1rem)', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--text)' }}>
            Ready to{' '}
            <span style={{ background: 'linear-gradient(135deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>go viral</span>?
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: 30, lineHeight: 1.6 }}>
            Join 1,200+ creators. Generate up to 1,000 Shorts scripts/month. Start generating in seconds.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={scrollToGrid}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 36px', borderRadius: 14, fontSize: '0.95rem', fontWeight: 900, color: '#fff', background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)', boxShadow: '0 6px 36px rgba(99,102,241,.5)', border: 'none', cursor: 'pointer' }}
            >
              ⚡ Choose a Niche Free
            </button>
            <Link href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '15px 28px', borderRadius: 14, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text2)', textDecoration: 'none', border: '1px solid var(--border2)', background: 'rgba(255,255,255,.03)' }}>
              See Pricing →
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer style={{ position: 'relative', zIndex: 10, borderTop: '1px solid var(--border)', padding: '32px 32px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>⚡</div>
            <span style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--muted2)' }}>ShortsForgeAI</span>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[['/', 'Home'], ['/dashboard', 'Dashboard'], ['/pricing', 'Pricing'], ['/templates', 'Templates'], ['/login', 'Sign In']].map(([href, label]) => (
              <Link key={href} href={href} style={{ fontSize: '0.875rem', color: 'var(--muted)', textDecoration: 'none', fontWeight: 500 }}>{label}</Link>
            ))}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>© 2025 ShortsForgeAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
