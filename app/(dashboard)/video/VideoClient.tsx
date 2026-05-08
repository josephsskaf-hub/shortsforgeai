'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

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

type StepStatus = 'pending' | 'active' | 'done'

const STEPS: { id: number; emoji: string; title: string; subtitle: string }[] = [
  { id: 1, emoji: '📝', title: 'Script Review', subtitle: 'Confirm your viral script' },
  { id: 2, emoji: '🎬', title: 'Scene Breakdown', subtitle: 'AI splits script into cinematic scenes' },
  { id: 3, emoji: '🎵', title: 'Voiceover', subtitle: 'Generate cinematic narration' },
  { id: 4, emoji: '🎞️', title: 'Stock Footage', subtitle: 'Match scenes with portrait clips' },
  { id: 5, emoji: '📤', title: 'Export', subtitle: 'Render & download your video' },
]

function StepCircle({
  emoji,
  status,
  number,
}: {
  emoji: string
  status: StepStatus
  number: number
}) {
  const isDone = status === 'done'
  const isActive = status === 'active'
  return (
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center font-black flex-shrink-0 transition-all"
      style={{
        background: isDone
          ? 'linear-gradient(135deg, rgba(16,185,129,.3), rgba(52,211,153,.18))'
          : isActive
          ? 'linear-gradient(135deg, rgba(99,102,241,.4), rgba(168,85,247,.25))'
          : 'rgba(255,255,255,.04)',
        border: isDone
          ? '1px solid rgba(16,185,129,.5)'
          : isActive
          ? '1px solid rgba(168,85,247,.55)'
          : '1px solid var(--border)',
        color: isDone ? '#34d399' : isActive ? '#c4b5fd' : 'var(--muted)',
        fontSize: isDone ? '1.25rem' : '1.1rem',
        boxShadow: isActive
          ? '0 0 24px rgba(168,85,247,.35)'
          : isDone
          ? '0 0 14px rgba(16,185,129,.25)'
          : 'none',
      }}
    >
      {isDone ? '✓' : isActive ? emoji : <span style={{ opacity: 0.6 }}>{number}</span>}
    </div>
  )
}

function Spinner() {
  return (
    <div
      className="inline-block rounded-full"
      style={{
        width: 18,
        height: 18,
        border: '2px solid rgba(168,85,247,.25)',
        borderTopColor: '#c4b5fd',
        animation: 'spin 0.9s linear infinite',
      }}
    />
  )
}

export default function VideoClient() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const hook = searchParams.get('hook') ?? ''
  const title = searchParams.get('title') ?? ''
  const script = searchParams.get('script') ?? ''
  const niche = searchParams.get('niche') ?? 'general'

  const [step, setStep] = useState(1)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [scenesLoading, setScenesLoading] = useState(false)
  const [scenesError, setScenesError] = useState<string | null>(null)

  const [voiceoverUrl, setVoiceoverUrl] = useState<string | null>(null)
  const [voiceoverLoading, setVoiceoverLoading] = useState(false)
  const [voiceoverError, setVoiceoverError] = useState<string | null>(null)

  const [stockClips, setStockClips] = useState<Record<number, StockClip[]>>({})
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState<string | null>(null)
  const [selectedClips, setSelectedClips] = useState<Record<number, StockClip>>({})

  const [renderId, setRenderId] = useState<string | null>(null)
  const [renderStatus, setRenderStatus] = useState<'idle' | 'starting' | 'rendering' | 'succeeded' | 'failed'>('idle')
  const [renderProgress, setRenderProgress] = useState(0)
  const [renderUrl, setRenderUrl] = useState<string | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [renderIsMock, setRenderIsMock] = useState(false)

  const stepRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasScript = !!script.trim()

  // Cleanup voiceover blob URL on unmount
  useEffect(() => {
    return () => {
      if (voiceoverUrl) URL.revokeObjectURL(voiceoverUrl)
    }
  }, [voiceoverUrl])

  // Smooth scroll on step changes
  useEffect(() => {
    const el = stepRefs.current[step]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [step])

  function getStatus(stepId: number): StepStatus {
    if (stepId < step) return 'done'
    if (stepId === step) return 'active'
    return 'pending'
  }

  async function loadScenes() {
    setScenesLoading(true)
    setScenesError(null)
    try {
      const res = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, niche }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load scenes')
      setScenes(data.scenes ?? [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load scenes'
      setScenesError(msg)
    } finally {
      setScenesLoading(false)
    }
  }

  async function loadVoiceover() {
    setVoiceoverLoading(true)
    setVoiceoverError(null)
    try {
      const res = await fetch('/api/voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
      })
      if (!res.ok) {
        let msg = 'Failed to generate voiceover'
        try {
          const data = await res.json()
          if (data?.error) msg = data.error
        } catch {}
        throw new Error(msg)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setVoiceoverUrl(url)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate voiceover'
      setVoiceoverError(msg)
    } finally {
      setVoiceoverLoading(false)
    }
  }

  async function loadStock() {
    if (scenes.length === 0) return
    setStockLoading(true)
    setStockError(null)
    try {
      const results = await Promise.all(
        scenes.map(async (s) => {
          const r = await fetch(`/api/stock?q=${encodeURIComponent(s.searchQuery || s.visualDescription)}`)
          const data = await r.json()
          return { sceneNumber: s.sceneNumber, videos: (data.videos ?? []) as StockClip[] }
        })
      )
      const map: Record<number, StockClip[]> = {}
      const auto: Record<number, StockClip> = {}
      for (const r of results) {
        map[r.sceneNumber] = r.videos
        if (r.videos[0]) auto[r.sceneNumber] = r.videos[0]
      }
      setStockClips(map)
      setSelectedClips((prev) => ({ ...auto, ...prev }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load stock footage'
      setStockError(msg)
    } finally {
      setStockLoading(false)
    }
  }

  // Fire side-effects on step entry
  useEffect(() => {
    if (step === 2 && scenes.length === 0 && !scenesLoading && !scenesError && hasScript) {
      loadScenes()
    }
    if (step === 3 && !voiceoverUrl && !voiceoverLoading && !voiceoverError && hasScript) {
      loadVoiceover()
    }
    if (
      step === 4 &&
      scenes.length > 0 &&
      Object.keys(stockClips).length === 0 &&
      !stockLoading &&
      !stockError
    ) {
      loadStock()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  function deriveTone(): string {
    const tones = scenes.map((s) => (s.emotionalTone || '').toLowerCase()).filter(Boolean)
    if (tones.length === 0) return 'dark'
    const tally: Record<string, number> = {}
    for (const t of tones) tally[t] = (tally[t] || 0) + 1
    return Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0]
  }

  async function startRender() {
    if (Object.keys(selectedClips).length === 0) {
      setRenderError('Select at least one stock clip first.')
      setRenderStatus('failed')
      return
    }
    setRenderError(null)
    setRenderUrl(null)
    setRenderProgress(0)
    setRenderStatus('starting')
    setRenderIsMock(false)
    setRenderId(null)
    try {
      const stockClipsPayload = scenes
        .map((s) => {
          const clip = selectedClips[s.sceneNumber]
          if (!clip) return null
          return { sceneNumber: s.sceneNumber, videoUrl: clip.url }
        })
        .filter((c): c is { sceneNumber: number; videoUrl: string } => c !== null)

      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          scenes,
          stockClips: stockClipsPayload,
          title,
          niche,
          tone: deriveTone(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start render')
      setRenderId(data.renderId)
      setRenderIsMock(!!data.isMock)
      setRenderStatus('rendering')
      setRenderProgress(8)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start render'
      setRenderError(msg)
      setRenderStatus('failed')
    }
  }

  function resetRender() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    setRenderId(null)
    setRenderStatus('idle')
    setRenderProgress(0)
    setRenderUrl(null)
    setRenderError(null)
    setRenderIsMock(false)
  }

  function regenerateAll() {
    resetRender()
    setStep(1)
    setScenes([])
    setScenesError(null)
    if (voiceoverUrl) URL.revokeObjectURL(voiceoverUrl)
    setVoiceoverUrl(null)
    setVoiceoverError(null)
    setStockClips({})
    setStockError(null)
    setSelectedClips({})
  }

  // Poll render status
  useEffect(() => {
    if (renderStatus !== 'rendering' || !renderId) return
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch(`/api/render/${encodeURIComponent(renderId!)}`, {
          cache: 'no-store',
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setRenderError(data.error || 'Render lookup failed')
          setRenderStatus('failed')
          return
        }
        if (typeof data.progress === 'number') {
          setRenderProgress((p) => Math.max(p, data.progress))
        }
        if (data.status === 'succeeded') {
          setRenderProgress(100)
          setRenderUrl(data.url ?? null)
          if (data.isMock) setRenderIsMock(true)
          setRenderStatus('succeeded')
          return
        }
        if (data.status === 'failed') {
          setRenderError(data.error || 'Render failed')
          setRenderStatus('failed')
          return
        }
        // Continue polling
        pollTimerRef.current = setTimeout(poll, 3000)
      } catch (err: unknown) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Render polling failed'
        setRenderError(msg)
        setRenderStatus('failed')
      }
    }

    poll()
    return () => {
      cancelled = true
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [renderStatus, renderId])

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  const totalDuration = useMemo(
    () => scenes.reduce((acc, s) => acc + (s.duration || 0), 0),
    [scenes]
  )

  if (!hasScript) {
    return (
      <main className="px-6 py-10 max-w-3xl mx-auto">
        <h1 className="font-black text-2xl mb-3" style={{ color: 'var(--text)' }}>
          🎬 Video Studio
        </h1>
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(15,15,30,0.85)',
            border: '1px solid var(--border)',
          }}
        >
          <p className="text-sm leading-relaxed" style={{ color: 'var(--muted2)' }}>
            No script loaded yet. Generate a viral script first, then click{' '}
            <span style={{ color: '#c4b5fd', fontWeight: 700 }}>🎬 Create Video</span> on
            any result card to start the pipeline.
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="mt-5 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ⚡ Go to Creator Hub
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .step-card {
          animation: fadeUp 0.35s ease both;
        }
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
            Beta · Video Studio
          </span>
        </div>
        <h1 className="font-black text-2xl sm:text-3xl mb-1" style={{ color: 'var(--text)' }}>
          🎬 Build Your Viral Short
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted2)' }}>
          Automated pipeline: script → scenes → voiceover → footage → export.
        </p>
      </div>

      {/* Step rail */}
      <div
        className="hidden sm:flex items-center justify-between mb-6 rounded-2xl px-4 py-3"
        style={{
          background: 'rgba(15,15,30,0.7)',
          border: '1px solid var(--border)',
        }}
      >
        {STEPS.map((s, i) => {
          const status = getStatus(s.id)
          return (
            <div key={s.id} className="flex items-center" style={{ flex: i === STEPS.length - 1 ? '0 0 auto' : 1 }}>
              <button
                onClick={() => {
                  // Allow jump back to completed/active steps
                  if (s.id <= step) setStep(s.id)
                }}
                className="flex items-center gap-2 transition-all"
                style={{ background: 'none', border: 'none', cursor: s.id <= step ? 'pointer' : 'default', padding: 0 }}
              >
                <StepCircle emoji={s.emoji} status={status} number={s.id} />
                <div className="text-left hidden md:block">
                  <div
                    className="text-xs font-black uppercase tracking-wider"
                    style={{ color: status === 'pending' ? 'var(--muted)' : 'var(--text)', fontSize: '0.65rem' }}
                  >
                    {s.title}
                  </div>
                </div>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className="flex-1 mx-2"
                  style={{
                    height: 2,
                    background:
                      s.id < step
                        ? 'linear-gradient(90deg, rgba(16,185,129,.6), rgba(52,211,153,.3))'
                        : 'rgba(255,255,255,.06)',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-4">
        {STEPS.map((s) => {
          const status = getStatus(s.id)
          const isActive = status === 'active'
          const isDone = status === 'done'
          return (
            <div
              key={s.id}
              ref={(el) => {
                stepRefs.current[s.id] = el
              }}
              className="step-card rounded-2xl overflow-hidden transition-all"
              style={{
                background: isActive
                  ? 'rgba(15,15,30,0.92)'
                  : isDone
                  ? 'rgba(15,15,30,0.7)'
                  : 'rgba(15,15,30,0.5)',
                border: isActive
                  ? '1px solid rgba(168,85,247,.45)'
                  : isDone
                  ? '1px solid rgba(16,185,129,.25)'
                  : '1px solid var(--border)',
                boxShadow: isActive ? '0 12px 48px rgba(168,85,247,.18)' : 'none',
                opacity: status === 'pending' ? 0.55 : 1,
              }}
            >
              <div
                className="flex items-center gap-3 px-5 py-4"
                style={{
                  borderBottom: isActive || isDone ? '1px solid var(--border)' : 'none',
                }}
              >
                <StepCircle emoji={s.emoji} status={status} number={s.id} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                    Step {s.id} of {STEPS.length}
                  </div>
                  <div className="font-black" style={{ color: 'var(--text)', fontSize: '1.05rem' }}>
                    {s.title}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--muted2)' }}>
                    {s.subtitle}
                  </div>
                </div>
                {isDone && (
                  <span
                    className="text-xs font-black px-2 py-1 rounded"
                    style={{ background: 'rgba(16,185,129,.1)', color: '#34d399', border: '1px solid rgba(16,185,129,.3)' }}
                  >
                    ✓ Done
                  </span>
                )}
              </div>

              {(isActive || isDone) && (
                <div className="px-5 py-5">
                  {s.id === 1 && (
                    <Step1Review
                      hook={hook}
                      title={title}
                      script={script}
                      onContinue={() => setStep(2)}
                      done={isDone}
                    />
                  )}
                  {s.id === 2 && (
                    <Step2Scenes
                      loading={scenesLoading}
                      error={scenesError}
                      scenes={scenes}
                      totalDuration={totalDuration}
                      onRetry={loadScenes}
                      onContinue={() => setStep(3)}
                      done={isDone}
                    />
                  )}
                  {s.id === 3 && (
                    <Step3Voiceover
                      loading={voiceoverLoading}
                      error={voiceoverError}
                      url={voiceoverUrl}
                      onRetry={loadVoiceover}
                      onContinue={() => setStep(4)}
                      done={isDone}
                    />
                  )}
                  {s.id === 4 && (
                    <Step4Stock
                      loading={stockLoading}
                      error={stockError}
                      scenes={scenes}
                      stockClips={stockClips}
                      selectedClips={selectedClips}
                      onSelect={(sceneNumber, clip) =>
                        setSelectedClips((prev) => ({ ...prev, [sceneNumber]: clip }))
                      }
                      onRetry={loadStock}
                      onContinue={() => setStep(5)}
                      done={isDone}
                    />
                  )}
                  {s.id === 5 && (
                    <Step5Export
                      title={title}
                      script={script}
                      niche={niche}
                      selectedClipsCount={Object.keys(selectedClips).length}
                      status={renderStatus}
                      progress={renderProgress}
                      url={renderUrl}
                      isMock={renderIsMock}
                      error={renderError}
                      onStart={startRender}
                      onRetry={() => {
                        resetRender()
                        startRender()
                      }}
                      onRegenerate={regenerateAll}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}

function Step1Review({
  hook,
  title,
  script,
  onContinue,
  done,
}: {
  hook: string
  title: string
  script: string
  onContinue: () => void
  done: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      {hook && (
        <div>
          <div className="text-xs font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--indigo-light)' }}>
            🪝 Hook
          </div>
          <div
            className="rounded-xl px-4 py-3 text-sm font-bold italic leading-snug"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,.09), rgba(124,58,237,.05))',
              border: '1px solid rgba(99,102,241,.2)',
              borderLeft: '3px solid var(--indigo-light)',
              color: 'var(--text)',
            }}
          >
            {hook}
          </div>
        </div>
      )}
      <div>
        <div className="text-xs font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted2)' }}>
          📌 Title
        </div>
        <div
          className="rounded-xl px-4 py-3 text-sm font-bold leading-snug"
          style={{ background: 'rgba(0,0,0,.22)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          {title}
        </div>
      </div>
      <div>
        <div className="text-xs font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted2)' }}>
          📝 Script
        </div>
        <div
          className="rounded-xl px-4 py-3 text-sm leading-loose whitespace-pre-line"
          style={{ background: 'rgba(0,0,0,.22)', border: '1px solid var(--border)', color: 'var(--muted2)', maxHeight: 280, overflowY: 'auto' }}
        >
          {script}
        </div>
      </div>
      {!done && (
        <button
          onClick={onContinue}
          className="self-start rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all"
          style={{
            background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Confirm & Continue →
        </button>
      )}
    </div>
  )
}

function Step2Scenes({
  loading,
  error,
  scenes,
  totalDuration,
  onRetry,
  onContinue,
  done,
}: {
  loading: boolean
  error: string | null
  scenes: Scene[]
  totalDuration: number
  onRetry: () => void
  onContinue: () => void
  done: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 py-6">
        <Spinner />
        <span className="text-sm font-medium" style={{ color: 'var(--muted2)' }}>
          AI is parsing your script into cinematic scenes...
        </span>
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.25)', color: '#f87171' }}
        >
          {error}
        </div>
        <button
          onClick={onRetry}
          className="self-start rounded-xl px-4 py-2 text-xs font-bold"
          style={{
            background: 'rgba(99,102,241,.12)',
            border: '1px solid rgba(99,102,241,.3)',
            color: 'var(--indigo-light)',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    )
  }
  if (scenes.length === 0) return null
  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
        {scenes.length} scenes · ~{totalDuration}s total
      </div>
      <div className="flex flex-col gap-2.5">
        {scenes.map((s) => (
          <div
            key={s.sceneNumber}
            className="rounded-xl p-3.5 flex gap-3"
            style={{ background: 'rgba(0,0,0,.22)', border: '1px solid var(--border)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-black flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,.3), rgba(124,58,237,.18))',
                border: '1px solid rgba(99,102,241,.4)',
                color: 'var(--indigo-light)',
                fontSize: '0.85rem',
              }}
            >
              {s.sceneNumber}
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span
                  className="font-bold px-2 py-0.5 rounded"
                  style={{ background: 'rgba(168,85,247,.12)', color: '#c4b5fd' }}
                >
                  {s.duration}s
                </span>
                <span
                  className="font-bold px-2 py-0.5 rounded"
                  style={{ background: 'rgba(16,185,129,.1)', color: '#34d399' }}
                >
                  {s.emotionalTone}
                </span>
                <span style={{ color: 'var(--muted)' }}>🔎 {s.searchQuery}</span>
              </div>
              <div className="text-sm font-semibold leading-snug" style={{ color: 'var(--text)' }}>
                "{s.narration}"
              </div>
              <div className="text-xs leading-relaxed" style={{ color: 'var(--muted2)' }}>
                🎥 {s.visualDescription}
              </div>
            </div>
          </div>
        ))}
      </div>
      {!done && (
        <button
          onClick={onContinue}
          className="self-start rounded-xl px-5 py-2.5 text-sm font-bold text-white"
          style={{
            background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Continue to Voiceover →
        </button>
      )}
    </div>
  )
}

function Step3Voiceover({
  loading,
  error,
  url,
  onRetry,
  onContinue,
  done,
}: {
  loading: boolean
  error: string | null
  url: string | null
  onRetry: () => void
  onContinue: () => void
  done: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 py-6">
        <Spinner />
        <span className="text-sm font-medium" style={{ color: 'var(--muted2)' }}>
          Generating voiceover with OpenAI TTS...
        </span>
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.25)', color: '#f87171' }}
        >
          {error}
        </div>
        <button
          onClick={onRetry}
          className="self-start rounded-xl px-4 py-2 text-xs font-bold"
          style={{
            background: 'rgba(99,102,241,.12)',
            border: '1px solid rgba(99,102,241,.3)',
            color: 'var(--indigo-light)',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    )
  }
  if (!url) return null
  return (
    <div className="flex flex-col gap-3">
      <div
        className="rounded-xl p-4"
        style={{ background: 'rgba(0,0,0,.22)', border: '1px solid var(--border)' }}
      >
        <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
          🎙️ Onyx voice · cinematic narration
        </div>
        <audio src={url} controls style={{ width: '100%' }} />
        <a
          href={url}
          download="voiceover.mp3"
          className="inline-block mt-2.5 text-xs font-bold"
          style={{ color: 'var(--indigo-light)' }}
        >
          ⬇ Download MP3
        </a>
      </div>
      {!done && (
        <button
          onClick={onContinue}
          className="self-start rounded-xl px-5 py-2.5 text-sm font-bold text-white"
          style={{
            background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Continue to Stock Footage →
        </button>
      )}
    </div>
  )
}

function Step4Stock({
  loading,
  error,
  scenes,
  stockClips,
  selectedClips,
  onSelect,
  onRetry,
  onContinue,
  done,
}: {
  loading: boolean
  error: string | null
  scenes: Scene[]
  stockClips: Record<number, StockClip[]>
  selectedClips: Record<number, StockClip>
  onSelect: (sceneNumber: number, clip: StockClip) => void
  onRetry: () => void
  onContinue: () => void
  done: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 py-6">
        <Spinner />
        <span className="text-sm font-medium" style={{ color: 'var(--muted2)' }}>
          Searching Pexels for perfect clips...
        </span>
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.25)', color: '#f87171' }}
        >
          {error}
        </div>
        <button
          onClick={onRetry}
          className="self-start rounded-xl px-4 py-2 text-xs font-bold"
          style={{
            background: 'rgba(99,102,241,.12)',
            border: '1px solid rgba(99,102,241,.3)',
            color: 'var(--indigo-light)',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    )
  }
  if (Object.keys(stockClips).length === 0) return null
  return (
    <div className="flex flex-col gap-4">
      {scenes.map((s) => {
        const clips = stockClips[s.sceneNumber] ?? []
        const selectedId = selectedClips[s.sceneNumber]?.id
        return (
          <div key={s.sceneNumber}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted2)' }}>
                Scene {s.sceneNumber} · 🔎 {s.searchQuery}
              </div>
              {clips.length === 0 && (
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  No clips found
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {clips.map((clip) => {
                const isSelected = clip.id === selectedId
                return (
                  <button
                    key={clip.id}
                    onClick={() => onSelect(s.sceneNumber, clip)}
                    className="relative rounded-lg overflow-hidden transition-all"
                    style={{
                      aspectRatio: '9 / 16',
                      border: isSelected ? '2px solid #c4b5fd' : '1px solid var(--border)',
                      boxShadow: isSelected ? '0 0 16px rgba(168,85,247,.4)' : 'none',
                      background: 'rgba(0,0,0,.4)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {clip.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={clip.thumbnail}
                        alt={`Scene ${s.sceneNumber} clip`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'var(--muted)' }}>
                        🎞️
                      </div>
                    )}
                    {isSelected && (
                      <div
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                        style={{ background: '#c4b5fd', color: '#1e1b4b' }}
                      >
                        ✓
                      </div>
                    )}
                    <div
                      className="absolute bottom-0 left-0 right-0 px-1.5 py-1 text-xs font-bold"
                      style={{
                        background: 'linear-gradient(to top, rgba(0,0,0,.85), transparent)',
                        color: '#fff',
                        fontSize: '0.6rem',
                      }}
                    >
                      {clip.duration}s
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      {!done && (
        <button
          onClick={onContinue}
          className="self-start rounded-xl px-5 py-2.5 text-sm font-bold text-white"
          style={{
            background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Continue to Export →
        </button>
      )}
    </div>
  )
}

function nicheHashtags(niche: string): string[] {
  const base = ['#shorts', '#viral', '#fyp']
  const map: Record<string, string[]> = {
    money: ['#money', '#finance', '#wealth', '#facts'],
    mind: ['#mindblown', '#facts', '#science', '#didyouknow'],
    dark: ['#mystery', '#dark', '#truecrime', '#unsolved'],
    mideast: ['#middleeast', '#history', '#facts', '#geopolitics'],
    motivation: ['#motivation', '#mindset', '#success', '#discipline'],
  }
  const extras = map[niche] ?? ['#facts', '#interesting']
  return [...base, ...extras]
}

function buildDescription(title: string, script: string, hashtags: string[]): string {
  const cleanScript = script
    .replace(/🎯\s*HOOK:?/gi, '')
    .replace(/📝\s*CONTENT:?/gi, '')
    .replace(/🔗\s*ENDING:?/gi, '')
    .replace(/\n{2,}/g, '\n\n')
    .trim()
  const hook = cleanScript.split('\n').find((l) => l.trim().length > 0) ?? title
  return `${title}\n\n${hook}\n\n${hashtags.join(' ')}`
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div
      className="w-full h-2 rounded-full overflow-hidden"
      style={{ background: 'rgba(255,255,255,.06)', border: '1px solid var(--border)' }}
    >
      <div
        className="h-full transition-all"
        style={{
          width: `${Math.min(100, Math.max(0, progress))}%`,
          background: 'linear-gradient(90deg, rgba(99,102,241,.85), rgba(168,85,247,1))',
          boxShadow: '0 0 16px rgba(168,85,247,.55)',
          transitionDuration: '600ms',
        }}
      />
    </div>
  )
}

function CopyChip({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const el = document.createElement('textarea')
      el.value = value
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }
  return (
    <button
      onClick={copy}
      className="rounded-xl px-3.5 py-2 text-xs font-bold transition-all"
      style={{
        background: copied
          ? 'linear-gradient(135deg, rgba(16,185,129,.25), rgba(52,211,153,.15))'
          : 'rgba(99,102,241,.12)',
        border: copied ? '1px solid rgba(16,185,129,.45)' : '1px solid rgba(99,102,241,.3)',
        color: copied ? '#34d399' : 'var(--indigo-light)',
        cursor: 'pointer',
      }}
    >
      {copied ? '✓ Copied' : label}
    </button>
  )
}

function Step5Export({
  title,
  script,
  niche,
  selectedClipsCount,
  status,
  progress,
  url,
  isMock,
  error,
  onStart,
  onRetry,
  onRegenerate,
}: {
  title: string
  script: string
  niche: string
  selectedClipsCount: number
  status: 'idle' | 'starting' | 'rendering' | 'succeeded' | 'failed'
  progress: number
  url: string | null
  isMock: boolean
  error: string | null
  onStart: () => void
  onRetry: () => void
  onRegenerate: () => void
}) {
  const stages = [
    { from: 0, to: 8, label: '✍️ Writing viral script...' },
    { from: 8, to: 22, label: '🎙️ Generating AI narration...' },
    { from: 22, to: 38, label: '🎬 Finding cinematic visuals...' },
    { from: 38, to: 55, label: '📝 Building animated captions...' },
    { from: 55, to: 72, label: '🎵 Adding cinematic soundtrack...' },
    { from: 72, to: 100, label: '⚡ Rendering your Short...' },
  ]
  const currentStage =
    stages.find((s) => progress >= s.from && progress < s.to) ?? stages[stages.length - 1]

  // Idle — entry CTA
  if (status === 'idle') {
    return (
      <div className="flex flex-col items-center text-center py-4 gap-5">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,.3), rgba(99,102,241,.18))',
            border: '1px solid rgba(168,85,247,.45)',
            boxShadow: '0 0 32px rgba(168,85,247,.35)',
            fontSize: '2.4rem',
          }}
        >
          🎬
        </div>
        <div>
          <div className="font-black text-xl mb-1" style={{ color: 'var(--text)' }}>
            Ready to render
          </div>
          <div className="text-sm max-w-sm" style={{ color: 'var(--muted2)' }}>
            We'll auto-stitch your scenes, narration, captions, and soundtrack into a 1080×1920
            MP4 — about 35 seconds, post-ready.
          </div>
        </div>
        {selectedClipsCount === 0 && (
          <div
            className="rounded-xl px-4 py-2 text-xs font-semibold"
            style={{
              background: 'rgba(245,158,11,.08)',
              border: '1px solid rgba(245,158,11,.3)',
              color: '#fbbf24',
            }}
          >
            ⚠ Select at least one stock clip in Step 4
          </div>
        )}
        <button
          onClick={onStart}
          disabled={selectedClipsCount === 0}
          className="rounded-xl px-6 py-3 text-sm font-black text-white transition-all"
          style={{
            background:
              selectedClipsCount === 0
                ? 'rgba(255,255,255,.04)'
                : 'linear-gradient(135deg, var(--indigo), var(--purple))',
            border: 'none',
            boxShadow:
              selectedClipsCount === 0 ? 'none' : '0 8px 28px rgba(168,85,247,.35)',
            cursor: selectedClipsCount === 0 ? 'not-allowed' : 'pointer',
            color: selectedClipsCount === 0 ? 'var(--muted)' : '#fff',
          }}
        >
          🎬 Render My Short
        </button>
      </div>
    )
  }

  // Rendering — animated pipeline
  if (status === 'starting' || status === 'rendering') {
    return (
      <div className="flex flex-col items-center text-center py-4 gap-5">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,.3), rgba(99,102,241,.18))',
            border: '1px solid rgba(168,85,247,.45)',
            boxShadow: '0 0 32px rgba(168,85,247,.45)',
            fontSize: '2.4rem',
            animation: 'pulse 1.6s ease-in-out infinite',
          }}
        >
          🎬
        </div>
        <div className="w-full max-w-md flex flex-col gap-3">
          <div className="font-black text-lg" style={{ color: 'var(--text)' }}>
            {currentStage.label}
          </div>
          <ProgressBar progress={progress} />
          <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
            {progress}%
          </div>
        </div>
        <div className="text-xs max-w-sm" style={{ color: 'var(--muted2)' }}>
          Hang tight — this typically takes 30–90 seconds. Your video is being assembled in the
          cloud.
        </div>
        <style jsx>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); box-shadow: 0 0 32px rgba(168,85,247,.45); }
            50% { transform: scale(1.04); box-shadow: 0 0 48px rgba(168,85,247,.65); }
          }
        `}</style>
      </div>
    )
  }

  // Failed
  if (status === 'failed') {
    return (
      <div className="flex flex-col items-center text-center py-4 gap-4">
        <div
          className="w-16 h-16 rounded-3xl flex items-center justify-center"
          style={{
            background: 'rgba(239,68,68,.15)',
            border: '1px solid rgba(239,68,68,.4)',
            fontSize: '2rem',
          }}
        >
          ⚠️
        </div>
        <div>
          <div className="font-black text-lg mb-1" style={{ color: 'var(--text)' }}>
            Render failed
          </div>
          <div
            className="rounded-xl px-4 py-2.5 text-sm max-w-md"
            style={{
              background: 'rgba(239,68,68,.07)',
              border: '1px solid rgba(239,68,68,.25)',
              color: '#f87171',
            }}
          >
            {error ?? 'Something went wrong while rendering your video.'}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRetry}
            className="rounded-xl px-5 py-2.5 text-sm font-bold text-white"
            style={{
              background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ↻ Retry
          </button>
          <button
            onClick={onRegenerate}
            className="rounded-xl px-5 py-2.5 text-sm font-bold"
            style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            🔄 Start Over
          </button>
        </div>
      </div>
    )
  }

  // Succeeded
  const hashtags = nicheHashtags(niche)
  const description = buildDescription(title || 'Viral Short', script, hashtags)

  return (
    <div className="flex flex-col items-center text-center py-2 gap-5">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,.3), rgba(52,211,153,.18))',
          border: '1px solid rgba(16,185,129,.5)',
          boxShadow: '0 0 32px rgba(16,185,129,.35)',
          fontSize: '2.4rem',
        }}
      >
        ✓
      </div>
      <div>
        <div className="font-black text-xl mb-1" style={{ color: 'var(--text)' }}>
          Your Short is ready!
        </div>
        <div className="text-sm max-w-sm" style={{ color: 'var(--muted2)' }}>
          {isMock || !url
            ? 'Mock render complete — see setup note below.'
            : '1080×1920 MP4, post-ready. Download or copy your assets.'}
        </div>
      </div>

      {url && !isMock ? (
        <div
          className="rounded-2xl overflow-hidden w-full max-w-[280px]"
          style={{
            border: '1px solid rgba(168,85,247,.35)',
            boxShadow: '0 12px 48px rgba(168,85,247,.18)',
            background: '#000',
          }}
        >
          <video
            src={url}
            controls
            playsInline
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      ) : (
        <div
          className="rounded-2xl px-5 py-4 max-w-md w-full text-left"
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,.1), rgba(99,102,241,.06))',
            border: '1px solid rgba(168,85,247,.3)',
          }}
        >
          <div
            className="text-xs font-black uppercase tracking-widest mb-1"
            style={{ color: '#c4b5fd' }}
          >
            🛠 Setup required
          </div>
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
            Add CREATOMATE_API_KEY to enable real rendering
          </div>
          <div className="text-xs leading-relaxed" style={{ color: 'var(--muted2)' }}>
            Your composition is fully built — voiceover, captions, transitions, soundtrack, and
            CTA are wired up. Add a Creatomate API key in your env to produce the final MP4.
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {url && !isMock ? (
          <a
            href={url}
            download={`${(title || 'shortsforge').replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.mp4`}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl px-5 py-2.5 text-sm font-black text-white"
            style={{
              background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            ⬇ Download MP4
          </a>
        ) : (
          <button
            disabled
            className="rounded-xl px-5 py-2.5 text-sm font-bold"
            style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
              cursor: 'not-allowed',
            }}
          >
            ⬇ Download MP4 (mock)
          </button>
        )}
        <CopyChip label="📋 Copy Title" value={title || ''} />
        <CopyChip label="#️⃣ Copy Hashtags" value={hashtags.join(' ')} />
        <CopyChip label="📝 Copy Description" value={description} />
        <button
          onClick={onRegenerate}
          className="rounded-xl px-4 py-2.5 text-sm font-bold"
          style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            cursor: 'pointer',
          }}
        >
          🔄 Regenerate
        </button>
      </div>
    </div>
  )
}
