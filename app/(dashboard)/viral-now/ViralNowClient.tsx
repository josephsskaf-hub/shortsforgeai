'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ViralTopic } from '@/lib/viralTopics'
import { getNextRefreshMs } from '@/lib/viralTopics'

// ── Vertical color map ───────────────────────────────────────────────────────
const VERTICAL_COLORS: Record<string, string> = {
  billionaire: '#f59e0b',
  money:       '#8b5cf6',
  mystery:     '#8b5cf6',
  country:     '#8b5cf6',
  learning:    '#06b6d4',
  ai:          '#14b8a6',
  psychology:  '#ec4899',
  history:     '#d97706',
  science:     '#14b8a6',
  health:      '#22c55e',
  space:       '#0ea5e9',
  nature:      '#4ade80',
  technology:  '#a78bfa',
  crime:       '#f87171',
}

// ── Badge styles ─────────────────────────────────────────────────────────────
const BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  'Hot':           { bg: 'rgba(239,68,68,0.18)',   color: '#ef4444' },
  'Trending':      { bg: 'rgba(249,115,22,0.18)',  color: '#f97316' },
  'High Retention':{ bg: 'rgba(139,92,246,0.18)',  color: '#8b5cf6' },
  'Viral':         { bg: 'rgba(139,92,246,0.18)',  color: '#8b5cf6' },
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatCountdown(ms: number): string {
  if (ms <= 0) return '0h 0m'
  const totalMinutes = Math.floor(ms / 60000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h ${m}m`
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '18px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      minHeight: 210,
      animation: 'pulse 1.6s ease-in-out infinite',
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ width: 90, height: 22, borderRadius: 6, background: 'var(--border)' }} />
        <div style={{ flex: 1 }} />
        <div style={{ width: 40, height: 22, borderRadius: 6, background: 'var(--border)' }} />
        <div style={{ width: 60, height: 22, borderRadius: 6, background: 'var(--border)' }} />
      </div>
      <div style={{ width: '85%', height: 18, borderRadius: 6, background: 'var(--border)' }} />
      <div style={{ width: '100%', height: 14, borderRadius: 6, background: 'var(--border)' }} />
      <div style={{ width: '70%', height: 14, borderRadius: 6, background: 'var(--border)' }} />
      <div style={{ width: '50%', height: 12, borderRadius: 6, background: 'var(--border)', marginTop: 4 }} />
      <div style={{ width: '100%', height: 38, borderRadius: 8, background: 'var(--border)', marginTop: 'auto' }} />
    </div>
  )
}

// ── Topic card ────────────────────────────────────────────────────────────────
function TopicCard({ topic, onGenerate }: { topic: ViralTopic; onGenerate: (t: ViralTopic) => void }) {
  const vertColor = VERTICAL_COLORS[topic.vertical] ?? '#14b8a6'
  const badge = BADGE_STYLES[topic.badge] ?? BADGE_STYLES['Trending']

  return (
    <div style={{
      background: 'var(--card)',
      border: `1px solid var(--border)`,
      borderRadius: 14,
      padding: '18px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      transition: 'border-color 0.2s, transform 0.15s',
      cursor: 'default',
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = vertColor
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {/* Label pill */}
        <span style={{
          fontSize: '0.7rem',
          fontWeight: 600,
          padding: '3px 9px',
          borderRadius: 20,
          background: vertColor + '22',
          color: vertColor,
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
        }}>
          {topic.label}
        </span>
        <span style={{ flex: 1 }} />
        {/* Viral score */}
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: 'var(--muted2, #9ca3af)',
        }}>
          🔥 {topic.viralScore}
        </span>
        {/* Badge pill */}
        <span style={{
          fontSize: '0.68rem',
          fontWeight: 600,
          padding: '3px 8px',
          borderRadius: 20,
          background: badge.bg,
          color: badge.color,
          whiteSpace: 'nowrap',
        }}>
          {topic.badge}
        </span>
      </div>

      {/* Title */}
      <p style={{
        margin: 0,
        fontSize: '1.05rem',
        fontWeight: 900,
        lineHeight: 1.25,
        color: 'var(--foreground)',
        letterSpacing: '-0.01em',
      }}>
        {topic.title}
      </p>

      {/* Hook */}
      <p style={{
        margin: 0,
        fontSize: '0.8rem',
        fontStyle: 'italic',
        color: 'var(--muted2, #9ca3af)',
        lineHeight: 1.45,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical' as const,
        overflow: 'hidden',
      }}>
        {topic.hook}
      </p>

      {/* Description */}
      <p style={{
        margin: 0,
        fontSize: '0.72rem',
        color: 'var(--muted, #6b7280)',
        lineHeight: 1.4,
        display: '-webkit-box',
        WebkitLineClamp: 1,
        WebkitBoxOrient: 'vertical' as const,
        overflow: 'hidden',
      }}>
        {topic.description}
      </p>

      {/* CTA button */}
      <button
        onClick={() => onGenerate(topic)}
        style={{
          marginTop: 'auto',
          padding: '10px 0',
          width: '100%',
          borderRadius: 9,
          border: 'none',
          background: `linear-gradient(90deg, ${vertColor}, #ef4444)`,
          color: '#fff',
          fontWeight: 700,
          fontSize: '0.82rem',
          letterSpacing: '0.01em',
          cursor: 'pointer',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.88' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
      >
        Generate Short →
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ViralNowClient() {
  const router = useRouter()
  const [topics, setTopics] = useState<ViralTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  // Fetch topics
  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const res = await fetch('/api/viral-now', { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setTopics(data.topics ?? [])
      } catch (err) {
        console.error('[ViralNowClient] fetch error:', err)
        setError('Could not load topics. Please refresh.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Countdown timer — updates every 30s
  useEffect(() => {
    function tick() {
      const ms = getNextRefreshMs()
      setCountdown(formatCountdown(ms))
    }
    tick()
    const id = setInterval(tick, 30000)
    return () => clearInterval(id)
  }, [])

  const handleGenerate = useCallback((topic: ViralTopic) => {
    const url = `/generate?prompt=${encodeURIComponent(topic.prompt)}&autoanalyze=1&duration=${topic.duration}`
    router.push(url)
  }, [router])

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h1 style={{
            margin: 0,
            fontSize: '1.6rem',
            fontWeight: 900,
            color: 'var(--foreground)',
            letterSpacing: '-0.02em',
          }}>
            🔥 Viral Now
          </h1>
          {/* Pulsing red dot */}
          <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <span style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#ef4444',
              boxShadow: '0 0 0 0 rgba(239,68,68,0.6)',
              animation: 'viralPulse 1.8s ease-out infinite',
            }} />
          </span>
        </div>
        <p style={{
          margin: 0,
          fontSize: '0.82rem',
          color: 'var(--muted, #6b7280)',
        }}>
          {todayLabel()} &middot; Refreshes in{' '}
          <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>
            {countdown || '…'}
          </span>
        </p>
      </div>

      {/* ── Grid ── */}
      {error ? (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          color: '#ef4444',
          fontSize: '0.9rem',
          background: 'rgba(239,68,68,0.08)',
          borderRadius: 12,
          border: '1px solid rgba(239,68,68,0.2)',
        }}>
          {error}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : topics.map(topic => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  onGenerate={handleGenerate}
                />
              ))
          }
        </div>
      )}

      {/* ── Footer ── */}
      <p style={{
        marginTop: 32,
        textAlign: 'center',
        fontSize: '0.72rem',
        color: 'var(--muted, #6b7280)',
      }}>
        6 topics &middot; Refreshes every 4 hours &middot; Powered by ShortsForgeAI
      </p>

      {/* ── Keyframes via style tag ── */}
      <style>{`
        @keyframes viralPulse {
          0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.6); }
          70%  { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
          100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
      `}</style>
    </div>
  )
}
