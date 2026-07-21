'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PricingCards from '@/components/PricingCards'
// KINEO-SPRINT-OFFER-2026-07-14 — PostVideoPaywall import removed. It was the
// THIRD offer block on the success screen (on top of the Push #099 intro block
// and UpsellSection), still selling FOUNDING50 + the one-time pack — three
// conflicting deals in one scroll. The Push #099 block is the single offer
// surface now. The component file stays in place, unused (same pattern as
// AvatarPaywallModal below).
import { trackCheckoutClick } from '@/lib/trackClick'
import { trackEvent, trackSignupSource } from '@/lib/analytics'
import type { BrollPlan } from '@/lib/broll/types'
import { randomTopic } from '@/lib/curatedTopics'
import { PLAN_LIST } from '@/lib/pricing'
import {
  buildSeriesContinuationHref,
  buildSeriesContinuationPrompt,
  type SeriesContinuationSource,
} from '@/lib/seriesContinuation'
import { buildPublicVideoSharePath, PUBLIC_VIDEO_SHARE_VERSION } from '@/lib/videoShare'
import VisualDirector from '@/components/video/VisualDirector'
import NicheOnboarding from '@/components/NicheOnboarding'
// KINEO-AVATAR-PACKS-RETIRED-2026-07-06 — AvatarPaywallModal import removed.
// That modal only sold the retired avatar_credits packs (?pack=avatar*). Avatar
// videos now cost 120 universal credits; the avatar 402 already routes to the
// universal upgrade modal. The component file is left in place but unused.
import ReferralMiniCard from '@/components/ReferralMiniCard'
// KINEO-TAAFT-REVIEW-2026-07-14 — post-render TAAFT review ask. Fully
// self-contained (source gate via /api/me/plan, once-per-browser localStorage
// flag, analytics) and degrades to null on any failure, mirroring
// ReferralMiniCard so it can never break the success screen.
import TaaftReviewAsk from '@/components/TaaftReviewAsk'
// KINEO-OFFER290-2026-07-07 — first-purchase $2.90 urgency banner. Self-gated on
// OFFER_290_ENABLED (renders null while the flag is off — build-only for now).
import Offer290Banner from './Offer290Banner'
// KINEO-LOWCREDITS-UPSELL import removed 09/07 — banner retired (see note at
// the old render site; 0 credits is the normal free state now).

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
// Push #311 — added 'script_preview': shown after auto-structure completes
// but before analyze-idea fires, so the user can review/edit the structured
// script before burning a credit. Auto-skipped when ?autogenerate=1 (Viral Now).
type Phase =
  | 'idle'
  | 'scripting'     // generate-script is running (auto-structure step)
  | 'script_preview' // structured script ready — user reviews before generating
  | 'analyzing'
  | 'options'
  | 'generating'    // Runway producing clips (or fal.ai submission)
  | 'fal_polling'   // Push #315 — polling fal.ai clip status until all done
  | 'avatar_polling' // feature/ai-avatar — polling the VEED talking-head job
  | 'clips_ready'   // brief transition state — kicks off /api/compose
  | 'broll_planning'  // Phase 3 — waiting for /api/generate-broll-plan
  | 'visual_director' // Phase 3 — Creator Mode: user reviews/edits BrollPlan
  | 'composing'     // Creatomate rendering the final video
  | 'done'
  | 'failed'

// #360 — phases where a generation is already in flight. Used to block
// double-submit: disables the Generate button AND short-circuits handleGenerate.
const PROCESSING_PHASES: Phase[] = [
  'scripting',
  'analyzing',
  'broll_planning',
  'generating',
  'fal_polling',
  'avatar_polling',
  'clips_ready',
  'composing',
]
function isProcessingPhase(p: Phase): boolean {
  return PROCESSING_PHASES.includes(p)
}

// Push #064 — durations bumped to 30 / 45 / 60 so the AI has enough room to
// build a real story arc (hook → setup → tension → payoff). 45s is the new
// default; 60s is the "deep story" option.
// Push #208 — removed 30s (too short for quality content), added 90s.
// Works for YouTube Shorts AND TikTok (up to 3 min supported).
type Duration = 45 | 60 | 90
// Push #084 — added 'fast' for the Pexels + TTS cheap pipeline (1 credit).
// Cinematic quality tiers (basic / basic_ai / pro) still flow through Runway.
// Push #315 — added 'cinematic_ai' for fal.ai Wan 2.1 mode.
type Quality = 'fast' | 'basic' | 'basic_ai' | 'pro' | 'cinematic_ai'
// Push #315 — added 'cinematic_ai' for fal.ai Wan 2.1 mode (3 credits, no Pro required).
type GenerationMode = 'fast' | 'cinematic_ai' | 'cinematic' | 'creator'

const DURATION_OPTIONS: { value: Duration; label: string }[] = [
  { value: 45, label: '45s — Recommended ⭐' },
  { value: 60, label: '60s — Deep Story' },
]

const POLL_GENERATING_MS = 4000
const POLL_COMPOSING_MS = 5000
const MAX_TRANSIENT_POLL_ERRORS = 4
const ACTIVE_RENDER_STORAGE_KEY = 'kineo_active_render_v1'
const ACTIVE_RENDER_TAB_KEY = 'kineo_active_render_tab_v1'
const ACTIVE_RENDER_TTL_MS = 2 * 60 * 60 * 1000

interface FastRenderInputs {
  clip_urls: string[]
  voiceover_script: string
  scene_captions: string[]
  duration: number
  topic: string
  language: string
  vertical?: string
  speed?: number
}

interface ActiveRenderSnapshot {
  stage: 'avatar_submitting' | 'submitting' | 'rendering'
  renderId?: string
  userId: string
  quality: string
  mode: GenerationMode
  duration: Duration
  prompt: string
  attemptId: string
  startedAt: number
  unlockInputs?: FastRenderInputs
  composePayload?: Record<string, unknown>
  avatarPayload?: Record<string, unknown>
}

function newGenerationAttemptId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    // Fall through to a collision-resistant browser-local id.
  }
  return `gen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

// sessionStorage survives reloads but is isolated per tab. Namespace the
// durable render snapshot with that tab id so one active render cannot
// overwrite or delete another tab's recovery state.
function activeRenderStorageKey(): string {
  if (typeof window === 'undefined') return ACTIVE_RENDER_STORAGE_KEY
  try {
    let tabId = sessionStorage.getItem(ACTIVE_RENDER_TAB_KEY)
    if (!tabId) {
      tabId = newGenerationAttemptId()
      sessionStorage.setItem(ACTIVE_RENDER_TAB_KEY, tabId)
    }
    return `${ACTIVE_RENDER_STORAGE_KEY}:${tabId}`
  } catch {
    return ACTIVE_RENDER_STORAGE_KEY
  }
}

function normalizeFastRenderInputs(value: unknown): FastRenderInputs | undefined {
  if (!value || typeof value !== 'object') return undefined
  const input = value as Partial<FastRenderInputs>
  const clipUrls = Array.isArray(input.clip_urls)
    ? input.clip_urls.filter((url): url is string => typeof url === 'string' && url.length > 0 && url.length <= 2048).slice(0, 20)
    : []
  const voiceover = typeof input.voiceover_script === 'string' ? input.voiceover_script.slice(0, 10000) : ''
  if (clipUrls.length === 0 || !voiceover.trim()) return undefined
  const requestedDuration = Number(input.duration)
  const safeDuration = requestedDuration === 60 || requestedDuration === 90 ? requestedDuration : 45
  const language = input.language === 'pt' || input.language === 'es' ? input.language : 'en'
  return {
    clip_urls: clipUrls,
    voiceover_script: voiceover,
    scene_captions: Array.isArray(input.scene_captions)
      ? input.scene_captions.filter((caption): caption is string => typeof caption === 'string').map((caption) => caption.slice(0, 500)).slice(0, 30)
      : [],
    duration: safeDuration,
    topic: typeof input.topic === 'string' ? input.topic.slice(0, 1000) : '',
    language,
    ...(typeof input.vertical === 'string' && input.vertical.trim() ? { vertical: input.vertical.slice(0, 64) } : {}),
    ...(typeof input.speed === 'number' && Number.isFinite(input.speed) ? { speed: Math.max(0.7, Math.min(1.3, input.speed)) } : {}),
  }
}

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
  // KINEO-REBASE-2026-07-10 — legacy costs halved (15/15/20 → 8/8/10).
  { key: 'basic',    title: 'Basic',    desc: 'Uses licensed stock media from top providers.',     credits: 8,  icon: '🎞️' },
  { key: 'basic_ai', title: 'Basic AI', desc: 'Uses our most efficient generative models.',         credits: 8,  icon: '⚡' },
  { key: 'pro',      title: 'Pro',      desc: 'Uses premium generative models and cinematic look.', credits: 10, icon: '✨' },
]

const GENERIC_ERROR = 'Video generation failed. Please try again.'

// Push #047 — staged pipeline copy shown during the long generate/compose
// phases. They rotate on a timer (purely cosmetic — real progress comes
// from the API state machine) so the wait feels intentional, not empty.
const LOADER_MESSAGES = [
  'Structuring your viral script…',
  'Writing scroll-stopping hook…',
  'Building cinematic script…',
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


// #383d — turn a video title into a safe download filename slug.
// "What Mars Does to Your Body" → "what-mars-does-to-your-body"
// Strips accents and special chars; collapses spaces to single hyphens.
// Returns '' when there's nothing usable, so callers can fall back.
function slugifyTitle(title: string | null | undefined): string {
  if (!title) return ''
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (combining diacritical marks)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumerics -> hyphen
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
    .slice(0, 80)
}

// #455 — proven viral starter topics (extreme places + mystery — our top
// performers, e.g. Snake Island 11.4K views). Pre-filled for brand-new users so
// the first screen is one tap from their "wow" video instead of a blank box.
const VIRAL_STARTER_TOPICS = [
  'the mystery of Snake Island, the most dangerous island on Earth',
  'the Bermuda Triangle mystery',
  'the abandoned city of Chernobyl, frozen in time',
  'the deepest hole humans ever dug — the Kola Superdeep Borehole',
  'how tiny Monaco became the richest place on Earth',
  'the Roman city of Pompeii, buried by a volcano in a single day',
]
const PUSH27_ONBOARDING_RENDER_SESSION_KEY = 'kineo_push27_onboarding_render_dispatched'

export default function GenerateClient({ initialViralPrompt = '' }: { initialViralPrompt?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // KINEO-RECOVERY-2026-07-15 — accept the legacy `topic` key as a safety
  // net, but standardise every current entry point on `prompt`. The homepage
  // previously submitted `topic` while this screen read only `prompt`, so the
  // visitor's exact idea disappeared at the highest-intent first step.
  const initialPrompt = searchParams.get('prompt') ?? searchParams.get('topic') ?? initialViralPrompt
  const requestedLanguage = searchParams.get('language')
  const initialLanguage: 'en' | 'pt' | 'es' =
    requestedLanguage === 'pt' || requestedLanguage === 'es' ? requestedLanguage : 'en'

  const [prompt, setPrompt] = useState(initialPrompt)

  // #455 — first-run pre-fill (Measure 2: onboarding "first video in 60s").
  // Brand-new users land on a ready-to-generate viral topic instead of a blank
  // box, so step one is a single tap toward their "wow" first video — the
  // activation cliff (only ~21% of signups ever made a video) is the biggest
  // conversion leak. Only when no ?prompt= is passed AND the user hasn't been
  // welcomed yet; never clobbers typed text, never touches returning users.
  const starterSeededRef = useRef(false)
  useEffect(() => {
    if (starterSeededRef.current) return
    starterSeededRef.current = true
    if (initialPrompt) return
    try {
      if (localStorage.getItem('sf_welcomed')) return
    } catch {
      return
    }
    setPrompt((cur) =>
      cur && cur.trim()
        ? cur
        : VIRAL_STARTER_TOPICS[Math.floor(Math.random() * VIRAL_STARTER_TOPICS.length)],
    )
  }, [initialPrompt])

  // #467 — onboarding niche picker (Measure 2). Shows once for brand-new signups
  // (?welcome=1 / ?signup=1), gated by the sf_onboarded flag so it never nags
  // returning users. Picking a niche/Surprise Me pre-fills the prompt and forces
  // the Fast engine (zero-friction first video), then hands off to the normal
  // generate flow. Lifts first-video activation (the biggest funnel leak).
  const [showNicheOnboarding, setShowNicheOnboarding] = useState(false)
  const onboardingAutoGenerateRef = useRef(false)
  const onboardingGenerationDispatchedRef = useRef(false)
  const inlineFirstVideoViewedRef = useRef(false)
  useEffect(() => {
    try {
      onboardingGenerationDispatchedRef.current =
        sessionStorage.getItem(PUSH27_ONBOARDING_RENDER_SESSION_KEY) === '1'
    } catch {
      // The in-memory ref still measures the uninterrupted path.
    }
  }, [])
  useEffect(() => {
    try {
      if (localStorage.getItem('sf_onboarded')) return
      const pendingPrompt = sessionStorage.getItem('pendingVideoPrompt') ?? ''
      if (initialPrompt.trim() || pendingPrompt.trim()) return
    } catch {
      return
    }
    const isNew = searchParams?.get('welcome') === '1' || searchParams?.get('signup') === '1'
    if (isNew) setShowNicheOnboarding(true)
  }, [searchParams])
  function finishOnboarding() {
    try { localStorage.setItem('sf_onboarded', '1') } catch {}
    setShowNicheOnboarding(false)
  }
  function onboardingPick(topic: string) {
    onboardingAutoGenerateRef.current = true
    setPrompt(topic)
    setMode('fast') // first video = Fast = zero friction (see value fast)
    finishOnboarding()
    void handleAnalyze(topic, { fromTopic: true, skipPreview: true, structureFirst: true })
  }

  function redirectToLoginPreservingPrompt() {
    const cleanPrompt = prompt.trim()
    try {
      if (cleanPrompt) sessionStorage.setItem('pendingVideoPrompt', cleanPrompt)
    } catch { /* ignore */ }
    const returnPath = cleanPrompt
      ? `/generate?prompt=${encodeURIComponent(cleanPrompt)}`
      : '/generate'
    router.push(`/login?redirect=${encodeURIComponent(returnPath)}`)
  }
  // #383c — explicit script handling, visible to everyone (replaces the old
  // silent "skip the AI if the text has HOOK/PAYOFF markers" auto-detection).
  //  'ai'       → send the text to /api/generate-script to structure it (DEFAULT)
  //  'verbatim' → use the pasted text exactly as the script (advanced)
  const [scriptMode, setScriptMode] = useState<'ai' | 'verbatim'>('ai')
  // Legacy AI eligibility field retained for server-gate compatibility. New
  // accounts start with it consumed; no free AI-Generate offer is advertised.
  const [freeAiUsed, setFreeAiUsed] = useState<boolean | null>(null)
  // #404 — plan flags drive which engine card is unlocked: Starter→Fast,
  // Creator→Seedance, Studio→Kling. The others render locked (upsell).
  const [isStarter, setIsStarter] = useState<boolean>(false)
  const [isCreator, setIsCreator] = useState<boolean>(false)
  const [isStudio, setIsStudio] = useState<boolean>(false)
  // #404 — once we know the plan, default the mode/engine to that plan's engine.
  const planDefaultedRef = useRef<boolean>(false)
  // #402 — which AI engine the user picked: 'seedance' (AI Generated, 30 cr, all
  // plans) or 'kling' (Cinematic AI, 50 cr — KINEO-PRICING-V3B-2026-07-10).
  // KINEO-HOLLYWOOD-2026-07-09 — 'hollywood' engine added (per-scene routing).
  const [aiEngine, setAiEngine] = useState<'seedance' | 'kling' | 'veo' | 'sora' | 'hollywood'>('seedance')
  // KINEO-CHARACTER-LOCK-2026-07-10 — My Characters: saved presenters the user
  // can lock into Hollywood renders (same face across every video). Loaded
  // lazily the first time the hollywood engine is selected.
  const [characters, setCharacters] = useState<{ id: string; name: string; image_url: string }[]>([])
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('')
  const charactersLoadedRef = useRef(false)
  useEffect(() => {
    if (aiEngine !== 'hollywood' || charactersLoadedRef.current) return
    charactersLoadedRef.current = true
    fetch('/api/characters', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { characters: [] }))
      .then((d) => {
        if (Array.isArray(d?.characters)) setCharacters(d.characters)
      })
      .catch(() => {})
  }, [aiEngine])

  // KINEO-USER-FOOTAGE + KINEO-OWN-VOICE (2026-07-10, Prioridade 2/3 do
  // briefing — pedidos literais do cliente $200/mês): a biblioteca "My
  // footage" (clipes/fotos do usuário viram B-roll) e a narração própria
  // (upload de voiceover OU voz clonada do perfil).
  type FootageItem = { id: string; url: string; kind: string; size_bytes: number }
  const [footageItems, setFootageItems] = useState<FootageItem[]>([])
  const [selectedFootageIds, setSelectedFootageIds] = useState<string[]>([])
  const [footageUploading, setFootageUploading] = useState(false)
  const [footageMsg, setFootageMsg] = useState('')
  const [myVoiceUrl, setMyVoiceUrl] = useState('')
  const [useClonedVoice, setUseClonedVoice] = useState(false)
  const [voiceUploading, setVoiceUploading] = useState(false)
  const footageInputRef = useRef<HTMLInputElement | null>(null)
  const voiceInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    fetch('/api/footage', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => {
        if (Array.isArray(d?.items)) setFootageItems(d.items)
      })
      .catch(() => {})
  }, [])

  // Signed-URL upload: POST upload-url → browser PUTs straight to storage
  // (bypasses Vercel's body cap) → POST confirm registers the row.
  async function uploadUserFile(file: File): Promise<FootageItem | null> {
    const startRes = await fetch('/api/footage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upload-url', contentType: file.type, sizeBytes: file.size }),
    })
    const start = await startRes.json()
    if (!startRes.ok || typeof start?.signedUrl !== 'string') {
      throw new Error(typeof start?.error === 'string' ? start.error : 'Could not start the upload.')
    }
    const putRes = await fetch(start.signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
      body: file,
    })
    if (!putRes.ok) throw new Error('Upload failed — please try again.')
    const confirmRes = await fetch('/api/footage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', path: start.path, kind: start.kind, sizeBytes: file.size }),
    })
    const confirm = await confirmRes.json()
    if (!confirmRes.ok || !confirm?.item) {
      throw new Error(typeof confirm?.error === 'string' ? confirm.error : 'Could not register the upload.')
    }
    return confirm.item as FootageItem
  }

  async function handleFootageFiles(files: FileList | null) {
    if (!files || files.length === 0 || footageUploading) return
    setFootageUploading(true)
    setFootageMsg('')
    try {
      for (const file of Array.from(files).slice(0, 8)) {
        const item = await uploadUserFile(file)
        if (item) {
          setFootageItems((cur) => [item, ...cur])
          setSelectedFootageIds((cur) => [...cur, item.id])
        }
      }
      setFootageMsg('✓ Uploaded — your clips will fill the first scenes; stock fills the rest.')
    } catch (e) {
      setFootageMsg(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setFootageUploading(false)
      if (footageInputRef.current) footageInputRef.current.value = ''
    }
  }

  async function handleVoiceFile(files: FileList | null) {
    const file = files?.[0]
    if (!file || voiceUploading) return
    setVoiceUploading(true)
    setFootageMsg('')
    try {
      const item = await uploadUserFile(file)
      if (item) {
        setMyVoiceUrl(item.url)
        setUseClonedVoice(false)
        setFootageMsg('✓ Voiceover ready — TTS will be skipped and captions come from your audio.')
      }
    } catch (e) {
      setFootageMsg(e instanceof Error ? e.message : 'Voice upload failed.')
    } finally {
      setVoiceUploading(false)
      if (voiceInputRef.current) voiceInputRef.current.value = ''
    }
  }
  // feat/ui-polish — picked niche drives the clickable example chips under the
  // textarea so new users never face a blank page (activation booster).
  const [pickedNiche, setPickedNiche] = useState<string>('billionaire')
  const NICHE_EXAMPLES: Record<string, string[]> = {
    billionaire: [
      '5 morning habits Jeff Bezos used before Amazon hit $1 trillion',
      'The one rule Warren Buffett follows that 99% of investors ignore',
      'What Elon Musk eats in a day to run 6 companies',
      'Why billionaires wear the same outfit every day',
    ],
    mystery: [
      'The radio signal from deep space that repeats every 16 days',
      'The Mary Celeste — a ghost ship found in 1872 with no crew',
      'The Dyatlov Pass incident: 9 hikers dead, still unexplained',
      'The Voynich manuscript no one has ever been able to read',
    ],
    country: [
      'Why Norway pays you $2,000 a month just to live there',
      'Why Iceland has no mosquitoes',
      'The hidden country between Russia and China almost no one visits',
      'Why Switzerland has a nuclear bunker for every citizen',
    ],
    money: [
      'The credit card float trick that buys you 45 free days',
      'The 10-second decision rule billionaires use to save millions',
      'Why your savings account is quietly losing you money',
      'The Rule of 72 — double your money without a calculator',
    ],
    learning: [
      'The Pareto Principle — how 20% of effort gives 80% of results',
      'The Feynman Technique to learn anything twice as fast',
      'Why spaced repetition beats cramming every time',
      'The 2-minute rule that kills procrastination instantly',
    ],
    history: [
      'The 1518 dancing plague that made 400 people dance to death',
      'Why Roman concrete still stands stronger after 2,000 years',
      'The Library of Alexandria — how humanity lost a million books',
      'The Antikythera mechanism: a 2,000-year-old computer',
    ],
    science: [
      'Why time runs faster on a mountain than at sea level',
      'The tiny animal that can survive the vacuum of space',
      'What happens to the human body in the first minute on Mars',
      'Why you can’t fold a piece of paper more than 7 times',
    ],
    space: [
      'There is a planet made entirely of diamond, 40 light-years away',
      'Why a day on Venus is longer than its entire year',
      'The sound a black hole makes, recorded by NASA',
      'What happens to the human body in the first minute on Mars',
    ],
  }
  // #383e — fresh trending topics per vertical, refreshed 3×/day by the
  // refresh-niche-trends cron and read straight from the DB (instant, no AI call
  // on open). Falls back to the fixed NICHE_EXAMPLES when the table is empty, so
  // a card is NEVER blank. Per-vertical latest run handles cron-failure fallback.
  const [nicheTrends, setNicheTrends] = useState<Record<string, string[]>>({})
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('niche_trends')
          .select('vertical, slot, topic, run_at')
          .order('run_at', { ascending: false })
          .limit(200)
        if (cancelled || !data) return
        // Keep only each vertical's most recent run (latest run_at), ordered by slot.
        const latestRunAt: Record<string, string> = {}
        for (const r of data) {
          if (!latestRunAt[r.vertical]) latestRunAt[r.vertical] = r.run_at as string
        }
        const grouped: Record<string, Array<{ slot: number; topic: string }>> = {}
        for (const r of data) {
          if (r.run_at !== latestRunAt[r.vertical]) continue
          ;(grouped[r.vertical] ??= []).push({ slot: r.slot as number, topic: r.topic as string })
        }
        const out: Record<string, string[]> = {}
        for (const [v, arr] of Object.entries(grouped)) {
          out[v] = arr.sort((a, b) => a.slot - b.slot).map((x) => x.topic)
        }
        setNicheTrends(out)
      } catch {
        // Silent — chips just fall back to NICHE_EXAMPLES.
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // #384 — freeAiUsed is loaded from /api/credits (server-side, cookie auth —
  // reliable), set inside the credits effect below.

  const [phase, setPhase] = useState<Phase>('idle')
  // UX-1 instrumentation — log EVERY phase transition (catches regressions like
  // generating -> analyzing). String log so it is fully readable in console capture.
  const prevPhaseRef = useRef<Phase>('idle')
  const generationAttemptRef = useRef<string | null>(null)
  const preserveGenerationAttemptRef = useRef(false)
  const lastFailedAttemptRef = useRef<string | null>(null)
  const generatingPollErrorsRef = useRef(0)
  const composingPollErrorsRef = useRef(0)
  const activeRenderRestoreCheckedRef = useRef(false)
  const activeRenderRestoreResolvedRef = useRef(false)
  const currentUserIdRef = useRef<string | null>(null)
  const resumedRenderRef = useRef(false)
  const [activeRenderRestoreResolved, setActiveRenderRestoreResolved] = useState(false)
  const [activeRenderRestoreRetry, setActiveRenderRestoreRetry] = useState(0)
  // #360 — synchronous re-entry guard against double-submit. Catches the
  // sub-render race the disabled button can't: two clicks before React
  // re-renders both see phase==='options'. The ref flips synchronously.
  const generationInFlightRef = useRef(false)
  // #359 Camera B — holds the in-flight broll-plan fetch so handleGenerate can
  // AWAIT it (no more fire-and-forget) before calling generate-video-fast.
  const brollPlanPromiseRef = useRef<Promise<BrollPlan | null> | null>(null)
  // Clear the guard once we settle into any non-processing phase so the next
  // legitimate generation is allowed.
  useEffect(() => {
    if (!isProcessingPhase(phase)) generationInFlightRef.current = false
  }, [phase])
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  // Push #439 — Viral Score "Apply" button. Holds the index of the suggestion
  // currently being applied (null = none) so the panel can show a per-row
  // "Applying…" state and block double-clicks.
  const [applyingSuggestion, setApplyingSuggestion] = useState<number | null>(null)
  const [scenes, setScenes] = useState<string[]>([])
  const [tasks, setTasks] = useState<TaskHandle[]>([])
  const [taskStates, setTaskStates] = useState<Record<string, TaskState>>({})
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState<Duration>(45)
  const [quality, setQuality] = useState<Quality>('fast')
  // Push #084 — Fast Mode (Pexels + TTS, 1 credit, ~30s) is the new default.
  // Cinematic Mode keeps the Runway path. Quality tiers above only apply to
  // Cinematic Mode; Fast Mode pins the effective quality to 'fast' on submit.
  // PUSH #20 — Fast is the zero-friction acquisition path. Start every unknown
  // session here; paid Creator/Studio accounts are defaulted to AI after their
  // plan loads below.
  const [mode, setMode] = useState<GenerationMode>('fast')
  // Push #316 — output language selector (en | pt | es). PUSH #36 preserves
  // the language promised by localized acquisition pages through auth.
  const [language, setLanguage] = useState<'en' | 'pt' | 'es'>(initialLanguage)
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [clipUrls, setClipUrls] = useState<string[]>([])
  // Push #235 — when the user pastes a script with explicit [Pexels:] markers,
  // generate-video-fast returns the verbatim narration, captions, and a parsed
  // speed. We stash them here so kickCompose forwards the user's exact words +
  // speed instead of re-deriving narration from the analyze-idea brief.
  const [fastVoiceover, setFastVoiceover] = useState<string | null>(null)
  const [fastCaptions, setFastCaptions] = useState<string[] | null>(null)
  const [ttsSpeed, setTtsSpeed] = useState<number | null>(null)
  // feature/ai-avatar — premium talking-avatar state. avatarImageUrl = the
  // uploaded face photo (public storage URL, set by <AvatarUpload/>);
  // avatarRequestId = the in-flight VEED fal-queue job; avatarComposeRef =
  // everything kickCompose needs to render in avatar mode (the pre-made
  // voiceover + the finished talking-head MP4 — compose must NOT re-do TTS
  // or lips desync).
  const [avatarImageUrl, setAvatarImageUrl] = useState<string | null>(null)
  const [avatarRequestId, setAvatarRequestId] = useState<string | null>(null)
  // Bug 12/06 — photo picked in <AvatarUpload/> but "Use this face" never
  // pressed. Generate must NOT silently render a faceless video in that state.
  const [avatarPending, setAvatarPending] = useState(false)
  const [avatarOpenSignal, setAvatarOpenSignal] = useState(0)
  // Face-app wave 1 — saved face (avatar library), engine choice and the free
  // voice preview (dryRun TTS: hear the narration before spending a credit).
  const [savedFaceUrl, setSavedFaceUrl] = useState<string | null>(null)
  const [avatarEngine, setAvatarEngine] = useState<'fabric' | 'omnihuman'>('fabric')
  const avatarEngineRef = useRef<'fabric' | 'omnihuman'>('fabric')
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null)
  const [voicePreviewLoading, setVoicePreviewLoading] = useState(false)
  const [voicePreviewError, setVoicePreviewError] = useState<string | null>(null)
  // Face-app wave 1 — Hook Avatar: the face speaks only the first ~8s and
  // b-roll carries the rest (same 1 credit, ~85% lower engine cost). Default
  // ON — it's the recommended, margin-friendly mode. 'full' = legacy.
  const [avatarHookMode, setAvatarHookMode] = useState(true)
  // KINEO-AVATAR-PACKS-RETIRED-2026-07-06 — the separate avatarCredits balance
  // state and showAvatarPaywall modal state were removed. The avatar-pack
  // paywall sold the now-unspendable avatar_credits; avatar videos cost 120
  // universal credits and the 402 routes to the universal upgrade modal.
  // /generate?avatar=1 still deep-links to auto-open the upload panel.
  const avatarAutoOpen = searchParams.get('avatar') === '1'
  const avatarComposeRef = useRef<{
    voiceoverUrl: string
    realAudioDuration: number | null
    avatarVideoUrl: string | null
    // Face-app wave 1 — Hook Avatar: seconds of avatar at the head of the
    // timeline (null = legacy full-length avatar with cutaways).
    hookSeconds: number | null
  } | null>(null)
  // Push #315 — fal.ai polling state for Cinematic AI mode.
  const [falRequestIds, setFalRequestIds] = useState<(string | null)[]>([])
  const [falClipsDone, setFalClipsDone] = useState<{ done: number; total: number }>({ done: 0, total: 0 })
  const [renderId, setRenderId] = useState<string | null>(null)
  // Phase 3 — B-roll Intelligence / Creator Mode
  const [brollPlan, setBrollPlan] = useState<BrollPlan | null>(null)
  const [brollPlanLoading, setBrollPlanLoading] = useState(false)
  const [renderProgress, setRenderProgress] = useState<number>(0)
  const [generateProgress, setGenerateProgress] = useState<number>(0)
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null)
  // #465 — the saved video's DB id, for the public /v/[id] share link on the
  // done screen (share at peak delight → growth loop).
  const [publicVideoId, setPublicVideoId] = useState<string | null>(null)
  const [sharedPublic, setSharedPublic] = useState<'shared' | 'copied' | 'ready' | null>(null)
  const [shareReferralCode, setShareReferralCode] = useState<string | null>(null)
  const sharePromptRef = useRef<HTMLButtonElement | null>(null)
  const sharePromptTrackedKeyRef = useRef<string | null>(null)

  // KINEO-WM-CHECKOUT-2026-07-07 — "watermark moment" inline checkout.
  // A free-plan video ships with a burnt-in watermark. Right after the render
  // we offer one recurring Starter path. After checkout, Stripe returns to
  // /generate?wm_unlock=1 and we re-render THIS same video clean
  // (watermark:false), then swap it into the preview.
  //  - hasPaid: true once the user bought a pack or plan (hides the CTA).
  //  - wmUnlocking: true while the clean re-render is running post-purchase.
  //  - lastFastRenderRef: the exact inputs of the just-made non-avatar video, so the
  //    clean re-render reproduces the SAME video (not a fresh random one).
  const [hasPaid, setHasPaid] = useState(false)
  const [wmUnlocking, setWmUnlocking] = useState(false)
  const [wmUnlockError, setWmUnlockError] = useState<string | null>(null)
  const [watermarkedDownloadConfirmed, setWatermarkedDownloadConfirmed] = useState(false)
  const lastFastRenderRef = useRef<FastRenderInputs | null>(null)
  const wmUnlockRanRef = useRef(false)
  const postVideoOfferRef = useRef<HTMLDivElement | null>(null)
  const postVideoOfferTrackedKeyRef = useRef<string | null>(null)

  // Push #045A — transient "Copied!" feedback on the Copy URL button in the
  // result section. Cleared automatically after ~2s.

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
  const [showFirstShortNudge, setShowFirstShortNudge] = useState(false) // #379 — new-user onboarding nudge
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
  // KINEO-TAAFT-REVIEW-2026-07-14 — the post-render TAAFT review ask that
  // used to be wired here (signup-source state + localStorage gate + shown
  // event) moved wholesale into <TaaftReviewAsk/> so the gating logic lives
  // next to the card it gates; see the render site in the success branch.
  // KINEO-SPRINT-OFFER-2026-07-14 — lifetime successful-render counter
  // (localStorage 'kineo_render_count', incremented once per completed
  // render by the effect below). Passed to <TaaftReviewAsk/>, which only
  // asks for a review from the 2nd render on — render #1 belongs to the
  // upgrade offer, not to a review ask competing in the same viewport.
  const [renderCount, setRenderCount] = useState<number>(0)
  const renderCountedRef = useRef(false)
  // Fast-mode-specific staged progress index (0..3). The real backend is
  // a single roundtrip; this drives a 4-step visual that auto-advances on
  // a timer so the wait feels intentional.
  const [fastStep, setFastStep] = useState<number>(0)

  // Push #098 — out-of-credits upgrade modal. Opened when the user clicks
  // any Generate/Analyze/Generate-Similar CTA while credits <= 0. Routes
  // through /api/stripe/checkout?tier=basic (GET redirect to Stripe).
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  // KINEO-PLAN-GATE-MODAL-2026-07-05 — why the upsell modal opened: 'credits'
  // (real shortage) vs 'studio'/'creator' (engine needs a higher plan). Drives an
  // accurate headline instead of a misleading "out of credits" for users who HAVE
  // credits but picked a plan-gated engine (e.g. Cinematic/Kling on Starter).
  const [upgradeReason, setUpgradeReason] = useState<'credits' | 'studio' | 'creator'>('credits')
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
// Push #095 — player resilience. When the B2/Creatomate CDN returns a 503
  // or hasn't propagated yet, the <video> element used to spin forever in
  // readyState 0. playerFailed flips true after the full retry budget is
  // spent so the UI can swap in a friendly fallback instead of an empty
  // spinner. The refs hold retry bookkeeping outside React state so timers
  // don't trigger re-renders mid-backoff.
  const [playerFailed, setPlayerFailed] = useState(false)

  // Push #317 — YouTube auto-upload state
  const [ytConnected, setYtConnected] = useState<boolean | null>(null) // null = not yet checked
  const [ytUploading, setYtUploading] = useState(false)
  const [ytResult, setYtResult] = useState<{ videoId: string; youtubeUrl: string } | null>(null)
  const [ytError, setYtError] = useState<string | null>(null)

  // Idempotency flag for /api/compose/status — once we see `done` we tell the
  // server not to deduct credits again on subsequent polls.
  const deductedRef = useRef<boolean>(false)
  const composeStartedRef = useRef<boolean>(false)
  // True when the current generation used the fal.ai cinematic pipeline, so the
  // compose call records quality 'cinematic_ai' (and deducts 20 credits) reliably,
  // avoiding stale `quality` state in the compose effect closure.
  const falUsedRef = useRef<boolean>(false)
  // #401 — which fal engine ran this generation (Seedance or Kling). The clip
  // status poll must hit the same endpoint, so we thread it from the
  // generate-video-cinematic response into the ?model= query param.
  const falModelRef = useRef<string>('')
  // #402 — quality returned by the cinematic route ('cinematic_ai' = Seedance/30
  // or 'cinematic_kling' = Kling/50). Drives the credit cost in compose/status.
  const falQualityRef = useRef<string>('cinematic_ai')
  // KINEO-HOLLYWOOD-2026-07-09 — Hollywood Mode per-scene metadata from the
  // generate-video-cinematic response. falModelsRef is PARALLEL to the request
  // ids (each scene polls its own fal endpoint via &models=); the other three
  // ride along to /api/compose (per-clip volume + block TTS). Empty for every
  // non-hollywood generation, which keeps the classic single-model poll intact.
  const falModelsRef = useRef<string[]>([])
  const sceneEnginesRef = useRef<string[]>([])
  const sceneNarrationsRef = useRef<(string | null)[]>([])
  const sceneSecondsRef = useRef<number[]>([])
  // KINEO-HOLLYWOOD-21-2026-07-10 (bug b) — the EXACT spoken line per dialogue
  // scene (null for the rest), parallel to the other scene refs. Rides to
  // /api/compose so dialogue captions show the REAL speech, not a generic caption.
  const sceneDialoguesRef = useRef<(string | null)[]>([])
  // #362 — holds the full structured script (with [Pexels:]/HOOK markers) so the
  // editable textarea can show a CLEAN, marker-free preview while submission still
  // uses the marked-up version the verbatim pipeline needs. Cleared on manual edit.
  const structuredScriptRef = useRef<string | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const autoAnalyzeKeyRef = useRef<string | null>(null)
  const seriesLandingKeyRef = useRef<string | null>(null)
  // Push #095 — player retry bookkeeping. attempt counts how many retries
  // have fired (0..4); the two timer refs hold the in-flight setTimeout
  // handles so we can cancel them on canplay/cleanup.
  const playerRetryAttemptRef = useRef<number>(0)
  const playerWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playerRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Persist every meaningful pipeline transition. Historically, the only
  // durable points were "analyze clicked" and "compose finished", so preview
  // abandonment, API rejects and interrupted polling all looked identical.
  useEffect(() => {
    const previousPhase = prevPhaseRef.current
    if (previousPhase === phase) return

    if (process.env.NODE_ENV === 'development') {
      console.log(`[ux1] PHASE ${previousPhase} -> ${phase} @${Date.now()}`)
    }

    const attemptId = generationAttemptRef.current
    if (attemptId) {
      const effectiveQuality = falUsedRef.current
        ? falQualityRef.current
        : mode === 'fast' || mode === 'creator'
          ? 'fast'
          : quality
      const metadata = {
        attempt_id: attemptId,
        stage: phase,
        previous_stage: previousPhase,
        mode,
        quality: effectiveQuality,
        duration,
        generation_id: generationId,
        render_id: renderId,
      }

      trackEvent('generation_stage_reached', metadata)

      if (phase === 'failed' && lastFailedAttemptRef.current !== attemptId) {
        lastFailedAttemptRef.current = attemptId
        const failureMetadata = {
          ...metadata,
          failed_from_stage: previousPhase,
          error: error?.slice(0, 180) ?? 'unknown',
        }
        trackEvent('generate_failed', failureMetadata)
        trackEvent('video_generation_failed', failureMetadata)
        trackEvent('generation_stage_error', failureMetadata)
      } else if (phase === 'idle' && error) {
        trackEvent('generation_stage_error', {
          ...metadata,
          failed_from_stage: previousPhase,
          error: error.slice(0, 180),
        })
      }
    }

    prevPhaseRef.current = phase
    // Stage metadata intentionally snapshots the state committed with `phase`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    if (phase !== 'done' && phase !== 'failed') return
    resumedRenderRef.current = false
    try { localStorage.removeItem(activeRenderStorageKey()) } catch { /* ignore */ }
  }, [phase])

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [])

  // Resume an accepted Creatomate job after a reload/navigation instead of
  // silently orphaning the render or starting a duplicate job.
  useEffect(() => {
    if (activeRenderRestoreCheckedRef.current) {
      activeRenderRestoreResolvedRef.current = true
      setActiveRenderRestoreResolved(true)
      return
    }
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let canResolve = true
    const skipRestore = searchParams?.get('wm_unlock') === '1'

    ;(async () => {
      try {
        const supabase = createClient()

        // A brand-new visitor normally has no render snapshot to restore. In
        // that case there is nothing that can race a first generation, so
        // release the UI gate immediately instead of making the first-video
        // click wait on a remote auth round-trip. We still resolve the user in
        // the background so any new render can persist a user-bound recovery
        // snapshot. When a snapshot does exist, the verified-user checks below
        // remain mandatory before it is resumed.
        const raw = skipRestore ? null : localStorage.getItem(activeRenderStorageKey())
        if (skipRestore) {
          try { localStorage.removeItem(activeRenderStorageKey()) } catch { /* ignore */ }
        }
        if (!raw) {
          activeRenderRestoreCheckedRef.current = true
          activeRenderRestoreResolvedRef.current = true
          setActiveRenderRestoreResolved(true)

          const { data: { user } } = await supabase.auth.getUser()
          if (!cancelled && user) currentUserIdRef.current = user.id
          return
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (cancelled) return
        // A transient auth/network failure must not destroy the only pointer to
        // an already accepted paid render. The status request will handle a
        // confirmed 401 and route the user through login with the snapshot kept.
        if (authError) {
          canResolve = false
          retryTimer = setTimeout(() => {
            if (!cancelled) setActiveRenderRestoreRetry((value) => value + 1)
          }, 1500)
          return
        }
        if (!user) {
          canResolve = false
          redirectToLoginPreservingPrompt()
          return
        }
        currentUserIdRef.current = user.id
        let stored: Partial<ActiveRenderSnapshot>
        try {
          stored = JSON.parse(raw) as Partial<ActiveRenderSnapshot>
        } catch {
          localStorage.removeItem(activeRenderStorageKey())
          return
        }
        const startedAt = Number(stored.startedAt)
        const age = Date.now() - startedAt
        const storedStage = stored.stage === 'avatar_submitting'
          ? 'avatar_submitting'
          : stored.stage === 'submitting'
            ? 'submitting'
            : 'rendering'
        const renderId = typeof stored.renderId === 'string' ? stored.renderId.trim() : ''
        const composePayload = stored.composePayload && typeof stored.composePayload === 'object' && !Array.isArray(stored.composePayload)
          ? stored.composePayload as Record<string, unknown>
          : null
        const payloadGenerationId = typeof composePayload?.generationId === 'string' ? composePayload.generationId.trim() : ''
        const avatarPayload = stored.avatarPayload && typeof stored.avatarPayload === 'object' && !Array.isArray(stored.avatarPayload)
          ? stored.avatarPayload as Record<string, unknown>
          : null
        const avatarGenerationId = typeof avatarPayload?.generationId === 'string' ? avatarPayload.generationId.trim() : ''
        if (
          stored.userId !== user.id ||
          !Number.isFinite(startedAt) ||
          age < 0 ||
          age > ACTIVE_RENDER_TTL_MS ||
          (storedStage === 'rendering' && (!renderId || renderId.length > 160)) ||
          (storedStage === 'submitting' && (!composePayload || !/^[A-Za-z0-9_-]{8,100}$/.test(payloadGenerationId))) ||
          (storedStage === 'avatar_submitting' && (!avatarPayload || !/^[A-Za-z0-9_-]{8,100}$/.test(avatarGenerationId)))
        ) {
          localStorage.removeItem(activeRenderStorageKey())
          return
        }

        const restoredDuration: Duration = stored.duration === 60 || stored.duration === 90 ? stored.duration : 45
        const restoredQuality = typeof stored.quality === 'string' ? stored.quality : 'basic_ai'
        const restoredMode: GenerationMode =
          stored.mode === 'fast' || stored.mode === 'creator' || stored.mode === 'cinematic' || stored.mode === 'cinematic_ai'
            ? stored.mode
            : restoredQuality === 'fast'
              ? 'fast'
              : restoredQuality.startsWith('cinematic_')
                ? 'cinematic_ai'
                : 'cinematic'
        const restoredAttemptId =
          typeof stored.attemptId === 'string' && stored.attemptId.length <= 80
            ? stored.attemptId
            : newGenerationAttemptId()

        generationAttemptRef.current = restoredAttemptId
        composeStartedRef.current = storedStage !== 'avatar_submitting'
        resumedRenderRef.current = true
        composingPollErrorsRef.current = 0
        setPrompt(typeof stored.prompt === 'string' ? stored.prompt.slice(0, 1000) : '')
        setDuration(restoredDuration)
        setMode(restoredMode)
        lastFastRenderRef.current = normalizeFastRenderInputs(stored.unlockInputs) ?? null
        falUsedRef.current = restoredQuality.startsWith('cinematic_') || restoredQuality === 'avatar' || restoredQuality === 'presenter'
        if (restoredQuality === 'fast' || restoredQuality === 'basic' || restoredQuality === 'basic_ai' || restoredQuality === 'pro') {
          setQuality(restoredQuality)
        } else if (restoredQuality.startsWith('cinematic_') || restoredQuality === 'avatar' || restoredQuality === 'presenter') {
          falQualityRef.current = restoredQuality
          setQuality('cinematic_ai')
        }
        const urlPrompt = searchParams?.get('prompt')?.trim()
        if (urlPrompt) autoAnalyzeKeyRef.current = urlPrompt

        if (storedStage === 'avatar_submitting' && avatarPayload) {
          setGenerationId(avatarGenerationId)
          setGenerateProgress(8)
          setError('Your avatar is safe. Reconnecting to the same submission…')
          setPhase('generating')
          void submitDashboardAvatarGeneration(avatarPayload, avatarGenerationId, startedAt, true)
          return
        }

        if (storedStage === 'submitting' && composePayload) {
          setRenderProgress(5)
          setError('Your render is safe. Reconnecting to the same submission…')
          setPhase('composing')
          let reconnectAttempt = 0
          while (!cancelled) {
            let res: Response
            let data: Record<string, unknown> | null
            try {
              res = await fetch('/api/compose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(composePayload),
              })
              data = await res.json().catch(() => null) as Record<string, unknown> | null
            } catch {
              reconnectAttempt += 1
              await new Promise((resolve) => setTimeout(resolve, reconnectAttempt <= 4 ? 3000 : 10000))
              continue
            }
            if (cancelled) return
            if (res.status === 401) {
              canResolve = false
              redirectToLoginPreservingPrompt()
              return
            }
            if ((res.status === 409 && data?.pending === true) || res.status === 503) {
              reconnectAttempt += 1
              const retryAfter = typeof data?.retry_after_ms === 'number'
                ? Math.max(1000, Math.min(10000, data.retry_after_ms))
                : reconnectAttempt <= 4 ? 3000 : 10000
              await new Promise((resolve) => setTimeout(resolve, retryAfter))
              continue
            }
            if (res.status === 402) {
              localStorage.removeItem(activeRenderStorageKey())
              resumedRenderRef.current = false
              setError(typeof data?.error === 'string' ? data.error : "You've hit today's free limit.")
              setPhase('options')
              return
            }
            if (!res.ok) {
              localStorage.removeItem(activeRenderStorageKey())
              resumedRenderRef.current = false
              setError(typeof data?.error === 'string' ? data.error : GENERIC_ERROR)
              setPhase('failed')
              return
            }
            const recoveredRenderId = typeof data?.render_id === 'string' ? data.render_id.trim() : ''
            if (!recoveredRenderId || recoveredRenderId.length > 160) {
              localStorage.removeItem(activeRenderStorageKey())
              resumedRenderRef.current = false
              setError(GENERIC_ERROR)
              setPhase('failed')
              return
            }
            const renderingSnapshot: ActiveRenderSnapshot = {
              stage: 'rendering',
              renderId: recoveredRenderId,
              userId: user.id,
              quality: restoredQuality,
              mode: restoredMode,
              duration: restoredDuration,
              prompt: typeof stored.prompt === 'string' ? stored.prompt.slice(0, 1000) : '',
              attemptId: restoredAttemptId,
              startedAt,
              ...(lastFastRenderRef.current ? { unlockInputs: lastFastRenderRef.current } : {}),
            }
            localStorage.setItem(activeRenderStorageKey(), JSON.stringify(renderingSnapshot))
            setError(null)
            setRenderId(recoveredRenderId)
            setRenderProgress(5)
            trackEvent('generation_render_resumed', {
              attempt_id: restoredAttemptId,
              render_id: recoveredRenderId,
              quality: restoredQuality,
              age_ms: age,
              recovered_from: 'compose_submission',
            })
            return
          }
          return
        }

        setRenderId(renderId)
        setRenderProgress(5)
        trackEvent('generation_render_resumed', {
          attempt_id: restoredAttemptId,
          render_id: renderId,
          quality: restoredQuality,
          age_ms: age,
        })
        setPhase('composing')
      } catch {
        // Preserve a syntactically valid snapshot on transient storage/auth
        // errors. A confirmed owner mismatch, expiry or malformed JSON above is
        // the only reason to delete it.
      } finally {
        if (!cancelled && canResolve) {
          activeRenderRestoreCheckedRef.current = true
          activeRenderRestoreResolvedRef.current = true
          setActiveRenderRestoreResolved(true)
        }
      }
    })()
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, activeRenderRestoreRetry])

  // Push #061 — fire a single page-view event on mount. Silently no-ops if
  // public.events isn't available in this Supabase project.
  useEffect(() => {
    trackEvent('generate_page_view')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // PUSH #24 — measure that a creator reached the generator through a
  // continuation CTA. The key allows several episodes in the same mounted tab
  // without double-counting a React re-render.
  useEffect(() => {
    if (searchParams?.get('series') !== '1') return
    const source = searchParams.get('continuation_source') ?? 'unknown'
    const seriesPrompt = searchParams.get('prompt')?.trim() ?? ''
    const key = `${source}:${seriesPrompt}`
    if (!seriesPrompt || seriesLandingKeyRef.current === key) return
    seriesLandingKeyRef.current = key
    trackEvent('series_continuation_landed', {
      source,
      prompt_length: seriesPrompt.length,
    })
  }, [searchParams])

  // Preload the referral code before the user's win moment. Web Share and
  // Clipboard require a live click gesture; awaiting a network request inside
  // handleSharePublic can consume that gesture and make both APIs fail.
  useEffect(() => {
    if (phase !== 'composing' || shareReferralCode) return
    let cancelled = false
    fetch('/api/referral', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return
        const code = typeof data?.code === 'string' ? data.code.trim().toUpperCase() : ''
        if (/^[A-HJ-NP-Z2-9]{8}$/.test(code)) setShareReferralCode(code)
      })
      .catch(() => {
        // Sharing without a referral code still works and keeps UTM attribution.
      })
    return () => { cancelled = true }
  }, [phase, shareReferralCode])

  // PUSH #29 — a finished render is not a share impression. The action sits
  // below a tall 9:16 player and the export choice, so count it only after the
  // button is actually visible.
  useEffect(() => {
    const element = sharePromptRef.current
    const key = publicVideoId
    if (phase !== 'done' || !element || !key || sharePromptTrackedKeyRef.current === key) return

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return
      sharePromptTrackedKeyRef.current = key
      void trackEvent('video_share_prompt_viewed', {
        version: PUBLIC_VIDEO_SHARE_VERSION,
        video_id: key,
        where: 'done_screen',
        referral_attached: !!shareReferralCode,
      })
      observer.disconnect()
    }, { threshold: [0.5] })
    observer.observe(element)
    return () => observer.disconnect()
  }, [phase, publicVideoId, shareReferralCode])

  // Push #317 — check YouTube connection status once when the done screen appears.
  useEffect(() => {
    if (phase !== 'done') return
    if (ytConnected !== null) return // already checked
    fetch('/api/youtube/status')
      .then((r) => r.json())
      .then((d) => setYtConnected(!!d.connected))
      .catch(() => setYtConnected(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Push #188 / #378 — Google Ads "Signup - Free Trial" conversion on OAuth
  // signup (/auth/callback sets ?signup=1 for brand-new accounts). Label fixed
  // to SXGYCK (was SXGYCk). transaction_id = user id dedups; strip ?signup=1 so
  // a reload can't refire.
  useEffect(() => {
    if (searchParams.get('signup') !== '1') return
    ;(async () => {
      try {
        let uid = ''
        try {
          const supabase = createClient()
          const { data } = await supabase.auth.getUser()
          uid = data.user?.id ?? ''
        } catch {
          /* ignore */
        }
        if (typeof window !== 'undefined' && typeof (window as unknown as { gtag?: Function }).gtag === 'function') {
          ;(window as unknown as { gtag: Function }).gtag('event', 'conversion', {
            send_to: 'AW-18156258081/SXGYCK_VlrEcEKGGytFD',
            value: 1.0,
            currency: 'BRL',
            transaction_id: 'signup_' + (uid || `oauth_${Date.now()}`),
          })
        }
        const ttq = (window as unknown as { ttq?: { track: Function } }).ttq
        if (ttq && typeof ttq.track === 'function') {
          ttq.track('CompleteRegistration', { content_name: 'signup_oauth' })
        }
        // #383 — record signup attribution (gclid / utm_source / country) for
        // OAuth signups. Fire-and-forget; never throws, can't break the flow.
        trackSignupSource()
      } catch {
        /* non-blocking */
      } finally {
        try {
          const url = new URL(window.location.href)
          url.searchParams.delete('signup')
          router.replace(url.pathname + url.search)
        } catch {
          /* ignore */
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // #383 — robust attribution catch-all. Fires on EVERY authenticated arrival at
  // /generate (email signup→/generate, OAuth new→?signup=1, OAuth returning, or
  // email-confirm-later→login→/generate). trackSignupSource() de-dupes itself
  // per session and only "closes" once the server confirms a real session, so
  // a pending-confirmation signup gets recorded on the eventual first login.
  // Fire-and-forget — can never block or break the page.
  useEffect(() => {
    trackSignupSource()
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

  // #379 — Activation-first onboarding. Brand-new users arrive here right after
  // signup (email → ?welcome=1, Google OAuth → ?signup=1). Show a welcome nudge
  // and pre-fill an example idea so the box is never empty — maximizing who
  // generates their first Short immediately. Never overwrites a forwarded/typed
  // prompt (functional setState keeps an existing value).
  useEffect(() => {
    const isNewUser = searchParams?.get('signup') === '1' || searchParams?.get('welcome') === '1'
    if (!isNewUser) return
    setShowFirstShortNudge(true)
    try {
      const pending = sessionStorage.getItem('pendingVideoPrompt')
      if (pending && pending.trim()) return // a forwarded idea wins
    } catch {
      /* ignore */
    }
    setPrompt((p) => (p && p.trim() ? p : randomTopic()))
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
        // BUGFIX 05/07 (KINEO-CREDITS-FALSE-ZERO) — on a 500/503 (e.g. a transient
        // avatar_credits/DB blip) the response body has no `credits`, and the old
        // `: 0` fallback showed paying users (real balance!) as "out of credits"
        // and popped the upgrade modal mid-session. Treat any error / missing
        // balance as UNKNOWN (null), never zero: outOfCredits() ignores null, and
        // the realtime sub + next fetch fill in the true value.
        if (!res.ok) {
          if (!cancelled) setCredits(null)
          return
        }
        const data = await res.json()
        if (!cancelled) {
          setCredits(typeof data.credits === 'number' ? data.credits : null)
          // KINEO-AVATAR-PACKS-RETIRED-2026-07-06 — avatarCredits no longer read
          // into state (paywall retired). The endpoint still returns it for any
          // legacy balance, but the generate flow ignores it now.
          // Face-app wave 1 — saved face for the one-click avatar library.
          if (typeof data.avatarFaceUrl === 'string' && data.avatarFaceUrl) setSavedFaceUrl(data.avatarFaceUrl)
          // #384 — refresh free-AI-trial availability from the same source.
          if (typeof data.freeAiUsed === 'boolean') setFreeAiUsed(data.freeAiUsed)
          // KINEO-WM-CHECKOUT-2026-07-07 — paid flag hides the "remove watermark" CTA.
          if (typeof data.hasPaid === 'boolean') setHasPaid(data.hasPaid)
          // #404 — plan flags + default the engine to the plan's engine once.
          if (typeof data.isStarter === 'boolean') setIsStarter(data.isStarter)
          if (typeof data.isCreator === 'boolean') setIsCreator(data.isCreator)
          if (typeof data.isStudio === 'boolean') setIsStudio(data.isStudio)
          if (!planDefaultedRef.current) {
            planDefaultedRef.current = true
            // #448 — Viral Now quick-entry (?autoanalyze=1) defaults to Fast (free)
            // so a niche click never pre-selects the 30-credit AI Gen. The user
            // upgrades to AI Gen deliberately (no accidental credit burn).
            const fromViralNow = searchParams?.get('autoanalyze') === '1'
            if (fromViralNow) { setMode('fast') }
            else if (data.isStarter || (!data.isCreator && !data.isStudio)) { setMode('fast') }
            // Fix 03/07 — Studio also defaults to Seedance (40cr): Kling (60cr) kept
            // pre-selecting itself on every load for Studio accounts (reported 5x),
            // silently costing +20cr per video. Kling stays one manual click away.
            else { setMode('cinematic_ai'); setAiEngine('seedance') } // final access check stays server-side
          }
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

  // Supabase Realtime — push the new balance to this page the instant the
  // user's profiles row changes in the DB (purchase, deduction, top-up). The
  // `creditsChanged` event above only fires in the same window; this keeps the
  // chip in sync across tabs and on a phone browser too.
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return
      channel = supabase
        .channel('credits-realtime-generate')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          (payload) => {
            const row = payload.new as { video_credits?: number; cinematic_tokens?: number; has_paid?: boolean }
            if (typeof row.video_credits === 'number') setCredits(row.video_credits)
            if (typeof row.cinematic_tokens === 'number') setCinematicTokens(Math.max(0, row.cinematic_tokens))
            // KINEO-WM-CHECKOUT-2026-07-07 — the instant the pack webhook flips
            // has_paid, hide the "remove watermark" CTA across tabs.
            if (typeof row.has_paid === 'boolean') setHasPaid(row.has_paid)
          },
        )
        .subscribe()
    })
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
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

  // Push #087 — Fast/CinematicAI 4-step staged progress. Auto-advances every
  // ~8s while mid-generation so the long single roundtrip feels like progress.
  useEffect(() => {
    if (mode !== 'fast' && mode !== 'cinematic_ai' && mode !== 'creator') return
    const inLoading =
      phase === 'generating' || phase === 'fal_polling' || phase === 'avatar_polling' || phase === 'clips_ready' || phase === 'composing'
    if (!inLoading) {
      setFastStep(0)
      return
    }
    const interval = setInterval(() => {
      setFastStep((s) => Math.min(3, s + 1))
    }, 8000)
    return () => clearInterval(interval)
  }, [mode, phase])

  // Push #098 — generic 4-step generation progress indicator. Time-based
  // so it stays useful even when the backend phase doesn't change for a
  // while (the Pexels + TTS fast pipeline can sit in one phase for 30s+).
  //   0-8s   : ✍️ Writing your script...
  //   8-20s  : 🎙️ Generating voiceover...
  //   20-40s : 🎬 Finding footage...
  //   40s+   : ⚡ Rendering your Short...
  useEffect(() => {
    const isGenerating =
      phase === 'generating' || phase === 'fal_polling' || phase === 'avatar_polling' || phase === 'clips_ready' || phase === 'composing'
    if (!isGenerating) {
      setProgressStep(0)
      return
    }
    setProgressStep(0)
    const startedAt = Date.now()
    const interval = setInterval(() => {
      const elapsedSec = (Date.now() - startedAt) / 1000
      if (elapsedSec >= 40) setProgressStep(3)
      else if (elapsedSec >= 20) setProgressStep(2)
      else if (elapsedSec >= 8) setProgressStep(1)
      else setProgressStep(0)
    }, 1000)
    return () => clearInterval(interval)
  }, [phase])

  // Push #098 — welcome banner gating. Only shown on first visit when the
  // user still has >=1 credit and hasn't dismissed it. localStorage write
  // happens in the dismiss handler so a refresh between mount and dismiss
  // re-shows the banner (intentional — they didn't acknowledge yet).
  useEffect(() => {
    if (credits === null || credits < 1) {
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

  // Activation nudge — first-time users (no videos yet) hit a blank page, which
  // kills activation (only ~25% of signups ever generate). Pre-fill a proven
  // example so they can hit Generate immediately, and log a first-run event so
  // we can measure the signup -> first-generate drop-off.
  const firstRunPrefilledRef = useRef(false)
  useEffect(() => {
    if (firstRunPrefilledRef.current) return
    if (recentVideos === null) return          // still loading
    if (recentVideos.length > 0) return         // returning user
    if (fromHome) return                        // arrived with a topic already
    if (prompt.trim().length > 0) return        // user already typing
    firstRunPrefilledRef.current = true
    const ex = (NICHE_EXAMPLES[pickedNiche] ?? NICHE_EXAMPLES.billionaire)[0]
    if (ex) setPrompt(ex)
    trackEvent('activation_generate_firstrun', {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentVideos, fromHome])

  // Push #047 — rotate the staged-pipeline message every ~2.4s while we're
  // in a long-running phase. This is purely cosmetic — the actual progress
  // bar still tracks real API state. We reset the tick to 0 whenever we
  // leave a loading phase so the next run starts at message 0.
  useEffect(() => {
    const inLoadingPhase =
      phase === 'generating' || phase === 'fal_polling' || phase === 'avatar_polling' || phase === 'clips_ready' || phase === 'composing'
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
        if (res.status === 401) {
          trackEvent('generation_auth_expired', {
            attempt_id: generationAttemptRef.current,
            stage: 'generating',
          })
          redirectToLoginPreservingPrompt()
          return
        }
        if (!res.ok) throw new Error('Status lookup failed')
        if (generatingPollErrorsRef.current > 0) setError(null)
        generatingPollErrorsRef.current = 0

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
        const retry = ++generatingPollErrorsRef.current
        if (retry <= MAX_TRANSIENT_POLL_ERRORS) {
          trackEvent('generation_poll_retry', {
            attempt_id: generationAttemptRef.current,
            stage: 'generating',
            retry,
          })
          pollTimerRef.current = setTimeout(poll, POLL_GENERATING_MS * Math.min(retry, 2))
          return
        }
        if (retry === MAX_TRANSIENT_POLL_ERRORS + 1) {
          trackEvent('generation_poll_degraded', {
            attempt_id: generationAttemptRef.current,
            stage: 'generating',
          })
        }
        setError('Your clips are still rendering. We are reconnecting automatically — please keep this tab open.')
        pollTimerRef.current = setTimeout(poll, 15000)
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
  // PHASE: fal_polling  →  Push #315 — poll fal.ai clip status every 6s.
  // When all clips are done (or failed), collect URLs and move to clips_ready.
  // ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'fal_polling') return
    if (falRequestIds.length === 0) return
    if (!generationId) return
    let cancelled = false

    async function pollFal() {
      try {
        const idsEncoded = encodeURIComponent(JSON.stringify(falRequestIds))
        const modelQ = falModelRef.current ? `&model=${encodeURIComponent(falModelRef.current)}` : ''
        // KINEO-HOLLYWOOD-2026-07-09 — Hollywood generations carry one fal model
        // PER SCENE; the status route polls each clip on its own endpoint.
        const modelsQ = falModelsRef.current.length > 0 ? `&models=${encodeURIComponent(JSON.stringify(falModelsRef.current))}` : ''
        const generationQ = `&generationId=${encodeURIComponent(generationId!)}`
        const res = await fetch(`/api/cinematic-clip-status?ids=${idsEncoded}${modelQ}${modelsQ}${generationQ}`, { cache: 'no-store' })
        const data = await res.json()
        if (cancelled) return

        if (!res.ok) {
          if (res.status === 502) {
            setError(data?.error ?? 'AI clip generation failed. Please try again.')
            setPhase('failed')
            return
          }
          // Retry on other errors
          pollTimerRef.current = setTimeout(pollFal, 6000)
          return
        }

        const done = typeof data.done === 'number' ? data.done : 0
        const total = typeof data.total === 'number' ? data.total : falRequestIds.length
        setFalClipsDone({ done, total })
        setGenerateProgress(total > 0 ? Math.round((done / total) * 85) : 0)

        if (data.allDone) {
          // Collect all successful clip URLs
          const urls: string[] = (data.clips ?? [])
            .filter((c: { status: string; url: string | null }) => c.status === 'done' && c.url)
            .map((c: { url: string }) => c.url)

          if (urls.length === 0) {
            setError('All AI clips failed to generate. Please try again.')
            setPhase('failed')
            return
          }

          // KINEO-HOLLYWOOD-2026-07-09 — keep the per-scene metadata PARALLEL
          // to the surviving clip URLs: if a scene's clip failed, drop its
          // engine/narration/seconds entry too (compose relies on alignment).
          if (sceneEnginesRef.current.length > 0) {
            const doneIdx: number[] = (data.clips ?? [])
              .map((c: { status: string; url: string | null }, i: number) => (c.status === 'done' && c.url ? i : -1))
              .filter((i: number) => i >= 0)
            sceneEnginesRef.current = doneIdx.map((i) => sceneEnginesRef.current[i] ?? 'support')
            sceneNarrationsRef.current = doneIdx.map((i) => sceneNarrationsRef.current[i] ?? null)
            sceneSecondsRef.current = doneIdx.map((i) => sceneSecondsRef.current[i] ?? 10)
            // KINEO-HOLLYWOOD-21-2026-07-10 (bug b) — keep the dialogue lines
            // parallel to the surviving clips too.
            sceneDialoguesRef.current = doneIdx.map((i) => sceneDialoguesRef.current[i] ?? null)
            // Captions ride to compose as scene_captions — keep them parallel too.
            setFastCaptions((prev) => (prev ? doneIdx.map((i) => prev[i] ?? '') : prev))
          }

          setClipUrls(urls)
          setGenerateProgress(100)
          setPhase('clips_ready')
          return
        }

        // Not all done yet — keep polling
        pollTimerRef.current = setTimeout(pollFal, 6000)
      } catch (err) {
        if (cancelled) return
        console.error('[generate] fal poll error:', err)
        pollTimerRef.current = setTimeout(pollFal, 8000)
      }
    }

    pollTimerRef.current = setTimeout(pollFal, 4000)
    return () => {
      cancelled = true
      if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null }
    }
  }, [phase, falRequestIds, generationId])

  // ────────────────────────────────────────────────────────────────────────
  // PHASE: avatar_polling  →  poll /api/avatar-status until the VEED talking
  // head is ready, then hand off to clips_ready (compose). feature/ai-avatar.
  // ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'avatar_polling' || !avatarRequestId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function poll() {
      try {
        // Face-app wave 1 — the fal queue is per-model: pass the engine the
        // job was submitted with, or an OmniHuman job would poll Fabric's
        // queue and never complete.
        const res = await fetch(
          `/api/avatar-status?request_id=${encodeURIComponent(avatarRequestId as string)}&engine=${avatarEngineRef.current}`,
          { cache: 'no-store' },
        )
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.status === 401) {
          redirectToLoginPreservingPrompt()
          return
        }
        if (!res.ok) {
          if (res.status === 408 || res.status === 425 || res.status === 429 || res.status >= 500) {
            throw new Error('Avatar status temporarily unavailable')
          }
          setError(typeof data?.error === 'string' ? data.error : 'This avatar can no longer be resumed.')
          setPhase('failed')
          return
        }

        if (data.status === 'done' && typeof data.video_url === 'string' && data.video_url) {
          setError(null)
          if (avatarComposeRef.current) avatarComposeRef.current.avatarVideoUrl = data.video_url
          setPhase('clips_ready') // kicks /api/compose with avatar_url + voiceover_url
          return
        }
        if (data.status === 'failed') {
          // Protection rule surfaced to the user: a VEED failure charges nothing.
          setError(typeof data.error === 'string' ? data.error : 'Avatar generation failed. You were not charged — please try again.')
          setPhase('failed')
          return
        }
        timer = setTimeout(poll, POLL_COMPOSING_MS)
      } catch (err) {
        if (cancelled) return
        console.error('[generate] avatar poll error:', err)
        setError('Your avatar is still rendering. Reconnecting automatically…')
        timer = setTimeout(poll, 7000)
      }
    }

    timer = setTimeout(poll, 2000)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, avatarRequestId])

  // ────────────────────────────────────────────────────────────────────────
  // KINEO-WM-CHECKOUT-2026-07-07 — return from the $4.90 "remove watermark"
  // checkout. Re-render the SAME Fast video WITHOUT the watermark and swap it
  // into the preview. Payment is verified server-side (webhook-independent) by
  // /api/compose/unlock, which also flips has_paid so future renders stay clean.
  useEffect(() => {
    if (wmUnlockRanRef.current) return
    if (searchParams?.get('wm_unlock') !== '1') return
    const sessionId = searchParams?.get('session_id') ?? ''
    wmUnlockRanRef.current = true

    let stored: {
      clip_urls?: string[]
      voiceover_script?: string
      scene_captions?: string[]
      duration?: number
      topic?: string
      language?: string
      vertical?: string
      speed?: number
    } | null = null
    try {
      const raw = localStorage.getItem('kineo_wm_unlock')
      if (raw) stored = JSON.parse(raw)
    } catch { /* ignore */ }
    if (!sessionId) {
      setWmUnlocking(false)
      return
    }

    const inputs = stored ?? {}
    setWmUnlocking(true)
    setWmUnlockError(null)
    let cancelled = false
    ;(async () => {
      try {
        let res: Response | null = null
        let data: Record<string, unknown> | null = null
        let reconnectAttempt = 0
        while (!cancelled) {
          try {
            res = await fetch('/api/compose/unlock', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ session_id: sessionId, ...inputs }),
            })
            data = await res.json().catch(() => null) as Record<string, unknown> | null
          } catch {
            reconnectAttempt += 1
            if (reconnectAttempt >= 12) throw new Error('unlock reconnect exhausted')
            setWmUnlockError('Your purchase is safe. Reconnecting to the same clean render…')
            await new Promise((resolve) => setTimeout(resolve, reconnectAttempt <= 4 ? 2500 : 5000))
            continue
          }
          if ((res.status === 409 || res.status === 503) && data?.pending === true && reconnectAttempt < 12) {
            reconnectAttempt += 1
            const retryAfter = typeof data.retry_after_ms === 'number'
              ? Math.max(1000, Math.min(7000, data.retry_after_ms))
              : 3000
            setWmUnlockError('Your purchase is safe. Reconnecting to the same clean render…')
            await new Promise((resolve) => setTimeout(resolve, retryAfter))
            continue
          }
          break
        }
        if (cancelled || !res) return
        if (!res.ok || data?.verified !== true) {
          setWmUnlocking(false)
          setWmUnlockError(
            typeof data?.error === 'string'
              ? data.error
              : "We couldn't verify this checkout yet. Refresh in a moment or open Account to confirm your plan.",
          )
          return
        }

        // Only a Stripe-verified session may unlock paid UI. Keep the return
        // params and saved render until this point so a temporary failure can be
        // retried safely with a refresh.
        setHasPaid(true)
        try { window.dispatchEvent(new Event('creditsChanged')) } catch { /* ignore */ }
        try { localStorage.removeItem('kineo_wm_unlock') } catch { /* ignore */ }
        try {
          const url = new URL(window.location.href)
          url.searchParams.delete('wm_unlock')
          url.searchParams.delete('session_id')
          window.history.replaceState({}, '', url.toString())
        } catch { /* ignore */ }

        // A valid return from another browser has no captured render to rebuild.
        if (typeof data.render_id !== 'string') {
          setWmUnlocking(false)
          return
        }
        // Reuse the standard composing → done pipeline to swap in the clean video.
        falUsedRef.current = false
        deductedRef.current = false
        composeStartedRef.current = true // block the clips_ready effect from firing
        if (typeof inputs.duration === 'number') setDuration(inputs.duration as Duration)
        if (typeof inputs.topic === 'string') setPrompt(inputs.topic)
        setQuality('fast')
        setMode('fast')
        setRenderId(data.render_id)
        setRenderProgress(5)
        setPhase('composing')
      } catch {
        setWmUnlocking(false)
        setWmUnlockError(
          "We couldn't verify this checkout yet. Refresh in a moment or open Account to confirm your plan.",
        )
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // KINEO-WM-CHECKOUT-2026-07-07 — clear the "removing watermark…" state once the
  // clean re-render lands (or if it fails).
  useEffect(() => {
    if (phase === 'done' || phase === 'failed') setWmUnlocking(false)
  }, [phase])

  // KINEO-SPRINT-OFFER-2026-07-14 — count each SUCCESSFUL render once
  // (localStorage survives reloads; the ref stops double-counting while we
  // stay in the same 'done' phase). Storage failure → count stays 0 and the
  // TAAFT review ask simply never shows (fail-hidden, never fail-broken).
  useEffect(() => {
    if (phase !== 'done' || !finalVideoUrl) {
      renderCountedRef.current = false
      return
    }
    if (renderCountedRef.current) return
    renderCountedRef.current = true
    try {
      const prev = parseInt(localStorage.getItem('kineo_render_count') ?? '0', 10)
      const next = (Number.isFinite(prev) ? prev : 0) + 1
      localStorage.setItem('kineo_render_count', String(next))
      setRenderCount(next)
    } catch {
      // private mode / storage blocked — review ask stays gated off
    }
  }, [phase, finalVideoUrl])

  // PUSH #25 — measure a real offer impression, not merely an eligible render.
  // The result player is tall on mobile, so the clean-export card can exist
  // below the fold without ever being seen. Count it only after at least half
  // of the card enters the viewport, once per finished asset.
  useEffect(() => {
    const eligible = phase === 'done' && Boolean(finalVideoUrl) && planTier === 'free' &&
      !hasPaid && !wmUnlocking && Boolean(lastFastRenderRef.current)
    const element = postVideoOfferRef.current
    const offerKey = publicVideoId || finalVideoUrl
    if (!eligible || !element || !offerKey || postVideoOfferTrackedKeyRef.current === offerKey) return

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return
      postVideoOfferTrackedKeyRef.current = offerKey
      trackEvent('post_video_offer_viewed', {
        source: 'result_export_choice',
        offer: 'starter_intro_month',
      })
      observer.disconnect()
    }, { threshold: [0.5] })
    observer.observe(element)
    return () => observer.disconnect()
  }, [phase, finalVideoUrl, publicVideoId, planTier, hasPaid, wmUnlocking])

  // ────────────────────────────────────────────────────────────────────────
  // PHASE: clips_ready  →  fire /api/compose once, then transition to composing
  // ────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'clips_ready') return
    if (composeStartedRef.current) return
    // feature/ai-avatar — an avatar render may carry zero stock clips (the
    // talking head fills the timeline); every other path still requires clips.
    if (clipUrls.length === 0 && !avatarComposeRef.current?.avatarVideoUrl) return
    composeStartedRef.current = true
    let cancelled = false

    async function kickCompose() {
      try {
        // Push #235 — when the fast endpoint returned a verbatim user script,
        // narrate THAT (and its captions) instead of the analyze-idea brief, and
        // forward the user's requested speed so compose skips word-count scaling.
        // KINEO-VOICEOVER-FALLBACK-2026-06-30 — nunca deixar narração vazia chegar
        // no /api/compose (ele quebra com "voiceover_script is required"). Se o
        // roteiro sair vazio (ex.: prompt puramente visual, sem nada pra narrar),
        // cai no próprio texto da ideia do usuário para o render não falhar.
        const builtVoiceover =
          fastVoiceover && fastVoiceover.trim().length > 0
            ? fastVoiceover
            : buildVoiceoverScript(prompt, analysis)
        const voiceoverScript =
          builtVoiceover && builtVoiceover.trim().length > 0
            ? builtVoiceover
            : (prompt ?? '').trim()
        const sceneCaptions =
          fastCaptions && fastCaptions.length > 0
            ? fastCaptions
            : buildSceneCaptions(analysis, scenes, duration)

        // KINEO-RECOVERY-2026-07-15 — remember the exact compositing inputs for
        // every non-avatar render, including generated AI scenes. The old Fast-
        // only guard made the default AI trial promise "unlock this video" even
        // though checkout could not reproduce it clean.
        if (!avatarComposeRef.current?.avatarVideoUrl) {
          lastFastRenderRef.current = {
            clip_urls: clipUrls,
            voiceover_script: voiceoverScript,
            scene_captions: sceneCaptions,
            duration,
            topic: prompt,
            language,
            vertical: analysis?.niche ?? undefined,
            speed: ttsSpeed ?? undefined,
          }
        }

        const composeGenerationId = generationId ?? generationAttemptRef.current ?? newGenerationAttemptId()
        if (!generationAttemptRef.current) generationAttemptRef.current = composeGenerationId
        const composePayload = {
            generationId: composeGenerationId,
            clip_urls: clipUrls,
            voiceover_script: voiceoverScript,
            scene_captions: sceneCaptions,
            duration,
            topic: prompt,
            quality: falUsedRef.current ? falQualityRef.current : quality,
            // KINEO-HOLLYWOOD-2026-07-09 — per-scene metadata (parallel to
            // clip_urls) so compose routes native-audio volume + block TTS.
            // Only sent for hollywood renders; every other mode is unchanged.
            ...(falUsedRef.current && falQualityRef.current === 'cinematic_hollywood' && sceneEnginesRef.current.length > 0
              ? {
                  scene_engines: sceneEnginesRef.current,
                  scene_narrations: sceneNarrationsRef.current,
                  scene_seconds: sceneSecondsRef.current,
                  // KINEO-HOLLYWOOD-21-2026-07-10 (bug b) — real spoken line
                  // per dialogue scene, for speech-matching captions.
                  scene_dialogues: sceneDialoguesRef.current,
                }
              : {}),
            language,
            // Narration Engine (Phase 1) — pass the detected niche as vertical
            // so compose auto-selects the best AI voice persona for the content.
            vertical: analysis?.niche ?? undefined,
            ...(ttsSpeed != null ? { speed: ttsSpeed } : {}),
            // KINEO-OWN-VOICE-2026-07-10 — Level A: the user's own narration
            // mp3 replaces TTS (captions from Whisper); Level B: narrate with
            // the cloned voice from the profile. Never both.
            ...(myVoiceUrl ? { user_voiceover_url: myVoiceUrl } : useClonedVoice ? { use_cloned_voice: true } : {}),
            // feature/ai-avatar — avatar render: pass the finished talking head
            // + the EXACT mp3 VEED lip-synced (compose skips TTS in this mode).
            ...(avatarComposeRef.current?.avatarVideoUrl
              ? {
                  avatar_url: avatarComposeRef.current.avatarVideoUrl,
                  voiceover_url: avatarComposeRef.current.voiceoverUrl,
                  ...(avatarComposeRef.current.realAudioDuration != null
                    ? { real_audio_duration: avatarComposeRef.current.realAudioDuration }
                    : {}),
                  // Face-app wave 1 — Hook Avatar: face covers [0, N]s only.
                  ...(avatarComposeRef.current.hookSeconds != null
                    ? { avatar_hook_seconds: avatarComposeRef.current.hookSeconds }
                    : {}),
                }
              : {}),
          }

        const attemptId = generationAttemptRef.current ?? newGenerationAttemptId()
        generationAttemptRef.current = attemptId
        const requestedComposeQuality = falUsedRef.current ? falQualityRef.current : quality
        const composeStartedAt = Date.now()
        if (currentUserIdRef.current) {
          try {
            const submittingSnapshot: ActiveRenderSnapshot = {
              stage: 'submitting',
              userId: currentUserIdRef.current,
              quality: requestedComposeQuality,
              mode,
              duration,
              prompt: prompt.slice(0, 1000),
              attemptId,
              startedAt: composeStartedAt,
              composePayload,
              ...(lastFastRenderRef.current ? { unlockInputs: lastFastRenderRef.current } : {}),
            }
            localStorage.setItem(activeRenderStorageKey(), JSON.stringify(submittingSnapshot))
          } catch {
            // In-tab reconnect still uses the same generation id without storage.
          }
        }

        let res: Response | null = null
        let data: Record<string, unknown> | null = null
        let reconnectAttempt = 0
        while (!cancelled) {
          try {
            res = await fetch('/api/compose', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(composePayload),
            })
            data = await res.json().catch(() => null) as Record<string, unknown> | null
          } catch (requestError) {
            // Only a server-correlated generation can be retried safely. The
            // distributed claim makes every retry converge on the same render.
            reconnectAttempt += 1
            setError('Your render is still being submitted. We are reconnecting automatically — please keep this tab open.')
            await new Promise((resolve) => setTimeout(resolve, reconnectAttempt <= 4 ? 3000 : 10000))
            continue
          }

          if ((res.status === 409 || res.status === 503) && data?.pending === true) {
            reconnectAttempt += 1
            const retryAfter = typeof data.retry_after_ms === 'number'
              ? Math.max(1000, Math.min(10000, data.retry_after_ms))
              : 3000
            setError('Your render is already being submitted. We are reconnecting to the same job — please keep this tab open.')
            await new Promise((resolve) => setTimeout(resolve, reconnectAttempt <= 8 ? retryAfter : 10000))
            continue
          }
          break
        }
        if (cancelled || !res) return
        if (reconnectAttempt > 0 && res.ok) setError(null)

        if (res.status === 401) {
          redirectToLoginPreservingPrompt()
          return
        }
        if (res.status === 402) {
          // KINEO-ZERO-SIGNUP follow-up (09/07) — 402 here now means the DAILY
          // FREE LIMIT (3 Fast/24h), not a real failure. The old phase('failed')
          // showed "Generation failed — Retry", which was wrong copy (nothing
          // failed) and Retry just hit the wall again. Return to the options
          // screen with the upgrade modal on top — nothing is lost, and closing
          // the modal leaves the user on their script, not on an error page.
          setError(typeof data?.error === 'string' ? data.error : "You've hit today's free limit.")
          try { localStorage.removeItem(activeRenderStorageKey()) } catch { /* ignore */ }
          openOutOfCreditsModal('credits')
          setPhase('options')
          return
        }
        if (!res.ok) {
          console.error('[generate] compose error:', data?.error)
          try { localStorage.removeItem(activeRenderStorageKey()) } catch { /* ignore */ }
          setError(typeof data?.error === 'string' ? data.error : GENERIC_ERROR)
          setPhase('failed')
          return
        }

        const id = typeof data?.render_id === 'string' ? data.render_id : null
        if (!id) {
          try { localStorage.removeItem(activeRenderStorageKey()) } catch { /* ignore */ }
          setError(GENERIC_ERROR)
          setPhase('failed')
          return
        }

        const persistedQuality =
          typeof data?.quality === 'string'
            ? data.quality
            : requestedComposeQuality
        if (currentUserIdRef.current) {
          try {
            const snapshot: ActiveRenderSnapshot = {
              stage: 'rendering',
              renderId: id,
              userId: currentUserIdRef.current,
              quality: persistedQuality,
              mode,
              duration,
              prompt: prompt.slice(0, 1000),
              attemptId,
              startedAt: composeStartedAt,
              ...(lastFastRenderRef.current ? { unlockInputs: lastFastRenderRef.current } : {}),
            }
            localStorage.setItem(activeRenderStorageKey(), JSON.stringify(snapshot))
          } catch {
            // Storage may be unavailable; the in-tab polling flow still works.
          }
        }
        resumedRenderRef.current = false
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
    return () => { cancelled = true }
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
        const params = new URLSearchParams({ quality: falUsedRef.current ? falQualityRef.current : quality })
        if (deductedRef.current) params.set('deducted', '1')
        // Every newly accepted render is owner-bound by a server intent. Always
        // require that authority; resume is a security gate, not just reload UX.
        params.set('resume', '1')
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
        if (!res.ok) {
          if (res.status === 401) {
            // Keep the user-bound snapshot intact across authentication so the
            // accepted job resumes instead of being submitted again.
            redirectToLoginPreservingPrompt()
            return
          }
          if (res.status === 408 || res.status === 425 || res.status === 429) {
            throw new Error(`Transient compose status (${res.status})`)
          }
          if (res.status === 400 || res.status === 403 || res.status === 404 || res.status === 410 || res.status === 422) {
            resumedRenderRef.current = false
            try { localStorage.removeItem(activeRenderStorageKey()) } catch { /* ignore */ }
            setError(typeof data?.error === 'string' ? data.error : 'This render can no longer be resumed. Please generate again.')
            setPhase('failed')
            return
          }
          throw new Error('Compose status lookup failed')
        }
        if (composingPollErrorsRef.current > 0) setError(null)
        composingPollErrorsRef.current = 0

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
          if (typeof data.video_id === 'string' && data.video_id) setPublicVideoId(data.video_id)
          try { localStorage.removeItem(activeRenderStorageKey()) } catch { /* ignore */ }
          setPhase('done')
          // Push #060 / #061 — fire-and-forget event tracking.
          const completionMetadata = {
            attempt_id: generationAttemptRef.current,
            render_id: renderId,
            duration,
            quality: falUsedRef.current ? falQualityRef.current : quality,
            resumed: resumedRenderRef.current,
            series_continuation: searchParams?.get('series') === '1',
            continuation_source: searchParams?.get('continuation_source') ?? null,
          }
          trackEvent('generate_completed', completionMetadata)
          trackEvent('video_generation_completed', completionMetadata)
          let completedFromOnboarding = onboardingGenerationDispatchedRef.current
          try {
            completedFromOnboarding = completedFromOnboarding ||
              sessionStorage.getItem(PUSH27_ONBOARDING_RENDER_SESSION_KEY) === '1'
          } catch { /* the in-memory ref is enough for the normal path */ }
          if (completedFromOnboarding) {
            onboardingGenerationDispatchedRef.current = false
            try { sessionStorage.removeItem(PUSH27_ONBOARDING_RENDER_SESSION_KEY) } catch {}
            trackEvent('first_video_generation_completed_from_viral_onboarding', {
              ...completionMetadata,
              source: 'viral_onboarding',
              version: 'push27_single_choice',
            })
          }
          return
        }

        if (data.phase === 'failed') {
          resumedRenderRef.current = false
          try { localStorage.removeItem(activeRenderStorageKey()) } catch { /* ignore */ }
          setError(typeof data.error === 'string' ? data.error : GENERIC_ERROR)
          setPhase('failed')
          return
        }

        setRenderProgress(typeof data.progress === 'number' ? data.progress : 0)
        pollTimerRef.current = setTimeout(poll, POLL_COMPOSING_MS)
      } catch (err) {
        if (cancelled) return
        console.error('[generate] composing poll error:', err)
        const retry = ++composingPollErrorsRef.current
        if (retry <= MAX_TRANSIENT_POLL_ERRORS) {
          trackEvent('generation_poll_retry', {
            attempt_id: generationAttemptRef.current,
            stage: 'composing',
            render_id: renderId,
            retry,
          })
          pollTimerRef.current = setTimeout(poll, POLL_COMPOSING_MS * Math.min(retry, 2))
          return
        }
        if (retry === MAX_TRANSIENT_POLL_ERRORS + 1) {
          trackEvent('generation_poll_degraded', {
            attempt_id: generationAttemptRef.current,
            stage: 'composing',
            render_id: renderId,
          })
        }
        setError('Your video is still rendering. We are reconnecting automatically — please keep this tab open.')
        pollTimerRef.current = setTimeout(poll, 15000)
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

  // #383c — the old silent marker auto-detection (promptHasViralMarkers) was
  // removed. Whether the AI structures the text is now an EXPLICIT user choice
  // (scriptMode), so the app never decides to skip the AI on its own.

  // Push #313 / #364 — turn the structured script into a clean, readable preview.
  // Each beat is one line: "HOOK (0-2s): [Pexels: cue] voiceover". We STRIP the
  // section-header label AND the [Pexels: ...] footage cue, but KEEP the voiceover
  // sentence. (The old version dropped the whole line — and since header + voiceover
  // share one line, it erased the entire script, showing an empty preview box.)
  // Display-only: the full marked script stays in structuredScriptRef for the API.
  function cleanScriptPreview(text: string): string {
    const HEADER_LABEL =
      /^\s*(HOOK|GANCHO|MICRO REWARD|MICRO RECOMPENSA|ESCALATION|ESCALADA|RHYTHM|RITMO|PAYOFF|PAGAMENTO|RECOMPENSA FINAL)\b\s*\d*\s*(\([^)]*\))?\s*[:\-–]?\s*/i
    return text
      .split('\n')
      .map(line => {
        let t = line.trim()
        if (!t) return ''
        // Remove a leading section-header label, keeping the voiceover after it.
        t = t.replace(HEADER_LABEL, '')
        // Remove every bracketed footage cue / marker ([Pexels: ...], [Scene 2], ...).
        t = t.replace(/\[[^\]]*\]/g, '').trim()
        return t
      })
      .filter(t => {
        if (!t) return false
        // Drop YouTube Short format spec lines.
        if (/\b9\s*:\s*16\b|youtube\s+shorts?\s+format/i.test(t)) return false
        // Drop bullet / editing-note lines.
        if (/^\s*-\s+(Total|ZERO|Cut|Hold|One legend|Voice|Editing)/i.test(t)) return false
        // Drop residual ALL-CAPS stage directions that have no real sentence.
        const noSpecial = t.replace(/[^a-zA-Z]/g, '')
        if (noSpecial.length > 0 && noSpecial === noSpecial.toUpperCase() && noSpecial.length < 40) return false
        return true
      })
      .join('\n\n')
  }

  async function waitForActiveRenderRestore(): Promise<boolean> {
    if (activeRenderRestoreResolvedRef.current) return !resumedRenderRef.current
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      if (resumedRenderRef.current) return false
      if (activeRenderRestoreResolvedRef.current) return true
    }
    return false
  }

  async function handleAnalyze(
    overridePrompt?: string,
    opts?: { fromTopic?: boolean; skipPreview?: boolean; structureFirst?: boolean },
  ) {
    // Manual, onboarding and URL-triggered analysis all share this gate. A
    // click during the auth lookup must not race a restored composing job and
    // orphan it when the later analysis response commits its own phase.
    if (!(await waitForActiveRenderRestore())) {
      if (!resumedRenderRef.current) setError('Checking for an in-progress render. Please try again in a moment.')
      return
    }
    const override = typeof overridePrompt === 'string' ? overridePrompt : undefined
    const rawSource = (override ?? structuredScriptRef.current ?? prompt).trim()
    if (!rawSource) {
      setError('Please describe your video idea first.')
      return
    }
    // Push #060 / #061 — fire-and-forget event tracking. Endpoint silently
    // Analyze is its own funnel step. The legacy generation-start events now
    // fire only in handleGenerate, when a render is actually dispatched.
    if (!generationAttemptRef.current || phase === 'idle' || phase === 'done' || phase === 'failed') {
      generationAttemptRef.current = newGenerationAttemptId()
    }
    trackEvent('analyze_idea_clicked', {
      attempt_id: generationAttemptRef.current,
      mode,
      duration,
      source: opts?.fromTopic ? 'topic' : 'manual',
      series_continuation: searchParams?.get('series') === '1',
      continuation_source: searchParams?.get('continuation_source') ?? null,
    })
    setError(null)
    setAnalysis(null)
    setScenes([])
    setTasks([])
    setTaskStates({})
    setClipUrls([])
    setRenderId(null)
    setFinalVideoUrl(null)
    setWatermarkedDownloadConfirmed(false)

    // #383c — explicit choice drives whether we structure the text with the AI.
    //  • scriptMode 'ai'       → call /api/generate-script (DEFAULT)
    //  • scriptMode 'verbatim' → skip the AI, use the pasted text as the script
    // Programmatic pre-written scripts (Viral Now cards, which pass skipPreview)
    // are always used verbatim so curated scripts are never rewritten.
    let source = rawSource
    // KINEO-HOLLYWOOD-21-2026-07-10 (bug c) — Hollywood SKIPS auto-structure
    // (#310) and the "Your Script is Ready" review screen entirely. The
    // Hollywood planner is the screenwriter and needs the user's RAW idea
    // (interview quotes, facts, numbers); /api/generate-script rewrote it into
    // third-person narration, which turned the dialogue lines into generic
    // filler ("digital age reshapes possibilities"). The raw idea flows through
    // analyze/generate untouched and reaches /api/generate-video-cinematic as
    // body.prompt.
    const isHollywoodRaw = mode === 'cinematic_ai' && aiEngine === 'hollywood'
    const needsStructuring = isHollywoodRaw
      ? false
      : scriptMode === 'ai' && (opts?.structureFirst === true || !opts?.skipPreview)

    if (isHollywoodRaw) {
      // Keep the raw idea as the submission source; do NOT rewrite the textarea.
      structuredScriptRef.current = rawSource
    } else if (needsStructuring) {
      // Push #311 — show scripting phase so the user knows something is happening
      setPhase('scripting')
      try {
        const sgRes = await fetch('/api/generate-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: rawSource, language }),
        })
        if (sgRes.ok) {
          const sgData = await sgRes.json()
          if (typeof sgData.script === 'string' && sgData.script.trim()) {
            source = sgData.script.trim()
            // #362 — keep the marked script for submission; show clean text.
            structuredScriptRef.current = source
            setPrompt(cleanScriptPreview(source))
          }
        }
        // If generate-script fails for any reason, we fall through with the
        // original raw prompt — degraded but not broken.
      } catch {
        // Non-blocking — proceed with rawSource if the extra step throws.
      }

      // Push #311 — show script preview for manual flow unless caller requests
      // skip (autoanalyze from Viral Now cards, where the script is pre-written).
      if (!opts?.skipPreview && source !== rawSource) {
        setPhase('script_preview')
        return // GenerateClient will wait for user to click "Looks good, generate"
      }
    } else {
      // #362 — script already structured (Viral Now override, paste, or a prior
      // auto-structure pass). Keep the marked copy for the verbatim pipeline and
      // show the user a clean, marker-free version in the textarea.
      structuredScriptRef.current = rawSource
      setPrompt(cleanScriptPreview(rawSource))
    }

    setPhase('analyzing')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 50000)
    try {
      const res = await fetch('/api/analyze-idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Push #064 — pass duration so analyze-idea can size word count
        // and scene count to match the user's selection.
        // Push #411 — pass scriptMode so 'Use my script as is' keeps the
        // user's words VERBATIM in the AI engines too (server splits scenes
        // in code; GPT only generates the visual layer).
        body: JSON.stringify({ prompt: source, duration, language, scriptMode }),
        signal: controller.signal,
      })
      if (res.status === 401) {
        redirectToLoginPreservingPrompt()
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

      const analysisResult: Analysis = {
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
      }
      setAnalysis(analysisResult)

      // Phase 3 — kick off B-roll plan generation for both modes.
      // Creator Mode will surface the VisualDirector; Autopilot uses the
      // pexelsQuery values silently as better search terms for /api/scenes.
      const niche = data.niche ?? ''
      setBrollPlanLoading(true)
      setBrollPlan(null)

      if (mode === 'creator') {
        // Creator Mode: show the planning phase, then the VisualDirector.
        setPhase('broll_planning')
        // #358 — instrumentation: timestamp the broll-plan call (Creator path).
        if (process.env.NODE_ENV === 'development') console.log('[gen-client] broll-plan CALL', { mode: 'creator', ts: Date.now(), niche })
        try {
          const bpRes = await fetch('/api/generate-broll-plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ script: source, niche, tone: 'energetic', duration: 52, language }),
          })
          if (bpRes.ok) {
            const bpData = await bpRes.json()
            if (process.env.NODE_ENV === 'development') console.log('[gen-client] broll-plan RESOLVED', { mode: 'creator', ts: Date.now(), degraded: bpData?.degraded ?? null, scenes_count: Array.isArray(bpData?.scenes) ? bpData.scenes.length : 0 })
            if (bpData.globalStyle && Array.isArray(bpData.scenes)) {
              setBrollPlan(bpData as BrollPlan)
              setPhase('visual_director')
              setBrollPlanLoading(false)
              return // Wait for user to approve via VisualDirector
            }
          }
        } catch {
          // Fall through — show options phase without VisualDirector
        }
        setBrollPlanLoading(false)
        setPhase('options')
      } else {
        // Autopilot: kick off the broll plan AND store its promise so
        // handleGenerate can AWAIT it before generate-video-fast (#359 Camera B).
        setPhase('options')
        const bpCallTs = Date.now()
        if (process.env.NODE_ENV === 'development') console.log('[gen-client] broll-plan CALL', { mode: 'autopilot', ts: bpCallTs, niche, awaited: true })
        brollPlanPromiseRef.current = (async (): Promise<BrollPlan | null> => {
          try {
            const bpRes = await fetch('/api/generate-broll-plan', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ script: source, niche, tone: 'energetic', duration: 52, language }),
            })
            if (bpRes.ok) {
              const bpData = await bpRes.json()
              if (process.env.NODE_ENV === 'development') console.log('[gen-client] broll-plan RESOLVED', { mode: 'autopilot', ts: Date.now(), elapsed_ms: Date.now() - bpCallTs, degraded: bpData?.degraded ?? null, scenes_count: Array.isArray(bpData?.scenes) ? bpData.scenes.length : 0 })
              if (bpData.globalStyle && Array.isArray(bpData.scenes)) {
                setBrollPlan(bpData as BrollPlan)
                return bpData as BrollPlan
              }
            }
          } catch {
            // Non-blocking — Autopilot continues without the plan
          } finally {
            setBrollPlanLoading(false)
          }
          return null
        })()
      }
    } catch (err) {
      console.error('[generate] analyze threw:', err)
      setError(opts?.fromTopic ? 'Could not analyze topic. Please try again.' : 'Could not analyze that idea. Please try again.')
      setPhase('idle')
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // Push #311 — continue from script_preview phase when user confirms.
  // Called by the "Looks good, generate →" button in the preview card.
  async function handleConfirmScript() {
    await handleAnalyze(undefined, { skipPreview: true })
  }

  // Push #439 — Viral Score "Apply" handler. The button used to be inert.
  // Now: send the current (structured) script + the chosen suggestion to
  // /api/apply-suggestion, get an improved script back, then re-run
  // handleAnalyze on it (skipPreview) so the whole brief — scenes, captions,
  // AND the viral score — rebuilds coherently. Free: analysis costs no credit.
  async function handleApplySuggestion(suggestion: string, index: number) {
    if (applyingSuggestion !== null) return
    const baseScript = (structuredScriptRef.current ?? analysis?.voiceoverScript ?? prompt).trim()
    if (!baseScript || !suggestion.trim()) return
    setApplyingSuggestion(index)
    setError(null)
    trackEvent('viral_suggestion_apply', { suggestion: suggestion.slice(0, 80) })
    try {
      const res = await fetch('/api/apply-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: baseScript, suggestion, language, duration }),
      })
      if (res.status === 401) {
        redirectToLoginPreservingPrompt()
        return
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok || typeof data.script !== 'string' || !data.script.trim()) {
        setError('Could not apply that suggestion. Please try again.')
        return
      }
      // Re-analyze the improved script — rebuilds scenes + viral score.
      // skipPreview keeps the user in flow (no script-review gate).
      await handleAnalyze(data.script.trim(), { skipPreview: true })
    } catch {
      setError('Could not apply that suggestion. Please try again.')
    } finally {
      setApplyingSuggestion(null)
    }
  }

  // Phase 3 — Creator Mode: user approved the VisualDirector plan.
  // Store the approved plan and move to the options step for final generation.
  function handleApproveVisualDirector(approvedPlan: BrollPlan) {
    setBrollPlan(approvedPlan)
    setPhase('options')
  }

  // Phase 3 — Creator Mode: regenerate a single scene in the VisualDirector.
  async function handleSceneUpdateInDirector(sceneNumber: number, instruction?: string) {
    if (!brollPlan) return
    try {
      const res = await fetch('/api/regenerate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneNumber,
          instruction,
          currentPlan: brollPlan,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.scene) {
          setBrollPlan((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              scenes: prev.scenes.map((s) =>
                s.sceneNumber === sceneNumber ? data.scene : s,
              ),
            }
          })
        }
      }
    } catch {
      // Non-blocking — scene stays as-is if regeneration fails
    }
  }

  // Phase 3 — Creator Mode: regenerate the entire broll plan.
  async function handleRegenerateAllScenes() {
    if (!analysis || !prompt) return
    setBrollPlanLoading(true)
    try {
      const res = await fetch('/api/generate-broll-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: prompt,
          niche: analysis.niche,
          tone: 'energetic',
          duration: 52,
          language,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.globalStyle && Array.isArray(data.scenes)) {
          setBrollPlan(data as BrollPlan)
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setBrollPlanLoading(false)
    }
  }

  // Auto-trigger analyze when URL has ?autoanalyze=1&prompt=… (topic quick-start)
  // Push #311 — Viral Now cards skip the preview step (scripts are pre-written).
  useEffect(() => {
    // A reload may carry both an active render snapshot and the original
    // ?autoanalyze URL. Resolve/restore first; otherwise a late analyze response
    // can overwrite the resumed composing state and orphan the accepted job.
    if (!activeRenderRestoreResolved || resumedRenderRef.current) return
    const sp = searchParams?.get('prompt') ?? ''
    const auto = searchParams?.get('autoanalyze') === '1'
    if (!auto || !sp.trim()) return
    const key = sp.trim()
    if (autoAnalyzeKeyRef.current === key) return
    autoAnalyzeKeyRef.current = key
    if (process.env.NODE_ENV === 'development') console.log(`[ux1] autoanalyze-effect -> handleAnalyze() key="${key.slice(0,40)}" phase=${phase} @${Date.now()}`)
    handleAnalyze(sp, { fromTopic: true, skipPreview: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, activeRenderRestoreResolved])

  // Push #301 — Viral Now cards used to AUTO-GENERATE: the moment analysis
  // finished they fired handleGenerate() on the default engine.
  // Push #447 — REMOVED the auto-generate. It silently burned the user's credits
  // (often AI Gen = 30 cr) WITHOUT letting them choose Fast (free) vs AI Gen or
  // the duration. A Viral Now click now auto-analyzes (instant brief) but STOPS
  // at the options screen so the user picks the engine + duration and presses
  // Generate themselves. The ?autogenerate=1 URL param is intentionally ignored.

  // Face-app wave 1 — FREE voice preview (dryRun TTS, costs cents server-side,
  // zero credits): hear the exact narration mp3 before spending an avatar
  // credit on a render. Reuses /api/generate-avatar with dryRun=true.
  async function handlePreviewVoice() {
    if (voicePreviewLoading) return
    const trimmed = (structuredScriptRef.current ?? prompt).trim()
    if (!trimmed) {
      setVoicePreviewError('Write your idea or script first, then preview the voice.')
      return
    }
    setVoicePreviewLoading(true)
    setVoicePreviewError(null)
    try {
      const res = await fetch('/api/generate-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          duration,
          language,
          dryRun: true,
          vertical: analysis?.niche ?? undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setVoicePreviewError(typeof data?.error === 'string' ? data.error : 'Voice preview failed. Please try again.')
        return
      }
      const url = typeof data.voiceover_url === 'string' && data.voiceover_url ? data.voiceover_url : null
      if (!url) {
        setVoicePreviewError('Voice preview failed. Please try again.')
        return
      }
      setVoicePreviewUrl(url)
    } catch {
      setVoicePreviewError('Voice preview failed. Please try again.')
    } finally {
      setVoicePreviewLoading(false)
    }
  }

  async function submitDashboardAvatarGeneration(
    payload: Record<string, unknown>,
    attemptId: string,
    startedAt: number,
    restored: boolean,
  ): Promise<void> {
    let reconnectAttempt = 0
    while (true) {
      let res: Response
      let data: Record<string, unknown>
      try {
        res = await fetch('/api/generate-avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        data = await res.json().catch(() => ({})) as Record<string, unknown>
      } catch {
        reconnectAttempt += 1
        setError('Your avatar is safe. Reconnecting to the same submission…')
        await new Promise((resolve) => setTimeout(resolve, reconnectAttempt <= 4 ? 3000 : 10000))
        continue
      }

      if ((res.status === 409 || res.status === 503) && data.pending === true) {
        reconnectAttempt += 1
        const retryAfter = typeof data.retry_after_ms === 'number'
          ? Math.max(1000, Math.min(10000, data.retry_after_ms))
          : reconnectAttempt <= 4 ? 3000 : 10000
        setError('Your avatar is safe. Reconnecting to the same submission…')
        await new Promise((resolve) => setTimeout(resolve, retryAfter))
        continue
      }
      if (res.status === 401) {
        redirectToLoginPreservingPrompt()
        return
      }
      if (res.status === 402) {
        try { localStorage.removeItem(activeRenderStorageKey()) } catch { /* ignore */ }
        resumedRenderRef.current = false
        if (typeof data.balance === 'number') setCredits(data.balance)
        setError(typeof data.error === 'string' ? data.error : "You've used your credits.")
        openOutOfCreditsModal('credits')
        setPhase('options')
        return
      }

      const returnedGenerationId = typeof data.generationId === 'string' ? data.generationId.trim() : ''
      const requestId = typeof data.avatar_request_id === 'string' ? data.avatar_request_id.trim() : ''
      const voiceoverUrl = typeof data.voiceover_url === 'string' ? data.voiceover_url : ''
      if (!res.ok || returnedGenerationId !== attemptId || !requestId || !voiceoverUrl) {
        try { localStorage.removeItem(activeRenderStorageKey()) } catch { /* ignore */ }
        resumedRenderRef.current = false
        setError(typeof data.error === 'string' ? data.error : GENERIC_ERROR)
        setPhase('failed')
        return
      }

      falUsedRef.current = true
      falQualityRef.current = 'avatar'
      setQuality('fast')
      setGenerationId(attemptId)
      setFastVoiceover(typeof data.voiceover_script === 'string' ? data.voiceover_script : null)
      setFastCaptions(null)
      setTtsSpeed(typeof data.speed === 'number' ? data.speed : null)
      setClipUrls(Array.isArray(data.clip_urls)
        ? data.clip_urls.filter((url): url is string => typeof url === 'string')
        : [])
      avatarComposeRef.current = {
        voiceoverUrl,
        realAudioDuration: typeof data.real_audio_duration === 'number' ? data.real_audio_duration : null,
        avatarVideoUrl: null,
        hookSeconds: typeof data.avatar_hook_seconds === 'number' ? data.avatar_hook_seconds : null,
      }
      avatarEngineRef.current = data.engine === 'omnihuman' ? 'omnihuman' : 'fabric'
      setAvatarRequestId(requestId)
      setError(null)
      setPhase('avatar_polling')
      if (restored) {
        trackEvent('generation_avatar_resumed', {
          attempt_id: attemptId,
          age_ms: Math.max(0, Date.now() - startedAt),
        })
      }
      return
    }
  }

  async function handleGenerate() {
    if (!activeRenderRestoreResolvedRef.current || resumedRenderRef.current) {
      if (!resumedRenderRef.current) setError('Checking for an in-progress render. Please try again in a moment.')
      return
    }
    // #360 — double-submit guard. Block re-entry if a generation is already in
    // flight (synchronous ref) or the UI is in a processing phase. Prevents the
    // duplicate generate-video-fast calls / orphan broll_metrics rows we saw.
    if (generationInFlightRef.current || isProcessingPhase(phase)) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[gen] #360 handleGenerate ignored — already in flight', {
          inFlight: generationInFlightRef.current,
          phase,
        })
      }
      return
    }
    generationInFlightRef.current = true

    const trimmed = (structuredScriptRef.current ?? prompt).trim()
    if (!trimmed) {
      setError('Please describe your video idea first.')
      generationInFlightRef.current = false
      return
    }

    // Bug 12/06 — a face photo was picked but never attached ("Use this face"
    // not pressed, usually because the consent box was missed). Generating now
    // would silently render a faceless video — block, reopen the panel and
    // tell the user exactly what to do instead.
    if (!avatarImageUrl && avatarPending) {
      setError(
        'Your avatar photo isn’t attached yet. In the AI Avatar panel: check the consent box, then press “Use this face” — or remove the photo to generate without an avatar.',
      )
      setAvatarOpenSignal((n) => n + 1)
      generationInFlightRef.current = false
      return
    }
    const preserveExistingAttempt = preserveGenerationAttemptRef.current
    preserveGenerationAttemptRef.current = false
    if (!generationAttemptRef.current || ((phase === 'failed' || phase === 'done') && !preserveExistingAttempt)) {
      generationAttemptRef.current = newGenerationAttemptId()
    }
    const dispatchMetadata = {
      attempt_id: generationAttemptRef.current,
      mode,
      quality: mode === 'fast' || mode === 'creator' ? 'fast' : quality,
      duration,
      retry: phase === 'failed',
      series_continuation: searchParams?.get('series') === '1',
      continuation_source: searchParams?.get('continuation_source') ?? null,
    }
    // These legacy dashboard events now mean an actual render dispatch, not an
    // analysis click (which historically double-counted preview confirmation).
    trackEvent('generate_started', dispatchMetadata)
    trackEvent('video_generation_started', dispatchMetadata)
    setError(null)
    setTaskStates({})
    setTasks([])
    setScenes([])
    setClipUrls([])
    setFastVoiceover(null)
    setFastCaptions(null)
    setTtsSpeed(null)
    setFalRequestIds([])
    setFalClipsDone({ done: 0, total: 0 })
    setRenderId(null)
    setFinalVideoUrl(null)
    setWatermarkedDownloadConfirmed(false)
    postVideoOfferTrackedKeyRef.current = null
    setGenerateProgress(0)
    setRenderProgress(0)
    composeStartedRef.current = false
    deductedRef.current = false
    resumedRenderRef.current = false
    generatingPollErrorsRef.current = 0
    composingPollErrorsRef.current = 0
    setAvatarRequestId(null)
    avatarComposeRef.current = null
    setPhase('generating')

    // ── feature/ai-avatar — premium talking-avatar path ─────────────────────
    // When a face photo is loaded, Generate routes through /api/generate-avatar
    // (TTS → VEED submit → b-roll), then 'avatar_polling' waits for the talking
    // head and 'clips_ready' kicks compose with avatar_url + voiceover_url.
    // Checkpoint 1: no paywall/billing — this branch must not reach production
    // until checkpoint 2 (Joseph's gate).
    if (avatarImageUrl) {
      const avatarGenerationId = generationAttemptRef.current ?? newGenerationAttemptId()
      generationAttemptRef.current = avatarGenerationId
      const avatarPayload: Record<string, unknown> = {
        generationId: avatarGenerationId,
        prompt: trimmed,
        duration,
        language,
        avatarImageUrl,
        vertical: analysis?.niche ?? undefined,
        engine: avatarEngine,
        avatarMode: avatarHookMode ? 'hook' : 'full',
      }
      const avatarStartedAt = Date.now()
      if (currentUserIdRef.current) {
        try {
          const avatarSnapshot: ActiveRenderSnapshot = {
            stage: 'avatar_submitting',
            userId: currentUserIdRef.current,
            quality: 'avatar',
            mode,
            duration,
            prompt: trimmed.slice(0, 1000),
            attemptId: avatarGenerationId,
            startedAt: avatarStartedAt,
            avatarPayload,
          }
          localStorage.setItem(activeRenderStorageKey(), JSON.stringify(avatarSnapshot))
        } catch {
          // The durable server claim still protects this in-tab submission.
        }
      }
      void submitDashboardAvatarGeneration(avatarPayload, avatarGenerationId, avatarStartedAt, false)
      return
    }

    // Push #084 — Fast Mode skips Runway and resolves Pexels clips
    // synchronously, then jumps straight to the compose phase. Cinematic
    // Mode keeps the existing Runway path with its polling state machine.
    // Push #315 — Cinematic AI mode submits to fal.ai queue, then polls.
    if (mode === 'cinematic_ai') {
      try {
        const cinematicGenerationId = generationAttemptRef.current ?? newGenerationAttemptId()
        generationAttemptRef.current = cinematicGenerationId
        // L2B - thread the smart BrollPlan into the AI engine (same plan Fast uses)
        let cinePlan: BrollPlan | null = brollPlan
        if (!cinePlan && brollPlanPromiseRef.current) { try { cinePlan = await brollPlanPromiseRef.current } catch { cinePlan = null } }
        const cineUsable = !!cinePlan && cinePlan.degraded !== true && Array.isArray(cinePlan.scenes) && cinePlan.scenes.length > 0
        // KINEO-HOLLYWOOD-HOST-2026-07-13 — thread the user's selected My
        // Footage clips into the cinematic call too (same in-order mapping the
        // Fast path uses). Today the server uses them as the demo-scene hook
        // (validated + logged); ignored by every non-hollywood engine.
        const cineFootage = footageItems.filter((f) => selectedFootageIds.includes(f.id) && f.kind !== 'audio')
        const cineBrollScenes = cineUsable ? cinePlan!.scenes.map((s, sceneIdx) => ({ sceneNumber: s.sceneNumber, brollPrompt: s.brollPrompt, shotType: s.shotType, negativePrompt: s.negativePrompt, ...(cineFootage[sceneIdx] ? { userFootageUrl: cineFootage[sceneIdx].url } : {}) })) : undefined
        const cinematicPayload = {
          generationId: cinematicGenerationId,
          prompt: trimmed,
          duration,
          language,
          vertical: analysis?.niche ?? undefined,
          engine: aiEngine,
          brollScenes: cineBrollScenes,
          globalStyle: cineUsable ? cinePlan!.globalStyle : undefined,
          ...(aiEngine === 'hollywood' && selectedCharacterId ? { characterId: selectedCharacterId } : {}),
        }
        let res: Response
        let data: Record<string, unknown>
        let reconnectAttempt = 0
        while (true) {
          try {
            res = await fetch('/api/generate-video-cinematic', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(cinematicPayload),
            })
            data = await res.json().catch(() => ({})) as Record<string, unknown>
          } catch {
            reconnectAttempt += 1
            setError('Your AI scenes are safe. Reconnecting to the same submission…')
            await new Promise((resolve) => setTimeout(resolve, reconnectAttempt <= 4 ? 3000 : 10000))
            continue
          }
          if ((res.status === 409 || res.status === 503) && data.pending === true) {
            reconnectAttempt += 1
            const retryAfter = typeof data.retry_after_ms === 'number'
              ? Math.max(1000, Math.min(10000, data.retry_after_ms))
              : reconnectAttempt <= 4 ? 3000 : 10000
            setError('Your AI scenes are safe. Reconnecting to the same submission…')
            await new Promise((resolve) => setTimeout(resolve, retryAfter))
            continue
          }
          break
        }
        if (reconnectAttempt > 0 && res.ok) setError(null)
        if (res.status === 401) { redirectToLoginPreservingPrompt(); return }
        if (res.status === 503 && data?.queued) {
          // KINEO-FAL-ALARM-2026-07-06 — fal balance exhausted: show a calm
          // "high demand, queued" message (no credits used) instead of an error.
          setError(typeof data?.error === 'string' ? data.error : "We're experiencing high demand — your video is queued and will be ready shortly. No credits were used.")
          setPhase('failed'); return
        }
        if (res.status === 402) {
          // KINEO-PLAN-GATE-MODAL — a 402 carrying `upsell` is a PLAN gate (the
          // engine needs Creator/Studio), NOT a credit shortage. Show the correct
          // headline so users who HAVE credits aren't wrongly told they're broke.
          const gateReason: 'credits' | 'studio' | 'creator' =
            data?.upsell === 'studio' ? 'studio' : data?.upsell === 'creator' ? 'creator' : 'credits'
          setError(typeof data?.error === 'string' ? data.error : `This needs more credits. You have ${data?.balance ?? 0}.`)
          if (data?.resume_same_generation === true && data?.generationId === cinematicGenerationId) {
            preserveGenerationAttemptRef.current = true
          }
          openOutOfCreditsModal(gateReason)
          setPhase('failed'); return
        }
        if (!res.ok) {
          setError(typeof data?.error === 'string' ? data.error : GENERIC_ERROR)
          setPhase('failed'); return
        }
        if (data.generationId !== cinematicGenerationId) {
          setError('We could not verify this AI generation. Nothing was composed. Please try again.')
          setPhase('failed'); return
        }
        setQuality('cinematic_ai')
        falUsedRef.current = true
        falModelRef.current = typeof data.fal_model === 'string' ? data.fal_model : ''
        falQualityRef.current = data.quality === 'cinematic_kling' ? 'cinematic_kling' : data.quality === 'cinematic_veo' ? 'cinematic_veo' : data.quality === 'cinematic_sora' ? 'cinematic_sora' : data.quality === 'cinematic_hollywood' ? 'cinematic_hollywood' : 'cinematic_ai'
        // KINEO-HOLLYWOOD-2026-07-09 — per-scene metadata (empty arrays for
        // every non-hollywood engine, which keeps the classic behavior).
        falModelsRef.current = Array.isArray(data.fal_models) ? data.fal_models.filter((m: unknown): m is string => typeof m === 'string') : []
        sceneEnginesRef.current = Array.isArray(data.scene_engines) ? data.scene_engines.filter((e: unknown): e is string => typeof e === 'string') : []
        sceneNarrationsRef.current = Array.isArray(data.scene_narrations) ? data.scene_narrations.map((n: unknown) => (typeof n === 'string' ? n : null)) : []
        sceneSecondsRef.current = Array.isArray(data.scene_seconds) ? data.scene_seconds.map((s: unknown) => (typeof s === 'number' ? s : 10)) : []
        // KINEO-HOLLYWOOD-21-2026-07-10 (bug b) — real dialogue line per scene.
        sceneDialoguesRef.current = Array.isArray(data.scene_dialogues) ? data.scene_dialogues.map((d: unknown) => (typeof d === 'string' ? d : null)) : []
        setGenerationId(cinematicGenerationId)
        setScenes(Array.isArray(data.scenes) ? data.scenes : [])
        setFastVoiceover(typeof data.voiceover_script === 'string' ? data.voiceover_script : null)
        setFastCaptions(Array.isArray(data.scene_captions) ? data.scene_captions : null)
        setTtsSpeed(typeof data.speed === 'number' ? data.speed : null)
        const ids = Array.isArray(data.fal_request_ids) ? data.fal_request_ids : []
        setFalRequestIds(ids)
        setFalClipsDone({ done: 0, total: ids.filter((id: string | null) => id !== null).length })
        setPhase('fal_polling')
      } catch (err) {
        console.error('[generate] cinematic-ai threw:', err)
        setError(GENERIC_ERROR)
        setPhase('failed')
      }
      return
    }

    if (mode === 'fast' || mode === 'creator') {
      falUsedRef.current = false
      try {
        // Phase 3 — if a BrollPlan is available, pass the pexelsQuery values
        // per scene so generate-video-fast can use more specific Pexels searches.
        // #349 — also send brollScenes with the full multi-query list, relevance
        // score and planned duration so the route can run multi-query search +
        // the relevance-aware fallback hierarchy. brollQueries stays for compat.
        // #359 Camera B+C — AWAIT the broll plan (it starts during analyze but
        // takes ~15-26s) and use its queries ONLY when it ran successfully
        // (degraded=false). A degraded plan = generic built-template queries, so
        // we fall back to the script's [Pexels:] markers in that case.
        let plan: BrollPlan | null = brollPlan
        if (!plan && brollPlanPromiseRef.current) {
          try { plan = await brollPlanPromiseRef.current } catch { plan = null }
        }
        const planUsable = !!plan && plan.degraded !== true && Array.isArray(plan.scenes) && plan.scenes.length > 0
        const brollQueries = planUsable
          ? plan!.scenes.map((s) => ({ sceneNumber: s.sceneNumber, pexelsQuery: s.pexelsQuery }))
          : undefined
        // KINEO-USER-FOOTAGE-2026-07-10 — distribute the user's selected clips
        // across the plan scenes IN ORDER (clip 1 → scene 1, clip 2 → scene 2,
        // ...); scenes beyond the user's clips fall back to Pexels/vault
        // server-side. Simple, predictable MVP of the "GPT director" idea.
        const selectedFootage = footageItems.filter((f) => selectedFootageIds.includes(f.id) && f.kind !== 'audio')
        const brollScenes = planUsable
          ? plan!.scenes.map((s, sceneIdx) => ({
              sceneNumber: s.sceneNumber,
              pexelsQuery: s.pexelsQuery,
              pexelsQueries: s.pexelsQueries,
              relevanceScore: s.relevanceScore,
              durationSeconds: s.durationSeconds,
              scenePurpose: s.scenePurpose,
              // Push #486 — narration enables CONTENT-BASED scene↔plan alignment
              // server-side (fixes the off-by-one query shift when the plan
              // splits the script into more scenes than the route's GPT does).
              narration: s.narration,
              ...(selectedFootage[sceneIdx] ? { userFootageUrl: selectedFootage[sceneIdx].url } : {}),
            }))
          : undefined
        if (process.env.NODE_ENV === 'development') {
          console.log('[gen-client] generate-video-fast CALL', {
            ts: Date.now(),
            broll_plan_ready: !!plan,
            plan_usable: planUsable,
            broll_degraded: plan?.degraded ?? null,
            broll_scenes: plan?.scenes?.length ?? 0,
          })
        }
        const res = await fetch('/api/generate-video-fast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: trimmed, duration, language, brollQueries, brollScenes, brollDegraded: plan?.degraded }),
        })
        const data = await res.json()
        if (res.status === 401) {
          redirectToLoginPreservingPrompt()
          return
        }
        if (res.status === 402) {
          // Push #434 — Fast is free now, so the server no longer returns 402
          // for Fast. Kept as a defensive fallback.
          setError('Something went wrong starting your Fast video. Please try again.')
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
        // Push #235 — verbatim mode: keep the user's narration/captions/speed so
        // compose narrates exactly what they wrote at the speed they asked for.
        if (data.verbatim) {
          setFastVoiceover(
            typeof data.voiceover_script === 'string' ? data.voiceover_script : null,
          )
          setFastCaptions(Array.isArray(data.scene_captions) ? data.scene_captions : null)
          setTtsSpeed(typeof data.speed === 'number' ? data.speed : null)
        } else {
          setFastVoiceover(null)
          setFastCaptions(null)
          setTtsSpeed(null)
        }
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
        redirectToLoginPreservingPrompt()
        return
      }

      if (res.status === 402) {
        setError(`Not enough credits. This generation needs ${QUALITY_OPTIONS.find(q => q.key === quality)?.credits ?? 8} credit(s).`)
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

  // The onboarding CTA promises a generated Short, so complete the Fast path
  // automatically after its analysis is ready. Other entry points still stop
  // at the options screen and require their normal explicit Generate click.
  useEffect(() => {
    if (!onboardingAutoGenerateRef.current) return
    if (phase === 'failed') {
      onboardingAutoGenerateRef.current = false
      return
    }
    if (phase !== 'options' || !analysis || mode !== 'fast') return
    onboardingAutoGenerateRef.current = false
    onboardingGenerationDispatchedRef.current = true
    try { sessionStorage.setItem(PUSH27_ONBOARDING_RENDER_SESSION_KEY, '1') } catch {}
    trackEvent('first_video_generation_dispatched_from_viral_onboarding', {
      source: 'viral_onboarding',
      engine: 'fast',
      version: 'push27_single_choice',
    })
    void handleGenerate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, analysis, mode])

  useEffect(() => {
    if (phase !== 'failed' || !onboardingGenerationDispatchedRef.current) return
    onboardingGenerationDispatchedRef.current = false
    try { sessionStorage.removeItem(PUSH27_ONBOARDING_RENDER_SESSION_KEY) } catch {}
    trackEvent('first_video_generation_failed_from_viral_onboarding', {
      source: 'viral_onboarding',
      version: 'push27_single_choice',
      engine: 'fast',
    })
  }, [phase])

  // #383d — download with a title-based filename. The video lives on Supabase
  // (cross-origin), so the <a download="..."> attribute is IGNORED by browsers
  // and the file would save as a UUID. To force a readable name, fetch the file
  // as a blob and download that with the slug. Falls back to opening the URL in
  // a new tab if the blob fetch fails — download must never hard-break.
  async function handleDownload(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!finalVideoUrl) return
    const slug = slugifyTitle(analysis?.title)
    const filename = slug ? `${slug}.mp4` : `kineo-${duration}s.mp4`
    const exportType = planTier === 'free' && !hasPaid
      ? 'watermarked'
      : planTier === null && !hasPaid
        ? 'current_asset'
        : 'clean'
    e.preventDefault()
    try {
      const res = await fetch(finalVideoUrl)
      if (!res.ok) throw new Error('fetch failed')
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(blobUrl), 4000)
      trackEvent('video_downloaded', {
        filename,
        export_type: exportType,
      })
      if (exportType === 'watermarked') {
        setWatermarkedDownloadConfirmed(true)
      }
    } catch {
      // Fallback: open the original URL (old behavior) so the user still gets the file.
      try {
        window.open(finalVideoUrl, '_blank', 'noopener')
      } catch {
        /* last-resort no-op */
      }
    }
  }

  // PUSH #23/#29 — every sharing surface uses the public /v/[id] landing,
  // never the raw MP4. The shared helper keeps referral and attribution exact.
  function publicSharePath(): string | null {
    return buildPublicVideoSharePath(publicVideoId, shareReferralCode)
  }

  function buildPublicShareUrl(): string | null {
    const path = publicSharePath()
    if (!path || typeof window === 'undefined') return null
    return new URL(path, window.location.origin).toString()
  }

  function publicShareMetadata(channel: string) {
    return {
      version: PUBLIC_VIDEO_SHARE_VERSION,
      video_id: publicVideoId,
      where: 'done_screen',
      referral_attached: !!shareReferralCode,
      channel,
    }
  }

  async function handleSharePublic() {
    const url = buildPublicShareUrl()
    if (!url) return
    const commonMetadata = publicShareMetadata('copy_primary')
    trackEvent('video_share_clicked', commonMetadata)
    try {
      await navigator.clipboard.writeText(url)
      setSharedPublic('copied')
      trackEvent('video_shared', { ...commonMetadata, method: 'clipboard' })
    } catch {
      try { window.prompt('Copy this link:', url) } catch {}
      setSharedPublic('ready')
      trackEvent('video_share_manual_copy_shown', commonMetadata)
    }
    setTimeout(() => setSharedPublic(null), 2000)
  }

  // Native share stays available as an explicit secondary option. The primary
  // action now copies the watch page deterministically: the first real PUSH #23
  // user opened this sheet and cancelled it two seconds later.
  async function handleNativeSharePublic() {
    const url = buildPublicShareUrl()
    if (!url) return
    if (typeof navigator.share !== 'function') {
      await handleSharePublic()
      return
    }
    const metadata = publicShareMetadata('native_more')
    trackEvent('video_share_clicked', metadata)
    try {
      await navigator.share({
        title: 'My Kineo Short',
        text: 'Watch my Short and tell me what you think:',
        url,
      })
      setSharedPublic('shared')
      setTimeout(() => setSharedPublic(null), 2000)
      trackEvent('video_shared', { ...metadata, method: 'native_share' })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        trackEvent('video_share_cancelled', { ...metadata, method: 'native_share' })
      }
    }
  }

  function handlePublicShareChannel(channel: 'whatsapp' | 'x') {
    const url = buildPublicShareUrl()
    if (!url) return
    const metadata = publicShareMetadata(channel)
    trackEvent('video_share_clicked', metadata)
    const destination = channel === 'whatsapp'
      ? `https://wa.me/?text=${encodeURIComponent(`Watch my Short and tell me what you think: ${url}`)}`
      : `https://twitter.com/intent/tweet?text=${encodeURIComponent('I made this YouTube Short with Kineo. Create up to 3 Fast videos every 24h with no card.')}&url=${encodeURIComponent(url)}`
    window.open(destination, '_blank', 'noopener,noreferrer')
    trackEvent('video_share_channel_opened', metadata)
  }

  function handleContinueSeries(
    seed: string | null | undefined,
    source: SeriesContinuationSource,
    videoId?: string | null,
  ) {
    const nextPrompt = buildSeriesContinuationPrompt(seed)
    if (!nextPrompt) {
      handleReset()
      router.push('/generate')
      return
    }
    trackEvent('series_continue_clicked', {
      source,
      video_id: videoId ?? null,
    })
    const href = buildSeriesContinuationHref(seed, source)
    handleReset()
    setPrompt(nextPrompt)
    autoAnalyzeKeyRef.current = null
    router.push(href)
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

  function handleReset() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    composeStartedRef.current = false
    deductedRef.current = false
    resumedRenderRef.current = false
    generationAttemptRef.current = null
    try { localStorage.removeItem(activeRenderStorageKey()) } catch { /* ignore */ }
    setPhase('idle')
    setAnalysis(null)
    setScenes([])
    setTasks([])
    setTaskStates({})
    setClipUrls([])
    setRenderId(null)
    setFinalVideoUrl(null)
    setWatermarkedDownloadConfirmed(false)
    setPublicVideoId(null)
    setSharedPublic(null)
    postVideoOfferTrackedKeyRef.current = null
    setGenerateProgress(0)
    setRenderProgress(0)
    setError(null)
    setBrollPlan(null)
    setBrollPlanLoading(false)
    // Push #047 — "Start over" clears the prompt + the homepage breadcrumb
    // so the next run feels like a fresh start. We do NOT clear credits
    // state — that's owned by the /api/credits effect.
    setPrompt('')
    structuredScriptRef.current = null
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
    // KINEO-ZERO-SIGNUP-2026-07-09 — Fast renders are FREE (InVideo model):
    // new signups get 0 credits but can always generate/watch Fast videos.
    // Monetization happens at the clean, watermark-free export moment, never here.
    if (mode === 'fast') return false
    if (credits === null) return false
    if (credits > 0) return false
    if (mode === 'cinematic' && cinematicTokens > 0) return false
    return true
  }

  // Push #109 — free users at 0 credits get the urgency modal (with the
  // 10-min countdown); everyone else keeps the standard out-of-credits
  // modal.
  function openOutOfCreditsModal(reason: 'credits' | 'studio' | 'creator' = 'credits') {
    // #380 — unified: every out-of-credits moment now opens the 3-plan upgrade
    // modal (Spark/Basic/Pro) so the user picks a plan at peak intent.
    // KINEO-PLAN-GATE-MODAL — carry the reason so the headline is accurate.
    setUpgradeReason(reason)
    setShowUpgradeModal(true)
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

  // PUSH #38 — a live TAAFT signup reached /generate four times and opened
  // pricing, but never fired analyze_idea_clicked. The only primary CTA sat
  // below uploads, examples, engines and duration. Give a free account with
  // zero videos the same one-click Fast handoff as the onboarding dialog,
  // immediately below the already-filled idea.
  function handleInlineFirstVideo() {
    const topic = prompt.trim()
    if (!topic || mode !== 'fast' || isProcessingPhase(phase) || onboardingAutoGenerateRef.current) return
    const metadata = {
      source: 'inline_first_video',
      surface: 'under_prompt',
      version: 'push27_single_choice',
      engine: 'fast',
      is_first_video: true,
    }
    void trackEvent('viral_onboarding_primary_clicked', metadata)
    void trackEvent('first_video_started_from_viral_onboarding', metadata)
    onboardingAutoGenerateRef.current = true
    try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch {}
    void handleAnalyze(topic, { fromTopic: true, skipPreview: true, structureFirst: true })
  }

  // Push #113 — explicit currency selection. Auto-detection (browser
  // locale in #111, then Vercel-IP-country in #112) wasn't reliable
  // through VPNs and a few browser configs. The UI now exposes a BRL
  // button on each upgrade surface and passes the currency in directly,
  // so the path is always user-driven.
  // KINEO-RECOVERY-2026-07-15 — one post-video decision: Starter at $4.90 for
  // the first month. Stash the exact render inputs, preserve `return=wm`, and
  // rebuild this same video clean after the recurring checkout succeeds.
  function handleRemoveWatermark() {
    try {
      if (lastFastRenderRef.current) {
        localStorage.setItem('kineo_wm_unlock', JSON.stringify(lastFastRenderRef.current))
      }
    } catch {
      // Private-mode / storage blocked — the subscription still activates; the
      // exact-video re-render simply cannot resume in this browser.
    }
    trackEvent('starter_checkout_clicked', {
      source: 'post_video_result',
      offer: 'intro_month',
      return_to: 'watermark_unlock',
    })
    trackEvent('post_video_clean_export_clicked', {
      source: 'result_export_choice',
      offer: 'starter_intro_month',
      watermarked_downloaded: watermarkedDownloadConfirmed,
    })
    trackCheckoutClick('starter')
    window.location.href = '/api/stripe/checkout?tier=starter&intro=1&return=wm'
  }

  async function handleUpgradeNow(
    tier: 'starter' | 'basic' | 'pro' = 'basic',
    currency: 'usd' | 'brl' = 'usd',
  ) {
    trackCheckoutClick(tier)
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

  // Push #317 — upload the finished video directly to YouTube.
  async function handleYouTubeUpload() {
    if (!finalVideoUrl) return
    if (ytUploading) return
    setYtUploading(true)
    setYtError(null)
    try {
      const res = await fetch('/api/youtube/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: finalVideoUrl,
          title: analysis?.title ?? 'My Short',
          description: analysis?.youtubeDescription ?? '',
          tags: analysis?.hashtags?.map((h) => h.replace(/^#/, '')) ?? [],
          privacyStatus: 'public',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setYtResult(data)
    } catch (err) {
      setYtError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setYtUploading(false)
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
    // Zero credits is the normal never-paid state: free users still have their
    // rolling Fast previews and should see the contextual clean-export offer,
    // not a blocking "out of credits" modal over the finished video.
    if (!hasPaid) return
    if (credits === null || credits > 0) return
    urgencyAutoShownRef.current = true
    // #380 — at the exact moment a free user drains their last credit, open the
    // 3-plan upgrade modal (Spark/Basic/Pro) — peak purchase intent.
    setShowUpgradeModal(true)
  }, [phase, planTier, credits, hasPaid])

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

  // Push #097 — self-healing recovery. Once the initial retry budget is spent
  // and playerFailed flips true, DON'T strand the user behind a manual reload
  // button (the state they'd land on after leaving the tab during the render).
  // Instead keep silently re-loading the (cache-busted) MP4 every 6s. The
  // first time the CDN serves it, canplay/loadeddata/playing fires, we clear
  // playerFailed, and the overlay disappears on its own — zero clicks.
  useEffect(() => {
    if (phase !== 'done' || !finalVideoUrl || !playerFailed) return
    const el = videoRef.current
    if (!el) return
    const join = finalVideoUrl.includes('?') ? '&' : '?'
    const onLoaded = () => {
      playerRetryAttemptRef.current = 0
      setPlayerFailed(false)
    }
    el.addEventListener('canplay', onLoaded)
    el.addEventListener('loadeddata', onLoaded)
    el.addEventListener('playing', onLoaded)
    const attempt = () => {
      const v = videoRef.current
      if (!v) return
      // Cache-bust each probe so we re-fetch instead of replaying a cached 503.
      v.src = `${finalVideoUrl}${join}_auto=${Date.now()}`
      try { v.load() } catch { /* noop */ }
      v.play().catch(() => {})
    }
    attempt() // immediate try the moment we land on the fallback
    const id = setInterval(attempt, 6000)
    return () => {
      clearInterval(id)
      el.removeEventListener('canplay', onLoaded)
      el.removeEventListener('loadeddata', onLoaded)
      el.removeEventListener('playing', onLoaded)
    }
  }, [phase, finalVideoUrl, playerFailed])


  // Push #084 — Fast/Creator Mode cost. Free accounts see 0 credits here;
  // /api/compose separately enforces up to 3 watermarked Fast previews per
  // rolling 24h. Cinematic Mode uses the per-quality cost from QUALITY_OPTIONS.
  // KINEO-PRICING-V3C-2026-07-10 — Fast costs 1 credit for PAYING accounts
  // (mirrors creditCostFor('fast', isPaidUser) server-side). Free users keep
  // seeing Free/0 — their render stays downloadable and shareable with a watermark.
  const isPaidAccount = hasPaid || (planTier !== null && planTier !== 'free')
  const showInlineFirstVideo = mode === 'fast' && !isPaidAccount && (
    showFirstShortNudge || (recentVideos !== null && recentVideos.length === 0)
  )
  useEffect(() => {
    if (!showInlineFirstVideo || !prompt.trim() || inlineFirstVideoViewedRef.current) return
    inlineFirstVideoViewedRef.current = true
    void trackEvent('viral_onboarding_viewed', {
      source: 'inline_first_video',
      surface: 'under_prompt',
      version: 'push27_single_choice',
      engine: 'fast',
      is_first_video: true,
    })
  }, [showInlineFirstVideo, prompt])
  const selectedCost = mode === 'creator'
    ? 0
    : mode === 'fast'
    ? (isPaidAccount ? 1 : 0)
    : mode === 'cinematic_ai'
    // KINEO-PRICING-V3B-2026-07-10 — Kling 50, Veo 90, Sora 100,
    // Hollywood 150 (preço FINAL aprovado 10/07), Seedance 20.
    ? (aiEngine === 'kling' ? 50 : aiEngine === 'veo' ? 90 : aiEngine === 'sora' ? 100 : aiEngine === 'hollywood' ? 150 : 20)
    : (QUALITY_OPTIONS.find((q) => q.key === quality)?.credits ?? 8)

  // Push #156 — ready-to-paste YouTube description for the next-steps guide.
  const nextStepsDescription =
    analysis?.youtubeDescription?.trim() || analysis?.title?.trim() || ''
  const showPostVideoExportChoice = phase === 'done' && planTier === 'free' &&
    !hasPaid && !wmUnlocking && Boolean(lastFastRenderRef.current)

  const showStep1 = phase === 'idle' || phase === 'analyzing' || phase === 'scripting'
  const showScriptPreview = phase === 'script_preview'
  // Phase 3 — new intermediate phases
  const showBrollPlanning = phase === 'broll_planning'
  const showVisualDirector = phase === 'visual_director'
  const showStep2 = phase === 'options'
  const showRender =
    phase === 'generating' ||
    phase === 'fal_polling' ||
    phase === 'avatar_polling' ||
    phase === 'clips_ready' ||
    phase === 'composing' ||
    phase === 'done' ||
    phase === 'failed'

  const statusMessage = (() => {
    switch (phase) {
      case 'generating':
        return 'Submitting to AI generator…'
      case 'fal_polling':
        return falClipsDone.total > 0
          ? `🤖 Generating AI clips… ${falClipsDone.done}/${falClipsDone.total} done`
          : 'Generating AI clips…'
      case 'avatar_polling':
        return '🎭 Animating your avatar — lip-syncing the script… (this takes a few minutes)'
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
    if (phase === 'fal_polling') return 10 + Math.round(generateProgress * 0.6)
    if (phase === 'avatar_polling') return 40 // VEED job in flight — no granular progress from fal
    if (phase === 'clips_ready') return 72
    if (phase === 'composing') return 75 + Math.round(renderProgress * 0.25)
    if (phase === 'done') return 100
    return 0
  })()

  return (
    // KINEO-CONTENT-REDESIGN-2026-07-10 (Joseph) — the "miolo": wider canvas
    // (max-w-5xl) + more vertical air, landing-neutral card surfaces (#131316)
    // and ONE accent color — every legacy green/navy token was swapped for the
    // brand blue so the page reads like the homepage.
    <main className="px-4 sm:px-6 lg:px-10 py-10 max-w-5xl mx-auto">
      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .gv-card { animation: fadeUp 0.35s ease both; }
      `}</style>

      {/* KINEO-OFFER290-2026-07-07 — first-purchase $2.90 urgency banner (24h
          countdown, 1 per account). Renders nothing until OFFER_290_ENABLED is
          flipped to true in lib/flags.ts. */}
      <Offer290Banner />

      {/* KINEO-LOWCREDITS-UPSELL banner REMOVED (Joseph 09/07: "remove o
          almost"). With free Fast + 0-credit signups, "almost out of videos"
          is wrong copy for the normal free state — the page now has ZERO
          credit-warning banners. Monetization surfaces: the blue 🔒 unlock
          card on the finished video + the daily-limit modal. */}

      {/* KINEO-AVATAR-PACKS-RETIRED-2026-07-06 — <AvatarPaywallModal/> removed.
          It sold the retired avatar_credits packs. Avatar videos now cost 120
          universal credits, and a 402 from /api/generate-avatar routes to the
          universal upgrade modal (handled in the avatar submit path below). */}

      {/* Activation truth: a brand-new account can use free Fast previews and
          must not see a red out-of-credits warning before evaluating them. */}
      {/* Push #430 — welcome credits: every new signup now starts with 30
          credits (30 Fast videos or 1 premium AI video). Banner shows the
          gift while the user is on free plan and still has credits. */}
      {/* KINEO-DL-PAYWALL-2026-07-09 — verbose green credits banner REMOVED
          (Joseph: "limpa a tela"). The compact credits chip in the top bar is
          the single source of balance; monetization now happens when the user
          asks for a clean watermark-free export, not via banner copy. */}

      {/* Push #103 sticky low-credits banner REMOVED (KINEO-ZERO-SIGNUP
          follow-up, Joseph 09/07: "tira esse sem créditos em vermelho, deixa
          só o de cima"). At 0 credits two banners stacked — the softer
          "almost out of videos / Go monthly $9.90" banner stays as the single
          upgrade surface; the red scare copy ("your channel stops here")
          contradicted the free-Fast model where 0 credits is the normal state. */}

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
                  background: 'rgba(41,151,255,.10)',
                  border: '1px solid rgba(41,151,255,.35)',
                  color: '#2997ff',
                }}
              >
                {showStep1 ? 'Step 1 · Your idea' : showScriptPreview ? 'Step 2 · Review' : (showBrollPlanning || showVisualDirector) ? 'Step 3 · Visuals' : showStep2 ? 'Step 3 · Brief' : 'Step 4 · Generate'}
              </span>
            </div>
            <h1 className="font-black text-2xl sm:text-3xl mb-1" style={{ color: 'var(--text)' }}>
              {showStep1 ? 'Create your Short' : showScriptPreview ? '✍️ Your Script is Ready' : showBrollPlanning ? '🎬 Planning Visuals…' : showVisualDirector ? '🎬 Visual Director' : '🎬 Generate a Real AI Short'}
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted2)' }}>
              {showStep1 && 'One idea in. A ready-to-post Short out — in about a minute.'}
              {showScriptPreview && 'Review your script before we generate the video. Edit anything you want.'}
              {showBrollPlanning && 'AI Visual Director is planning your scenes…'}
              {showVisualDirector && 'Review and direct every scene before rendering.'}
              {showStep2 && 'Pick duration and quality, then generate.'}
              {showRender && 'Rendering your vertical 9:16 Short.'}
            </p>
          </div>
          <CreditsChip
            credits={credits}
            loading={creditsLoading}
            freeFastPreview={mode === 'fast' && !isPaidAccount}
          />
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
      {/* #467 — onboarding niche picker overlay for brand-new signups */}
      {showNicheOnboarding && (
        <NicheOnboarding
          onPick={(topic) => onboardingPick(topic)}
          onClose={finishOnboarding}
        />
      )}

      {showStep1 && showWelcome && (
        <WelcomeBanner onDismiss={dismissWelcome} />
      )}

      {/* Push #098 — out-of-credits upgrade modal. Opened by any Generate /
          Analyze / Generate-Similar click when credits <= 0. */}
      {showUpgradeModal && (
        <UpgradeModal
          reason={upgradeReason}
          isSubscriber={isStarter || isCreator || isStudio}
          loading={upgradeLoading}
          onUpgrade={(tier) => {
            // #380 — straight to Stripe via the working GET checkout route.
            // KINEO-SPRINT-OFFER-2026-07-14 — SINGLE OFFER: the intro month
            // ($4.90 Starter / $9.90 Creator first month) replaced the old
            // ?promo=FOUNDING50 here. Two different discounts on the same
            // modal contradicted each other; intro is deeper anyway and the
            // server validates eligibility (1 per customer, monthly only).
            trackCheckoutClick(tier)
            // #457 — TikTok Pixel: InitiateCheckout = purchase intent (retargeting)
            try {
              const ttq = (window as unknown as { ttq?: { track: Function } }).ttq
              if (ttq && typeof ttq.track === 'function') ttq.track('InitiateCheckout', { content_name: tier })
            } catch { /* non-blocking */ }
            setUpgradeLoading(true)
            const introParam = tier === 'starter' || tier === 'basic' ? '&intro=1' : ''
            window.location.href = `/api/stripe/checkout?tier=${tier}${introParam}`
          }}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}

      {/* Push #109 — urgency variant with countdown for free users at 0. */}
      {/* KINEO-SPRINT-OFFER-2026-07-14 — CTA now goes through the GET checkout
          with the intro month (tier=basic&intro=1). The old handleUpgradeNow
          POSTed to /api/stripe/checkout, which has no POST handler — every
          click silently landed on /pricing. The BRL button was dropped with it
          (stale "R$ 59,90" price; the server picks BRL by IP automatically). */}
      {showUrgencyModal && (
        <UrgencyModal
          remaining={urgencyRemaining}
          loading={upgradeLoading}
          onUpgrade={() => {
            trackCheckoutClick('basic')
            setUpgradeLoading(true)
            window.location.href = '/api/stripe/checkout?tier=basic&intro=1'
          }}
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
          aria-label="Upgrade offer"
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
              background: 'linear-gradient(145deg, #161618 0%, #161618 100%)',
              border: '1px solid rgba(41,151,255,0.4)',
              boxShadow: '0 24px 64px rgba(0,0,0,.6), 0 0 40px rgba(41,151,255,.15)',
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
                color: '#86868b',
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
              color: '#86868b',
              marginBottom: 22,
              lineHeight: 1.55,
            }}>
              {/* Fix 2 (12/06) — copy must match the REAL tier the button opens.
                  KINEO-SPRINT-OFFER-2026-07-14 — pitching STUDIO $37.90 to a
                  leaving FREE user was the hardest possible ask at the weakest
                  moment, and contradicted the single primary offer (Creator).
                  Now: intro Creator, renewal explicit, same one offer as the
                  0-credit modal and the post-render block. */}
              Go Creator and never run out of credits.
              Get <strong style={{ color: '#2997ff' }}>150 credits/month</strong> — full AI scenes,
              AI Presenter and 1 Hollywood film included, every month.
            </p>
            <a
              href="/api/stripe/checkout?tier=basic&intro=1"
              onClick={() => trackCheckoutClick('basic')}
              style={{
                display: 'block',
                width: '100%',
                padding: '14px 20px',
                borderRadius: 12,
                background: 'linear-gradient(90deg, #2997ff, #1d6fe0)',
                color: '#fff',
                fontWeight: 900,
                fontSize: '0.95rem',
                textDecoration: 'none',
                boxShadow: '0 8px 24px rgba(41,151,255,.4)',
                marginBottom: 10,
              }}
            >
              Go Creator — $9.90 first month →
            </a>
            <p style={{ fontSize: '0.72rem', color: '#86868b', fontWeight: 600, margin: '0 0 10px' }}>
              Renews at $24.90/mo in 30 days · cancel anytime
            </p>
            <button
              type="button"
              onClick={() => setShowExitIntentUpgrade(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
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

      {/* feat/ui-polish — removed the first-user OnboardingPanel (it was a second,
          duplicate niche selector above). All niches now live in the single
          "1 · Pick a niche" row inside Step 1 below. */}

      {/* ── STEP 1: Idea ── */}
      {showStep1 && (
        <section
          className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
          style={{ background: '#131316', border: '1px solid var(--border)' }}
        >
          {/* Push #047 — only show the "already loaded" helper line when the
              prompt arrived from the homepage's sessionStorage bridge. The
              line clears once the user edits the prompt themselves (the
              textarea's onChange below also flips fromHome off). */}
          {fromHome && prompt.trim() && (
            <div
              className="rounded-lg px-3 py-2 mb-3 flex items-center gap-2 text-xs font-bold"
              style={{
                background: 'rgba(41,151,255,.08)',
                border: '1px solid rgba(41,151,255,.28)',
                color: '#5cb3ff',
              }}
            >
              <span aria-hidden="true">✓</span>
              <span>Your idea is already loaded. Click generate to create your short.</span>
            </div>
          )}
          {/* Push #300 — Niche template buttons. One click pre-fills a proven
              prompt for the selected vertical and auto-triggers analysis. */}
          <div className="mb-3">
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
              1 · Choose a category
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: 'billionaire', emoji: '💰', label: 'Billionaire' },
                { key: 'mystery', emoji: '🔮', label: 'Mystery' },
                { key: 'country', emoji: '🌍', label: 'Country' },
                { key: 'money', emoji: '📈', label: 'Money' },
                { key: 'learning', emoji: '🧠', label: 'Learning' },
                { key: 'history', emoji: '🏛️', label: 'History' },
                { key: 'science', emoji: '🔬', label: 'Science' },
                { key: 'space', emoji: '🚀', label: 'Space' },
              ].map((t) => (
                // Push #424 — selected pill used a flat dark accent that read
                // as "sunken/broken". Now: blue→cyan gradient + cyan glow +
                // subtle lift when selected; glass pills otherwise (#406 language).
                <button
                  key={t.key}
                  type="button"
                  disabled={phase === 'analyzing'}
                  onClick={() => setPickedNiche(t.key)}
                  className="w-full text-center px-3 py-2 rounded-full text-xs font-bold transition-all"
                  style={{
                    background:
                      pickedNiche === t.key
                        ? 'linear-gradient(135deg, #2997ff, #2997ff)'
                        : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${
                      pickedNiche === t.key ? 'rgba(41,151,255,0.75)' : 'var(--border)'
                    }`,
                    color: pickedNiche === t.key ? '#fff' : 'var(--muted)',
                    boxShadow:
                      pickedNiche === t.key
                        ? '0 4px 18px rgba(41,151,255,0.35), inset 0 1px 0 rgba(255,255,255,0.25)'
                        : 'none',
                    transform: pickedNiche === t.key ? 'translateY(-1px)' : 'none',
                    textShadow: pickedNiche === t.key ? '0 1px 2px rgba(0,0,0,0.25)' : 'none',
                    cursor: phase === 'analyzing' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* #379 — first-Short onboarding nudge for brand-new signups */}
          {showFirstShortNudge && (
            <div
              className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"
              style={{
                background: 'rgba(41,151,255,0.10)',
                border: '1px solid rgba(41,151,255,0.40)',
                color: '#8ec8ff',
              }}
            >
              <span className="text-base">🎉</span>
              {/* Marker: KINEO-FREE-TIER-FAST-2026-07-05 — free tier = Fast only, no free AI */}
              {/* KINEO-SPRINT-OFFER-2026-07-14 — dropped the stale "Get 25 more
                  for $4.90" (the pack is 10 credits since V3C and has no public
                  CTA anymore). Welcome moment sells nothing — just start. */}
              <span>
                You&apos;re in. <strong>Your Fast previews are free to create, watch, share and download with a watermark</strong> — we&apos;ve loaded an idea below.
              </span>
            </div>
          )}

          <label
            className="block text-xs font-black uppercase tracking-widest mb-2"
            style={{ color: 'var(--muted)' }}
          >
            2 · Your idea
          </label>
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value)
              // #362 — a manual edit becomes the new source of truth; drop the
              // stored structured script so we submit exactly what the user sees.
              structuredScriptRef.current = null
              // Once the user edits the field themselves, the "already loaded"
              // helper line no longer makes sense — clear the breadcrumb.
              if (fromHome) setFromHome(false)
            }}
            placeholder={'What’s your Short about? Try "the Bermuda Triangle mystery" or "how Bezos starts his day"'}
            maxLength={5000}
            disabled={phase === 'analyzing'}
            // PUSH #38 keeps the first-video box compact so its free CTA stays
            // in the first viewport. Returning creators keep the larger script
            // workspace used for long prompts and verbatim copy.
            className={`w-full rounded-xl px-4 py-4 text-sm leading-relaxed ${showInlineFirstVideo ? 'min-h-[180px] sm:min-h-[220px]' : 'min-h-[220px] sm:min-h-[400px]'}`}
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

          {showInlineFirstVideo && (
            <div className="mt-4" style={{ maxWidth: 830 }}>
              <button
                type="button"
                onClick={handleInlineFirstVideo}
                disabled={!prompt.trim() || isProcessingPhase(phase)}
                className="w-full rounded-xl px-6 py-3.5 text-base font-black flex items-center justify-center gap-2"
                style={{
                  minHeight: 54,
                  border: 'none',
                  background: prompt.trim() && !isProcessingPhase(phase) ? '#2997ff' : 'rgba(255,255,255,.04)',
                  color: prompt.trim() && !isProcessingPhase(phase) ? '#fff' : 'var(--muted)',
                  cursor: prompt.trim() && !isProcessingPhase(phase) ? 'pointer' : 'not-allowed',
                  boxShadow: prompt.trim() && !isProcessingPhase(phase) ? '0 10px 34px rgba(41,151,255,.38)' : 'none',
                }}
              >
                Create my free Short →
              </button>
              <p className="text-center text-xs mt-2" style={{ color: 'var(--muted2)' }}>
                Fast preview · no card · watermark · advanced settings are optional below
              </p>
            </div>
          )}

          {/* AI Avatar removed from the Short flow (16/06) — Avatar and Short are
              separate flows. The Avatar Studio lives on its own page (/avatar),
              reachable from the top menu. */}

          {/* KINEO-USER-FOOTAGE-2026-07-10 (Prioridade 2) — "My footage": the
              user's own clips/photos become per-scene B-roll (stock fills the
              gaps). Paid feature — the server 402s free accounts on upload. */}
          <div className="mt-4" style={{ maxWidth: 830 }}>
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
              🎬 My footage <span style={{ textTransform: 'none', fontWeight: 600 }}>— use your own clips &amp; photos</span>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: selectedFootageIds.length > 0 ? '1px solid rgba(41,151,255,0.35)' : '1px solid var(--border)' }}>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => footageInputRef.current?.click()}
                  disabled={footageUploading}
                  className="rounded-lg px-3 py-2 text-[12px] font-bold"
                  style={{ background: 'rgba(41,151,255,0.12)', border: '1px solid rgba(41,151,255,0.4)', color: '#2997ff', cursor: footageUploading ? 'not-allowed' : 'pointer' }}
                >
                  {footageUploading ? '📤 Uploading…' : '📤 Upload clips / photos'}
                </button>
                <input ref={footageInputRef} type="file" multiple accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png" className="hidden" onChange={(e) => handleFootageFiles(e.target.files)} />
                <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  MP4/MOV/JPG · up to 50 MB each · your clips fill the first scenes, stock fills the rest
                </span>
              </div>
              {footageItems.filter((f) => f.kind !== 'audio').length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {footageItems.filter((f) => f.kind !== 'audio').map((f) => {
                    const on = selectedFootageIds.includes(f.id)
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSelectedFootageIds((cur) => (on ? cur.filter((x) => x !== f.id) : [...cur, f.id]))}
                        title={on ? 'Click to exclude from this video' : 'Click to use in this video'}
                        style={{ borderRadius: 10, padding: 2, border: on ? '2px solid #2997ff' : '2px solid var(--border)', background: 'rgba(0,0,0,0.3)', cursor: 'pointer', position: 'relative' }}
                      >
                        {f.kind === 'video' ? (
                          <video src={f.url} muted playsInline style={{ width: 74, height: 46, objectFit: 'cover', borderRadius: 8, opacity: on ? 1 : 0.5 }} />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.url} alt="footage" style={{ width: 74, height: 46, objectFit: 'cover', borderRadius: 8, opacity: on ? 1 : 0.5 }} />
                        )}
                        {on && (
                          <span style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: '#2997ff', color: '#fff', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {selectedFootageIds.indexOf(f.id) + 1}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* KINEO-OWN-VOICE-2026-07-10 (Prioridade 3) — narração própria:
              upload de voiceover (pula TTS, captions por Whisper) ou voz
              clonada do perfil (clonagem feita na página do AI Presenter). */}
          <div className="mt-3" style={{ maxWidth: 830 }}>
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
              🎙️ My voice <span style={{ textTransform: 'none', fontWeight: 600 }}>— replace the AI narrator</span>
            </div>
            <div className="rounded-xl p-3 flex flex-wrap items-center gap-2" style={{ background: 'rgba(255,255,255,0.03)', border: (myVoiceUrl || useClonedVoice) ? '1px solid rgba(41,151,255,0.35)' : '1px solid var(--border)' }}>
              <button
                type="button"
                onClick={() => voiceInputRef.current?.click()}
                disabled={voiceUploading}
                className="rounded-lg px-3 py-2 text-[12px] font-bold"
                style={{ background: myVoiceUrl ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.04)', border: myVoiceUrl ? '1px solid rgba(41,151,255,0.5)' : '1px solid var(--border)', color: myVoiceUrl ? '#2997ff' : 'var(--muted2)', cursor: voiceUploading ? 'not-allowed' : 'pointer' }}
              >
                {voiceUploading ? '🎙️ Uploading…' : myVoiceUrl ? '✓ My voiceover loaded' : '🎙️ Upload my voiceover (MP3/WAV)'}
              </button>
              <input ref={voiceInputRef} type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a" className="hidden" onChange={(e) => handleVoiceFile(e.target.files)} />
              {myVoiceUrl && (
                <button type="button" onClick={() => setMyVoiceUrl('')} className="text-[11px] underline" style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  remove
                </button>
              )}
              <button
                type="button"
                onClick={() => { setUseClonedVoice((v) => !v); if (!useClonedVoice) setMyVoiceUrl('') }}
                className="rounded-lg px-3 py-2 text-[12px] font-bold"
                style={{ background: useClonedVoice ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.04)', border: useClonedVoice ? '1px solid rgba(41,151,255,0.5)' : '1px solid var(--border)', color: useClonedVoice ? '#2997ff' : 'var(--muted2)', cursor: 'pointer' }}
              >
                🧬 Use my cloned voice
              </button>
              <span className="text-[11px]" style={{ color: 'var(--muted)' }}>
                No clone yet? <a href="/avatar" style={{ color: '#2997ff', fontWeight: 700 }}>Record one in AI Presenter →</a>
              </span>
            </div>
            {footageMsg && (
              <p className="text-[11px] font-bold mt-1.5" style={{ color: footageMsg.startsWith('✓') ? '#5cb3ff' : '#f87171' }}>{footageMsg}</p>
            )}
          </div>

          {/* #383c — explicit script handling. Default = let the AI structure the
              text; advanced = use the pasted script verbatim. Replaces the old
              silent marker auto-detection. */}
          <div className="mt-4">
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
              Script
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" style={{ maxWidth: 830 }}>
              <button
                type="button"
                disabled={phase === 'analyzing'}
                onClick={() => setScriptMode('ai')}
                className="text-left px-4 py-3 rounded-xl transition-all"
                style={{
                  background: scriptMode === 'ai' ? 'rgba(41,151,255,.10)' : 'rgba(255,255,255,.03)',
                  border: scriptMode === 'ai' ? '1.5px solid rgba(41,151,255,.55)' : '1.5px solid var(--border)',
                  cursor: phase === 'analyzing' ? 'not-allowed' : 'pointer',
                }}
              >
                <div className="text-sm font-bold" style={{ color: scriptMode === 'ai' ? '#5cb3ff' : 'var(--text)' }}>
                  ✨ Let AI structure my text {scriptMode === 'ai' && <span style={{ fontSize: '0.65rem' }}>· Recommended</span>}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--muted2)' }}>
                  We shape your idea into a scroll-stopping Short — hook, build, payoff.
                </div>
              </button>
              <button
                type="button"
                disabled={phase === 'analyzing'}
                onClick={() => setScriptMode('verbatim')}
                className="text-left px-4 py-3 rounded-xl transition-all"
                style={{
                  background: scriptMode === 'verbatim' ? 'rgba(41,151,255,.10)' : 'rgba(255,255,255,.03)',
                  border: scriptMode === 'verbatim' ? '1.5px solid rgba(41,151,255,.55)' : '1.5px solid var(--border)',
                  cursor: phase === 'analyzing' ? 'not-allowed' : 'pointer',
                }}
              >
                <div className="text-sm font-bold" style={{ color: scriptMode === 'verbatim' ? '#5cb3ff' : 'var(--text)' }}>
                  📝 Use my script as is
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--muted2)' }}>
                  Your words, narrated exactly as written. No rewrites.
                </div>
              </button>
            </div>
          </div>

          {/* feat/ui-polish — clickable example prompts (per niche) to kill the
              blank-page freeze. Tapping one fills the textarea above. */}
          <div className="mt-3">
            <div className="text-xs font-semibold mb-2" style={{ color: 'var(--muted2)' }}>
              ✨ Need a spark? Tap one
            </div>
            <div className="flex flex-wrap gap-2">
              {/* #383e — prefer fresh cron trends for this niche; fall back to the
                  fixed examples so a card is never empty. */}
              {((nicheTrends[pickedNiche]?.length ? nicheTrends[pickedNiche] : NICHE_EXAMPLES[pickedNiche]) ?? NICHE_EXAMPLES.billionaire).map((ex) => (
                <button
                  key={ex}
                  type="button"
                  disabled={phase === 'analyzing'}
                  onClick={() => { setPrompt(ex); if (fromHome) setFromHome(false) }}
                  className="text-left px-3 py-2 rounded-lg text-xs transition-all"
                  style={{
                    background: 'rgba(41,151,255,0.06)',
                    border: '1px solid rgba(41,151,255,0.20)',
                    color: 'var(--text2)',
                    cursor: phase === 'analyzing' ? 'not-allowed' : 'pointer',
                    maxWidth: 360,
                  }}
                >
                  {ex}
                </button>
              ))}
              <button
                type="button"
                disabled={phase === 'analyzing'}
                onClick={() => { setPrompt(randomTopic(prompt)); structuredScriptRef.current = null; if (fromHome) setFromHome(false) }}
                className="text-left px-3 py-2 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: 'rgba(41,151,255,0.10)',
                  border: '1px solid rgba(41,151,255,0.45)',
                  color: '#7cc0ff',
                  cursor: phase === 'analyzing' ? 'not-allowed' : 'pointer',
                }}
              >
                🎲 Surprise me
              </button>
            </div>
          </div>

          {/* feat/ui-polish — Autopilot/Creator Mode workflow toggle removed:
              only one mode is used. `mode` stays 'fast' (Autopilot) by default. */}

          {/* Push #084 — Generation mode selector.
              Push #087 — Cinematic Mode is gated to Pro users; Free + Basic
              see a non-interactive locked card with an upgrade CTA. The
              server enforces the same gate (/api/generate-video returns 403
              for non-Pro callers). */}
          {mode !== 'creator' && (
          <ModeSelector
            mode={mode}
            setMode={setMode}
            isPro={planTier === 'pro'}
            cinematicTokens={cinematicTokens}
            credits={credits}
            freeAiUsed={freeAiUsed}
            aiEngine={aiEngine}
            setAiEngine={setAiEngine}
            isStarter={isStarter}
            isCreator={isCreator}
            isStudio={isStudio}
            hasPaid={hasPaid}
            onUpgrade={openOutOfCreditsModal}
          />
          )}

          {/* KINEO-CHARACTER-LOCK-2026-07-10 — Hollywood character picker.
              Only rendered when the hollywood engine is selected AND the user
              has saved characters (Avatar Studio → "Save as character"). */}
          {mode === 'cinematic_ai' && aiEngine === 'hollywood' && characters.length > 0 && (
            <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
              <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted)' }}>
                🎭 Lock a character <span style={{ textTransform: 'none', fontWeight: 600 }}>— same face in every video</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCharacterId('')}
                  className="rounded-lg px-3 py-2 text-[12px] font-bold"
                  style={{ background: !selectedCharacterId ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.04)', border: !selectedCharacterId ? '1px solid rgba(41,151,255,0.5)' : '1px solid var(--border)', color: !selectedCharacterId ? '#2997ff' : 'var(--muted2)', cursor: 'pointer' }}
                >
                  ✨ New face each video
                </button>
                {characters.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCharacterId(c.id)}
                    className="rounded-lg px-2 py-1.5 text-[12px] font-bold flex items-center gap-2"
                    style={{ background: selectedCharacterId === c.id ? 'rgba(41,151,255,0.15)' : 'rgba(255,255,255,0.04)', border: selectedCharacterId === c.id ? '1px solid rgba(41,151,255,0.5)' : '1px solid var(--border)', color: selectedCharacterId === c.id ? '#2997ff' : 'var(--muted2)', cursor: 'pointer' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.image_url} alt={c.name} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

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
                    background: duration === opt.value ? '#2997ff' : 'rgba(255,255,255,.04)',
                    border: duration === opt.value ? '1px solid rgba(41,151,255,.65)' : '1px solid var(--border)',
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

          {/* feat/ui-polish — Language selector removed: English-only channel.
              `language` state stays 'en' (default) and is still sent to the API. */}

          {/* Push #266 — Media & Quality selector removed from Cinematic mode.
              Quality is fixed at 'basic_ai' (the default) — no user choice needed. */}

          <div className="flex items-center justify-between mt-5 gap-3 flex-wrap">
            <div>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {mode === 'creator'
                  ? `🎬 Creator Mode • review scenes first, then 1 credit • ~60 seconds.`
                  : mode === 'fast'
                  ? `⚡ ${selectedCost === 0 ? 'Free' : `${selectedCost} credit`} • Fast Mode • ready in ~60 seconds.`
                  : mode === 'cinematic_ai'
                  ? `🤖 ${selectedCost} credits • AI Generated • ~3-5 min render.`
                  : `🎬 1 Cinematic token • Runway AI • 5-10 min render (Pro plan).`}
              </p>
              {mode === 'fast' && !isPaidAccount ? (
                <p className="text-xs mt-1" style={{ color: '#5cb3ff', fontWeight: 700 }}>
                  Free preview · watermark · ~60s
                </p>
              ) : credits !== null && (
                <p className="text-xs mt-1" style={{ color: 'var(--muted2)', fontWeight: 700 }}>
                  {credits} credit{credits === 1 ? '' : 's'} left · ~60s
                </p>
              )}
              {/* Push #087 — credit-balance awareness right under the CTA.
                  Three states: low (<5), empty (=0), and silent (healthy). */}
              {/* KINEO-ZERO-SIGNUP-2026-07-09 — never shown on Fast (it's free). */}
              {credits !== null && (credits === 0 && mode !== 'fast' && !(mode === 'cinematic' && cinematicTokens > 0) && mode !== 'cinematic_ai') && (
                <p className="text-xs mt-1" style={{ color: '#f87171', fontWeight: 700 }}>
                  Out of credits. <a href="/pricing" style={{ color: '#f87171', textDecoration: 'underline' }}>Get more →</a>
                </p>
              )}
              {credits !== null && credits > 0 && credits < 5 && (
                <p className="text-xs mt-1" style={{ color: '#fbbf24', fontWeight: 700 }}>
                  Only {credits} left. <a href="/pricing" style={{ color: '#fbbf24', textDecoration: 'underline' }}>Top up →</a>
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
                    : 'linear-gradient(135deg, #2997ff, #2997ff)',
                border: 'none',
                cursor: phase === 'analyzing' || !prompt.trim() ? 'not-allowed' : 'pointer',
                color: phase === 'analyzing' || !prompt.trim() ? 'var(--muted)' : '#FFFFFF',
                boxShadow:
                  phase === 'analyzing' || !prompt.trim()
                    ? 'none'
                    : '0 10px 34px rgba(41, 151, 255,.45)',
                minHeight: 52,
              }}
            >
              {phase === 'analyzing' ? (
                <>
                  <Spinner />
                  Analyzing…
                </>
              ) : (
                'Create my Short'
              )}
            </button>
          </div>
        </section>
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

      {phase === 'scripting' && (
        <section
          className="gv-card rounded-2xl p-5 sm:p-6 mb-6 flex items-center gap-4"
          style={{ background: '#131316', border: '1px solid var(--border)' }}
        >
          <Spinner />
          <div>
            <div className="font-black text-base" style={{ color: 'var(--text)' }}>
              Writing your viral script…
            </div>
            <div className="text-sm" style={{ color: 'var(--muted2)' }}>
              Structuring hook, facts, escalation, and payoff for your topic.
            </div>
          </div>
        </section>
      )}

      {phase === 'analyzing' && (
        <section
          className="gv-card rounded-2xl p-5 sm:p-6 mb-6 flex items-center gap-4"
          style={{ background: '#131316', border: '1px solid var(--border)' }}
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

      {/* ── STEP 1.5: Script Preview ── Push #311 ── */}
      {showScriptPreview && (
        <section
          className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
          style={{ background: '#131316', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <span style={{ fontSize: 20 }}>✍️</span>
            <span className="font-black text-sm" style={{ color: 'var(--text)' }}>
              AI wrote this script for your video — review and edit before generating
            </span>
          </div>
          <textarea
            value={cleanScriptPreview(prompt)}
            readOnly
            className="w-full rounded-xl px-4 py-4 text-sm leading-relaxed min-h-[280px] sm:min-h-[380px] mb-4"
            style={{
              background: 'rgba(0,0,0,.3)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
              fontSize: 13,
              lineHeight: 1.7,
            }}
          />
          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              onClick={outOfCredits() ? openOutOfCreditsModal : handleConfirmScript}
              className="rounded-xl px-6 py-3 font-black text-sm"
              style={{
                background: 'linear-gradient(135deg, #2997ff, #2997ff)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(41,151,255,.35)',
              }}
            >
              Looks good — create my Short
            </button>
            <button
              type="button"
              onClick={() => { setPhase('idle'); setPrompt(''); structuredScriptRef.current = null }}
              className="rounded-xl px-4 py-3 font-bold text-sm"
              style={{
                background: 'rgba(255,255,255,.05)',
                border: '1px solid var(--border)',
                color: 'var(--muted)',
                cursor: 'pointer',
              }}
            >
              Start over
            </button>
          </div>
        </section>
      )}

      {/* ── Phase 3: B-roll Planning (Creator Mode) ── */}
      {showBrollPlanning && (
        <section
          className="gv-card rounded-2xl p-5 sm:p-6 mb-6 flex items-center gap-4"
          style={{ background: '#131316', border: '1px solid var(--border)' }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '3px solid rgba(41,151,255,0.2)',
              borderTopColor: 'rgb(16,185,129)',
              animation: 'spin 0.8s linear infinite',
              flexShrink: 0,
            }}
          />
          <div>
            <div className="font-black text-base" style={{ color: 'var(--text)' }}>
              AI Visual Director is planning your scenes…
            </div>
            <div className="text-sm" style={{ color: 'var(--muted2)' }}>
              Analyzing your script to assign mood, shot type, and Pexels search query per scene.
            </div>
          </div>
        </section>
      )}

      {/* ── Phase 3: Visual Director (Creator Mode) ── */}
      {showVisualDirector && brollPlan && (
        <section className="mb-6">
          <VisualDirector
            plan={brollPlan}
            onSceneUpdate={handleSceneUpdateInDirector}
            onRegenerateAll={handleRegenerateAllScenes}
            onApprove={handleApproveVisualDirector}
            isLoading={brollPlanLoading}
          />
        </section>
      )}

      {/* ── STEP 2: Options ── */}
      {showStep2 && analysis && (
        <>
          <section
            className="gv-card rounded-2xl p-5 sm:p-6 mb-4"
            style={{ background: '#131316', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <span
                className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded"
                style={{
                  background: 'rgba(41,151,255,.12)',
                  border: '1px solid rgba(41,151,255,.3)',
                  color: '#5cb3ff',
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
                    background: 'rgba(41,151,255,.08)',
                    border: '1px solid rgba(41,151,255,.25)',
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
                      <span style={{ color: '#5cb3ff', fontWeight: 700 }}>Scene {i + 1}.</span> {s}
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
            <ViralIntelligencePanel
              vi={analysis.viralIntelligence}
              onApply={handleApplySuggestion}
              applyingIndex={applyingSuggestion}
            />
          )}

          {/* Push #034: duration / quality controls were moved to Step 1
              (above the Analyze button) so users pick them before paying any
              attention budget on the brief. Step 2 just confirms the choice
              and kicks off the actual generation. */}
          <section
            className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
            style={{ background: '#131316', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs" style={{ color: 'var(--muted2)' }}>
                {mode === 'fast'
                  ? `⚡ Fast Mode · ${duration}s · YouTube Shorts / TikTok (9:16)`
                  : `🎬 Cinematic Mode · ${duration}s · ${QUALITY_OPTIONS.find((q) => q.key === quality)?.title} · YouTube Shorts / TikTok (9:16)`}
              </div>
              <button
                onClick={handleGenerateGuarded}
                disabled={isProcessingPhase(phase)}
                className="rounded-xl px-6 py-3 text-sm font-black flex items-center gap-2"
                style={{
                  background: isProcessingPhase(phase) ? '#1E3A8A' : '#2997ff',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: isProcessingPhase(phase) ? 'not-allowed' : 'pointer',
                  opacity: isProcessingPhase(phase) ? 0.7 : 1,
                  boxShadow: '0 8px 28px rgba(41,151,255,.35)',
                }}
              >
                {isProcessingPhase(phase)
                  ? '⏳ Generating…'
                  : `Generate${selectedCost === 0 ? ' · Free' : ` · ${selectedCost} credit${selectedCost === 1 ? '' : 's'}`}`}
              </button>
            </div>
          </section>
        </>
      )}

      {/* ── Render / Done / Failed ── */}
      {showRender && (
        <>
          {/* KINEO-WM-CHECKOUT-2026-07-07 — post-purchase status. Shown while the
              clean re-render runs, or if the auto-unlock could not start (the pack
              is still active; the user just makes a new clean Fast video). Fixed at
              the top so it is visible regardless of the current phase. */}
          {(wmUnlocking || wmUnlockError) && (
            <div
              role="status"
              aria-live="polite"
              style={{
                position: 'fixed',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 60,
                maxWidth: 'min(520px, 92vw)',
                padding: '12px 18px',
                borderRadius: 14,
                background: wmUnlockError ? 'rgba(30,20,20,0.96)' : '#131316',
                border: `1px solid ${wmUnlockError ? 'rgba(248,113,113,.5)' : 'rgba(41,151,255,.5)'}`,
                boxShadow: '0 12px 40px rgba(0,0,0,.45)',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden="true">
                {wmUnlockError ? '✅' : '✨'}
              </span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.4 }}>
                {wmUnlockError
                  ? `Payment received. ${wmUnlockError}`
                  : 'Removing watermark… your clean video will appear here in a moment.'}
              </span>
              {wmUnlockError && (
                <button
                  type="button"
                  onClick={() => setWmUnlockError(null)}
                  aria-label="Dismiss"
                  style={{
                    marginLeft: 4,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--muted)',
                    fontSize: 18,
                    lineHeight: 1,
                    cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              )}
            </div>
          )}

          {(phase === 'generating' || phase === 'fal_polling' || phase === 'avatar_polling' || phase === 'clips_ready' || phase === 'composing') && (
            <section
              className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
              style={{ background: '#131316', border: '1px solid var(--border)' }}
            >
              {/* Push #047 — staged-pipeline message. The rotating copy lives
                  in `LOADER_MESSAGES` and is driven by `loaderTick`; the
                  small grey caption underneath keeps the truthful API
                  status so power users still see what's actually happening. */}
              <RenderHeader
                progress={headlineProgress}
                message={LOADER_MESSAGES[loaderTick % LOADER_MESSAGES.length]}
              />


              {/* Push #087 — Fast Mode gets its own 4-step indicator that
                  matches the actual Pexels + TTS + assemble pipeline.
                  Cinematic Mode keeps the 5-stage Runway indicator. */}
              {(mode === 'fast' || mode === 'creator') ? (
                <FastPipelineStages step={fastStep} phase={phase} />
              ) : (
                <PipelineStages
                  phase={phase}
                  renderProgress={renderProgress}
                  finalReady={!!finalVideoUrl}
                />
              )}

              <div
                className="rounded-xl px-3 py-2 mt-4 text-xs"
                style={{
                  background: 'rgba(41,151,255,.06)',
                  border: '1px solid rgba(41,151,255,.20)',
                  color: 'var(--muted2)',
                  lineHeight: 1.55,
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span aria-hidden="true">⚡</span>
                  <span className="font-bold" style={{ color: '#5cb3ff' }}>
                    Kineo rendering engine
                  </span>
                </div>
                <div>
                  Your Short is being built in multiple AI stages. Credits are only charged on successful delivery.
                </div>
                <div className="mt-1">Safe to keep this tab open — we&apos;ll notify you when it&apos;s ready.</div>
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
                        <span style={{ color: '#5cb3ff', fontWeight: 700 }}>#{i + 1}</span> {s}
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
                Generation failed. If no paid AI work started, any reserved credits are refunded automatically. You can retry safely.
              </div>
              <button
                onClick={handleGenerate}
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-white mt-2"
                style={{
                  background: 'linear-gradient(135deg, #2997ff, #2997ff)',
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
              style={{ background: '#131316', border: '1px solid var(--border)' }}
            >
              <div className="text-center">
                <h2 className="font-black tracking-tight" style={{ fontSize: '1.5rem', color: 'var(--text)', lineHeight: 1.2 }}>
                  Your video is ready
                </h2>
                <p className="text-xs mt-1.5" style={{ color: 'var(--muted)', letterSpacing: '0.04em' }}>
                  {duration}s · YouTube Shorts / TikTok 9:16
                </p>
                {/* ROBO-ENTRY-495 — honest credits line at the win moment. AI
                    Generated (Seedance) costs 20 credits (KINEO-REBASE-2026-07-10) and Fast Mode is free,
                    so we state both plainly instead of a vague "low credits"
                    nudge. Renders for any signed-in user; guests (credits null
                    after 401) see nothing. */}
                {credits !== null && (
                  <p className="text-xs mt-2" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
                    You have{' '}
                    <span style={{ color: '#f5f5f7', fontWeight: 700 }}>
                      {credits} credit{credits === 1 ? '' : 's'}
                    </span>{' '}
                    left —{' '}
                    {credits >= 20
                      ? `about ${Math.floor(credits / 20)} more AI video${Math.floor(credits / 20) === 1 ? '' : 's'}. ${planTier === 'free' && !hasPaid ? 'Free Fast includes up to 3 watermarked previews per 24 hours.' : 'Paid Fast clean exports use 1 credit each.'}`
                      : `not enough for another AI video (each takes 20). ${planTier === 'free' && !hasPaid ? 'You can still make up to 3 watermarked Fast previews per 24 hours.' : 'Paid Fast clean exports use 1 credit each.'}`}
                  </p>
                )}
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
                  below remain visible. The 9:16 aspect-ratio box plus
                  object-fit: cover fills the frame so the vertical Short
                  never shows black pillarbox bars. */}
              <div
                className="rounded-2xl overflow-hidden mt-6"
                style={{
                  width: 'min(460px, 90vw)',
                  maxHeight: '78vh',
                  aspectRatio: '9 / 16',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                  border: '1px solid rgba(41,151,255,.45)',
                  boxShadow: '0 18px 60px rgba(41,151,255,.22)',
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
                {/* Push #097 — self-healing player. The <video> stays mounted
                    at all times; while the CDN is still propagating the fresh
                    MP4 we lay a "finishing up" overlay ON TOP of it instead of
                    swapping it out. A background effect keeps re-attempting the
                    load every few seconds and drops the overlay automatically
                    the moment the file plays — so a user who navigated away
                    during the render never has to click anything. */}
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  {/* Keep native download hidden so every browser uses the named
                      file action below. Free users receive this same current
                      watermarked asset; checkout only replaces it with a clean one. */}
                  <video
                    ref={videoRef}
                    key={finalVideoUrl}
                    src={finalVideoUrl}
                    controls
                    controlsList="nodownload"
                    onContextMenu={(e) => e.preventDefault()}
                    autoPlay
                    playsInline
                    preload="metadata"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  {playerFailed && (
                    <div
                      role="status"
                      aria-live="polite"
                      style={{
                        position: 'absolute',
                        inset: 0,
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
                        Finishing up your video — it&apos;ll appear here automatically in a few seconds.
                      </p>
                      <button
                        type="button"
                        onClick={() => { setPlayerFailed(false); playerRetryAttemptRef.current = 0 }}
                        style={{
                          marginTop: '4px',
                          background: 'linear-gradient(135deg, #2997ff, #2997ff)',
                          border: 'none',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          padding: '10px 22px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          boxShadow: '0 6px 22px rgba(41,151,255,.32)',
                        }}
                      >
                        Refresh now
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* PUSH #25 — make the real export decision explicit. The previous
                  layout placed a blue clean-export offer above a much louder green
                  free-download button. A real user skipped checkout, downloaded,
                  then cancelled share. One card now presents both honest choices:
                  clean Starter first, free watermarked export second. */}
              {showPostVideoExportChoice && (
                <div
                  ref={postVideoOfferRef}
                  className="rounded-2xl px-5 py-5 mt-6 w-full"
                  style={{
                    maxWidth: 460,
                    background: 'linear-gradient(135deg, rgba(41,151,255,.12), rgba(41,151,255,.05))',
                    border: '1px solid rgba(41,151,255,.5)',
                    boxShadow: '0 0 28px rgba(41,151,255,.16)',
                  }}
                >
                  <div className="text-center">
                    <div
                      className="text-[10px] font-black uppercase tracking-[.18em] mb-1.5"
                      style={{ color: '#2997ff' }}
                    >
                      Choose your export
                    </div>
                    <h3
                      className="font-black tracking-tight"
                      style={{ fontSize: '1.15rem', color: 'var(--text)', lineHeight: 1.25 }}
                    >
                      {watermarkedDownloadConfirmed
                        ? 'Your watermarked copy is downloaded'
                        : 'Keep this exact video — without the Kineo watermark'}
                    </h3>
                    <p className="text-xs mt-1.5" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
                      {watermarkedDownloadConfirmed
                        ? 'Upgrade any time to rebuild this exact video clean and keep creating.'
                        : 'Start Starter and we rebuild this exact video clean. You also get 25 credits for clean Fast Shorts this month.'}
                    </p>
                    <p className="text-xs mt-2 font-bold" style={{ color: '#5cb3ff', lineHeight: 1.45 }}>
                      $4.90 today · then $9.90/month in 30 days · cancel anytime
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveWatermark}
                    className="flex flex-col items-center justify-center w-full rounded-xl mt-4 py-3 px-3 text-sm font-black text-center text-white"
                    style={{
                      background: 'linear-gradient(135deg, #2997ff, #1d6fe0)',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 8px 24px rgba(41,151,255,.34)',
                    }}
                  >
                    <span>Download clean + Start Starter — $4.90 →</span>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, opacity: 0.92, marginTop: 3 }}>
                      This exact video clean · 25 credits included
                    </span>
                  </button>
                  <div className="flex items-center gap-3 my-3" aria-hidden>
                    <span style={{ height: 1, flex: 1, background: 'var(--border)' }} />
                    <span style={{ color: 'var(--muted2)', fontSize: '0.68rem', fontWeight: 700 }}>OR</span>
                    <span style={{ height: 1, flex: 1, background: 'var(--border)' }} />
                  </div>
                  <a
                    href={finalVideoUrl}
                    onClick={handleDownload}
                    download={`${slugifyTitle(analysis?.title) || `kineo-${duration}s`}.mp4`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full rounded-xl py-3 px-3 text-sm font-bold"
                    style={{
                      background: watermarkedDownloadConfirmed ? 'rgba(41,151,255,.08)' : 'rgba(255,255,255,.05)',
                      border: watermarkedDownloadConfirmed ? '1px solid rgba(41,151,255,.3)' : '1px solid var(--border2)',
                      color: watermarkedDownloadConfirmed ? '#5cb3ff' : 'var(--text)',
                      textDecoration: 'none',
                    }}
                  >
                    <span>{watermarkedDownloadConfirmed ? '✓' : '⬇'}</span>
                    {watermarkedDownloadConfirmed
                      ? 'Download the free watermarked copy again'
                      : `Download free with Kineo watermark (${duration}s · MP4)`}
                  </a>
                  <p className="text-center mt-2" style={{ color: 'var(--muted2)', fontSize: '0.7rem', lineHeight: 1.45 }}>
                    Free export stays available · secure checkout · no hidden fees
                  </p>
                </div>
              )}

              {/* Push #296 — redesigned action section. Download is the primary
                  CTA (big green button, full width). Secondary actions in a
                  compact row below. WhatsApp added for mobile sharing. */}
              <div
                className="mt-7 w-full flex flex-col items-center gap-3"
                style={{ maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}
              >
                {!showPostVideoExportChoice && (
                  <a
                    href={finalVideoUrl}
                    onClick={handleDownload}
                    download={`${slugifyTitle(analysis?.title) || `kineo-${duration}s`}.mp4`}
                    target="_blank"
                    rel="noreferrer"
                    title={planTier === 'free' && !hasPaid
                      ? 'Download MP4 with Kineo watermark'
                      : planTier === null && !hasPaid
                        ? 'Download MP4'
                        : 'Download clean MP4'}
                    className="flex items-center justify-center gap-2 w-full rounded-2xl py-4 text-base font-black text-white"
                    style={{
                      background: 'linear-gradient(135deg, #22C55E, #15803D)',
                      textDecoration: 'none',
                      boxShadow: '0 8px 28px rgba(41,151,255,.45)',
                      letterSpacing: '-0.01em',
                      fontSize: '1rem',
                    }}
                  >
                    <span style={{ fontSize: '1.15rem' }}>⬇</span>
                    {planTier === 'free' && !hasPaid
                      ? `Download with Kineo watermark (${duration}s · MP4)`
                      : planTier === null && !hasPaid
                        ? `Download Your Short (${duration}s · MP4)`
                        : `Download clean Short (${duration}s · MP4)`}
                  </a>
                )}

                {publicVideoId ? (
                  <button
                    ref={sharePromptRef}
                    type="button"
                    onClick={handleSharePublic}
                    className="flex w-full flex-col items-center justify-center rounded-2xl px-5 py-4 text-center font-black"
                    style={{
                      background: 'linear-gradient(135deg, rgba(41,151,255,.22), rgba(139,92,246,.18))',
                      border: '1px solid rgba(41,151,255,.55)',
                      color: '#eaf4ff',
                      cursor: 'pointer',
                      boxShadow: '0 8px 28px rgba(41,151,255,.16)',
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>
                      {sharedPublic === 'shared'
                        ? '✓ Shared!'
                        : sharedPublic === 'copied'
                          ? '✓ Watch page copied — paste it in any chat'
                          : sharedPublic === 'ready'
                            ? 'Your public link is ready to copy'
                            : '📋 Copy your public watch page'}
                    </span>
                    <span style={{ marginTop: 4, fontSize: '0.72rem', fontWeight: 650, color: '#a9c9ec' }}>
                      Send it for feedback. Friends can watch it and make one like it.
                    </span>
                  </button>
                ) : (
                  <div
                    className="w-full rounded-xl px-4 py-3 text-center text-xs font-bold"
                    style={{ color: 'var(--muted2)', border: '1px solid var(--border)', background: 'rgba(255,255,255,.04)' }}
                  >
                    Preparing your public share link…
                  </div>
                )}

                {/* Secondary row: preview + tracked public-share channels. */}
                {/* The current asset is intentionally shareable. For free users
                    it is the watermarked growth-loop asset; this UI never exposes
                    a separate clean URL. */}
                <div className="flex flex-wrap items-center justify-center gap-2 w-full">
                  <a
                    href={publicSharePath() ?? finalVideoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold"
                    style={{
                      background: 'rgba(255,255,255,.06)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ▶ Watch page
                  </a>
                  <button
                    type="button"
                    onClick={() => handlePublicShareChannel('whatsapp')}
                    disabled={!publicVideoId}
                    className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold"
                    style={{
                      background: 'rgba(37,211,102,.10)',
                      border: '1px solid rgba(37,211,102,.35)',
                      color: publicVideoId ? '#25D366' : 'var(--muted)',
                      cursor: publicVideoId ? 'pointer' : 'not-allowed',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    📲 WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={handleNativeSharePublic}
                    disabled={!publicVideoId}
                    className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold"
                    style={{
                      background: 'rgba(255,255,255,.06)',
                      border: '1px solid var(--border)',
                      color: publicVideoId ? 'var(--text)' : 'var(--muted)',
                      cursor: publicVideoId ? 'pointer' : 'not-allowed',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ⋯ More
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleContinueSeries(analysis?.title ?? prompt, 'done_screen', publicVideoId)}
                  className="flex w-full flex-col items-center justify-center rounded-2xl px-5 py-4 text-center font-black"
                  style={{
                    background: 'rgba(255,255,255,.055)',
                    border: '1px solid rgba(255,255,255,.16)',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: '0.95rem' }}>Build the next episode →</span>
                  <span style={{ marginTop: 4, fontSize: '0.72rem', fontWeight: 650, color: 'var(--muted2)' }}>
                    Same settings stay selected · new hook, facts and payoff
                  </span>
                </button>

                {/* Push #317 — YouTube upload: connect or post directly */}
                {ytResult ? (
                  // Upload succeeded — show link to the live Short
                  <a
                    href={ytResult.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-bold"
                    style={{
                      background: 'rgba(41,151,255,.10)',
                      border: '1px solid rgba(41,151,255,.40)',
                      color: '#5cb3ff',
                      textDecoration: 'none',
                    }}
                  >
                    ✅ Short posted! View on YouTube ↗
                  </a>
                ) : ytConnected === false ? (
                  // Not connected — invite to connect
                  <a
                    href="/api/youtube/auth"
                    className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-bold"
                    style={{
                      background: 'rgba(255,0,0,.08)',
                      border: '1px solid rgba(255,0,0,.28)',
                      color: '#ff4444',
                      textDecoration: 'none',
                    }}
                  >
                    <span>▶</span> Connect YouTube to auto-upload
                  </a>
                ) : (
                  // Connected (or still checking) — show upload button
                  <button
                    type="button"
                    onClick={handleYouTubeUpload}
                    disabled={ytUploading || ytConnected === null}
                    className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-bold"
                    style={{
                      background: ytUploading ? 'rgba(255,0,0,.04)' : 'rgba(255,0,0,.08)',
                      border: '1px solid rgba(255,0,0,.28)',
                      color: ytUploading ? '#ff888888' : '#ff4444',
                      cursor: ytUploading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {ytUploading ? '⏳ Uploading to YouTube…' : <><span>▶</span> Post to YouTube</>}
                  </button>
                )}
                {ytError && (
                  <p className="text-xs text-center mt-1" style={{ color: '#f87171' }}>{ytError}</p>
                )}
              </div>

              {/* KINEO-TAAFT-REVIEW-2026-07-14 / KINEO-SPRINT-OFFER-2026-07-14 —
                  TAAFT review ask, MOVED here (right after the download/share
                  actions) from its old spot next to the upgrade block below:
                  the review ask and the upsell were landing in the same
                  viewport and competing for the same click. It also now only
                  shows from the 2nd successful render on (renderCount prop —
                  the counter effect above). All other gating (TAAFT signup
                  source via /api/me/plan, once-per-browser localStorage flag)
                  lives inside the component; any failure → renders null. */}
              <TaaftReviewAsk renderCount={renderCount} />

              {/* Push #156 — Next-steps guide. Open by default (Push #296)
                  so users always see the 3-step publishing flow. */}
              <details
                open
                className="rounded-2xl mt-6 w-full"
                style={{
                  maxWidth: 480,
                  background: 'rgba(41,151,255,.05)',
                  border: '1px solid #2997ff',
                }}
              >
                <summary
                  className="cursor-pointer select-none px-5 py-3 text-sm font-black"
                  style={{ color: '#2997ff', listStyle: 'none' }}
                >
                  ✅ What to do next ▾
                </summary>
                <div className="px-5 pb-5 pt-1 flex flex-col gap-3">
                  <div className="flex items-start gap-3 text-xs" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
                    <span style={{ color: '#5cb3ff', fontWeight: 800 }}>✓</span>
                    <span>
                      <span style={{ color: 'var(--text)', fontWeight: 700 }}>Download your video</span>{' '}
                      — use the download button above to save the file to your device
                      {planTier === 'free' && !hasPaid ? ' with the Kineo watermark; Starter exports this same video clean' : ''}.
                    </span>
                  </div>
                  <div className="flex items-start gap-3 text-xs" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
                    <span style={{ color: '#2997ff', fontWeight: 800 }}>2</span>
                    <span>
                      <span style={{ color: 'var(--text)', fontWeight: 700 }}>Post to YouTube</span>{' '}
                      — click the red "Post to YouTube" button above to upload directly. Or open{' '}
                      <a
                        href="https://studio.youtube.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#2997ff', textDecoration: 'underline', fontWeight: 700 }}
                      >
                        studio.youtube.com
                      </a>{' '}
                      manually.
                    </span>
                  </div>
                  <div className="flex items-start gap-3 text-xs" style={{ color: 'var(--muted2)', lineHeight: 1.5 }}>
                    <span style={{ color: '#2997ff', fontWeight: 800 }}>3</span>
                    <div className="flex-1">
                      <span style={{ color: 'var(--text)', fontWeight: 700 }}>Paste the description</span>{' '}
                      — copy the ready-made caption below.
                      {nextStepsDescription && (
                        <div
                          className="rounded-lg mt-2 p-3 text-xs"
                          style={{
                            background: 'rgba(0,0,0,.30)',
                            border: '1px solid rgba(41,151,255,.25)',
                            color: 'var(--muted2)',
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.5,
                            maxHeight: 160,
                            overflowY: 'auto',
                          }}
                        >
                          {nextStepsDescription}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => copySection('next-steps-desc', nextStepsDescription)}
                        className="rounded-lg px-4 py-2 mt-2 text-xs font-bold"
                        style={{
                          background:
                            copiedSection === 'next-steps-desc'
                              ? 'rgba(41,151,255,.12)'
                              : 'rgba(41,151,255,.10)',
                          border:
                            copiedSection === 'next-steps-desc'
                              ? '1px solid rgba(41,151,255,.45)'
                              : '1px solid rgba(41,151,255,.45)',
                          color: copiedSection === 'next-steps-desc' ? '#5cb3ff' : '#2997ff',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {copiedSection === 'next-steps-desc' ? '✓ Copied' : '📋 Copy description'}
                      </button>
                    </div>
                  </div>
                </div>
              </details>

              {/* Push #099 — Post-generation upgrade upsell (free users with
                  credits < 20 — KINEO-REBASE-2026-07-10).
                  KINEO-SPRINT-OFFER-2026-07-14 — SINGLE OFFER rebuild: one
                  primary path (intro Creator $9.90 first month — the plan that
                  unlocks AI scenes + AI Presenter) + intro Starter $4.90 as
                  the quieter secondary. This block now appears only to legacy
                  pack buyers; unpaid users see the single contextual Starter
                  offer beside their finished video. Both buttons use GET (the old primary POSTed to
                  /api/stripe/checkout, which has NO POST handler — every click
                  silently fell back to /pricing). Green gradient → brand blue. */}
              {/* Legacy pack buyers have paid but remain on the free plan; this
                  is their recurring upgrade path. Unpaid users already saw one
                  contextual offer above, so do not show a second ladder here. */}
              {planTier === 'free' && hasPaid && credits !== null && credits < 20 && (
                <div
                  className="rounded-2xl px-5 py-5 mt-6 w-full"
                  style={{
                    maxWidth: 480,
                    background:
                      'linear-gradient(135deg, rgba(41,151,255,.10), rgba(41,151,255,.06))',
                    border: '1px solid rgba(41,151,255,.45)',
                    boxShadow:
                      '0 0 28px rgba(41,151,255,.16), inset 0 1px 0 rgba(255,255,255,.04)',
                  }}
                >
                  <div className="text-center">
                    <div
                      className="text-[11px] font-black uppercase tracking-[.16em] mb-1.5"
                      style={{ color: '#5cb3ff' }}
                    >
                      🚀 Loved your Short? Make more.
                    </div>
                    <p
                      className="text-xs font-semibold"
                      style={{ color: 'var(--muted2)', lineHeight: 1.5 }}
                    >
                      Full AI scenes, AI Presenter and 150 credits every month.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      trackCheckoutClick('basic')
                      window.location.href = '/api/stripe/checkout?tier=basic&intro=1'
                    }}
                    className="flex flex-col items-center justify-center w-full rounded-xl mt-4 py-3 text-sm font-black text-center text-white"
                    style={{
                      background: 'linear-gradient(135deg, #2997ff, #1d6fe0)',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 8px 24px rgba(41,151,255,.32)',
                    }}
                  >
                    <span>Go Creator — $9.90 first month →</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.92, marginTop: 2 }}>
                      renews at $24.90/mo in 30 days · cancel anytime
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      trackCheckoutClick('starter')
                      window.location.href = '/api/stripe/checkout?tier=starter&intro=1'
                    }}
                    className="block w-full rounded-xl mt-2.5 px-4 py-3 text-center"
                    style={{
                      background: 'rgba(41,151,255,0.06)',
                      border: '1px dashed rgba(41,151,255,0.4)',
                      color: '#f5f5f7',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      lineHeight: 1.35,
                      cursor: 'pointer',
                    }}
                  >
                    Just want Fast videos?{' '}
                    <span style={{ color: '#2997ff' }}>Starter — $4.90 first month →</span>
                    <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#86868b', marginTop: 2 }}>
                      25 credits/month · renews at $9.90/mo in 30 days · cancel anytime
                    </span>
                  </button>
                </div>
              )}

              {/* Referral loop — compact "Give X, get X" invite card at the
                  win moment. Fetches the user's real link from /api/referral;
                  renders nothing if the loop is unavailable. */}
              <ReferralMiniCard />

              {/* KINEO-SPRINT-OFFER-2026-07-14 — <TaaftReviewAsk/> used to sit
                  here, directly under the upgrade block (same viewport as the
                  upsell). Moved up, right after the download/share actions. */}

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
                    background: 'rgba(41,151,255,.10)',
                    border: '1px solid rgba(41,151,255,.35)',
                    color: '#5cb3ff',
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
                    : `${selectedCost === 0 ? 'Free' : `${selectedCost} credit${selectedCost === 1 ? '' : 's'} used`}`}
                </span>
                <span>·</span>
                <span style={{ color: mode === 'fast' ? '#5cb3ff' : mode === 'cinematic_ai' ? '#2997ff' : '#2997ff', fontWeight: 700 }}>
                  {mode === 'fast' ? 'Fast Mode ⚡' : mode === 'cinematic_ai' ? 'AI Video 🤖' : 'Cinematic 🎬'}
                </span>
              </div>

              <p className="text-xs mt-4 text-center" style={{ color: '#5cb3ff', maxWidth: 480, lineHeight: 1.55 }}>
                💡 Tip: Post within 2 hours for max algorithm boost.
              </p>

              <p className="text-xs mt-2 text-center" style={{ color: 'var(--muted)', maxWidth: 420, lineHeight: 1.55 }}>
                Voiceover, captions and CTA are baked into the final video. Upload it straight to YouTube Shorts or TikTok.
              </p>
            </section>
          )}

          {/* Push #060 smart paywall REMOVED (KINEO-SPRINT-OFFER-2026-07-14):
              <PostVideoPaywall/> duplicated the Push #099 intro-offer block
              for the exact same audience (free users, low credits) while
              still pitching FOUNDING50 and the $4.90 one-time pack — the
              conflicting-offers problem this sprint kills. One screen, one
              offer: the #099 block above is it. */}

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

          {/* Push #311 — Performance tracking nudge. After the video is done,
              prompt the user to come back and track how it performed on YouTube.
              Simple clipboard copy of a reminder — no backend needed yet. */}
          {phase === 'done' && finalVideoUrl && (
            <div
              className="gv-card rounded-2xl p-4 mb-6"
              style={{
                background: 'rgba(41,151,255,.06)',
                border: '1px solid rgba(41,151,255,.25)',
              }}
            >
              <div className="flex items-start gap-3">
                <span style={{ fontSize: 20, lineHeight: 1 }}>📊</span>
                <div>
                  <div className="font-black text-sm mb-1" style={{ color: '#5cb3ff' }}>
                    Track this video after you post
                  </div>
                  <div className="text-xs leading-relaxed mb-3" style={{ color: 'var(--muted2)' }}>
                    Once it&apos;s live on YouTube, come back and tell us how it performed.
                    We&apos;ll use that data to make your next Viral Now cards smarter.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const reminder = `Kineo — track this video performance:\nPrompt: ${prompt.slice(0, 80)}...\nGenerated: ${new Date().toLocaleDateString()}\nYouTube link: [paste here]`
                      navigator.clipboard.writeText(reminder).catch(() => {})
                      setCopiedSection('perf_reminder')
                      setTimeout(() => setCopiedSection((c) => (c === 'perf_reminder' ? null : c)), 1800)
                    }}
                    className="rounded-lg px-4 py-2 text-xs font-bold"
                    style={{
                      background: 'rgba(41,151,255,.15)',
                      border: '1px solid rgba(41,151,255,.35)',
                      color: '#5cb3ff',
                      cursor: 'pointer',
                    }}
                  >
                    {copiedSection === 'perf_reminder' ? '✓ Copied reminder!' : '📋 Copy reminder to track later'}
                  </button>
                </div>
              </div>
            </div>
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
            planTier === 'free' && (hasPaid || !lastFastRenderRef.current) ? (
              // KINEO-SPRINT-OFFER-2026-07-14 — BUG FIX: the button said
              // "Upgrade to Creator — $24.90/mo" but passed tier 'pro'
              // (Studio $37.90) to handleUpgradeNow — and handleUpgradeNow
              // POSTs to a route with no POST handler, dumping every click on
              // /pricing. Now: GET checkout, Creator, intro month — the same
              // single offer as every other surface on this screen.
              <UpsellSection
                onAnother={handleReset}
                onUpgrade={() => {
                  trackCheckoutClick('basic')
                  window.location.href = '/api/stripe/checkout?tier=basic&intro=1'
                }}
                upgradeLoading={upgradeLoading}
                creditsLeft={credits ?? 0}
              />
            ) : planTier !== 'free' ? (
              <NextActionSection onAnother={handleReset} onUpgrade={() => router.push('/pricing')} />
            ) : null
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 flex-wrap mb-6">
                <p className="text-[10px] font-bold uppercase tracking-widest w-full text-center" style={{ color: 'var(--muted)', letterSpacing: '0.18em' }}>
                  Kineo v3.0
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


// ─── Push #048 — Visual History ─────────────────────────────────────────────
// Empty state when the user has no rows yet. Status chip on every card.
// "Open" link is rendered only when video_url is present (completed runs).
// Push #229 — robust thumbnail for the dashboard's recent-shorts cards.
// `thumbnail_url` is the Creatomate snapshot, which is often null or points
// at an expired/404 Creatomate CDN URL. The card previously painted it as a
// bare CSS background with only a 🎬 glyph for the null case, so a broken or
// expired URL rendered an empty/broken box. We now degrade gracefully: show
// the snapshot image, fall back to the video's own first frame when the
// snapshot is missing or fails to load (#t media fragment, metadata-only so
// the clip isn't downloaded), and only show the glyph when there's no usable
// media. Mirrors the fallback already used on the My Videos page.
function RecentVideoThumb({ video }: { video: RecentVideo }) {
  const [imgFailed, setImgFailed] = useState(false)
  const hasThumb = !!video.thumbnail_url && !imgFailed
  const canVideoFrame = !!video.video_url && video.status === 'completed'

  if (hasThumb) {
    return (
      <img
        src={video.thumbnail_url as string}
        alt=""
        loading="lazy"
        onError={() => setImgFailed(true)}
        className="absolute inset-0 h-full w-full object-cover"
      />
    )
  }

  if (canVideoFrame) {
    return (
      <video
        src={`${video.video_url}#t=0.5`}
        muted
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
      />
    )
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ color: 'rgba(92,179,255,.55)', fontSize: '1.8rem' }}
    >
      🎬
    </div>
  )
}

function RecentVideosSection({ videos }: { videos: RecentVideo[] | null }) {
  // null = still loading initial fetch
  if (videos === null) {
    return (
      <section
        className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
        style={{ background: '#131316', border: '1px solid var(--border)' }}
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
        style={{ background: '#131316', border: '1px solid var(--border)' }}
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
      return { label: 'Completed', fg: '#5cb3ff', bg: 'rgba(41,151,255,.10)', border: 'rgba(41,151,255,.32)' }
    if (s === 'failed' || s === 'cancelled')
      return { label: 'Failed', fg: '#f87171', bg: 'rgba(248,113,113,.10)', border: 'rgba(248,113,113,.32)' }
    return { label: 'Processing', fg: '#2997ff', bg: 'rgba(41, 151, 255,.10)', border: 'rgba(41, 151, 255,.32)' }
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

  const latestCompleted = videos.find((video) => video.status === 'completed') ?? null
  const latestContinuationHref = latestCompleted
    ? buildSeriesContinuationHref(latestCompleted.title, 'generate_recent_video')
    : '/generate'

  return (
    <section
      className="gv-card rounded-2xl p-5 sm:p-6 mb-6"
      style={{ background: '#131316', border: '1px solid var(--border)' }}
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
          style={{ color: '#5cb3ff', textDecoration: 'none' }}
        >
          View all →
        </a>
      </div>

      {latestCompleted && (
        <div
          className="rounded-xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          style={{
            background: 'linear-gradient(135deg, rgba(41,151,255,.14), rgba(41,151,255,.04))',
            border: '1px solid rgba(41,151,255,.38)',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: '#5cb3ff' }}>
              Continue your show
            </div>
            <p className="text-xs font-bold" style={{ color: 'var(--text)', margin: 0, lineHeight: 1.45 }}>
              Turn “{latestCompleted.title}” into a fresh next episode.
            </p>
          </div>
          <a
            href={latestContinuationHref}
            onClick={() => {
              void trackEvent('series_continue_clicked', {
                source: 'generate_recent_video',
                video_id: latestCompleted.id,
              })
            }}
            className="rounded-xl px-4 py-2.5 text-xs font-black text-center flex-shrink-0"
            style={{
              background: '#2997ff',
              color: '#fff',
              textDecoration: 'none',
              boxShadow: '0 5px 18px rgba(41,151,255,.28)',
            }}
          >
            Build next episode →
          </a>
        </div>
      )}

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
                  background: 'linear-gradient(135deg, rgba(41,151,255,.18), rgba(41,151,255,.12))',
                  aspectRatio: '9 / 16',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <RecentVideoThumb video={v} />
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
                    style={{ color: '#5cb3ff', textDecoration: 'none' }}
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
  const visualsActive = phase === 'generating' || phase === 'fal_polling'

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
      sub: 'Kineo engine',
      status: renderDone ? 'done' : renderActive ? 'active' : 'queued',
    },
    {
      label: 'Preparing download',
      sub: 'Your Short is ready',
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
        const color = isDone ? '#5cb3ff' : isActive ? '#5cb3ff' : 'var(--muted)'
        const ring = isDone
          ? '1px solid rgba(41,151,255,.45)'
          : isActive
          ? '1px solid rgba(92,179,255,.45)'
          : '1px solid var(--border)'
        const bg = isDone
          ? 'rgba(41,151,255,.08)'
          : isActive
          ? 'rgba(41,151,255,.08)'
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
                  ? 'rgba(41,151,255,.18)'
                  : isActive
                  ? 'transparent'
                  : 'rgba(255,255,255,.04)',
                border: isDone
                  ? '1px solid rgba(41,151,255,.55)'
                  : isActive
                  ? '2px solid rgba(92,179,255,.55)'
                  : '1px solid var(--border)',
                borderTopColor: isActive ? '#5cb3ff' : undefined,
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
function ViralIntelligencePanel({
  vi,
  onApply,
  applyingIndex,
}: {
  vi: ViralIntelligence
  onApply?: (suggestion: string, index: number) => void
  applyingIndex?: number | null
}) {
  const { viralScore, improvementSuggestions } = vi
  const accent =
    viralScore >= 75
      ? { color: '#5cb3ff', bg: 'rgba(41,151,255,.10)', border: 'rgba(41,151,255,.32)', label: 'Strong' }
      : viralScore >= 50
      ? { color: '#2997ff', bg: 'rgba(41, 151, 255,.10)', border: 'rgba(41, 151, 255,.32)', label: 'Good' }
      : { color: '#f87171', bg: 'rgba(248,113,113,.10)', border: 'rgba(248,113,113,.32)', label: 'Needs work' }

  const topSuggestions = improvementSuggestions.slice(0, 2)

  return (
    <section
      className="gv-card rounded-2xl p-5 sm:p-6 mb-4"
      style={{
        background: '#131316',
        border: `1px solid ${accent.border}`,
        boxShadow: `0 0 28px ${accent.bg}`,
      }}
    >
      <div className="flex flex-col items-center text-center">
        <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          Viral Score
        </div>
        <div className="flex items-baseline gap-1" style={{ lineHeight: 1 }}>
          <span className="font-black" style={{ color: accent.color, fontSize: '4rem', lineHeight: 1 }}>
            {viralScore}
          </span>
          <span className="font-black" style={{ color: 'var(--muted)', fontSize: '1.1rem' }}>
            / 100
          </span>
        </div>
        <span
          className="font-black text-xs mt-2"
          style={{
            padding: '4px 12px',
            borderRadius: 999,
            background: accent.bg,
            border: `1px solid ${accent.border}`,
            color: accent.color,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {accent.label}
        </span>
      </div>

      {/* Push #300 — Score breakdown by sub-metric */}
      {(() => {
        const hookVal = vi.hookRating === 'excellent' ? 10 : vi.hookRating === 'strong' ? 8 : vi.hookRating === 'medium' ? 6 : 4
        const base = Math.round(viralScore / 10)
        const subs = [
          { label: 'Hook strength',     val: hookVal },
          { label: 'Trending potential', val: Math.min(10, base + (viralScore % 7 > 3 ? 1 : 0)) },
          { label: 'Retention hook',    val: Math.max(1, Math.min(10, base - (viralScore % 5 > 2 ? 1 : 0))) },
          { label: 'Shareability',      val: Math.min(10, base + (viralScore % 3 === 0 ? 1 : 0)) },
        ]
        return (
          <div className="w-full mt-5 flex flex-col gap-2">
            {subs.map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="text-[11px] w-36 text-right shrink-0" style={{ color: 'var(--muted)' }}>{s.label}</span>
                <div className="flex-1 rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${s.val * 10}%`, background: accent.color, opacity: 0.85 }} />
                </div>
                <span className="text-[11px] font-black w-6 shrink-0" style={{ color: accent.color }}>{s.val}</span>
              </div>
            ))}
          </div>
        )
      })()}

      {topSuggestions.length > 0 && (
        <div className="flex flex-col gap-2 mt-5">
          {/* Push #439 — each suggestion is now a real button. Clicking "Apply"
              rewrites the script with that improvement and re-scores. The row
              being applied shows "Applying…"; the others dim + disable. */}
          {topSuggestions.map((n, i) => {
            const busy = applyingIndex === i
            const otherBusy = applyingIndex != null && applyingIndex !== i
            const interactive = !!onApply
            return (
              <button
                key={i}
                type="button"
                disabled={!interactive || applyingIndex != null}
                onClick={interactive ? () => onApply!(n, i) : undefined}
                className="rounded-xl px-4 py-3 flex items-center gap-3 text-left w-full transition-all"
                style={{
                  background: busy ? 'rgba(41, 151, 255,.14)' : 'rgba(41, 151, 255,.06)',
                  border: '1px solid rgba(41, 151, 255,.30)',
                  cursor: !interactive ? 'default' : applyingIndex != null ? 'wait' : 'pointer',
                  opacity: otherBusy ? 0.45 : 1,
                }}
              >
                <span style={{ color: '#2997ff', fontWeight: 900, fontSize: '1.1rem', lineHeight: 1 }}>
                  {busy ? '⏳' : '→'}
                </span>
                <span className="text-xs font-bold" style={{ color: 'var(--text2)', lineHeight: 1.45, flex: 1 }}>
                  {n}
                </span>
                <span
                  className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
                  style={{ color: '#2997ff' }}
                >
                  {busy ? 'Applying…' : 'Apply'}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ─── Push #047 components ──────────────────────────────────────────────────

// Inline credit chip — fed by the /api/credits effect at the top of
// GenerateClient. Renders three states: loading skeleton, low-credits
// warning (under LOW_CREDITS_THRESHOLD), and healthy balance. We don't
// render anything for guests (credits === null after a 401) since the
// page already redirects them to /login when they try to generate.
function CreditsChip({
  credits,
  loading,
  freeFastPreview,
}: {
  credits: number | null
  loading: boolean
  freeFastPreview: boolean
}) {
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
  if (freeFastPreview) {
    return (
      <div style={{ textAlign: 'right' }}>
        <div
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold"
          style={{
            background: 'rgba(41,151,255,.10)',
            border: '1px solid rgba(41,151,255,.35)',
            color: '#5cb3ff',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#5cb3ff',
              boxShadow: '0 0 8px rgba(41,151,255,.5)',
              display: 'inline-block',
            }}
          />
          Fast previews are free
        </div>
        <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted2)', fontWeight: 600 }}>
          Up to 3 / 24h · watermark · no card
        </p>
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
          background: low ? 'rgba(41, 151, 255,.10)' : 'rgba(41,151,255,.08)',
          border: low ? '1px solid rgba(41, 151, 255,.35)' : '1px solid rgba(41,151,255,.30)',
          color: low ? '#2997ff' : '#5cb3ff',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: low ? '#2997ff' : '#5cb3ff',
            boxShadow: low ? '0 0 8px rgba(41, 151, 255,.5)' : '0 0 8px rgba(41,151,255,.5)',
            display: 'inline-block',
          }}
        />
        {credits} credit{credits === 1 ? '' : 's'} left
      </div>
      {low && (
        <p className="text-[11px] mt-1.5" style={{ color: '#2997ff', fontWeight: 600 }}>
          Running low. <a href="/pricing" style={{ color: '#2997ff', textDecoration: 'underline' }}>Upgrade to keep creating.</a>
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
      style={{ background: '#131316', border: '1px solid var(--border)' }}
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
                ? 'linear-gradient(135deg, #2997ff, #2997ff)'
                : 'linear-gradient(135deg, #2997ff, #2997ff)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 6px 22px rgba(41,151,255,.32)',
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
                  style={{ color: '#5cb3ff' }}
                >
                  {c.label}
                </div>
                <button
                  type="button"
                  onClick={() => onCopy(c.key, c.body)}
                  className="rounded-lg px-2.5 py-1 text-xs font-bold"
                  style={{
                    background: isCopied ? 'rgba(41,151,255,.12)' : 'rgba(255,255,255,.04)',
                    border: isCopied ? '1px solid rgba(41,151,255,.45)' : '1px solid var(--border)',
                    color: isCopied ? '#5cb3ff' : 'var(--muted2)',
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
// credit-urgency line + a Creator pitch + the Generate-Another fallback.
// KINEO-SPRINT-OFFER-2026-07-14 — onUpgrade now points at the GET checkout
// with tier=basic&intro=1 (see the call site): copy and charge finally match
// (the old wiring said "Creator $24.90" but passed tier 'pro' to a POST
// endpoint that doesn't exist).
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
        background: 'linear-gradient(135deg, rgba(41,151,255,.04), rgba(41,151,255,.04))',
        border: '1px solid rgba(255,255,255,.08)',
      }}
    >
      {/* Celebration line */}
      <div
        style={{
          fontSize: '0.95rem',
          fontWeight: 800,
          color: '#5cb3ff',
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
            color: '#2997ff',
            marginBottom: 14,
          }}
        >
          ⚡ You have {creditsLeft} credit{creditsLeft === 1 ? '' : 's'} left. Don&apos;t lose your momentum.
        </div>
      )}

      {/* Pro pitch card */}
      <div
        style={{
          border: '1px solid rgba(41,151,255,.3)',
          background: 'rgba(41,151,255,.05)',
          borderRadius: 14,
          padding: '16px 20px',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: '0.72rem',
            color: '#2997ff',
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
          {/* Fix 2 (12/06) — copy matches the real tier this modal opens
              (tier=basic = Creator — KINEO-PRICING-V3B-2026-07-10). */}
          {/* KINEO-SPRINT-OFFER-2026-07-14 — intro-month framing, renewal explicit. */}
          Get 150 credits/month — 1 Hollywood film included — for $9.90 your first month
        </div>
        <ul
          style={{
            fontSize: '0.85rem',
            color: '#86868b',
            marginBottom: 16,
            paddingLeft: 18,
            lineHeight: 1.65,
          }}
        >
          <li>1 Hollywood film every month included — or ~7 AI Generated videos (20 credits each)</li>
          <li>Every scene generated by AI — cinematic feel</li>
          <li>Download MP4 · Captions included · No watermark</li>
        </ul>
        <button
          type="button"
          onClick={onUpgrade}
          disabled={upgradeLoading}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 10,
            background: upgradeLoading ? 'rgba(41,151,255,.5)' : '#2997ff',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '0.95rem',
            border: 'none',
            cursor: upgradeLoading ? 'wait' : 'pointer',
            boxShadow: '0 6px 22px rgba(41,151,255,.28)',
          }}
        >
          {upgradeLoading ? 'Opening checkout…' : 'Go Creator — $9.90 first month →'}
        </button>
        <div
          style={{
            fontSize: '0.74rem',
            color: '#86868b',
            textAlign: 'center',
            marginTop: 8,
            fontWeight: 600,
          }}
        >
          Renews at $24.90/mo in 30 days · cancel anytime
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
        background: 'linear-gradient(135deg, rgba(41,151,255,.10), rgba(41,151,255,.06))',
        border: '1px solid rgba(41,151,255,.28)',
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
            background: 'linear-gradient(135deg, #2997ff 0%, #2997ff 55%, #2997ff 100%)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 6px 22px rgba(41,151,255,.4)',
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
  // 45s → 5 clips, 60s → 6 clips, 90s → 9 clips.
  // Matches clipCountForDuration in /api/generate-video.
  // Push #208 — removed 30s, added 90s.
  const targetCount = duration === 90 ? 9 : duration === 45 ? 5 : 6
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
        border: '2px solid rgba(41,151,255,.25)',
        borderTopColor: '#5cb3ff',
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
          background: 'linear-gradient(90deg, rgba(41,151,255,.85), rgba(41,151,255,1))',
          transition: 'width 600ms ease',
        }}
      />
    </div>
  )
}

// ─── Render Header — ring progress + rotating message + elapsed timer ──────
function RenderHeader({ progress, message }: { progress: number; message: string }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`

  const r = 30
  const circ = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, progress))
  const dash = (pct / 100) * circ
  const gap = circ - dash

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 20 }}>
      {/* Ring */}
      <div style={{ position: 'relative', flexShrink: 0, width: 72, height: 72 }}>
        <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="5" />
          <circle
            cx="36" cy="36" r={r} fill="none"
            stroke="#2997ff"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            style={{ transition: 'stroke-dasharray 700ms ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color: '#5cb3ff',
        }}>
          {pct}%
        </div>
      </div>
      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4, lineHeight: 1.3 }}>
          {message}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: '#2997ff', animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          <span>Rendering · {timeStr}</span>
        </div>
        <div style={{ marginTop: 10 }}>
          <ProgressBar progress={pct} />
        </div>
      </div>
    </div>
  )
}

// ─── Push #087 — Mode Selector with Pro gating ─────────────────────────────
// Cinematic Mode renders as a non-interactive locked card for non-Pro users
// so the option is still visible (drives upgrade interest) but the click is
// inert. The server enforces the same gate as a defense-in-depth check.
// Push #088 — Pro users with 0 cinematic_tokens get a "resets monthly"
// inert card too, so spending the token doesn't silently fail at submit.
// #406 — tech redesign of the engine cards. VISUAL ONLY: selection/gating logic
// stays in ModeSelector; this component just renders one card. Accent is an
// "r,g,b" string so all glows/borders derive from one color per engine.
function EngineCard({
  selected,
  unlocked,
  accent,
  accentText,
  icon,
  name,
  engineTag,
  badge,
  features,
  quality,
  tierLabel,
  onClick,
}: {
  selected: boolean
  unlocked: boolean
  accent: string
  accentText: string
  icon: string
  name: string
  engineTag: string
  badge: JSX.Element
  features: string[]
  quality: number
  tierLabel: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative rounded-2xl p-4 text-left overflow-hidden transition-all hover:-translate-y-0.5"
      style={{
        background: selected
          ? `linear-gradient(160deg, rgba(${accent},.16) 0%, rgba(${accent},.06) 55%, rgba(255,255,255,.02) 100%)`
          : 'rgba(255,255,255,.03)',
        border: selected ? `1.5px solid rgba(${accent},.65)` : '1.5px solid var(--border)',
        boxShadow: selected
          ? `0 0 34px rgba(${accent},.20), inset 0 0 26px rgba(${accent},.06)`
          : 'none',
        cursor: 'pointer',
        opacity: unlocked ? 1 : 0.8,
      }}
    >
      {/* top accent hairline */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent 5%, rgba(${accent},${selected ? '.95' : '.35'}) 50%, transparent 95%)`,
        }}
      />
      {/* corner glow when selected */}
      {selected && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -34,
            right: -34,
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(${accent},.30), transparent 70%)`,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* header: icon chip + name + engine tag + badge */}
      <div className="relative flex items-center gap-2.5 mb-3">
        <span
          className="flex items-center justify-center rounded-lg text-base"
          style={{
            width: 34,
            height: 34,
            flexShrink: 0,
            background: `linear-gradient(135deg, rgba(${accent},.32), rgba(${accent},.10))`,
            border: `1px solid rgba(${accent},.40)`,
            boxShadow: selected ? `0 0 14px rgba(${accent},.35)` : 'none',
            filter: unlocked ? 'none' : 'grayscale(0.4)',
          }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-black leading-tight" style={{ color: selected ? accentText : 'var(--text)' }}>
            {name}
          </div>
          <div
            className="text-[9px] font-bold uppercase"
            style={{ letterSpacing: '0.16em', color: `rgba(${accent},.9)` }}
          >
            {engineTag}
          </div>
        </div>
        <div className="ml-auto flex-shrink-0">{badge}</div>
      </div>

      {/* feature list */}
      <ul className="relative space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-1.5">
            <span style={{ color: accentText, fontSize: '0.55rem' }}>◆</span>
            <span className="text-xs" style={{ color: 'var(--muted2)' }}>{f}</span>
          </li>
        ))}
      </ul>

      {/* footer: quality meter + tier label */}
      <div
        className="relative mt-3 pt-2.5 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(255,255,255,.07)' }}
      >
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 14,
                height: 3,
                borderRadius: 2,
                background: i < quality ? `rgba(${accent},.9)` : 'rgba(255,255,255,.12)',
              }}
            />
          ))}
          <span className="ml-1.5 text-[9px] font-bold uppercase" style={{ letterSpacing: '.12em', color: 'var(--muted)' }}>
            quality
          </span>
        </div>
        <span
          className="text-[9px] font-black uppercase"
          style={{ letterSpacing: '.14em', color: selected ? accentText : 'var(--muted)' }}
        >
          {tierLabel}
        </span>
      </div>
    </button>
  )
}

function ModeSelector({
  mode,
  setMode,
  isPro,
  cinematicTokens,
  credits,
  freeAiUsed,
  aiEngine,
  setAiEngine,
  isStarter,
  isCreator,
  isStudio,
  hasPaid,
  onUpgrade,
}: {
  mode: GenerationMode
  setMode: (m: GenerationMode) => void
  isPro: boolean
  cinematicTokens: number
  credits: number | null
  freeAiUsed: boolean | null
  // KINEO-HOLLYWOOD-2026-07-09 — 'hollywood' added.
  aiEngine: 'seedance' | 'kling' | 'veo' | 'sora' | 'hollywood'
  setAiEngine: (e: 'seedance' | 'kling' | 'veo' | 'sora' | 'hollywood') => void
  isStarter: boolean
  isCreator: boolean
  isStudio: boolean
  // KINEO-REBASE-2026-07-10 — universal engine gates: any paying account
  // (pack buyer or any plan) unlocks every engine, balance permitting.
  hasPaid: boolean
  onUpgrade: () => void
}) {
  const fastFeatures = ['Smart stock footage (matched per scene)', 'Natural AI voice', 'Ready in ~60 seconds']
  const aiFeatures = ['Every scene generated by AI', 'Great-quality AI visuals (Seedance)', 'Cinematic feel']
  const cinematicFeatures_kling = ['Top-tier cinematic motion', 'Premium one-of-a-kind scenes', 'Our highest quality (Kling)']

  // KINEO-REBASE-2026-07-10 — UNIVERSAL ENGINE GATES. The old per-plan ladder
  // (Seedance=Creator+, Kling/Veo/Hollywood=Studio) is retired: ANY paying
  // user unlocks every engine (server still guards the credit balance). Fast is
  // the only free mode advertised; legacy AI eligibility remains server-guarded.
  const anyPaid = isStarter || isCreator || isStudio || (hasPaid && (credits ?? 0) > 0)
  // Fast Mode is the free growth engine (subject to the server's daily cap).
  // Free-plan Fast is watermarked server-side; removing the mark + AI engines
  // are the paid upgrades. So Fast is always unlocked.
  const fastUnlocked = true
  const seedanceUnlocked = anyPaid
  const klingUnlocked = anyPaid
  const cinematicUnlocked = anyPaid
  const fastSelected = mode === 'fast'
  const seedanceSelected = mode === 'cinematic_ai' && aiEngine === 'seedance'
  const klingSelected = mode === 'cinematic_ai' && aiEngine === 'kling'
  const cinematicSelected = mode === 'cinematic_ai' && (aiEngine === 'kling' || aiEngine === 'veo' || aiEngine === 'sora' || aiEngine === 'hollywood')

  return (
    <div className="mt-5">
      <div
        className="text-xs font-black uppercase tracking-widest mb-3"
        style={{ color: 'var(--muted)' }}
      >
        Generation mode
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Push #404 — Fast = Starter engine (stock, relevance-gated). Locked → upgrade. */}
        {/* #406 — tech card redesign (EngineCard). Logic identical. */}
        <EngineCard
          selected={fastSelected}
          unlocked={fastUnlocked}
          accent="41,151,255"
          accentText="#5cb3ff"
          icon="⚡"
          name="Fast Mode"
          engineTag="Starter engine"
          tierLabel="fastest"
          quality={1}
          features={fastFeatures}
          badge={
            /* Push #434 — Fast Mode is free for everyone now.
               KINEO-PRICING-V3C-2026-07-10 — paying accounts now pay 1 credit
               per Fast video, so their badge says so; free users keep FREE
               (downloadable watermark; clean export is the paid upgrade). */
            anyPaid ? (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(41,151,255,.18)', color: '#5cb3ff', border: '1px solid rgba(41,151,255,.4)' }}>1 credit</span>
            ) : (
              <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(41,151,255,.18)', color: '#5cb3ff', border: '1px solid rgba(41,151,255,.4)' }}>FREE</span>
            )
          }
          onClick={() => { setMode('fast') }}
        />

        {/* #402 — AI Generated (Seedance, 30 cr). Available to all paid plans. */}
        {/* #406 — tech card redesign (EngineCard). Logic identical. */}
        <EngineCard
          selected={seedanceSelected}
          unlocked={seedanceUnlocked}
          accent="41,151,255"
          accentText="#2997ff"
          icon="✨"
          name="AI Generated"
          engineTag="Paid engine"
          tierLabel="premium"
          quality={2}
          features={aiFeatures}
          badge={seedanceUnlocked ? (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(41,151,255,.18)', color: '#2997ff', border: '1px solid rgba(41,151,255,.3)' }}>20 credits</span>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ background: 'rgba(41,151,255,.15)', color: '#2997ff', border: '1px solid rgba(41,151,255,.3)' }}>🔒 Paid</span>
          )}
          onClick={() => { if (seedanceUnlocked) { setMode('cinematic_ai'); setAiEngine('seedance') } else { onUpgrade() } }}
        />

        {/* #491 — Motores A: one Cinematic card with a model picker (Veo 3.1 /
            Sora 2 / Kling). Premium models gated by credits/plan; clicking a
            model sets the engine + mode. Custom card (mirrors EngineCard style). */}
        <div
          className="relative rounded-2xl p-4 text-left overflow-hidden"
          style={{
            background: cinematicSelected
              ? 'linear-gradient(160deg, rgba(41,151,255,.16) 0%, rgba(41,151,255,.06) 55%, rgba(255,255,255,.02) 100%)'
              : 'rgba(255,255,255,.03)',
            border: cinematicSelected ? '1.5px solid rgba(41,151,255,.65)' : '1.5px solid var(--border)',
            boxShadow: cinematicSelected ? '0 0 34px rgba(41,151,255,.20)' : 'none',
          }}
        >
          <span aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent 5%, rgba(41,151,255,${cinematicSelected ? '.95' : '.35'}) 50%, transparent 95%)` }} />
          <div className="relative flex items-center gap-2.5 mb-2.5">
            <span className="grid place-items-center rounded-xl" style={{ width: 34, height: 34, background: 'rgba(41,151,255,.14)', fontSize: 18 }}>🎬</span>
            <div className="min-w-0">
              <div className="text-sm font-black" style={{ color: 'var(--text)' }}>Cinematic AI</div>
              <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#7cc0ff' }}>Hollywood engine</div>
            </div>
          </div>
          <p className="text-xs mb-2.5" style={{ color: 'var(--muted2)' }}>Pick the model — same idea, a photoreal cinematic Short.</p>
          <div className="flex flex-col gap-1.5">
            {/* KINEO-SORA-REMOVED-2026-07-06 — Sora pulled from the menu until its
                fal cost is confirmed (margin guard). KINEO-REBASE-2026-07-10 —
                Veo/Kling/Hollywood unlocked for ANY paying user (universal gates). */}
            {([
              // KINEO-HOLLYWOOD-2026-07-09 — Hollywood Mode (per-scene routing,
              // native voice). KINEO-REBASE-2026-07-10 — costs halved (Hollywood
              // 150 = preço FINAL aprovado 10/07) + engines unlocked for ANY
              // paying user (universal gates — no more Studio-only lock).
              { key: 'hollywood', label: 'Hollywood', sub: 'ultra-realistic people & voice', cr: 150 },
              { key: 'veo', label: 'Veo 3.1', sub: 'Google · best motion', cr: 90 },
              { key: 'kling', label: 'Kling', sub: 'cinematic motion', cr: 50 }, // KINEO-PRICING-V3B-2026-07-10
            ] as { key: 'veo' | 'sora' | 'kling' | 'hollywood'; label: string; sub: string; cr: number }[]).map((m) => {
              const active = mode === 'cinematic_ai' && aiEngine === m.key
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => { if (cinematicUnlocked) { setMode('cinematic_ai'); setAiEngine(m.key) } else { onUpgrade() } }}
                  className="flex items-center justify-between rounded-lg px-3 py-2 transition-all"
                  style={{ background: active ? 'rgba(41,151,255,.18)' : 'rgba(255,255,255,.04)', border: active ? '1.5px solid rgba(41,151,255,.6)' : '1.5px solid var(--border)', cursor: 'pointer' }}
                >
                  <span className="text-left">
                    <span className="block text-xs font-bold" style={{ color: 'var(--text)' }}>{m.label}</span>
                    <span className="block text-[10px]" style={{ color: 'var(--muted)' }}>{m.sub}</span>
                  </span>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: 'rgba(41,151,255,.18)', color: '#7cc0ff', border: '1px solid rgba(41,151,255,.3)' }}>
                    {cinematicUnlocked ? `${m.cr} cr` : '🔒'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Cinematic Mode — Pro + token required. Locked card for Free,
            Basic, AND Pro-with-0-tokens (resets monthly). */}
        {/* #372 — Cinematic (Runway) mode hidden per request; kept for later. */}
        {false && (proHasToken ? (
          <button
            type="button"
            onClick={() => setMode('cinematic')}
            className="rounded-xl p-4 text-left"
            style={{
              background: mode === 'cinematic' ? 'rgba(41,151,255,.10)' : 'rgba(255,255,255,.03)',
              border: mode === 'cinematic' ? '1.5px solid rgba(41,151,255,.55)' : '1.5px solid var(--border)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: mode === 'cinematic' ? '0 0 28px rgba(41,151,255,.15)' : 'none',
            }}
          >
            {/* Header row */}
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-base">🎬</span>
              <span
                className="text-sm font-black"
                style={{ color: mode === 'cinematic' ? '#5cb3ff' : 'var(--text)' }}
              >
                Cinematic
              </span>
              <div className="ml-auto flex items-center gap-1.5">
                <span
                  className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                  style={{
                    background: 'rgba(41,151,255,.15)',
                    color: '#5cb3ff',
                    border: '1px solid rgba(41,151,255,.25)',
                  }}
                >
                  Pro
                </span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(41,151,255,.18)',
                    color: '#5cb3ff',
                    border: '1px solid rgba(41,151,255,.3)',
                  }}
                >
                  {cinematicTokens} token{cinematicTokens === 1 ? '' : 's'}
                </span>
              </div>
            </div>
            {/* Feature list */}
            <ul className="space-y-1">
              {cinematicFeatures.map((f) => (
                <li key={f} className="flex items-center gap-1.5">
                  <span style={{ color: '#5cb3ff', fontSize: '0.6rem' }}>●</span>
                  <span className="text-xs" style={{ color: 'var(--muted2)' }}>{f}</span>
                </li>
              ))}
            </ul>
          </button>
        ) : isPro ? (
          /* Pro user, but token already spent this month. */
          <div
            className="rounded-xl p-4"
            style={{
              background: 'rgba(41,151,255,.04)',
              border: '1.5px solid rgba(41,151,255,.18)',
              opacity: 0.7,
              cursor: 'not-allowed',
            }}
          >
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-base" style={{ filter: 'grayscale(0.5)' }}>🎬</span>
              <span className="text-sm font-black" style={{ color: 'var(--muted2)' }}>
                Cinematic
              </span>
              <div className="ml-auto">
                <span
                  className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                  style={{
                    background: 'rgba(251,191,36,.15)',
                    color: '#fbbf24',
                    border: '1px solid rgba(251,191,36,.3)',
                  }}
                >
                  Resets monthly
                </span>
              </div>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.5 }}>
              Your Cinematic token was used this month. It resets on your next renewal — use Fast Mode until then.
            </p>
          </div>
        ) : (
          /* Free / Basic — upgrade CTA. */
          <div
            className="rounded-xl p-4"
            style={{
              background: 'rgba(41,151,255,.04)',
              border: '1.5px solid rgba(41,151,255,.18)',
              cursor: 'not-allowed',
            }}
          >
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-base" style={{ filter: 'grayscale(0.5)' }}>🎬</span>
              <span className="text-sm font-black" style={{ color: 'var(--muted2)' }}>
                Cinematic
              </span>
              <div className="ml-auto">
                <span
                  style={{
                    background: 'linear-gradient(135deg,#2997ff,#2997ff)',
                    color: '#fff',
                    fontSize: '0.62rem',
                    fontWeight: 900,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '3px 10px',
                    borderRadius: 999,
                    boxShadow: '0 2px 10px rgba(147,51,234,.3)',
                  }}
                >
                  Pro Only
                </span>
              </div>
            </div>
            <ul className="space-y-1 mb-2.5">
              {cinematicFeatures.map((f) => (
                <li key={f} className="flex items-center gap-1.5">
                  <span style={{ color: 'var(--muted)', fontSize: '0.6rem' }}>●</span>
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>{f}</span>
                </li>
              ))}
            </ul>
            <a
              href="/pricing"
              className="inline-flex items-center gap-1 text-xs font-bold"
              style={{ color: '#5cb3ff', textDecoration: 'none' }}
            >
              Unlock with Pro →
            </a>
          </div>
        ))}
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
    { label: 'Writing your viral script', sub: 'AI content model' },
    { label: 'Selecting visual scenes', sub: 'AI visual matching' },
    { label: 'Synthesizing narration', sub: 'AI voice generation' },
    { label: 'Composing your Short', sub: 'Vertical 9:16 format' },
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
        const color = isDone ? '#5cb3ff' : isActive ? '#5cb3ff' : 'var(--muted)'
        const ring = isDone
          ? '1px solid rgba(41,151,255,.45)'
          : isActive
          ? '1px solid rgba(92,179,255,.45)'
          : '1px solid var(--border)'
        const bg = isDone
          ? 'rgba(41,151,255,.08)'
          : isActive
          ? 'rgba(41,151,255,.08)'
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
                  ? 'rgba(41,151,255,.18)'
                  : isActive
                  ? 'transparent'
                  : 'rgba(255,255,255,.04)',
                border: isDone
                  ? '1px solid rgba(41,151,255,.55)'
                  : isActive
                  ? '2px solid rgba(92,179,255,.55)'
                  : '1px solid var(--border)',
                borderTopColor: isActive ? '#5cb3ff' : undefined,
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
// #380 — 3-plan out-of-credits modal. Shown at the exact moment the user runs
// out of credits. Presents Spark / Basic / Pro so the user picks at peak intent.
// Each card routes to the matching Stripe checkout via onUpgrade(tier);
// currency is auto-detected server-side.
// KINEO-SPRINT-OFFER-2026-07-14 — Creator carries the "MOST POPULAR" badge
// now (lib/pricing recommended flag moved pro → basic) and the starter/basic
// rows show the intro-month price inline; onUpgrade appends ?intro=1.
function UpgradeModal({
  loading,
  onUpgrade,
  onClose,
  reason = 'credits',
  isSubscriber = false,
}: {
  loading: boolean
  onUpgrade: (tier: 'starter' | 'basic' | 'pro') => void
  onClose: () => void
  reason?: 'credits' | 'studio' | 'creator'
  isSubscriber?: boolean
}) {
  // #466 fake 15-min "founding offer" countdown REMOVED
  // (KINEO-SPRINT-OFFER-2026-07-14): the timer reset per browser and nothing
  // actually expired — a fabricated counter sitting next to a real offer
  // erodes trust in both. The intro month is the single, honest discount.
  // KINEO-REBASE-2026-07-10 — post-rebase credit numbers (2:1).
  // KINEO-SPRINT-OFFER-2026-07-14 — intro-month sublabels so the modal shows
  // ONE offer consistently (first month price + what it renews at is on the
  // plan rows themselves; the checkout applies it via ?intro=1).
  const unlocks: Record<string, string> = {
    starter: '25 credits / month · first month $4.90, then $9.90/mo',
    basic: '150 credits · 1 Hollywood film / month · first month $9.90, then $24.90/mo', // KINEO-PRICING-V3B-2026-07-10
    pro: '200 credits · up to 10 AI-generated videos',
  }
  // KINEO-PLAN-GATE-MODAL — accurate headline per reason: a real credit shortage
  // vs an engine that needs a higher plan. Users who HAVE credits but picked a
  // plan-gated engine no longer see a misleading "you're out of credits".
  const HEAD: Record<string, { title: string; sub: string }> = {
    credits: {
      title: "You're out of credits 🎉",
      sub: 'Keep the momentum going — unlock daily posting and never get stuck mid-idea again. Cancel anytime · 7-day money-back guarantee.',
    },
    // KINEO-REBASE-2026-07-10 — universal gates: every engine is available on
    // EVERY paid plan (balance permitting), so both gate messages now sell
    // "any paid plan" instead of a specific tier.
    creator: {
      title: 'Unlock AI-generated videos 🤖',
      sub: 'AI-generated videos are included with every paid plan. Pick any plan below to go from stock footage to full AI scenes. Cancel anytime · 7-day money-back.',
    },
    studio: {
      title: 'Unlock premium AI engines 🎬',
      sub: 'Kling, Veo and Hollywood are available on every paid plan — you just need the credits. Pick a plan below. Cancel anytime · 7-day money-back.',
    },
  }
  const head = HEAD[reason] ?? HEAD.credits
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
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 460,
          background: '#161618',
          border: '1px solid rgba(41,151,255,0.35)',
          borderRadius: 20,
          padding: '28px 24px',
          textAlign: 'center',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(41,151,255,0.18)',
        }}
      >
        <h2
          id="upgrade-modal-title"
          style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', lineHeight: 1.25, margin: 0, marginBottom: 8 }}
        >
          {head.title}
        </h2>
        <p style={{ fontSize: '0.92rem', color: '#cbd5e1', lineHeight: 1.5, margin: 0, marginBottom: 14 }}>
          {head.sub}
        </p>

        {/* #466 social-proof row REMOVED (KINEO-SPRINT-OFFER-2026-07-14):
            "Join 300+ creators" was unverifiable and the "50% off · mm:ss"
            pill was a fake countdown competing with the intro-month offer
            shown on the plan rows below. One modal, one offer. */}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PLAN_LIST.map((plan) => {
            const recommended = !!plan.recommended
            return (
              <button
                key={plan.tier}
                type="button"
                disabled={loading}
                onClick={() => onUpgrade(plan.tier as 'starter' | 'basic' | 'pro')}
                style={{
                  position: 'relative',
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 14,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: recommended ? 'rgba(41,151,255,0.10)' : 'rgba(255,255,255,0.04)',
                  border: recommended ? '1.5px solid rgba(41,151,255,0.6)' : '1px solid rgba(255,255,255,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  opacity: loading ? 0.7 : 1,
                  transition: 'border-color .15s ease',
                }}
              >
                {recommended && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -9,
                      left: 14,
                      background: '#2997ff',
                      // KINEO-SPRINT-OFFER-2026-07-14 — was '#04210f' (legacy
                      // dark-green token); white on brand blue.
                      color: '#ffffff',
                      fontSize: '0.6rem',
                      fontWeight: 900,
                      letterSpacing: '0.08em',
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}
                  >
                    MOST POPULAR
                  </span>
                )}
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 900, color: '#F1F5F9', fontSize: '0.98rem' }}>
                    {plan.name}{' '}
                    <span style={{ color: recommended ? '#5cb3ff' : '#86868b', fontWeight: 800 }}>
                      {plan.priceLabel}
                      <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{plan.periodLabel}</span>
                    </span>
                  </span>
                  <span style={{ display: 'block', fontSize: '0.78rem', color: '#86868b', marginTop: 2 }}>
                    {unlocks[plan.tier]}
                  </span>
                </span>
                <span
                  style={{
                    flexShrink: 0,
                    padding: '8px 14px',
                    borderRadius: 10,
                    fontSize: '0.8rem',
                    fontWeight: 900,
                    color: '#fff',
                    background: recommended
                      ? 'linear-gradient(135deg, #2997ff, #2997ff)'
                      : 'rgba(255,255,255,0.10)',
                  }}
                >
                  {loading ? '…' : 'Choose'}
                </span>
              </button>
            )
          })}
        </div>

        {/* KINEO-TOPUP-2026-07-06 — subscribers who ran out of AI credits mid-cycle
            get one-click top-ups (buy more AI videos) instead of a dead-end.
            KINEO-SPRINT-OFFER-2026-07-14 — non-subscribers take the intro month
            on the plan rows above (the old pack escape button is gone). */}
        {isSubscriber && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#86868b', textAlign: 'center' }}>
              Out of credits mid-month? Top up instantly — expires at renewal:
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                // KINEO-REBASE-2026-07-10 — top-ups halved with the rebase (USD
                // unchanged): ids stay topup40/topup120 (checkout SKU keys).
                { id: 'topup40', label: '+20 credits', sub: '1 AI video', price: '$5.90' },
                { id: 'topup120', label: '+60 credits', sub: '3 AI videos', price: '$12.90' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  disabled={loading}
                  onClick={() => { window.location.href = `/api/stripe/checkout?pack=${t.id}` }}
                  style={{
                    flex: 1,
                    padding: '11px 10px',
                    borderRadius: 12,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    background: 'rgba(41,151,255,0.08)',
                    border: '1px solid rgba(41,151,255,0.4)',
                    color: '#E2E8F0',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ display: 'block', fontSize: '0.86rem', fontWeight: 900, color: '#5cb3ff' }}>{t.price}</span>
                  <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700 }}>{t.label}</span>
                  <span style={{ display: 'block', fontSize: '0.68rem', color: '#86868b' }}>{t.sub}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* KINEO-INTRO-MONTH-2026-07-13 escape button removed
            (KINEO-SPRINT-OFFER-2026-07-14): it duplicated the Starter plan
            row above, which now carries the same intro-month offer inline
            ("first month $4.90, then $9.90/mo"). One modal, one list of
            plans, one offer — Creator recommended, Starter as the cheap
            secondary, Studio unhighlighted. */}

        <button
          type="button"
          onClick={onClose}
          style={{
            display: 'block',
            margin: '16px auto 0',
            background: 'transparent',
            border: 'none',
            color: '#86868b',
            fontSize: '0.85rem',
            fontWeight: 600,
            textDecoration: 'underline',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          Maybe later
        </button>
        {/* KINEO-SPRINT-OFFER-2026-07-14 — "Founding Creator · only 50 spots"
            footer removed: third competing discount claim in this modal, and
            the seat count was not enforced anywhere. */}
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
// KINEO-SPRINT-OFFER-2026-07-14 — onUpgradeBrl prop + BRL button removed (the
// checkout server already resolves BRL from the visitor's IP; the button also
// showed a stale "R$ 59,90" price). Copy synced to the single intro offer —
// the old body still sold "50 Fast Mode videos/month", two pricing
// generations stale.
function UrgencyModal({
  remaining,
  loading,
  onUpgrade,
  onClose,
}: {
  remaining: number
  loading: boolean
  onUpgrade: () => void
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
          background: '#161618',
          border: '1px solid rgba(41,151,255,0.45)',
          borderRadius: 20,
          padding: '32px 28px',
          textAlign: 'center',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 60px rgba(41,151,255,0.20)',
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
            color: '#86868b',
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
              color: '#5cb3ff',
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
          Go Creator for <strong style={{ color: '#5cb3ff' }}>$9.90 your first month</strong> — 150 credits, full AI scenes and the AI Presenter. Renews at $24.90/mo in 30 days.
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
              ? 'rgba(41,151,255,0.5)'
              : 'linear-gradient(135deg, #2997ff, #2997ff)',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 900,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 10px 30px rgba(41,151,255,0.4)',
            letterSpacing: '-0.01em',
          }}
        >
          {loading ? 'Opening checkout…' : 'Go Creator — $9.90 first month →'}
        </button>
        <p
          style={{
            marginTop: 14,
            fontSize: '0.74rem',
            color: '#86868b',
            fontWeight: 600,
          }}
        >
          Cancel anytime · 7-day money-back guarantee
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
        background: 'rgba(41,151,255,0.10)',
        border: '1px solid rgba(41,151,255,0.35)',
        color: '#5cb3ff',
      }}
    >
      <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.4 }}>
        🎉 Create up to 3 watermarked Fast videos every 24 hours — we dropped a viral idea below. Hit Generate, or type your own. No card needed.
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss welcome message"
        style={{
          background: 'transparent',
          border: '1px solid rgba(41,151,255,0.35)',
          borderRadius: 8,
          color: '#5cb3ff',
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

// ─── Push #098 — 4-step generation progress text ────────────────────────────
// Sits below the spinner. Active step is bold green; completed steps stay
// visible in muted green; upcoming steps are dimmed. The step index is
// time-driven (see useEffect in the parent) so the user always feels
// forward motion even when the API phase doesn't change for a while.
function GenerationProgressSteps({ step }: { step: number }) {
  const items = [
    { icon: '✍️', label: 'Writing your script...' },
    { icon: '🎙️', label: 'Synthesizing narration...' },
    { icon: '🎬', label: 'Composing your scenes...' },
    { icon: '⚡', label: 'Rendering your Short...' },
  ]
  return (
    <ol
      style={{
        marginTop: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        listStyle: 'none',
        padding: 0,
      }}
    >
      {items.map((it, i) => {
        const isActive = i === step
        const isDone = i < step
        const color = isActive ? '#5cb3ff' : isDone ? '#5cb3ff' : 'var(--muted)'
        return (
          <li
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              opacity: isActive || isDone ? 1 : 0.55,
            }}
          >
            <span
              aria-hidden="true"
              style={{ fontSize: '1.1rem', width: 22, textAlign: 'center' }}
            >
              {it.icon}
            </span>
            <span
              style={{
                fontSize: '0.88rem',
                fontWeight: isActive ? 800 : isDone ? 600 : 500,
                color,
              }}
            >
              {it.label}
            </span>
            {isDone && (
              <span
                aria-hidden="true"
                style={{ marginLeft: 'auto', color: '#5cb3ff', fontSize: '0.85rem' }}
              >
                ✓
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
