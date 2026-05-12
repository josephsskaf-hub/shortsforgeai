'use client'

import { useEffect, useRef, useState } from 'react'

interface Stat {
  id: string
  target: number
  suffix: string
  label: string
  prefix?: string
  format?: 'number' | 'percent' | 'rank'
  decimals?: number
}

const STATS: Stat[] = [
  { id: 'scripts', target: 47832, suffix: '', label: 'Videos Generated', format: 'number' },
  { id: 'creators', target: 12400, suffix: '+', label: 'Active Creators', format: 'number' },
  { id: 'retention', target: 94, suffix: '%', label: 'Retention Rate', format: 'percent' },
  { id: 'rank', target: 1, suffix: '', prefix: '#', label: 'Tool for Faceless Channels', format: 'rank' },
]

function formatNumber(n: number, format?: string): string {
  if (format === 'percent' || format === 'rank') return Math.round(n).toString()
  return Math.round(n).toLocaleString('en-US')
}

function useCountUp(target: number, durationMs: number, start: boolean) {
  const [value, setValue] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!start) return
    function step(ts: number) {
      if (startTimeRef.current === null) startTimeRef.current = ts
      const elapsed = ts - startTimeRef.current
      const progress = Math.min(1, elapsed / durationMs)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(target * eased)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, durationMs, start])

  return value
}

function StatCard({ stat, animate }: { stat: Stat; animate: boolean }) {
  const value = useCountUp(stat.target, 1800, animate)
  return (
    <div
      style={{
        position: 'relative',
        padding: '28px 22px 26px',
        borderRadius: 18,
        background: 'linear-gradient(160deg, rgba(20,20,38,.85), rgba(13,13,28,.9))',
        border: '1px solid rgba(99,102,241,.18)',
        textAlign: 'center',
        overflow: 'hidden',
        transition: 'transform .25s ease, border-color .25s ease, box-shadow .25s ease',
      }}
      className="stat-card"
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,.16), transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div
          style={{
            fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
            fontWeight: 900,
            background: 'linear-gradient(135deg, #818cf8, #a78bfa, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            marginBottom: 8,
          }}
        >
          {stat.prefix ?? ''}
          {formatNumber(value, stat.format)}
          {stat.suffix}
        </div>
        <div
          style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'var(--muted2)',
            letterSpacing: '0.01em',
            lineHeight: 1.4,
          }}
        >
          {stat.label}
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
            color: 'var(--indigo-light)',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Trusted By Creators
        </div>
        <h2
          style={{
            fontSize: 'clamp(1.4rem, 3.6vw, 2rem)',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
            margin: 0,
          }}
        >
          The numbers don't lie.
        </h2>
      </div>

      <div className="social-proof-grid">
        {STATS.map((s) => (
          <StatCard key={s.id} stat={s} animate={visible} />
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
          border-color: rgba(99,102,241,.4) !important;
          box-shadow: 0 14px 38px rgba(99,102,241,.18);
        }
        @media (max-width: 900px) { .social-proof-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 480px) { .social-proof-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  )
}
