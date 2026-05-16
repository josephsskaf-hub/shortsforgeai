'use client'

// Push #082 — My Videos premium library.
// Each card now hover-previews the rendered MP4 (muted autoplay on
// pointer-enter, pause on leave) and shows a richer set of badges:
// status, format (YouTube Shorts 9:16), duration, quality (or "HD"
// fallback), credits used, and a numeric quality_score star rating
// when present. The grid still falls back gracefully on staging rows
// that don't have a video_url yet.

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

export interface VideoRow {
  id: string
  title: string
  status: 'completed' | 'processing' | 'failed' | 'cancelled'
  video_url: string | null
  thumbnail_url: string | null
  duration: number | null
  platform: string
  created_at: string
  prompt: string | null
  credits_used: number | null
  // Push #082 — quality text (e.g. "HD", "4K") + optional numeric
  // quality_score (e.g. 4.2 → ★★★★☆). Either can be null on staging.
  quality: string | null
  quality_score: number | null
}

type FilterKey = 'all' | 'completed' | 'processing' | 'failed'

function statusChip(s: VideoRow['status']) {
  if (s === 'completed')
    return {
      label: 'Completed',
      emoji: '✅',
      fg: '#34d399',
      bg: 'rgba(52,211,153,.10)',
      border: 'rgba(52,211,153,.32)',
    }
  if (s === 'failed' || s === 'cancelled')
    return {
      label: 'Failed',
      emoji: '❌',
      fg: '#f87171',
      bg: 'rgba(248,113,113,.10)',
      border: 'rgba(248,113,113,.32)',
    }
  return {
    label: 'Processing',
    emoji: '⏳',
    fg: '#22D3EE',
    bg: 'rgba(34, 211, 238,.10)',
    border: 'rgba(34, 211, 238,.32)',
  }
}

function formatFullDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return 'Recent'
  }
}

// Render a 0–5 quality_score as filled/empty star glyphs. We round to the
// nearest half so 4.2 → ★★★★☆ and 4.7 → ★★★★★.
function starsFor(score: number): string {
  const clamped = Math.max(0, Math.min(5, score))
  const full = Math.round(clamped)
  return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full)
}

export default function MyVideosClient({ videos }: { videos: VideoRow[] }) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  // Push #100 — mobile tap-to-play: only one card pinned at a time so
  // tapping a new card auto-pauses the previously playing one.
  const [playingId, setPlayingId] = useState<string | null>(null)

  const counts = useMemo(() => {
    const c = { all: videos.length, completed: 0, processing: 0, failed: 0 }
    for (const v of videos) {
      if (v.status === 'completed') c.completed += 1
      else if (v.status === 'failed' || v.status === 'cancelled') c.failed += 1
      else c.processing += 1
    }
    return c
  }, [videos])

  const filtered = useMemo(() => {
    if (filter === 'all') return videos
    if (filter === 'completed') return videos.filter((v) => v.status === 'completed')
    if (filter === 'processing') return videos.filter((v) => v.status === 'processing')
    if (filter === 'failed')
      return videos.filter((v) => v.status === 'failed' || v.status === 'cancelled')
    return videos
  }, [videos, filter])

  async function handleCopyLink(v: VideoRow) {
    if (!v.video_url) return
    try {
      await navigator.clipboard.writeText(v.video_url)
      setCopiedId(v.id)
      setTimeout(() => setCopiedId((c) => (c === v.id ? null : c)), 1800)
    } catch {
      // clipboard denied — silent no-op
    }
  }

  // Native <a download> doesn't work for cross-origin CDN URLs — the browser
  // ignores the attribute and opens the MP4 in a new tab. Fetch the bytes
  // ourselves and trigger a blob download so the file actually saves locally.
  async function handleDownload(v: VideoRow) {
    if (!v.video_url || downloadingId) return
    setDownloadingId(v.id)
    try {
      const res = await fetch(v.video_url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `shortsforge-${v.id.slice(0, 8)}.mp4`
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Give the browser a tick to start the download before revoking.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch {
      // Fall back to opening the URL in a new tab so the user isn't stranded.
      window.open(v.video_url, '_blank', 'noopener,noreferrer')
    } finally {
      setDownloadingId(null)
    }
  }

  if (videos.length === 0) {
    return (
      <div className="px-4 sm:px-6 py-7 pb-20">
        <Header count={0} />
        <div
          className="rounded-2xl p-8 sm:p-14 text-center"
          style={{
            background: 'linear-gradient(180deg, rgba(15,15,30,.85), rgba(11,16,32,.65))',
            border: '1px solid rgba(59, 130, 246,.18)',
            boxShadow: '0 0 80px rgba(59,130,246,.08)',
          }}
        >
          <div className="text-5xl mb-4">🎬</div>
          <h2 className="text-xl font-black mb-2" style={{ color: 'var(--text)' }}>
            Your generated videos will appear here.
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
            Create your first video and we'll keep every render here, ready to download.
          </p>
          <Link
            href="/generate"
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"
            style={{
              background: 'linear-gradient(135deg, #2563EB, #22D3EE)',
              color: '#FFFFFF',
              boxShadow: '0 4px 22px rgba(59, 130, 246,.4)',
              textDecoration: 'none',
            }}
          >
            Create your first video →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 py-7 pb-20">
      <Header count={videos.length} />

      <FilterTabs filter={filter} counts={counts} onChange={setFilter} />

      {filtered.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            No videos match this filter.
          </p>
        </div>
      ) : (
        <div className="mv-grid">
          {filtered.map((v) => (
            <VideoCard
              key={v.id}
              video={v}
              isCopied={copiedId === v.id}
              onCopy={() => handleCopyLink(v)}
              onDownload={() => handleDownload(v)}
              isDownloading={downloadingId === v.id}
              isPinned={playingId === v.id}
              onTogglePin={() =>
                setPlayingId((curr) => (curr === v.id ? null : v.id))
              }
            />
          ))}
        </div>
      )}

      <style jsx>{`
        .mv-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
        }
        @media (max-width: 900px) {
          .mv-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 540px) {
          .mv-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  )
}

function VideoCard({
  video: v,
  isCopied,
  onCopy,
  onDownload,
  isDownloading,
  isPinned,
  onTogglePin,
}: {
  video: VideoRow
  isCopied: boolean
  onCopy: () => void
  onDownload: () => void
  isDownloading: boolean
  isPinned: boolean
  onTogglePin: () => void
}) {
  const chip = statusChip(v.status)
  const playable = v.status === 'completed' && !!v.video_url
  const generateSimilarHref = v.prompt
    ? `/generate?prompt=${encodeURIComponent(v.prompt)}`
    : '/generate'

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [hovered, setHovered] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)

  // Push #100 — single source of truth for "should the preview be playing".
  // Hover handles desktop, isPinned handles mobile tap. preload="none" +
  // dynamic src means cards don't fetch any bytes until the user interacts.
  const shouldPlay = (hovered || isPinned) && playable && !previewFailed

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    if (shouldPlay) {
      if (!el.src && v.video_url) el.src = v.video_url
      el.muted = true
      el.play().catch(() => {/* autoplay blocked — silent */})
    } else {
      el.pause()
      try { el.currentTime = 0 } catch { /* not seekable yet */ }
      // Drop the src so an idle, off-screen card doesn't hold a decoder.
      if (el.src) {
        el.removeAttribute('src')
        el.load()
      }
    }
  }, [shouldPlay, v.video_url])

  function handlePreviewClick() {
    if (!playable || previewFailed) return
    onTogglePin()
  }

  // Duration label — show the real seconds when known, otherwise the
  // expected ~35s for a Shorts render so the card never reads "0s".
  const durationLabel = v.duration && v.duration > 0 ? `${Math.round(v.duration)}s` : '~35s'

  // Quality badge — prefer the numeric quality_score (rendered as stars),
  // fall back to the `quality` text column, finally show "HD" so every
  // completed card carries some kind of quality signal.
  const hasScore = typeof v.quality_score === 'number' && v.quality_score > 0
  const qualityText = hasScore
    ? `${(v.quality_score as number).toFixed(1)} ${starsFor(v.quality_score as number)}`
    : v.quality && v.quality.trim().length > 0
      ? v.quality.toUpperCase()
      : 'HD'

  const isActive = hovered || isPinned

  return (
    <div
      onPointerEnter={(e) => { if (e.pointerType !== 'touch') setHovered(true) }}
      onPointerLeave={(e) => { if (e.pointerType !== 'touch') setHovered(false) }}
      className="rounded-2xl overflow-hidden flex flex-col transition-all duration-200"
      style={{
        background: 'linear-gradient(180deg, #0F1424 0%, #0B1020 100%)',
        border: isActive
          ? '1px solid rgba(59,130,246,0.55)'
          : '1px solid rgba(255,255,255,0.06)',
        boxShadow: isActive
          ? '0 0 32px rgba(34,211,238,0.22), 0 18px 40px rgba(0,0,0,0.45)'
          : '0 8px 22px rgba(0,0,0,0.35)',
        transform: isActive ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      <div
        className="relative"
        onClick={handlePreviewClick}
        style={{
          background: v.thumbnail_url
            ? `center / cover no-repeat url(${v.thumbnail_url})`
            : 'linear-gradient(135deg, rgba(37,99,235,.22), rgba(34,211,238,.10))',
          aspectRatio: '9 / 16',
          overflow: 'hidden',
          cursor: playable && !previewFailed ? 'pointer' : 'default',
        }}
      >
        {/* Hover/tap preview — the rendered MP4 plays muted while the user
            is on (desktop) or has tapped (mobile) the card. preload="none"
            and dynamic src mean nothing is fetched until interaction. */}
        {playable && !previewFailed && (
          <video
            ref={videoRef}
            poster={v.thumbnail_url ?? undefined}
            muted
            loop
            playsInline
            preload="none"
            onError={() => setPreviewFailed(true)}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300 pointer-events-none"
            style={{ opacity: shouldPlay ? 1 : 0 }}
          />
        )}

        {/* Center play-circle overlay — visible on completed cards, fades
            out while the preview is playing. Matches the Canva/InVideo
            pattern. */}
        {playable && !previewFailed && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
              opacity: shouldPlay ? 0 : 1,
              transition: 'opacity 0.25s ease',
            }}
            aria-hidden="true"
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(11,17,32,.55)',
                backdropFilter: 'blur(8px)',
                border: '2px solid rgba(255,255,255,.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '1.35rem',
                paddingLeft: 4,
                boxShadow: '0 6px 22px rgba(0,0,0,.45)',
              }}
            >
              ▶
            </div>
          </div>
        )}

        {/* Fallback glyph for rows without a thumbnail and not playable
            (processing/failed). Hidden once the preview is up. */}
        {!v.thumbnail_url && !playable && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ color: 'rgba(147,197,253,.7)', fontSize: '2.6rem' }}
          >
            🎬
          </div>
        )}

        {/* Top-left: status chip */}
        <span
          className="absolute"
          style={{
            top: 8,
            left: 8,
            padding: '3px 9px',
            borderRadius: 999,
            background: chip.bg,
            border: `1px solid ${chip.border}`,
            color: chip.fg,
            fontSize: '0.62rem',
            fontWeight: 900,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            backdropFilter: 'blur(8px)',
          }}
        >
          {chip.emoji} {chip.label}
        </span>

        {/* Top-right: quality badge */}
        {playable && (
          <span
            className="absolute"
            style={{
              top: 8,
              right: 8,
              padding: '3px 9px',
              borderRadius: 6,
              background: 'rgba(11,17,32,.7)',
              border: '1px solid rgba(34,211,238,.45)',
              color: '#22D3EE',
              fontSize: '0.6rem',
              fontWeight: 900,
              letterSpacing: '0.06em',
              backdropFilter: 'blur(8px)',
            }}
            title="Output quality"
          >
            {qualityText}
          </span>
        )}

        {/* Bottom-left: format badge */}
        <span
          className="absolute"
          style={{
            bottom: 8,
            left: 8,
            padding: '3px 8px',
            borderRadius: 6,
            background: 'rgba(11,17,32,.7)',
            border: '1px solid rgba(255,255,255,.12)',
            color: '#F1F5F9',
            fontSize: '0.58rem',
            fontWeight: 800,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            backdropFilter: 'blur(8px)',
          }}
        >
          YouTube Shorts · 9:16
        </span>

        {/* Bottom-right: duration */}
        <span
          className="absolute"
          style={{
            bottom: 8,
            right: 8,
            padding: '3px 8px',
            borderRadius: 6,
            background: 'rgba(0,0,0,.65)',
            color: '#fff',
            fontSize: '0.62rem',
            fontWeight: 800,
            backdropFilter: 'blur(8px)',
          }}
        >
          {durationLabel}
        </span>
      </div>

      <div className="p-3.5 flex flex-col gap-2 flex-1">
        <p
          className="text-[14px] font-bold tracking-tight"
          style={{
            color: 'var(--text)',
            lineHeight: 1.35,
            margin: 0,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {v.title}
        </p>

        <div
          className="text-[11px] flex flex-wrap items-center gap-x-1.5 gap-y-1"
          style={{ color: 'var(--muted)' }}
        >
          <span>{formatFullDate(v.created_at)}</span>
          {v.credits_used != null && (
            <>
              <span>·</span>
              <span>{v.credits_used} credits</span>
            </>
          )}
        </div>

        {playable && v.video_url ? (
          <div className="flex flex-col gap-2 mt-auto pt-2">
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={v.video_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg px-3 py-2 text-xs font-bold flex-1 text-center transition-all"
                style={{
                  background: 'linear-gradient(135deg, #2563EB, #22D3EE)',
                  color: '#fff',
                  textDecoration: 'none',
                  boxShadow: '0 4px 18px rgba(59,130,246,.35)',
                }}
              >
                ▶ Open
              </a>
              <button
                type="button"
                onClick={onDownload}
                disabled={isDownloading}
                title="Download MP4"
                className="rounded-lg px-3 py-2 text-xs font-bold"
                style={{
                  background: 'rgba(255,255,255,.04)',
                  border: '1px solid var(--border)',
                  color: 'var(--text2)',
                  cursor: isDownloading ? 'wait' : 'pointer',
                  opacity: isDownloading ? 0.6 : 1,
                }}
              >
                {isDownloading ? '…' : '⬇ Download'}
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={onCopy}
                className="rounded-lg px-3 py-2 text-xs font-bold flex-1"
                style={{
                  background: isCopied
                    ? 'rgba(52,211,153,.12)'
                    : 'rgba(255,255,255,.04)',
                  border: isCopied
                    ? '1px solid rgba(52,211,153,.45)'
                    : '1px solid var(--border)',
                  color: isCopied ? '#34d399' : 'var(--text2)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {isCopied ? '✓ Copied!' : '🔗 Copy Link'}
              </button>
              <Link
                href={generateSimilarHref}
                className="rounded-lg px-3 py-2 text-xs font-bold flex-1 text-center"
                style={{
                  background: 'rgba(59, 130, 246,.10)',
                  border: '1px solid rgba(59, 130, 246,.32)',
                  color: '#60A5FA',
                  textDecoration: 'none',
                }}
              >
                ⚡ Generate Similar
              </Link>
            </div>
          </div>
        ) : (
          <div
            className="text-[11px] mt-auto pt-2"
            style={{ color: 'var(--muted)' }}
          >
            {v.status === 'processing' ? 'Rendering…' : 'Not available'}
          </div>
        )}
      </div>
    </div>
  )
}

function FilterTabs({
  filter,
  counts,
  onChange,
}: {
  filter: FilterKey
  counts: { all: number; completed: number; processing: number; failed: number }
  onChange: (f: FilterKey) => void
}) {
  const tabs: { key: FilterKey; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'completed', label: 'Completed', count: counts.completed },
    { key: 'processing', label: 'Processing', count: counts.processing },
    { key: 'failed', label: 'Failed', count: counts.failed },
  ]
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {tabs.map((t) => {
        const active = filter === t.key
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className="rounded-full px-3.5 py-1.5 text-xs font-bold"
            style={{
              background: active
                ? 'linear-gradient(135deg, rgba(37,99,235,.85), rgba(29,78,216,.85))'
                : 'rgba(255,255,255,.04)',
              border: active ? '1px solid rgba(37,99,235,.6)' : '1px solid var(--border)',
              color: active ? '#fff' : 'var(--muted)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {t.label}
            <span
              className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full"
              style={{
                background: active ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.06)',
                color: active ? '#fff' : 'var(--muted2)',
              }}
            >
              {t.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function Header({ count }: { count: number }) {
  return (
    <div className="mb-6">
      <div
        className="font-black uppercase tracking-widest mb-1"
        style={{ fontSize: '0.62rem', color: 'var(--indigo-light)' }}
      >
        Library
      </div>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="font-black tracking-tight mb-1"
            style={{ fontSize: '1.65rem', color: 'var(--text)', letterSpacing: '-0.02em' }}
          >
            My <span className="grad-text">Videos</span>
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
            {count} video{count === 1 ? '' : 's'} in your library
          </p>
        </div>
        <Link
          href="/generate"
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #2563EB, #22D3EE)',
            color: '#FFFFFF',
            boxShadow: '0 4px 18px rgba(59, 130, 246,.35)',
            textDecoration: 'none',
          }}
        >
          ⚡ Generate Video
        </Link>
      </div>
    </div>
  )
}
