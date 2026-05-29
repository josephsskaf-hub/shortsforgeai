import Link from 'next/link'
import Footer from '@/components/Footer'

// Push #107 — Google Ads landing page. Single conversion target
// (Start Free → /signup), zero outbound links to other marketing pages.
// Push #116 — Footer mounted for Terms/Privacy/Contact links.
// Push #195 — full LP refresh: stronger hero, consistent social proof,
// step descriptions, benefits section, second CTA, improved FAQ.

const HOW_IT_WORKS: { step: string; title: string; desc: string }[] = [
  {
    step: '1',
    title: 'Type your topic',
    desc: 'Enter any subject — finance, history, tech, lifestyle. The AI handles everything from there.',
  },
  {
    step: '2',
    title: 'AI builds your Short',
    desc: 'Script, voiceover, footage, captions, and soundtrack — assembled automatically in ~60 seconds.',
  },
  {
    step: '3',
    title: 'Download & post',
    desc: 'Get a ready-to-upload 9:16 MP4. No editing app, no camera, no technical skills needed.',
  },
]

const BENEFITS: { icon: string; title: string; desc: string; accent: string }[] = [
  {
    icon: '🎭',
    title: '100% Faceless',
    desc: 'Never show your face or use a camera. The AI generates everything — visuals, voice, text.',
    accent: '#22D3EE',
  },
  {
    icon: '⚡',
    title: 'Ready in 60 Seconds',
    desc: 'Fast Mode renders your full Short in under a minute. Post daily without spending hours editing.',
    accent: '#FBBF24',
  },
  {
    icon: '🧠',
    title: 'AI Writes the Script',
    desc: 'No writing skills needed. Our AI crafts a viral-optimized script for any niche automatically.',
    accent: '#A78BFA',
  },
  {
    icon: '📥',
    title: 'Watermark-Free MP4',
    desc: 'Download clean, professional-quality vertical video — ready for YouTube, TikTok, or Reels.',
    accent: '#34D399',
  },
]

const SOCIAL_PROOF: { icon: string; text: string; accent: string }[] = [
  { icon: '⚡', text: '3,200+ videos generated', accent: '#22D3EE' },
  { icon: '★★★★★', text: '4.8★ average rating', accent: '#FBBF24' },
  { icon: '🎬', text: '500+ active creators', accent: '#34D399' },
]

export default function StartPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#05070D',
        color: '#F5F7FF',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        padding: '32px 20px 48px',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <span
            style={{
              fontSize: '1.05rem',
              fontWeight: 900,
              letterSpacing: '-0.01em',
              background: 'linear-gradient(135deg, #3B82F6, #22D3EE)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            ShortsForgeAI
          </span>
        </div>

        {/* Hero */}
        <section style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 'clamp(2rem, 6vw, 3rem)',
              fontWeight: 900,
              lineHeight: 1.08,
              letterSpacing: '-0.035em',
              margin: '0 auto 16px',
              maxWidth: 620,
            }}
          >
            The Smart AI Tool That Turns Any Idea Into a{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #34D399, #22D3EE)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Viral Short
            </span>
          </h1>
          <p
            style={{
              fontSize: 'clamp(0.95rem, 2.6vw, 1.15rem)',
              color: '#94A3B8',
              maxWidth: 520,
              margin: '0 auto 10px',
              lineHeight: 1.55,
            }}
          >
            No camera. No face. No editing.{' '}
            <span style={{ color: '#F5F7FF', fontWeight: 700 }}>
              AI writes the script, finds footage, adds captions &amp; music.
            </span>
          </p>
          <p style={{ fontSize: '0.9rem', color: '#64748B', margin: 0 }}>
            Ready in 60 seconds. Plans from $4.90/month.
          </p>
        </section>

        {/* Primary CTA */}
        <section style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link
            href="/signup"
            className="start-primary-cta block sm:inline-block w-full sm:w-auto"
            style={{
              padding: '18px 32px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#FFFFFF',
              fontSize: '1.1rem',
              fontWeight: 900,
              letterSpacing: '-0.01em',
              textDecoration: 'none',
              boxShadow: '0 10px 36px rgba(16,185,129,.50)',
              boxSizing: 'border-box',
              minHeight: 58,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Start Generating Shorts →
          </Link>
          <p
            style={{
              fontSize: '0.8rem',
              color: '#64748B',
              marginTop: 12,
              fontWeight: 600,
            }}
          >
            From $4.90/month · 7-day money-back guarantee · Cancel anytime
          </p>
        </section>

        {/* Social proof pills */}
        <section
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 52,
          }}
        >
          {SOCIAL_PROOF.map((p) => (
            <div
              key={p.text}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 999,
                background: 'rgba(11,17,32,0.7)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              <span style={{ color: p.accent, fontWeight: 900 }}>{p.icon}</span>
              <span style={{ color: '#E2E8F0' }}>{p.text}</span>
            </div>
          ))}
        </section>

        {/* How it works */}
        <section style={{ marginBottom: 52 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div
              style={{
                fontSize: '0.62rem',
                fontWeight: 900,
                letterSpacing: '.14em',
                color: '#22D3EE',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              How it works
            </div>
            <h2
              style={{
                fontSize: 'clamp(1.3rem, 4vw, 1.65rem)',
                fontWeight: 900,
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              From idea to YouTube Short in 3 steps
            </h2>
          </div>
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            }}
          >
            {HOW_IT_WORKS.map((s) => (
              <div
                key={s.step}
                style={{
                  background: 'rgba(11,17,32,0.85)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14,
                  padding: '20px 18px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #2563EB, #22D3EE)',
                    color: '#FFFFFF',
                    fontWeight: 900,
                    fontSize: '1rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  {s.step}
                </div>
                <div
                  style={{
                    fontSize: '0.92rem',
                    fontWeight: 800,
                    letterSpacing: '-0.01em',
                    marginBottom: 6,
                  }}
                >
                  {s.title}
                </div>
                <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Why creators choose ShortsForgeAI */}
        <section style={{ marginBottom: 52 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div
              style={{
                fontSize: '0.62rem',
                fontWeight: 900,
                letterSpacing: '.14em',
                color: '#A78BFA',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Why creators choose us
            </div>
            <h2
              style={{
                fontSize: 'clamp(1.3rem, 4vw, 1.65rem)',
                fontWeight: 900,
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Built for creators who want results, not complexity
            </h2>
          </div>
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            }}
          >
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                style={{
                  background: 'rgba(11,17,32,0.85)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14,
                  padding: '20px 20px',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    fontSize: '1.4rem',
                    flexShrink: 0,
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'rgba(255,255,255,.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {b.icon}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      color: b.accent,
                      marginBottom: 4,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {b.title}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                    {b.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Demo video */}
        {process.env.NEXT_PUBLIC_DEMO_VIDEO_URL && (
          <section style={{ textAlign: 'center', marginBottom: 52 }}>
            <div
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#F5F7FF',
                marginBottom: 14,
                letterSpacing: '-0.01em',
              }}
            >
              Watch It Work
            </div>
            <video
              src={process.env.NEXT_PUBLIC_DEMO_VIDEO_URL}
              autoPlay
              muted
              loop
              playsInline
              className="w-full max-w-2xl mx-auto rounded-xl"
            />
          </section>
        )}

        {/* FAQ */}
        <section style={{ marginBottom: 44 }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h2
              style={{
                fontSize: 'clamp(1.2rem, 3.5vw, 1.5rem)',
                fontWeight: 900,
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Common questions
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              {
                q: 'Do I need a camera or show my face?',
                a: 'No — never. ShortsForgeAI generates the visuals, voiceover, and subtitles automatically from any topic you type. 100% faceless, 100% hands-free.',
              },
              {
                q: 'How long does it take to make a video?',
                a: 'Under 60 seconds in Fast Mode. Type your topic → click Generate → download your MP4. That\'s it.',
              },
              {
                q: 'Which plan should I pick?',
                a: 'Basic ($4.90/month) gives you 50 Fast Mode videos — plenty for daily posting. Pro ($9.90/month) adds 100 Fast Mode videos plus 1 Cinematic (Runway AI) video per month. Both come with a 7-day money-back guarantee.',
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Yes — cancel any time directly from your account page. No contracts, no questions. If you\'re not happy in the first 7 days, we\'ll refund you.',
              },
              {
                q: 'Will my channel get flagged for AI content?',
                a: 'No. The output is a normal MP4 — YouTube treats it like any other video. Thousands of faceless channels already use AI-generated content successfully.',
              },
            ].map((item) => (
              <details
                key={item.q}
                style={{
                  background: 'rgba(255,255,255,.04)',
                  border: '1px solid rgba(255,255,255,.08)',
                  borderRadius: 10,
                  padding: '14px 18px',
                }}
              >
                <summary
                  style={{
                    color: '#F5F7FF',
                    fontWeight: 700,
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    listStyle: 'none',
                  }}
                >
                  {item.q}
                </summary>
                <p
                  style={{
                    marginTop: 10,
                    marginBottom: 0,
                    color: '#94A3B8',
                    fontSize: '0.88rem',
                    lineHeight: 1.55,
                  }}
                >
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Pricing card */}
        <section style={{ marginBottom: 36 }}>
          <div
            style={{
              position: 'relative',
              background: 'linear-gradient(180deg, rgba(34,211,238,.06), rgba(11,17,32,.85))',
              border: '2px solid rgba(34,211,238,.45)',
              borderRadius: 20,
              padding: '28px 24px',
              boxShadow: '0 0 40px rgba(34,211,238,.14)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -12,
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#22D3EE',
                color: '#05070D',
                fontSize: '0.62rem',
                fontWeight: 900,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                padding: '4px 14px',
                borderRadius: 999,
                boxShadow: '0 4px 18px rgba(34,211,238,.45)',
                whiteSpace: 'nowrap',
              }}
            >
              🔥 Most Popular
            </div>
            <div
              style={{
                fontSize: '0.62rem',
                fontWeight: 900,
                letterSpacing: '.14em',
                color: '#94A3B8',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Basic
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
              <span
                style={{
                  fontSize: '2.6rem',
                  fontWeight: 900,
                  letterSpacing: '-0.02em',
                  color: '#F5F7FF',
                  lineHeight: 1,
                }}
              >
                $4.90
              </span>
              <span style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 600 }}>/mo</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#22D3EE', fontWeight: 800, marginBottom: 6 }}>
              50 Fast Mode renders/month · Under $0.10 per video
            </p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '4px 16px',
                marginBottom: 20,
                fontSize: '0.8rem',
                color: '#94A3B8',
                fontWeight: 600,
              }}
            >
              <span>✓ AI script + voiceover</span>
              <span>✓ Auto-captions engine</span>
              <span>✓ Watermark-free MP4</span>
              <span>✓ My Videos history</span>
            </div>
            <Link
              href="/signup?plan=basic"
              className="block sm:inline-block w-full sm:w-auto"
              style={{
                padding: '15px 32px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #2563EB, #22D3EE)',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '1rem',
                textDecoration: 'none',
                boxShadow: '0 8px 28px rgba(34,211,238,.4)',
                boxSizing: 'border-box',
                minHeight: 52,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Start Generating Shorts →
            </Link>
            <p
              style={{
                fontSize: '0.78rem',
                color: '#64748B',
                marginTop: 10,
                fontWeight: 600,
              }}
            >
              From $4.90/month · 7-day money-back guarantee · Cancel anytime.
            </p>
          </div>
        </section>

        {/* Second CTA — repeat the green button after pricing */}
        <section style={{ textAlign: 'center', marginBottom: 40 }}>
          <Link
            href="/signup"
            className="block sm:inline-block w-full sm:w-auto"
            style={{
              padding: '16px 28px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#FFFFFF',
              fontSize: '1rem',
              fontWeight: 900,
              letterSpacing: '-0.01em',
              textDecoration: 'none',
              boxShadow: '0 8px 28px rgba(16,185,129,.40)',
              boxSizing: 'border-box',
              minHeight: 52,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Start Generating Shorts →
          </Link>
          <p style={{ fontSize: '0.78rem', color: '#64748B', marginTop: 10, fontWeight: 600 }}>
            From $4.90/month · 7-day money-back guarantee · Cancel anytime
          </p>
        </section>

        {/* Trust bar */}
        <section
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 14,
            fontSize: '0.78rem',
            color: '#64748B',
            fontWeight: 600,
          }}
        >
          <span>🔒 Secure checkout</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>SSL encrypted</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>Cancel anytime</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>Money-back guarantee</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>No contracts</span>
        </section>
      </div>
      <Footer />
    </main>
  )
}
