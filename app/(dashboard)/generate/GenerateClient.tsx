'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface Analysis {
  title: string
  summary: string
  niche: string
  scenePlan: string[]
}

type Phase = 'idle' | 'analyzing' | 'options' | 'generating' | 'done' | 'error'
type Duration = 10 | 30 | 60
type Quality = 'basic' | 'basic_ai' | 'pro'
type GenStatus = 'processing' | 'completed' | 'failed'

const POLL_INTERVAL_MS = 5000
// Stop polling after ~10 minutes — Runway tasks should never run that long.
const MAX_POLL_ATTEMPTS = 120

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

// Defensive guard: never feed an image URL into a <video> element. Runway's
// text_to_image intermediate step can sometimes leak through.
function looksLikeVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const lower = url.toLowerCase()
  if (/\.(png|jpe?g|webp|gif|avif)(\?|$|&)/.test(lower)) return false
  return true
}

export default function GenerateClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialPrompt = searchParams.get('prompt') ?? ''

  const [prompt, setPrompt] = useState(initialPrompt)
  const [phase, setPhase] = useState<Phase>('idle')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState<Duration>(10)
  const [quality, setQuality] = useState<Quality>('basic_ai')

  // Async generation state — one Runway pipeline per generation. We poll the
  // backend by generation_id and only flip into the "done" phase once the
  // server confirms a real video_url is available.
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [genStatus, setGenStatus] = useState<GenStatus>('processing')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollAttemptsRef = useRef(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const autoAnalyzeKeyRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  // Poll status while generating
  useEffect(() => {
    if (phase !== 'generating' || !generationId) return
    let cancelled = false
    pollAttemptsRef.current = 0

    async function poll() {
      if (cancelled || !generationId) return
      pollAttemptsRef.current += 1
      if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
        setError(GENERIC_ERROR)
        setPhase('error')
        return
      }
      try {
        const res = await fetch(
          `/api/generate-video/status?generation_id=${encodeURIComponent(generationId)}`,
          { cache: 'no-store' }
        )
        if (cancelled) return
        const data = await res.json()
        if (!res.ok) {
          console.error('[generate] status poll non-ok:', res.status, data?.error)
          if (res.status === 404 || res.status === 403) {
            setError(GENERIC_ERROR)
            setPhase('error')
            return
          }
          // Soft retry on transient backend errors.
          pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
          return
        }

        if (data.charged) {
          try { window.dispatchEvent(new Event('creditsChanged')) } catch {}
        }

        if (typeof data.progress === 'number') setProgress(data.progress)

        if (data.status === 'completed') {
          if (data.video_url && looksLikeVideoUrl(data.video_url)) {
            setVideoUrl(data.video_url)
            setGenStatus('completed')
            setPhase('done')
          } else {
            setError(GENERIC_ERROR)
            setPhase('error')
          }
          return
        }
        if (data.status === 'failed') {
          setGenStatus('failed')
          setError(GENERIC_ERROR)
          setPhase('error')
          return
        }
        // still processing
        setGenStatus('processing')
        pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
      } catch (err: unknown) {
        if (cancelled) return
        console.error('[generate] status poll error:', err)
        pollTimerRef.current = setTimeout(poll, POLL_INTERVAL_MS)
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
  }, [phase, generationId])

  async function handleAnalyze(overridePrompt?: string, opts?: { fromTopic?: boolean }) {
    // Guard against accidentally passing a React event when wired as
    // onClick={handleAnalyze} — only treat string overrides as a prompt.
    const override = typeof overridePrompt === 'string' ? overridePrompt : undefined
    const source = (override ?? prompt).trim()
    if (!source) {
      setError('Please describe your video idea first.')
      return
    }
    if (override !== undefined) setPrompt(override)
    setError(null)
    setAnalysis(null)
    setGenerationId(null)
    setVideoUrl(null)
    setProgress(null)
    setPhase('analyzing')
    // Failsafe: never let the UI stay stuck on "Analyzing…" forever.
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    try {
      const res = await fetch('/api/analyze-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: source }),
        signal: controller.signal,
      })
      if (res.status === 401) {
        router.push('/login?redirect=/generate')
        return
      }
      const data = await res.json()
      if (!res.ok) {
        console.error('[generate] analyze failed:', data?.error)
        setError(opts?.fromTopic ? 'Could not analyze topic. Please try again.' : 'Could not analyze your idea. Please try again.')
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
      setError(opts?.fromTopic ? 'Could not analyze topic. Please try again.' : 'Could not analyze your idea. Please try again.')
      setPhase('idle')
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // Auto-trigger analyze when URL has ?autoanalyze=1&prompt=… (topic / dashboard quick-start)
  useEffect(() => {
    const sp = searchParams?.get('prompt') ?? ''
    const auto = searchParams?.get('autoanalyze') === '1'
    if (!auto || !sp.trim()) return
    const key = sp.trim()
    if (autoAnalyzeKeyRef.current === key) return
    autoAnalyzeKeyRef.current = key
    handleAnalyze(sp, { fromTopic: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function handlePromptKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter submits, Shift+Enter inserts a newline. Don't redirect the user.
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      if (phase === 'analyzing') return
      if (!prompt.trim()) return
      handleAnalyze()
    }
  }

  async function handleGenerate() {
    const trimmed = prompt.trim()
    if (!trimmed) {
      setError('Please describe your video idea first.')
      return
    }
    // Guard against double-submits.
    if (phase === 'generating') return

    setError(null)
    setGenerationId(null)
    setVideoUrl(null)
    setProgress(null)
    setGenStatus('processing')
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

      if (res.status === 409) {
        setError(data?.error || 'You already have a video processing. Please wait.')
        setPhase('error')
        return
      }

      if (!res.ok) {
        console.error('[generate] generate-video error:', data?.error)
        setError(data?.error || GENERIC_ERROR)
        setPhase('error')
        return
      }

      if (!data?.generation_id) {
        setError(GENERIC_ERROR)
        setPhase('error')
        return
      }

      setGenerationId(data.generation_id)
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
    setGenerationId(null)
    setVideoUrl(null)
    setProgress(null)
    setError(null)
  }

  function handleBackToEdit() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    setPhase('idle')
    setError(null)
  }

  useEffect(() => {
    const el = videoRef.current
    if (el && phase === 'done') {
      el.load()
      el.play().catch(() => {})
    }
  }, [videoUrl, phase])

  const selectedCost = QUALITY_OPTIONS.find((q) => q.key === quality)?.credits ?? 1
  const showStep1 = phase === 'idle' || phase === 'analyzing'
  const showStep2 = phase === 'options'
  const showRender = phase === 'generating' || phase === 'done' || phase === 'error'

  const headerCaption = useMemo(() => {
    if (showStep1) return 'Describe your idea. We\'ll analyze it before charging any credits.'
    if (showStep2) return 'Pick duration and quality, then generate.'
    if (phase === 'generating') return 'Rendering your vertical 9:16 Short. This usually takes 1–2 minutes.'
    if (phase === 'done') return 'Your Short is ready.'
    if (phase === 'error') return 'Something went wrong.'
    return ''
  }, [showStep1, showStep2, phase])

  const progressPct = useMemo(() => {
    if (phase === 'done') return 100
    if (phase === 'error') return 0
    if (typeof progress === 'number') {
      return Math.min(99, Math.max(2, Math.round(progress * 100)))
    }
    return 10
  }, [phase, progress])

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
          {headerCaption}
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
            onKeyDown={handlePromptKeyDown}
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
              Analyzing your idea is free — no credits are charged. Press Enter to analyze.
            </p>
            <button
              onClick={() => handleAnalyze()}
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
                    {d === 10 ? '10 seconds (default)' : `${d} seconds`}
                  </button>
                ))}
              </div>
              {duration !== 10 && (
                <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                  Renders a single 10-second cinematic clip — you can stitch into a longer Short
                  in any editor.
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
                disabled={phase === 'generating'}
                className="rounded-xl px-6 py-3 text-sm font-black text-white flex items-center gap-2"
                style={{
                  background: phase === 'generating'
                    ? 'rgba(255,255,255,.06)'
                    : 'linear-gradient(135deg, #2563EB, #1d4ed8)',
                  border: 'none',
                  cursor: phase === 'generating' ? 'not-allowed' : 'pointer',
                  boxShadow: phase === 'generating'
                    ? 'none'
                    : '0 8px 28px rgba(37,99,235,.4)',
                  color: phase === 'generating' ? 'var(--muted)' : '#fff',
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
          <section
            className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
            style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="font-black text-base" style={{ color: 'var(--text)' }}>
                {phase === 'done'
                  ? '✅ Your Short is ready'
                  : phase === 'error'
                  ? '⚠️ Generation failed'
                  : genStatus === 'processing'
                  ? '🎬 Rendering your video…'
                  : '🎬 Working…'}
              </div>
              <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
                {progressPct}%
              </div>
            </div>
            <ProgressBar progress={progressPct} />
            <div className="text-xs mt-3" style={{ color: 'var(--muted2)' }}>
              {phase === 'done'
                ? 'Your video is ready below.'
                : phase === 'error'
                ? 'No credits were charged. Try again with a different prompt.'
                : 'Runway typically takes 1–2 minutes per clip. We poll every 5 seconds.'}
            </div>
          </section>

          {phase === 'done' && videoUrl && looksLikeVideoUrl(videoUrl) && (
            <section
              className="gv-card rounded-2xl p-5 sm:p-6 mb-6 flex flex-col items-center"
              style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
            >
              <div className="font-black text-lg mb-3" style={{ color: 'var(--text)' }}>
                ▶ Your Short
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
                  key={videoUrl}
                  src={videoUrl}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                <a
                  href={videoUrl}
                  download="shortsforge-clip.mp4"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl px-4 py-2.5 text-xs font-bold text-white"
                  style={{
                    background: 'linear-gradient(135deg, #2563EB, #1d4ed8)',
                    border: 'none',
                    color: '#fff',
                    textDecoration: 'none',
                  }}
                >
                  ⬇ Download MP4
                </a>
              </div>
              <p className="text-xs mt-3 text-center" style={{ color: 'var(--muted)' }}>
                Tip: drop the clip into any editor (CapCut, InVideo) to add captions, voiceover and
                a CTA.
              </p>
            </section>
          )}

          <div className="flex items-center justify-center gap-2 flex-wrap mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest w-full text-center" style={{ color: 'var(--muted)', letterSpacing: '0.18em' }}>
              ShortsForgeAI v1.0
            </p>
          </div>

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
