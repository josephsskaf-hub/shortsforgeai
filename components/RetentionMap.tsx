'use client'

const STAGES = [
  {
    id: 'hook',
    range: '0–3s',
    icon: '🎯',
    name: 'HOOK',
    desc: 'Stop the scroll. Make them stay.',
    accent: '#818cf8',
  },
  {
    id: 'curiosity',
    range: '3–10s',
    icon: '🤔',
    name: 'CURIOSITY',
    desc: 'Build intrigue. Keep them watching.',
    accent: '#34d399',
  },
  {
    id: 'value',
    range: '10–25s',
    icon: '📖',
    name: 'VALUE',
    desc: 'Deliver the info. Earn the trust.',
    accent: '#f59e0b',
  },
  {
    id: 'escalation',
    range: '25–32s',
    icon: '🔥',
    name: 'ESCALATION',
    desc: 'Raise the stakes. Peak tension.',
    accent: '#ef4444',
  },
  {
    id: 'cta',
    range: '32–35s',
    icon: '📣',
    name: 'CTA',
    desc: 'Channel plug + shortsforgeai.com',
    accent: '#ec4899',
  },
]

export default function RetentionMap() {
  return (
    <section
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '32px 24px 64px',
        maxWidth: 1300,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          position: 'relative',
          borderRadius: 24,
          padding: '44px 28px 48px',
          background: 'linear-gradient(135deg, rgba(99,102,241,.08), rgba(236,72,153,.05) 60%, rgba(245,158,11,.06))',
          border: '1px solid rgba(99,102,241,.18)',
          boxShadow: '0 0 80px rgba(99,102,241,.10)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -80,
            width: 380,
            height: 380,
            background: 'radial-gradient(ellipse, rgba(168,85,247,.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ textAlign: 'center', marginBottom: 36, position: 'relative', zIndex: 1 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 14px',
              borderRadius: 999,
              background: 'rgba(52,211,153,.1)',
              border: '1px solid rgba(52,211,153,.25)',
              marginBottom: 14,
            }}
          >
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6ee7b7', letterSpacing: '0.04em' }}>
              📊 RETENTION MAP
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
            Script Built For{' '}
            <span style={{ background: 'linear-gradient(135deg, #34d399, #818cf8, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Retention
            </span>
            , Not Just Views
          </h2>
          <p
            style={{
              fontSize: '0.95rem',
              color: 'var(--muted2)',
              marginTop: 12,
              maxWidth: 600,
              marginLeft: 'auto',
              marginRight: 'auto',
              lineHeight: 1.6,
            }}
          >
            Every script we generate follows the proven Shorts retention structure.
          </p>
        </div>

        <div className="retention-flow" style={{ position: 'relative', zIndex: 1 }}>
          {STAGES.map((s, i) => (
            <div key={s.id} className="retention-row">
              <div
                className="retention-card"
                style={{
                  position: 'relative',
                  padding: '18px 16px 18px',
                  borderRadius: 14,
                  background: 'linear-gradient(160deg, rgba(14,14,28,.95), rgba(8,8,18,.95))',
                  border: '1px solid rgba(255,255,255,.06)',
                  borderTop: `3px solid ${s.accent}`,
                  overflow: 'hidden',
                  transition: 'transform .25s ease, box-shadow .25s ease',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 60,
                    background: `radial-gradient(circle at 50% 0%, ${s.accent}26, transparent 70%)`,
                    pointerEvents: 'none',
                  }}
                />
                <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: `linear-gradient(135deg, ${s.accent}33, ${s.accent}14)`,
                      border: `1px solid ${s.accent}40`,
                      fontSize: '1.3rem',
                      marginBottom: 10,
                    }}
                  >
                    {s.icon}
                  </div>
                  <div
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 900,
                      color: s.accent,
                      letterSpacing: '0.1em',
                      marginBottom: 4,
                    }}
                  >
                    {s.range}
                  </div>
                  <div
                    style={{
                      fontSize: '0.86rem',
                      fontWeight: 900,
                      color: 'var(--text)',
                      letterSpacing: '0.04em',
                      marginBottom: 6,
                    }}
                  >
                    {s.name}
                  </div>
                  <p
                    style={{
                      fontSize: '0.74rem',
                      color: 'var(--muted2)',
                      lineHeight: 1.45,
                      margin: 0,
                    }}
                  >
                    {s.desc}
                  </p>
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <div className="retention-arrow" style={{ color: s.accent }}>
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .retention-flow {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 8px;
          align-items: stretch;
        }
        .retention-row {
          position: relative;
          display: flex;
          align-items: stretch;
        }
        .retention-card {
          flex: 1;
          width: 100%;
        }
        .retention-arrow {
          position: absolute;
          top: 50%;
          right: -14px;
          transform: translateY(-50%);
          font-size: 1.4rem;
          font-weight: 900;
          z-index: 2;
          opacity: .85;
          pointer-events: none;
          text-shadow: 0 0 12px currentColor;
        }
        .retention-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 14px 36px rgba(0,0,0,.4);
        }
        @media (max-width: 900px) {
          .retention-flow {
            grid-template-columns: 1fr;
            gap: 18px;
          }
          .retention-arrow {
            position: static;
            transform: rotate(90deg);
            display: block;
            text-align: center;
            margin: -4px auto 0;
          }
          .retention-row {
            flex-direction: column;
          }
        }
      `}</style>
    </section>
  )
}
