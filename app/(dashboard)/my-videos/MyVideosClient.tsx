'use client'

// Push #053 — AI video library client.
// Push #060 — upgraded with status filters, expanded card actions
// (Copy Link, Generate Similar), full date formatting, and a play-icon
// placeholder when the row has a final MP4 but no thumbnail.

import Link from 'next/link'
import { useMemo, useState } from 'react'

export interface VideoRow {
  id: string
  title: string
  status: 'completed' | 'processing' | 'failed' | 'cancelled'
  video_url: string | null
  thumbnail_url: string | null
  duration: number | null
  platform: string
  created_at: string
  // Push #060 — optional fields. Surfaced when the column exists.
  prompt: string | null
  credits_used: number | null
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
    fg: '#fbbf24',
    bg: 'rgba(251,191,36,.10)',
    border: 'rgba(251,191,36,.32)',
  }
}

function formatFullDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return 'Recent'
  }
}

export default function MyVideosClient({ videos }: { videos: VideoRow[] }) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)

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

  if (videos.length === 0) {
    return (
      <div className="px-4 sm:px-6 py-7 pb-20">
        <Header count={0} />
        <div
          className="rounded-2xl p-8 sm:p-14 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="text-5xl mb-4">🎬</div>
          <h2 className="text-xl font-black mb-2" style={{ color: 'var(--text)' }}>
            No videos yet. Create your first AI Short.
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
            Generated AI videos will show up here as soon as a render finishes.
          </p>
          <Link
            href="/generate"
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              boxShadow: '0 4px 22px rgba(124,58,237,.35)',
              textDecoration: 'none',
            }}
          >
            ⚡ Generate Video
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
          {filtered.map((v) => {
            const chip = statusChip(v.status)
            const playable = v.status === 'completed' && !!v.video_url
            const isCopied = copiedId === v.id
            const generateSimilarHref = v.prompt
              ? `/generate?prompt=${encodeURIComponent(v.prompt)}`
              : '/generate'
            return (
              <div
                key={v.id}
                className="rounded-2xl overflow-hidden flex flex-col"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
              >
                <div
                  className="relative"
                  style={{
                    background: v.thumbnail_url
                      ? `center / cover no-repeat url(${v.thumbnail_url})`
                      : 'linear-gradient(135deg, rgba(37,99,235,.18), rgba(124,58,237,.12))',
                    aspectRatio: '9 / 16',
                  }}
                >
                  {/* Play-icon placeholder for completed videos that have an
                      MP4 but no thumbnail — most staging rows are in this
                      state. Falls back to a film emoji for everything else. */}
                  {!v.thumbnail_url && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ color: 'rgba(147,197,253,.7)', fontSize: '2.6rem' }}
                    >
                      {playable ? '▶' : '🎬'}
                    </div>
                  )}
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
                    }}
                  >
                    {chip.emoji} {chip.label}
                  </span>
                  {v.duration ? (
                    <span
                      className="absolute"
                      style={{
                        bottom: 8,
                        right: 8,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'rgba(0,0,0,.6)',
                        color: '#fff',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                      }}
                    >
                      {Math.round(v.duration)}s
                    </span>
                  ) : null}
                </div>

                <div className="p-3 flex flex-col gap-2 flex-1">
                  <p
                    className="text-sm font-bold"
                    style={{
                      color: 'var(--text)',
                      lineHeight: 1.4,
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
                    <span>·</span>
                    <span>{v.platform}</span>
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
                          className="rounded-lg px-3 py-2 text-xs font-bold flex-1 text-center"
                          style={{
                            background: 'linear-gradient(135deg, #2563EB, #1d4ed8)',
                            color: '#fff',
                            textDecoration: 'none',
                          }}
                        >
                          Open ↗
                        </a>
                        <a
                          href={v.video_url}
                          download={`shortsforge-${v.id.slice(0, 8)}.mp4`}
                          target="_blank"
                          rel="noreferrer"
                          title="Download MP4"
                          className="rounded-lg px-3 py-2 text-xs font-bold"
                          style={{
                            background: 'rgba(255,255,255,.04)',
                            border: '1px solid var(--border)',
                            color: 'var(--text2)',
                            textDecoration: 'none',
                          }}
                        >
                          ⬇
                        </a>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(v)}
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
                            background: 'rgba(99,102,241,.10)',
                            border: '1px solid rgba(99,102,241,.32)',
                            color: '#a5b4fc',
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
          })}
        </div>
      )}

      <style jsx>{`
        .mv-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }
        @media (max-width: 900px) {
          .mv-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 480px) {
          .mv-grid { grid-template-columns: 1fr; }
        }
      `}</style>
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
        My Videos
      </div>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="font-black tracking-tight mb-1"
            style={{ fontSize: '1.45rem', color: 'var(--text)' }}
          >
            Your <span className="grad-text">AI Shorts</span>
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
            {count} video{count === 1 ? '' : 's'} generated
          </p>
        </div>
        <Link
          href="/generate"
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            boxShadow: '0 4px 18px rgba(124,58,237,.35)',
            textDecoration: 'none',
          }}
        >
          ⚡ Generate Video
        </Link>
      </div>
    </div>
  )
}
