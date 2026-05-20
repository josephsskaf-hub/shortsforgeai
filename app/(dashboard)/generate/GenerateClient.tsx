'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PricingCards from '@/components/PricingCards'
import OnboardingPanel from '@/components/OnboardingPanel'
import PostVideoPaywall from '@/components/PostVideoPaywall'

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

// Push #048 — Viral Intelligence block.
type HookRating = 'weak' | 'medium' | 'strong' | 'excellent'
interface ViralIntelligence {
  viralScore: number
  hookRating: HookRating
  retentionNotes: string[]
  thumbnailTexts: string[]
  openingCaption: string
  improvementSuggestions: string[]
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
  // Push #047 — pull through the rest of the brief so the done screen can
  // render a "ready-to-post" text package (caption + hashtags + CTA) the
  // user can copy straight into YouTube.
  hashtags: string[]
  youtubeDescription: string
  cta: string
  // Push #048 — viral intelligence panel shown in Step 2. Optional because
  // very old API responses might not carry the block; the UI gracefully
  // hides the panel when absent.
  viralIntelligence: ViralIntelligence | null
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

// Push #064 — durations bumped to 30 / 45 / 60 so the AI has enough room to
// build a real story arc (hook → setup → tension → payoff). 45s is the new
// default; 30s is the "quick" option, 60s is the "deep story" option.
type Duration = 30 | 45 | 60
// Push #084 — added 'fast' for the Pexels + TTS cheap pipeline (1 credit).
// Cinematic quality tiers (basic / basic_ai / pro) still flow through Runway.
type Quality = 'fast' | 'basic' | 'basic_ai' | 'pro'
type GenerationMode = 'fast' | 'cinematic'

const DURATION_OPTIONS: { value: Duration; label: string }[] = [
  { value: 30, label: '30s — Quick' },
  { value: 45, label: '45s — Recommended ⭐' },
  { value: 60, label: '60s — Deep Story' },
]

const POLL_GENERATING_MS = 4000
const POLL_COMPOSING_MS = 5000

// Push #095 — player resilience tuning.
//  PLAYER_INITIAL_WAIT_MS: how long to wait for the first byte/frame before
//   we assume the CDN stalled. Matches the user-visible spinner budget.
//  PLAYER_RETRY_BACKOFFS: delay before each successive retry. Sums with the
//   initial wait to ~38s total budget (8 + 2 + 4 + 8 + 16) before we give
//   up and show the friendly fallback. Backblaze B2's 503 storm during
//   propagation usually clears in <20s, so 4 retries is generous.
const PLAYER_INITIAL_WAIT_MS = 8000
const PLAYER_RETRY_BACKOFFS = [2000, 4000, 8000, 16000] as const

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

// Push #047 — staged pipeline copy shown during the long generate/compose
// phases. They rotate on a timer (purely cosmetic — real progress comes
// from the API state machine) so the wait feels intentional, not empty.
const LOADER_MESSAGES = [
  'Analyzing viral angle…',
  'Writing scroll-stopping hook…',
  'Building 35-second script…',
  'Creating cinematic scene prompts…',
  'Optimizing captions and hashtags…',
]

// Threshold at which we show the "Low credits" upsell line below the
// credits chip. With 1 credit = 1 Fast Mode video, this triggers when the
// user is down to their last handful of videos for the month.
const LOW_CREDITS_THRESHOLD = 5

// Push #048 — Visual History row shape returned by GET /api/videos.
interface RecentVideo {
  id: string
  title: string
  status: 'completed' | 'processing' | 'failed' | 'cancelled'
  video_url: string | null
  thumbnail_url: string | null
  duration: number | null
  platform: string
  created_at: string
}

// Push #048 — Trending Hooks. Static templates the user can drop into the
// prompt box (or just copy). Categories drive the colored tag on the chip.
// Push #101 — retuned for the Money Facts channel: money, mindset,
// investing topics plus a few history/facts hooks that already proved
// they convert.
const TRENDING_HOOKS: { text: string; category: string }[] = [
  { text: '10 money facts that will blow your mind', category: 'Money' },
  { text: 'Why billionaires wake up at 4am', category: 'Mindset' },
  { text: 'The dark side of credit cards no one talks about', category: 'Money' },
  { text: 'Why 90% of people will never be rich', category: 'Mindset' },
  { text: 'Hidden secrets of the Federal Reserve', category: 'Money' },
  { text: 'The most expensive mistake Warren Buffett ever made', category: 'Investing' },
  { text: 'Why you should never put money in a savings account', category: 'Money' },
  { text: 'The truth about passive income', category: 'Investing' },
  { text: 'How the Rothschild family built their empire', category: 'History' },
  { text: '5 countries where money does not exist', category: 'Facts' },
  { text: 'The Roman invention we still use today', category: 'History' },
  { text: 'What NASA discovered that they kept secret', category: 'Facts' },
]

const HOOK_CATEGORY_COLOR: Record<string, { fg: string; bg: string; border: string }> = {
  Money: { fg: '#34d399', bg: 'rgba(52,211,153,.10)', border: 'rgba(52,211,153,.30)' },
  Mindset: { fg: '#a78bfa', bg: 'rgba(167,139,250,.10)', border: 'rgba(167,139,250,.30)' },
  Investing: { fg: '#fbbf24', bg: 'rgba(251,191,36,.10)', border: 'rgba(251,191,36,.30)' },
  History: { fg: '#22D3EE', bg: 'rgba(34, 211, 238,.10)', border: 'rgba(34, 211, 238,.30)' },
  Facts: { fg: '#93c5fd', bg: 'rgba(147,197,253,.10)', border: 'rgba(147,197,253,.30)' },
  Mystery: { fg: '#22D3EE', bg: 'rgba(34, 211, 238,.10)', border: 'rgba(34, 211, 238,.30)' },
  Nature: { fg: '#34d399', bg: 'rgba(52,211,153,.10)', border: 'rgba(52,211,153,.30)' },
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
  const [taskStates, setTaskStates] = useState<Record<string, TaskState>>({})
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState<Duration>(45)
  const [quality, setQuality] = useState<Quality>('basic_ai')
  // Push #084 — Fast Mode (Pexels + TTS, 1 credit, ~30s) is the new default.
  // Cinematic Mode keeps the Runway path. Quality tiers above only apply to
  // Cinematic Mode; Fast Mode pins the effective quality to 'fast' on submit.
  const [mode, setMode] = useState<GenerationMode>('fast')
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [clipUrls, setClipUrls] = useState<string[]>([])
  const [renderId, setRenderId] = useState<string | null>(null)
  const [renderProgress, setRenderProgress] = useState<number>(0)
  const [generateProgress, setGenerateProgress] = useState<number>(0)
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null)

  // Push #045A — transient "Copied!" feedback on the Copy URL button in the
  // result section. Cleared automatically after ~2s.
  const [copied, setCopied] = useState(false)

  // Push #047 — conversion polish state.
  //   fromHome: did the prompt arrive from the homepage via sessionStorage?
  //     drives the "Your idea is already loaded" helper line.
  //   credits / creditsLoading: shown inline so the user never has to look
  //     at the sidebar to see what they have left. Same /api/credits source
  //     and `creditsChanged` event the sidebar uses, so the two stay in
  //     lockstep.
  //   loaderTick: 0..LOADER_MESSAGES.length-1, bumped on a timer while we
  //     are in the long-running generate/compose phases so the message
  //     rotates through the staged pipeline copy.
  //   copiedSection: which output-card copy button just flashed "Copied!"
  //     ('package' is the top-level one).
  const [fromHome, setFromHome] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(true)
  const [loaderTick, setLoaderTick] = useState(0)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)
  // Push #087 — user plan tier ('free' | 'basic' | 'pro'). Drives the
  // Cinematic-mode lock UI; null while we're loading the value.
  const [planTier, setPlanTier] = useState<'free' | 'basic' | 'pro' | null>(null)
  // Push #088 — cinematic tokens remaining this month. Pro = 1/month,
  // everyone else = 0. We render a separate "no tokens left, resets
  // monthly" state when the user IS pro but has spent their token.
  const [cinematicTokens, setCinematicTokens] = useState<number>(0)
  // Fast-mode-specific staged progress index (0..3). The real backend is
  // a single roundtrip; this drives a 4-step visual that auto-advances on
  // a timer so the wait feels intentional.
  const [fastStep, setFastStep] = useState<number>(0)

  // Push #098 — out-of-credits upgrade modal. Opened when the user clicks
  // any Generate/Analyze/Generate-Similar CTA while credits <= 0. Routes
  // through /api/stripe/checkout?tier=basic (GET redirect to Stripe).
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeLoading, setUpgradeLoading] = useState(false)

  // Push #109 — stronger urgency variant for free users who just used
  // their last credit. Countdown is persisted in localStorage so reloading
  // or closing/reopening the modal doesn't reset the timer.
  const [showUrgencyModal, setShowUrgencyModal] = useState(false)
  const [urgencyRemaining, setUrgencyRemaining] = useState<number>(600)
  const urgencyAutoShownRef = useRef(false)

  // Push #125 — exit-intent upgrade prompt. Fires once per session (ref
  // flag, no localStorage) when the cursor leaves the top of the viewport
  // and the user is NOT pro and has fewer than 10 credits left.
  const [showExitIntentUpgrade, setShowExitIntentUpgrade] = useState(false)
  const exitIntentShownRef = useRef(false)

  // Push #098 — welcome banner shown to brand-new users (credits >= 2 and
  // the `sf_welcomed` localStorage flag not yet set). Dismissed via the X
  // button, which writes the flag so we never show it again.
  const [showWelcome, setShowWelcome] = useState(false)

  // Push #098 — 4-step generation progress text shown below the spinner
  // while the pipeline is running. Auto-advances on a setInterval driven
  // by elapsed seconds since the phase entered the loading bucket.
  const [progressStep, setProgressStep] = useState<number>(0)

  // Push #048 — Visual History. List of the user's recent videos fetched
  // from /api/videos. Empty array = empty state; null only during initial
  // load. We never block the page on this — failures degrade to empty.
  const [recentVideos, setRecentVideos] = useState<RecentVideo[] | null>(null)
  // Push #048 — transient "Copied!" feedback on trending-hook chips.
  const [copiedHookIndex, setCopiedHookIndex] = useState<number | null>(null)

  // Push #095 — player resilience. When the B2/Creatomate CDN returns a 503
  // or hasn't propagated yet, the <video> element used to spin forever in
  // readyState 0. playerFailed flips true after the full retry budget is
  // spent so the UI can swap in a friendly fallback instead of an empty
  // spinner. The refs hold retry bookkeeping outside React state so timers
  // don't trigger re-renders mid-backoff.
  const [playerFailed, setPlayerFailed] = useState(false)

  // Idempotency flag for /api/compose/status — once we see `done` we tell the
  // server not to deduct credits again on subsequent polls.
  const deductedRef = useRef<boolean>(false)
  const composeStartedRef = useRef<boolean>(false)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const autoAnalyzeKeyRef = useRef<string | null>(null)
  // Push #095 — player retry bookkeeping. attempt counts how many retries
  // have fired (0..4); the two timer refs hold the in-flight setTimeout
  // handles so we can cancel them on canplay/cleanup.
  const playerRetryAttemptRef = useRef<number>(0)
  const playerWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playerRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  // Push #061 — fire a single page-view event on mount. Silently no-ops if
  // public.events isn't available in this Supabase project.
  useEffect(() => {
    trackEvent('generate_page_view')
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setFromHome(true)
      }
      sessionStorage.removeItem('pendingVideoPrompt')
    } catch {
      // sessionStorage can throw in some sandboxes — safe to ignore.
    }
    // Mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Push #047 — fetch the user's current credit balance directly on this
  // page so we can render a clear "X credits left" chip + low-credits
  // warning. Mirrors the sidebar's exact pattern (same endpoint, same
  // `creditsChanged` event), so the two stay perfectly in sync — when a
  // generation deducts credits, the sidebar dispatches the event and we
  // refresh here too.
  useEffect(() => {
    let cancelled = false
    async function fetchCredits() {
      setCreditsLoading(true)
      try {
        const res = await fetch('/api/credits', { cache: 'no-store' })
        if (res.status === 401) {
          if (!cancelled) setCredits(null)
          return
        }
        const data = await res.json()
        if (!cancelled) {
          setCredits(typeof data.credits === 'number' ? data.credits : 0)
        }
      } catch {
        if (!cancelled) setCredits(null)
      } finally {
        if (!cancelled) setCreditsLoading(false)
      }
    }
    fetchCredits()
    window.addEventListener('creditsChanged', fetchCredits)
    return () => {
      cancelled = true
      window.removeEventListener('creditsChanged', fetchCredits)
    }
  }, [])

  // Push #087 — fetch the user's plan tier so we can lock Cinematic mode
  // for Free + Basic users. The server enforces the gate too — this only
  // controls the UI affordance.
  // Push #088 — also fetches cinematic_tokens so the Cinematic card can
  // show "1 token left" vs. "0 tokens · resets monthly".
  useEffect(() => {
    let cancelled = false
    async function fetchPlan() {
      try {
        const res = await fetch('/api/me/plan', { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) {
            setPlanTier('free')
            setCinematicTokens(0)
          }
          return
        }
        const data = await res.json()
        if (cancelled) return
        const t = typeof data.plan === 'string' ? data.plan.toLowerCase() : 'free'
        setPlanTier(t === 'pro' || t === 'basic' || t === 'free' ? t : 'free')
        const tokens =
          typeof data.cinematic_tokens === 'number' ? data.cinematic_tokens : 0
        setCinematicTokens(Math.max(0, tokens))
      } catch {
        if (!cancelled) {
          setPlanTier('free')
          setCinematicTokens(0)
        }
      }
    }
    fetchPlan()
    window.addEventListener('creditsChanged', fetchPlan)
    return () => {
      cancelled = true
      window.removeEventListener('creditsChanged', fetchPlan)
    }
  }, [])

  // Push #087 — Force Fast Mode for non-Pro users. If the user had already
  // selected Cinematic before the plan loaded (or downgraded mid-session),
  // snap them back to Fast.
  // Push #088 — also snap Pro users back to Fast Mode when they have 0
  // cinematic tokens left, so the submit doesn't 403 after the user types
  // a prompt.
  useEffect(() => {
    if (mode !== 'cinematic') return
    if (planTier && planTier !== 'pro') {
      setMode('fast')
      return
    }
    if (planTier === 'pro' && cinematicTokens <= 0) {
      setMode('fast')
    }
  }, [planTier, mode, cinematicTokens])

  // Push #087 — Fast Mode 4-step staged progress. Auto-advances every
  // ~8s while Fast Mode is mid-generation so the long single roundtrip
  // feels like progress instead of a stalled spinner.
  useEffect(() => {
    if (mode !== 'fast') return
    const inFastLoading =
      phase === 'generating' || phase === 'clips_ready' || phase === 'composing'
    if (!inFastLoading) {
      setFastStep(0)
      return
    }
    const interval = setInterval(() => {
      setFastStep((s) => Math.min(3, s + 1))
    }, 8000)
    return () => clearInterval(interval)
  }, [mode, phase])

  // 5-step generation progress indicator. Time-based so it stays useful
  // even when the backend phase doesn't change for a while.
  //   0-6s   : Script
  //   6-14s  : Footage
  //   14-24s : Voiceover
  //   24-36s : Captions
  //   36s+   : Rendering
  useEffect(() => {
    const isGenerating =
      phase === 'generating' || phase === 'clips_ready' || phase === 'composing'
    if (!isGenerating) {
      setProgressStep(0)
      return
    }
    setProgressStep(0)
    const startedAt = Date.now()
    const interval = setInterval(() => {
      const elapsedSec = (Date.now() - startedAt) / 1000
      if (elapsedSec >= 36) setProgressStep(4)
      else if (elapsedSec >= 24) setProgressStep(3)
      else if (elapsedSec >= 14) setProgressStep(2)
      else if (elapsedSec >= 6) setProgressStep(1)
      else setProgressStep(0)
    }, 1000)
    return () => clearInterval(interval)
  }, [phase])

  // Push #098 — welcome banner gating. Only shown on first visit when the
  // user still has >=2 credits and hasn't dismissed it. localStorage write
  // happens in the dismiss handler so a refresh between mount and dismiss
  // re-shows the banner (intentional — they didn't acknowledge yet).
  useEffect(() => {
    if (credits === null || credits < 2) {
      setShowWelcome(false)
      return
    }
    try {
      const dismissed = localStorage.getItem('sf_welcomed')
      if (!dismissed) setShowWelcome(true)
    } catch {
      // localStorage can be denied (Safari private, etc.) — silent no-op.
    }
  }, [credits])

  // Push #048 — pull the user's recent videos for the Visual History
  // section. We listen on `creditsChanged` (fired after every successful
  // generation) so the list refreshes automatically when a new video
  // finishes. Defensive: failures degrade to empty state, never break the
  // page.
  useEffect(() => {
    let cancelled = false
    async function fetchVideos() {
      try {
        const res = await fetch('/api/videos', { cache: 'no-store' })
        if (res.status === 401) {
          if (!cancelled) setRecentVideos([])
          return
        }
        const data = await res.json()
        if (!cancelled) {
          setRecentVideos(Array.isArray(data.videos) ? data.videos : [])
        }
      } catch {
        if (!cancelled) setRecentVideos([])
      }
    }
    fetchVideos()
    window.addEventListener('creditsChanged', fetchVideos)
    return () => {
      cancelled = true
      window.removeEventListener('creditsChanged', fetchVideos)
    }
  }, [])

  // Push #047 — rotate the staged-pipeline message every ~2.4s while we're
  // in a long-running phase. This is purely cosmetic — the actual progress
  // bar still tracks real API state. We reset the tick to 0 whenever we
  // leave a loading phase so the next run starts at message 0.
  useEffect(() => {
    const inLoadingPhase =
      phase === 'generating' || phase === 'clips_ready' || phase === 'composing'
    if (!inLoadingPhase) {
      setLoaderTick(0)
      return
    }
    const interval = setInterval(() => {
      setLoaderTick((t) => t + 1)
    }, 2400)
    return () => clearInterval(interval)
  }, [phase])

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
        // Push #050 — pass duration + topic so the server can record them
        // in the videos history row when the render finishes.
        params.set('duration', String(duration))
        if (prompt.trim()) params.set('topic', prompt.trim().slice(0, 500))
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
          // Push #060 / #061 — fire-and-forget event tracking.
          trackEvent('generate_completed')
          trackEvent('video_generation_completed', { duration, quality })
          return
        }

        if (data.phase === 'failed') {
          setError(typeof data.error === 'string' ? data.error : GENERIC_ERROR)
          setPhase('failed')
          trackEvent('generate_failed')
          trackEvent('video_generation_failed', { duration, quality })
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
    // Push #050: prompt/duration deliberately not in deps — they're read at
    // poll fire-time via the closure and we don't want the poll loop to
    // restart if the user happens to mutate the textarea on a separate
    // mount (which can't actually happen mid-render but eslint can't tell).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, renderId, quality])

  async function handleAnalyze(overridePrompt?: string, opts?: { fromTopic?: boolean }) {
    const override = typeof overridePrompt === 'string' ? overridePrompt : undefined
    const source = (override ?? prompt).trim()
    if (!source) {
      setError('Please describe your video idea first.')
      return
    }
    // Push #060 / #061 — fire-and-forget event tracking. Endpoint silently
    // succeeds if public.events doesn't exist in this DB. We fire both the
    // legacy name (kept for /admin/metrics dashboards) and the new spec
    // name used by /admin/funnel.
    trackEvent('analyze_idea_clicked')
    trackEvent('generate_started')
    trackEvent('video_generation_started', { duration, quality })
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
        // Push #064 — pass duration so analyze-idea can size word count
        // and scene count to match the user's selection.
        body: JSON.stringify({ prompt: source, duration }),
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
      // Push #047 — derive a clean one-line CTA from the brief. analyze-idea
      // doesn't return a dedicated CTA field, so we use the last scene's
      // voiceover (almost always a "follow for…" line) and fall back to a
      // sane default. We trim aggressively so it fits a single card row.
      const scenes = Array.isArray(data.scenes) ? data.scenes : []
      const lastSceneVo =
        typeof scenes[scenes.length - 1]?.voiceover === 'string'
          ? (scenes[scenes.length - 1].voiceover as string).trim()
          : ''
      const cta = lastSceneVo || 'Follow for more shorts like this.'
      const hashtags = Array.isArray(data.hashtags)
        ? (data.hashtags as unknown[]).filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
        : []
      const youtubeDescription =
        typeof data.youtube_description === 'string' ? data.youtube_description : ''

      // Push #048 — viral intelligence block. Defensively coerce every
      // field so a malformed model response can't crash the panel; if the
      // block is missing entirely we set the field to null and the UI
      // hides the panel gracefully.
      let viralIntelligence: ViralIntelligence | null = null
      const viRaw = data.viral_intelligence
      if (viRaw && typeof viRaw === 'object') {
        const v = viRaw as Record<string, unknown>
        const scoreRaw = typeof v.viral_score === 'number' ? v.viral_score : 0
        const score = Math.max(0, Math.min(100, Math.round(scoreRaw)))
        const ratingStr = typeof v.hook_rating === 'string' ? v.hook_rating.toLowerCase() : ''
        const rating: HookRating =
          ratingStr === 'weak' || ratingStr === 'medium' || ratingStr === 'strong' || ratingStr === 'excellent'
            ? (ratingStr as HookRating)
            : score >= 85
            ? 'excellent'
            : score >= 70
            ? 'strong'
            : score >= 50
            ? 'medium'
            : 'weak'
        const asArr = (x: unknown): string[] =>
          Array.isArray(x) ? x.filter((s): s is string => typeof s === 'string' && s.trim().length > 0) : []
        viralIntelligence = {
          viralScore: score,
          hookRating: rating,
          retentionNotes: asArr(v.retention_notes),
          thumbnailTexts: asArr(v.thumbnail_texts).slice(0, 3),
          openingCaption: typeof v.opening_caption === 'string' ? v.opening_caption : '',
          improvementSuggestions: asArr(v.improvement_suggestions).slice(0, 3),
        }
      }

      setAnalysis({
        title: data.title ?? '',
        summary: data.summary ?? '',
        niche: data.niche ?? '',
        scenePlan: Array.isArray(data.scenePlan) ? data.scenePlan : [],
        hook: typeof data.hook === 'string' ? data.hook : '',
        voiceoverScript:
          typeof data.voiceover_script === 'string' ? data.voiceover_script : '',
        hashtags,
        youtubeDescription,
        cta,
        viralIntelligence,
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

    // Push #084 — Fast Mode skips Runway and resolves Pexels clips
    // synchronously, then jumps straight to the compose phase. Cinematic
    // Mode keeps the existing Runway path with its polling state machine.
    if (mode === 'fast') {
      try {
        const res = await fetch('/api/generate-video-fast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: trimmed, duration }),
        })
        const data = await res.json()
        if (res.status === 401) {
          router.push('/login?redirect=/generate')
          return
        }
        if (res.status === 402) {
          setError('Not enough credits. Fast Mode needs 1 credit.')
          setPhase('failed')
          return
        }
        if (!res.ok) {
          console.error('[generate] fast-mode error:', data?.error)
          setError(typeof data?.error === 'string' ? data.error : GENERIC_ERROR)
          setPhase('failed')
          return
        }
        // Quality is pinned to 'fast' so compose/status charges 1 credit.
        setQuality('fast')
        setGenerationId(typeof data.generationId === 'string' ? data.generationId : null)
        setScenes(Array.isArray(data.scenes) ? data.scenes : [])
        setClipUrls(Array.isArray(data.clip_urls) ? data.clip_urls : [])
        setGenerateProgress(100)
        setPhase('clips_ready')
      } catch (err: unknown) {
        console.error('[generate] fast-mode threw:', err)
        setError(GENERIC_ERROR)
        setPhase('failed')
      }
      return
    }

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

      // Push #087 — server-side cinematic gate. Snap UI back to Fast Mode
      // and surface an upgrade-aware error. Defense in depth: the client
      // already locks the Cinematic card for non-Pro users.
      // Push #088 — the server also returns 403 when a Pro user has 0
      // cinematic tokens left. Differentiate the two messages so the user
      // knows whether to upgrade or to wait for the monthly reset.
      if (res.status === 403) {
        setMode('fast')
        const isTokenExhausted = typeof data?.cinematic_tokens === 'number' && data.cinematic_tokens === 0
        if (isTokenExhausted) {
          setCinematicTokens(0)
          setError('You have used your Cinematic video this month. Switched to Fast Mode — use it freely until your next Pro renewal.')
        } else {
          setError('Cinematic mode requires the Pro plan. Switched to Fast Mode — try again, or upgrade at /pricing.')
        }
        setPhase('failed')
        return
      }

      if (!res.ok) {
        console.error('[generate] generate-video error:', data?.error)
        setError(typeof data?.error === 'string' ? data.error : GENERIC_ERROR)
        setPhase('failed')
        return
      }

      // Push #088 — server has just consumed the token. Mirror that
      // optimistically on the client so the badge / lock state flips
      // immediately. A refetch happens on the next `creditsChanged`
      // event after the render completes.
      setCinematicTokens((prev) => Math.max(0, prev - 1))

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

  // Push #047 — copy any section of the output package to the clipboard,
  // flashing a transient "✓ Copied" state on the matching button. Used by
  // the per-card copy buttons and the top-level "Copy Full Short Package"
  // button.
  async function copySection(key: string, text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    try {
      await navigator.clipboard.writeText(trimmed)
      setCopiedSection(key)
      setTimeout(() => setCopiedSection((c) => (c === key ? null : c)), 1800)
    } catch {
      // Clipboard can be denied in some browsers — silent no-op.
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
    // Push #047 — "Start over" clears the prompt + the homepage breadcrumb
    // so the next run feels like a fresh start. We do NOT clear credits
    // state — that's owned by the /api/credits effect.
    setPrompt('')
    setFromHome(false)
  }

  function handleBackToEdit() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    setPhase('idle')
    setError(null)
  }

  // Push #098 — out-of-credits guard. Wraps every Generate/Analyze/
  // Generate-Similar entry point so a click with credits<=0 opens the
  // upgrade modal instead of either silently failing or hitting the API
  // for a 402. We still allow Cinematic-with-tokens through (Pro users
  // can have 0 credits but a remaining cinematic token).
  function outOfCredits(): boolean {
    if (credits === null) return false
    if (credits > 0) return false
    if (mode === 'cinematic' && cinematicTokens > 0) return false
    return true
  }

  // Push #109 — free users at 0 credits get the urgency modal (with the
  // 10-min countdown); everyone else keeps the standard out-of-credits
  // modal.
  function openOutOfCreditsModal() {
    if (planTier === 'free') {
      setShowUrgencyModal(true)
    } else {
      setShowUpgradeModal(true)
    }
  }

  function handleAnalyzeGuarded() {
    if (outOfCredits()) {
      openOutOfCreditsModal()
      return
    }
    handleAnalyze()
  }

  function handleGenerateGuarded() {
    if (outOfCredits()) {
      openOutOfCreditsModal()
      return
    }
    handleGenerate()
  }

  // Push #113 — explicit currency selection. Auto-detection (browser
  // locale in #111, then Vercel-IP-country in #112) wasn't reliable
  // through VPNs and a few browser configs. The UI now exposes a BRL
  // button on each upgrade surface and passes the currency in directly,
  // so the path is always user-driven.
  async function handleUpgradeNow(
    tier: 'basic' | 'pro' = 'basic',
    currency: 'usd' | 'brl' = 'usd',
  ) {
    setUpgradeLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, currency }),
      })
      const data = await res.json().catch(() => null)
      if (data?.url) {
        window.location.href = data.url
        return
      }
      // Fallback — server returned an error, just send the user to /pricing
      // so the upgrade intent isn't lost.
      router.push('/pricing')
    } catch {
      router.push('/pricing')
    } finally {
      setUpgradeLoading(false)
    }
  }

  // Push #109 — auto-open the urgency modal exactly once when a free user
  // finishes a generation that drained their last credit. The ref keeps it
  // from re-firing on every re-render; the localStorage key (read in the
  // tick effect below) makes the countdown survive page reloads.
  useEffect(() => {
    if (urgencyAutoShownRef.current) return
    if (phase !== 'done') return
    if (planTier !== 'free') return
    if (credits === null || credits > 0) return
    urgencyAutoShownRef.current = true
    setShowUrgencyModal(true)
  }, [phase, planTier, credits])

  // Push #109 — countdown tick while the urgency modal is open. The start
  // timestamp is persisted to localStorage so dismissing + reopening (or
  // hitting the retry guards below) doesn't reset the scarcity clock.
  useEffect(() => {
    if (!showUrgencyModal) return
    const URGENCY_START_KEY = 'sf_urgency_start'
    const DURATION = 600
    let start = Date.now()
    try {
      const stored = parseInt(localStorage.getItem(URGENCY_START_KEY) ?? '', 10)
      if (Number.isFinite(stored) && stored > 0) {
        start = stored
      } else {
        localStorage.setItem(URGENCY_START_KEY, String(start))
      }
    } catch {
      // private mode or quota — fall back to in-memory start
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - start) / 1000)
      setUrgencyRemaining(Math.max(0, DURATION - elapsed))
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [showUrgencyModal])

  // Push #125 — exit-intent upgrade prompt. Listens for the cursor leaving
  // the top of the viewport (the "about to close the tab" signal). Fires
  // only once per session (exitIntentShownRef), only for non-pro users with
  // fewer than 10 credits. Uses a ref — not localStorage — so the flag
  // resets on every fresh page load / new session.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (planTier === 'pro') return
    if (credits !== null && credits >= 10) return

    function handleMouseLeave(e: MouseEvent) {
      if (e.clientY > 0) return
      if (exitIntentShownRef.current) return
      exitIntentShownRef.current = true
      setShowExitIntentUpgrade(true)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }

    document.addEventListener('mouseleave', handleMouseLeave)
    return () => document.removeEventListener('mouseleave', handleMouseLeave)
  }, [planTier, credits])

  function dismissWelcome() {
    setShowWelcome(false)
    try {
      localStorage.setItem('sf_welcomed', '1')
    } catch {
      // ignore
    }
  }

  // Push #095 — reset the failure flag whenever a new finalVideoUrl arrives
  // (or it's cleared by Back / Start over). Without this, a previous run
  // that hit the failure UI would carry the flag forward and immediately
  // show the fallback for the next, perfectly fine, video.
  useEffect(() => {
    setPlayerFailed(false)
    playerRetryAttemptRef.current = 0
  }, [finalVideoUrl])

  // Push #095 — robust player startup with retry + backoff.
  //
  //   Symptom we are fixing: when Creatomate's Backblaze B2 CDN hasn't
  //   propagated the freshly composed MP4 yet, the CDN returns 503 (or
  //   just stalls). Per Push #094 the player loads the file directly from
  //   the CDN (no Node.js proxy), so we need to handle those CDN-side
  //   hiccups in the browser instead of upstream. Without that, the
  //   <video> element gets stuck at readyState 0 and spins indefinitely
  //   with zero feedback to the user.
  //
  //   Strategy:
  //     1. Start an 8s wait timer. If we haven't reached readyState >= 2 by
  //        then, kick off the retry chain.
  //     2. Retry chain: up to 4 retries, with delays 2s, 4s, 8s, 16s
  //        between them. Each retry rewrites el.src with a cache-busting
  //        suffix and calls .load() + .play().
  //     3. If the <video> emits an `error` event, jump straight into the
  //        retry chain instead of waiting out the 8s timer.
  //     4. canplay / loadeddata / playing all mean "we're good" — clear
  //        every timer and reset bookkeeping.
  //     5. After the final retry's backoff elapses without success, flip
  //        playerFailed so the UI swaps to the fallback message.
  useEffect(() => {
    if (phase !== 'done' || !finalVideoUrl || playerFailed) return
    const el = videoRef.current
    if (!el) return

    // Pick the right query separator so cache-busting works whether the
    // CDN URL already carries a query string or not.
    const cacheBustJoin = finalVideoUrl.includes('?') ? '&' : '?'

    const clearTimers = () => {
      if (playerWaitTimerRef.current) {
        clearTimeout(playerWaitTimerRef.current)
        playerWaitTimerRef.current = null
      }
      if (playerRetryTimerRef.current) {
        clearTimeout(playerRetryTimerRef.current)
        playerRetryTimerRef.current = null
      }
    }

    const scheduleNextRetry = () => {
      if (playerRetryTimerRef.current) return // already scheduled
      const attempt = playerRetryAttemptRef.current
      if (attempt >= PLAYER_RETRY_BACKOFFS.length) {
        clearTimers()
        setPlayerFailed(true)
        return
      }
      const delay = PLAYER_RETRY_BACKOFFS[attempt]
      playerRetryAttemptRef.current = attempt + 1
      playerRetryTimerRef.current = setTimeout(() => {
        playerRetryTimerRef.current = null
        const v = videoRef.current
        if (!v) return
        // Cache-bust on every retry so the browser (and any intermediate
        // cache) actually re-fetches instead of replaying the prior 503.
        v.src = `${finalVideoUrl}${cacheBustJoin}_r=${playerRetryAttemptRef.current}`
        try { v.load() } catch { /* noop */ }
        v.play().catch(() => {})
        scheduleNextRetry()
      }, delay)
    }

    const scheduleInitialWait = () => {
      if (playerWaitTimerRef.current) clearTimeout(playerWaitTimerRef.current)
      playerWaitTimerRef.current = setTimeout(() => {
        playerWaitTimerRef.current = null
        const v = videoRef.current
        if (!v) return
        if (v.readyState < 2 && playerRetryAttemptRef.current === 0) {
          scheduleNextRetry()
        }
      }, PLAYER_INITIAL_WAIT_MS)
    }

    const onWaiting = () => {
      // Only re-arm the initial wait timer while we haven't started retries
      // yet; once retries are in-flight, scheduleNextRetry drives the loop.
      if (
        el.readyState < 2 &&
        playerRetryAttemptRef.current === 0 &&
        !playerWaitTimerRef.current &&
        !playerRetryTimerRef.current
      ) {
        scheduleInitialWait()
      }
    }
    const onError = () => {
      if (playerWaitTimerRef.current) {
        clearTimeout(playerWaitTimerRef.current)
        playerWaitTimerRef.current = null
      }
      scheduleNextRetry()
    }
    const onLoaded = () => {
      clearTimers()
      playerRetryAttemptRef.current = 0
    }

    el.addEventListener('waiting', onWaiting)
    el.addEventListener('stalled', onWaiting)
    el.addEventListener('error', onError)
    el.addEventListener('canplay', onLoaded)
    el.addEventListener('loadeddata', onLoaded)
    el.addEventListener('playing', onLoaded)

    el.play().catch(() => {})
    scheduleInitialWait()

    return () => {
      clearTimers()
      el.removeEventListener('waiting', onWaiting)
      el.removeEventListener('stalled', onWaiting)
      el.removeEventListener('error', onError)
      el.removeEventListener('canplay', onLoaded)
      el.removeEventListener('loadeddata', onLoaded)
      el.removeEventListener('playing', onLoaded)
    }
  }, [phase, finalVideoUrl, playerFailed])


  // Push #084 — Fast Mode is a flat 1 credit; Cinematic Mode uses the
  // per-quality cost from QUALITY_OPTIONS.
  const selectedCost = mode === 'fast'
    ? 1
    : (QUALITY_OPTIONS.find((q) => q.key === quality)?.credits ?? 15)
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
        return 'Creating cinematic visuals…'
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

      {/* Push #103 — sticky low-credits upgrade banner. Sits above every
          other piece of the page so a free user who's about to be locked
          out sees the upgrade offer. Hits the existing
          /api/stripe/checkout flow via handleUpgradeNow. */}
      {planTier === 'free' && credits !== null && credits <= 1 && (
        <div
          style={{
            background: 'linear-gradient(90deg, rgba(251,191,36,.12), rgba(245,158,11,.08))',
            border: '1px solid rgba(251,191,36,.3)',
            borderRadius: 12,
            padding: '10px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: '#fbbf24', fontWeight: 700, fontSize: 13 }}>
            ⚠️ {credits === 0 ? "You're out of credits" : '1 credit left'} — upgrade to keep creating
          </span>
          <button
            type="button"
            onClick={() => handleUpgradeNow()}
            disabled={upgradeLoading}
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              border: 'none',
              borderRadius: 8,
              padding: '6px 16px',
              color: '#000',
              fontWeight: 800,
              fontSize: 12,
              cursor: upgradeLoading ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
              opacity: upgradeLoading ? 0.7 : 1,
            }}
          >
            {upgradeLoading ? 'Loading…' : 'Upgrade — 50% Off →'}
          </button>
        </div>
      )}

      {/* Header — push #047 conversion polish.
          Step 1 uses the "Build Your Viral Short" headline + a credits chip
          on the right. Later phases keep a tighter header so the screen
          stays focused on the active generation. */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded"
                style={{
                  background: 'rgba(59, 130, 246,.10)',
                  border: '1px solid rgba(59, 130, 246,.35)',
                  color: '#3B82F6',
                }}
              >
                {showStep1 ? 'Step 1 — Your Idea' : showStep2 ? 'Step 2 — Creative Brief' : 'Step 3 — Generate'}
              </span>
            </div>
            <h1 className="font-black text-2xl sm:text-3xl mb-1" style={{ color: 'var(--text)' }}>
              {showStep1 ? 'Create Your Short ⚡' : '🎬 Generate a Real AI Short'}
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted2)' }}>
              {showStep1 && 'Type any topic → AI writes, voices & edits your Short in ~60 seconds'}
              {showStep2 && 'Pick duration and quality, then generate.'}
              {showRender && 'Rendering your vertical 9:16 Short.'}
            </p>
          </div>
          <CreditsChip credits={credits} loading={creditsLoading} />
        </div>
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

      {/* Push #098 — first-visit welcome banner. Only shown on Step 1 and
          only when credits >= 2 AND the sf_welcomed localStorage flag is
          unset. Dismissing writes the flag so it never shows again. */}
      {showStep1 && showWelcome && (
        <WelcomeBanner onDismiss={dismissWelcome} />
      )}

      {/* Push #098 — out-of-credits upgrade modal. Opened by any Generate /
          Analyze / Generate-Similar click when credits <= 0. */}
      {showUpgradeModal && (
        <UpgradeModal
          loading={upgradeLoading}
          onUpgrade={() => handleUpgradeNow('basic', 'usd')}
          onUpgradeBrl={() => handleUpgradeNow('basic', 'brl')}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}

      {/* Push #109 — urgency variant with countdown for free users at 0. */}
      {showUrgencyModal && (
        <UrgencyModal
          remaining={urgencyRemaining}
          loading={upgradeLoading}
          onUpgrade={() => handleUpgradeNow('basic', 'usd')}
          onUpgradeBrl={() => handleUpgradeNow('basic', 'brl')}
          onClose={() => setShowUrgencyModal(false)}
        />
      )}

      {/* Push #125 — exit-intent upgrade prompt. Shown once per session
          when the cursor leaves the top of the viewport for non-pro users
          with fewer than 10 credits. Dismiss with X or clicking backdrop. */}
      {showExitIntentUpgrade && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Upgrade to Pro"
          onClick={() => setShowExitIntentUpgrade(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: 440,
              width: '100%',
              borderRadius: 20,
              background: 'linear-gradient(145deg, #0D1830 0%, #0B1120 100%)',
              border: '1px solid rgba(59,130,246,0.4)',
              boxShadow: '0 24px 64px rgba(0,0,0,.6), 0 0 40px rgba(59,130,246,.15)',
              padding: '32px 28px 28px',
              textAlign: 'center',
            }}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowExitIntentUpgrade(false)}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: 12,
                right: 14,
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                fontSize: 22,
                lineHeight: 1,
                cursor: 'pointer',
                padding: 4,
              }}
            >
              ×
            </button>

            <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>⚡</div>
            <h2 style={{
              fontSize: '1.25rem',
              fontWeight: 900,
              color: '#F1F5F9',
              marginBottom: 8,
              lineHeight: 1.25,
            }}>
              Wait — before you go!
            </h2>
            <p style={{
              fontSize: '0.9rem',
              color: '#94A3B8',
              marginBottom: 22,
              lineHeight: 1.55,
            }}>
              Upgrade to Pro and never run out of credits.
              Get <strong style={{ color: '#22D3EE' }}>100 videos/month</strong> + Cinematic Mode
              and keep your channel growing on autopilot.
            </p>
            <a
              href="/api/stripe/checkout?tier=pro"
              style={{
                display: 'block',
                width: '100%',
                padding: '14px 20px',
                borderRadius: 12,
                background: 'linear-gradient(90deg, #2563EB, #06B6D4)',
                color: '#fff',
                fontWeight: 900,
                fontSize: '0.95rem',
                textDecoration: 'none',
                boxShadow: '0 8px 24px rgba(37,99,235,.4)',
                marginBottom: 10,
              }}
            >
              Upgrade to Pro — $19.90/mo →
            </a>
            <button
              type="button"
              onClick={() => setShowExitIntentUpgrade(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748B',
                fontSize: '0.8rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              No thanks, I&apos;ll stay on the free plan
            </button>
          </div>
        </div>
      )}

      {/* Push #060 — first-user onboarding panel. Only renders when the
          user has zero rows in public.videos (recentVideos === []) and
          the dismissed flag is unset in localStorage. We don't show it
          while loading (recentVideos === null) so it doesn't flash. */}
      {showStep1 && recentVideos !== null && recentVideos.length === 0 && (
        <OnboardingPanel
          hasNoVideos
          onFillPrompt={(p) => {
            setPrompt(p)
            if (fromHome) setFromHome(false)
          }}
        />
      )}

      {/* ── STEP 1: Idea ── */}
      {showStep1 && (
        <section
          className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
          style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
        >
          {/* Push #047 — only show the "already loaded" helper line when the
              prompt arrived from the homepage's sessionStorage bridge. The
              line clears once the user edits the prompt themselves (the
              textarea's onChange below also flips fromHome off). */}
          {fromHome && prompt.trim() && (
            <div
              className="rounded-lg px-3 py-2 mb-3 flex items-center gap-2 text-xs font-bold"
              style={{
                background: 'rgba(52,211,153,.08)',
                border: '1px solid rgba(52,211,153,.28)',
                color: '#34d399',
              }}
            >
              <span aria-hidden="true">✓</span>
              <span>Your idea is already loaded. Click generate to create your short.</span>
            </div>
          )}
          <label
            className="block text-xs font-black uppercase tracking-widest mb-2"
            style={{ color: 'var(--muted)' }}
          >
            Your idea or script
          </label>
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value)
              // Once the user edits the field themselves, the "already loaded"
              // helper line no longer makes sense — clear the breadcrumb.
              if (fromHome) setFromHome(false)
            }}
            placeholder="Drop your topic — we'll turn it into an addictive micro-knowledge Short with real facts, escalation, and a satisfying payoff."
            maxLength={5000}
            disabled={phase === 'analyzing'}
            aria-label="Your idea or script"
            // Push #052 — Tailwind responsive min-h so the textarea stays
            // ~220px (≈8 lines) on phones, then expands back to 400px on
            // sm+ viewports. Keeps the Generate button above the fold on
            // iPhone heights without changing desktop density.
            className="w-full rounded-xl px-4 py-4 text-sm leading-relaxed min-h-[220px] sm:min-h-[400px]"
            style={{
              width: '100%',
              maxWidth: '830px',
              background: 'rgba(0,0,0,.3)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              outline: 'none',
              resize: 'none',
            }}
          />
          {/* UX #2 — char counter + soft warning when the user is near the
              5,000-char cap. The cap is generous, but having a live counter
              prevents the silent truncation surprise. */}
          <div
            className="mt-2 flex items-center justify-end gap-2 text-xs"
            style={{
              fontVariantNumeric: 'tabular-nums',
              color: prompt.length >= 4800 ? '#fbbf24' : 'var(--muted)',
              fontWeight: 700,
              maxWidth: '830px',
            }}
            aria-live="polite"
          >
            {prompt.length}/5,000 characters
          </div>

          {/* Push #084 — Generation mode selector.
              Push #087 — Cinematic Mode is gated to Pro users; Free + Basic
              see a non-interactive locked card with an upgrade CTA. The
              server enforces the same gate (/api/generate-video returns 403
              for non-Pro callers). */}
          <ModeSelector
            mode={mode}
            setMode={setMode}
            isPro={planTier === 'pro'}
            cinematicTokens={cinematicTokens}
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
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDuration(opt.value)}
                  className="rounded-full px-4 py-1.5 text-sm font-bold"
                  style={{
                    background: duration === opt.value ? '#3B82F6' : 'rgba(255,255,255,.04)',
                    border: duration === opt.value ? '1px solid rgba(59, 130, 246,.65)' : '1px solid var(--border)',
                    color: duration === opt.value ? '#FFFFFF' : 'var(--muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
              Longer videos give the AI more room to build a complete story.
            </p>
          </div>

          {/* Push #084 — Media & quality only applies to Cinematic Mode.
              Push #087 — also requires Pro plan; if a Free/Basic user
              somehow lands here (state already snaps mode to 'fast' in an
              effect) we still hide the cards. Fast Mode runs Pexels + TTS
              at a fixed 1-credit cost. */}
          {mode === 'cinematic' && planTier === 'pro' && (
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
                      background: selected ? 'rgba(59, 130, 246,.10)' : 'rgba(255,255,255,.03)',
                      border: selected ? '1px solid rgba(59, 130, 246,.55)' : '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      boxShadow: selected ? '0 0 22px rgba(59, 130, 246,.15)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span>{q.icon}</span>
                      <span
                        className="text-sm font-black"
                        style={{ color: selected ? '#3B82F6' : 'var(--text)' }}
                      >
                        {q.title}
                      </span>
                      <span
                        className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: 'rgba(59, 130, 246,.14)',
                          color: '#3B82F6',
                          border: '1px solid rgba(59, 130, 246,.3)',
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
          )}

          <div className="flex items-center justify-between mt-5 gap-3 flex-wrap">
            <div>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {mode === 'fast'
                  ? `⚡ ${selectedCost} credit • Fast Mode • ready in ~60 seconds.`
                  : `🎬 1 Cinematic token • Runway AI • 5-10 min render (Pro plan).`}
              </p>
              {/* Push #087 — credit-balance awareness right under the CTA.
                  Three states: low (<5), empty (=0), and silent (healthy). */}
              {credits !== null && (credits === 0 && !(mode === 'cinematic' && cinematicTokens > 0)) && (
                <p className="text-xs mt-1" style={{ color: '#f87171', fontWeight: 700 }}>
                  No credits left. <a href="/pricing" style={{ color: '#f87171', textDecoration: 'underline' }}>Get more →</a>
                </p>
              )}
              {credits !== null && credits > 0 && credits < 5 && (
                <p className="text-xs mt-1" style={{ color: '#fbbf24', fontWeight: 700 }}>
                  ⚠ Low credits — {credits} remaining. <a href="/pricing" style={{ color: '#fbbf24', textDecoration: 'underline' }}>Top up →</a>
                </p>
              )}
            </div>
            {/* Push #117 — primary CTA goes full-width on mobile and
                bumps to a 52 px tap height. Desktop keeps the compact
                pill via sm: utilities. */}
            <button
              onClick={handleAnalyzeGuarded}
              disabled={phase === 'analyzing' || !prompt.trim()}
              className="rounded-xl px-6 py-3.5 sm:py-2.5 text-base sm:text-sm font-black flex items-center justify-center gap-2 w-full sm:w-auto"
              style={{
                background:
                  phase === 'analyzing' || !prompt.trim()
                    ? 'rgba(255,255,255,.04)'
                    : '#3B82F6',
                border: 'none',
                cursor: phase === 'analyzing' || !prompt.trim() ? 'not-allowed' : 'pointer',
                color: phase === 'analyzing' || !prompt.trim() ? 'var(--muted)' : '#FFFFFF',
                boxShadow:
                  phase === 'analyzing' || !prompt.trim()
                    ? 'none'
                    : '0 8px 28px rgba(59, 130, 246,.35)',
                minHeight: 52,
              }}
            >
              {phase === 'analyzing' ? (
                <>
                  <Spinner />
                  Analyzing…
                </>
              ) : (
                'Generate Short'
              )}
            </button>
          </div>
        </section>
      )}

      {/* Push #048 — Trending Hooks. Compact chip strip below the input.
          "Use Hook" inserts the template into the prompt (without auto-
          submitting), "Copy" puts it on the clipboard. Only shown on Step 1
          so we don't clutter the brief / loading screens. */}
      {showStep1 && (
        <TrendingHooksSection
          onUse={(text) => {
            setPrompt(text)
            if (fromHome) setFromHome(false)
          }}
          copiedIndex={copiedHookIndex}
          onCopy={async (text, idx) => {
            try {
              await navigator.clipboard.writeText(text)
              setCopiedHookIndex(idx)
              setTimeout(() => setCopiedHookIndex((c) => (c === idx ? null : c)), 1800)
            } catch {
              // Clipboard can be denied — silent no-op.
            }
          }}
        />
      )}

      {/* Push #048 — Visual History. Six most recent videos for this user,
          read-only. Empty state when the list has 0 rows (which is the
          default on a fresh account or before the first successful
          generation persists to the videos table). */}
      {showStep1 && <RecentVideosSection videos={recentVideos} />}

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

          {/* Push #048 — Viral Intelligence panel. Score, hook rating,
              retention notes, thumbnail text suggestions and an opening
              caption. Renders only when the brief actually carries the
              block so old API responses still flow through cleanly. */}
          {analysis.viralIntelligence && (
            <ViralIntelligencePanel vi={analysis.viralIntelligence} />
          )}

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
                {mode === 'fast'
                  ? `⚡ Fast Mode · ${duration}s · YouTube Shorts (9:16)`
                  : `🎬 Cinematic Mode · ${duration}s · ${QUALITY_OPTIONS.find((q) => q.key === quality)?.title} · YouTube Shorts (9:16)`}
              </div>
              <button
                onClick={handleGenerateGuarded}
                className="rounded-xl px-6 py-3 text-sm font-black flex items-center gap-2"
                style={{
                  background: '#3B82F6',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 8px 28px rgba(59, 130, 246,.35)',
                }}
              >
                {mode === 'cinematic'
                  ? 'Generate • 1 Cinematic token'
                  : `Generate • ${selectedCost} credit${selectedCost === 1 ? '' : 's'}`}
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
              {/* Push #047 — staged-pipeline message. The rotating copy lives
                  in `LOADER_MESSAGES` and is driven by `loaderTick`; the
                  small grey caption underneath keeps the truthful API
                  status so power users still see what's actually happening. */}
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="font-black text-base flex items-center gap-2" style={{ color: 'var(--text)' }}>
                  <Spinner />
                  <span style={{ minWidth: 0 }}>
                    {LOADER_MESSAGES[loaderTick % LOADER_MESSAGES.length]}
                  </span>
                </div>
                <div className="text-xs font-bold" style={{ color: 'var(--muted)' }}>
                  {headlineProgress}%
                </div>
              </div>
              <div className="text-xs mt-1 mb-1" style={{ color: 'var(--muted2)' }}>
                {statusMessage}
              </div>

              {/* Animated 5-step pipeline + overall progress bar. */}
              <AnimatedPipelineProgress
                step={progressStep}
                percent={headlineProgress}
                phase={phase}
              />

              <div
                className="rounded-xl px-3 py-2 mt-4 text-xs"
                style={{
                  background: 'rgba(59, 130, 246,.06)',
                  border: '1px solid rgba(59, 130, 246,.20)',
                  color: 'var(--muted2)',
                  lineHeight: 1.55,
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span aria-hidden="true">⚡</span>
                  <span className="font-bold" style={{ color: '#93c5fd' }}>
                    AI Video Engine — automated video pipeline
                  </span>
                </div>
                <div>
                  Your video is generated in stages. Credits are charged only when the final video is successfully created.
                </div>
                <div className="mt-1">Safe to keep this tab open while rendering.</div>
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
                {/* Push #065 — show the generated title so the user can see
                    what the AI named the video. Falls back to a generic
                    label so the row never disappears. Clamped to two lines
                    so a long title can't push the player below the fold. */}
                <p
                  className="font-semibold text-base sm:text-lg mt-3 mx-auto"
                  style={{
                    color: '#fff',
                    maxWidth: 'min(460px, 90vw)',
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {analysis?.title?.trim() || 'Untitled Video'}
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
                {/* Push #094 — load the MP4 directly from the CDN. The old
                    proxy path buffered the entire ~28MB body through a
                    Node.js serverless function and timed out before the
                    <video> element ever saw the first byte. Without
                    crossOrigin="anonymous" the browser does not enforce
                    CORS on media playback, so the direct cross-origin
                    src= works on Backblaze and Creatomate alike.

                    Push #095 — Backblaze still returns 503 while the new
                    MP4 propagates, so we wrap the player in a retry chain
                    (see useEffect above). When the full retry budget is
                    spent, playerFailed flips and we swap the <video> for
                    a Portuguese fallback with a reload button so the user
                    never stares at an empty spinner. */}
                {playerFailed ? (
                  <div
                    role="status"
                    aria-live="polite"
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '24px',
                      textAlign: 'center',
                      background: '#0b0b1a',
                      color: 'var(--text)',
                      gap: '14px',
                    }}
                  >
                    <div style={{ fontSize: '38px', lineHeight: 1 }} aria-hidden>⏳</div>
                    <p
                      style={{
                        color: '#fff',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        lineHeight: 1.45,
                        maxWidth: '320px',
                        margin: 0,
                      }}
                    >
                      Vídeo ainda processando. Aguarde alguns instantes e atualize a página.
                    </p>
                    <button
                      type="button"
                      onClick={() => { if (typeof window !== 'undefined') window.location.reload() }}
                      style={{
                        marginTop: '4px',
                        background: 'linear-gradient(135deg, #2563EB, #1d4ed8)',
                        border: 'none',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        padding: '10px 22px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        boxShadow: '0 6px 22px rgba(37,99,235,.32)',
                      }}
                    >
                      Atualizar
                    </button>
                  </div>
                ) : (
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
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
                <a
                  href={finalVideoUrl}
                  download={`shortsforgeai-${duration}s.mp4`}
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
                <a
                  href={finalVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl px-5 py-2.5 text-sm font-bold"
                  style={{
                    background: 'rgba(255,255,255,.05)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    textDecoration: 'none',
                    cursor: 'pointer',
                  }}
                >
                  ▶ Open in New Tab
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
                {/* Push #101 — one-click X intent for organic distribution.
                    Opens in a new tab with prefilled copy + hashtags. */}
                <a
                  href={`https://twitter.com/intent/tweet?text=Just created this YouTube Short with AI in 60 seconds! 🤯 Try it free at shortsforgeai.com %23YouTubeShorts %23AIVideo`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl px-5 py-2.5 text-sm font-bold"
                  style={{
                    background: 'rgba(255,255,255,.05)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    textDecoration: 'none',
                    cursor: 'pointer',
                  }}
                >
                  𝕏 Share on X
                </a>
              </div>

              {/* Push #099 — Post-generation upgrade upsell. Shows under the
                  download/share row for free users only (planTier === 'free'
                  AND credits < 40, so users who already upgraded don't get
                  re-pitched). Uses the same /api/stripe/checkout flow as the
                  out-of-credits modal so attribution stays consistent. */}
              {planTier === 'free' && credits !== null && credits < 40 && (
                <div
                  className="rounded-2xl px-5 py-5 mt-6 w-full"
                  style={{
                    maxWidth: 480,
                    background:
                      'linear-gradient(135deg, rgba(34,197,94,.10), rgba(16,185,129,.06))',
                    border: '1px solid rgba(34,197,94,.45)',
                    boxShadow:
                      '0 0 28px rgba(34,197,94,.16), inset 0 1px 0 rgba(255,255,255,.04)',
                  }}
                >
                  <div className="text-center">
                    <div
                      className="text-[11px] font-black uppercase tracking-[.16em] mb-1.5"
                      style={{ color: '#34d399' }}
                    >
                      🚀 Loved your Short? Make more.
                    </div>
                    <p
                      className="text-xs font-semibold"
                      style={{ color: 'var(--muted2)', lineHeight: 1.5 }}
                    >
                      50 videos/month · HD quality · Fast delivery
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpgradeNow()}
                    disabled={upgradeLoading}
                    className="block w-full rounded-xl mt-4 py-3 text-sm font-black text-center text-white"
                    style={{
                      background: upgradeLoading
                        ? 'rgba(34,197,94,.6)'
                        : 'linear-gradient(135deg, #22C55E, #16A34A)',
                      border: 'none',
                      cursor: upgradeLoading ? 'wait' : 'pointer',
                      boxShadow: '0 8px 24px rgba(34,197,94,.32)',
                    }}
                  >
                    {upgradeLoading ? 'Loading…' : 'Upgrade to Basic — $9.90/mo →'}
                  </button>
                </div>
              )}

              {/* Push #102 — Referral share nudge. Sits in the done state for
                  every user (free + paid) so the viral loop runs on the same
                  audience the upgrade upsell already qualified. */}
              <div
                className="rounded-2xl p-5 mt-4 text-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(16,185,129,.08), rgba(5,150,105,.05))',
                  border: '1px solid rgba(16,185,129,.25)',
                }}
              >
                <p className="text-sm font-bold mb-1" style={{ color: '#34d399' }}>
                  🎁 Know a creator? Send them this
                </p>
                <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                  Share ShortsForgeAI — they get 2 free videos, you help grow the community
                </p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <a
                    href="https://twitter.com/intent/tweet?text=I just made a YouTube Short with AI in 60 seconds! 🤯 No editing, no script — just type a topic. Try it free 👇 https://shortsforgeai.com %23YouTubeShorts %23AITools"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg px-4 py-2 text-xs font-bold"
                    style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', color: 'var(--text)', textDecoration: 'none' }}
                  >
                    𝕏 Tweet it
                  </a>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText('https://shortsforgeai.com').catch(() => {}) }}
                    className="rounded-lg px-4 py-2 text-xs font-bold"
                    style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)', color: 'var(--text)', cursor: 'pointer' }}
                  >
                    📋 Copy link
                  </button>
                </div>
              </div>

              {/* Push #087 — secondary actions: re-generate the same idea
                  (one click) or jump back to edit the script. Keeps the
                  primary download flow above prominent. */}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-3">
                <button
                  type="button"
                  onClick={handleGenerateGuarded}
                  disabled={!prompt.trim()}
                  className="rounded-xl px-4 py-2 text-xs font-bold"
                  style={{
                    background: 'rgba(37,99,235,.10)',
                    border: '1px solid rgba(37,99,235,.35)',
                    color: '#93c5fd',
                    cursor: !prompt.trim() ? 'not-allowed' : 'pointer',
                    opacity: !prompt.trim() ? 0.5 : 1,
                  }}
                >
                  🔁 Generate Similar
                </button>
                <button
                  type="button"
                  onClick={handleBackToEdit}
                  className="rounded-xl px-4 py-2 text-xs font-bold"
                  style={{
                    background: 'rgba(255,255,255,.04)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  ✏️ Edit Script
                </button>
              </div>

              {/* Push #087 — stats + posting tip strip. Reads from the
                  current generation state (no extra round-trips). */}
              <div
                className="rounded-xl px-4 py-3 mt-6 text-xs flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
                style={{
                  background: 'rgba(255,255,255,.02)',
                  border: '1px solid var(--border)',
                  color: 'var(--muted2)',
                  maxWidth: 480,
                }}
              >
                <span>📊 {duration}s</span>
                <span>·</span>
                <span>
                  {mode === 'cinematic'
                    ? '1 Cinematic token used'
                    : `${selectedCost} credit${selectedCost === 1 ? '' : 's'} used`}
                </span>
                <span>·</span>
                <span style={{ color: mode === 'fast' ? '#34d399' : '#fbbf24', fontWeight: 700 }}>
                  {mode === 'fast' ? 'Fast Mode ⚡' : 'Cinematic 🎬'}
                </span>
              </div>

              <p className="text-xs mt-4 text-center" style={{ color: '#93c5fd', maxWidth: 480, lineHeight: 1.55 }}>
                💡 Tip: Post within 2 hours for max algorithm boost.
              </p>

              <p className="text-xs mt-2 text-center" style={{ color: 'var(--muted)', maxWidth: 420, lineHeight: 1.55 }}>
                Voiceover, captions and CTA are baked into the final video. Upload it straight to YouTube Shorts.
              </p>
            </section>
          )}

          {/* Push #060 — smart paywall. Shows below the video result on a
              successful generation when the user's remaining balance is
              at or below 30 credits. Failed runs never see it (we're
              inside the `phase === 'done'` branch). The paywall component
              re-checks credits itself as a safety net. */}
          {phase === 'done' &&
            finalVideoUrl &&
            credits !== null &&
            credits <= 30 && <PostVideoPaywall credits={credits} />}

          {/* Push #047 — ready-to-post text package. Renders after a
              successful generation, alongside the video player above, so
              the user can copy hook + script + scenes + caption + hashtags
              + CTA into YouTube Shorts in one go. */}
          {phase === 'done' && analysis && (
            <ShortPackageSection
              analysis={analysis}
              copiedSection={copiedSection}
              onCopy={copySection}
            />
          )}

          {/* Push #047 — Next Action block. Replaces the simple "Start over"
              button on success with a conversion-oriented pair: re-engage
              (Generate Another Short → handleReset) or convert (Upgrade for
              More Credits → existing /pricing flow, which already routes to
              the Stripe-hosted launch-offer links). For non-done phases
              (generating, clips_ready, composing, failed) we keep the
              original tiny "Start over" footer so users can bail out of a
              stuck render. */}
          {phase === 'done' ? (
            // Push #116 — free users see the smarter UpsellSection that
            // pitches Pro by name and shows a credit-urgency line when
            // they're at ≤1. Paid users keep the lighter
            // NextActionSection (their main action is "make another one").
            planTier === 'free' ? (
              <UpsellSection
                onAnother={handleReset}
                onUpgrade={() => handleUpgradeNow('pro', 'usd')}
                upgradeLoading={upgradeLoading}
                creditsLeft={credits ?? 0}
              />
            ) : (
              <NextActionSection onAnother={handleReset} onUpgrade={() => router.push('/pricing')} />
            )
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 flex-wrap mb-6">
                <p className="text-[10px] font-bold uppercase tracking-widest w-full text-center" style={{ color: 'var(--muted)', letterSpacing: '0.18em' }}>
                  ShortsForgeAI v1.5
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
        </>
      )}
    </main>
  )
}

// ─── Push #048 — Trending Hooks ─────────────────────────────────────────────
// Static hook templates. "Use Hook" calls onUse to prefill the prompt
// textarea; "Copy" calls onCopy and flashes the matching chip's button.
function TrendingHooksSection({
  onUse,
  onCopy,
  copiedIndex,
}: {
  onUse: (text: string) => void
  onCopy: (text: string, idx: number) => void
  copiedIndex: number | null
}) {
  return (
    <section
      className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
      style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>
            Trending Hooks
          </div>
          <h3 className="font-black text-base sm:text-lg" style={{ color: 'var(--text)' }}>
            Steal a viral opener
          </h3>
        </div>
        <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
          Click <strong style={{ color: 'var(--text2)' }}>Use Hook</strong> to drop it into the box above.
        </span>
      </div>

      <div className="th-grid">
        {TRENDING_HOOKS.map((h, i) => {
          const c = HOOK_CATEGORY_COLOR[h.category] ?? HOOK_CATEGORY_COLOR.Mystery
          const isCopied = copiedIndex === i
          return (
            <div
              key={i}
              className="rounded-xl p-3 flex flex-col gap-2"
              style={{
                background: 'rgba(255,255,255,.03)',
                border: '1px solid var(--border)',
                minWidth: 0,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[10px] font-black uppercase tracking-widest"
                  style={{
                    color: c.fg,
                    background: c.bg,
                    border: `1px solid ${c.border}`,
                    padding: '2px 8px',
                    borderRadius: 999,
                  }}
                >
                  {h.category}
                </span>
              </div>
              <p
                className="text-sm font-bold"
                style={{ color: 'var(--text)', lineHeight: 1.45, margin: 0, wordBreak: 'break-word' }}
              >
                “{h.text}”
              </p>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => onUse(h.text)}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold flex-1"
                  style={{
                    background: 'linear-gradient(135deg, #2563EB, #1d4ed8)',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  Use Hook
                </button>
                <button
                  type="button"
                  onClick={() => onCopy(h.text, i)}
                  className="rounded-lg px-3 py-1.5 text-xs font-bold"
                  style={{
                    background: isCopied ? 'rgba(52,211,153,.12)' : 'rgba(255,255,255,.04)',
                    border: isCopied ? '1px solid rgba(52,211,153,.45)' : '1px solid var(--border)',
                    color: isCopied ? '#34d399' : 'var(--muted2)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {isCopied ? '✓' : 'Copy'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <style jsx>{`
        .th-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }
        @media (min-width: 900px) {
          .th-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }
        @media (max-width: 520px) {
          .th-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  )
}

// ─── Push #048 — Visual History ─────────────────────────────────────────────
// Empty state when the user has no rows yet. Status chip on every card.
// "Open" link is rendered only when video_url is present (completed runs).
function RecentVideosSection({ videos }: { videos: RecentVideo[] | null }) {
  // null = still loading initial fetch
  if (videos === null) {
    return (
      <section
        className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
        style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
      >
        <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
          Recent Videos
        </div>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>
          Loading your library…
        </div>
      </section>
    )
  }

  if (videos.length === 0) {
    return (
      <section
        className="gv-card rounded-2xl p-5 sm:p-6 mb-6 text-center"
        style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
      >
        <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>
          Recent Videos
        </div>
        <div className="font-black text-base mb-1" style={{ color: 'var(--text)' }}>
          No videos yet
        </div>
        <p className="text-xs" style={{ color: 'var(--muted2)' }}>
          Create your first Short — finished generations will show up here.
        </p>
      </section>
    )
  }

  function statusChip(s: RecentVideo['status']) {
    if (s === 'completed')
      return { label: 'Completed', fg: '#34d399', bg: 'rgba(52,211,153,.10)', border: 'rgba(52,211,153,.32)' }
    if (s === 'failed' || s === 'cancelled')
      return { label: 'Failed', fg: '#f87171', bg: 'rgba(248,113,113,.10)', border: 'rgba(248,113,113,.32)' }
    return { label: 'Processing', fg: '#22D3EE', bg: 'rgba(34, 211, 238,.10)', border: 'rgba(34, 211, 238,.32)' }
  }

  function formatDate(iso: string): string {
    try {
      const d = new Date(iso)
      const diff = Date.now() - d.getTime()
      const hours = Math.floor(diff / 3600000)
      if (hours < 1) return 'Just now'
      if (hours < 24) return `${hours}h ago`
      const days = Math.floor(diff / 86400000)
      if (days < 7) return `${days}d ago`
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return 'Recent'
    }
  }

  return (
    <section
      className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
      style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>
            Recent Videos
          </div>
          <h3 className="font-black text-base sm:text-lg" style={{ color: 'var(--text)' }}>
            Your recent shorts
          </h3>
        </div>
        <a
          // Push #053 — point at the AI video library instead of the
          // legacy /history Shorts Packs page.
          href="/my-videos"
          className="text-xs font-bold"
          style={{ color: '#93c5fd', textDecoration: 'none' }}
        >
          View all →
        </a>
      </div>

      <div className="rv-grid">
        {videos.map((v) => {
          const chip = statusChip(v.status)
          const playable = v.status === 'completed' && !!v.video_url
          return (
            <div
              key={v.id}
              className="rounded-xl overflow-hidden"
              style={{
                background: 'rgba(255,255,255,.03)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                className="rv-thumb"
                style={{
                  background: v.thumbnail_url
                    ? `center / cover no-repeat url(${v.thumbnail_url})`
                    : 'linear-gradient(135deg, rgba(37,99,235,.18), rgba(37, 99, 235,.12))',
                  aspectRatio: '9 / 16',
                  position: 'relative',
                }}
              >
                {!v.thumbnail_url && (
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ color: 'rgba(147,197,253,.55)', fontSize: '1.8rem' }}
                  >
                    🎬
                  </div>
                )}
                <span
                  className="absolute"
                  style={{
                    top: 6,
                    left: 6,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: chip.bg,
                    border: `1px solid ${chip.border}`,
                    color: chip.fg,
                    fontSize: '0.62rem',
                    fontWeight: 900,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {chip.label}
                </span>
                {v.duration ? (
                  <span
                    className="absolute"
                    style={{
                      bottom: 6,
                      right: 6,
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: 'rgba(0,0,0,.6)',
                      color: '#fff',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                    }}
                  >
                    {Math.round(v.duration)}s
                  </span>
                ) : null}
              </div>
              <div className="p-2.5 flex flex-col gap-1.5" style={{ minHeight: 80 }}>
                <p
                  className="text-xs font-bold"
                  style={{
                    color: 'var(--text)',
                    lineHeight: 1.35,
                    margin: 0,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {v.title}
                </p>
                <div className="text-[10px]" style={{ color: 'var(--muted)' }}>
                  {v.platform} · {formatDate(v.created_at)}
                </div>
                {playable && v.video_url && (
                  <a
                    href={v.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold mt-1"
                    style={{ color: '#93c5fd', textDecoration: 'none' }}
                  >
                    Open ↗
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <style jsx>{`
        .rv-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        @media (max-width: 720px) {
          .rv-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 400px) {
          .rv-grid { grid-template-columns: 1fr; }
        }
        .rv-thumb { position: relative; }
      `}</style>
    </section>
  )
}

// ─── Push #048 — Generate Video Beta Layer ─────────────────────────────────
// Five visible stages mapped from the existing phase machine. We never
// surface raw provider errors here — all status comes from the friendly
// phase enum.
type StageStatus = 'queued' | 'active' | 'done'
function PipelineStages({
  phase,
  renderProgress,
  finalReady,
}: {
  phase: Phase
  renderProgress: number
  finalReady: boolean
}) {
  // Map the existing 4-phase state machine to 5 user-facing stages:
  //  1. Creating visuals      — Runway clips (`generating`)
  //  2. Generating voiceover  — TTS step (`clips_ready` + early `composing`)
  //  3. Adding captions       — caption track build (early `composing`)
  //  4. Rendering final video — Creatomate render bulk (`composing`)
  //  5. Preparing download    — terminal `done` + final URL fetch
  const visualsDone = phase === 'clips_ready' || phase === 'composing' || phase === 'done'
  const visualsActive = phase === 'generating'

  const voiceoverActive = phase === 'clips_ready' || (phase === 'composing' && renderProgress < 25)
  const voiceoverDone = phase === 'composing' && renderProgress >= 25
  const voiceoverDoneOrPast = voiceoverDone || phase === 'done'

  const captionsActive = phase === 'composing' && renderProgress >= 25 && renderProgress < 60
  const captionsDone = phase === 'composing' && renderProgress >= 60
  const captionsDoneOrPast = captionsDone || phase === 'done'

  const renderActive = phase === 'composing' && renderProgress >= 60 && renderProgress < 100
  const renderDone = phase === 'done'

  const downloadActive = phase === 'done' && !finalReady
  const downloadDone = phase === 'done' && finalReady

  const stages: { label: string; sub: string; status: StageStatus }[] = [
    {
      label: 'Creating visuals',
      sub: 'AI scene model',
      status: visualsDone ? 'done' : visualsActive ? 'active' : 'queued',
    },
    {
      label: 'Generating voiceover',
      sub: 'Neural narration',
      status: voiceoverDoneOrPast ? 'done' : voiceoverActive ? 'active' : 'queued',
    },
    {
      label: 'Adding captions',
      sub: 'Word-by-word overlay',
      status: captionsDoneOrPast ? 'done' : captionsActive ? 'active' : 'queued',
    },
    {
      label: 'Rendering final video',
      sub: 'AI Video Engine',
      status: renderDone ? 'done' : renderActive ? 'active' : 'queued',
    },
    {
      label: 'Preparing download',
      sub: '9:16 MP4',
      status: downloadDone ? 'done' : downloadActive ? 'active' : 'queued',
    },
  ]

  return (
    <ol
      className="mt-5"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        listStyle: 'none',
        padding: 0,
        margin: 0,
      }}
    >
      {stages.map((s, i) => {
        const isDone = s.status === 'done'
        const isActive = s.status === 'active'
        const color = isDone ? '#34d399' : isActive ? '#93c5fd' : 'var(--muted)'
        const ring = isDone
          ? '1px solid rgba(52,211,153,.45)'
          : isActive
          ? '1px solid rgba(147,197,253,.45)'
          : '1px solid var(--border)'
        const bg = isDone
          ? 'rgba(52,211,153,.08)'
          : isActive
          ? 'rgba(37,99,235,.08)'
          : 'rgba(255,255,255,.03)'
        return (
          <li
            key={i}
            className="rounded-lg px-3 py-2 flex items-center gap-3"
            style={{ background: bg, border: ring }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: isDone
                  ? 'rgba(52,211,153,.18)'
                  : isActive
                  ? 'transparent'
                  : 'rgba(255,255,255,.04)',
                border: isDone
                  ? '1px solid rgba(52,211,153,.55)'
                  : isActive
                  ? '2px solid rgba(147,197,253,.55)'
                  : '1px solid var(--border)',
                borderTopColor: isActive ? '#93c5fd' : undefined,
                animation: isActive ? 'spin 0.9s linear infinite' : undefined,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color,
                fontSize: '0.7rem',
                fontWeight: 900,
              }}
            >
              {isDone ? '✓' : isActive ? '' : i + 1}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="text-sm font-bold" style={{ color, lineHeight: 1.2 }}>
                {s.label}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                {s.sub}
              </div>
            </div>
            <span
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color }}
            >
              {isDone ? 'Done' : isActive ? 'Active' : 'Queued'}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// ─── Push #048 — Viral Intelligence Panel ──────────────────────────────────
// Shown in Step 2 right under the creative brief. Color scheme follows the
// spec: green for high score (≥75), amber for medium (50-74), red for weak
// (<50). Layout is compact — two-column score / rating header on desktop,
// stacks on mobile.
function ViralIntelligencePanel({ vi }: { vi: ViralIntelligence }) {
  const { viralScore, hookRating, retentionNotes, thumbnailTexts, openingCaption, improvementSuggestions } = vi
  const accent =
    viralScore >= 75
      ? { color: '#34d399', bg: 'rgba(52,211,153,.10)', border: 'rgba(52,211,153,.32)', label: 'Strong viral signal' }
      : viralScore >= 50
      ? { color: '#22D3EE', bg: 'rgba(34, 211, 238,.10)', border: 'rgba(34, 211, 238,.32)', label: 'Could be sharper' }
      : { color: '#f87171', bg: 'rgba(248,113,113,.10)', border: 'rgba(248,113,113,.32)', label: 'Needs work' }
  const ratingLabel: Record<HookRating, string> = {
    weak: 'Weak',
    medium: 'Medium',
    strong: 'Strong',
    excellent: 'Excellent',
  }

  return (
    <section
      className="gv-card rounded-2xl p-5 sm:p-6 mb-4"
      style={{
        background: 'rgba(15,15,30,0.85)',
        border: `1px solid ${accent.border}`,
        boxShadow: `0 0 28px ${accent.bg}`,
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div
            className="text-xs font-black uppercase tracking-widest mb-1"
            style={{ color: 'var(--muted)' }}
          >
            Viral Intelligence
          </div>
          <h3 className="font-black text-lg sm:text-xl" style={{ color: 'var(--text)' }}>
            Hook performance forecast
          </h3>
        </div>
        <div className="flex items-stretch gap-3">
          <div
            className="rounded-xl px-4 py-2 text-center"
            style={{
              background: accent.bg,
              border: `1px solid ${accent.border}`,
              minWidth: 92,
            }}
          >
            <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--muted2)' }}>
              Score
            </div>
            <div className="font-black" style={{ color: accent.color, fontSize: '1.6rem', lineHeight: 1.1 }}>
              {viralScore}
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 800 }}>/100</span>
            </div>
          </div>
          <div
            className="rounded-xl px-4 py-2 flex flex-col justify-center"
            style={{
              background: 'rgba(255,255,255,.03)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--muted2)' }}>
              Hook
            </div>
            <div className="font-black text-sm" style={{ color: accent.color }}>
              {ratingLabel[hookRating]}
            </div>
          </div>
        </div>
      </div>

      <div className="vi-grid">
        {retentionNotes.length > 0 && (
          <div
            className="rounded-xl p-4"
            style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}
          >
            <div
              className="text-[10px] font-black uppercase tracking-widest mb-2"
              style={{ color: '#93c5fd' }}
            >
              Retention notes
            </div>
            <ul className="space-y-1.5 text-xs" style={{ color: 'var(--text2)', paddingLeft: 0, listStyle: 'none' }}>
              {retentionNotes.map((n, i) => (
                <li key={i} style={{ display: 'flex', gap: 6 }}>
                  <span style={{ color: accent.color, fontWeight: 800 }}>•</span>
                  <span style={{ lineHeight: 1.5 }}>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          className="rounded-xl p-4 flex flex-col gap-3"
          style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)' }}
        >
          {thumbnailTexts.length > 0 && (
            <div>
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: '#93c5fd' }}
              >
                Thumbnail text ideas
              </div>
              <div className="flex flex-wrap gap-2">
                {thumbnailTexts.map((t, i) => (
                  <span
                    key={i}
                    className="text-xs font-black"
                    style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: accent.bg,
                      border: `1px solid ${accent.border}`,
                      color: accent.color,
                      letterSpacing: '0.02em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {openingCaption && (
            <div>
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: '#93c5fd' }}
              >
                Opening caption (0-2s)
              </div>
              <p
                className="text-sm font-bold"
                style={{ color: 'var(--text)', lineHeight: 1.45, margin: 0 }}
              >
                “{openingCaption}”
              </p>
            </div>
          )}
        </div>
      </div>

      {improvementSuggestions.length > 0 && (
        <div
          className="rounded-xl p-4 mt-3"
          style={{
            background: 'rgba(34, 211, 238,.06)',
            border: '1px solid rgba(34, 211, 238,.30)',
          }}
        >
          <div
            className="text-[10px] font-black uppercase tracking-widest mb-2"
            style={{ color: '#22D3EE' }}
          >
            How to push the score higher
          </div>
          <ul className="space-y-1.5 text-xs" style={{ color: 'var(--text2)', paddingLeft: 0, listStyle: 'none' }}>
            {improvementSuggestions.map((n, i) => (
              <li key={i} style={{ display: 'flex', gap: 6 }}>
                <span style={{ color: '#22D3EE', fontWeight: 800 }}>→</span>
                <span style={{ lineHeight: 1.5 }}>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] mt-3" style={{ color: 'var(--muted)' }}>
        Forecast is a guide, not a guarantee — real-world performance depends on thumbnail, posting time, and audience match.
      </p>

      <style jsx>{`
        .vi-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 720px) {
          .vi-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  )
}

// ─── Push #047 components ──────────────────────────────────────────────────

// Inline credit chip — fed by the /api/credits effect at the top of
// GenerateClient. Renders three states: loading skeleton, low-credits
// warning (under LOW_CREDITS_THRESHOLD), and healthy balance. We don't
// render anything for guests (credits === null after a 401) since the
// page already redirects them to /login when they try to generate.
function CreditsChip({ credits, loading }: { credits: number | null; loading: boolean }) {
  if (loading) {
    return (
      <div
        className="rounded-xl px-3 py-2 text-xs font-bold"
        style={{
          background: 'rgba(255,255,255,.04)',
          border: '1px solid var(--border)',
          color: 'var(--muted)',
          minWidth: 120,
          textAlign: 'right',
        }}
      >
        Loading credits…
      </div>
    )
  }
  if (credits === null) return null
  const low = credits < LOW_CREDITS_THRESHOLD
  return (
    <div style={{ textAlign: 'right' }}>
      <div
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold"
        style={{
          background: low ? 'rgba(34, 211, 238,.10)' : 'rgba(52,211,153,.08)',
          border: low ? '1px solid rgba(34, 211, 238,.35)' : '1px solid rgba(52,211,153,.30)',
          color: low ? '#22D3EE' : '#34d399',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: low ? '#22D3EE' : '#34d399',
            boxShadow: low ? '0 0 8px rgba(34, 211, 238,.5)' : '0 0 8px rgba(52,211,153,.5)',
            display: 'inline-block',
          }}
        />
        You have {credits} credit{credits === 1 ? '' : 's'} left
      </div>
      {low && (
        <p className="text-[11px] mt-1.5" style={{ color: '#22D3EE', fontWeight: 600 }}>
          Low credits. <a href="/pricing" style={{ color: '#22D3EE', textDecoration: 'underline' }}>Upgrade to keep generating.</a>
        </p>
      )}
    </div>
  )
}

// Output text package. Each card has its own copy button; the top button
// copies a clean plaintext bundle of everything at once. We feed the
// shared `copySection` helper so the "✓ Copied" flash works the same way
// on every button.
function ShortPackageSection({
  analysis,
  copiedSection,
  onCopy,
}: {
  analysis: Analysis
  copiedSection: string | null
  onCopy: (key: string, text: string) => void
}) {
  const hashtagsText = analysis.hashtags.join(' ')
  const scenesText = analysis.scenePlan
    .map((s, i) => `${i + 1}. ${s}`)
    .join('\n')
  const fullPackage = [
    analysis.title ? `TITLE\n${analysis.title}` : '',
    analysis.hook ? `HOOK\n${analysis.hook}` : '',
    analysis.voiceoverScript ? `SCRIPT\n${analysis.voiceoverScript}` : '',
    scenesText ? `VISUAL SCENES\n${scenesText}` : '',
    analysis.youtubeDescription ? `CAPTION\n${analysis.youtubeDescription}` : '',
    analysis.cta ? `CTA\n${analysis.cta}` : '',
    hashtagsText ? `HASHTAGS\n${hashtagsText}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const cards: { key: string; label: string; body: string; mono?: boolean }[] = [
    { key: 'hook', label: 'Hook', body: analysis.hook },
    { key: 'script', label: 'Full Script', body: analysis.voiceoverScript },
    { key: 'scenes', label: 'Visual Scenes', body: scenesText },
    {
      key: 'caption',
      label: 'Caption',
      body: analysis.youtubeDescription || analysis.summary || '',
    },
    { key: 'hashtags', label: 'Hashtags', body: hashtagsText, mono: true },
    { key: 'cta', label: 'CTA', body: analysis.cta },
  ].filter((c) => c.body && c.body.trim().length > 0)

  return (
    <section
      className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
      style={{ background: 'rgba(15,15,30,0.85)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <div
            className="text-xs font-black uppercase tracking-widest mb-1"
            style={{ color: 'var(--muted)' }}
          >
            Ready to post
          </div>
          <h3 className="font-black text-lg sm:text-xl" style={{ color: 'var(--text)' }}>
            Your Short Package
          </h3>
        </div>
        <button
          type="button"
          onClick={() => onCopy('package', fullPackage)}
          className="rounded-xl px-5 py-2.5 text-sm font-black text-white"
          style={{
            background:
              copiedSection === 'package'
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : 'linear-gradient(135deg, #2563EB, #1d4ed8)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 6px 22px rgba(37,99,235,.32)',
          }}
        >
          {copiedSection === 'package' ? '✓ Copied' : '📋 Copy Full Short Package'}
        </button>
      </div>

      <div className="sf-package-grid">
        {cards.map((c) => {
          const isCopied = copiedSection === c.key
          return (
            <div
              key={c.key}
              className="rounded-xl p-4"
              style={{
                background: 'rgba(255,255,255,.03)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                minWidth: 0,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div
                  className="text-xs font-black uppercase tracking-widest"
                  style={{ color: '#93c5fd' }}
                >
                  {c.label}
                </div>
                <button
                  type="button"
                  onClick={() => onCopy(c.key, c.body)}
                  className="rounded-lg px-2.5 py-1 text-xs font-bold"
                  style={{
                    background: isCopied ? 'rgba(52,211,153,.12)' : 'rgba(255,255,255,.04)',
                    border: isCopied ? '1px solid rgba(52,211,153,.45)' : '1px solid var(--border)',
                    color: isCopied ? '#34d399' : 'var(--muted2)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {isCopied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <p
                className="text-sm whitespace-pre-wrap"
                style={{
                  color: 'var(--text2)',
                  lineHeight: 1.55,
                  fontFamily: c.mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
                  fontSize: c.mono ? '0.85rem' : '0.875rem',
                  margin: 0,
                  wordBreak: 'break-word',
                }}
              >
                {c.body}
              </p>
            </div>
          )
        })}
      </div>

      <style jsx>{`
        .sf-package-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 640px) {
          .sf-package-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  )
}

// Push #116 — smarter post-generation upsell for free-tier users. Replaces
// the bland "Ready to create more shorts?" section with a celebration +
// credit-urgency line + a Pro pitch ("100 videos/month") + the same
// Generate-Another fallback. Routes through handleUpgradeNow('pro') so
// checkout attribution stays consistent with the rest of the app.
function UpsellSection({
  onAnother,
  onUpgrade,
  upgradeLoading,
  creditsLeft,
}: {
  onAnother: () => void
  onUpgrade: () => void
  upgradeLoading: boolean
  creditsLeft: number
}) {
  return (
    <section
      className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
      style={{
        background: 'linear-gradient(135deg, rgba(251,191,36,.04), rgba(59,130,246,.04))',
        border: '1px solid rgba(255,255,255,.08)',
      }}
    >
      {/* Celebration line */}
      <div
        style={{
          fontSize: '0.95rem',
          fontWeight: 800,
          color: '#34D399',
          marginBottom: 10,
          letterSpacing: '-0.01em',
        }}
      >
        ✅ Your Short is ready! Nice work.
      </div>

      {/* Credit urgency — only when the user is at the edge */}
      {creditsLeft <= 1 && (
        <div
          style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            color: '#FBBF24',
            marginBottom: 14,
          }}
        >
          ⚡ You have {creditsLeft} credit{creditsLeft === 1 ? '' : 's'} left. Don&apos;t lose your momentum.
        </div>
      )}

      {/* Pro pitch card */}
      <div
        style={{
          border: '1px solid rgba(251,191,36,.3)',
          background: 'rgba(251,191,36,.05)',
          borderRadius: 14,
          padding: '16px 20px',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: '0.72rem',
            color: '#FBBF24',
            fontWeight: 800,
            letterSpacing: '.12em',
            marginBottom: 8,
            textTransform: 'uppercase',
          }}
        >
          Pro creators post daily
        </div>
        <div
          style={{
            fontSize: '1rem',
            fontWeight: 800,
            color: 'var(--text)',
            marginBottom: 10,
            letterSpacing: '-0.01em',
          }}
        >
          Get 100 credits/month — post every day for $19.90/mo
        </div>
        <ul
          style={{
            fontSize: '0.85rem',
            color: '#94A3B8',
            marginBottom: 16,
            paddingLeft: 18,
            lineHeight: 1.65,
          }}
        >
          <li>100 Fast Mode videos/month</li>
          <li>1 Cinematic (Runway AI) video/month</li>
          <li>Download MP4 · Captions included</li>
        </ul>
        <button
          type="button"
          onClick={onUpgrade}
          disabled={upgradeLoading}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 10,
            background: upgradeLoading ? 'rgba(251,191,36,.5)' : '#FBBF24',
            color: '#0A0A0F',
            fontWeight: 800,
            fontSize: '0.95rem',
            border: 'none',
            cursor: upgradeLoading ? 'wait' : 'pointer',
            boxShadow: '0 6px 22px rgba(251,191,36,.28)',
          }}
        >
          {upgradeLoading ? 'Opening checkout…' : 'Upgrade to Pro — $19.90/mo →'}
        </button>
        <div
          style={{
            fontSize: '0.74rem',
            color: '#94A3B8',
            textAlign: 'center',
            marginTop: 8,
            fontWeight: 600,
          }}
        >
          Cancel anytime
        </div>
      </div>

      {/* Secondary action — keep iterating */}
      <button
        type="button"
        onClick={onAnother}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: 10,
          background: 'rgba(255,255,255,.04)',
          border: '1px solid rgba(255,255,255,.10)',
          color: 'var(--text)',
          fontWeight: 700,
          fontSize: '0.9rem',
          cursor: 'pointer',
        }}
      >
        Generate another Short →
      </button>
    </section>
  )
}

function NextActionSection({
  onAnother,
  onUpgrade,
}: {
  onAnother: () => void
  onUpgrade: () => void
}) {
  return (
    <section
      className="gv-card rounded-2xl p-5 sm:p-6 mb-6 text-center"
      style={{
        background: 'linear-gradient(135deg, rgba(59, 130, 246,.10), rgba(37, 99, 235,.06))',
        border: '1px solid rgba(59, 130, 246,.28)',
      }}
    >
      <h3 className="font-black text-lg sm:text-xl mb-2" style={{ color: 'var(--text)' }}>
        Ready to create more shorts?
      </h3>
      <p className="text-sm mb-4" style={{ color: 'var(--muted2)' }}>
        Reset this idea and start fresh, or top up your credits to keep generating.
      </p>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={onAnother}
          className="rounded-xl px-5 py-3 text-sm font-black text-white"
          style={{
            background: 'linear-gradient(135deg, #2563EB 0%, #2563EB 55%, #22D3EE 100%)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 6px 22px rgba(59, 130, 246,.4)',
          }}
        >
          ⚡ Generate Another Short
        </button>
        <button
          type="button"
          onClick={onUpgrade}
          className="rounded-xl px-5 py-3 text-sm font-bold"
          style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid var(--border2)',
            color: 'var(--text)',
            cursor: 'pointer',
          }}
        >
          Upgrade for More Credits →
        </button>
      </div>
    </section>
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
  // 30s → 3 clips, 45s → 5 clips (rounded up from 4.5), 60s → 6 clips.
  // Matches clipCountForDuration in /api/generate-video.
  const targetCount = duration === 30 ? 3 : duration === 45 ? 5 : 6
  return scenes.slice(0, targetCount).map((s) => trimCaption(s))
}

// Push #060 / #061 — fire-and-forget event tracking. POSTs to /api/events
// which silently succeeds if public.events doesn't exist in this Supabase
// project. Errors are swallowed so tracking never affects the user-facing
// pipeline.
function trackEvent(name: string, metadata?: Record<string, unknown>): void {
  try {
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: name,
        name,
        metadata: metadata ?? {},
        path: typeof window !== 'undefined' ? window.location?.pathname : undefined,
      }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // ignore
  }
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

// ─── Push #087 — Mode Selector with Pro gating ─────────────────────────────
// Cinematic Mode renders as a non-interactive locked card for non-Pro users
// so the option is still visible (drives upgrade interest) but the click is
// inert. The server enforces the same gate as a defense-in-depth check.
// Push #088 — Pro users with 0 cinematic_tokens get a "resets monthly"
// inert card too, so spending the token doesn't silently fail at submit.
function ModeSelector({
  mode,
  setMode,
  isPro,
  cinematicTokens,
}: {
  mode: GenerationMode
  setMode: (m: GenerationMode) => void
  isPro: boolean
  cinematicTokens: number
}) {
  const proHasToken = isPro && cinematicTokens > 0
  return (
    <div className="mt-5">
      <div
        className="text-xs font-black uppercase tracking-widest mb-2"
        style={{ color: 'var(--muted)' }}
      >
        Generation mode
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Fast Mode — always available */}
        <button
          type="button"
          onClick={() => setMode('fast')}
          className="rounded-xl p-4 text-left"
          style={{
            background: mode === 'fast' ? 'rgba(37,99,235,.12)' : 'rgba(255,255,255,.03)',
            border: mode === 'fast' ? '1px solid rgba(37,99,235,.55)' : '1px solid var(--border)',
            cursor: 'pointer',
            transition: 'all 0.15s',
            boxShadow: mode === 'fast' ? '0 0 22px rgba(37,99,235,.18)' : 'none',
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span>⚡</span>
            <span
              className="text-sm font-black"
              style={{ color: mode === 'fast' ? '#93c5fd' : 'var(--text)' }}
            >
              Fast Mode
            </span>
            <span
              className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(37,99,235,.18)',
                color: '#93c5fd',
                border: '1px solid rgba(37,99,235,.3)',
              }}
            >
              1 credit
            </span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
              style={{
                background: 'rgba(52,211,153,.15)',
                color: '#34d399',
                border: '1px solid rgba(52,211,153,.3)',
              }}
            >
              DEFAULT
            </span>
          </div>
          <div className="text-xs" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
            Stock footage + AI voiceover. ~$0.03/video, ready in ~60 seconds.
          </div>
        </button>

        {/* Cinematic Mode — Pro + token required. Locked card for Free,
            Basic, AND Pro-with-0-tokens (resets monthly). */}
        {proHasToken ? (
          <button
            type="button"
            onClick={() => setMode('cinematic')}
            className="rounded-xl p-4 text-left"
            style={{
              background:
                mode === 'cinematic' ? 'rgba(168, 85, 247,.12)' : 'rgba(255,255,255,.03)',
              border:
                mode === 'cinematic' ? '1px solid rgba(168, 85, 247,.55)' : '1px solid var(--border)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow:
                mode === 'cinematic' ? '0 0 22px rgba(168, 85, 247,.18)' : 'none',
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span>🎬</span>
              <span
                className="text-sm font-black"
                style={{ color: mode === 'cinematic' ? '#d8b4fe' : 'var(--text)' }}
              >
                Cinematic Mode
              </span>
              <span
                className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(168, 85, 247,.18)',
                  color: '#d8b4fe',
                  border: '1px solid rgba(168, 85, 247,.3)',
                }}
              >
                {cinematicTokens} token{cinematicTokens === 1 ? '' : 's'}
              </span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                style={{
                  background: 'rgba(168, 85, 247,.15)',
                  color: '#d8b4fe',
                  border: '1px solid rgba(168, 85, 247,.3)',
                }}
              >
                PRO · 1 / month
              </span>
            </div>
            <div className="text-xs" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
              AI-generated cinematic scenes via Runway. ~5 minute render.
              Uses your 1 monthly cinematic token.
            </div>
          </button>
        ) : isPro ? (
          /* Pro user, but token already spent this month. */
          <div
            className="relative rounded-xl p-4"
            style={{
              background: 'rgba(168, 85, 247,.04)',
              border: '1px solid rgba(168, 85, 247,.20)',
              opacity: 0.85,
              cursor: 'not-allowed',
            }}
          >
            <div
              className="absolute"
              style={{
                top: 8,
                right: 8,
                background: 'rgba(251, 191, 36, 0.2)',
                color: '#fbbf24',
                fontSize: '0.62rem',
                fontWeight: 900,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: 999,
                border: '1px solid rgba(251, 191, 36, 0.4)',
              }}
            >
              0 tokens left
            </div>
            <div className="flex items-center gap-1.5 mb-1 pr-24">
              <span style={{ filter: 'grayscale(0.4)' }}>🎬</span>
              <span className="text-sm font-black" style={{ color: 'var(--muted2)' }}>
                Cinematic Mode
              </span>
            </div>
            <div className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
              You used your Cinematic video this month. Resets on your next
              Pro renewal. Use Fast Mode for unlimited videos this month.
            </div>
          </div>
        ) : (
          /* Free / Basic — upgrade CTA. */
          <div
            className="relative rounded-xl p-4"
            style={{
              background: 'rgba(168, 85, 247,.04)',
              border: '1px solid rgba(168, 85, 247,.20)',
              opacity: 0.85,
              cursor: 'not-allowed',
            }}
          >
            <div
              className="absolute"
              style={{
                top: 8,
                right: 8,
                background: '#9333ea',
                color: '#fff',
                fontSize: '0.62rem',
                fontWeight: 900,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: 999,
                boxShadow: '0 4px 14px rgba(147, 51, 234,.35)',
              }}
            >
              Pro Only
            </div>
            <div className="flex items-center gap-1.5 mb-1 pr-16">
              <span style={{ filter: 'grayscale(0.4)' }}>🎬</span>
              <span className="text-sm font-black" style={{ color: 'var(--muted2)' }}>
                Cinematic Mode
              </span>
            </div>
            <div className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
              Runway AI · ~5 min render · 1 Cinematic token / month
            </div>
            <a
              href="/pricing"
              className="inline-flex items-center gap-1 text-xs font-bold mt-2"
              style={{ color: '#d8b4fe', textDecoration: 'none' }}
            >
              🔓 Upgrade to Pro · $19.90/month →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Push #087 — Fast Mode 4-step pipeline indicator ───────────────────────
// Pure visual progression (no extra round-trips). The parent advances the
// `step` index every ~8s while a Fast Mode generation is in flight so the
// long single roundtrip feels intentional. Once the phase reaches `done`
// every step is shown as completed regardless of timer.
function FastPipelineStages({ step, phase }: { step: number; phase: Phase }) {
  const STEPS = [
    { label: 'Writing your viral script', sub: 'AI scene planning' },
    { label: 'Fetching cinematic stock footage', sub: 'Pexels HD library' },
    { label: 'Generating professional voiceover', sub: 'Neural TTS' },
    { label: 'Assembling your Short', sub: '9:16 MP4 render' },
  ]
  return (
    <ol
      className="mt-5"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        listStyle: 'none',
        padding: 0,
        margin: 0,
      }}
    >
      {STEPS.map((s, i) => {
        const isDone = phase === 'done' || step > i
        const isActive = !isDone && step === i
        const color = isDone ? '#34d399' : isActive ? '#93c5fd' : 'var(--muted)'
        const ring = isDone
          ? '1px solid rgba(52,211,153,.45)'
          : isActive
          ? '1px solid rgba(147,197,253,.45)'
          : '1px solid var(--border)'
        const bg = isDone
          ? 'rgba(52,211,153,.08)'
          : isActive
          ? 'rgba(37,99,235,.08)'
          : 'rgba(255,255,255,.03)'
        return (
          <li
            key={i}
            className="rounded-lg px-3 py-2 flex items-center gap-3"
            style={{ background: bg, border: ring }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: isDone
                  ? 'rgba(52,211,153,.18)'
                  : isActive
                  ? 'transparent'
                  : 'rgba(255,255,255,.04)',
                border: isDone
                  ? '1px solid rgba(52,211,153,.55)'
                  : isActive
                  ? '2px solid rgba(147,197,253,.55)'
                  : '1px solid var(--border)',
                borderTopColor: isActive ? '#93c5fd' : undefined,
                animation: isActive ? 'spin 0.9s linear infinite' : undefined,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color,
                fontSize: '0.7rem',
                fontWeight: 900,
              }}
            >
              {isDone ? '✓' : isActive ? '' : i + 1}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="text-sm font-bold" style={{ color, lineHeight: 1.2 }}>
                {s.label}
              </div>
              <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                {s.sub}
              </div>
            </div>
            <span
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color }}
            >
              {isDone ? 'Done' : isActive ? 'Active' : 'Queued'}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// ─── Push #098 — out-of-credits upgrade modal ───────────────────────────────
// Dark overlay + centered card. Green CTA hits POST /api/stripe/checkout
// with the basic tier, then redirects to the returned Stripe URL. Secondary
// "Maybe later" closes the modal without leaving the page.
function UpgradeModal({
  loading,
  onUpgrade,
  onUpgradeBrl,
  onClose,
}: {
  loading: boolean
  onUpgrade: () => void
  onUpgradeBrl: () => void
  onClose: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          background: '#0f0f1e',
          border: '1px solid rgba(52,211,153,0.35)',
          borderRadius: 20,
          padding: '32px 28px',
          textAlign: 'center',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(52,211,153,0.18)',
        }}
      >
        <h2
          id="upgrade-modal-title"
          style={{
            fontSize: '1.45rem',
            fontWeight: 900,
            color: '#fff',
            lineHeight: 1.25,
            margin: 0,
            marginBottom: 12,
          }}
        >
          You&apos;ve used your free videos 🎉
        </h2>
        <p
          style={{
            fontSize: '0.95rem',
            color: '#cbd5e1',
            lineHeight: 1.5,
            margin: 0,
            marginBottom: 24,
          }}
        >
          Upgrade to Basic for 50 videos/month — $9.90/mo
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={onUpgrade}
          style={{
            width: '100%',
            padding: '14px 20px',
            borderRadius: 12,
            border: 'none',
            background: loading
              ? 'rgba(52,211,153,0.5)'
              : 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff',
            fontSize: '0.95rem',
            fontWeight: 900,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 10px 30px rgba(16,185,129,0.35)',
            transition: 'transform 0.15s ease',
          }}
        >
          {loading ? 'Opening checkout…' : 'Upgrade Now — 50% Off Today'}
        </button>
        {/* Push #113 — explicit BRL rail. Auto-detection (locale/IP) was
            unreliable through VPNs and embedded browsers, so we surface
            the BRL option as a clear, user-initiated button. */}
        <button
          type="button"
          disabled={loading}
          onClick={onUpgradeBrl}
          style={{
            marginTop: 8,
            width: '100%',
            padding: '10px 16px',
            borderRadius: 10,
            background: 'rgba(255,255,255,.05)',
            border: '1px solid rgba(255,255,255,.12)',
            color: '#94A3B8',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          🇧🇷 Pagar em R$ 49/mês (Brasil)
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            display: 'block',
            margin: '14px auto 0',
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            fontSize: '0.85rem',
            fontWeight: 600,
            textDecoration: 'underline',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          Maybe later
        </button>
        <p
          style={{
            marginTop: 18,
            fontSize: '0.78rem',
            color: '#fbbf24',
            fontWeight: 700,
          }}
        >
          🔥 Launch offer ends soon
        </p>
      </div>
    </div>
  )
}

// ─── Push #109 — urgency modal with countdown ──────────────────────────────
// Shown automatically when a free user finishes a generation that drained
// their last credit, and reopened by any retry guard while planTier is
// free and credits <= 0. The 10-minute timer is sourced from
// localStorage (sf_urgency_start) by the parent's tick effect, so the
// clock survives dismiss + reopen and page reloads.
function UrgencyModal({
  remaining,
  loading,
  onUpgrade,
  onUpgradeBrl,
  onClose,
}: {
  remaining: number
  loading: boolean
  onUpgrade: () => void
  onUpgradeBrl: () => void
  onClose: () => void
}) {
  const expired = remaining <= 0
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="urgency-modal-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <style jsx>{`
        @keyframes sf-urgency-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.78; transform: scale(1.02); }
        }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 460,
          background: '#0f0f1e',
          border: '1px solid rgba(251,191,36,0.45)',
          borderRadius: 20,
          padding: '32px 28px',
          textAlign: 'center',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(251,191,36,0.20)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            width: 32,
            height: 32,
            borderRadius: 999,
            border: 'none',
            background: 'rgba(255,255,255,0.05)',
            color: '#94a3b8',
            fontSize: '1.1rem',
            fontWeight: 700,
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ×
        </button>
        <h2
          id="urgency-modal-title"
          style={{
            fontSize: '1.3rem',
            fontWeight: 900,
            color: '#fff',
            lineHeight: 1.3,
            margin: 0,
            marginBottom: 16,
          }}
        >
          {'⚡ Upgrade and keep creating'}
        </h2>
        {!expired && (
          <div
            aria-live="polite"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontVariantNumeric: 'tabular-nums',
              fontSize: '2.6rem',
              fontWeight: 900,
              color: '#34d399',
              letterSpacing: '0.04em',
              marginBottom: 20,
              animation: 'sf-urgency-pulse 1.4s ease-in-out infinite',
            }}
          >
            {mm}:{ss}
          </div>
        )}
        <p
          style={{
            fontSize: '0.92rem',
            color: '#cbd5e1',
            lineHeight: 1.55,
            margin: 0,
            marginBottom: 22,
          }}
        >
          50 Fast Mode videos/month for just <strong style={{ color: '#34d399' }}>$9.90/mo</strong>. Cancel anytime.
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={onUpgrade}
          style={{
            width: '100%',
            padding: '14px 20px',
            borderRadius: 12,
            border: 'none',
            background: loading
              ? 'rgba(52,211,153,0.5)'
              : 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 900,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 10px 30px rgba(16,185,129,0.4)',
            letterSpacing: '-0.01em',
          }}
        >
          {loading ? 'Opening checkout…' : 'Get Basic — $9.90/mo →'}
        </button>
        {/* Push #113 — BRL option for BR users. */}
        <button
          type="button"
          disabled={loading}
          onClick={onUpgradeBrl}
          style={{
            marginTop: 8,
            width: '100%',
            padding: '10px 16px',
            borderRadius: 10,
            background: 'rgba(255,255,255,.05)',
            border: '1px solid rgba(255,255,255,.12)',
            color: '#94A3B8',
            fontSize: '0.82rem',
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          🇧🇷 Pagar em R$ 49,90/mês (Brasil)
        </button>
        <p
          style={{
            marginTop: 14,
            fontSize: '0.74rem',
            color: '#94a3b8',
            fontWeight: 600,
          }}
        >
          Cancel anytime
        </p>
      </div>
    </div>
  )
}

// ─── Push #098 — first-visit welcome banner ─────────────────────────────────
// Dismissible green banner shown above Step 1. The dismiss handler writes
// the sf_welcomed flag to localStorage so the banner never returns.
function WelcomeBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="rounded-xl px-4 py-3 mb-6 flex items-center gap-3"
      style={{
        background: 'rgba(52,211,153,0.10)',
        border: '1px solid rgba(52,211,153,0.35)',
        color: '#34d399',
      }}
    >
      <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.4 }}>
        🎉 Welcome! You have 2 free videos. Generate your first Short now!
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss welcome message"
        style={{
          background: 'transparent',
          border: '1px solid rgba(52,211,153,0.35)',
          borderRadius: 8,
          color: '#34d399',
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  )
}

// ─── Animated 5-step pipeline + overall progress bar ───────────────────────
// Replaces the older plain-text step list. Each row shows icon + label +
// status chip (Queued / Active / Done). The active row pulses with a brand
// shimmer; completed rows show a green checkmark. An overall progress bar
// renders below the list and fills smoothly as `percent` advances.
function AnimatedPipelineProgress({
  step,
  percent,
  phase,
}: {
  step: number
  percent: number
  phase: Phase
}) {
  const allDone = phase === 'done'
  const STEPS = [
    { icon: '✍️', label: 'Script', sub: 'Writing your viral script' },
    { icon: '🎬', label: 'Footage', sub: 'Fetching cinematic clips' },
    { icon: '🎙️', label: 'Voiceover', sub: 'Generating neural narration' },
    { icon: '✨', label: 'Captions', sub: 'Word-by-word overlay' },
    { icon: '🚀', label: 'Rendering', sub: 'Assembling final 9:16 MP4' },
  ]
  const safePercent = Math.min(100, Math.max(0, allDone ? 100 : percent))
  return (
    <div className="mt-4">
      <style jsx>{`
        @keyframes sf-pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.55); }
          70% { box-shadow: 0 0 0 10px rgba(59,130,246,0); }
          100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
        }
        @keyframes sf-shimmer {
          0% { background-position: -200px 0; }
          100% { background-position: 200px 0; }
        }
        @keyframes sf-bar-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .sf-active-dot {
          animation: sf-pulse-ring 1.4s ease-out infinite;
        }
        .sf-active-row {
          background: linear-gradient(
            90deg,
            rgba(59,130,246,0.06) 0%,
            rgba(34,211,238,0.12) 50%,
            rgba(59,130,246,0.06) 100%
          );
          background-size: 400px 100%;
          animation: sf-shimmer 2.2s linear infinite;
        }
        .sf-bar-fill::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255,255,255,0.35) 50%,
            transparent 100%
          );
          animation: sf-bar-shimmer 1.6s ease-in-out infinite;
        }
      `}</style>
      <ol
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          listStyle: 'none',
          padding: 0,
          margin: 0,
        }}
      >
        {STEPS.map((s, i) => {
          const isDone = allDone || i < step
          const isActive = !allDone && i === step
          const labelColor = isDone ? '#34d399' : isActive ? '#F5F7FF' : 'var(--muted2)'
          const subColor = isDone ? 'rgba(110,231,183,0.85)' : isActive ? '#93c5fd' : 'var(--muted)'
          const ring = isDone
            ? '1px solid rgba(52,211,153,0.45)'
            : isActive
            ? '1px solid rgba(59,130,246,0.55)'
            : '1px solid var(--border)'
          const baseBg = isDone
            ? 'rgba(52,211,153,0.08)'
            : isActive
            ? 'rgba(59,130,246,0.10)'
            : 'rgba(255,255,255,0.02)'
          return (
            <li
              key={i}
              className={`rounded-xl px-3 py-2.5 flex items-center gap-3 ${
                isActive ? 'sf-active-row' : ''
              }`}
              style={{ background: baseBg, border: ring }}
            >
              <span
                aria-hidden="true"
                className={isActive ? 'sf-active-dot' : ''}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: isDone
                    ? 'rgba(52,211,153,0.20)'
                    : isActive
                    ? 'rgba(59,130,246,0.18)'
                    : 'rgba(255,255,255,0.04)',
                  border: isDone
                    ? '1px solid rgba(52,211,153,0.55)'
                    : isActive
                    ? '1px solid rgba(59,130,246,0.65)'
                    : '1px solid var(--border)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '1rem',
                }}
              >
                {isDone ? (
                  <span style={{ color: '#34d399', fontSize: '0.95rem', fontWeight: 900 }}>✓</span>
                ) : (
                  <span>{s.icon}</span>
                )}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  className="text-sm font-bold"
                  style={{ color: labelColor, lineHeight: 1.2 }}
                >
                  {s.label}
                </div>
                <div className="text-[11px]" style={{ color: subColor, lineHeight: 1.3 }}>
                  {s.sub}
                </div>
              </div>
              <span
                className="text-[10px] font-black uppercase tracking-widest"
                style={{
                  color: isDone ? '#34d399' : isActive ? '#93c5fd' : 'var(--muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {isDone ? 'Done' : isActive ? 'Active' : 'Queued'}
              </span>
            </li>
          )
        })}
      </ol>

      {/* Overall progress bar */}
      <div className="mt-4 flex items-center justify-between mb-1.5">
        <span
          className="text-[10px] font-black uppercase tracking-widest"
          style={{ color: 'var(--muted)' }}
        >
          Overall progress
        </span>
        <span className="text-xs font-bold" style={{ color: '#F5F7FF' }}>
          {Math.round(safePercent)}%
        </span>
      </div>
      <div
        className="w-full rounded-full overflow-hidden relative"
        style={{
          height: 10,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          className={allDone ? '' : 'sf-bar-fill'}
          style={{
            position: 'relative',
            height: '100%',
            width: `${safePercent}%`,
            background: 'linear-gradient(90deg, #3B82F6 0%, #22D3EE 100%)',
            boxShadow: '0 0 18px rgba(59,130,246,0.55)',
            transition: 'width 700ms cubic-bezier(0.22, 1, 0.36, 1)',
            overflow: 'hidden',
          }}
        />
      </div>
    </div>
  )
}
