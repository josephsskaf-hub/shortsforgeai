'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface DashboardClientProps {
  isPro: boolean
  generationsUsed: number
  totalGenerations: number
  isLoggedIn: boolean
}

const TOP_PICKS: { id: string; label: string; emoji: string; accent: string; glow: string }[] = [
  { id: 'mystery',         label: 'Mystery',      emoji: '🔮', accent: 'rgba(168,85,247,.45)',  glow: 'rgba(168,85,247,.18)' },
  { id: 'strange-facts',   label: 'Facts',         emoji: '🤯', accent: 'rgba(99,102,241,.45)', glow: 'rgba(99,102,241,.16)' },
  { id: 'money',           label: 'Money',         emoji: '💰', accent: 'rgba(16,185,129,.4)',  glow: 'rgba(16,185,129,.14)' },
  { id: 'ai-tools',        label: 'AI',            emoji: '🤖', accent: 'rgba(6,182,212,.4)',   glow: 'rgba(6,182,212,.14)' },
  { id: 'psychology-facts',label: 'Psychology',    emoji: '🧠', accent: 'rgba(245,158,11,.4)',  glow: 'rgba(245,158,11,.14)' },
  { id: 'space-mysteries', label: 'Space',         emoji: '🌌', accent: 'rgba(99,102,241,.45)', glow: 'rgba(99,102,241,.16)' },
  { id: 'history',         label: 'History',       emoji: '📖', accent: 'rgba(245,158,11,.4)',  glow: 'rgba(245,158,11,.14)' },
  { id: 'conspiracy-files',label: 'Conspiracy',    emoji: '🕵️', accent: 'rgba(239,68,68,.35)',  glow: 'rgba(239,68,68,.12)' },
  { id: 'luxury-lifestyle',label: 'Luxury',        emoji: '💎', accent: 'rgba(251,191,36,.4)',  glow: 'rgba(251,191,36,.14)' },
  { id: 'dark-history',    label: 'Dark Stories',  emoji: '💀', accent: 'rgba(239,68,68,.4)',   glow: 'rgba(239,68,68,.14)' },
]

export default function DashboardClient({
  totalGenerations,
  isLoggedIn,
}: DashboardClientProps) {
  const router = useRouter()
  const [credits, setCredits] = useState<number | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(true)
  const [videoPrompt, setVideoPrompt] = useState('')

  function handleVideoGenerate() {
    const p = videoPrompt.trim()
    if (!p) {
      router.push('/generate')
      return
    }
    // autoanalyze=1 makes /generate kick off the analyze step automatically,
    // so the user never sees a second "type a prompt" screen.
    router.push(`/generate?prompt=${encodeURIComponent(p)}&autoanalyze=1`)
  }

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
    function refresh() { load() }
    window.addEventListener('creditsChanged', refresh)
    return () => {
      cancelled = true
      window.removeEventListener('creditsChanged', refresh)
    }
  }, [isLoggedIn])

  const creditsZero = credits !== null && credits <= 0

  function handlePickClick(nicheId: string) {
    router.push(`/create?niche=${nicheId}`)
  }

  return (
    <div className="px-4 md:px-6 py-5 md:py-7 pb-28 md:pb-20">

      {/* ── Hero ── */}
      <div
        className="relative rounded-[20px] overflow-hidden mb-7 px-6 md:px-8 py-8 text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,.12) 0%, rgba(124,58,237,.08) 50%, rgba(168,85,247,.07) 100%)',
          border: '1px solid rgba(99,102,241,.2)',
          boxShadow: '0 0 80px rgba(99,102,241,.1)',
        }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            width: 520, height: 360,
            background: 'radial-gradient(ellipse, rgba(99,102,241,.22) 0%, transparent 70%)',
            top: -100, left: '50%', transform: 'translateX(-50%)',
          }}
        />

        <div className="flex justify-center mb-3 relative z-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
            style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.22)', color: '#34d399' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#10b981', boxShadow: '0 0 6px rgba(52,211,153,.7)', animation: 'pulse 1.8s ease-in-out infinite' }}
            />
            ⚡ Viral Engine Online
          </div>
        </div>

        <h1
          className="font-black tracking-tight mb-2 relative z-10"
          style={{ fontSize: 'clamp(1.6rem, 3.8vw, 2.3rem)', color: 'var(--text)', lineHeight: 1.08 }}
        >
          Your next{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #3B82F6, #c4b5fd, #a855f7)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Viral Short
          </span>{' '}
          is one click away
        </h1>

        <p
          className="relative z-10 mx-auto mb-5"
          style={{ fontSize: '0.9rem', color: 'var(--muted2)', maxWidth: 480, lineHeight: 1.55 }}
        >
          Pick a niche below — AI writes the script, generates the voice, finds visuals and renders the MP4 automatically.
        </p>

        <Link
          href="/create"
          className="relative z-10 inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-black text-white"
          style={{
            background: 'linear-gradient(135deg, #2563EB 0%, #7c3aed 55%, #a855f7 100%)',
            boxShadow: '0 4px 32px rgba(99,102,241,.5)',
            textDecoration: 'none',
          }}
        >
          ✍️ Create Video
        </Link>
      </div>

      {/* ── 🎬 NEW: AI Video Generator (RunwayML) ── */}
      <div
        className="relative rounded-[20px] overflow-hidden mb-7 px-5 md:px-6 py-5 md:py-6"
        style={{
          background: 'linear-gradient(135deg, rgba(168,85,247,.12) 0%, rgba(236,72,153,.06) 100%)',
          border: '1px solid rgba(168,85,247,.32)',
          boxShadow: '0 0 60px rgba(168,85,247,.12)',
        }}
      >
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span
            className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded"
            style={{
              background: 'rgba(168,85,247,.18)',
              border: '1px solid rgba(168,85,247,.32)',
              color: '#c4b5fd',
            }}
          >
            🎬 Beta · AI Video
          </span>
          <span
            className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded"
            style={{
              background: 'rgba(16,185,129,.1)',
              border: '1px solid rgba(16,185,129,.3)',
              color: '#34d399',
            }}
          >
            Powered by RunwayML
          </span>
        </div>
        <h2
          className="font-black tracking-tight mb-1.5"
          style={{ fontSize: 'clamp(1.1rem, 2.8vw, 1.4rem)', color: 'var(--text)', lineHeight: 1.1 }}
        >
          Generate a real AI Short from one prompt
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
          Type your idea — we plan 4 cinematic scenes and RunwayML Gen-4 Turbo renders a vertical
          9:16 video in ~1–2 minutes.
        </p>
        <div
          style={{
            padding: 8,
            borderRadius: 14,
            background: 'rgba(13,13,28,.85)',
            border: '1px solid rgba(168,85,247,.3)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <textarea
            value={videoPrompt}
            onChange={(e) => setVideoPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleVideoGenerate()
              }
            }}
            placeholder="e.g. A neon Tokyo alley at midnight with a lone samurai"
            maxLength={500}
            rows={2}
            style={{
              width: '100%',
              minHeight: 64,
              resize: 'none',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: '0.9rem',
              padding: '10px 12px',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleVideoGenerate}
              className="rounded-xl px-5 py-2.5 text-sm font-black text-white"
              style={{
                background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 22px rgba(168,85,247,.45)',
                whiteSpace: 'nowrap',
              }}
            >
              ⚡ Generate Video →
            </button>
          </div>
        </div>
      </div>

      {/* ── 🔥 Top Picks Grid ── */}
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-4">
          <span style={{ fontSize: '1rem' }}>🔥</span>
          <span className="font-black text-sm uppercase tracking-widest" style={{ color: 'var(--text)', fontSize: '0.72rem', letterSpacing: '0.12em' }}>
            Top Picks
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-bold ml-1"
            style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171', fontSize: '0.55rem' }}
          >
            VIRAL
          </span>
        </div>

        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}
        >
          {TOP_PICKS.map((niche) => (
            <TopPickCard
              key={niche.id}
              niche={niche}
              onClick={() => handlePickClick(niche.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Credit balance ── */}
      {isLoggedIn && (
        <div
          className="rounded-[20px] px-5 py-4 mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
          style={{
            background: creditsZero ? 'rgba(239,68,68,.06)' : 'rgba(15,15,30,0.85)',
            border: creditsZero ? '1px solid rgba(239,68,68,.25)' : '1px solid rgba(99,102,241,.22)',
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
              <div
                className="text-xs font-black uppercase tracking-widest mb-0.5"
                style={{ color: creditsZero ? '#f87171' : 'var(--muted)', fontSize: '0.6rem' }}
              >
                Credit Balance
              </div>
              {creditsLoading ? (
                <div
                  className="rounded"
                  style={{
                    width: 200, height: 20,
                    background: 'rgba(255,255,255,.05)',
                    animation: 'pulse 1.4s ease-in-out infinite',
                  }}
                />
              ) : (
                <div className="font-black" style={{ fontSize: '1rem', color: 'var(--text)' }}>
                  You have{' '}
                  <span style={{ color: creditsZero ? '#f87171' : '#34d399' }}>
                    {credits ?? 0} credit{credits === 1 ? '' : 's'}
                  </span>{' '}
                  available
                </div>
              )}
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                Basic Short = 15 credits · Pro Short = 20 credits.
              </div>
            </div>
          </div>
          <Link
            href="/pricing"
            className="block text-center rounded-xl px-5 py-2.5 text-sm font-black text-white transition-all md:inline-block"
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

      {/* ── Activity strip ── */}
      {isLoggedIn && totalGenerations > 0 && (
        <div
          className="flex items-center gap-4 rounded-xl px-4 py-3 flex-wrap"
          style={{ background: 'rgba(255,255,255,.025)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>🎬</span>
            <span className="text-xs font-black" style={{ color: 'var(--text)' }}>{totalGenerations}</span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>scripts generated</span>
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

      {/* ── Logged-out CTA ── */}
      {!isLoggedIn && (
        <div
          className="rounded-[20px] px-6 py-7 text-center"
          style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid rgba(99,102,241,.22)' }}
        >
          <p className="font-bold text-base mb-2" style={{ color: 'var(--text)' }}>
            🔑 Create your account to start
          </p>
          <p className="text-sm mb-4" style={{ color: 'var(--muted2)' }}>
            2 free credits on signup — just sign in.
          </p>
        </div>
      )}
    </div>
  )
}

function TopPickCard({
  niche,
  onClick,
}: {
  niche: { id: string; label: string; emoji: string; accent: string; glow: string }
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col items-center justify-center gap-2 rounded-2xl py-4 px-3 text-center transition-all"
      style={{
        background: hovered
          ? `linear-gradient(135deg, ${niche.glow.replace(')', ', 1.6)')}, ${niche.glow})`
          : 'rgba(15,15,30,0.85)',
        border: `1px solid ${hovered ? niche.accent : 'rgba(255,255,255,.06)'}`,
        boxShadow: hovered ? `0 0 28px ${niche.glow}` : '0 0 0 transparent',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-2px) scale(1.02)' : 'translateY(0) scale(1)',
        minHeight: 90,
      }}
    >
      <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{niche.emoji}</span>
      <span
        className="font-black"
        style={{ fontSize: '0.75rem', color: hovered ? 'var(--text)' : 'var(--muted2)', letterSpacing: '0.02em' }}
      >
        {niche.label}
      </span>
      {hovered && (
        <span
          className="absolute bottom-1.5 right-2 text-xs font-bold"
          style={{ color: niche.accent.replace('rgba(', 'rgba(').replace(', .4)', ', 1)').replace(', .45)', ', 1)'), fontSize: '0.55rem', letterSpacing: '0.08em' }}
        >
          ⚡ GO
        </span>
      )}
    </button>
  )
}
