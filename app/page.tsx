'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'

// Push #032: / is now a marketing-only page for unauthenticated visitors.
// Logged-in users are bounced straight to /generate (the prompt textarea
// lives there now — see GenerateClient.tsx). The hero textarea + QUICK_TAGS
// row that lived here in push #031 was removed because it duplicated the
// /generate input.

export default function HomePage() {
  const router = useRouter()
  const pricingRef = useRef<HTMLDivElement>(null)

  const [user, setUser] = useState<{ id: string } | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isPro, setIsPro] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        // Skip rendering the marketing page entirely — go straight to the
        // prompt textarea on /generate.
        router.replace('/generate')
        return
      }
      setUser(null)
      setAuthChecked(true)
    })
  }, [router])

  function scrollTo(ref: React.RefObject<HTMLDivElement>) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // While auth is in-flight (or we've confirmed a session and are about to
  // redirect), render nothing. This avoids a flash of the marketing page
  // for logged-in users on every visit.
  if (!authChecked) return null

  return (
    <div style={{ display: 'flex', background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Desktop sidebar spacer */}
      <div className="hidden md:block flex-shrink-0" style={{ width: 248 }} />

      {/* Sidebar */}
      <Sidebar
        userEmail={userEmail}
        isPro={isPro}
        generationsUsed={0}
        isLoggedIn={!!user}
        isOpen={true}
        onClose={() => {}}
      />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden">
          <Sidebar
            userEmail={userEmail}
            isPro={isPro}
            generationsUsed={0}
            isLoggedIn={!!user}
            isOpen={true}
            onClose={() => setSidebarOpen(false)}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0" style={{ color: 'var(--text)', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {/* Background glows */}
        <div className="fixed pointer-events-none" style={{ width: 800, height: 800, background: 'var(--indigo)', top: -300, right: -200, opacity: 0.045, filter: 'blur(120px)', borderRadius: '50%', zIndex: 0 }} />
        <div className="fixed pointer-events-none" style={{ width: 600, height: 600, background: 'var(--purple)', bottom: -200, left: -100, opacity: 0.04, filter: 'blur(100px)', borderRadius: '50%', zIndex: 0 }} />

        {/* ─── Nav ─── */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 64, borderBottom: '1px solid var(--border)', background: 'rgba(8,8,15,.9)', backdropFilter: 'blur(24px)' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #2563EB, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', boxShadow: '0 0 20px rgba(99,102,241,.5)' }}>⚡</div>
            <span style={{ fontWeight: 900, fontSize: '0.95rem', background: 'linear-gradient(135deg, #3B82F6, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ShortsForgeAI</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/login" style={{ padding: '8px 16px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted2)', textDecoration: 'none', border: '1px solid var(--border)' }}>Sign In</Link>
            <Link href="/signup" style={{ padding: '8px 20px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 800, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #2563EB, #7c3aed)', boxShadow: '0 4px 18px rgba(99,102,241,.4)' }}>Start Free</Link>
          </div>
        </nav>

        {/* ─── Hero ─── */}
        <section id="hero" style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: 'clamp(40px, 7vw, 64px) 20px 28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 999, background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.25)', marginBottom: 22 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,.6)', display: 'inline-block' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399' }}>AI Shorts generator · Built for faceless creators</span>
          </div>

          <h1 style={{ fontSize: 'clamp(2.4rem, 7vw, 4rem)', fontWeight: 900, lineHeight: 1.02, letterSpacing: '-0.035em', margin: '0 auto 14px', maxWidth: 780 }}>
            Viral Shorts.{' '}
            <span style={{ background: 'linear-gradient(135deg, #3B82F6, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              One Click.
            </span>
          </h1>

          <p style={{ fontSize: '1rem', color: 'var(--muted2)', maxWidth: 500, margin: '0 auto 24px', lineHeight: 1.55 }}>
            AI-generated faceless videos — built for Shorts creators.
          </p>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <Link
              href="/signup"
              style={{ padding: '13px 30px', borderRadius: 12, fontSize: '0.92rem', fontWeight: 900, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #2563EB 0%, #7c3aed 55%, #a855f7 100%)', boxShadow: '0 6px 28px rgba(99,102,241,.45)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              Start Free
            </Link>
            <button
              onClick={() => scrollTo(pricingRef)}
              style={{ padding: '13px 24px', borderRadius: 12, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text2)', border: '1px solid var(--border2)', background: 'rgba(255,255,255,.03)', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
            >
              View Pricing
            </button>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', letterSpacing: '0.01em' }}>
            No credit card required
          </p>
        </section>

        {/* ─── Pricing ─── */}
        <section
          id="pricing"
          ref={pricingRef}
          style={{ position: 'relative', zIndex: 10, padding: '40px 24px 64px', maxWidth: 1100, margin: '0 auto' }}
        >
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.14em', color: 'var(--indigo-light)', textTransform: 'uppercase', marginBottom: 10 }}>Pricing</div>
            <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.3rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text)' }}>
              Simple plans for every creator
            </h2>
          </div>

          <div className="pricing-grid">
            {/* Free */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '30px 28px 34px', boxShadow: '0 0 30px rgba(139,92,246,.08)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Free</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
                <span style={{ fontSize: '2.8rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>$0</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>/month</span>
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: 22 }}>Try ShortsForgeAI before upgrading</p>
              <div style={{ flex: 1 }}>
                {[
                  '2 credits',
                  'Try ShortsForgeAI before upgrading',
                  'MP4 ready to post',
                  'Community support',
                ].map((f) => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--text2)', marginBottom: 10 }}>
                    <span style={{ color: '#34d399' }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <Link
                href="/signup"
                style={{ display: 'block', marginTop: 22, padding: '12px 0', borderRadius: 12, textAlign: 'center', fontSize: '0.875rem', fontWeight: 700, color: 'var(--text2)', textDecoration: 'none', background: 'rgba(255,255,255,.05)', border: '1px solid var(--border2)' }}
              >
                Start Free
              </Link>
            </div>

            {/* Basic - Most Popular */}
            <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,.1), rgba(124,58,237,.06))', border: '2px solid rgba(99,102,241,.35)', borderRadius: 20, padding: '30px 28px 34px', position: 'relative', overflow: 'hidden', boxShadow: '0 0 60px rgba(99,102,241,.15)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'absolute', top: 16, right: 16, padding: '3px 12px', borderRadius: 999, background: 'linear-gradient(135deg, #2563EB, #7c3aed)', fontSize: '0.65rem', fontWeight: 900, color: '#fff' }}>Most Popular</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--indigo-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Basic</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 2 }}>
                <span style={{ fontSize: '2.8rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>$4.50</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>first month</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#a5b4fc', fontWeight: 700, marginBottom: 8 }}>then $9/month</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: 22 }}>140 credits / month · ≈9 Shorts</p>
              <div style={{ flex: 1 }}>
                {[
                  '140 credits / month',
                  '≈9 Shorts of 30–35s',
                  '15 credits per Basic Short',
                  'Launch offer: 50% off first month',
                  'Email support',
                ].map((f) => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--text2)', marginBottom: 10 }}>
                    <span style={{ color: '#34d399' }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <Link
                href="/pricing"
                style={{ display: 'block', marginTop: 22, padding: '14px 0', borderRadius: 12, textAlign: 'center', fontSize: '0.875rem', fontWeight: 900, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #2563EB 0%, #7c3aed 55%, #a855f7 100%)', boxShadow: '0 4px 24px rgba(99,102,241,.45)' }}
              >
                Get Basic — $4.50
              </Link>
            </div>

            {/* Pro - Best Value */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '30px 28px 34px', boxShadow: '0 0 30px rgba(139,92,246,.08)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 16, right: 16, padding: '3px 12px', borderRadius: 999, background: 'linear-gradient(135deg, #7c3aed, #a855f7)', fontSize: '0.65rem', fontWeight: 900, color: '#fff' }}>Best Value</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Pro</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 2 }}>
                <span style={{ fontSize: '2.8rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>$9.50</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>first month</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#c4b5fd', fontWeight: 700, marginBottom: 8 }}>then $19/month</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: 22 }}>350 credits / month · ≈17 Shorts</p>
              <div style={{ flex: 1 }}>
                {[
                  '350 credits / month',
                  '≈17 Shorts of 30–35s',
                  '20 credits per Pro Short',
                  'Launch offer: 50% off first month',
                  'Priority support',
                ].map((f) => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--text2)', marginBottom: 10 }}>
                    <span style={{ color: '#34d399' }}>✓</span> {f}
                  </div>
                ))}
              </div>
              <Link
                href="/pricing"
                style={{ display: 'block', marginTop: 22, padding: '14px 0', borderRadius: 12, textAlign: 'center', fontSize: '0.875rem', fontWeight: 900, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', boxShadow: '0 4px 24px rgba(168,85,247,.4)' }}
              >
                Get Pro — $9.50
              </Link>
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--muted)', marginTop: 18, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto' }}>
            50% off applies to the first month only. Plans renew at the regular monthly price.
          </p>

          <style>{`
            .pricing-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              align-items: stretch;
            }
            @media (max-width: 900px) { .pricing-grid { grid-template-columns: 1fr; } }
          `}</style>
        </section>

        {/* ─── Footer ─── */}
        <footer style={{ position: 'relative', zIndex: 10, borderTop: '1px solid var(--border)', padding: '28px 32px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #2563EB, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>⚡</div>
              <span style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--muted2)' }}>ShortsForgeAI</span>
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[
                ['/', 'Home'],
                ['/pricing', 'Pricing'],
                ['/templates', 'Templates'],
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
