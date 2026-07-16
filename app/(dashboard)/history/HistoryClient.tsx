'use client'

// Push #323 - My Videos: show first frame via preload=metadata; no more black cards

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { trackCheckoutClick } from '@/lib/trackClick'
import { trackEvent } from '@/lib/analytics'

interface Video {
  id: string
  video_url: string
  thumbnail_url: string | null
  topic: string | null
  youtube_description: string | null
  hashtags: string[] | null
  status: string
  quality_mode: string | null
  credits_used: number | null
  created_at: string
}

function extractTitle(topic: string | null): string {
  if (!topic) return 'Untitled Short'
  // Try HOOK line: "HOOK (0-2s): [Pexels: ...] Actual hook text"
  const hookMatch = topic.match(/HOOK[^:]*:\s*(?:\[Pexels:[^\]]*\]\s*)?(.+?)(?:\n|$)/)
  if (hookMatch) {
    const t = hookMatch[1].replace(/\[Pexels:[^\]]*\]/g, '').trim()
    return t.length > 90 ? t.slice(0, 87) + '…' : t
  }
  // Fallback: first non-header line, stripping any [Pexels: ...] tags
  const lines = topic.split('\n').map((l) => {
    return l.trim().replace(/\[Pexels:[^\]]*\]/gi, '').trim()
  }).filter(
    (l) => l.length > 15 && !l.startsWith('YouTube Short') && !l.startsWith('HOOK') && !l.startsWith('MICRO')
  )
  if (lines[0]) return lines[0].slice(0, 90)
  return 'Untitled Short'
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface Props {
  videos: Video[]
}

// Push #421 — per-video YouTube summary (title + description + hashtags),
// generated on demand by /api/video-summary and cached in the videos row.
interface VideoSummary {
  title: string | null
  description: string
  hashtags: string[]
}

export default function MyVideosClient({ videos: initialVideos }: Props) {
  const [videos] = useState(initialVideos)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [errors, setErrors] = useState<Set<string>>(new Set())
  // Push #421 — summary panel state
  const [summaries, setSummaries] = useState<Record<string, VideoSummary>>({})
  const [summaryLoading, setSummaryLoading] = useState<string | null>(null)
  const [summaryErrors, setSummaryErrors] = useState<Record<string, string>>({})
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  // Push #098 — open a video in the big player overlay (the large view the
  // user expects when clicking a card), and a proper blob download that works
  // from My Videos any time — not just once on the result page.
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  // #459 — share the public /v/[id] page (native share on mobile, copy on desktop)
  const [sharedId, setSharedId] = useState<string | null>(null)
  // KINEO-DL-PAYWALL-2026-07-09 — download gating on My Videos. This page's
  // green Download button was a full paywall bypass: a free user blocked at
  // the $4.90 unlock on /generate could just come here and download the same
  // MP4. Rule mirrors MyVideosClient: locked unless the user has paid
  // (pack via has_paid, or any plan). FAIL OPEN — if /api/credits errors,
  // downloads stay unlocked so a DB blip never blocks a paying user.
  const [downloadLocked, setDownloadLocked] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch('/api/credits', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        const paid = d.hasPaid === true || d.isStarter === true || d.isCreator === true || d.isStudio === true
        setDownloadLocked(!paid)
      })
      .catch(() => {/* fail open */})
    return () => { cancelled = true }
  }, [])

  function handleStarterCheckout() {
    trackCheckoutClick('starter')
    window.location.href = '/api/stripe/checkout?tier=starter&intro=1'
  }

  // Push #098 — blob download with a real filename (the video's title). The
  // native <a download> / the player's ⋮ "download" menu both ignore the
  // attribute on cross-origin CDN URLs and save the raw UUID file, so we fetch
  // the bytes and name them ourselves. controlsList="nodownload" hides the ⋮
  // download path so users always get the correctly-named file.
  async function handleDownload(video: Video) {
    // KINEO-DL-PAYWALL-2026-07-09 — non-payers never reach the file. From the
    // grid, open the lightbox instead; it presents one clear recurring Starter
    // offer before checkout.
    if (downloadLocked) { setLightbox(video.id); return }
    if (!video.video_url || downloadingId) return
    setDownloadingId(video.id)
    try {
      const res = await fetch(video.video_url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      const safeTitle = extractTitle(video.topic)
        .replace(/[\\/:*?"<>|]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 80)
      a.download = safeTitle && safeTitle !== 'Untitled_Short'
        ? `${safeTitle}.mp4`
        : `shortsforge-${video.id.slice(0, 8)}.mp4`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'video_downloaded', metadata: { video_id: video.id } }),
      }).catch(() => {/* tracking must never affect UX */})
    } catch {
      window.open(video.video_url, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloadingId(null)
    }
  }

  // #459/#464 — share the public video page by COPYING the link. WhatsApp only
  // renders the rich preview reliably when a link is PASTED (the native share
  // sheet doesn't trigger it), so we copy + the user pastes. Each shared link is
  // a landing that brings a new (pre-warmed) visitor.
  async function handleShare(video: Video) {
    const url = `${window.location.origin}/v/${video.id}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // clipboard blocked (rare) — show the link so it can be copied manually
      try { window.prompt('Copy this link:', url) } catch {}
    }
    setSharedId(video.id)
    setTimeout(() => setSharedId((cur) => (cur === video.id ? null : cur)), 1800)
    try {
      void fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'video_shared', metadata: { video_id: video.id } }),
        keepalive: true,
      })
    } catch {}
  }

  // Push #421 — open (or fetch, then open) the YouTube summary panel.
  // 1st click on an old video calls /api/video-summary (GPT generates and the
  // row caches it); every later click — this session or any future one — is
  // served from state or straight from the videos row. Zero pipeline changes.
  async function handleSummary(video: Video) {
    if (expanded === video.id) {
      setExpanded(null)
      return
    }
    if (summaries[video.id]) {
      setExpanded(video.id)
      return
    }
    // Row already has cached metadata (generated on a previous visit) —
    // no network call needed.
    if (video.youtube_description && video.hashtags && video.hashtags.length > 0) {
      setSummaries((prev) => ({
        ...prev,
        [video.id]: {
          title: extractTitle(video.topic),
          description: video.youtube_description as string,
          hashtags: video.hashtags as string[],
        },
      }))
      setExpanded(video.id)
      return
    }
    setSummaryLoading(video.id)
    setSummaryErrors((prev) => {
      const next = { ...prev }
      delete next[video.id]
      return next
    })
    try {
      const res = await fetch('/api/video-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to generate summary')
      setSummaries((prev) => ({
        ...prev,
        [video.id]: {
          title: typeof data.title === 'string' ? data.title : extractTitle(video.topic),
          description: String(data.description ?? ''),
          hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
        },
      }))
      setExpanded(video.id)
    } catch (err) {
      setSummaryErrors((prev) => ({
        ...prev,
        [video.id]: err instanceof Error ? err.message : 'Failed to generate summary',
      }))
    } finally {
      setSummaryLoading(null)
    }
  }

  function copyToClipboard(key: string, text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedKey(key)
        setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600)
      })
      .catch(() => {/* clipboard denied — nothing useful to do */})
  }

  /* ── Empty state ── */
  if (videos.length === 0) {
    return (
      <div className="px-4 sm:px-6 py-7">
        <header className="mb-7">
          <div
            className="font-black uppercase tracking-[.18em] mb-2 flex items-center gap-2"
            style={{ fontSize: '0.65rem', color: '#2997ff' }}
          >
            <span style={{ display: 'inline-block', width: 18, height: 1, background: '#2997ff', verticalAlign: 'middle' }} />
            My Videos
            <span style={{ display: 'inline-block', width: 18, height: 1, background: '#2997ff', verticalAlign: 'middle' }} />
          </div>
          <h1
            className="font-black tracking-tight"
            style={{ fontSize: 'clamp(1.55rem, 4vw, 2rem)', color: 'var(--text)', lineHeight: 1.1 }}
          >
            Your{' '}
            <span style={{ background: 'linear-gradient(180deg,#fff 35%,#a1a1a6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Videos
            </span>
          </h1>
        </header>
        <div
          className="rounded-2xl p-10 sm:p-16 text-center"
          style={{ background: 'rgba(11,17,32,0.85)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' }}
        >
          <div className="text-5xl mb-4">🎬</div>
          <h2 className="text-xl font-black mb-2" style={{ color: 'var(--text)' }}>No videos yet</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
            Generate your first AI Short and it’ll appear here automatically.
          </p>
          <Link
            href="/generate"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-black text-white"
            style={{ background: '#2997ff', textDecoration: 'none', boxShadow: '0 6px 28px rgba(41,151,255,.4)' }}
          >
            ⚡ Generate Video
          </Link>
        </div>
      </div>
    )
  }

  const totalCredits = videos.reduce((a, v) => a + (v.credits_used ?? 1), 0)
  // RETENTION-P0-2026-07-15 — the biggest activation leak is immediately after
  // the first completed render. Turn that otherwise generic library visit into
  // a concrete episode-two action while the user's original topic is available.
  // autoanalyze keeps the next step short but still lets the user review before
  // rendering; this never spends credits or starts a render by itself.
  const firstVideoTitle = extractTitle(videos[0]?.topic ?? null)
  const followUpPrompt = firstVideoTitle === 'Untitled Short'
    ? ''
    : `Create a distinct follow-up episode about "${firstVideoTitle}". Use a new hook and new facts. Do not repeat the first Short.`
  const followUpHref = followUpPrompt
    ? `/generate?prompt=${encodeURIComponent(followUpPrompt)}&autoanalyze=1`
    : '/generate'

  /* ── Main ── */
  return (
    <div className="px-4 md:px-6 py-7 pb-28">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div
            className="font-black uppercase tracking-[.18em] mb-2 flex items-center gap-2"
            style={{ fontSize: '0.65rem', color: '#2997ff' }}
          >
            <span style={{ display: 'inline-block', width: 18, height: 1, background: '#2997ff', verticalAlign: 'middle' }} />
            My Videos
            <span style={{ display: 'inline-block', width: 18, height: 1, background: '#2997ff', verticalAlign: 'middle' }} />
          </div>
          <h1
            className="font-black tracking-tight"
            style={{ fontSize: 'clamp(1.55rem, 4vw, 2rem)', color: 'var(--text)', lineHeight: 1.1 }}
          >
            Your{' '}
            <span style={{ background: 'linear-gradient(180deg,#fff 35%,#a1a1a6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Videos
            </span>
          </h1>
        </div>
        <Link
          href="/generate"
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white flex-shrink-0"
          style={{ background: '#2997ff', textDecoration: 'none', boxShadow: '0 4px 18px rgba(41,151,255,.35)' }}
        >
          ⚡ New Video
        </Link>
      </div>

      {/* First-render milestone: make the second successful action obvious.
          Free unpaid users can keep testing Fast at a zero-credit balance;
          state the exact server rule (watermarked, 3/24h) instead of implying
          that a credit purchase is required before they can evaluate again. */}
      {videos.length === 1 && (
        <section
          aria-label="Create your second Short"
          className="rounded-2xl p-5 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          style={{
            background: 'linear-gradient(135deg, rgba(41,151,255,.14), rgba(41,151,255,.04))',
            border: '1px solid rgba(41,151,255,.42)',
            boxShadow: '0 10px 32px rgba(41,151,255,.10)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              className="font-black uppercase tracking-[.16em] mb-1.5"
              style={{ fontSize: '0.62rem', color: '#5cb3ff' }}
            >
              First Short complete
            </div>
            <h2 className="font-black tracking-tight mb-1.5" style={{ color: 'var(--text)', fontSize: '1.05rem' }}>
              Turn it into episode 2
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--muted2)', margin: 0, maxWidth: 620 }}>
              We prepared a fresh follow-up prompt with a new hook and new facts. You can review it before rendering.
            </p>
            {downloadLocked && (
              <p className="text-xs leading-relaxed mt-2" style={{ color: '#5cb3ff', marginBottom: 0 }}>
                Fast works at 0 credits for up to 3 watermarked previews per 24 hours. Starter unlocks downloads.
              </p>
            )}
          </div>
          <Link
            href={followUpHref}
            onClick={() => {
              void trackEvent('episode_two_clicked', {
                source: 'history_first_video_milestone',
                video_id: videos[0]?.id ?? null,
              })
            }}
            className="flex items-center justify-center rounded-xl px-5 py-3 text-sm font-black text-white flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #2997ff, #1d6fe0)',
              textDecoration: 'none',
              boxShadow: '0 6px 22px rgba(41,151,255,.30)',
            }}
          >
            Build Episode 2 →
          </Link>
        </section>
      )}

      {/* Stats */}
      <div
        className="inline-flex items-center gap-px mb-6 rounded-2xl overflow-hidden"
        style={{ background: 'rgba(11,17,32,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {[
          { val: String(videos.length), label: 'Videos' },
          { val: String(totalCredits), label: 'Credits Used' },
        ].map((s, i) => (
          <div
            key={s.label}
            className="flex flex-col items-center px-5 py-2.5"
            style={{ borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
          >
            <span
              className="font-black text-lg leading-none"
              style={{ background: 'linear-gradient(180deg,#fff 35%,#a1a1a6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
            >
              {s.val}
            </span>
            <span style={{ fontSize: '0.67rem', color: 'var(--muted)', marginTop: 2 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Video grid — compact 9:16 cards, 2-3 per row on mobile */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(158px, 1fr))',
          gap: '12px',
        }}
      >
        {videos.map((video) => {
          const title = extractTitle(video.topic)
          const isExpanded = expanded === video.id

          return (
            <div
              key={video.id}
              style={{
                background: 'rgba(11,17,32,0.9)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,.3)',
              }}
            >
              {/* 9:16 video area */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  paddingTop: '177.78%',
                  background: '#000',
                  overflow: 'hidden',
                }}
              >
                <div style={{ position: 'absolute', inset: 0 }}>
                  {errors.has(video.id) ? (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(11,17,32,0.95)',
                        gap: 10,
                        padding: 16,
                      }}
                    >
                      <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                      <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 700, textAlign: 'center' }}>
                        Video unavailable
                      </span>
                      <a
                        href={video.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        style={{ fontSize: '0.7rem', color: '#2997ff', textDecoration: 'underline' }}
                      >
                        ⬇ Download
                      </a>
                    </div>
                  ) : (
                    <div
                      onClick={() => setLightbox(video.id)}
                      style={{
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                        cursor: 'pointer',
                        background: '#000',
                      }}
                    >
                      {/* Video preview — first frame shown via preload="metadata" */}
                      <video
                        src={video.video_url}
                        muted
                        playsInline
                        preload="metadata"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      {/* Dark overlay so play button is always visible */}
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', pointerEvents: 'none' }} />
                      {/* Play button */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: 'none',
                        }}
                      >
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: 'rgba(41,151,255,0.18)',
                            border: '2px solid rgba(41,151,255,0.6)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 18px rgba(41,151,255,0.3)',
                          }}
                        >
                          <span style={{ fontSize: 15, marginLeft: 2, color: '#2997ff' }}>▶</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Info below video */}
              <div style={{ padding: '7px 8px 8px' }}>
                <p
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: 'var(--text)',
                    lineHeight: 1.3,
                    marginBottom: 5,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {title}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>{formatDate(video.created_at)}</span>
                  {video.quality_mode && (
                    <span
                      style={{
                        fontSize: '0.55rem',
                        fontWeight: 700,
                        padding: '1px 4px',
                        borderRadius: 4,
                        background: 'rgba(41,151,255,0.12)',
                        border: '1px solid rgba(41,151,255,0.25)',
                        color: '#2997ff',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {video.quality_mode === 'cinematic' ? '✨ AI' : '⚡'}
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => handleDownload(video)}
                    disabled={downloadingId === video.id}
                    title={downloadLocked ? 'Start Starter — $4.90 first month' : 'Download MP4'}
                    aria-label={downloadLocked ? 'Start Starter — $4.90 first month' : 'Download MP4'}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 3,
                      padding: '5px 4px',
                      borderRadius: 6,
                      background: 'rgba(41,151,255,0.08)',
                      border: '1px solid rgba(41,151,255,0.2)',
                      color: '#2997ff',
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      cursor: downloadingId === video.id ? 'wait' : 'pointer',
                    }}
                  >
                    {downloadingId === video.id ? '…' : downloadLocked ? '🔒' : '⬇'}
                  </button>

                  {/* #459 — share the public /v/[id] page */}
                  <button
                    onClick={() => handleShare(video)}
                    title="Share public link"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 3,
                      padding: '5px 4px',
                      borderRadius: 6,
                      background: 'rgba(41,151,255,0.1)',
                      border: '1px solid rgba(41,151,255,0.25)',
                      color: '#2997ff',
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {sharedId === video.id ? '✓ Copied' : '🔗 Copy'}
                  </button>

                  <a
                    href="https://studio.youtube.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 3,
                      padding: '5px 4px',
                      borderRadius: 6,
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      color: '#F87171',
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    ▶ YT
                  </a>

                  {/* Push #421 — YouTube summary (title + description + hashtags) */}
                  <button
                    onClick={() => handleSummary(video)}
                    disabled={summaryLoading === video.id}
                    title="YouTube title, description & hashtags"
                    aria-label="YouTube title, description & hashtags"
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 3,
                      padding: '5px 4px',
                      borderRadius: 6,
                      background: isExpanded ? 'rgba(41,151,255,0.18)' : 'rgba(41,151,255,0.08)',
                      border: '1px solid rgba(41,151,255,0.25)',
                      color: '#2997ff',
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      cursor: summaryLoading === video.id ? 'wait' : 'pointer',
                    }}
                  >
                    {summaryLoading === video.id ? '…' : '📋'}
                  </button>
                </div>

                {/* Push #421 — summary fetch error */}
                {summaryErrors[video.id] && !isExpanded && (
                  <p style={{ marginTop: 6, fontSize: '0.6rem', color: '#f87171', lineHeight: 1.4 }}>
                    {summaryErrors[video.id]}
                  </p>
                )}

                {/* Push #421 — expanded YouTube summary panel */}
                {isExpanded && summaries[video.id] && (() => {
                  const s = summaries[video.id]
                  const hashtagLine = s.hashtags.join(' ')
                  const copyAll = [s.title, '', s.description, '', hashtagLine]
                    .filter((part) => part !== null)
                    .join('\n')
                    .replace(/\n{3,}/g, '\n\n')
                    .trim()
                  const section = (key: string, label: string, text: string) => (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: '0.55rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2997ff' }}>
                          {label}
                        </span>
                        <button
                          onClick={() => copyToClipboard(key, text)}
                          style={{
                            padding: '2px 7px',
                            borderRadius: 5,
                            background: copiedKey === key ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                            border: `1px solid ${copiedKey === key ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
                            color: copiedKey === key ? '#4ADE80' : 'var(--muted)',
                            fontSize: '0.55rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {copiedKey === key ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                      <p
                        style={{
                          fontSize: '0.66rem',
                          color: 'var(--text)',
                          lineHeight: 1.45,
                          whiteSpace: 'pre-wrap',
                          maxHeight: 110,
                          overflowY: 'auto',
                          margin: 0,
                        }}
                      >
                        {text}
                      </p>
                    </div>
                  )
                  return (
                    <div
                      style={{
                        marginTop: 8,
                        padding: '9px 10px',
                        borderRadius: 8,
                        background: 'rgba(41,151,255,0.05)',
                        border: '1px solid rgba(41,151,255,0.18)',
                      }}
                    >
                      {s.title && section(`${video.id}-title`, 'Title', s.title)}
                      {section(`${video.id}-desc`, 'Description', s.description)}
                      {s.hashtags.length > 0 && section(`${video.id}-tags`, 'Hashtags', hashtagLine)}
                      <button
                        onClick={() => copyToClipboard(`${video.id}-all`, copyAll)}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: 7,
                          border: 'none',
                          background: copiedKey === `${video.id}-all`
                            ? 'linear-gradient(135deg,#16a34a,#22c55e)'
                            : '#2997ff',
                          color: '#fff',
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        {copiedKey === `${video.id}-all` ? '✓ Copied!' : '📋 Copy All'}
                      </button>
                    </div>
                  )
                })()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Push #098 — big-player overlay (the large view). Clicking a card opens
          the Short here with a download button that always saves the correctly
          named MP4. controlsList="nodownload" removes the ⋮ menu's raw download. */}
      {lightbox && (() => {
        const v = videos.find((x) => x.id === lightbox)
        if (!v) return null
        return (
          <div
            onClick={() => setLightbox(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.86)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          >
            <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(420px, 92vw)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '9 / 16', borderRadius: 16, overflow: 'hidden', background: '#000', border: '1px solid rgba(41,151,255,0.4)', boxShadow: '0 18px 60px rgba(5,150,105,0.25)' }}>
                <video
                  src={v.video_url}
                  controls
                  autoPlay
                  playsInline
                  controlsList="nodownload"
                  disablePictureInPicture
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={() => setErrors((prev) => new Set([...prev, v.id]))}
                />
              </div>
              {downloadLocked ? (
                <button
                  onClick={handleStarterCheckout}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, width: '100%', padding: '13px 10px', borderRadius: 14, cursor: 'pointer', background: 'linear-gradient(135deg, #2997ff, #1d6fe0)', border: '1px solid transparent', color: '#fff', fontWeight: 800, fontSize: '0.9rem', boxShadow: '0 8px 28px rgba(41,151,255,0.35)' }}
                >
                  <span>Start Starter — $4.90 today</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, opacity: 0.9 }}>Then $9.90/month · 25 credits/month · cancel anytime</span>
                </button>
              ) : (
              <button
                onClick={() => handleDownload(v)}
                disabled={downloadingId === v.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: downloadingId === v.id ? 'wait' : 'pointer', background: 'linear-gradient(135deg, #16a34a, #22c55e)', color: '#fff', fontWeight: 800, fontSize: '0.95rem', boxShadow: '0 8px 28px rgba(34,197,94,0.35)' }}
              >
                {downloadingId === v.id ? 'Downloading…' : '⬇ Download (MP4)'}
              </button>
              )}
              <button
                onClick={() => setLightbox(null)}
                style={{ width: '100%', padding: '10px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--muted)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
