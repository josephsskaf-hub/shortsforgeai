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

interface Analysis {
  title: string
  summary: string
  niche: string
  scenePlan: string[]
}

type Phase = 'idle' | 'analyzing' | 'options' | 'generating' | 'done' | 'error'
type Duration = 10 | 30 | 60
type Quality = 'basic' | 'basic_ai' | 'pro'

const POLL_INTERVAL_MS = 5000

const QUALITY_OPTIONS: {
  key: Quality
  title: string
  desc: string
  credits: number
  icon: string
}[] = [
  { key: 'basic',    title: 'Basic',    desc: 'Uses licensed stock media from top providers.',     credits: 1, icon: '🎞️' },
  { key: 'basic_ai', title: 'Basic AI', desc: 'Uses our most efficient generative models.',         credits: 1, icon: '⚡' },
  { key: 'pro',      title: 'Pro',      desc: 'Uses premium generative models and cinematic look.', credits: 2, icon: '✨' },
]

const GENERIC_ERROR = 'Video generation failed. Please try again.'

export default function GenerateClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialPrompt = searchParams.get('prompt') ?? ''

  const [prompt, setPrompt] = useState(initialPrompt)
  const [phase, setPhase] = useState<Phase>('idle')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [scenes, setScenes] = useState<string[]>([])
  const [tasks, setTasks] = useState<TaskHandle[]>([])
  const [states, setStates] = useState<Record<string, TaskState>>({})
  const [error, setError] = useState<string | null>(null)
  const [playerIndex, setPlayerIndex] = useState(0)
  const [duration, setDuration] = useState<Duration>(30)
  const [quality, setQuality] = useState<Quality>('basic_ai')

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  // Poll status while generating
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
        if (!res.ok) throw new Error('Status lookup failed')

        const next: Record<string, TaskState> = {}
        for (const t of data.tasks as TaskState[]) next[t.id] = t
        setStates(next)

        if (data.done) {
          if (data.anyFailed && data.succeeded === 0) {
            setError(GENERIC_ERROR)
            setPhase('error')
            return
          }
          setPhase('done')
          return
        }

        pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
      } catch (err: unknown) {
        if (cancelled) return
        console.error('[generate] status poll error:', err)
        setError(GENERIC_ERROR)
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
      if (!s) { sum += 0; continue }
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

  async function handleAnalyze() {
    const trimmed = prompt.trim()
    if (!trimmed) {
      setError('Please describe your video idea first.')
      return
    }
    setError(null)
    setPhase('analyzing')
    try {
      const res = await fetch('/api/analyze-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed }),
      })
      if (res.status === 401) {
        router.push('/login?redirect=/generate')
        return
      }
      const data = await res.json()
      if (!res.ok) {
        console.error('[generate] analyze failed:', data?.error)
        setError('Could not analyze that idea. Please try again.')
        setPhase('idle')
        return
      }
      setAnalysis({
        title: data.title ?? '',
        summary: data.summary ?? '',
        niche: data.niche ?? '',
        scenePlan: Array.isArray(data.scenePlan) ? data.scenePlan : [],
      })
      setPhase('options')
    } catch (err) {
      console.error('[generate] analyze threw:', err)
      setError('Could not analyze that idea. Please try again.')
      setPhase('idle')
    }
  }

  async function handleGenerate() {
    const trimmed = prompt.trim()
    if (!trimmed) {
      setError('Please describe your video idea first.')
      return
    }
    setError(null)
    setStates({})
    setTasks([])
    setScenes([])
    setPlayerIndex(0)
    setPhase('generating')

    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          platform: 'YouTube Shorts',
          duration,
          quality,
        }),
      })
      const data = await res.json()

      if (res.status === 401) {
        router.push('/login?redirect=/generate')
        return
      }

      if (res.status === 402) {
        setError(`Not enough credits. This generation needs ${QUALITY_OPTIONS.find(q => q.key === quality)?.credits ?? 1} credit(s).`)
        setPhase('error')
        return
      }

      if (!res.ok) {
        console.error('[generate] generate-video error:', data?.error)
        setError(GENERIC_ERROR)
        setPhase('error')
        return
      }

      setScenes(data.scenes ?? [])
      setTasks(data.tasks ?? [])
      // Notify sidebar to refresh credits
      try { window.dispatchEvent(new Event('creditsChanged')) } catch {}
    } catch (err: unknown) {
      console.error('[generate] generate threw:', err)
      setError(GENERIC_ERROR)
      setPhase('error')
    }
  }

  function handleReset() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    setPhase('idle')
    setAnalysis(null)
    setScenes([])
    setTasks([])
    setStates({})
    setError(null)
    setPlayerIndex(0)
  }

  function handleBackToEdit() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    setPhase('idle')
    setError(null)
  }

  function handleVideoEnd() {
    setPlayerIndex((i) => {
      const next = i + 1
      return next < successClips.length ? next : 0
    })
  }

  useEffect(() => {
    const el = videoRef.current
    if (el && phase === 'done') {
      el.load()
      el.play().catch(() => {})
    }
  }, [playerIndex, phase])

  const currentClipUrl = successClips[playerIndex]?.videoUrl ?? null
  const selectedCost = QUALITY_OPTIONS.find((q) => q.key === quality)?.credits ?? 1
  const showStep1 = phase === 'idle' || phase === 'analyzing'
  const showStep2 = phase === 'options'
  const showRender = phase === 'generating' || phase === 'done' || phase === 'error'

  return (
    <main className="px-4 sm:px-6 py-8 max-w-3xl mx-auto">
      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .gv-card { animation: fadeUp 0.35s ease both; }
      `}</style>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded"
            style={{
              background: 'rgba(37,99,235,.15)',
              border: '1px solid rgba(37,99,235,.35)',
              color: '#93c5fd',
            }}
          >
            AI Video
          </span>
        </div>
        <h1 className="font-black text-2xl sm:text-3xl mb-1" style={{ color: 'var(--text)' }}>
          🎬 Generate a Real AI Short
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted2)' }}>
          {showStep1 && 'Describe your idea. We\'ll analyze it before charging any credits.'}
          {showStep2 && 'Pick duration and quality, then generate.'}
          {showRender && 'Rendering your vertical 9:16 Short.'}
        </p>
      </div>

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

      {/* ── STEP 1: Idea ── */}
      {showStep1 && (
        <section
          className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
          style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
        >
          <label
            className="block text-xs font-black uppercase tracking-widest mb-2"
            style={{ color: 'var(--muted)' }}
          >
            Your idea or script
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your Short — topic, angle, hook, anything you want viewers to feel…"
            maxLength={1000}
            disabled={phase === 'analyzing'}
            className="w-full rounded-xl px-4 py-4 text-sm leading-relaxed"
            style={{
              background: 'rgba(0,0,0,.3)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              outline: 'none',
              resize: 'none',
              minHeight: '220px',
            }}
          />
          <div className="flex items-center justify-between mt-4 gap-3 flex-wrap">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Analyzing your idea is free — no credits are charged.
            </p>
            <button
              onClick={handleAnalyze}
              disabled={phase === 'analyzing' || !prompt.trim()}
              className="rounded-xl px-6 py-2.5 text-sm font-black text-white flex items-center gap-2"
              style={{
                background:
                  phase === 'analyzing' || !prompt.trim()
                    ? 'rgba(255,255,255,.04)'
                    : 'linear-gradient(135deg, #2563EB, #1d4ed8)',
                border: 'none',
                cursor: phase === 'analyzing' || !prompt.trim() ? 'not-allowed' : 'pointer',
                color: phase === 'analyzing' || !prompt.trim() ? 'var(--muted)' : '#fff',
                boxShadow:
                  phase === 'analyzing' || !prompt.trim()
                    ? 'none'
                    : '0 8px 28px rgba(37,99,235,.4)',
              }}
            >
              {phase === 'analyzing' ? (
                <>
                  <Spinner />
                  Analyzing…
                </>
              ) : (
                'Analyze Idea'
              )}
            </button>
          </div>
        </section>
      )}

      {phase === 'analyzing' && (
        <section
          className="gv-card rounded-2xl p-5 sm:p-6 mb-6 flex items-center gap-4"
          style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
        >
          <Spinner />
          <div>
            <div className="font-black text-base" style={{ color: 'var(--text)' }}>
              Analyzing your video concept…
            </div>
            <div className="text-sm" style={{ color: 'var(--muted2)' }}>
              Detecting niche, drafting a title, and outlining the scenes.
            </div>
          </div>
        </section>
      )}

      {/* ── STEP 2: Options ── */}
      {showStep2 && analysis && (
        <>
          <section
            className="gv-card rounded-2xl p-5 sm:p-6 mb-4"
            style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <span
                className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded"
                style={{
                  background: 'rgba(37,99,235,.12)',
                  border: '1px solid rgba(37,99,235,.3)',
                  color: '#93c5fd',
                }}
              >
                Niche · {analysis.niche || 'General'}
              </span>
              <button
                onClick={handleBackToEdit}
                className="text-xs font-bold rounded-lg px-3 py-1.5"
                style={{
                  background: 'rgba(255,255,255,.04)',
                  border: '1px solid var(--border)',
                  color: 'var(--muted2)',
                  cursor: 'pointer',
                }}
              >
                ← Edit idea
              </button>
            </div>
            <h2 className="font-black text-lg sm:text-xl mb-2" style={{ color: 'var(--text)' }}>
              {analysis.title}
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--muted2)', lineHeight: 1.55 }}>
              {analysis.summary}
            </p>
            {analysis.scenePlan.length > 0 && (
              <ol className="space-y-1.5 text-xs" style={{ color: 'var(--muted2)', paddingLeft: 20 }}>
                {analysis.scenePlan.map((s, i) => (
                  <li key={i}>
                    <span style={{ color: '#93c5fd', fontWeight: 700 }}>Scene {i + 1}.</span> {s}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section
            className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
            style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
          >
            {/* Duration */}
            <div>
              <div
                className="text-xs font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--muted)' }}
              >
                Duration
              </div>
              <div className="flex gap-2 flex-wrap">
                {([10, 30, 60] as Duration[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className="rounded-full px-4 py-1.5 text-sm font-bold"
                    style={{
                      background: duration === d ? 'rgba(37,99,235,.85)' : 'rgba(255,255,255,.04)',
                      border: duration === d ? '1px solid rgba(37,99,235,.6)' : '1px solid var(--border)',
                      color: duration === d ? '#fff' : 'var(--muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {d === 30 ? `${d} seconds (default)` : `${d} seconds`}
                  </button>
                ))}
              </div>
              {duration !== 10 && (
                <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                  Rendered as {duration === 30 ? '3' : '6'} cinematic 10s clips you can stitch in
                  any editor.
                </p>
              )}
            </div>

            {/* Platform */}
            <div className="mt-5">
              <div
                className="text-xs font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--muted)' }}
              >
                Platform
              </div>
              <div className="flex gap-2 flex-wrap">
                <span
                  className="rounded-full px-4 py-1.5 text-sm font-bold flex items-center gap-1.5"
                  style={{
                    background: 'rgba(37,99,235,.85)',
                    border: '1px solid rgba(37,99,235,.6)',
                    color: '#fff',
                  }}
                >
                  <span style={{ fontSize: '0.8rem' }}>📲</span> YouTube Shorts (9:16)
                </span>
              </div>
            </div>

            {/* Quality cards */}
            <div className="mt-5">
              <div
                className="text-xs font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--muted)' }}
              >
                Media & quality
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {QUALITY_OPTIONS.map((q) => {
                  const selected = quality === q.key
                  return (
                    <button
                      key={q.key}
                      onClick={() => setQuality(q.key)}
                      className="rounded-xl p-4 text-left"
                      style={{
                        background: selected ? 'rgba(37,99,235,.12)' : 'rgba(255,255,255,.03)',
                        border: selected ? '1px solid rgba(37,99,235,.55)' : '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        boxShadow: selected ? '0 0 22px rgba(37,99,235,.18)' : 'none',
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span>{q.icon}</span>
                        <span
                          className="text-sm font-black"
                          style={{ color: selected ? '#93c5fd' : 'var(--text)' }}
                        >
                          {q.title}
                        </span>
                        <span
                          className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(37,99,235,.18)',
                            color: '#93c5fd',
                            border: '1px solid rgba(37,99,235,.3)',
                          }}
                        >
                          {q.credits} credit{q.credits > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="text-xs" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
                        {q.desc}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Generate */}
            <div className="flex items-center justify-end mt-6 gap-2 flex-wrap">
              <button
                onClick={handleGenerate}
                className="rounded-xl px-6 py-3 text-sm font-black text-white flex items-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #2563EB, #1d4ed8)',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 8px 28px rgba(37,99,235,.4)',
                }}
              >
                Generate
                <span
                  style={{
                    padding: '2px 10px',
                    borderRadius: 99,
                    background: 'rgba(255,255,255,.18)',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                  }}
                >
                  {selectedCost} credit{selectedCost > 1 ? 's' : ''}
                </span>
              </button>
            </div>
          </section>
        </>
      )}

      {/* ── Render / Done / Error ── */}
      {showRender && (
        <>
          {tasks.length > 0 && (
            <section
              className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
              style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="font-black text-base" style={{ color: 'var(--text)' }}>
                  {phase === 'done'
                    ? '✅ Your Short is ready'
                    : `🎬 Rendering ${Math.min(succeededCount + 1, tasks.length)}/${tasks.length}…`}
                </div>
                <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
                  {totalProgress}%
                </div>
              </div>
              <ProgressBar progress={totalProgress} />
              <div className="text-xs mt-3" style={{ color: 'var(--muted2)' }}>
                {phase === 'done'
                  ? 'All clips finished. Press play below to watch the full Short.'
                  : 'Runway typically takes ~30-90 seconds per 10s clip. We poll every 5 seconds.'}
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
                              color: failed ? '#f87171' : running ? '#93c5fd' : 'var(--muted)',
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
                          Clip {t.index + 1} · {status.toLowerCase()}
                        </div>
                      </div>
                    )
                  })}
              </div>

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
                        <span style={{ color: '#93c5fd', fontWeight: 700 }}>#{i + 1}</span> {s}
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
                ▶ Full Short — clip {playerIndex + 1}/{successClips.length}
              </div>
              <div
                className="rounded-2xl overflow-hidden w-full max-w-[300px]"
                style={{
                  border: '1px solid rgba(37,99,235,.4)',
                  boxShadow: '0 12px 48px rgba(37,99,235,.2)',
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
                      background: i === playerIndex ? '#93c5fd' : 'rgba(255,255,255,.18)',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: i === playerIndex ? '0 0 8px rgba(37,99,235,.6)' : 'none',
                    }}
                    aria-label={`Jump to clip ${i + 1}`}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                {successClips.map((s, i) => (
                  <a
                    key={s.id}
                    href={s.videoUrl ?? '#'}
                    download={`shortsforge-clip-${i + 1}.mp4`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl px-4 py-2.5 text-xs font-bold text-white"
                    style={{
                      background:
                        i === 0
                          ? 'linear-gradient(135deg, #2563EB, #1d4ed8)'
                          : 'rgba(37,99,235,.12)',
                      border: i === 0 ? 'none' : '1px solid rgba(37,99,235,.3)',
                      color: i === 0 ? '#fff' : '#93c5fd',
                      textDecoration: 'none',
                    }}
                  >
                    ⬇ Clip {i + 1}
                  </a>
                ))}
              </div>
              <p className="text-xs mt-3 text-center" style={{ color: 'var(--muted)' }}>
                Tip: drop the clips into any editor (CapCut, InVideo) to merge them with captions and
                voiceover.
              </p>
            </section>
          )}

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={handleReset}
              className="rounded-xl px-5 py-2.5 text-sm font-bold"
              style={{
                background: 'rgba(255,255,255,.04)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              🔄 Start over
            </button>
          </div>
        </>
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
        border: '2px solid rgba(37,99,235,.25)',
        borderTopColor: '#93c5fd',
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
          background: 'linear-gradient(90deg, rgba(37,99,235,.85), rgba(59,130,246,1))',
          boxShadow: '0 0 16px rgba(37,99,235,.55)',
          transition: 'width 600ms ease',
        }}
      />
    </div>
  )
}
