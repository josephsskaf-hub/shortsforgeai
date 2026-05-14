'use client'

// Push #053 — AI video library client.
// Shows the current user's generated videos (Real Shorts MP4s) sourced
// from public.videos. Data comes pre-fetched from the parent server
// component with RLS already enforced — we never call Supabase here.

import Link from 'next/link'

export interface VideoRow {
  id: string
  title: string
  status: 'completed' | 'processing' | 'failed' | 'cancelled'
  video_url: string | null
  thumbnail_url: string | null
  duration: number | null
  platform: string
  created_at: string
}

function statusChip(s: VideoRow['status']) {
  if (s === 'completed')
    return { label: 'Completed', fg: '#34d399', bg: 'rgba(52,211,153,.10)', border: 'rgba(52,211,153,.32)' }
  if (s === 'failed' || s === 'cancelled')
    return { label: 'Failed', fg: '#f87171', bg: 'rgba(248,113,113,.10)', border: 'rgba(248,113,113,.32)' }
  return { label: 'Processing', fg: '#fbbf24', bg: 'rgba(251,191,36,.10)', border: 'rgba(251,191,36,.32)' }
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(diff / 86400000)
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return 'Recent'
  }
}

export default function MyVideosClient({ videos }: { videos: VideoRow[] }) {
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
            No videos yet. Create your first Short.
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
            Generated AI videos will show up here as soon as a render finishes.
          </p>
          <Link
            href="/generate"
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, #2563EB, #1d4ed8)',
              boxShadow: '0 4px 22px rgba(37,99,235,.3)',
              textDecoration: 'none',
            }}
          >
            ⚡ Generate a Short
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 py-7 pb-20">
      <Header count={videos.length} />

      <div className="mv-grid">
        {videos.map((v) => {
          const chip = statusChip(v.status)
          const playable = v.status === 'completed' && !!v.video_url
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
                {!v.thumbnail_url && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ color: 'rgba(147,197,253,.55)', fontSize: '2.2rem' }}
                  >
                    🎬
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
                  {chip.label}
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
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  {v.platform} · {formatDate(v.created_at)}
                </div>
                {playable && v.video_url ? (
                  <div className="flex items-center gap-2 mt-auto pt-2 flex-wrap">
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
            background: 'linear-gradient(135deg, #2563EB, #1d4ed8)',
            textDecoration: 'none',
          }}
        >
          ⚡ New Short
        </Link>
      </div>
    </div>
  )
}
