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

interface SceneBrief {
  scene_number: number
  duration_seconds: number
  caption: string
  visual_prompt: string
  voiceover: string
}

interface Analysis {
  // Legacy
  title: string
  summary: string
  niche: string
  scenePlan: string[]
  // Push #024A — richer creative brief from /api/analyze-idea
  viral_title?: string
  hook?: string
  tone?: string
  voiceover_script?: string
  scenes?: SceneBrief[]
  music_mood?: string
  pacing_notes?: string
  youtube_title?: string
  youtube_description?: string
  hashtags?: string[]
  // Push #024B — pre-clamped (<=500 chars) cinematic prompt safe for Runway
  provider_prompt?: string
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
type Platform = 'youtube_shorts' | 'tiktok' | 'instagram_reels'

const POLL_INTERVAL_MS = 5000

// Flat cost per job — 15 credits (Basic) or 20 credits (Pro) for any duration.
const QUALITY_OPTIONS: {
  key: Quality
  title: string
  desc: string
  credits: number
  icon: string
}[] = [
  { key: 'basic', title: 'Basic', desc: 'Standard video generation for short-form creators.',                 credits: 15, icon: '⚡' },
  { key: 'pro',   title: 'Pro',   desc: 'Better cinematic prompting and higher-quality generation settings.', credits: 20, icon: '✨' },
]

// All platforms produce the same vertical 9:16 output; the choice is stored as
// metadata so we can surface it later in history/title without re-rendering.
const PLATFORM_OPTIONS: { key: Platform; label: string; icon: string }[] = [
  { key: 'youtube_shorts',  label: 'YouTube Shorts',   icon: '📺' },
  { key: 'tiktok',          label: 'TikTok',           icon: '🎵' },
  { key: 'instagram_reels', label: 'Instagram Reels',  icon: '📸' },
]

const GENERIC_ERROR = 'Video generation failed. Please try again.'
const DEFAULT_TITLE = 'ShortsForgeAI | AI Video Generator'

/**
 * Best-effort parse of the user's prompt for an explicit duration. We map any
 * recognised value to one of the three options the API supports (10 / 30 / 50)
 * — push #025 defaults to 30 when nothing is mentioned, instead of the old 10.
 */
function detectDurationFromPrompt(raw: string): Duration {
  const text = (raw ?? '').toLowerCase()
  const wordToNum: Record<string, number> = {
    ten: 10, fifteen: 15, twenty: 20, 'twenty-five': 25, 'twenty five': 25,
    thirty: 30, 'thirty-five': 35, 'thirty five': 35,
    forty: 40, 'forty-five': 45, 'forty five': 45,
    fifty: 50, sixty: 60,
  }
  let detected: number | null = null
  // Numeric matches: "10s", "30 seconds", "around 50 sec", "~35s"
  const numMatch = text.match(/(?:~|around|about|roughly)?\s*(\d{1,3})\s*(?:s\b|sec\b|seconds?\b)/i)
  if (numMatch) detected = Number(numMatch[1])
  // Word matches: "thirty seconds", "ten seconds"
  if (detected === null) {
    for (const [word, n] of Object.entries(wordToNum)) {
      if (new RegExp(`\\b${word}\\s*(?:seconds?|sec|s)\\b`, 'i').test(text)) {
        detected = n
        break
      }
    }
  }
  if (detected === null) return 30 // no duration mentioned → 30 (push #025 default)
  if (detected <= 15) return 10
  if (detected <= 40) return 30
  return 50
}

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
  // Push #025: default to 30s. The Analyze Idea step (handleAnalyze) refines
  // this from the prompt itself once the brief is built.
  const [duration, setDuration] = useState<Duration>(30)
  const [quality, setQuality] = useState<Quality>('basic')
  const [platform, setPlatform] = useState<Platform>('youtube_shorts')
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
  const [downloadState, setDownloadState] = useState<'idle' | 'fetching' | 'error'>('idle')
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

  // Push #021 collapses the old multi-clip player into a single result. We
  // surface the first available URL — server-side `video_url` (allClipUrls[0])
  // for finished jobs, falling back to whatever the polling has handed us so
  // far. The internal multi-clip pipeline is hidden from the user.
  const primaryVideoUrl = useMemo(() => {
    return (
      allClipUrls.find((u) => looksLikeVideoUrl(u)) ??
      completedClipUrls.find((u) => looksLikeVideoUrl(u)) ??
      null
    )
  }, [allClipUrls, completedClipUrls])

  const totalProgress = useMemo(() => {
    if (slots.length === 0) return 0
    const sum = slots.reduce((acc, s) => acc + s.progress, 0)
    return Math.min(100, Math.round((sum / slots.length) * 100))
  }, [slots])

  // Push #025: reflect generation state in the browser tab title so the user
  // can leave the tab and still see progress at a glance. Reset on unmount.
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (phase === 'generating') {
      document.title = `${totalProgress}% — ShortsForgeAI`
    } else if (phase === 'done') {
      document.title = `Video Ready — ShortsForgeAI`
    } else if (phase === 'error') {
      document.title = `Generation Failed — ShortsForgeAI`
    } else {
      document.title = DEFAULT_TITLE
    }
    return () => {
      // Cleanup runs both on dep change AND on unmount. We let the next render
      // immediately overwrite it for dep changes; the unmount case is handled
      // by the dedicated mount effect below.
    }
  }, [phase, totalProgress])

  // Restore the tab title when the user navigates away from /generate.
  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') document.title = DEFAULT_TITLE
    }
  }, [])

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
        title: data.viral_title ?? data.title ?? '',
        summary: data.summary ?? '',
        niche: data.niche ?? '',
        scenePlan: Array.isArray(data.scenePlan) ? data.scenePlan : [],
        viral_title: typeof data.viral_title === 'string' ? data.viral_title : undefined,
        hook: typeof data.hook === 'string' ? data.hook : undefined,
        tone: typeof data.tone === 'string' ? data.tone : undefined,
        voiceover_script: typeof data.voiceover_script === 'string' ? data.voiceover_script : undefined,
        scenes: Array.isArray(data.scenes) ? (data.scenes as SceneBrief[]) : undefined,
        music_mood: typeof data.music_mood === 'string' ? data.music_mood : undefined,
        pacing_notes: typeof data.pacing_notes === 'string' ? data.pacing_notes : undefined,
        youtube_title: typeof data.youtube_title === 'string' ? data.youtube_title : undefined,
        youtube_description: typeof data.youtube_description === 'string' ? data.youtube_description : undefined,
        hashtags: Array.isArray(data.hashtags) ? data.hashtags.filter((h: unknown): h is string => typeof h === 'string') : undefined,
        provider_prompt: typeof data.provider_prompt === 'string' ? data.provider_prompt : undefined,
      })

      // Push #025: pre-select Duration from the prompt (or from a server-
      // provided `detected_duration_seconds` hint when available). Maps any
      // recognised value to 10 / 30 / 50; falls back to 30 when nothing is
      // mentioned. Done after setAnalysis so the brief and the duration land
      // in the same render.
      const serverHint =
        typeof data.detected_duration_seconds === 'number' && Number.isFinite(data.detected_duration_seconds)
          ? (data.detected_duration_seconds as number)
          : null
      const pickedFromServer: Duration | null =
        serverHint === null
          ? null
          : serverHint <= 15
          ? 10
          : serverHint <= 40
          ? 30
          : 50
      setDuration(pickedFromServer ?? detectDurationFromPrompt(source))

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

    setGenerationId(null)
    setCompletedClipUrls([])
    setAllClipUrls([])
    // Optimistically size the tile grid from the user's chosen duration so the
    // skeleton appears immediately, before the POST response lands.
    setClipsTotal(duration === 10 ? 1 : duration === 30 ? 3 : 5)
    setPhase('generating')

    // Push #024B: hand the analyze-idea brief (provider_prompt + per-scene
    // visual prompts) to the server when we have one. The server uses these
    // — clamped to 500 chars — as the Runway scene text and skips the extra
    // OpenAI scene call. Falls back to the user prompt if no brief is loaded.
    const briefScenePrompts =
      analysis?.scenes && analysis.scenes.length > 0
        ? analysis.scenes
            .map((s) => (typeof s.visual_prompt === 'string' ? s.visual_prompt : ''))
            .filter((s) => s.trim().length > 0)
        : analysis?.scenePlan ?? []

    try {
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          platform,
          duration,
          quality,
          provider_prompt: analysis?.provider_prompt ?? undefined,
          scene_visual_prompts: briefScenePrompts.length > 0 ? briefScenePrompts : undefined,
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
        console.error('[generate] generate-video error:', res.status, data?.error)
        // Surface the server's specific error to the user. The server returns
        // tailored messages ("Failed to plan scenes…", "Runway rejected the
        // request: …", "Could not start generation. Please try again.") and
        // collapsing them all into GENERIC_ERROR hides useful debugging info.
        const serverMsg = typeof data?.error === 'string' && data.error.trim().length > 0
          ? data.error
          : GENERIC_ERROR
        setError(serverMsg)
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

    setGenerationId(null)
    setClipsTotal(1)
    setCompletedClipUrls([])
    setAllClipUrls([])
    setDownloadState('idle')
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
  }, [phase, primaryVideoUrl])

  // ── Recovery actions ─────────────────────────────────────────────────────
  const continueProgress = useCallback(async () => {
    if (!recoverable) return
    setRecoveryBusy('continue')
    setTasks(recoverable.tasks)
    setScenes(recoverable.scenes)
    setStates({})

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

  // Flat per-job cost: 15 credits (Basic) or 20 credits (Pro), regardless of duration.
  const selectedCost = QUALITY_OPTIONS.find((q) => q.key === quality)?.credits ?? 15
  const lowCredits = creditBalance !== null && creditBalance < selectedCost
  const showStep1 = phase === 'idle' || phase === 'analyzing'
  const showStep2 = phase === 'options'
  const showRender = phase === 'generating' || phase === 'done' || phase === 'error'

  return (
    <main className="px-4 sm:px-6 py-8 mx-auto" style={{ maxWidth: 'min(1080px, 100%)' }}>
      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .gv-card { animation: fadeUp 0.35s ease both; }
        .gv-step2-grid {
          display: grid;
          gap: 16px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 1024px) {
          .gv-step2-grid {
            grid-template-columns: minmax(0, 1fr) 320px;
            align-items: start;
          }
          .gv-step2-settings {
            position: sticky;
            top: 16px;
          }
        }
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
          🎬 Create AI Short
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted2)' }}>
          {showStep1 && 'Describe your idea. We\'ll analyze it before charging any credits.'}
          {showStep2 && 'Pick duration, platform, and quality — then generate.'}
          {showRender && 'Rendering your vertical 9:16 video.'}
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
        <div className="gv-step2-grid">
          <section
            className="gv-card rounded-2xl p-5 sm:p-6"
            style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
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
                {analysis.tone && (
                  <span
                    className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded"
                    style={{
                      background: 'rgba(168,85,247,.12)',
                      border: '1px solid rgba(168,85,247,.3)',
                      color: '#c4b5fd',
                    }}
                  >
                    Tone · {analysis.tone}
                  </span>
                )}
              </div>
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
              {analysis.viral_title || analysis.title}
            </h2>
            {analysis.hook && (
              <div
                className="rounded-xl px-4 py-3 mb-3"
                style={{
                  background: 'rgba(37,99,235,.08)',
                  border: '1px solid rgba(37,99,235,.25)',
                }}
              >
                <div
                  className="text-[10px] font-black uppercase tracking-widest mb-1"
                  style={{ color: '#93c5fd' }}
                >
                  Hook · first 2 seconds
                </div>
                <p className="text-sm" style={{ color: 'var(--text)', lineHeight: 1.5 }}>
                  &ldquo;{analysis.hook}&rdquo;
                </p>
              </div>
            )}
            <p className="text-sm mb-4" style={{ color: 'var(--muted2)', lineHeight: 1.55 }}>
              {analysis.summary}
            </p>

            {/* Rich scene list — uses captions + visual prompts if available,
                falls back to the flat scenePlan strings for older responses. */}
            {analysis.scenes && analysis.scenes.length > 0 ? (
              <ol className="space-y-3 text-xs" style={{ color: 'var(--muted2)' }}>
                {analysis.scenes.map((s, i) => (
                  <li
                    key={i}
                    className="rounded-lg px-3 py-2"
                    style={{ background: 'rgba(255,255,255,.025)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ color: '#93c5fd', fontWeight: 700 }}>
                        Scene {s.scene_number ?? i + 1}
                      </span>
                      <span className="font-bold" style={{ color: 'var(--muted)' }}>
                        {s.duration_seconds || '—'}s
                      </span>
                    </div>
                    {s.caption && (
                      <div
                        className="text-xs font-black mb-1.5"
                        style={{ color: 'var(--text)', letterSpacing: '0.01em' }}
                      >
                        “{s.caption}”
                      </div>
                    )}
                    {s.visual_prompt && (
                      <div className="mb-1" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
                        <span style={{ color: '#a5b4fc', fontWeight: 700 }}>Visual: </span>
                        {s.visual_prompt}
                      </div>
                    )}
                    {s.voiceover && (
                      <div style={{ color: 'var(--muted)', lineHeight: 1.5, fontStyle: 'italic' }}>
                        <span style={{ color: '#c4b5fd', fontWeight: 700, fontStyle: 'normal' }}>VO: </span>
                        {s.voiceover}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            ) : analysis.scenePlan.length > 0 ? (
              <ol className="space-y-1.5 text-xs" style={{ color: 'var(--muted2)', paddingLeft: 20 }}>
                {analysis.scenePlan.map((s, i) => (
                  <li key={i}>
                    <span style={{ color: '#93c5fd', fontWeight: 700 }}>Scene {i + 1}.</span> {s}
                  </li>
                ))}
              </ol>
            ) : null}

            {/* Full voiceover script */}
            {analysis.voiceover_script && (
              <details className="mt-4">
                <summary
                  className="text-[10px] font-black uppercase tracking-widest cursor-pointer"
                  style={{ color: 'var(--muted)' }}
                >
                  🎙️ Full voiceover script
                </summary>
                <p
                  className="text-xs mt-2 px-3 py-2 rounded-lg"
                  style={{
                    color: 'var(--text2)',
                    background: 'rgba(255,255,255,.03)',
                    border: '1px solid var(--border)',
                    lineHeight: 1.6,
                  }}
                >
                  {analysis.voiceover_script}
                </p>
              </details>
            )}

            {/* Music + pacing */}
            {(analysis.music_mood || analysis.pacing_notes) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                {analysis.music_mood && (
                  <div
                    className="rounded-lg px-3 py-2 text-xs"
                    style={{ background: 'rgba(255,255,255,.025)', border: '1px solid var(--border)' }}
                  >
                    <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#93c5fd' }}>
                      Music mood
                    </div>
                    <span style={{ color: 'var(--text2)' }}>{analysis.music_mood}</span>
                  </div>
                )}
                {analysis.pacing_notes && (
                  <div
                    className="rounded-lg px-3 py-2 text-xs"
                    style={{ background: 'rgba(255,255,255,.025)', border: '1px solid var(--border)' }}
                  >
                    <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#93c5fd' }}>
                      Pacing
                    </div>
                    <span style={{ color: 'var(--text2)' }}>{analysis.pacing_notes}</span>
                  </div>
                )}
              </div>
            )}

            {/* YouTube package */}
            {(analysis.youtube_title || analysis.youtube_description || (analysis.hashtags && analysis.hashtags.length > 0)) && (
              <details className="mt-4">
                <summary
                  className="text-[10px] font-black uppercase tracking-widest cursor-pointer"
                  style={{ color: 'var(--muted)' }}
                >
                  📺 YouTube package
                </summary>
                <div className="mt-2 space-y-2">
                  {analysis.youtube_title && (
                    <div
                      className="rounded-lg px-3 py-2 text-xs"
                      style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}
                    >
                      <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#a5b4fc' }}>
                        Title
                      </div>
                      <span style={{ color: 'var(--text)' }}>{analysis.youtube_title}</span>
                    </div>
                  )}
                  {analysis.youtube_description && (
                    <div
                      className="rounded-lg px-3 py-2 text-xs"
                      style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}
                    >
                      <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#a5b4fc' }}>
                        Description
                      </div>
                      <span style={{ color: 'var(--text2)', lineHeight: 1.55 }}>{analysis.youtube_description}</span>
                    </div>
                  )}
                  {analysis.hashtags && analysis.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.hashtags.map((h) => (
                        <span
                          key={h}
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(99,102,241,.12)',
                            border: '1px solid rgba(99,102,241,.25)',
                            color: '#a5b4fc',
                          }}
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            )}
          </section>

          <aside
            className="gv-card gv-step2-settings rounded-2xl p-5 sm:p-6"
            style={{ background: 'rgba(15,15,30,0.92)', border: '1px solid var(--border)' }}
          >
            <div
              className="text-sm font-black mb-4 pb-3"
              style={{
                color: 'var(--text)',
                borderBottom: '1px solid var(--border)',
                letterSpacing: '-0.01em',
              }}
            >
              ⚙ Generation Settings
            </div>

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
                    {`${d}s`}
                  </button>
                ))}
              </div>
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
                {PLATFORM_OPTIONS.map((p) => {
                  const selected = platform === p.key
                  return (
                    <button
                      key={p.key}
                      onClick={() => setPlatform(p.key)}
                      className="rounded-full px-4 py-1.5 text-sm font-bold flex items-center gap-1.5"
                      style={{
                        background: selected ? 'rgba(37,99,235,.85)' : 'rgba(255,255,255,.04)',
                        border: selected ? '1px solid rgba(37,99,235,.6)' : '1px solid var(--border)',
                        color: selected ? '#fff' : 'var(--muted)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: '0.8rem' }}>{p.icon}</span>
                      <span>{p.label}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                All platforms deliver vertical 9:16 video, ready to upload.
              </p>
            </div>

            {/* Quality cards — stacked so they fit the narrow side panel */}
            <div className="mt-5">
              <div
                className="text-xs font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--muted)' }}
              >
                Quality
              </div>
              <div className="flex flex-col gap-2">
                {QUALITY_OPTIONS.map((q) => {
                  const selected = quality === q.key
                  return (
                    <button
                      key={q.key}
                      onClick={() => setQuality(q.key)}
                      className="rounded-xl p-3 text-left"
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
                          {q.credits} credits
                        </span>
                      </div>
                      <div className="text-xs" style={{ color: 'var(--muted2)', lineHeight: 1.45 }}>
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

            {/* Generate — full-width inside the narrow settings panel */}
            <div className="mt-5">
              <button
                onClick={handleGenerate}
                disabled={!!recoverable || lowCredits || submitting}
                className="w-full rounded-xl px-6 py-3 text-sm font-black text-white flex items-center justify-center gap-2"
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
                  <span>Generate • {selectedCost} credits</span>
                )}
              </button>
              <p className="text-xs mt-3" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
                Credits are charged only when your video is successfully generated.
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* ── Render / Done / Error ── */}
      {showRender && (
        <>
          {/* Single-video render card. Even for 30s/50s jobs (which Runway
              fulfils as 3 or 5 sequential 10s clips internally) we present one
              "Rendering your video..." state and one final video to the user. */}
          {phase === 'generating' && (
            <section
              className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
              style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <Spinner />
                <div>
                  <div className="font-black text-base" style={{ color: 'var(--text)' }}>
                    Rendering your video…
                  </div>
                  <div className="text-sm" style={{ color: 'var(--muted2)' }}>
                    This usually takes a couple of minutes. You can leave this page — we&apos;ll keep working.
                  </div>
                </div>
                <div className="ml-auto text-xs font-bold" style={{ color: 'var(--muted)' }}>
                  {totalProgress}%
                </div>
              </div>
              <ProgressBar progress={totalProgress} />
            </section>
          )}

          {phase === 'done' && primaryVideoUrl && (
            <section
              className="gv-card rounded-2xl p-5 sm:p-6 mb-6 flex flex-col items-center"
              style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
            >
              <div className="font-black text-lg mb-3" style={{ color: 'var(--text)' }}>
                ✅ Your video is ready
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
                  key={primaryVideoUrl}
                  src={primaryVideoUrl}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                <button
                  type="button"
                  onClick={async () => {
                    if (!primaryVideoUrl || phase !== 'done' || downloadState === 'fetching') return
                    setDownloadState('fetching')
                    try {
                      // Fetch as a blob so cross-origin URLs (Runway's storage
                      // host) still trigger a Save dialog instead of opening
                      // a new tab. The `download` attribute alone is ignored
                      // by the browser when the response is cross-origin.
                      const res = await fetch(primaryVideoUrl)
                      if (!res.ok) throw new Error(`status ${res.status}`)
                      const blob = await res.blob()
                      const blobUrl = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = blobUrl
                      a.download = `shortsforgeai-video-${generationId ?? 'short'}.mp4`
                      document.body.appendChild(a)
                      a.click()
                      a.remove()
                      window.URL.revokeObjectURL(blobUrl)
                      setDownloadState('idle')
                    } catch (err) {
                      console.error('[generate] download failed:', err)
                      setDownloadState('error')
                      setTimeout(() => setDownloadState('idle'), 3000)
                    }
                  }}
                  disabled={!primaryVideoUrl || phase !== 'done' || downloadState === 'fetching'}
                  aria-live="polite"
                  className="rounded-xl px-5 py-2.5 text-sm font-black text-white"
                  style={{
                    background:
                      !primaryVideoUrl || phase !== 'done' || downloadState === 'fetching'
                        ? 'rgba(255,255,255,.06)'
                        : downloadState === 'error'
                        ? 'rgba(239,68,68,.18)'
                        : 'linear-gradient(135deg, #2563EB, #1d4ed8)',
                    border: 'none',
                    color: !primaryVideoUrl || phase !== 'done' ? 'var(--muted)' : '#fff',
                    cursor: !primaryVideoUrl || phase !== 'done' || downloadState === 'fetching' ? 'not-allowed' : 'pointer',
                    boxShadow:
                      !primaryVideoUrl || phase !== 'done' || downloadState !== 'idle'
                        ? 'none'
                        : '0 8px 28px rgba(37,99,235,.4)',
                  }}
                >
                  {downloadState === 'fetching'
                    ? 'Preparing download…'
                    : downloadState === 'error'
                    ? 'Could not download video. Please try again.'
                    : '⬇ Download Video'}
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (!primaryVideoUrl) return
                    try {
                      await navigator.clipboard.writeText(primaryVideoUrl)
                      setCopyHint('copied')
                    } catch {
                      setCopyHint('failed')
                    }
                    setTimeout(() => setCopyHint(null), 1800)
                  }}
                  className="rounded-xl px-3.5 py-2.5 text-xs font-bold"
                  style={{
                    background: 'rgba(255,255,255,.04)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                  aria-live="polite"
                >
                  {copyHint === 'copied' ? '✓ Copied' : copyHint === 'failed' ? '✗ Copy failed' : '🔗 Copy URL'}
                </button>

                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
                          title: 'My ShortsForgeAI video',
                          text: 'Check out this AI-generated video I just made.',
                          url: primaryVideoUrl,
                        })
                      } catch {
                        // user cancelled or share unsupported; non-fatal
                      }
                    }}
                    className="rounded-xl px-3.5 py-2.5 text-xs font-bold"
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

              <p className="text-xs mt-4 text-center" style={{ color: 'var(--muted)' }}>
                Tip: drop the video into CapCut or InVideo to add captions, voiceover, and effects.
              </p>
            </section>
          )}

          {phase === 'done' && !primaryVideoUrl && (
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
              🔄 Create another video
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
