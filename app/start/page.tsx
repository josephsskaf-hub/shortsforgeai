import Link from 'next/link'
import Footer from '@/components/Footer'

// Push #107 — Google Ads landing page. Single conversion target
// (Start Free → /signup), zero outbound links to other marketing pages
// so the ad spend doesn't bleed into reading the homepage. Server
// component; everything below is static markup that the CDN can serve.
// Push #116 — Footer now mounted here for Terms/Privacy/Contact links.
// Google Ads policy effectively requires a Privacy Policy link on
// landing pages, and the legal-only Footer doesn't break the ad-LP
// discipline (no marketing-page links).

const HOW_IT_WORKS: { step: string; title: string }[] = [
  { step: '1', title: 'Type your idea' },
  { step: '2', title: 'AI builds your Short' },
  { step: '3', title: 'Download & upload to YouTube' },
]

const SOCIAL_PROOF: { icon: string; text: string; accent: string }[] = [
  { icon: '⚡', text: '500+ creators', accent: '#22D3EE' },
  { icon: '★★★★★', text: 'Loved by YouTubers', accent: '#FBBF24' },
  { icon: '🎬', text: '200+ Shorts created', accent: '#34D399' },
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
        {/* Logo (text only — no links so the user never leaves) */}
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
            Turn Any Idea Into a{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #34D399, #22D3EE)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Viral YouTube Short
            </span>
          </h1>
          <p
            style={{
              fontSize: 'clamp(0.95rem, 2.6vw, 1.1rem)',
              color: '#94A3B8',
              maxWidth: 540,
              margin: '0 auto',
              lineHeight: 1.55,
            }}
          >
            AI writes the script, finds footage, adds captions &amp; music. Ready in 60 seconds.
          </p>
        </section>

        {/* Primary CTA */}
        <section style={{ textAlign: 'center', marginBottom: 32 }}>
          {/* Push #117 — anchor is block-level on mobile so the green
              button spans the full content width and clears the 44 px
              touch-target floor by a comfortable margin. Desktop keeps
              the inline-block "pill" framing via the sm: utilities. */}
          <Link
            href="/signup"
            className="start-primary-cta block sm:inline-block w-full sm:w-auto"
            style={{
              padding: '18px 28px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#FFFFFF',
              fontSize: '1.05rem',
              fontWeight: 900,
              letterSpacing: '-0.01em',
              textDecoration: 'none',
              boxShadow: '0 10px 32px rgba(16,185,129,.45)',
              boxSizing: 'border-box',
              minHeight: 56,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Start Free — No Credit Card Needed →
          </Link>
          <p
            style={{
              fontSize: '0.8rem',
              color: '#94A3B8',
              marginTop: 12,
              fontWeight: 600,
            }}
          >
            2 free videos · Cancel anytime · Ready in 60s
          </p>
        </section>

        {/* Social proof pills */}
        <section
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 48,
          }}
        >
          {SOCIAL_PROOF.map((p) => (
            <div
              key={p.text}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
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
        <section style={{ marginBottom: 48 }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
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
                fontSize: 'clamp(1.3rem, 4vw, 1.6rem)',
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            }}
          >
            {HOW_IT_WORKS.map((s) => (
              <div
                key={s.step}
                style={{
                  background: 'rgba(11,17,32,0.85)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 14,
                  padding: '16px 18px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #2563EB, #22D3EE)',
                    color: '#FFFFFF',
                    fontWeight: 900,
                    fontSize: '0.95rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 10,
                  }}
                >
                  {s.step}
                </div>
                <div
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {s.title}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Push #109 — demo video. Only renders when the env var is set
            so the ad LP doesn't carry a "coming soon" placeholder. */}
        {process.env.NEXT_PUBLIC_DEMO_VIDEO_URL && (
          <section style={{ textAlign: 'center', marginBottom: 48 }}>
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

        {/* Push #110 — stats bar. Compact muted line right above the FAQ
            so the social signals land before the buyer reads objections. */}
        <p
          style={{
            textAlign: 'center',
            fontSize: '0.8rem',
            color: '#94A3B8',
            marginBottom: 28,
            fontWeight: 500,
          }}
        >
          3,200+ videos generated · 4.8★ average rating · 7-day free trial
        </p>

        {/* Push #110 — FAQ. <details>/<summary> keeps this a server
            component (no useState). Four highest-value objections lifted
            from the ad cohort: face/camera, post-trial billing, time-to-
            value, and free-tier scope. */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              {
                q: 'Do I need a camera or show my face?',
                a: 'No. ShortsForgeAI generates visuals, voiceover, and subtitles from a topic you type. 100% faceless.',
              },
              {
                q: "What happens after the free trial?",
                a: "Basic is $4.99/month and Pro is $9.90/month. Cancel anytime.",
              },
              {
                q: 'How long does it take?',
                a: 'Under 60 seconds in Fast Mode. Type topic → Generate → Download.',
              },
              {
                q: "What’s in the free plan?",
                a: "2 full videos, no credit card required. Upgrade only when you’re ready.",
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

        {/* Pricing — Basic highlight */}
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
                padding: '4px 12px',
                borderRadius: 999,
                boxShadow: '0 4px 18px rgba(34,211,238,.45)',
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
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: '2.4rem',
                  fontWeight: 900,
                  letterSpacing: '-0.02em',
                  color: '#F5F7FF',
                  lineHeight: 1,
                }}
              >
                $4.99
              </span>
            </div>
            <div
              style={{
                fontSize: '0.8rem',
                color: '#22D3EE',
                fontWeight: 800,
                marginBottom: 18,
              }}
            >
              / month
            </div>
            <Link
              href="/signup?plan=basic"
              className="block sm:inline-block w-full sm:w-auto"
              style={{
                padding: '14px 28px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #2563EB, #22D3EE)',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: '0.95rem',
                textDecoration: 'none',
                boxShadow: '0 8px 28px rgba(34,211,238,.4)',
                boxSizing: 'border-box',
                minHeight: 48,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Start 7-Day Free Trial →
            </Link>
            <p
              style={{
                fontSize: '0.78rem',
                color: '#94A3B8',
                marginTop: 12,
                fontWeight: 600,
              }}
            >
              No charge for 7 days. Cancel anytime.
            </p>
          </div>
        </section>

        {/* Trust bar */}
        <section
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 14,
            fontSize: '0.78rem',
            color: '#94A3B8',
            fontWeight: 600,
          }}
        >
          <span>🔒 Secure checkout</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>SSL</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>Cancel anytime</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>Money-back if not satisfied</span>
        </section>
      </div>
      <Footer />
    </main>
  )
}
