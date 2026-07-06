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
  billionaire: { bg: '#161618', border: 'rgba(41,151,255,.28)', pill: 'rgba(41,151,255,.14)', text: '#2997ff', hover: 'rgba(41,151,255,.5)' },
  money:       { bg: '#161618', border: 'rgba(41,151,255,.28)', pill: 'rgba(41,151,255,.14)', text: '#5cb3ff', hover: 'rgba(41,151,255,.5)' },
  mystery:     { bg: '#161618', border: '#3a3a3d',               pill: 'rgba(255,255,255,.06)', text: '#f5f5f7', hover: '#48484a' },
  country:     { bg: '#161618', border: '#3a3a3d',               pill: 'rgba(255,255,255,.06)', text: '#f5f5f7', hover: '#48484a' },
  learning:    { bg: '#161618', border: 'rgba(41,151,255,.28)', pill: 'rgba(41,151,255,.14)', text: '#7cc0ff', hover: 'rgba(41,151,255,.5)' },
  space:       { bg: '#161618', border: 'rgba(41,151,255,.28)', pill: 'rgba(41,151,255,.14)', text: '#2997ff', hover: 'rgba(41,151,255,.5)' },
  nature:      { bg: '#161618', border: '#3a3a3d',               pill: 'rgba(255,255,255,.06)', text: '#f5f5f7', hover: '#48484a' },
  technology:  { bg: '#161618', border: 'rgba(41,151,255,.28)', pill: 'rgba(41,151,255,.14)', text: '#7cc0ff', hover: 'rgba(41,151,255,.5)' },
  crime:       { bg: '#161618', border: '#3a3a3d',               pill: 'rgba(255,255,255,.06)', text: '#f5f5f7', hover: '#48484a' },
}
const DEFAULT_VERTICAL = { bg: '#161618', border: '#2a2a2d', pill: 'rgba(255,255,255,.05)', text: '#86868b', hover: '#3a3a3d' }

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

  // ── Referral loop ──────────────────────────────────────────────────────
  // Push #444 — the referral attribute/qualify trigger and the Invite & Earn
  // card both moved out of this (dead, redirected) page. Attribution now lives
  // in <ReferralAutoTrigger/> (dashboard layout, fires on every authenticated
  // page) and the card is its own component on the reachable /referral page.

  const creditsZero = credits !== null && credits <= 0

  return (
    <div className="px-4 md:px-6 py-5 md:py-7 pb-28 md:pb-20">

      {/* ── Hero ── */}
      <div
        className="relative rounded-[20px] overflow-hidden mb-7 px-6 md:px-8 py-8 text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(41,151,255,.12) 0%, rgba(41,151,255,.06) 50%, rgba(255,255,255,.03) 100%)',
          border: '1px solid #2a2a2d',
          boxShadow: '0 0 80px rgba(41,151,255,.08)',
        }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            width: 520, height: 360,
            background: 'radial-gradient(ellipse, rgba(41,151,255,.18) 0%, transparent 70%)',
            top: -100, left: '50%', transform: 'translateX(-50%)',
          }}
        />

        <div className="flex justify-center mb-3 relative z-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
            style={{ background: 'rgba(41,151,255,.1)', border: '1px solid rgba(41,151,255,.25)', color: '#2997ff' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#2997ff', boxShadow: '0 0 6px rgba(41,151,255,.7)', animation: 'pulse 1.8s ease-in-out infinite' }}
            />
            ⚡ Viral Engine Online
          </div>
        </div>

        <h1
          className="font-black tracking-tight mb-2 relative z-10"
          style={{ fontSize: 'clamp(1.6rem, 3.8vw, 2.3rem)', color: '#f5f5f7', lineHeight: 1.08 }}
        >
          Your next{' '}
          <span
            style={{
              background: 'linear-gradient(180deg,#fff 35%,#a1a1a6)',
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
          style={{ fontSize: '0.9rem', color: '#86868b', maxWidth: 480, lineHeight: 1.55 }}
        >
          Describe any idea — AI writes the script, generates the voice, finds visuals and renders the MP4 automatically.
        </p>

        <Link
          href="/generate"
          className="relative z-10 inline-flex items-center gap-2 rounded-[980px] px-7 py-3.5 text-sm font-black transition-all"
          style={{
            background: '#f5f5f7',
            color: '#000',
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
              style={{ background: '#2997ff', boxShadow: '0 0 8px rgba(41,151,255,.8)', animation: 'pulse 1.4s ease-in-out infinite' }}
            />
            <span className="font-black text-sm" style={{ color: '#f5f5f7' }}>🔥 Viral Now</span>
            <span
              className="text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(41,151,255,.12)', border: '1px solid rgba(41,151,255,.25)', color: '#2997ff' }}
            >
              Trending Today
            </span>
          </div>
          <span className="text-xs" style={{ color: '#86868b' }}>1 click → auto-generate</span>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {viralLoading
            ? [1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div
                  key={i}
                  className="rounded-[16px] px-4 py-4"
                  style={{
                    background: 'rgba(255,255,255,.03)',
                    border: '1px solid #2a2a2d',
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
                    <p className="font-black text-sm leading-tight mb-3" style={{ color: '#f5f5f7' }}>
                      {topic.title}
                    </p>
                    {/* CTA row */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: '#86868b' }}>
                        ⏱ {topic.duration}s · Fast Mode
                      </span>
                      <span
                        className="text-xs font-black px-3 py-1.5 rounded-lg"
                        style={{
                          background: '#f5f5f7',
                          color: '#000',
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
          background: '#161618',
          border: '1px solid #2a2a2d',
        }}
      >
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span
            className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded"
            style={{
              background: 'rgba(41,151,255,.14)',
              border: '1px solid rgba(41,151,255,.32)',
              color: '#2997ff',
            }}
          >
            🎬 Beta · AI Video
          </span>
          <span
            className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded"
            style={{
              background: 'rgba(255,255,255,.05)',
              border: '1px solid #3a3a3d',
              color: '#86868b',
            }}
          >
            Powered by RunwayML
          </span>
        </div>
        <h2
          className="font-black tracking-tight mb-1.5"
          style={{ fontSize: 'clamp(1.1rem, 2.8vw, 1.4rem)', color: '#f5f5f7', lineHeight: 1.1 }}
        >
          Generate a real AI Short from one prompt
        </h2>
        <p className="text-sm mb-4" style={{ color: '#86868b', lineHeight: 1.5 }}>
          Type your idea — we plan 4 cinematic scenes and RunwayML Gen-4 Turbo renders a vertical
          9:16 video in ~1–2 minutes.
        </p>
        <div
          style={{
            padding: 8,
            borderRadius: 14,
            background: '#1d1d1f',
            border: '1px solid #2a2a2d',
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
              color: '#f5f5f7',
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
              className="rounded-[980px] px-5 py-2.5 text-sm font-black transition-all"
              style={{
                background: '#f5f5f7',
                color: '#000',
                border: 'none',
                cursor: 'pointer',
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
            background: '#161618',
            border: ytConnected ? '1px solid #3a3a3d' : '1px solid #2a2a2d',
          }}
        >
          {ytConnected && ytStats ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
                  style={{ background: 'rgba(255,255,255,.05)', border: '1px solid #3a3a3d' }}
                >
                  ▶
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-widest" style={{ color: '#86868b', fontSize: '0.6rem' }}>
                    YouTube Channel
                  </div>
                  <div className="font-bold text-sm" style={{ color: '#f5f5f7' }}>
                    {ytStats.channelTitle}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { fetch('/api/youtube/disconnect', { method: 'POST' }).then(() => { setYtConnected(false); setYtStats(null) }) }}
                  className="ml-auto text-xs"
                  style={{ color: '#86868b', background: 'none', border: 'none', cursor: 'pointer' }}
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
                    style={{ background: '#1d1d1f', border: '1px solid #2a2a2d' }}
                  >
                    <div className="font-black text-base" style={{ color: '#2997ff' }}>{value}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#86868b' }}>{label}</div>
                  </div>
                ))}
              </div>
            </>
          ) : ytConnected && !ytStats ? (
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
                style={{ background: 'rgba(255,255,255,.05)', border: '1px solid #3a3a3d' }}
              >
                ▶
              </div>
              <div className="text-sm" style={{ color: '#86868b' }}>Loading channel stats…</div>
            </div>
          ) : (
            // Not connected
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
                  style={{ background: 'rgba(255,255,255,.05)', border: '1px solid #2a2a2d' }}
                >
                  ▶
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-widest" style={{ color: '#86868b', fontSize: '0.6rem' }}>
                    YouTube
                  </div>
                  <div className="text-sm" style={{ color: '#86868b' }}>Connect to auto-upload & track analytics</div>
                </div>
              </div>
              <a
                href="/api/youtube/auth"
                className="rounded-[980px] px-4 py-2 text-xs font-bold"
                style={{
                  background: 'rgba(41,151,255,.12)',
                  border: '1px solid rgba(41,151,255,.3)',
                  color: '#2997ff',
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
            background: creditsZero ? 'rgba(239,68,68,.06)' : '#161618',
            border: creditsZero ? '1px solid rgba(239,68,68,.25)' : '1px solid #2a2a2d',
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
              style={{
                background: creditsZero
                  ? 'linear-gradient(135deg, rgba(239,68,68,.25), rgba(239,68,68,.12))'
                  : 'rgba(41,151,255,.14)',
                border: creditsZero
                  ? '1px solid rgba(239,68,68,.4)'
                  : '1px solid rgba(41,151,255,.35)',
              }}
            >
              ⚡
            </div>
            <div>
              <div
                className="text-xs font-black uppercase tracking-widest mb-0.5"
                style={{ color: creditsZero ? '#f87171' : '#86868b', fontSize: '0.6rem' }}
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
                <div className="font-black" style={{ fontSize: '1rem', color: '#f5f5f7' }}>
                  You have{' '}
                  <span style={{ color: creditsZero ? '#f87171' : '#2997ff' }}>
                    {credits ?? 0} credit{credits === 1 ? '' : 's'}
                  </span>{' '}
                  available
                </div>
              )}
              <div className="text-xs mt-0.5" style={{ color: '#86868b' }}>
                1 credit = 1 Fast Mode video.
              </div>
            </div>
          </div>
          <Link
            href="/pricing"
            className="block text-center rounded-[980px] px-5 py-2.5 text-sm font-black transition-all md:inline-block"
            style={{
              background: creditsZero ? 'linear-gradient(135deg, #ef4444, #f87171)' : '#f5f5f7',
              color: creditsZero ? '#fff' : '#000',
              boxShadow: creditsZero ? '0 4px 18px rgba(239,68,68,.35)' : 'none',
              textDecoration: 'none',
            }}
          >
            {creditsZero ? '💳 Buy Credits' : '+ More Credits'}
          </Link>
        </div>
      )}

      {/* ── 🎁 Invite friends & earn ──
          Push #444 — moved to the dedicated, reachable /referral page
          (<ReferralCard/>). This dashboard page is dead code (redirects to
          /generate), so the card was never rendered here. */}

      {/* ── Activity strip ── */}
      {isLoggedIn && totalGenerations > 0 && (
        <div
          className="flex items-center gap-4 rounded-xl px-4 py-3 flex-wrap"
          style={{ background: 'rgba(255,255,255,.025)', border: '1px solid #2a2a2d' }}
        >
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: '0.7rem', color: '#86868b' }}>🎬</span>
            <span className="text-xs font-black" style={{ color: '#f5f5f7' }}>{totalGenerations}</span>
            <span className="text-xs" style={{ color: '#86868b' }}>videos generated</span>
          </div>
          <div className="w-px h-3" style={{ background: '#2a2a2d' }} />
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: '0.7rem', color: '#2997ff' }}>●</span>
            <span className="text-xs" style={{ color: '#86868b' }}>Viral Engine Online</span>
          </div>
          <div className="ml-auto">
            <Link href="/history" className="text-xs font-bold" style={{ color: '#2997ff', textDecoration: 'none' }}>
              View history →
            </Link>
          </div>
        </div>
      )}

      {/* ── Logged-out CTA ── */}
      {!isLoggedIn && (
        <div
          className="rounded-[20px] px-6 py-7 text-center"
          style={{ background: '#161618', border: '1px solid #2a2a2d' }}
        >
          <p className="font-bold text-base mb-2" style={{ color: '#f5f5f7' }}>
            🔑 Create your account to start
          </p>
          <p className="text-sm mb-4" style={{ color: '#86868b' }}>
            2 free videos on signup — just sign in.
          </p>
        </div>
      )}
    </div>
  )
}

// TopPickCard component was deleted in push #031 along with the niche grid
// it rendered for.
