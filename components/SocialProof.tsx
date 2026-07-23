'use client'

// ROBO1-HONEST-2026-06-28 — Replaced invented "300+ Active Creators" /
// "300+ Videos Generated" / "94% Retention" / "#1 Tool" counters (none of
// which were verifiable) with HONEST trust signals: indie-founder
// transparency, the free-first promise, the real FOUNDING50 founding-member
// framing (first 10 seats, 50% off locked forever — mirrors /founding), and
// concrete capability badges. No invented numbers remain. The default export
// and its (prop-less) API are unchanged so importers still compile.

import { useEffect, useRef, useState } from 'react'

interface TrustSignal {
  id: string
  icon: string
  title: string
  sub: string
  accent: string
}

// Only real, verifiable product facts. Keep this component aligned with the
// canonical free-Fast access and current monthly offer before reusing it.
const TRUST_SIGNALS: TrustSignal[] = [
  {
    id: 'free',
    icon: '🎬',
    title: 'Up to 3 Fast previews / 24h',
    sub: 'Watermarked · no card',
    accent: '#2997ff',
  },
  {
    id: 'pricing',
    icon: '🔑',
    title: 'Simple monthly plans',
    sub: 'Cancel anytime · 7-day money-back',
    accent: '#2997ff',
  },
  {
    id: 'indie',
    icon: '⚡',
    title: 'Built by an indie founder',
    sub: 'Shipping improvements daily',
    accent: '#f5f5f7',
  },
  {
    id: 'spec',
    icon: '✅',
    title: 'Ready to post, per topic',
    sub: '9:16 · a few minutes · English · AI voice + B-roll',
    accent: '#86868b',
  },
]

function SignalCard({ signal, visible, index }: { signal: TrustSignal; visible: boolean; index: number }) {
  return (
    <div
      style={{
        position: 'relative',
        padding: '24px 20px',
        borderRadius: 18,
        background: '#161618',
        border: `1px solid ${signal.accent}2e`,
        textAlign: 'left',
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(14px)',
        transition: `opacity .5s ease ${index * 90}ms, transform .5s ease ${index * 90}ms, border-color .25s ease, box-shadow .25s ease`,
      }}
      className="stat-card"
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 12% 0%, ${signal.accent}26, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div
          style={{
            fontSize: '1.5rem',
            lineHeight: 1,
            marginBottom: 12,
          }}
          aria-hidden
        >
          {signal.icon}
        </div>
        <div
          style={{
            fontSize: '0.98rem',
            fontWeight: 800,
            color: '#f5f5f7',
            letterSpacing: '-0.01em',
            lineHeight: 1.25,
            marginBottom: 6,
          }}
        >
          {signal.title}
        </div>
        <div
          style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            color: '#86868b',
            letterSpacing: '0.005em',
            lineHeight: 1.4,
          }}
        >
          {signal.sub}
        </div>
      </div>
    </div>
  )
}

export default function SocialProof() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    const node = ref.current
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true)
            obs.unobserve(node)
          }
        })
      },
      { threshold: 0.25 }
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [])

  return (
    <section
      ref={ref}
      style={{
        position: 'relative',
        zIndex: 10,
        padding: '40px 24px 64px',
        maxWidth: 1200,
        margin: '0 auto',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div
          style={{
            fontSize: '0.6rem',
            fontWeight: 800,
            letterSpacing: '0.14em',
            color: '#2997ff',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Why creators start here
        </div>
        <h2
          style={{
            fontSize: 'clamp(1.4rem, 3.6vw, 2rem)',
            fontWeight: 600,
            letterSpacing: '-0.025em',
            background: 'linear-gradient(180deg,#fff 35%,#a1a1a6)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
          }}
        >
          No hype. Try the full Fast workflow first.
        </h2>
      </div>

      <div className="social-proof-grid">
        {TRUST_SIGNALS.map((s, i) => (
          <SignalCard key={s.id} signal={s} visible={visible} index={i} />
        ))}
      </div>

      <style>{`
        .social-proof-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          max-width: 1000px;
          margin: 0 auto;
        }
        .stat-card:hover {
          transform: translateY(-3px) scale(1.02);
          border-color: #3a3a3d !important;
          box-shadow: 0 14px 38px rgba(0,0,0,.35);
        }
        @media (max-width: 900px) { .social-proof-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .social-proof-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  )
}
