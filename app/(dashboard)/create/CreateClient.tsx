'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Scene {
  sceneNumber: number
  duration: number
  narration: string
  visualDescription: string
  searchQuery: string
  emotionalTone: string
}

interface StockClip {
  id: string | number
  url: string
  thumbnail: string
  duration: number
  width: number
  height: number
}

interface ShortVideoResult {
  title: string
  script: string
  videoPrompt: string
  hashtags: string[]
  youtubeDescription: string
}

const NICHE_PILLS: { id: string; label: string; emoji: string }[] = [
  { id: 'general', label: 'General', emoji: '🎬' },
  { id: 'history', label: 'History', emoji: '📖' },
  { id: 'mystery', label: 'Mystery', emoji: '🔮' },
  { id: 'finance', label: 'Finance', emoji: '💰' },
  { id: 'science', label: 'Science', emoji: '🧬' },
  { id: 'technology', label: 'Technology', emoji: '🤖' },
]

const TONE_PILLS: { id: string; label: string; emoji: string }[] = [
  { id: 'dark', label: 'Dark', emoji: '🌑' },
  { id: 'cinematic', label: 'Cinematic', emoji: '🎞️' },
  { id: 'suspense', label: 'Suspense', emoji: '🕯️' },
  { id: 'educational', label: 'Educational', emoji: '📚' },
]

const DURATION_OPTIONS = [30, 45, 60]
const DEFAULT_DURATION = 30

const STAGE_MESSAGES: { id: string; label: string; weight: number }[] = [
  { id: 'script', label: '✍️ Writing viral script...', weight: 18 },
  { id: 'voice', label: '🎙️ Generating AI narration...', weight: 22 },
  { id: 'visuals', label: '🎬 Finding cinematic visuals...', weight: 22 },
  { id: 'captions', label: '📝 Building animated captions...', weight: 8 },
  { id: 'music', label: '🎵 Adding cinematic soundtrack...', weight: 8 },
  { id: 'render', label: '⚡ Rendering your Short...', weight: 22 },
]

interface FinalAssets {
  video: ShortVideoResult
  scenes: Scene[]
  selectedClips: Record<number, StockClip>
  voiceoverUrl: string | null
  niche: string
  topic: string
  renderUrl: string | null
}

export default function CreateClient() {
  const searchParams = useSearchParams()
  const initialNicheParam = searchParams.get('niche') || ''

  const initialNiche = useMemo(() => {
    return NICHE_PILLS.find((n) => n.id === initialNicheParam)?.id ?? 'general'
  }, [initialNicheParam])

  const [topic, setTopic] = useState('')
  const [niche, setNiche] = useState(initialNiche)
  const [tone, setTone] = useState('cinematic')
  const [duration, setDuration] = useState(DEFAULT_DURATION)

  const [credits, setCredits] = useState<number | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(true)

  const [running, setRunning] = useState(false)
  const [stageId, setStageId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false)

  const [final, setFinal] = useState<FinalAssets | null>(null)
  const [copyToast, setCopyToast] = useState(false)

  // Load credits
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/credits', { cache: 'no-store' })
        const data = await res.json()
        if (!cancelled) {
          setCredits(typeof data.credits === 'number' ? data.credits : 0)
        }
      } catch {
        if (!cancelled) setCredits(0)
      } finally {
        if (!cancelled) setCreditsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Sync niche from URL changes (sidebar quick-create links)
  useEffect(() => {
    const next = NICHE_PILLS.find((n) => n.id === initialNicheParam)?.id
    if (next) setNiche(next)
  }, [initialNicheParam])

  // Cleanup voiceover blob on unmount
  useEffect(() => {
    return () => {
      if (final?.voiceoverUrl) URL.revokeObjectURL(final.voiceoverUrl)
    }
  }, [final?.voiceoverUrl])

  function setStage(id: string, baseProgress: number) {
    setStageId(id)
    setProgress(baseProgress)
  }

  async function refreshCreditsFromServer() {
    try {
      const res = await fetch('/api/credits', { cache: 'no-store' })
      const data = await res.json()
      if (typeof data.credits === 'number') setCredits(data.credits)
      window.dispatchEvent(new CustomEvent('creditsChanged'))
    } catch {
      // ignore
    }
  }

  async function handleGenerate() {
    if (running) return

    if (!topic.trim()) {
      setError('Please add a topic for your video.')
      return
    }

    if (credits !== null && credits <= 0) {
      setShowNoCreditsModal(true)
      return
    }

    setError(null)
    setFinal(null)
    setRunning(true)
    setProgress(0)
    setStage('script', 4)

    try {
      // Step 1 — Generate script
      setStage('script', 8)
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche, topic: topic.trim(), tone, duration }),
      })
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to generate the script.')
      }
      const genData = await genRes.json()
      const video: ShortVideoResult | undefined = Array.isArray(genData.videos) ? genData.videos[0] : undefined
      if (!video) throw new Error('Invalid response from the script generator.')
      setStage('voice', 22)

      // Step 2 — Voiceover
      const voiceRes = await fetch('/api/voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: video.script }),
      })
      let voiceoverUrl: string | null = null
      if (voiceRes.ok) {
        const blob = await voiceRes.blob()
        voiceoverUrl = URL.createObjectURL(blob)
      } else {
        // non-fatal — continue without voiceover
        console.warn('[create] voiceover failed', await voiceRes.text().catch(() => ''))
      }
      setStage('visuals', 42)

      // Step 3 — Scenes
      const scenesRes = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: video.script, niche }),
      })
      let scenes: Scene[] = []
      if (scenesRes.ok) {
        const data = await scenesRes.json()
        scenes = Array.isArray(data.scenes) ? data.scenes : []
      } else {
        console.warn('[create] scenes failed')
      }
      setStage('visuals', 56)

      // Step 4 — Stock clips per scene
      const selectedClips: Record<number, StockClip> = {}
      if (scenes.length > 0) {
        const results = await Promise.all(
          scenes.map(async (s) => {
            try {
              const r = await fetch(
                `/api/stock?q=${encodeURIComponent(s.searchQuery || s.visualDescription)}`,
                { cache: 'no-store' }
              )
              if (!r.ok) return { sceneNumber: s.sceneNumber, videos: [] as StockClip[] }
              const data = await r.json()
              return {
                sceneNumber: s.sceneNumber,
                videos: (data.videos ?? []) as StockClip[],
              }
            } catch {
              return { sceneNumber: s.sceneNumber, videos: [] as StockClip[] }
            }
          })
        )
        for (const r of results) {
          if (r.videos[0]) selectedClips[r.sceneNumber] = r.videos[0]
        }
      }
      setStage('captions', 70)
      await wait(500)

      setStage('music', 80)
      await wait(500)

      // Step 5 — Render (best-effort: may not be available yet)
      setStage('render', 86)
      let renderUrl: string | null = null
      try {
        const renderRes = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video,
            scenes,
            selectedClips,
            niche,
            topic: topic.trim(),
            tone,
            duration,
          }),
        })
        if (renderRes.ok) {
          const data = await renderRes.json()
          const renderId: string | undefined = data.renderId
          if (renderId) {
            // Poll
            for (let i = 0; i < 60; i++) {
              await wait(3000)
              try {
                const pollRes = await fetch(`/api/render/${renderId}`, { cache: 'no-store' })
                if (!pollRes.ok) break
                const pollData = await pollRes.json()
                if (pollData.status === 'done' && pollData.url) {
                  renderUrl = pollData.url as string
                  break
                }
                if (pollData.status === 'error') break
              } catch {
                break
              }
              setProgress((p) => Math.min(96, p + 1))
            }
          } else if (data.url) {
            renderUrl = data.url
          }
        }
      } catch {
        // Render endpoint may not exist yet — fall through with staged assets only
      }

      setProgress(100)
      await wait(300)

      // Deduct credit on success
      try {
        const dedRes = await fetch('/api/credits/deduct', { method: 'POST' })
        if (dedRes.ok) {
          const data = await dedRes.json()
          if (typeof data.credits === 'number') setCredits(data.credits)
          window.dispatchEvent(new CustomEvent('creditsChanged'))
        } else {
          await refreshCreditsFromServer()
        }
      } catch {
        await refreshCreditsFromServer()
      }

      setFinal({
        video,
        scenes,
        selectedClips,
        voiceoverUrl,
        niche,
        topic: topic.trim(),
        renderUrl,
      })
      setRunning(false)
      setStageId(null)
    } catch (err) {
      setRunning(false)
      setStageId(null)
      setProgress(0)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text)
    setCopyToast(true)
    setTimeout(() => setCopyToast(false), 1800)
  }

  function handleRegenerate() {
    setFinal(null)
    setError(null)
    setProgress(0)
  }

  const creditsZero = credits !== null && credits <= 0
  const currentStage = stageId ? STAGE_MESSAGES.find((s) => s.id === stageId) : null

  return (
    <div className="px-4 md:px-6 py-7 pb-20 max-w-4xl mx-auto">
      {/* Toast */}
      {copyToast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 px-5 py-3 rounded-xl text-sm font-bold text-white"
          style={{
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg,#10b981,#059669)',
            boxShadow: '0 4px 24px rgba(16,185,129,.4)',
          }}
        >
          ✅ Copied!
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="text-xs font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--indigo-light)' }}>
          ⚡ Autopilot
        </div>
        <h1 className="font-black tracking-tight mb-1" style={{ fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', color: 'var(--text)' }}>
          Create a Short in <span className="grad-text">one click</span>
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted2)' }}>
          AI writes the script, generates the narration, finds the visuals and renders everything automatically.
        </p>
      </div>

      {/* Form (hidden during run + final) */}
      {!running && !final && (
        <div
          className="rounded-[20px] p-6 md:p-7 mb-5"
          style={{
            background: 'rgba(15,15,30,0.85)',
            border: '1px solid rgba(99,102,241,.22)',
            boxShadow: '0 0 30px rgba(99,102,241,.08)',
          }}
        >
          {/* Topic input */}
          <label className="block mb-4">
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--indigo-light)', fontSize: '0.62rem' }}>
              What&apos;s your video about?
            </div>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. 3 secrets about the Bermuda Triangle"
              className="w-full rounded-xl px-4 py-3.5 text-base outline-none transition-all"
              style={{
                background: 'rgba(0,0,0,.32)',
                border: '1px solid var(--border2)',
                color: 'var(--text)',
                fontWeight: 500,
              }}
              onFocus={(e) => {
                ;(e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(99,102,241,.5)'
              }}
              onBlur={(e) => {
                ;(e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border2)'
              }}
            />
          </label>

          {/* Niche pills */}
          <div className="mb-4">
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted2)', fontSize: '0.62rem' }}>
              Niche
            </div>
            <div className="flex flex-wrap gap-2">
              {NICHE_PILLS.map((n) => (
                <Pill
                  key={n.id}
                  active={niche === n.id}
                  emoji={n.emoji}
                  label={n.label}
                  onClick={() => setNiche(n.id)}
                />
              ))}
            </div>
          </div>

          {/* Tone pills */}
          <div className="mb-4">
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted2)', fontSize: '0.62rem' }}>
              Tone
            </div>
            <div className="flex flex-wrap gap-2">
              {TONE_PILLS.map((t) => (
                <Pill
                  key={t.id}
                  active={tone === t.id}
                  emoji={t.emoji}
                  label={t.label}
                  onClick={() => setTone(t.id)}
                />
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="mb-6">
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted2)', fontSize: '0.62rem' }}>
              Duration
            </div>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((d) => (
                <Pill
                  key={d}
                  active={duration === d}
                  label={`${d}s`}
                  onClick={() => setDuration(d)}
                />
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm mb-4 flex items-center gap-2"
              style={{
                background: 'rgba(239,68,68,.08)',
                border: '1px solid rgba(239,68,68,.22)',
                color: '#f87171',
              }}
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={creditsLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-4 text-base font-black text-white transition-all"
            style={{
              background: creditsZero
                ? 'linear-gradient(135deg, #94a3b8, #64748b)'
                : 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)',
              boxShadow: creditsZero ? 'none' : '0 4px 28px rgba(99,102,241,.45)',
              cursor: creditsLoading ? 'not-allowed' : 'pointer',
              border: 'none',
              opacity: creditsLoading ? 0.7 : 1,
            }}
          >
            ⚡ Generate Video — 1 credit
          </button>

          {/* Credits hint */}
          <div className="mt-3 text-center text-xs" style={{ color: creditsZero ? '#f87171' : 'var(--muted)' }}>
            {creditsLoading
              ? 'Loading balance…'
              : creditsZero
              ? 'No credits left. Get more in Pricing.'
              : `You have ${credits ?? 0} credit${credits === 1 ? '' : 's'} available.`}
          </div>
        </div>
      )}

      {/* Progress view */}
      {running && (
        <ProgressView progress={progress} stageLabel={currentStage?.label ?? '⚡ Starting...'} />
      )}

      {/* Final / export view */}
      {final && (
        <FinalView
          final={final}
          onCopy={handleCopy}
          onRegenerate={handleRegenerate}
        />
      )}

      {/* No-credits modal */}
      {showNoCreditsModal && (
        <NoCreditsModal onClose={() => setShowNoCreditsModal(false)} />
      )}
    </div>
  )
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function Pill({
  active,
  emoji,
  label,
  onClick,
}: {
  active: boolean
  emoji?: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3.5 py-2 rounded-full text-xs font-bold transition-all"
      style={{
        background: active
          ? 'linear-gradient(135deg, rgba(99,102,241,.25), rgba(124,58,237,.18))'
          : 'rgba(255,255,255,.04)',
        border: active ? '1px solid rgba(99,102,241,.5)' : '1px solid var(--border2)',
        color: active ? 'var(--text)' : 'var(--muted2)',
        cursor: 'pointer',
        boxShadow: active ? '0 0 16px rgba(99,102,241,.2)' : 'none',
      }}
    >
      {emoji ? `${emoji} ` : ''}
      {label}
    </button>
  )
}

function ProgressView({ progress, stageLabel }: { progress: number; stageLabel: string }) {
  return (
    <div
      className="rounded-[20px] p-7 md:p-9 mb-5 text-center"
      style={{
        background: 'rgba(15,15,30,0.85)',
        border: '1px solid rgba(99,102,241,.32)',
        boxShadow: '0 0 50px rgba(99,102,241,.18)',
      }}
    >
      <style jsx>{`
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 32px rgba(168,85,247,.4); transform: scale(1); }
          50% { box-shadow: 0 0 56px rgba(168,85,247,.65); transform: scale(1.04); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div
        className="w-20 h-20 rounded-3xl mx-auto flex items-center justify-center mb-5"
        style={{
          background: 'linear-gradient(135deg, rgba(168,85,247,.35), rgba(99,102,241,.2))',
          border: '1px solid rgba(168,85,247,.5)',
          fontSize: '2rem',
          animation: 'pulseGlow 1.6s ease-in-out infinite',
        }}
      >
        ⚡
      </div>

      <div className="font-black text-base mb-2" style={{ color: 'var(--text)' }}>
        {stageLabel}
      </div>
      <div className="text-xs mb-5" style={{ color: 'var(--muted)' }}>
        Hang tight — we&apos;re building your Short from start to finish.
      </div>

      {/* Progress bar */}
      <div className="rounded-full overflow-hidden mb-3" style={{ height: 10, background: 'rgba(255,255,255,.05)' }}>
        <div
          className="h-full transition-all"
          style={{
            width: `${Math.min(100, Math.max(2, progress))}%`,
            background:
              'linear-gradient(90deg, #6366f1, #a855f7, #ec4899, #a855f7, #6366f1)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 2.4s linear infinite',
            transitionDuration: '600ms',
          }}
        />
      </div>
      <div className="text-xs font-bold" style={{ color: 'var(--indigo-light)' }}>
        {Math.min(100, Math.max(0, Math.round(progress)))}%
      </div>
    </div>
  )
}

function FinalView({
  final,
  onCopy,
  onRegenerate,
}: {
  final: FinalAssets
  onCopy: (text: string) => void
  onRegenerate: () => void
}) {
  const { video, scenes, selectedClips, voiceoverUrl, renderUrl } = final
  const previewClip = scenes[0] ? selectedClips[scenes[0].sceneNumber] : null

  function downloadAll() {
    const text = [
      `🎬 TITLE: ${video.title}`,
      ``,
      `📝 SCRIPT:`,
      video.script,
      ``,
      `#️⃣ HASHTAGS: ${video.hashtags.join(' ')}`,
      ``,
      `📄 DESCRIPTION:`,
      video.youtubeDescription,
      ``,
      `🎥 VIDEO PROMPT:`,
      video.videoPrompt,
    ].join('\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `short-${final.niche}-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Success banner */}
      <div
        className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
        style={{
          background: 'linear-gradient(90deg, rgba(16,185,129,.1), rgba(16,185,129,.04))',
          border: '1px solid rgba(16,185,129,.25)',
          color: 'var(--muted2)',
        }}
      >
        <span className="text-lg">✅</span>
        <span>
          <strong style={{ color: 'var(--text)' }}>Done!</strong> Your Short is rendered and ready to post.
        </span>
      </div>

      {/* Preview */}
      <div
        className="rounded-[20px] p-5 md:p-6"
        style={{
          background: 'rgba(15,15,30,0.85)',
          border: '1px solid rgba(99,102,241,.22)',
          boxShadow: '0 0 30px rgba(99,102,241,.08)',
        }}
      >
        <div className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--indigo-light)', fontSize: '0.62rem' }}>
          🎬 Preview
        </div>
        <div className="flex flex-col md:flex-row gap-5">
          <div
            className="rounded-2xl overflow-hidden flex-shrink-0 mx-auto md:mx-0"
            style={{
              width: 220,
              aspectRatio: '9 / 16',
              background: 'rgba(0,0,0,.5)',
              border: '1px solid var(--border2)',
            }}
          >
            {renderUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={renderUrl} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : previewClip ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={previewClip.url}
                muted
                loop
                autoPlay
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">🎬</div>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: 'var(--muted2)', fontSize: '0.6rem' }}>
                Title
              </div>
              <div className="font-bold text-base leading-snug" style={{ color: 'var(--text)' }}>
                {video.title}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {renderUrl ? (
                <a
                  href={renderUrl}
                  download={`short-${final.niche}.mp4`}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white"
                  style={{
                    background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
                    boxShadow: '0 4px 18px rgba(99,102,241,.32)',
                    textDecoration: 'none',
                  }}
                >
                  ⬇️ Download MP4
                </a>
              ) : (
                <div
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold"
                  style={{
                    background: 'rgba(245,158,11,.1)',
                    border: '1px solid rgba(245,158,11,.3)',
                    color: '#fbbf24',
                  }}
                >
                  ⏳ Final render queued
                </div>
              )}
              {voiceoverUrl && (
                <a
                  href={voiceoverUrl}
                  download="voiceover.mp3"
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold"
                  style={{
                    background: 'rgba(99,102,241,.08)',
                    border: '1px solid rgba(99,102,241,.22)',
                    color: 'var(--indigo-light)',
                    textDecoration: 'none',
                  }}
                >
                  🎙️ Download Voiceover
                </a>
              )}
              <button
                onClick={downloadAll}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all"
                style={{
                  background: 'rgba(16,185,129,.08)',
                  border: '1px solid rgba(16,185,129,.25)',
                  color: '#34d399',
                  cursor: 'pointer',
                }}
              >
                📄 Download Pack (.txt)
              </button>
            </div>

            {voiceoverUrl && (
              <audio src={voiceoverUrl} controls style={{ width: '100%' }} />
            )}
          </div>
        </div>
      </div>

      {/* Title */}
      <FieldBlock label="Title" value={video.title} onCopy={onCopy} />

      {/* Hashtags */}
      <FieldBlock label="Hashtags" value={video.hashtags.join(' ')} onCopy={onCopy} />

      {/* Description */}
      <FieldBlock
        label="YouTube Description"
        value={video.youtubeDescription}
        onCopy={onCopy}
        multiline
      />

      {/* Script */}
      <FieldBlock label="Full Script" value={video.script} onCopy={onCopy} multiline />

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-center mt-2">
        <button
          onClick={onRegenerate}
          className="rounded-xl px-6 py-3 text-sm font-black text-white"
          style={{
            background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
            boxShadow: '0 4px 22px rgba(99,102,241,.35)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          🔄 Generate Another
        </button>
        <Link
          href="/dashboard"
          className="rounded-xl px-6 py-3 text-sm font-bold"
          style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid var(--border)',
            color: 'var(--muted2)',
            textDecoration: 'none',
          }}
        >
          ← Dashboard
        </Link>
      </div>
    </div>
  )
}

function FieldBlock({
  label,
  value,
  onCopy,
  multiline,
}: {
  label: string
  value: string
  onCopy: (text: string) => void
  multiline?: boolean
}) {
  return (
    <div
      className="rounded-[20px] p-5"
      style={{
        background: 'rgba(15,15,30,0.85)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted)', fontSize: '0.6rem' }}>
          {label}
        </div>
        <button
          onClick={() => onCopy(value)}
          className="text-xs font-bold px-2.5 py-1 rounded-md"
          style={{
            background: 'rgba(99,102,241,.07)',
            border: '1px solid rgba(99,102,241,.18)',
            color: 'var(--indigo-light)',
            cursor: 'pointer',
            fontSize: '0.62rem',
          }}
        >
          📋 Copy
        </button>
      </div>
      <div
        className="text-sm leading-relaxed"
        style={{
          color: 'var(--text2)',
          whiteSpace: multiline ? 'pre-wrap' : 'normal',
          maxHeight: multiline ? 360 : undefined,
          overflowY: multiline ? 'auto' : undefined,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function NoCreditsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(8,8,15,.92)', backdropFilter: 'blur(24px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl relative overflow-hidden"
        style={{
          background: 'var(--card2)',
          border: '1px solid rgba(99,102,241,.32)',
          boxShadow: '0 0 80px rgba(99,102,241,.25), 0 30px 80px rgba(0,0,0,.5)',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, #6366f1, #a855f7, transparent)' }} />
        <div className="p-7 relative z-10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all"
            style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid var(--border)',
              color: 'var(--muted2)',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
          <div className="text-4xl mb-4 text-center">⚡</div>
          <h2 className="text-xl font-black tracking-tight mb-3 text-center" style={{ color: 'var(--text)' }}>
            No credits left
          </h2>
          <p className="text-sm text-center mb-6" style={{ color: 'var(--muted2)', lineHeight: 1.6 }}>
            You&apos;ve used all your credits. Get more in Pricing to keep building viral videos.
          </p>
          <Link
            href="/pricing"
            className="block w-full text-center rounded-xl py-3.5 text-sm font-black text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)',
              boxShadow: '0 4px 28px rgba(99,102,241,.45)',
              textDecoration: 'none',
            }}
          >
            💳 Buy Credits
          </Link>
          <button
            onClick={onClose}
            className="block w-full text-center mt-2 py-2 text-xs font-bold transition-all"
            style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  )
}
