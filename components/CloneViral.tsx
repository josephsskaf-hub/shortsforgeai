'use client'

import Link from 'next/link'

const RESULTS = [
  {
    icon: '✅',
    label: 'Hook style detected',
    value: 'Shocking Stat',
    accent: '#34d399',
  },
  {
    icon: '✅',
    label: 'Retention pattern',
    value: 'Fast-cut mystery reveal',
    accent: '#34D399',
  },
  {
    icon: '✅',
    label: 'CTA timing',
    value: '33s mark',
    accent: '#22D3EE',
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
            background: 'rgba(245,158,11,.1)',
            border: '1px solid rgba(245,158,11,.25)',
            marginBottom: 14,
          }}
        >
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#22D3EE', letterSpacing: '0.04em' }}>
            🎬 CLONE ANY VIRAL SHORT
          </span>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: '0.6rem',
              fontWeight: 900,
              color: '#fff',
              background: 'linear-gradient(135deg, #34d399, #14b8a6)',
              letterSpacing: '0.05em',
            }}
          >
            BETA
          </span>
        </div>
        <h2
          style={{
            fontSize: 'clamp(1.55rem, 4vw, 2.15rem)',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            margin: 0,
          }}
        >
          Paste A Viral Video URL →{' '}
          <span style={{ background: 'linear-gradient(135deg, #f59e0b, #22D3EE, #22D3EE)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Get A Script Like It
          </span>
        </h2>
        <p
          style={{
            fontSize: '0.95rem',
            color: 'var(--muted2)',
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
          background: 'linear-gradient(160deg, rgba(14,14,28,.95), rgba(8,8,18,.95))',
          border: '1px solid rgba(245,158,11,.18)',
          boxShadow: '0 0 60px rgba(245,158,11,.08)',
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
            background: 'radial-gradient(ellipse, rgba(34, 211, 238,.16) 0%, transparent 70%)',
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
              color: 'var(--muted2)',
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
                background: 'rgba(0,0,0,.45)',
                border: '1px solid rgba(255,255,255,.08)',
                borderRadius: 12,
                padding: '14px 16px',
                fontSize: '0.88rem',
                color: 'var(--muted)',
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
                borderRadius: 12,
                fontSize: '0.86rem',
                fontWeight: 900,
                color: '#fff',
                border: 'none',
                background: 'linear-gradient(135deg, #f59e0b 0%, #22D3EE 55%, #22D3EE 100%)',
                boxShadow: '0 4px 22px rgba(34, 211, 238,.4)',
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
                color: '#6ee7b7',
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
                  background: 'rgba(255,255,255,.03)',
                  border: '1px solid rgba(255,255,255,.06)',
                  borderLeft: `3px solid ${r.accent}`,
                }}
              >
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{r.icon}</span>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--muted2)',
                    minWidth: 168,
                  }}
                >
                  {r.label}:
                </span>
                <span
                  style={{
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    color: 'var(--text)',
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
          background: 'rgba(16, 185, 129,.06)',
          border: '1px solid rgba(16, 185, 129,.18)',
        }}
      >
        <p style={{ fontSize: '0.82rem', color: 'var(--muted2)', margin: 0, fontWeight: 600 }}>
          🔒 Available for Pro members. Connect your YouTube channel to unlock.
        </p>
        <Link
          href="/pricing"
          style={{
            padding: '10px 22px',
            borderRadius: 10,
            fontSize: '0.82rem',
            fontWeight: 900,
            color: '#fff',
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #10B981, #059669)',
            boxShadow: '0 4px 18px rgba(16, 185, 129,.35)',
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
