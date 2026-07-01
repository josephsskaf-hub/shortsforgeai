'use client'

import Link from 'next/link'

const TRENDING = [
  {
    id: 'banks',
    emoji: '🏦',
    niche: 'Money Facts',
    nicheColor: '#2997ff',
    title: 'The Dark Truth About Banks',
    views: '2.3M views',
    accent: '#86868b',
  },
  {
    id: 'brain',
    emoji: '🧠',
    niche: 'Psychology',
    nicheColor: '#2997ff',
    title: 'This Is How Your Brain Lies To You',
    views: '1.8M views',
    accent: '#f5f5f7',
  },
  {
    id: 'gov',
    emoji: '👁️',
    niche: 'Conspiracies',
    nicheColor: '#86868b',
    title: "The Government Can't Hide This Anymore",
    views: '4.1M views',
    accent: '#2997ff',
  },
]

export default function TrendingSection() {
  return (
    <section
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '32px 24px 56px',
        maxWidth: 1200,
        margin: '0 auto',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 14px',
            borderRadius: 999,
            background: 'rgba(41,151,255,.08)',
            border: '1px solid rgba(41,151,255,.22)',
            marginBottom: 12,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#2997ff',
              boxShadow: '0 0 8px rgba(41,151,255,.7)',
              display: 'inline-block',
              animation: 'pulse-trend 1.4s ease-in-out infinite',
            }}
          />
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#2997ff', letterSpacing: '0.04em' }}>
            🔥 TRENDING THIS WEEK
          </span>
        </div>
        <h2
          style={{
            fontSize: 'clamp(1.4rem, 3.6vw, 1.9rem)',
            fontWeight: 600,
            letterSpacing: '-0.025em',
            background: 'linear-gradient(180deg,#fff 35%,#a1a1a6)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
          }}
        >
          What's <span style={{ color: '#2997ff', WebkitTextFillColor: '#2997ff' }}>going viral</span> right now
        </h2>
        <p style={{ fontSize: '0.85rem', color: '#86868b', marginTop: 8, fontWeight: 500 }}>
          Topics blowing up across faceless YouTube — generate similar Shorts in seconds.
        </p>
      </div>

      <div className="trending-grid">
        {TRENDING.map((item) => (
          <div
            key={item.id}
            className="trending-card"
            style={{
              position: 'relative',
              borderRadius: 18,
              padding: '20px 20px 18px',
              background: '#161618',
              border: '1px solid #2a2a2d',
              overflow: 'hidden',
              transition: 'transform .25s ease, border-color .25s ease, box-shadow .25s ease',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(circle at 100% 0%, ${item.accent}22, transparent 60%)`,
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: '#1d1d1f',
                    border: '1px solid #2a2a2d',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    color: item.nicheColor,
                    letterSpacing: '0.04em',
                  }}
                >
                  {item.niche.toUpperCase()}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(41,151,255,.1)',
                    border: '1px solid rgba(41,151,255,.3)',
                    fontSize: '0.62rem',
                    fontWeight: 900,
                    color: '#2997ff',
                    letterSpacing: '0.02em',
                  }}
                >
                  🔥 {item.views}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 18 }}>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    background: `linear-gradient(135deg, ${item.accent}30, ${item.accent}12)`,
                    border: `1px solid ${item.accent}40`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    flexShrink: 0,
                  }}
                >
                  {item.emoji}
                </div>
                <h3
                  style={{
                    fontSize: '1rem',
                    fontWeight: 700,
                    color: '#f5f5f7',
                    lineHeight: 1.3,
                    letterSpacing: '-0.01em',
                    margin: 0,
                  }}
                >
                  {item.title}
                </h3>
              </div>

              <Link
                href="/dashboard"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '11px 16px',
                  borderRadius: 980,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#000',
                  textDecoration: 'none',
                  background: '#f5f5f7',
                  boxShadow: 'none',
                  transition: 'transform .18s ease, background .18s ease',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = '#fff'
                  ;(e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.background = '#f5f5f7'
                  ;(e.currentTarget as HTMLElement).style.transform = 'scale(1)'
                }}
              >
                Generate Similar →
              </Link>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .trending-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .trending-card:hover {
          transform: translateY(-3px) scale(1.02);
          border-color: #3a3a3d !important;
          box-shadow: 0 14px 44px rgba(0,0,0,.35);
        }
        @media (max-width: 900px) { .trending-grid { grid-template-columns: 1fr; } }
        @keyframes pulse-trend { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(0.85)} }
      `}</style>
    </section>
  )
}
