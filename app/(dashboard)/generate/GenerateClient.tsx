'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

interface ActiveSummary {
  generation_id: string
  prompt: string
  tasks: TaskHandle[]
  scenes: string[]
  created_at: string
  updated_at: string
  cost: number
  clips_total?: number
  clips_done?: number
  completed_clip_urls?: string[]
}

type Phase = 'idle' | 'analyzing' | 'options' | 'generating' | 'done' | 'error'
type Duration = 10 | 30 | 50
type Quality = 'basic' | 'pro'

const POLL_INTERVAL_MS = 5000

// Flat cost per job — 15 credits (Basic) or 20 credits (Pro) for any duration.
const QUALITY_OPTIONS: {
  key: Quality
  title: string
  desc: string
  credits: number
  icon: string
}[] = [
  { key: 'basic', title: 'Basic', desc: 'Standard video generation for short-form creators.',                       credits: 15, icon: '⚡' },
  { key: 'pro',   title: 'Pro',   desc: 'Better cinematic prompting and higher-quality generation settings.', credits: 20, icon: '✨' },
]

const GENERIC_ERROR = 'Video generation failed. Please try again.'

// Defensive check: never feed an image URL into a <video> element.
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
  const [scenes, setScenes] = useState<string[]>([])
  const [tasks, setTasks] = useState<TaskHandle[]>([])
  const [states, setStates] = useState<Record<string, TaskState>>({})
  const [error, setError] = useState<string | null>(null)
  const [playerIndex, setPlayerIndex] = useState(0)
  const [duration, setDuration] = useState<Duration>(10)
  const [quality, setQuality] = useState<Quality>('basic')
  const [chargedCost, setChargedCost] = useState<number>(15)
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [recoverable, setRecoverable] = useState<ActiveSummary | null>(null)
  const [recoveryBusy, setRecoveryBusy] = useState<'continue' | 'cancel' | 'start_over' | null>(null)
  // Multi-clip pipeline state — the server runs clips sequentially and reports
  // back how many are done plus the URLs of the finished ones. The UI uses this
  // to render a tile per clip and a single accurate progress bar.
  const [clipsTotal, setClipsTotal] = useState<number>(1)
  const [completedClipUrls, setCompletedClipUrls] = useState<string[]>([])
  const [allClipUrls, setAllClipUrls] = useState<string[]>([])
  const [copyHint, setCopyHint] = useState<'copied' | 'failed' | null>(null)
  const [creditBalance, setCreditBalance] = useState<number | null>(null)
  // Guards the Generate button between click and the POST round-trip
  // finishing, so a fast double-click can't fire two generations even though
  // the options panel unmounts on phase change.
  const submittingRef = useRef(false)
  const [submitting, setSubmitting] = useState(false)

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const autoAnalyzeKeyRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  // Read the user's current credit balance so we can show a low-credits
  // warning before the user submits and gets a 402. Also re-fetch whenever
  // the sidebar broadcasts a balance change (e.g. after a successful render).
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/credits', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (typeof data?.credits === 'number') setCreditBalance(data.credits)
      } catch {/* non-fatal */}
    }
    load()
    const onChange = () => load()
    window.addEventListener('creditsChanged', onChange)
    return () => {
      cancelled = true
      window.removeEventListener('creditsChanged', onChange)
    }
  }, [])

  // ── Check for an existing processing generation on mount ─────────────────
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/generate-video/active', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (data?.active) {
          setRecoverable({
            generation_id: data.active.generation_id,
            prompt: data.active.prompt ?? '',
            tasks: Array.isArray(data.active.tasks) ? data.active.tasks : [],
            scenes: Array.isArray(data.active.scenes) ? data.active.scenes : [],
            created_at: data.active.created_at,
            updated_at: data.active.updated_at,
            cost: typeof data.active.cost === 'number' ? data.active.cost : 1,
            clips_total: typeof data.active.clips_total === 'number' ? data.active.clips_total : undefined,
            clips_done: typeof data.active.clips_done === 'number' ? data.active.clips_done : undefined,
            completed_clip_urls: Array.isArray(data.active.completed_clip_urls) ? data.active.completed_clip_urls : [],
          })
        } else if (data?.swept) {
          // A stale job was just cleaned up — refresh the credits chip.
          try { window.dispatchEvent(new Event('creditsChanged')) } catch {}
        }
      } catch {
        // Best-effort — recovery panel is optional UX.
      }
    })()
    return () => { cancelled = true }
  }, [])

  // ── Polling driver (status by generation_id) ─────────────────────────────
  useEffect(() => {
    if (phase !== 'generating' || !generationId) return
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch(
          `/api/generate-video/status?generation_id=${encodeURIComponent(generationId!)}`,
          { cache: 'no-store' }
        )
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error('Status lookup failed')

        if (Array.isArray(data.tasks) && data.tasks.length > 0) {
          // Keep prior states; only overlay the current task. The status endpoint
          // returns just the currently-running clip, not the whole history.
          setStates((prev) => {
            const next: Record<string, TaskState> = { ...prev }
            for (const t of data.tasks as TaskState[]) next[t.id] = t
            return next
          })
          // Append any unseen task to the tasks list (server rotates task_ids
          // as it launches each new clip).
          setTasks((prev) => {
            const seen = new Set(prev.map((p) => p.id))
            const incoming = (data.tasks as TaskState[]).filter((t) => !seen.has(t.id))
            if (incoming.length === 0) return prev
            const nextIndex = (data.clip_index ?? prev.length)
            return [
              ...prev,
              ...incoming.map((t, i) => ({
                id: t.id,
                promptText: '',
                index: nextIndex + i,
              })),
            ]
          })
        }

        if (Array.isArray(data.completed_clip_urls)) {
          setCompletedClipUrls(data.completed_clip_urls)
        }
        if (typeof data.clips_total === 'number' && data.clips_total > 0) {
          setClipsTotal(data.clips_total)
        }

        if (data.status === 'completed') {
          if (Array.isArray(data.all_clip_urls) && data.all_clip_urls.length > 0) {
            setAllClipUrls(data.all_clip_urls)
          } else if (typeof data.video_url === 'string' && data.video_url) {
            setAllClipUrls([data.video_url])
          }
          try { window.dispatchEvent(new Event('creditsChanged')) } catch {}
          setPhase('done')
          return
        }
        if (data.status === 'failed' || data.status === 'cancelled') {
          setError(data.stale ? 'Generation took too long and was cancelled. Please try again.' : GENERIC_ERROR)
          setPhase('error')
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
  }, [phase, generationId])

  // Build a per-slot view across the whole pipeline: completed clips have a
  // URL (from the server), the in-flight clip pulls its live state from
  // `states`, and remaining slots are queued.
  type SlotView = {
    slot: number
    label: 'done' | 'failed' | 'rendering' | 'queued' | 'no file'
    videoUrl: string | null
    progress: number // 0..1
  }
  const slots = useMemo<SlotView[]>(() => {
    const total = Math.max(clipsTotal, 1)
    const currentTask = tasks.length > 0 ? tasks[tasks.length - 1] : null
    const currentState = currentTask ? states[currentTask.id] ?? null : null
    const out: SlotView[] = []
    for (let i = 0; i < total; i++) {
      if (i < completedClipUrls.length) {
        out.push({ slot: i, label: 'done', videoUrl: completedClipUrls[i], progress: 1 })
        continue
      }
      if (i === completedClipUrls.length && currentState) {
        const url = currentState.videoUrl && looksLikeVideoUrl(currentState.videoUrl) ? currentState.videoUrl : null
        if (currentState.status === 'SUCCEEDED') {
          out.push({ slot: i, label: url ? 'done' : 'no file', videoUrl: url, progress: 1 })
        } else if (currentState.status === 'FAILED' || currentState.status === 'CANCELLED') {
          out.push({ slot: i, label: 'failed', videoUrl: null, progress: 1 })
        } else if (currentState.status === 'RUNNING') {
          const p = typeof currentState.progress === 'number' ? Math.max(0, Math.min(1, currentState.progress)) : 0.4
          out.push({ slot: i, label: 'rendering', videoUrl: null, progress: p })
        } else {
          out.push({ slot: i, label: 'rendering', videoUrl: null, progress: 0.1 })
        }
        continue
      }
      out.push({ slot: i, label: 'queued', videoUrl: null, progress: 0 })
    }
    return out
  }, [clipsTotal, tasks, states, completedClipUrls])

  const successClips = useMemo(() => {
    // For the result player: prefer the final all_clip_urls list (set on
    // completion); otherwise fall back to whatever has finished so far.
    if (allClipUrls.length > 0) {
      return allClipUrls.map((url, i) => ({
        id: `final-${i}`,
        status: 'SUCCEEDED' as const,
        progress: 1,
        videoUrl: url,
        failure: null,
      })) satisfies TaskState[]
    }
    return slots
      .filter((s) => s.label === 'done' && s.videoUrl)
      .map((s) => ({
        id: `slot-${s.slot}`,
        status: 'SUCCEEDED' as const,
        progress: 1,
        videoUrl: s.videoUrl,
        failure: null,
      })) satisfies TaskState[]
  }, [allClipUrls, slots])

  const totalProgress = useMemo(() => {
    if (slots.length === 0) return 0
    const sum = slots.reduce((acc, s) => acc + s.progress, 0)
    return Math.min(100, Math.round((sum / slots.length) * 100))
  }, [slots])

  const succeededCount = useMemo(
    () => slots.filter((s) => s.label === 'done').length,
    [slots]
  )

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
    setStates({})
    setPlayerIndex(0)
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
    // Re-entrance guard. Setting state alone isn't enough: a double-click in
    // the same JS tick can fire two handlers before React unmounts the panel.
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    const trimmed = prompt.trim()
    if (!trimmed) {
      setError('Please describe your video idea first.')
      submittingRef.current = false
      setSubmitting(false)
      return
    }
    setError(null)
    setStates({})
    setTasks([])
    setScenes([])
    setPlayerIndex(0)
    setGenerationId(null)
    setCompletedClipUrls([])
    setAllClipUrls([])
    // Optimistically size the tile grid from the user's chosen duration so the
    // skeleton appears immediately, before the POST response lands.
    setClipsTotal(duration === 10 ? 1 : duration === 30 ? 3 : 5)
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

      // Concurrency-limit: another generation is still processing.
      if (res.status === 409 && data?.error === 'active_generation_exists') {
        setPhase('idle')
        setRecoverable({
          generation_id: data.generation_id,
          prompt: '',
          tasks: [],
          scenes: [],
          created_at: data.created_at,
          updated_at: data.updated_at,
          cost: 15,
        })
        return
      }

      if (res.status === 402) {
        setError(`Not enough credits. This generation needs ${QUALITY_OPTIONS.find(q => q.key === quality)?.credits ?? 15} credit(s).`)
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
      setGenerationId(data.generation_id ?? null)
      if (typeof data.clip_count === 'number' && data.clip_count > 0) {
        setClipsTotal(data.clip_count)
      } else if (Array.isArray(data.scenes) && data.scenes.length > 0) {
        setClipsTotal(data.scenes.length)
      }
      if (typeof data.cost === 'number' && data.cost >= 1) {
        setChargedCost(Math.min(20, Math.max(15, Math.floor(data.cost))))
      } else {
        setChargedCost(QUALITY_OPTIONS.find((q) => q.key === quality)?.credits ?? 15)
      }
    } catch (err: unknown) {
      console.error('[generate] generate threw:', err)
      setError(GENERIC_ERROR)
      setPhase('error')
    } finally {
      // Release the re-entrance guard whether the POST succeeded, errored,
      // or hit a 409/402. Polling state is governed by `phase`, not by this.
      submittingRef.current = false
      setSubmitting(false)
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
    setGenerationId(null)
    setClipsTotal(1)
    setCompletedClipUrls([])
    setAllClipUrls([])
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

  // ── Recovery actions ─────────────────────────────────────────────────────
  const continueProgress = useCallback(async () => {
    if (!recoverable) return
    setRecoveryBusy('continue')
    setTasks(recoverable.tasks)
    setScenes(recoverable.scenes)
    setStates({})
    setPlayerIndex(0)
    setPrompt(recoverable.prompt || prompt)
    setChargedCost(Math.min(20, Math.max(15, Math.floor(recoverable.cost || 15))))
    setGenerationId(recoverable.generation_id)
    setCompletedClipUrls(recoverable.completed_clip_urls ?? [])
    setAllClipUrls([])
    setClipsTotal(
      recoverable.clips_total ??
      (recoverable.scenes?.length || recoverable.tasks?.length || 1)
    )
    setError(null)
    setRecoverable(null)
    setPhase('generating')
    setRecoveryBusy(null)
  }, [recoverable, prompt])

  const cancelRecoverable = useCallback(async (mode: 'cancel' | 'start_over') => {
    if (!recoverable) return
    setRecoveryBusy(mode)
    try {
      await fetch('/api/generate-video/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generation_id: recoverable.generation_id }),
      })
      try { window.dispatchEvent(new Event('creditsChanged')) } catch {}
    } catch (err) {
      console.error('[generate] cancel threw:', err)
    } finally {
      setRecoverable(null)
      setRecoveryBusy(null)
      if (mode === 'start_over') {
        handleReset()
      }
    }
  }, [recoverable])

  const currentClipUrl = successClips[playerIndex]?.videoUrl ?? null
  // Flat per-job cost: 15 credits (Basic) or 20 credits (Pro), regardless of duration.
  // 30s/50s jobs render 3 or 5 clips but still bill once, on successful completion.
  const expectedClipCount = duration === 10 ? 1 : duration === 30 ? 3 : 5
  const selectedCost = QUALITY_OPTIONS.find((q) => q.key === quality)?.credits ?? 15
  const lowCredits = creditBalance !== null && creditBalance < selectedCost
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

      {/* ── Recovery panel ── */}
      {recoverable && (
        <section
          className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
          style={{
            background: 'rgba(245,158,11,.06)',
            border: '1px solid rgba(245,158,11,.35)',
          }}
        >
          <div className="font-black text-base mb-1" style={{ color: '#FCD34D' }}>
            You have a video currently processing.
          </div>
          <div className="text-xs mb-4" style={{ color: 'var(--muted2)' }}>
            Resume polling to wait for it, cancel it to refund the slot, or discard it and start fresh.
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={continueProgress}
              disabled={!!recoveryBusy}
              className="rounded-xl px-4 py-2 text-xs font-black text-white"
              style={{
                background: 'linear-gradient(135deg, #2563EB, #1d4ed8)',
                border: 'none',
                cursor: recoveryBusy ? 'wait' : 'pointer',
                opacity: recoveryBusy ? 0.7 : 1,
              }}
            >
              ▶ Continue progress
            </button>
            <button
              onClick={() => cancelRecoverable('cancel')}
              disabled={!!recoveryBusy}
              className="rounded-xl px-4 py-2 text-xs font-bold"
              style={{
                background: 'rgba(255,255,255,.04)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                cursor: recoveryBusy ? 'wait' : 'pointer',
                opacity: recoveryBusy ? 0.7 : 1,
              }}
            >
              ✖ Cancel generation
            </button>
            <button
              onClick={() => cancelRecoverable('start_over')}
              disabled={!!recoveryBusy}
              className="rounded-xl px-4 py-2 text-xs font-bold"
              style={{
                background: 'rgba(239,68,68,.08)',
                border: '1px solid rgba(239,68,68,.32)',
                color: '#fca5a5',
                cursor: recoveryBusy ? 'wait' : 'pointer',
                opacity: recoveryBusy ? 0.7 : 1,
              }}
            >
              🔄 Start over
            </button>
          </div>
        </section>
      )}

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
                    {d === 10 ? '10s (quick)' : d === 30 ? '30s (3 clips)' : '50s (5 clips)'}
                  </button>
                ))}
              </div>
              {duration !== 10 && (
                <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                  Delivered as {duration === 30 ? '3' : '5'} separate 10s clips you can stitch in any editor (CapCut, InVideo). Charged once, on success.
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

            {lowCredits && (
              <div
                className="mt-5 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap"
                style={{
                  background: 'rgba(245,158,11,.08)',
                  border: '1px solid rgba(245,158,11,.3)',
                  color: '#fcd34d',
                }}
                role="alert"
              >
                <span>
                  You need {selectedCost} credit{selectedCost > 1 ? 's' : ''} for this generation — you only have{' '}
                  {creditBalance}.
                </span>
                <a
                  href="/pricing"
                  style={{
                    background: 'rgba(245,158,11,.18)',
                    border: '1px solid rgba(245,158,11,.4)',
                    color: '#fde68a',
                    borderRadius: 10,
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    textDecoration: 'none',
                  }}
                >
                  Top up →
                </a>
              </div>
            )}

            {/* Generate */}
            <div className="flex items-center justify-end mt-6 gap-2 flex-wrap">
              <button
                onClick={handleGenerate}
                disabled={!!recoverable || lowCredits || submitting}
                className="rounded-xl px-6 py-3 text-sm font-black text-white flex items-center gap-2"
                style={{
                  background: recoverable || lowCredits || submitting
                    ? 'rgba(255,255,255,.04)'
                    : 'linear-gradient(135deg, #2563EB, #1d4ed8)',
                  border: 'none',
                  cursor: recoverable || lowCredits || submitting ? 'not-allowed' : 'pointer',
                  color: recoverable || lowCredits || submitting ? 'var(--muted)' : '#fff',
                  boxShadow: recoverable || lowCredits || submitting ? 'none' : '0 8px 28px rgba(37,99,235,.4)',
                }}
              >
                {submitting ? <><Spinner /><span>Starting…</span></> : (
                  <>
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
                  </>
                )}
              </button>
            </div>
          </section>
        </>
      )}

      {/* ── Render / Done / Error ── */}
      {showRender && (
        <>
          {slots.length > 0 && (
            <section
              className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
              style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="font-black text-base" style={{ color: 'var(--text)' }}>
                  {phase === 'done'
                    ? `✅ Your Short is ready (${slots.length} clip${slots.length > 1 ? 's' : ''})`
                    : `🎬 Rendering your Short… (${Math.min(succeededCount + 1, slots.length)}/${slots.length})`}
                </div>
                <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
                  {totalProgress}%
                </div>
              </div>
              <ProgressBar progress={totalProgress} />
              <div className="text-xs mt-3" style={{ color: 'var(--muted2)' }}>
                {phase === 'done'
                  ? slots.length > 1
                    ? `All ${slots.length} clips finished. Download them below and stitch in any editor.`
                    : 'Your 10s clip is ready. Press play below to watch.'
                  : `Rendering ${slots.length > 1 ? slots.length + ' clips' : 'your clip'}… Runway takes ~30-90s per 10s clip. We poll every 5s and launch the next clip automatically.`}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                {slots.map((s) => {
                  const failed = s.label === 'failed'
                  const playable = s.label === 'done' && !!s.videoUrl
                  const succeededNoFile = s.label === 'no file'
                  const running = s.label === 'rendering'
                  return (
                    <div
                      key={s.slot}
                      className="rounded-xl overflow-hidden"
                      style={{
                        aspectRatio: '9 / 16',
                        background: 'rgba(0,0,0,.4)',
                        border: playable
                          ? '1px solid rgba(16,185,129,.4)'
                          : failed || succeededNoFile
                          ? '1px solid rgba(239,68,68,.35)'
                          : '1px solid var(--border)',
                        position: 'relative',
                      }}
                    >
                      {playable && s.videoUrl ? (
                        <video
                          key={s.videoUrl}
                          src={s.videoUrl}
                          muted
                          loop
                          autoPlay
                          playsInline
                          preload="metadata"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          className="absolute inset-0 flex items-center justify-center text-xs font-bold text-center px-2"
                          style={{
                            color: failed || succeededNoFile ? '#f87171' : running ? '#93c5fd' : 'var(--muted)',
                          }}
                        >
                          {failed
                            ? '⚠ Failed'
                            : succeededNoFile
                            ? 'No file'
                            : running
                            ? <><Spinner /><span className="ml-2">Rendering…</span></>
                            : '⏳ Queued'}
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
                        Clip {s.slot + 1} · {s.label}
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

          {phase === 'generating' && slots.length === 0 && (
            <section
              className="gv-card rounded-2xl p-5 sm:p-6 mb-6 flex items-center gap-4"
              style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
            >
              <Spinner />
              <div>
                <div className="font-black text-base" style={{ color: 'var(--text)' }}>
                  Rendering your video…
                </div>
                <div className="text-sm" style={{ color: 'var(--muted2)' }}>
                  Resuming your in-progress generation. This can take up to a few minutes.
                </div>
              </div>
            </section>
          )}

          {phase === 'done' && successClips.length === 0 && (
            <section
              className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
              style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.25)' }}
            >
              <div className="font-black text-base mb-1" style={{ color: '#fca5a5' }}>
                Video file not available. Please try again.
              </div>
            </section>
          )}

          {phase === 'error' && (
            <section
              className="gv-card rounded-2xl p-5 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.25)' }}
            >
              <div className="font-black text-base" style={{ color: '#fca5a5' }}>
                {error || 'Video generation failed. Please try again.'}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setError(null)
                    setStates({})
                    setTasks([])
                    setCompletedClipUrls([])
                    setAllClipUrls([])
                    setGenerationId(null)
                    handleGenerate()
                  }}
                  className="rounded-xl px-4 py-2 text-xs font-black text-white"
                  style={{
                    background: 'linear-gradient(135deg, #2563EB, #1d4ed8)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  ⟲ Retry
                </button>
                <button
                  onClick={handleReset}
                  className="rounded-xl px-4 py-2 text-xs font-bold"
                  style={{
                    background: 'rgba(255,255,255,.04)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  Start over
                </button>
              </div>
            </section>
          )}

          {phase === 'done' && successClips.length > 0 && currentClipUrl && (
            <section
              className="gv-card rounded-2xl p-5 sm:p-6 mb-6 flex flex-col items-center"
              style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
            >
              <div className="font-black text-lg mb-3" style={{ color: 'var(--text)' }}>
                {successClips.length > 1
                  ? `▶ Preview clip ${playerIndex + 1}/${successClips.length}`
                  : '▶ Your Short'}
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
                  preload="metadata"
                  poster={undefined}
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
                {successClips.map((s, i) => {
                  if (!s.videoUrl || !looksLikeVideoUrl(s.videoUrl)) return null
                  return (
                    <a
                      key={s.id}
                      href={s.videoUrl}
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
                  )
                })}
              </div>

              {/* Copy / Share actions for the currently-playing clip */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={async () => {
                    if (!currentClipUrl) return
                    try {
                      await navigator.clipboard.writeText(currentClipUrl)
                      setCopyHint('copied')
                    } catch {
                      setCopyHint('failed')
                    }
                    setTimeout(() => setCopyHint(null), 1800)
                  }}
                  disabled={!currentClipUrl}
                  className="rounded-xl px-3.5 py-2 text-xs font-bold"
                  style={{
                    background: 'rgba(255,255,255,.04)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    cursor: currentClipUrl ? 'pointer' : 'not-allowed',
                    opacity: currentClipUrl ? 1 : 0.6,
                  }}
                  aria-live="polite"
                >
                  {copyHint === 'copied' ? '✓ Copied' : copyHint === 'failed' ? '✗ Copy failed' : '🔗 Copy URL'}
                </button>
                {typeof navigator !== 'undefined' && 'share' in navigator && currentClipUrl && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
                          title: 'My ShortsForgeAI clip',
                          text: 'Check out this AI-generated Short I just made.',
                          url: currentClipUrl,
                        })
                      } catch {
                        // user cancelled or share unsupported; non-fatal
                      }
                    }}
                    className="rounded-xl px-3.5 py-2 text-xs font-bold"
                    style={{
                      background: 'rgba(255,255,255,.04)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      cursor: 'pointer',
                    }}
                  >
                    📤 Share
                  </button>
                )}
              </div>

              <p className="text-xs mt-3 text-center" style={{ color: 'var(--muted)' }}>
                {successClips.length > 1
                  ? `Heads-up: 30s and 50s jobs are delivered as ${successClips.length} separate 10s clips. Drop them into CapCut, InVideo, or any editor to stitch with captions and voiceover.`
                  : 'Tip: drop the clip into CapCut or InVideo to add captions, voiceover, and effects.'}
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
