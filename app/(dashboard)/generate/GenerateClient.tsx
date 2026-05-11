'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface TaskHandle {
  id: string
  promptText: string
  index: number
}

interface TaskState {
  id: string
  status: 'PENDING' | 'THROTTLED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED'
  progress: number | null
  videoUrl: string | null
  failure: string | null
}

type Phase = 'idle' | 'planning' | 'generating' | 'done' | 'error'
type Duration = '10s' | '30s' | '60s'
type Platform = 'TikTok' | 'YouTube' | 'YouTube Shorts'
type Quality = 'standard' | 'pro'

const POLL_INTERVAL_MS = 5000

// 30s / 60s multi-clip stitching is not yet implemented for Runway Gen-4 Turbo.
// Only 10s is enabled; the others are shown as disabled with a tooltip.
const DURATIONS: { value: Duration; enabled: boolean }[] = [
  { value: '10s', enabled: true },
  { value: '30s', enabled: false },
  { value: '60s', enabled: false },
]
const PLATFORMS: { label: Platform; icon: string }[] = [
  { label: 'TikTok', icon: '📱' },
  { label: 'YouTube', icon: '▶' },
  { label: 'YouTube Shorts', icon: '📲' },
]
const QUALITY_OPTIONS: { key: Quality; title: string; desc: string; credits: number; icon: string }[] = [
  { key: 'standard', title: 'Standard', desc: 'RunwayML Gen-4 Turbo — fast & sharp', credits: 1, icon: '⚡' },
  { key: 'pro', title: 'Pro', desc: 'RunwayML Gen-4 Turbo + best settings — cinematic quality', credits: 2, icon: '✨' },
]

export default function GenerateClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialPrompt = searchParams.get('prompt') ?? ''

  const [prompt, setPrompt] = useState(initialPrompt)
  const [phase, setPhase] = useState<Phase>('idle')
  const [scenes, setScenes] = useState<string[]>([])
  const [tasks, setTasks] = useState<TaskHandle[]>([])
  const [states, setStates] = useState<Record<string, TaskState>>({})
  const [error, setError] = useState<string | null>(null)
  const [playerIndex, setPlayerIndex] = useState(0)
  const [duration, setDuration] = useState<Duration>('10s')
  const [platform, setPlatform] = useState<Platform>('YouTube Shorts')
  const [quality, setQuality] = useState<Quality>('standard')

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const autostartedRef = useRef(false)

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  // Auto-start if a prompt arrives via querystring
  useEffect(() => {
    if (autostartedRef.current) return
    if (initialPrompt && phase === 'idle') {
      autostartedRef.current = true
      handleGenerate(initialPrompt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt])

  // Poll the status endpoint while generating
  useEffect(() => {
    if (phase !== 'generating' || tasks.length === 0) return
    let cancelled = false

    async function poll() {
      try {
        const ids = tasks.map((t) => t.id).join(',')
        const res = await fetch(`/api/generate-video/status?tasks=${encodeURIComponent(ids)}`, {
          cache: 'no-store',
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(data.error || 'Status lookup failed')

        const next: Record<string, TaskState> = {}
        for (const t of data.tasks as TaskState[]) next[t.id] = t
        setStates(next)

        if (data.done) {
          if (data.anyFailed && data.succeeded === 0) {
            setError('Runway failed to generate the video. Please try again.')
            setPhase('error')
            return
          }
          setPhase('done')
          return
        }

        pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
      } catch (err: unknown) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Status lookup failed'
        setError(msg)
        setPhase('error')
      }
    }

    pollTimerRef.current = setTimeout(poll, 1500)
    return () => {
      cancelled = true
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [phase, tasks])

  const orderedClips = useMemo(() => {
    return tasks
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((t) => states[t.id])
      .filter((s): s is TaskState => !!s)
  }, [tasks, states])

  const successClips = useMemo(
    () => orderedClips.filter((s) => s.status === 'SUCCEEDED' && s.videoUrl),
    [orderedClips]
  )

  const totalProgress = useMemo(() => {
    if (tasks.length === 0) return 0
    let sum = 0
    for (const t of tasks) {
      const s = states[t.id]
      if (!s) {
        sum += 0
        continue
      }
      if (s.status === 'SUCCEEDED') sum += 1
      else if (s.status === 'FAILED' || s.status === 'CANCELLED') sum += 1
      else if (typeof s.progress === 'number') sum += Math.max(0, Math.min(1, s.progress))
      else if (s.status === 'RUNNING') sum += 0.4
      else sum += 0.1
    }
    return Math.min(100, Math.round((sum / tasks.length) * 100))
  }, [tasks, states])

  const succeededCount = useMemo(
    () => orderedClips.filter((s) => s.status === 'SUCCEEDED').length,
    [orderedClips]
  )

  async function handleGenerate(overridePrompt?: string) {
    const effective = (overridePrompt ?? prompt).trim()
    if (!effective) {
      setError('Please enter a prompt for your Short.')
      return
    }
    setError(null)
    setStates({})
    setTasks([])
    setScenes([])
    setPlayerIndex(0)
    setPhase('planning')

    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: effective,
          platform,
          duration: duration === '10s' ? 10 : duration === '30s' ? 30 : 60,
        }),
      })
      const data = await res.json()

      if (res.status === 401) {
        router.push('/login?redirect=/generate')
        return
      }
      if (!res.ok) throw new Error(data.error || 'Failed to start video generation.')

      setScenes(data.scenes ?? [])
      setTasks(data.tasks ?? [])
      setPhase('generating')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start video generation.'
      setError(msg)
      setPhase('error')
    }
  }

  function handleReset() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    setPhase('idle')
    setScenes([])
    setTasks([])
    setStates({})
    setError(null)
    setPlayerIndex(0)
  }

  // Auto-advance playlist video player
  function handleVideoEnd() {
    setPlayerIndex((i) => {
      const next = i + 1
      return next < successClips.length ? next : 0
    })
  }

  useEffect(() => {
    // When the playerIndex changes, attempt to autoplay the next clip
    const el = videoRef.current
    if (el && phase === 'done') {
      el.load()
      el.play().catch(() => {})
    }
  }, [playerIndex, phase])

  const currentClipUrl = successClips[playerIndex]?.videoUrl ?? null

  return (
    <main className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .gv-card { animation: fadeUp 0.35s ease both; }
      `}</style>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded"
            style={{
              background: 'linear-gradient(135deg, rgba(168,85,247,.2), rgba(124,58,237,.15))',
              border: '1px solid rgba(168,85,247,.3)',
              color: '#c4b5fd',
            }}
          >
            Beta · AI Video
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
        <h1 className="font-black text-2xl sm:text-3xl mb-1" style={{ color: 'var(--text)' }}>
          🎬 Generate a Real AI Short
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted2)' }}>
          Type a prompt → we plan 4 cinematic scenes → RunwayML Gen-4 Turbo renders a vertical 9:16
          Short you can watch and download.
        </p>
      </div>

      {/* Prompt + Generate */}
      <section
        className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
        style={{
          background: 'rgba(15,15,30,0.85)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Textarea */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Give me a topic, your point of view and instructions in any language…"
          maxLength={500}
          disabled={phase === 'planning' || phase === 'generating'}
          className="w-full rounded-xl px-4 py-4 text-sm leading-relaxed"
          style={{
            background: 'rgba(0,0,0,.3)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            outline: 'none',
            resize: 'none',
            minHeight: '200px',
          }}
        />

        {/* Duration */}
        <div className="mt-5">
          <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>Duration</div>
          <div className="flex gap-2 flex-wrap">
            {DURATIONS.map(({ value: d, enabled }) => (
              <span
                key={d}
                title={enabled ? undefined : 'Coming soon: multi-clip rendering'}
                style={{ display: 'inline-block' }}
              >
                <button
                  onClick={() => enabled && setDuration(d)}
                  disabled={!enabled || phase === 'planning' || phase === 'generating'}
                  className="rounded-full px-4 py-1.5 text-sm font-bold"
                  style={{
                    background: duration === d && enabled ? 'rgba(99,102,241,.85)' : 'rgba(255,255,255,.04)',
                    border: duration === d && enabled ? '1px solid rgba(99,102,241,.6)' : '1px solid var(--border)',
                    color: enabled ? (duration === d ? '#fff' : 'var(--muted)') : 'rgba(255,255,255,.2)',
                    cursor: enabled ? 'pointer' : 'not-allowed',
                    opacity: enabled ? 1 : 0.45,
                    transition: 'all 0.15s',
                  }}
                >
                  {d}
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Platform */}
        <div className="mt-4">
          <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>Platform</div>
          <div className="flex gap-2 flex-wrap">
            {PLATFORMS.map(({ label, icon }) => (
              <button
                key={label}
                onClick={() => setPlatform(label)}
                disabled={phase === 'planning' || phase === 'generating'}
                className="rounded-full px-4 py-1.5 text-sm font-bold flex items-center gap-1.5"
                style={{
                  background: platform === label ? 'rgba(99,102,241,.85)' : 'rgba(255,255,255,.04)',
                  border: platform === label ? '1px solid rgba(99,102,241,.6)' : '1px solid var(--border)',
                  color: platform === label ? '#fff' : 'var(--muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: '0.8rem' }}>{icon}</span> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Quality */}
        <div className="mt-4">
          <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>Quality</div>
          <div className="grid grid-cols-2 gap-3">
            {QUALITY_OPTIONS.map((q) => (
              <button
                key={q.key}
                onClick={() => setQuality(q.key)}
                disabled={phase === 'planning' || phase === 'generating'}
                className="rounded-xl p-3 text-left"
                style={{
                  background: quality === q.key ? 'rgba(99,102,241,.15)' : 'rgba(255,255,255,.03)',
                  border: quality === q.key ? '1px solid rgba(99,102,241,.5)' : '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span>{q.icon}</span>
                  <span className="text-sm font-black" style={{ color: quality === q.key ? '#c4b5fd' : 'var(--text)' }}>{q.title}</span>
                  <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: 'rgba(168,85,247,.15)',
                      color: '#c4b5fd',
                      border: '1px solid rgba(168,85,247,.2)',
                    }}>
                    {q.credits} credit{q.credits > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="text-xs" style={{ color: 'var(--muted2)' }}>{q.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end mt-5 gap-2 flex-wrap">
          {(phase === 'done' || phase === 'error') && (
            <button
              onClick={handleReset}
              className="rounded-xl px-4 py-2.5 text-sm font-bold"
              style={{
                background: 'rgba(255,255,255,.04)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              🔄 Generate Another
            </button>
          )}
          <button
            onClick={() => handleGenerate()}
            disabled={phase === 'planning' || phase === 'generating' || !prompt.trim()}
            className="rounded-xl px-6 py-2.5 text-sm font-black text-white flex items-center gap-2"
            style={{
              background:
                phase === 'planning' || phase === 'generating' || !prompt.trim()
                  ? 'rgba(255,255,255,.04)'
                  : 'linear-gradient(135deg, var(--indigo), var(--purple))',
              border: 'none',
              cursor:
                phase === 'planning' || phase === 'generating' || !prompt.trim()
                  ? 'not-allowed'
                  : 'pointer',
              color:
                phase === 'planning' || phase === 'generating' || !prompt.trim()
                  ? 'var(--muted)'
                  : '#fff',
              boxShadow:
                phase === 'planning' || phase === 'generating' || !prompt.trim()
                  ? 'none'
                  : '0 8px 28px rgba(168,85,247,.35)',
            }}
          >
            Generate
            <span style={{
              padding: '2px 8px',
              borderRadius: 99,
              background: 'rgba(255,255,255,.18)',
              fontSize: '0.75rem',
              fontWeight: 800,
            }}>
              {QUALITY_OPTIONS.find(q => q.key === quality)?.credits ?? 1} credit{(QUALITY_OPTIONS.find(q => q.key === quality)?.credits ?? 1) > 1 ? 's' : ''}
            </span>
          </button>
        </div>
      </section>

      {error && (
        <div
          className="gv-card rounded-xl px-4 py-3 text-sm mb-6"
          style={{
            background: 'rgba(239,68,68,.07)',
            border: '1px solid rgba(239,68,68,.25)',
            color: '#f87171',
          }}
        >
          {error}
        </div>
      )}

      {phase === 'planning' && (
        <section
          className="gv-card rounded-2xl p-5 sm:p-6 mb-6 flex items-center gap-4"
          style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
        >
          <Spinner />
          <div>
            <div className="font-black text-base" style={{ color: 'var(--text)' }}>
              ✍️ Planning your scenes…
            </div>
            <div className="text-sm" style={{ color: 'var(--muted2)' }}>
              GPT-4o-mini is breaking your prompt into 4 cinematic shots.
            </div>
          </div>
        </section>
      )}

      {(phase === 'generating' || phase === 'done' || phase === 'error') && tasks.length > 0 && (
        <section
          className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
          style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="font-black text-base" style={{ color: 'var(--text)' }}>
              {phase === 'done'
                ? '✅ Your Short is ready'
                : `🎬 Rendering scene ${Math.min(succeededCount + 1, tasks.length)}/${tasks.length}…`}
            </div>
            <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
              {totalProgress}%
            </div>
          </div>
          <ProgressBar progress={totalProgress} />
          <div className="text-xs mt-3" style={{ color: 'var(--muted2)' }}>
            {phase === 'done'
              ? 'All scenes finished. Press play below to watch the full Short.'
              : 'RunwayML typically takes ~30-90 seconds per scene. We poll every 5 seconds.'}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {tasks
              .slice()
              .sort((a, b) => a.index - b.index)
              .map((t) => {
                const s = states[t.id]
                const status = s?.status ?? 'PENDING'
                const ok = status === 'SUCCEEDED'
                const failed = status === 'FAILED' || status === 'CANCELLED'
                const running = status === 'RUNNING'
                return (
                  <div
                    key={t.id}
                    className="rounded-xl overflow-hidden"
                    style={{
                      aspectRatio: '9 / 16',
                      background: 'rgba(0,0,0,.4)',
                      border: ok
                        ? '1px solid rgba(16,185,129,.4)'
                        : failed
                        ? '1px solid rgba(239,68,68,.35)'
                        : '1px solid var(--border)',
                      position: 'relative',
                    }}
                  >
                    {ok && s?.videoUrl ? (
                      <video
                        src={s.videoUrl}
                        muted
                        loop
                        autoPlay
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        className="absolute inset-0 flex items-center justify-center text-xs font-bold"
                        style={{
                          color: failed ? '#f87171' : running ? '#c4b5fd' : 'var(--muted)',
                        }}
                      >
                        {failed ? '⚠ Failed' : running ? <Spinner /> : '⏳ Queued'}
                      </div>
                    )}
                    <div
                      className="absolute bottom-0 left-0 right-0 px-2 py-1.5 text-xs font-bold"
                      style={{
                        background: 'linear-gradient(to top, rgba(0,0,0,.85), transparent)',
                        color: '#fff',
                        fontSize: '0.65rem',
                      }}
                    >
                      Scene {t.index + 1} · {status.toLowerCase()}
                    </div>
                  </div>
                )
              })}
          </div>

          {/* Scenes plain-text list */}
          {scenes.length > 0 && (
            <details className="mt-5">
              <summary
                className="text-xs font-black uppercase tracking-widest cursor-pointer"
                style={{ color: 'var(--muted2)' }}
              >
                🎬 Scene prompts
              </summary>
              <ol
                className="mt-2 text-xs space-y-1.5"
                style={{ color: 'var(--muted2)', paddingLeft: 20 }}
              >
                {scenes.map((s, i) => (
                  <li key={i}>
                    <span style={{ color: 'var(--indigo-light)', fontWeight: 700 }}>#{i + 1}</span>{' '}
                    {s}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </section>
      )}

      {phase === 'done' && successClips.length > 0 && currentClipUrl && (
        <section
          className="gv-card rounded-2xl p-5 sm:p-6 mb-6 flex flex-col items-center"
          style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
        >
          <div className="font-black text-lg mb-3" style={{ color: 'var(--text)' }}>
            ▶ Full Short — scene {playerIndex + 1}/{successClips.length}
          </div>
          <div
            className="rounded-2xl overflow-hidden w-full max-w-[300px]"
            style={{
              border: '1px solid rgba(168,85,247,.35)',
              boxShadow: '0 12px 48px rgba(168,85,247,.18)',
              background: '#000',
              aspectRatio: '9 / 16',
            }}
          >
            <video
              ref={videoRef}
              key={currentClipUrl}
              src={currentClipUrl}
              controls
              autoPlay
              playsInline
              onEnded={handleVideoEnd}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
          <div className="flex items-center gap-2 mt-4">
            {successClips.map((_, i) => (
              <button
                key={i}
                onClick={() => setPlayerIndex(i)}
                className="rounded-full"
                style={{
                  width: 10,
                  height: 10,
                  background:
                    i === playerIndex ? '#c4b5fd' : 'rgba(255,255,255,.18)',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: i === playerIndex ? '0 0 8px rgba(168,85,247,.6)' : 'none',
                }}
                aria-label={`Jump to scene ${i + 1}`}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            {successClips.map((s, i) => (
              <a
                key={s.id}
                href={s.videoUrl ?? '#'}
                download={`shortsforge-scene-${i + 1}.mp4`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-white"
                style={{
                  background:
                    i === 0
                      ? 'linear-gradient(135deg, var(--indigo), var(--purple))'
                      : 'rgba(99,102,241,.12)',
                  border: i === 0 ? 'none' : '1px solid rgba(99,102,241,.3)',
                  color: i === 0 ? '#fff' : 'var(--indigo-light)',
                  textDecoration: 'none',
                }}
              >
                ⬇ Scene {i + 1}
              </a>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
            Tip: drop the clips into any video editor (CapCut, InVideo) to merge them into a single
            MP4 with captions + voiceover.
          </p>
        </section>
      )}
    </main>
  )
}

function Spinner() {
  return (
    <div
      className="inline-block rounded-full"
      style={{
        width: 22,
        height: 22,
        border: '2px solid rgba(168,85,247,.25)',
        borderTopColor: '#c4b5fd',
        animation: 'spin 0.9s linear infinite',
      }}
    />
  )
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div
      className="w-full h-2 rounded-full overflow-hidden"
      style={{ background: 'rgba(255,255,255,.06)', border: '1px solid var(--border)' }}
    >
      <div
        className="h-full"
        style={{
          width: `${Math.min(100, Math.max(0, progress))}%`,
          background: 'linear-gradient(90deg, rgba(99,102,241,.85), rgba(168,85,247,1))',
          boxShadow: '0 0 16px rgba(168,85,247,.55)',
          transition: 'width 600ms ease',
        }}
      />
    </div>
  )
}
