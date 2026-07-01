'use client'

import Link from 'next/link'

const RESULTS = [
  {
    icon: '✅',
    label: 'Hook style detected',
    value: 'Shocking Stat',
    accent: '#2997ff',
  },
  {
    icon: '✅',
    label: 'Retention pattern',
    value: 'Fast-cut mystery reveal',
    accent: '#2997ff',
  },
  {
    icon: '✅',
    label: 'CTA timing',
    value: '33s mark',
    accent: '#2997ff',
  },
]

export default function CloneViral() {
  return (
    <section
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '32px 24px 64px',
        maxWidth: 1100,
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
            background: 'rgba(41,151,255,.1)',
            border: '1px solid rgba(41,151,255,.25)',
            marginBottom: 14,
          }}
        >
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#2997ff', letterSpacing: '0.04em' }}>
            🎬 CLONE ANY VIRAL SHORT
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
            BETA
          </span>
        </div>
        <h2
          style={{
            fontSize: 'clamp(1.55rem, 4vw, 2.15rem)',
            fontWeight: 600,
            letterSpacing: '-0.025em',
            background: 'linear-gradient(180deg,#fff 35%,#a1a1a6)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
          }}
        >
          Paste A Viral Video URL →{' '}
          <span style={{ color: '#2997ff', WebkitTextFillColor: '#2997ff' }}>
            Get A Script Like It
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
          See a Short with 5M views? Clone the format, not the content. Our AI reverse-engineers what made it go viral.
        </p>
      </div>

      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '28px 24px 26px',
          borderRadius: 20,
          background: '#161618',
          border: '1px solid #2a2a2d',
          boxShadow: '0 0 60px rgba(41,151,255,.06)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -100,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 460,
            height: 220,
            background: 'radial-gradient(ellipse, rgba(41,151,255,.14) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
              fontSize: '0.7rem',
              fontWeight: 800,
              color: '#86868b',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            <span style={{ fontSize: '0.9rem' }}>🔗</span> Viral Short URL
          </div>

          <div className="clone-input-row">
            <div
              className="clone-input"
              style={{
                flex: 1,
                background: '#000',
                border: '1px solid #2a2a2d',
                borderRadius: 12,
                padding: '14px 16px',
                fontSize: '0.88rem',
                color: '#86868b',
                fontFamily: 'monospace',
                letterSpacing: '-0.01em',
                userSelect: 'none',
              }}
            >
              Paste YouTube Shorts URL here... (e.g. youtube.com/shorts/...)
            </div>
            <button
              type="button"
              className="clone-btn"
              style={{
                padding: '14px 22px',
                borderRadius: 980,
                fontSize: '0.86rem',
                fontWeight: 600,
                color: '#000',
                border: 'none',
                background: '#f5f5f7',
                boxShadow: 'none',
                cursor: 'not-allowed',
                whiteSpace: 'nowrap',
                opacity: 0.95,
              }}
            >
              🔍 Analyze &amp; Clone →
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gap: 10,
              marginTop: 22,
            }}
          >
            <div
              style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                color: '#2997ff',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 2,
              }}
            >
              ⚡ Sample analysis
            </div>
            {RESULTS.map((r) => (
              <div
                key={r.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: '#1d1d1f',
                  border: '1px solid #2a2a2d',
                  borderLeft: `3px solid ${r.accent}`,
                }}
              >
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{r.icon}</span>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#86868b',
                    minWidth: 168,
                  }}
                >
                  {r.label}:
                </span>
                <span
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    color: '#f5f5f7',
                  }}
                >
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: 720,
          margin: '20px auto 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
          padding: '14px 20px',
          borderRadius: 14,
          background: '#161618',
          border: '1px solid #2a2a2d',
        }}
      >
        <p style={{ fontSize: '0.82rem', color: '#86868b', margin: 0, fontWeight: 600 }}>
          🔒 Available for Pro members. Connect your YouTube channel to unlock.
        </p>
        <Link
          href="/pricing"
          style={{
            padding: '10px 22px',
            borderRadius: 980,
            fontSize: '0.82rem',
            fontWeight: 600,
            color: '#000',
            textDecoration: 'none',
            background: '#f5f5f7',
            boxShadow: 'none',
            flexShrink: 0,
          }}
        >
          Get Pro Access →
        </Link>
      </div>

      <style>{`
        .clone-input-row {
          display: flex;
          gap: 10px;
          align-items: stretch;
        }
        @media (max-width: 600px) {
          .clone-input-row { flex-direction: column; }
          .clone-btn { width: 100%; }
        }
      `}</style>
    </section>
  )
}
