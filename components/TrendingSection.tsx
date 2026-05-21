'use client'

import Link from 'next/link'

const TRENDING = [
  {
    id: 'banks',
    emoji: '🏦',
    niche: 'Money Facts',
    nicheColor: '#34d399',
    title: 'The Dark Truth About Banks',
    views: '2.3M views',
    accent: '#f59e0b',
  },
  {
    id: 'brain',
    emoji: '🧠',
    niche: 'Psychology',
    nicheColor: '#22D3EE',
    title: 'This Is How Your Brain Lies To You',
    views: '1.8M views',
    accent: '#ef4444',
  },
  {
    id: 'gov',
    emoji: '👁️',
    niche: 'Conspiracies',
    nicheColor: '#f87171',
    title: "The Government Can't Hide This Anymore",
    views: '4.1M views',
    accent: '#dc2626',
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
            background: 'rgba(239,68,68,.08)',
            border: '1px solid rgba(239,68,68,.22)',
            marginBottom: 12,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#ef4444',
              boxShadow: '0 0 8px rgba(239,68,68,.7)',
              display: 'inline-block',
              animation: 'pulse-trend 1.4s ease-in-out infinite',
            }}
          />
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f87171', letterSpacing: '0.04em' }}>
            🔥 TRENDING THIS WEEK
          </span>
        </div>
        <h2
          style={{
            fontSize: 'clamp(1.4rem, 3.6vw, 1.9rem)',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            margin: 0,
          }}
        >
          What's <span style={{ background: 'linear-gradient(135deg, #f87171, #fb923c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>going viral</span> right now
        </h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: 8, fontWeight: 500 }}>
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
              background: 'linear-gradient(160deg, rgba(20,20,38,.95), rgba(13,13,28,.95))',
              border: '1px solid rgba(255,255,255,.07)',
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
                    background: 'rgba(255,255,255,.04)',
                    border: '1px solid rgba(255,255,255,.08)',
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
                    background: 'linear-gradient(135deg, rgba(239,68,68,.15), rgba(249,115,22,.12))',
                    border: '1px solid rgba(239,68,68,.3)',
                    fontSize: '0.62rem',
                    fontWeight: 900,
                    color: '#fca5a5',
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
                    fontWeight: 900,
                    color: 'var(--text)',
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
                  borderRadius: 11,
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  color: '#fff',
                  textDecoration: 'none',
                  background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                  boxShadow: '0 4px 18px rgba(59, 130, 246,.35)',
                  transition: 'transform .2s ease, box-shadow .2s ease',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.boxShadow = '0 6px 26px rgba(59, 130, 246,.55)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 18px rgba(59, 130, 246,.35)'
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
          border-color: rgba(59, 130, 246,.35) !important;
          box-shadow: 0 14px 44px rgba(59, 130, 246,.18);
        }
        @media (max-width: 900px) { .trending-grid { grid-template-columns: 1fr; } }
        @keyframes pulse-trend { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(0.85)} }
      `}</style>
    </section>
  )
}
