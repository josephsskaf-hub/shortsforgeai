'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface DashboardClientProps {
  isPro: boolean
  generationsUsed: number
  totalGenerations: number
  isLoggedIn: boolean
}

interface QuickCard {
  href: string
  emoji: string
  title: string
  subtitle: string
  accent: string
  glow: string
}

const CARDS: QuickCard[] = [
  {
    href: '/create',
    emoji: '🎬',
    title: 'Create Video',
    subtitle: 'Any topic, any niche',
    accent: 'rgba(99,102,241,.4)',
    glow: 'rgba(99,102,241,.18)',
  },
  {
    href: '/create?niche=history',
    emoji: '📖',
    title: 'History Video',
    subtitle: 'Historical facts, civilizations, wars',
    accent: 'rgba(245,158,11,.4)',
    glow: 'rgba(245,158,11,.16)',
  },
  {
    href: '/create?niche=mystery',
    emoji: '🔮',
    title: 'Mystery Video',
    subtitle: 'Conspiracies, secrets, phenomena',
    accent: 'rgba(168,85,247,.4)',
    glow: 'rgba(168,85,247,.18)',
  },
]

export default function DashboardClient({
  totalGenerations,
  isLoggedIn,
}: DashboardClientProps) {
  const [credits, setCredits] = useState<number | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(true)

  useEffect(() => {
    if (!isLoggedIn) {
      setCreditsLoading(false)
      return
    }
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/credits', { cache: 'no-store' })
        if (!res.ok) throw new Error('failed')
        const data = await res.json()
        if (!cancelled) setCredits(typeof data.credits === 'number' ? data.credits : 0)
      } catch {
        if (!cancelled) setCredits(0)
      } finally {
        if (!cancelled) setCreditsLoading(false)
      }
    }
    load()
    function refresh() {
      load()
    }
    window.addEventListener('creditsChanged', refresh)
    return () => {
      cancelled = true
      window.removeEventListener('creditsChanged', refresh)
    }
  }, [isLoggedIn])

  const creditsZero = credits !== null && credits <= 0

  return (
    <div className="px-4 md:px-6 py-7 pb-20">
      {/* Hero */}
      <div
        className="relative rounded-[20px] overflow-hidden mb-6 px-6 md:px-8 py-7 text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,.1) 0%, rgba(124,58,237,.07) 50%, rgba(168,85,247,.06) 100%)',
          border: '1px solid rgba(99,102,241,.18)',
          boxShadow: '0 0 60px rgba(99,102,241,.07)',
        }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            width: 460, height: 320,
            background: 'radial-gradient(ellipse, rgba(99,102,241,.18) 0%, transparent 70%)',
            top: -80, left: '50%', transform: 'translateX(-50%)',
          }}
        />

        <div className="flex justify-center mb-3 relative z-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
            style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.22)', color: '#34d399' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981', boxShadow: '0 0 6px rgba(52,211,153,.6)' }} />
            ⚡ Autopilot Mode
          </div>
        </div>

        <h1
          className="font-black tracking-tight mb-2 relative z-10"
          style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.1rem)', color: 'var(--text)', lineHeight: 1.1 }}
        >
          Create your next{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #818cf8, #c4b5fd, #a855f7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Viral Short
          </span>
        </h1>

        <p
          className="relative z-10 mx-auto"
          style={{ fontSize: '0.9rem', color: 'var(--muted2)', maxWidth: 460, lineHeight: 1.55 }}
        >
          Pick a shortcut below and let AI generate everything in one click — script, voice, visuals and captions.
        </p>
      </div>

      {/* 3-card quick-create grid */}
      <div className="grid gap-4 mb-7" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group relative rounded-[20px] p-6 transition-all flex flex-col"
            style={{
              background: 'rgba(15,15,30,0.85)',
              border: `1px solid ${card.accent}`,
              boxShadow: `0 0 30px ${card.glow}`,
              textDecoration: 'none',
              minHeight: 220,
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
              ;(e.currentTarget as HTMLElement).style.boxShadow = `0 12px 40px ${card.glow}`
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
              ;(e.currentTarget as HTMLElement).style.boxShadow = `0 0 30px ${card.glow}`
            }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: `linear-gradient(135deg, ${card.accent}, ${card.glow})`,
                border: `1px solid ${card.accent}`,
                fontSize: '1.6rem',
              }}
            >
              {card.emoji}
            </div>
            <div className="font-black mb-1.5" style={{ fontSize: '1.15rem', color: 'var(--text)' }}>
              {card.title}
            </div>
            <div className="text-sm mb-5 flex-1" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
              {card.subtitle}
            </div>
            <div
              className="self-start inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
                boxShadow: '0 4px 18px rgba(99,102,241,.32)',
              }}
            >
              Create Now →
            </div>
          </Link>
        ))}
      </div>

      {/* Credit balance */}
      {isLoggedIn && (
        <div
          className="rounded-[20px] px-6 py-5 mb-5 flex items-center justify-between flex-wrap gap-4"
          style={{
            background: creditsZero
              ? 'rgba(239,68,68,.06)'
              : 'rgba(15,15,30,0.85)',
            border: creditsZero
              ? '1px solid rgba(239,68,68,.25)'
              : '1px solid rgba(99,102,241,.22)',
            boxShadow: '0 0 30px rgba(99,102,241,.08)',
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
              style={{
                background: creditsZero
                  ? 'linear-gradient(135deg, rgba(239,68,68,.25), rgba(239,68,68,.12))'
                  : 'linear-gradient(135deg, rgba(16,185,129,.25), rgba(52,211,153,.12))',
                border: creditsZero
                  ? '1px solid rgba(239,68,68,.4)'
                  : '1px solid rgba(16,185,129,.4)',
              }}
            >
              ⚡
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-widest mb-0.5" style={{ color: creditsZero ? '#f87171' : 'var(--muted)', fontSize: '0.6rem' }}>
                Credit Balance
              </div>
              {creditsLoading ? (
                <div
                  className="rounded"
                  style={{
                    width: 240,
                    height: 22,
                    background: 'rgba(255,255,255,.05)',
                    animation: 'pulse 1.4s ease-in-out infinite',
                  }}
                />
              ) : (
                <div className="font-black" style={{ fontSize: '1.05rem', color: 'var(--text)' }}>
                  You have{' '}
                  <span style={{ color: creditsZero ? '#f87171' : '#34d399' }}>
                    {credits ?? 0} credit{credits === 1 ? '' : 's'}
                  </span>{' '}
                  available
                </div>
              )}
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                Each video uses 1 credit.
              </div>
            </div>
          </div>
          <Link
            href="/pricing"
            className="rounded-xl px-5 py-2.5 text-sm font-black text-white transition-all"
            style={{
              background: creditsZero
                ? 'linear-gradient(135deg, #ef4444, #f87171)'
                : 'linear-gradient(135deg, var(--indigo), var(--purple))',
              boxShadow: creditsZero
                ? '0 4px 18px rgba(239,68,68,.35)'
                : '0 4px 18px rgba(99,102,241,.32)',
              textDecoration: 'none',
            }}
          >
            {creditsZero ? '💳 Buy Credits' : '+ More Credits'}
          </Link>
        </div>
      )}

      {/* Activity strip */}
      {isLoggedIn && totalGenerations > 0 && (
        <div
          className="flex items-center gap-4 rounded-xl px-4 py-3 flex-wrap"
          style={{ background: 'rgba(255,255,255,.025)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>🎬</span>
            <span className="text-xs font-black" style={{ color: 'var(--text)' }}>{totalGenerations}</span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>packs generated</span>
          </div>
          <div className="w-px h-3" style={{ background: 'var(--border)' }} />
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: '0.7rem', color: '#34d399' }}>●</span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>Viral Engine Online</span>
          </div>
          <div className="ml-auto">
            <Link href="/history" className="text-xs font-bold" style={{ color: 'var(--indigo-light)', textDecoration: 'none' }}>
              View history →
            </Link>
          </div>
        </div>
      )}

      {/* Logged-out CTA */}
      {!isLoggedIn && (
        <div
          className="rounded-[20px] px-6 py-7 text-center"
          style={{
            background: 'rgba(15,15,30,0.85)',
            border: '1px solid rgba(99,102,241,.22)',
          }}
        >
          <p className="font-bold text-base mb-2" style={{ color: 'var(--text)' }}>
            🔑 Create your account to start
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--muted2)' }}>
            3 free credits on signup — just sign in.
          </p>
        </div>
      )}

    </div>
  )
}
