'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PricingCards from '@/components/PricingCards'

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
  // Push #024A added these on the server side. Push #030 surfaces them in
  // the brief card and feeds the explicit voiceover_script straight into
  // /api/compose so what the user reads is what gets narrated.
  hook: string
  voiceoverScript: string
}

// Pipeline state machine — described in push #028.
type Phase =
  | 'idle'
  | 'analyzing'
  | 'options'
  | 'generating'    // Runway producing clips
  | 'clips_ready'   // brief transition state — kicks off /api/compose
  | 'composing'     // Creatomate rendering the final video
  | 'done'
  | 'failed'

type Duration = 10 | 30 | 50
type Quality = 'basic' | 'basic_ai' | 'pro'

const POLL_GENERATING_MS = 4000
const POLL_COMPOSING_MS = 5000

const QUALITY_OPTIONS: {
  key: Quality
  title: string
  desc: string
  credits: number
  icon: string
}[] = [
  { key: 'basic',    title: 'Basic',    desc: 'Uses licensed stock media from top providers.',     credits: 15, icon: '🎞️' },
  { key: 'basic_ai', title: 'Basic AI', desc: 'Uses our most efficient generative models.',         credits: 15, icon: '⚡' },
  { key: 'pro',      title: 'Pro',      desc: 'Uses premium generative models and cinematic look.', credits: 20, icon: '✨' },
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
  const [taskStates, setTaskStates] = useState<Record<string, TaskState>>({})
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState<Duration>(30)
  const [quality, setQuality] = useState<Quality>('basic_ai')
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [clipUrls, setClipUrls] = useState<string[]>([])
  const [renderId, setRenderId] = useState<string | null>(null)
  const [renderProgress, setRenderProgress] = useState<number>(0)
  const [generateProgress, setGenerateProgress] = useState<number>(0)
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null)

  // Push #045A — transient "Copied!" feedback on the Copy URL button in the
  // result section. Cleared automatically after ~2s.
  const [copied, setCopied] = useState(false)

  // Idempotency flag for /api/compose/status — once we see `done` we tell the
  // server not to deduct credits again on subsequent polls.
  const deductedRef = useRef<boolean>(false)
  const composeStartedRef = useRef<boolean>(false)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const autoAnalyzeKeyRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  // Push #033: pull a prompt forwarded by the homepage's Generate Video card.
  // app/page.tsx stashes the user's idea under `pendingVideoPrompt` in
  // sessionStorage right before redirecting here. We only honor it when the
  // URL has no ?prompt= of its own (so the autoanalyze niche-quick-start
  // flow still wins when both are present) and we clear the key after
  // reading so a hard refresh doesn't keep re-applying it.
  useEffect(() => {
    if (searchParams?.get('prompt')) return
    try {
      const pending = sessionStorage.getItem('pendingVideoPrompt')
      if (pending && pending.trim()) {
        setPrompt(pending)
      }
      sessionStorage.removeItem('pendingVideoPrompt')
    } catch {
      // sessionStorage can throw in some sandboxes — safe to ignore.
    }
    // Mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ────────────────────────────────────────────────────────────────────────
  // PHASE: generating  →  poll /api/generate-video/status
  // ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'generating' || tasks.length === 0) return
    let cancelled = false

    async function poll() {
      try {
        const ids = tasks.map((t) => t.id).join(',')
        const res = await fetch(
          `/api/generate-video/status?tasks=${encodeURIComponent(ids)}`,
          { cache: 'no-store' }
        )
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error('Status lookup failed')

        // Always refresh the per-clip state so the progress grid keeps moving.
        if (Array.isArray(data.tasks)) {
          const next: Record<string, TaskState> = {}
          for (const t of data.tasks as TaskState[]) next[t.id] = t
          setTaskStates(next)
        }

        if (data.phase === 'generating') {
          setGenerateProgress(typeof data.progress === 'number' ? data.progress : 0)
          pollTimerRef.current = setTimeout(poll, POLL_GENERATING_MS)
          return
        }

        if (data.phase === 'clips_ready') {
          setGenerateProgress(100)
          setClipUrls(Array.isArray(data.clip_urls) ? data.clip_urls : [])
          setPhase('clips_ready')
          return
        }

        if (data.phase === 'failed') {
          setError(typeof data.error === 'string' ? data.error : GENERIC_ERROR)
          setPhase('failed')
          return
        }

        // Unknown response — retry instead of bailing.
        pollTimerRef.current = setTimeout(poll, POLL_GENERATING_MS)
      } catch (err) {
        if (cancelled) return
        console.error('[generate] generating poll error:', err)
        setError(GENERIC_ERROR)
        setPhase('failed')
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

  // ────────────────────────────────────────────────────────────────────────
  // PHASE: clips_ready  →  fire /api/compose once, then transition to composing
  // ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'clips_ready') return
    if (composeStartedRef.current) return
    if (clipUrls.length === 0) return
    composeStartedRef.current = true

    async function kickCompose() {
      try {
        const voiceoverScript = buildVoiceoverScript(prompt, analysis)
        const sceneCaptions = buildSceneCaptions(analysis, scenes, duration)

        const res = await fetch('/api/compose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            generationId,
            clip_urls: clipUrls,
            voiceover_script: voiceoverScript,
            scene_captions: sceneCaptions,
            duration,
            topic: prompt,
            quality,
          }),
        })
        const data = await res.json()

        if (res.status === 401) {
          router.push('/login?redirect=/generate')
          return
        }
        if (!res.ok) {
          console.error('[generate] compose error:', data?.error)
          setError(typeof data?.error === 'string' ? data.error : GENERIC_ERROR)
          setPhase('failed')
          return
        }

        const id = typeof data.render_id === 'string' ? data.render_id : null
        if (!id) {
          setError(GENERIC_ERROR)
          setPhase('failed')
          return
        }

        setRenderId(id)
        setRenderProgress(5)
        setPhase('composing')
      } catch (err) {
        console.error('[generate] compose threw:', err)
        setError(GENERIC_ERROR)
        setPhase('failed')
      }
    }

    kickCompose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, clipUrls])

  // ────────────────────────────────────────────────────────────────────────
  // PHASE: composing  →  poll /api/compose/status/[renderId]
  // ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'composing' || !renderId) return
    let cancelled = false

    async function poll() {
      try {
        const params = new URLSearchParams({ quality })
        if (deductedRef.current) params.set('deducted', '1')
        const res = await fetch(
          `/api/compose/status/${encodeURIComponent(renderId as string)}?${params.toString()}`,
          { cache: 'no-store' }
        )
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error('Compose status lookup failed')

        if (data.phase === 'done') {
          const url = typeof data.final_video_url === 'string' ? data.final_video_url : null
          if (!url) {
            setError(GENERIC_ERROR)
            setPhase('failed')
            return
          }
          if (!deductedRef.current && data.creditsDeducted) {
            deductedRef.current = true
            try { window.dispatchEvent(new Event('creditsChanged')) } catch {}
          }
          setRenderProgress(100)
          setFinalVideoUrl(url)
          setPhase('done')
          return
        }

        if (data.phase === 'failed') {
          setError(typeof data.error === 'string' ? data.error : GENERIC_ERROR)
          setPhase('failed')
          return
        }

        setRenderProgress(typeof data.progress === 'number' ? data.progress : 0)
        pollTimerRef.current = setTimeout(poll, POLL_COMPOSING_MS)
      } catch (err) {
        if (cancelled) return
        console.error('[generate] composing poll error:', err)
        setError(GENERIC_ERROR)
        setPhase('failed')
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
  }, [phase, renderId, quality])

  async function handleAnalyze(overridePrompt?: string, opts?: { fromTopic?: boolean }) {
    const override = typeof overridePrompt === 'string' ? overridePrompt : undefined
    const source = (override ?? prompt).trim()
    if (!source) {
      setError('Please describe your video idea first.')
      return
    }
    if (override !== undefined) setPrompt(override)
    setError(null)
    setAnalysis(null)
    setScenes([])
    setTasks([])
    setTaskStates({})
    setClipUrls([])
    setRenderId(null)
    setFinalVideoUrl(null)
    setPhase('analyzing')
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
        setError(opts?.fromTopic ? 'Could not analyze topic. Please try again.' : 'Could not analyze that idea. Please try again.')
        setPhase('idle')
        return
      }
      setAnalysis({
        title: data.title ?? '',
        summary: data.summary ?? '',
        niche: data.niche ?? '',
        scenePlan: Array.isArray(data.scenePlan) ? data.scenePlan : [],
        hook: typeof data.hook === 'string' ? data.hook : '',
        voiceoverScript:
          typeof data.voiceover_script === 'string' ? data.voiceover_script : '',
      })
      setPhase('options')
    } catch (err) {
      console.error('[generate] analyze threw:', err)
      setError(opts?.fromTopic ? 'Could not analyze topic. Please try again.' : 'Could not analyze that idea. Please try again.')
      setPhase('idle')
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // Auto-trigger analyze when URL has ?autoanalyze=1&prompt=… (topic quick-start)
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

  async function handleGenerate() {
    const trimmed = prompt.trim()
    if (!trimmed) {
      setError('Please describe your video idea first.')
      return
    }
    setError(null)
    setTaskStates({})
    setTasks([])
    setScenes([])
    setClipUrls([])
    setRenderId(null)
    setFinalVideoUrl(null)
    setGenerateProgress(0)
    setRenderProgress(0)
    composeStartedRef.current = false
    deductedRef.current = false
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
        setError(`Not enough credits. This generation needs ${QUALITY_OPTIONS.find(q => q.key === quality)?.credits ?? 15} credit(s).`)
        setPhase('failed')
        return
      }

      if (!res.ok) {
        console.error('[generate] generate-video error:', data?.error)
        setError(typeof data?.error === 'string' ? data.error : GENERIC_ERROR)
        setPhase('failed')
        return
      }

      setGenerationId(typeof data.generationId === 'string' ? data.generationId : null)
      setScenes(Array.isArray(data.scenes) ? data.scenes : [])
      setTasks(Array.isArray(data.tasks) ? data.tasks : [])
    } catch (err: unknown) {
      console.error('[generate] generate threw:', err)
      setError(GENERIC_ERROR)
      setPhase('failed')
    }
  }

  // Push #045A — result-page actions. Both reach for finalVideoUrl only; the
  // download anchor is untouched, so existing download behavior is preserved.
  async function handleCopyUrl() {
    if (!finalVideoUrl) return
    try {
      await navigator.clipboard.writeText(finalVideoUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be denied in some browsers — silent no-op is fine
      // because the Download button still works as the primary action.
    }
  }

  async function handleShare() {
    if (!finalVideoUrl) return
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: 'My AI Short',
          text: 'Made with ShortsForgeAI',
          url: finalVideoUrl,
        })
        return
      } catch {
        // User cancelled the share sheet or the platform refused — fall back
        // to clipboard so the action button never feels dead.
      }
    }
    await handleCopyUrl()
  }

  function handleReset() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    composeStartedRef.current = false
    deductedRef.current = false
    setPhase('idle')
    setAnalysis(null)
    setScenes([])
    setTasks([])
    setTaskStates({})
    setClipUrls([])
    setRenderId(null)
    setFinalVideoUrl(null)
    setGenerateProgress(0)
    setRenderProgress(0)
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
    if (el && phase === 'done' && finalVideoUrl) {
      el.load()
      el.play().catch(() => {})
    }
  }, [phase, finalVideoUrl])

  const orderedTasks = useMemo(
    () => tasks.slice().sort((a, b) => a.index - b.index),
    [tasks]
  )

  const succeededCount = useMemo(
    () => orderedTasks.filter((t) => taskStates[t.id]?.status === 'SUCCEEDED').length,
    [orderedTasks, taskStates]
  )

  const selectedCost = QUALITY_OPTIONS.find((q) => q.key === quality)?.credits ?? 15
  const showStep1 = phase === 'idle' || phase === 'analyzing'
  const showStep2 = phase === 'options'
  const showRender =
    phase === 'generating' ||
    phase === 'clips_ready' ||
    phase === 'composing' ||
    phase === 'done' ||
    phase === 'failed'

  const statusMessage = (() => {
    switch (phase) {
      case 'generating':
        return 'Creating visuals…'
      case 'clips_ready':
        return 'Generating voiceover & captions…'
      case 'composing':
        return 'Rendering final video…'
      case 'done':
        return '✅ Your Short is ready'
      case 'failed':
        return 'Generation failed'
      default:
        return ''
    }
  })()

  const headlineProgress = (() => {
    if (phase === 'generating') return Math.min(70, Math.round(generateProgress * 0.7))
    if (phase === 'clips_ready') return 72
    if (phase === 'composing') return 75 + Math.round(renderProgress * 0.25)
    if (phase === 'done') return 100
    return 0
  })()

  return (
    <main className="px-4 sm:px-6 py-8 max-w-4xl mx-auto">
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
            // Push #035: textarea sized to exactly 830 × 400 px. `w-full` plus
            // maxWidth keeps it responsive — it caps at 830 px on wide
            // viewports and shrinks to fit on smaller screens.
            style={{
              width: '100%',
              maxWidth: '830px',
              background: 'rgba(0,0,0,.3)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              outline: 'none',
              resize: 'none',
              minHeight: '400px',
            }}
          />

          {/* Push #034: duration + quality selectors moved here from the
              post-analyze step so users can pick everything in one screen
              before they hit Analyze. The selected values persist into the
              Generate step and drive credit cost + clip count. */}
          <div className="mt-5">
            <div
              className="text-xs font-black uppercase tracking-widest mb-2"
              style={{ color: 'var(--muted)' }}
            >
              Duration
            </div>
            <div className="flex gap-2 flex-wrap">
              {([10, 30, 50] as Duration[]).map((d) => (
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
          </div>

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

          <div className="flex items-center justify-between mt-5 gap-3 flex-wrap">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Analyzing your idea is free — no credits are charged.
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

      {/* Push #036: 3 pricing cards below Step 1 so the upgrade path lives
          right next to where the user is about to spend credits. Hidden once
          they leave Step 1 (analyzing / options / render phases) to keep the
          subsequent screens focused on the active generation. */}
      {showStep1 && <PricingCards />}

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

            {/* Hook — first 2 seconds, the scroll-stopper. */}
            {analysis.hook && (
              <div className="mb-4">
                <div
                  className="text-xs font-black uppercase tracking-widest mb-1.5"
                  style={{ color: 'var(--muted)' }}
                >
                  Hook
                </div>
                <p
                  className="text-sm font-bold rounded-lg px-3 py-2"
                  style={{
                    background: 'rgba(37,99,235,.08)',
                    border: '1px solid rgba(37,99,235,.25)',
                    color: 'var(--text)',
                    lineHeight: 1.5,
                  }}
                >
                  “{analysis.hook}”
                </p>
              </div>
            )}

            {/* Voiceover script — what the narrator reads end-to-end. */}
            {analysis.voiceoverScript && (
              <div className="mb-4">
                <div
                  className="text-xs font-black uppercase tracking-widest mb-1.5"
                  style={{ color: 'var(--muted)' }}
                >
                  Voiceover script
                </div>
                <p
                  className="text-sm rounded-lg px-3 py-2 whitespace-pre-wrap"
                  style={{
                    background: 'rgba(255,255,255,.03)',
                    border: '1px solid var(--border)',
                    color: 'var(--muted2)',
                    lineHeight: 1.55,
                  }}
                >
                  {analysis.voiceoverScript}
                </p>
              </div>
            )}

            {analysis.scenePlan.length > 0 && (
              <>
                <div
                  className="text-xs font-black uppercase tracking-widest mb-1.5"
                  style={{ color: 'var(--muted)' }}
                >
                  Scenes
                </div>
                <ol className="space-y-1.5 text-xs" style={{ color: 'var(--muted2)', paddingLeft: 20 }}>
                  {analysis.scenePlan.map((s, i) => (
                    <li key={i}>
                      <span style={{ color: '#93c5fd', fontWeight: 700 }}>Scene {i + 1}.</span> {s}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>

          {/* Push #034: duration / quality controls were moved to Step 1
              (above the Analyze button) so users pick them before paying any
              attention budget on the brief. Step 2 just confirms the choice
              and kicks off the actual generation. */}
          <section
            className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
            style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                {duration}s · {QUALITY_OPTIONS.find((q) => q.key === quality)?.title} · YouTube Shorts (9:16)
              </div>
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
                Generate • {selectedCost} credits
              </button>
            </div>
          </section>
        </>
      )}

      {/* ── Render / Done / Failed ── */}
      {showRender && (
        <>
          {(phase === 'generating' || phase === 'clips_ready' || phase === 'composing') && (
            <section
              className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
              style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="font-black text-base flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <Spinner />
                  {statusMessage}
                </div>
                <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
                  {headlineProgress}%
                </div>
              </div>
              <ProgressBar progress={headlineProgress} />
              <div className="text-xs mt-3" style={{ color: 'var(--muted2)' }}>
                {phase === 'generating' && `Runway typically takes ~30-90 seconds per 10s clip. ${succeededCount}/${tasks.length} clips ready.`}
                {phase === 'clips_ready' && 'Clips finished. Running TTS, uploading the voiceover, and preparing the caption track…'}
                {phase === 'composing' && 'Creatomate is rendering your full Short with voiceover, captions, and CTA.'}
              </div>

              {/* The per-clip tile grid was removed in push #031 — the final
                  output is a single composed MP4, so users only ever see ONE
                  video on this page (the finalVideoUrl, rendered below in the
                  `done` section). Progress is communicated through the
                  spinner + bar above. */}

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

          {phase === 'failed' && (
            <section
              className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
              style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.25)' }}
            >
              <div className="font-black text-base mb-2" style={{ color: '#fca5a5' }}>
                Geração falhou. Tente novamente.
              </div>
              <button
                onClick={handleGenerate}
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-white mt-2"
                style={{
                  background: 'linear-gradient(135deg, #2563EB, #1d4ed8)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                🔄 Retry
              </button>
            </section>
          )}

          {phase === 'done' && finalVideoUrl && (
            <section
              className="gv-card rounded-2xl px-5 sm:px-8 py-8 sm:py-10 mb-6 flex flex-col items-center"
              style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
            >
              <div className="text-center">
                <h2 className="font-black tracking-tight" style={{ fontSize: '1.5rem', color: 'var(--text)', lineHeight: 1.2 }}>
                  Your video is ready
                </h2>
                <p className="text-xs mt-1.5" style={{ color: 'var(--muted)', letterSpacing: '0.04em' }}>
                  {duration}s · YouTube Shorts 9:16
                </p>
              </div>

              {/* Push #045A — bigger result-page player. width caps at 460px
                  on desktop, falls back to 90vw on smaller viewports;
                  max-height pins it under the fold (78vh) so the buttons
                  below remain visible. object-fit: contain lets the actual
                  composed letterboxing show without cropping. */}
              <div
                className="rounded-2xl overflow-hidden mt-6"
                style={{
                  width: 'min(460px, 90vw)',
                  maxHeight: '78vh',
                  aspectRatio: '9 / 16',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  border: '1px solid rgba(37,99,235,.45)',
                  boxShadow: '0 18px 60px rgba(37,99,235,.22)',
                  background: '#000',
                }}
              >
                <video
                  ref={videoRef}
                  key={finalVideoUrl}
                  src={finalVideoUrl}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
                <a
                  href={finalVideoUrl}
                  download={`shortsforge-${duration}s.mp4`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl px-5 py-2.5 text-sm font-bold text-white"
                  style={{
                    background: 'linear-gradient(135deg, #2563EB, #1d4ed8)',
                    border: 'none',
                    color: '#fff',
                    textDecoration: 'none',
                    boxShadow: '0 6px 22px rgba(37,99,235,.32)',
                  }}
                >
                  ⬇ Download MP4
                </a>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="rounded-xl px-5 py-2.5 text-sm font-bold"
                  style={{
                    background: copied ? 'rgba(52,211,153,.12)' : 'rgba(255,255,255,.05)',
                    border: copied ? '1px solid rgba(52,211,153,.45)' : '1px solid var(--border)',
                    color: copied ? '#34d399' : 'var(--text)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {copied ? '✓ Copied' : '🔗 Copy URL'}
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="rounded-xl px-5 py-2.5 text-sm font-bold"
                  style={{
                    background: 'rgba(255,255,255,.05)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  📤 Share
                </button>
              </div>

              <p className="text-xs mt-6 text-center" style={{ color: 'var(--muted)', maxWidth: 420, lineHeight: 1.55 }}>
                Voiceover, captions and CTA are baked into the final video. Upload it straight to YouTube Shorts.
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

// Build a voiceover script the /api/compose route can scale to the target
// word count. Prefer the explicit voiceover_script from analyze-idea so
// what the brief card shows is what gets narrated; fall back to the summary,
// then to the raw prompt.
function buildVoiceoverScript(prompt: string, analysis: Analysis | null): string {
  const vo = analysis?.voiceoverScript?.trim()
  if (vo) return vo
  const summary = analysis?.summary?.trim()
  if (summary) return summary
  return prompt.trim()
}

// Build the caption strip — short, punchy lines that get distributed across
// the duration. analysis.scenePlan reads as natural English captions; the
// Runway scene prompts are too descriptive and don't render well as overlays.
function buildSceneCaptions(
  analysis: Analysis | null,
  scenes: string[],
  duration: Duration
): string[] {
  const fromPlan = analysis?.scenePlan?.filter((s) => typeof s === 'string' && s.trim().length > 0) ?? []
  if (fromPlan.length > 0) {
    // Tighten each line so it fits the caption box.
    return fromPlan.map((s) => trimCaption(s))
  }
  // 10s → 1 clip, 30s → 3 clips, 50s → 5 clips. Matches /api/generate-video.
  const targetCount = duration === 10 ? 1 : duration === 30 ? 3 : 5
  return scenes.slice(0, targetCount).map((s) => trimCaption(s))
}

function trimCaption(s: string): string {
  const clean = s.trim().replace(/^\d+\.\s*/, '').replace(/^Scene\s+\d+[:.]\s*/i, '')
  if (clean.length <= 90) return clean
  return clean.slice(0, 87).replace(/[.,;!?]?\s*\S*$/, '') + '…'
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
