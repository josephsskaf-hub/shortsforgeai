'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Push #317 — YouTube analytics types
interface ChannelStats {
  subscriberCount: number
  viewCount: number
  videoCount: number
  channelTitle: string
  channelId: string
  thumbnailUrl: string | null
}

// Push #301 — Viral Now topic type
interface ViralTopic {
  slot: number
  emoji: string
  label: string
  title: string
  prompt: string
  duration: number
  vertical: string
}

interface DashboardClientProps {
  isPro: boolean
  generationsUsed: number
  totalGenerations: number
  isLoggedIn: boolean
}

// Push #305 — vertical-specific colors for Viral Now cards (matches /viral-now page)
const VERTICAL_COLORS: Record<string, { bg: string; border: string; pill: string; text: string; hover: string }> = {
  billionaire: { bg: 'rgba(11,17,32,0.85)', border: 'rgba(251,191,36,.28)', pill: 'rgba(251,191,36,.15)', text: '#fbbf24', hover: 'rgba(251,191,36,.5)' },
  money:       { bg: 'rgba(11,17,32,0.85)', border: 'rgba(34,197,94,.28)',  pill: 'rgba(34,197,94,.15)',  text: '#4ade80', hover: 'rgba(34,197,94,.5)'  },
  mystery:     { bg: 'rgba(11,17,32,0.85)', border: 'rgba(168,85,247,.28)', pill: 'rgba(168,85,247,.15)', text: '#c084fc', hover: 'rgba(168,85,247,.5)' },
  country:     { bg: 'rgba(11,17,32,0.85)', border: 'rgba(59,130,246,.28)', pill: 'rgba(59,130,246,.15)', text: '#60a5fa', hover: 'rgba(59,130,246,.5)' },
  learning:    { bg: 'rgba(11,17,32,0.85)', border: 'rgba(236,72,153,.28)', pill: 'rgba(236,72,153,.15)', text: '#f472b6', hover: 'rgba(236,72,153,.5)' },
}
const DEFAULT_VERTICAL = { bg: 'rgba(11,17,32,0.85)', border: 'rgba(239,68,68,.22)', pill: 'rgba(239,68,68,.14)', text: '#f87171', hover: 'rgba(239,68,68,.5)' }

// Push #031 removed the dashboard "Top Picks" niche grid. Topic shortcuts
// live in the homepage hero textarea + quick-tag chips now.

export default function DashboardClient({
  totalGenerations,
  isLoggedIn,
}: DashboardClientProps) {
  const router = useRouter()
  const [credits, setCredits] = useState<number | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(true)
  const [videoPrompt, setVideoPrompt] = useState('')

  // Push #301 — Viral Now
  const [viralTopics, setViralTopics] = useState<ViralTopic[]>([])
  const [viralLoading, setViralLoading] = useState(true)
  const viralFetchedRef = useRef(false)

  // Push #317 — YouTube channel stats
  const [ytStats, setYtStats] = useState<ChannelStats | null>(null)
  const [ytConnected, setYtConnected] = useState<boolean | null>(null)
  const ytFetchedRef = useRef(false)

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

  // Push #301 — Fetch Viral Now topics once on mount
  useEffect(() => {
    if (viralFetchedRef.current) return
    viralFetchedRef.current = true
    fetch('/api/viral-now', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.topics)) setViralTopics(d.topics) })
      .catch(() => {})
      .finally(() => setViralLoading(false))
  }, [])

  // Push #317 — Fetch YouTube status + stats once on mount (logged-in only)
  useEffect(() => {
    if (!isLoggedIn || ytFetchedRef.current) return
    ytFetchedRef.current = true
    fetch('/api/youtube/status')
      .then(r => r.json())
      .then(d => {
        setYtConnected(!!d.connected)
        if (d.connected) {
          fetch('/api/youtube/analytics')
            .then(r => r.json())
            .then(a => { if (a.channelStats) setYtStats(a.channelStats) })
            .catch(() => {})
        }
      })
      .catch(() => setYtConnected(false))
  }, [isLoggedIn])

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

  // Supabase Realtime — keep the balance live across every device/tab by
  // pushing DB changes to this client, not just the same-window
  // `creditsChanged` event above.
  useEffect(() => {
    if (!isLoggedIn) return
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return
      channel = supabase
        .channel('credits-realtime-dashboard')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          (payload) => {
            const row = payload.new as { video_credits?: number }
            if (typeof row.video_credits === 'number') setCredits(row.video_credits)
          },
        )
        .subscribe()
    })
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [isLoggedIn])

  const creditsZero = credits !== null && credits <= 0

  return (
    <div className="px-4 md:px-6 py-5 md:py-7 pb-28 md:pb-20">

      {/* ── Hero ── */}
      <div
        className="relative rounded-[20px] overflow-hidden mb-7 px-6 md:px-8 py-8 text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246,.12) 0%, rgba(37, 99, 235,.08) 50%, rgba(34, 211, 238,.07) 100%)',
          border: '1px solid rgba(59, 130, 246,.2)',
          boxShadow: '0 0 80px rgba(59, 130, 246,.1)',
        }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            width: 520, height: 360,
            background: 'radial-gradient(ellipse, rgba(59, 130, 246,.22) 0%, transparent 70%)',
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
              background: 'linear-gradient(135deg, #3B82F6, #22D3EE, #22D3EE)',
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
          Describe any idea — AI writes the script, generates the voice, finds visuals and renders the MP4 automatically.
        </p>

        <Link
          href="/generate"
          className="relative z-10 inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-black text-white"
          style={{
            background: 'linear-gradient(135deg, #2563EB 0%, #2563EB 55%, #22D3EE 100%)',
            boxShadow: '0 4px 32px rgba(59, 130, 246,.5)',
            textDecoration: 'none',
          }}
        >
          ✍️ Create Video
        </Link>
      </div>

      {/* ── 🔥 Push #301: Viral Now ── */}
      <div className="mb-7">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,.8)', animation: 'pulse 1.4s ease-in-out infinite' }}
            />
            <span className="font-black text-sm" style={{ color: 'var(--text)' }}>🔥 Viral Now</span>
            <span
              className="text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)', color: '#f87171' }}
            >
              Trending Today
            </span>
          </div>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>1 click → auto-generate</span>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {viralLoading
            ? [1, 2, 3, 4, 5, 6].map(i => (
                <div
                  key={i}
                  className="rounded-[16px] px-4 py-4"
                  style={{
                    background: 'rgba(255,255,255,.03)',
                    border: '1px solid var(--border)',
                    height: 120,
                    animation: 'pulse 1.4s ease-in-out infinite',
                  }}
                />
              ))
            : viralTopics.map(topic => {
                // Push #305 — vertical-specific color theming (matches /viral-now page)
                const c = VERTICAL_COLORS[topic.vertical] ?? DEFAULT_VERTICAL
                const url = `/generate?prompt=${encodeURIComponent(topic.prompt)}&autoanalyze=1&duration=${topic.duration}`
                return (
                  <button
                    key={topic.slot}
                    type="button"
                    onClick={() => router.push(url)}
                    className="text-left rounded-[16px] px-4 py-4 transition-all"
                    style={{
                      background: c.bg,
                      border: `1px solid ${c.border}`,
                      boxShadow: `0 0 24px ${c.pill}`,
                      cursor: 'pointer',
                      width: '100%',
                    }}
                    onMouseEnter={e => {
                      ;(e.currentTarget as HTMLElement).style.borderColor = c.hover
                      ;(e.currentTarget as HTMLElement).style.boxShadow = `0 0 32px ${c.pill}`
                    }}
                    onMouseLeave={e => {
                      ;(e.currentTarget as HTMLElement).style.borderColor = c.border
                      ;(e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${c.pill}`
                    }}
                  >
                    {/* Pill label */}
                    <div className="mb-2">
                      <span
                        className="text-xs font-black px-2 py-0.5 rounded-full"
                        style={{ background: c.pill, color: c.text, border: `1px solid ${c.border}` }}
                      >
                        {topic.label}
                      </span>
                    </div>
                    {/* Title */}
                    <p className="font-black text-sm leading-tight mb-3" style={{ color: 'var(--text)' }}>
                      {topic.title}
                    </p>
                    {/* CTA row */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>
                        ⏱ {topic.duration}s · Fast Mode
                      </span>
                      <span
                        className="text-xs font-black px-3 py-1.5 rounded-lg text-white"
                        style={{
                          background: `linear-gradient(135deg, ${c.text}, #ef4444)`,
                          boxShadow: `0 3px 12px ${c.pill}`,
                        }}
                      >
                        ⚡ Generate →
                      </span>
                    </div>
                  </button>
                )
              })}
        </div>
      </div>

      {/* ── 🎬 NEW: AI Video Generator (RunwayML) ── */}
      <div
        className="relative rounded-[20px] overflow-hidden mb-7 px-5 md:px-6 py-5 md:py-6"
        style={{
          background: 'linear-gradient(135deg, rgba(34, 211, 238,.12) 0%, rgba(34, 211, 238,.06) 100%)',
          border: '1px solid rgba(34, 211, 238,.32)',
          boxShadow: '0 0 60px rgba(34, 211, 238,.12)',
        }}
      >
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span
            className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded"
            style={{
              background: 'rgba(34, 211, 238,.18)',
              border: '1px solid rgba(34, 211, 238,.32)',
              color: '#22D3EE',
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
            border: '1px solid rgba(34, 211, 238,.3)',
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
                background: 'linear-gradient(135deg, #22D3EE, #22D3EE)',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 22px rgba(34, 211, 238,.45)',
                whiteSpace: 'nowrap',
              }}
            >
              ⚡ Generate Video →
            </button>
          </div>
        </div>
      </div>

      {/* Push #031 removed the Top Picks grid that lived here. Credit
          balance card follows directly after the hero CTA now. */}

      {/* ── Push #317: YouTube channel analytics ── */}
      {isLoggedIn && ytConnected !== null && (
        <div
          className="rounded-[20px] px-5 py-4 mb-5"
          style={{
            background: 'rgba(11,17,32,0.85)',
            border: ytConnected ? '1px solid rgba(255,0,0,.22)' : '1px solid var(--border)',
          }}
        >
          {ytConnected && ytStats ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
                  style={{ background: 'rgba(255,0,0,.12)', border: '1px solid rgba(255,0,0,.3)' }}
                >
                  ▶
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted)', fontSize: '0.6rem' }}>
                    YouTube Channel
                  </div>
                  <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                    {ytStats.channelTitle}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { fetch('/api/youtube/disconnect', { method: 'POST' }).then(() => { setYtConnected(false); setYtStats(null) }) }}
                  className="ml-auto text-xs"
                  style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Disconnect
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Subscribers', value: ytStats.subscriberCount.toLocaleString() },
                  { label: 'Total Views', value: ytStats.viewCount.toLocaleString() },
                  { label: 'Videos', value: ytStats.videoCount.toLocaleString() },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl p-3 text-center"
                    style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,0,0,.12)' }}
                  >
                    <div className="font-black text-base" style={{ color: '#ff4444' }}>{value}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </>
          ) : ytConnected && !ytStats ? (
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
                style={{ background: 'rgba(255,0,0,.12)', border: '1px solid rgba(255,0,0,.3)' }}
              >
                ▶
              </div>
              <div className="text-sm" style={{ color: 'var(--muted)' }}>Loading channel stats…</div>
            </div>
          ) : (
            // Not connected
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
                  style={{ background: 'rgba(255,255,255,.05)', border: '1px solid var(--border)' }}
                >
                  ▶
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted)', fontSize: '0.6rem' }}>
                    YouTube
                  </div>
                  <div className="text-sm" style={{ color: 'var(--muted2)' }}>Connect to auto-upload & track analytics</div>
                </div>
              </div>
              <a
                href="/api/youtube/auth"
                className="rounded-xl px-4 py-2 text-xs font-bold"
                style={{
                  background: 'rgba(255,0,0,.12)',
                  border: '1px solid rgba(255,0,0,.3)',
                  color: '#ff4444',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                ▶ Connect YouTube
              </a>
            </div>
          )}
        </div>
      )}

      {/* ── Credit balance ── */}
      {isLoggedIn && (
        <div
          className="rounded-[20px] px-5 py-4 mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
          style={{
            background: creditsZero ? 'rgba(239,68,68,.06)' : 'rgba(11,17,32,0.85)',
            border: creditsZero ? '1px solid rgba(239,68,68,.25)' : '1px solid rgba(59, 130, 246,.22)',
            boxShadow: '0 0 30px rgba(59, 130, 246,.08)',
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
                1 credit = 1 Fast Mode video.
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
                : '0 4px 18px rgba(59, 130, 246,.32)',
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
            <span className="text-xs" style={{ color: 'var(--muted)' }}>videos generated</span>
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
          style={{ background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(59, 130, 246,.22)' }}
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

// TopPickCard component was deleted in push #031 along with the niche grid
// it rendered for.
