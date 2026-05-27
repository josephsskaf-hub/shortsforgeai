'use client'

// Push #319 - My Videos v2: query from videos table, show rendered video cards with player

import { useState } from 'react'
import Link from 'next/link'

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
  // Fallback: first non-header line
  const lines = topic.split('\n').map((l) => l.trim()).filter(
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

export default function MyVideosClient({ videos: initialVideos }: Props) {
  const [videos] = useState(initialVideos)
  const [playing, setPlaying] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [errors, setErrors] = useState<Set<string>>(new Set())

  /* ── Empty state ── */
  if (videos.length === 0) {
    return (
      <div className="px-4 sm:px-6 py-7">
        <header className="mb-7">
          <div
            className="font-black uppercase tracking-[.18em] mb-2 flex items-center gap-2"
            style={{ fontSize: '0.65rem', color: '#22D3EE' }}
          >
            <span style={{ display: 'inline-block', width: 18, height: 1, background: '#22D3EE', verticalAlign: 'middle' }} />
            My Videos
            <span style={{ display: 'inline-block', width: 18, height: 1, background: '#22D3EE', verticalAlign: 'middle' }} />
          </div>
          <h1
            className="font-black tracking-tight"
            style={{ fontSize: 'clamp(1.55rem, 4vw, 2rem)', color: 'var(--text)', lineHeight: 1.1 }}
          >
            Your{' '}
            <span style={{ background: 'linear-gradient(135deg,#22D3EE,#3B82F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
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
            Generate your first AI Short and it'll appear here automatically.
          </p>
          <Link
            href="/generate"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-black text-white"
            style={{ background: 'linear-gradient(135deg, #2563EB, #22D3EE)', textDecoration: 'none', boxShadow: '0 6px 28px rgba(59,130,246,.4)' }}
          >
            ⚡ Generate Video
          </Link>
        </div>
      </div>
    )
  }

  const totalCredits = videos.reduce((a, v) => a + (v.credits_used ?? 1), 0)

  /* ── Main ── */
  return (
    <div className="px-4 md:px-6 py-7 pb-28">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div
            className="font-black uppercase tracking-[.18em] mb-2 flex items-center gap-2"
            style={{ fontSize: '0.65rem', color: '#22D3EE' }}
          >
            <span style={{ display: 'inline-block', width: 18, height: 1, background: '#22D3EE', verticalAlign: 'middle' }} />
            My Videos
            <span style={{ display: 'inline-block', width: 18, height: 1, background: '#22D3EE', verticalAlign: 'middle' }} />
          </div>
          <h1
            className="font-black tracking-tight"
            style={{ fontSize: 'clamp(1.55rem, 4vw, 2rem)', color: 'var(--text)', lineHeight: 1.1 }}
          >
            Your{' '}
            <span style={{ background: 'linear-gradient(135deg,#22D3EE,#3B82F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Videos
            </span>
          </h1>
        </div>
        <Link
          href="/generate"
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #2563EB, #22D3EE)', textDecoration: 'none', boxShadow: '0 4px 18px rgba(59,130,246,.35)' }}
        >
          ⚡ New Video
        </Link>
      </div>

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
              style={{ background: 'linear-gradient(135deg,#22D3EE,#3B82F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
            >
              {s.val}
            </span>
            <span style={{ fontSize: '0.67rem', color: 'var(--muted)', marginTop: 2 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Video grid — 9:16 cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '16px',
        }}
      >
        {videos.map((video) => {
          const title = extractTitle(video.topic)
          const isPlaying = playing === video.id
          const isExpanded = expanded === video.id

          return (
            <div
              key={video.id}
              style={{
                background: 'rgba(11,17,32,0.9)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,.3)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {/* 9:16 video area */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  paddingTop: '177.78%', // 9:16 ratio
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
                        style={{ fontSize: '0.7rem', color: '#22D3EE', textDecoration: 'underline' }}
                      >
                        ⬇ Download
                      </a>
                    </div>
                  ) : isPlaying ? (
                    <video
                      src={video.video_url}
                      autoPlay
                      controls
                      playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onEnded={() => setPlaying(null)}
                      onError={() => setErrors(prev => new Set([...prev, video.id]))}
                    />
                  ) : (
                    <button
                      onClick={() => setPlaying(video.id)}
                      style={{
                        width: '100%',
                        height: '100%',
                        background: video.thumbnail_url
                          ? `url(${video.thumbnail_url}) center/cover no-repeat`
                          : 'linear-gradient(180deg, rgba(11,17,32,0.3) 0%, rgba(11,17,32,0.8) 100%)',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                        padding: 16,
                        position: 'relative',
                      }}
                    >
                      {/* Dark overlay on top of thumbnail so play button is always visible */}
                      {video.thumbnail_url && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', pointerEvents: 'none' }} />
                      )}
                      <div
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: '50%',
                          background: 'rgba(34,211,238,0.18)',
                          border: '2px solid rgba(34,211,238,0.6)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 0 24px rgba(34,211,238,0.3)',
                          flexShrink: 0,
                          position: 'relative',
                          zIndex: 1,
                        }}
                      >
                        <span style={{ fontSize: 20, marginLeft: 3, color: '#22D3EE' }}>▶</span>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Info below video */}
              <div style={{ padding: '10px 12px 12px' }}>
                <p
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--text)',
                    lineHeight: 1.35,
                    marginBottom: 6,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {title}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{formatDate(video.created_at)}</span>
                  {video.quality_mode && (
                    <span
                      style={{
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 6,
                        background: video.quality_mode === 'cinematic' ? 'rgba(139,92,246,0.15)' : 'rgba(34,211,238,0.1)',
                        border: `1px solid ${video.quality_mode === 'cinematic' ? 'rgba(139,92,246,0.3)' : 'rgba(34,211,238,0.2)'}`,
                        color: video.quality_mode === 'cinematic' ? '#A78BFA' : '#22D3EE',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {video.quality_mode === 'cinematic' ? '✨ AI' : '⚡ Fast'}
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <a
                    href={video.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      padding: '6px 8px',
                      borderRadius: 8,
                      background: 'rgba(34,211,238,0.08)',
                      border: '1px solid rgba(34,211,238,0.2)',
                      color: '#22D3EE',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    ⬇ Download
                  </a>

                  <a
                    href="https://studio.youtube.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      padding: '6px 8px',
                      borderRadius: 8,
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      color: '#F87171',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ▶ YouTube
                  </a>

                  {video.youtube_description && (
                    <button
                      onClick={() => setExpanded(isExpanded ? null : video.id)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'var(--muted)',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isExpanded ? '▲' : '▼'} Info
                    </button>
                  )}
                </div>

                {/* Expanded description */}
                {isExpanded && video.youtube_description && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      fontSize: '0.7rem',
                      color: 'var(--muted)',
                      lineHeight: 1.5,
                      maxHeight: 160,
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {video.youtube_description}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
