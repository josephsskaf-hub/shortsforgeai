'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
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

const PENDING_PROMPT_KEY = 'pendingVideoPrompt'

export default function HomePage() {
  const router = useRouter()

  const [user, setUser] = useState<{ id: string } | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [isPro, setIsPro] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  const [prompt, setPrompt] = useState('')

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

  function handleAnalyze() {
    const trimmed = prompt.trim()
    try {
      if (trimmed) sessionStorage.setItem(PENDING_PROMPT_KEY, trimmed)
      else sessionStorage.removeItem(PENDING_PROMPT_KEY)
    } catch {
      // sessionStorage can throw in private mode — fall through to the
      // redirect anyway so the user can still type their idea on /generate.
    }
    if (user) {
      router.push('/generate')
    } else {
      router.push(`/login?redirect=${encodeURIComponent('/generate')}`)
    }
  }

  return (
    <div style={{ display: 'flex', background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Desktop sidebar spacer */}
      <div className="hidden md:block flex-shrink-0" style={{ width: 248 }} />

      <Sidebar
        userEmail={userEmail}
        isPro={isPro}
        generationsUsed={0}
        isLoggedIn={!!user}
        isOpen={true}
        onClose={() => {}}
      />

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
        <section style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: 'clamp(40px, 7vw, 64px) 20px 24px', maxWidth: 820, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 999, background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.25)', marginBottom: 22 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,.6)', display: 'inline-block' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399' }}>AI video generator · YouTube Shorts ready</span>
          </div>

          <h1 style={{ fontSize: 'clamp(2.2rem, 6.4vw, 3.6rem)', fontWeight: 900, lineHeight: 1.04, letterSpacing: '-0.035em', margin: '0 auto 16px', maxWidth: 760 }}>
            Create{' '}
            <span style={{ background: 'linear-gradient(135deg, #3B82F6, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              AI Shorts
            </span>{' '}
            in one click
          </h1>

          <p style={{ fontSize: '1rem', color: 'var(--muted2)', maxWidth: 560, margin: '0 auto', lineHeight: 1.55 }}>
            Turn an idea into a vertical AI video with visuals, voiceover, captions, and download.
          </p>
        </section>

        {/* ─── Generate Video Card ─── */}
        <section style={{ position: 'relative', zIndex: 10, padding: '0 20px 24px', maxWidth: 820, margin: '0 auto' }}>
          <div
            style={{
              background: 'rgba(15,15,30,0.85)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              padding: '24px',
              boxShadow: '0 12px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(99,102,241,0.08) inset',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>
              Generate a Real AI Short
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--muted2)', marginBottom: 16 }}>
              Describe your idea. We&apos;ll analyze it before charging any credits.
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleAnalyze()
                }
              }}
              placeholder="Describe your video idea..."
              maxLength={1000}
              className="hero-prompt-textarea"
              style={{
                width: '100%',
                minHeight: 180,
                background: 'rgba(0,0,0,.3)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                outline: 'none',
                resize: 'none',
                borderRadius: 12,
                padding: '14px 16px',
                fontSize: '0.95rem',
                lineHeight: 1.55,
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 14 }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                Analyzing your idea is free — no credits are charged.
              </p>
              <button
                onClick={handleAnalyze}
                disabled={!prompt.trim()}
                style={{
                  padding: '10px 24px',
                  borderRadius: 12,
                  fontSize: '0.85rem',
                  fontWeight: 900,
                  color: prompt.trim() ? '#fff' : 'var(--muted)',
                  background: prompt.trim()
                    ? 'linear-gradient(135deg, #2563EB, #1d4ed8)'
                    : 'rgba(255,255,255,.04)',
                  border: 'none',
                  cursor: prompt.trim() ? 'pointer' : 'not-allowed',
                  boxShadow: prompt.trim() ? '0 8px 28px rgba(37,99,235,.4)' : 'none',
                }}
              >
                Analyze Idea
              </button>
            </div>
          </div>
          <style>{`
            .hero-prompt-textarea::placeholder { color: rgba(255,255,255,.38); }
          `}</style>
        </section>

        {/* ─── Pricing ─── */}
        <section style={{ position: 'relative', zIndex: 10, padding: '24px 20px 16px', maxWidth: 1100, margin: '0 auto' }}>
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
