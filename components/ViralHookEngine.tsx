'use client'

import Link from 'next/link'

const HOOKS = [
  {
    id: 'stat',
    icon: '🎯',
    name: 'The Shocking Stat',
    example: '"99% of people don\'t know this about [TOPIC]"',
    accent: '#818cf8',
  },
  {
    id: 'question',
    icon: '❓',
    name: 'The Question Hook',
    example: '"What would happen if [TOPIC]?"',
    accent: '#34d399',
  },
  {
    id: 'claim',
    icon: '🔥',
    name: 'The Bold Claim',
    example: '"This is the most [TOPIC] thing ever discovered"',
    accent: '#f59e0b',
  },
  {
    id: 'fear',
    icon: '😱',
    name: 'The Fear Trigger',
    example: '"Stop what you\'re doing. [TOPIC] is more dangerous than you think"',
    accent: '#ef4444',
  },
]

export default function ViralHookEngine() {
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
            background: 'rgba(99,102,241,.1)',
            border: '1px solid rgba(99,102,241,.25)',
            marginBottom: 14,
          }}
        >
          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#a5b4fc', letterSpacing: '0.04em' }}>
            ⚡ HOOK ENGINE
          </span>
        </div>
        <h2
          style={{
            fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            margin: 0,
          }}
        >
          ⚡ Viral{' '}
          <span style={{ background: 'linear-gradient(135deg, #818cf8, #a78bfa, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Hook Engine
          </span>
        </h2>
        <p
          style={{
            fontSize: '0.95rem',
            color: 'var(--muted2)',
            marginTop: 12,
            maxWidth: 580,
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: 1.6,
          }}
        >
          Every viral Short starts with a hook that stops the scroll. Generate 5 different hook styles for any topic — instantly.
        </p>
      </div>

      <div className="hook-grid">
        {HOOKS.map((h) => (
          <div
            key={h.id}
            className="hook-card"
            style={{
              position: 'relative',
              padding: '20px 20px 18px 22px',
              borderRadius: 16,
              background: 'linear-gradient(160deg, rgba(18,18,34,.92), rgba(11,11,24,.92))',
              border: '1px solid rgba(255,255,255,.07)',
              borderLeft: `3px solid ${h.accent}`,
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
                height: 70,
                background: `radial-gradient(circle at 0% 0%, ${h.accent}22, transparent 70%)`,
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: `linear-gradient(135deg, ${h.accent}33, ${h.accent}14)`,
                    border: `1px solid ${h.accent}40`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.15rem',
                    flexShrink: 0,
                  }}
                >
                  {h.icon}
                </div>
                <h3
                  style={{
                    fontSize: '0.92rem',
                    fontWeight: 900,
                    color: 'var(--text)',
                    margin: 0,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {h.name}
                </h3>
              </div>
              <p
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--muted2)',
                  fontStyle: 'italic',
                  lineHeight: 1.55,
                  margin: 0,
                  borderTop: '1px dashed rgba(255,255,255,.08)',
                  marginTop: 10,
                  paddingTop: 12,
                }}
              >
                {h.example}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 32px',
            borderRadius: 14,
            fontSize: '0.92rem',
            fontWeight: 900,
            color: '#fff',
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)',
            boxShadow: '0 6px 28px rgba(99,102,241,.45)',
            transition: 'transform .2s ease, box-shadow .2s ease',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
            ;(e.currentTarget as HTMLElement).style.boxShadow = '0 10px 36px rgba(99,102,241,.6)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
            ;(e.currentTarget as HTMLElement).style.boxShadow = '0 6px 28px rgba(99,102,241,.45)'
          }}
        >
          Generate Hooks For Your Niche →
        </Link>
      </div>

      <style>{`
        .hook-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          max-width: 900px;
          margin: 0 auto;
        }
        .hook-card:hover {
          transform: translateY(-3px);
          border-color: rgba(255,255,255,.18) !important;
          box-shadow: 0 14px 38px rgba(0,0,0,.4);
        }
        @media (max-width: 720px) { .hook-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  )
}
