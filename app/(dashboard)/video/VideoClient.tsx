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

  const stepRefs = useRef<Record<number, HTMLDivElement | null>>({})

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
                  {s.id === 5 && <Step5Export />}
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

function Step5Export() {
  return (
    <div className="flex flex-col items-center text-center py-6 gap-4">
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
          Your video is ready!
        </div>
        <div className="text-sm max-w-sm" style={{ color: 'var(--muted2)' }}>
          All assets staged: scenes, voiceover, and stock clips. Final rendering is the last
          step.
        </div>
      </div>
      <div
        className="rounded-2xl px-5 py-4 max-w-md w-full"
        style={{
          background: 'linear-gradient(135deg, rgba(168,85,247,.1), rgba(99,102,241,.06))',
          border: '1px solid rgba(168,85,247,.3)',
        }}
      >
        <div className="text-xs font-black uppercase tracking-widest mb-1" style={{ color: '#c4b5fd' }}>
          ⏳ Coming Soon
        </div>
        <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
          Server-side video rendering
        </div>
        <div className="text-xs leading-relaxed" style={{ color: 'var(--muted2)' }}>
          Final MP4 export requires dedicated rendering infrastructure. We're spinning it up
          — for now, you can download the voiceover MP3 and use the scene plan in your editor
          of choice.
        </div>
      </div>
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
        ⬇ Download Final MP4 (soon)
      </button>
    </div>
  )
}
