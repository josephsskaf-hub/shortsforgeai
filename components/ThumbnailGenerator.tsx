'use client'

import Link from 'next/link'

const THUMBNAILS = [
  {
    id: 'number',
    icon: '🔴',
    style: 'The Number',
    text: '7 SECRETS Banks Don\'t Want You To Know',
    accent: '#f5f5f7',
  },
  {
    id: 'challenge',
    icon: '⚡',
    style: 'The Challenge',
    text: 'I Tried This For 30 Days (SHOCKING Results)',
    accent: '#2997ff',
  },
  {
    id: 'question',
    icon: '❓',
    style: 'The Question',
    text: 'What Would Happen If You Did THIS Every Day?',
    accent: '#86868b',
  },
  {
    id: 'warning',
    icon: '💀',
    style: 'The Warning',
    text: 'STOP Doing This — It\'s Ruining Your Channel',
    accent: '#2997ff',
  },
]

export default function ThumbnailGenerator() {
  return (
    <section
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '32px 24px 64px',
        maxWidth: 1200,
        margin: '0 auto',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 14px',
            borderRadius: 999,
            background: 'rgba(41,151,255,.1)',
            border: '1px solid rgba(41,151,255,.25)',
            marginBottom: 14,
          }}
        >
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#2997ff', letterSpacing: '0.04em' }}>
            🖼️ THUMBNAIL TEXT GENERATOR
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: '0.6rem',
              fontWeight: 900,
              color: '#000',
              background: '#f5f5f7',
              letterSpacing: '0.05em',
            }}
          >
            PRO
          </span>
        </div>
        <h2
          style={{
            fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
            fontWeight: 600,
            letterSpacing: '-0.025em',
            background: 'linear-gradient(180deg,#fff 35%,#a1a1a6)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
          }}
        >
          🖼️{' '}
          <span style={{ color: '#2997ff', WebkitTextFillColor: '#2997ff' }}>
            Thumbnail Text Generator
          </span>
        </h2>
        <p
          style={{
            fontSize: '0.95rem',
            color: '#86868b',
            marginTop: 12,
            maxWidth: 620,
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: 1.6,
          }}
        >
          The right 3 words on your thumbnail = 10x more clicks. Generate proven thumbnail text formulas for any niche — instantly.
        </p>
      </div>

      <div className="thumb-grid">
        {THUMBNAILS.map((t) => (
          <div
            key={t.id}
            className="thumb-card"
            style={{
              position: 'relative',
              padding: '22px 22px 24px 24px',
              borderRadius: 16,
              background: '#161618',
              border: '1px solid #2a2a2d',
              borderLeft: `4px solid ${t.accent}`,
              overflow: 'hidden',
              transition: 'transform .25s ease, border-color .25s ease, box-shadow .25s ease',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 90,
                background: `radial-gradient(circle at 0% 0%, ${t.accent}26, transparent 70%)`,
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: `linear-gradient(135deg, ${t.accent}33, ${t.accent}14)`,
                    border: `1px solid ${t.accent}40`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.15rem',
                    flexShrink: 0,
                  }}
                >
                  {t.icon}
                </div>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    color: t.accent,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {t.style}
                </span>
              </div>
              <div
                style={{
                  background: '#000',
                  border: '1px solid #2a2a2d',
                  borderRadius: 12,
                  padding: '20px 18px',
                  textAlign: 'center',
                }}
              >
                <p
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 900,
                    color: '#fff',
                    margin: 0,
                    lineHeight: 1.25,
                    letterSpacing: '-0.01em',
                    textShadow: `0 0 18px ${t.accent}55`,
                  }}
                >
                  {t.text}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <Link
          href="/pricing"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 32px',
            borderRadius: 980,
            fontSize: '0.92rem',
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
          🔒 Generate Thumbnail Text — Pro Only →
        </Link>
      </div>

      <style>{`
        .thumb-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
          max-width: 980px;
          margin: 0 auto;
        }
        .thumb-card:hover {
          transform: translateY(-3px);
          border-color: #3a3a3d !important;
          box-shadow: 0 14px 38px rgba(0,0,0,.45);
        }
        @media (max-width: 720px) { .thumb-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  )
}
