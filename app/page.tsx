'use client'

import Link from 'next/link'

export default function HomePage() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Background glows */}
      <div className="fixed pointer-events-none" style={{ width: 800, height: 800, background: 'var(--indigo)', top: -300, right: -200, opacity: 0.045, filter: 'blur(120px)', borderRadius: '50%', zIndex: 0 }} />
      <div className="fixed pointer-events-none" style={{ width: 600, height: 600, background: 'var(--purple)', bottom: -200, left: -100, opacity: 0.04, filter: 'blur(100px)', borderRadius: '50%', zIndex: 0 }} />

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px', height: 72, borderBottom: '1px solid var(--border)', background: 'rgba(8,8,15,.9)', backdropFilter: 'blur(24px)' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', boxShadow: '0 0 20px rgba(99,102,241,.5)' }}>⚡</div>
          <span style={{ fontWeight: 900, fontSize: '0.95rem', background: 'linear-gradient(135deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ShortsForgeAI</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/login" style={{ padding: '8px 16px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted2)', textDecoration: 'none', border: '1px solid var(--border)' }}>Sign In</Link>
          <Link href="/signup" style={{ padding: '8px 20px', borderRadius: 10, fontSize: '0.82rem', fontWeight: 800, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #6366f1, #7c3aed)', boxShadow: '0 4px 18px rgba(99,102,241,.4)' }}>Get Started Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '96px 24px 80px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 999, background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.25)', marginBottom: 32 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px rgba(52,211,153,.6)', display: 'inline-block' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399' }}>AI-Powered · Live · 100% Free to Start</span>
        </div>

        <h1 style={{ fontSize: 'clamp(2.4rem, 6vw, 4rem)', fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.03em', margin: '0 auto 24px', maxWidth: 800 }}>
          Generate{' '}
          <span style={{ background: 'linear-gradient(135deg, #818cf8, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            5 Viral Shorts
          </span>
          <br />in 30 Seconds
        </h1>

        <p style={{ fontSize: '1.05rem', color: 'var(--muted2)', maxWidth: 560, margin: '0 auto 44px', lineHeight: 1.65 }}>
          Pick a niche. Get 5 ready-to-post scripts, viral hooks, hashtags, and AI video prompts — instantly. For YouTube Shorts, TikTok &amp; Reels.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/signup" style={{ padding: '15px 36px', borderRadius: 14, fontSize: '0.95rem', fontWeight: 900, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)', boxShadow: '0 6px 36px rgba(99,102,241,.5)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            ⚡ Get Started Free
          </Link>
          <Link href="/dashboard" style={{ padding: '15px 28px', borderRadius: 14, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text2)', textDecoration: 'none', border: '1px solid var(--border2)', background: 'rgba(255,255,255,.03)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            View Demo →
          </Link>
        </div>
        <p style={{ marginTop: 24, fontSize: '0.78rem', color: 'var(--muted)' }}>
          No credit card required · 5 free generations · Cancel anytime
        </p>
      </section>

      {/* Benefits */}
      <section style={{ position: 'relative', zIndex: 10, padding: '60px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
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
              style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '30px 28px 34px', transition: 'border-color .2s, box-shadow .2s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${b.color}50`; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 40px ${b.color}12` }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
            >
              <div style={{ width: 50, height: 50, borderRadius: 14, background: `${b.color}18`, border: `1px solid ${b.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', marginBottom: 18 }}>
                {b.icon}
              </div>
              <h3 style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: 10, color: 'var(--text)' }}>{b.title}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.65 }}>{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ position: 'relative', zIndex: 10, padding: '60px 24px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.14em', color: 'var(--indigo-light)', textTransform: 'uppercase', marginBottom: 10 }}>How It Works</div>
          <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.3rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text)' }}>3 steps to viral content</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {[
            { step: '01', icon: '🎯', title: 'Choose Your Niche', desc: 'Pick from 5 proven viral niches: Middle East Secrets, Money Facts, Mind Blowing, Dark Mysteries, or Motivation.' },
            { step: '02', icon: '🤖', title: 'AI Generates', desc: 'GPT-4o-mini crafts 5 unique scripts with hooks, titles, hashtags, and video prompts in under 30 seconds.' },
            { step: '03', icon: '🚀', title: 'Post & Go Viral', desc: 'Copy your scripts and paste directly into your video tool. Start posting and watch the views roll in.' },
          ].map((s) => (
            <div key={s.step} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, padding: '26px 24px 30px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ fontSize: '3.5rem', fontWeight: 900, color: 'rgba(99,102,241,.07)', position: 'absolute', top: 8, right: 14, lineHeight: 1, userSelect: 'none' }}>{s.step}</div>
              <div style={{ fontSize: '2rem', marginBottom: 16 }}>{s.icon}</div>
              <h3 style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: 8, color: 'var(--text)' }}>{s.title}</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.6 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section style={{ position: 'relative', zIndex: 10, padding: '60px 24px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.14em', color: 'var(--indigo-light)', textTransform: 'uppercase', marginBottom: 10 }}>Pricing</div>
          <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.3rem)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text)' }}>Simple &amp; transparent</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, alignItems: 'start' }}>
          {/* Free */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '30px 28px 34px' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Free</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: '2.8rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>$0</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>/forever</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 22 }}>Perfect to try it out</p>
            {['5 total generations', '5 viral niches', 'Scripts + hashtags', 'AI video prompts'].map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text2)', marginBottom: 10 }}>
                <span style={{ color: '#34d399' }}>✓</span> {f}
              </div>
            ))}
            <Link href="/signup" style={{ display: 'block', marginTop: 22, padding: '12px 0', borderRadius: 12, textAlign: 'center', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text2)', textDecoration: 'none', background: 'rgba(255,255,255,.05)', border: '1px solid var(--border2)' }}>
              Start Free
            </Link>
          </div>
          {/* Pro */}
          <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,.1), rgba(124,58,237,.06))', border: '2px solid rgba(99,102,241,.35)', borderRadius: 20, padding: '30px 28px 34px', position: 'relative', overflow: 'hidden', boxShadow: '0 0 60px rgba(99,102,241,.1)' }}>
            <div style={{ position: 'absolute', top: 16, right: 16, padding: '3px 12px', borderRadius: 999, background: 'linear-gradient(135deg, #6366f1, #7c3aed)', fontSize: '0.65rem', fontWeight: 900, color: '#fff' }}>Most Popular</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--indigo-light)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Pro</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: '2.8rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>$5</span>
              <span style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>/month</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 22 }}>Cancel anytime</p>
            {['Unlimited generations', '5 viral niches', 'Scripts + hashtags', 'AI video prompts', 'Generation history', 'Priority support'].map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text2)', marginBottom: 10 }}>
                <span style={{ color: '#34d399' }}>✓</span> {f}
              </div>
            ))}
            <Link href="/signup" style={{ display: 'block', marginTop: 22, padding: '14px 0', borderRadius: 12, textAlign: 'center', fontSize: '0.85rem', fontWeight: 900, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)', boxShadow: '0 4px 24px rgba(99,102,241,.45)' }}>
              ⭐ Upgrade to Pro
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '60px 24px 90px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', background: 'linear-gradient(135deg, rgba(99,102,241,.1), rgba(124,58,237,.06))', border: '1px solid rgba(99,102,241,.25)', borderRadius: 24, padding: '60px 40px' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.1rem)', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 16, color: 'var(--text)' }}>
            Ready to{' '}
            <span style={{ background: 'linear-gradient(135deg, #818cf8, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>go viral</span>?
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: 30, lineHeight: 1.6 }}>
            Join creators generating viral content in seconds. Start free, no credit card required.
          </p>
          <Link href="/signup" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 40px', borderRadius: 14, fontSize: '0.95rem', fontWeight: 900, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)', boxShadow: '0 6px 36px rgba(99,102,241,.5)' }}>
            ⚡ Get Started Free — No Card Needed
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 10, borderTop: '1px solid var(--border)', padding: '32px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>⚡</div>
            <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--muted2)' }}>ShortsForgeAI</span>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[['/', 'Home'], ['/dashboard', 'Dashboard'], ['/pricing', 'Pricing'], ['/templates', 'Templates'], ['/login', 'Sign In']].map(([href, label]) => (
              <Link key={href} href={href} style={{ fontSize: '0.8rem', color: 'var(--muted)', textDecoration: 'none', fontWeight: 500 }}>{label}</Link>
            ))}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>© 2025 ShortsForgeAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
