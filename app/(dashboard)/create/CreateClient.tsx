'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

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

interface ShortVideoResult {
  title: string
  script: string
  videoPrompt: string
  hashtags: string[]
  youtubeDescription: string
}

const NICHE_PILLS: { id: string; label: string; emoji: string }[] = [
  // Core
  { id: 'general',          label: 'General',          emoji: '🎬' },
  { id: 'history',          label: 'History',          emoji: '📖' },
  { id: 'mystery',          label: 'Mystery',          emoji: '🔮' },
  { id: 'finance',          label: 'Finance',          emoji: '💰' },
  { id: 'science',          label: 'Science',          emoji: '🧬' },
  { id: 'technology',       label: 'Technology',       emoji: '🤖' },
  // New viral niches
  { id: 'strange-facts',    label: 'Strange Facts',    emoji: '🤯' },
  { id: 'hidden-places',    label: 'Hidden Places',    emoji: '🗺️' },
  { id: 'ancient-mysteries',label: 'Ancient Mysteries',emoji: '🏛️' },
  { id: 'billionaire-secrets', label: 'Billionaire Secrets', emoji: '🤑' },
  { id: 'ai-tools',         label: 'AI Tools',         emoji: '🤖' },
  { id: 'money-hacks',      label: 'Money Hacks',      emoji: '💸' },
  { id: 'psychology-facts', label: 'Psychology',       emoji: '🧠' },
  { id: 'space-mysteries',  label: 'Space',            emoji: '🌌' },
  { id: 'crime-stories',    label: 'Crime Stories',    emoji: '🔍' },
  { id: 'war-secrets',      label: 'War Secrets',      emoji: '⚔️' },
  { id: 'survival-tips',    label: 'Survival',         emoji: '🏕️' },
  { id: 'conspiracy-files', label: 'Conspiracy',       emoji: '🕵️' },
  { id: 'tech-breakthroughs', label: 'Tech Breakthroughs', emoji: '💡' },
  { id: 'lost-civilizations', label: 'Lost Civilizations', emoji: '🗿' },
  { id: 'animal-facts',     label: 'Animals',          emoji: '🦁' },
  { id: 'health-facts',     label: 'Health',           emoji: '❤️' },
  { id: 'celebrity-secrets',label: 'Celebrity Secrets',emoji: '⭐' },
  { id: 'luxury-lifestyle', label: 'Luxury',           emoji: '💎' },
  { id: 'future-predictions', label: 'Future',         emoji: '🔭' },
  { id: 'dark-history',     label: 'Dark History',     emoji: '💀' },
]

const TONE_PILLS: { id: string; label: string; emoji: string }[] = [
  { id: 'dark',        label: 'Dark',        emoji: '🌑' },
  { id: 'cinematic',   label: 'Cinematic',   emoji: '🎞️' },
  { id: 'suspense',    label: 'Suspense',    emoji: '🕯️' },
  { id: 'educational', label: 'Educational', emoji: '📚' },
]

const DURATION_OPTIONS = [30, 45, 60]
const DEFAULT_DURATION = 30

const PLATFORM_OPTIONS: { id: string; label: string; emoji: string }[] = [
  { id: 'tiktok',   label: 'TikTok',          emoji: '🎵' },
  { id: 'youtube',  label: 'YouTube',          emoji: '▶️' },
  { id: 'shorts',   label: 'YouTube Shorts',   emoji: '📱' },
]

const MEDIA_OPTIONS: { id: string; label: string; desc: string; emoji: string; disabled?: boolean }[] = [
  { id: 'stock',  label: 'Basic',  desc: 'uses licensed stock media from top providers', emoji: '📹' },
  { id: 'ai',     label: 'Basic',  desc: 'uses our most efficient generative models',    emoji: '✨' },
  { id: 'pro',    label: 'Pro',    desc: 'uses veo 3.1 fast, sora 2 and similar models', emoji: '🚀', disabled: true },
]

const STAGE_MESSAGES: { id: string; label: string; weight: number }[] = [
  { id: 'script',   label: '✍️ Writing viral script...',        weight: 18 },
  { id: 'voice',    label: '🎙️ Generating AI narration...',     weight: 22 },
  { id: 'visuals',  label: '🎬 Finding cinematic visuals...',   weight: 22 },
  { id: 'captions', label: '📝 Building animated captions...',  weight: 8 },
  { id: 'music',    label: '🎵 Adding cinematic soundtrack...', weight: 8 },
  { id: 'render',   label: '⚡ Rendering your Short...',        weight: 22 },
]

interface FinalAssets {
  video: ShortVideoResult
  scenes: Scene[]
  selectedClips: Record<number, StockClip>
  voiceoverUrl: string | null
  niche: string
  topic: string
  renderUrl: string | null
  renderError: string | null
}

export default function CreateClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialNicheParam = searchParams.get('niche') || ''
  const autostartParam = searchParams.get('autostart') === 'true'

  const initialNiche = useMemo(() => {
    return NICHE_PILLS.find((n) => n.id === initialNicheParam)?.id ?? 'general'
  }, [initialNicheParam])

  const [topic, setTopic] = useState('')
  const [niche, setNiche] = useState(initialNiche)
  const [tone, setTone] = useState('cinematic')
  const [duration, setDuration] = useState(DEFAULT_DURATION)
  const [platform, setPlatform] = useState('shorts')
  const [media, setMedia] = useState('stock')
  const [userEmail, setUserEmail] = useState('')

  const [credits, setCredits] = useState<number | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(true)

  const [running, setRunning] = useState(false)
  const [stageId, setStageId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showNoCreditsModal, setShowNoCreditsModal] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [autopickedTopic, setAutopickedTopic] = useState<string | null>(null)

  const [final, setFinal] = useState<FinalAssets | null>(null)
  const [copyToast, setCopyToast] = useState(false)
  const [autoPicking, setAutoPicking] = useState(false)

  const autostartedRef = useRef(false)

  // Load credits
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/credits', { cache: 'no-store' })
        const data = await res.json()
        if (!cancelled) {
          setCredits(typeof data.credits === 'number' ? data.credits : 0)
        }
      } catch {
        if (!cancelled) setCredits(0)
      } finally {
        if (!cancelled) setCreditsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Load user email for creator row
  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient().auth.getUser().then(({ data: { user } }) => {
        if (user?.email) setUserEmail(user.email)
      })
    })
  }, [])

  // Sync niche from URL changes (sidebar quick-create links)
  useEffect(() => {
    const next = NICHE_PILLS.find((n) => n.id === initialNicheParam)?.id
    setNiche(next ?? 'general')
  }, [initialNicheParam])

  // Cleanup voiceover blob on unmount
  useEffect(() => {
    return () => {
      if (final?.voiceoverUrl) URL.revokeObjectURL(final.voiceoverUrl)
    }
  }, [final?.voiceoverUrl])

  function setStage(id: string, baseProgress: number) {
    setStageId(id)
    setProgress(baseProgress)
  }

  async function refreshCreditsFromServer() {
    try {
      const res = await fetch('/api/credits', { cache: 'no-store' })
      const data = await res.json()
      if (typeof data.credits === 'number') setCredits(data.credits)
      window.dispatchEvent(new CustomEvent('creditsChanged'))
    } catch {
      // ignore
    }
  }

  async function handleGenerate(overrideTopic?: string, overrideNiche?: string) {
    if (running) return

    const effectiveTopic = (overrideTopic ?? topic).trim()
    const effectiveNiche = overrideNiche ?? niche
    if (!effectiveTopic) {
      setError('Please add a topic for your video.')
      return
    }

    if (credits !== null && credits <= 0) {
      setShowNoCreditsModal(true)
      return
    }

    setError(null)
    setFinal(null)
    setRunning(true)
    setProgress(0)
    setStage('script', 4)

    try {
      // Step 1 — Generate script
      setStage('script', 8)
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: effectiveNiche, topic: effectiveTopic, tone, duration }),
      })
      if (!genRes.ok) {
        const err = await genRes.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to generate the script.')
      }
      const genData = await genRes.json()
      const video: ShortVideoResult | undefined = Array.isArray(genData.videos) ? genData.videos[0] : undefined
      if (!video) throw new Error('Invalid response from the script generator.')
      setStage('voice', 22)

      // Step 2 — Voiceover
      const voiceRes = await fetch('/api/voiceover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: video.script }),
      })
      let voiceoverUrl: string | null = null
      if (voiceRes.ok) {
        const blob = await voiceRes.blob()
        voiceoverUrl = URL.createObjectURL(blob)
      } else {
        console.warn('[create] voiceover failed', await voiceRes.text().catch(() => ''))
      }
      setStage('visuals', 42)

      // Step 3 — Scenes
      const scenesRes = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: video.script, niche: effectiveNiche }),
      })
      let scenes: Scene[] = []
      if (scenesRes.ok) {
        const data = await scenesRes.json()
        scenes = Array.isArray(data.scenes) ? data.scenes : []
      } else {
        console.warn('[create] scenes failed')
      }
      setStage('visuals', 56)

      // Step 4 — Stock clips per scene
      const selectedClips: Record<number, StockClip> = {}
      if (scenes.length > 0) {
        const results = await Promise.all(
          scenes.map(async (s) => {
            try {
              const r = await fetch(
                `/api/stock?q=${encodeURIComponent(s.searchQuery || s.visualDescription)}`,
                { cache: 'no-store' }
              )
              if (!r.ok) return { sceneNumber: s.sceneNumber, videos: [] as StockClip[] }
              const data = await r.json()
              return {
                sceneNumber: s.sceneNumber,
                videos: (data.videos ?? []) as StockClip[],
              }
            } catch {
              return { sceneNumber: s.sceneNumber, videos: [] as StockClip[] }
            }
          })
        )
        for (const r of results) {
          if (r.videos[0]) selectedClips[r.sceneNumber] = r.videos[0]
        }
      }
      setStage('captions', 70)
      await wait(500)

      setStage('music', 80)
      await wait(500)

      // Step 5 — Render
      setStage('render', 86)
      let renderUrl: string | null = null
      let renderError: string | null = null
      try {
        const stockClipsPayload = Object.entries(selectedClips).map(([sceneNum, clip]) => ({
          sceneNumber: parseInt(sceneNum, 10),
          videoUrl: clip.url,
        }))

        const renderRes = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            script: video.script,
            scenes,
            stockClips: stockClipsPayload,
            title: video.title,
            niche: effectiveNiche,
            tone,
          }),
        })
        if (!renderRes.ok) {
          const errData = await renderRes.json().catch(() => ({}))
          renderError = errData.error || `Render service error (${renderRes.status}).`
          console.warn('[create] render route error:', renderError)
        } else {
          const data = await renderRes.json()
          const renderId: string | undefined = data.renderId
          if (renderId && !data.isMock) {
            // Poll until done (up to 3 minutes)
            for (let i = 0; i < 60; i++) {
              await wait(3000)
              try {
                const pollRes = await fetch(`/api/render/${renderId}`, { cache: 'no-store' })
                if (!pollRes.ok) {
                  renderError = `Render poll error (${pollRes.status}).`
                  break
                }
                const pollData = await pollRes.json()
                if (pollData.status === 'succeeded' && pollData.url) {
                  renderUrl = pollData.url as string
                  renderError = null
                  break
                }
                if (pollData.status === 'failed') {
                  renderError = pollData.error || 'Render failed — Creatomate rejected the job.'
                  console.error('[create] render failed:', renderError)
                  break
                }
              } catch (pollErr) {
                renderError = pollErr instanceof Error ? pollErr.message : 'Render poll network error.'
                break
              }
              setProgress((p) => Math.min(96, p + 1))
            }
            // If we exited the loop with no url and no error set, it timed out
            if (!renderUrl && !renderError) {
              renderError = 'Render timed out — the MP4 may still be processing.'
            }
          } else if (data.url) {
            renderUrl = data.url
          } else if (data.isMock) {
            // Mock render — no real URL
            renderError = null
          }
        }
      } catch (renderCatchErr) {
        renderError = renderCatchErr instanceof Error ? renderCatchErr.message : 'Render request failed.'
        console.error('[create] render catch:', renderError)
      }

      setProgress(100)
      await wait(300)

      // Deduct credit on success
      try {
        const dedRes = await fetch('/api/credits/deduct', { method: 'POST' })
        if (dedRes.ok) {
          const data = await dedRes.json()
          if (typeof data.credits === 'number') setCredits(data.credits)
          window.dispatchEvent(new CustomEvent('creditsChanged'))
        } else {
          await refreshCreditsFromServer()
        }
      } catch {
        await refreshCreditsFromServer()
      }

      setFinal({
        video,
        scenes,
        selectedClips,
        voiceoverUrl,
        niche: effectiveNiche,
        topic: effectiveTopic,
        renderUrl,
        renderError,
      })
      setRunning(false)
      setStageId(null)
    } catch (err) {
      setRunning(false)
      setStageId(null)
      setProgress(0)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text)
    setCopyToast(true)
    setTimeout(() => setCopyToast(false), 1800)
  }

  function handleRegenerate() {
    setFinal(null)
    setError(null)
    setProgress(0)
  }

  function cleanAutostartUrl(currentNiche: string) {
    const params = new URLSearchParams()
    if (currentNiche && currentNiche !== 'general') params.set('niche', currentNiche)
    const qs = params.toString()
    router.replace(`/create${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  async function fetchSuggestedTopic(forNiche: string): Promise<string> {
    const res = await fetch('/api/topic-suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ niche: forNiche }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Could not pick a topic.')
    }
    const data = await res.json()
    const t = (data?.topic || '').trim()
    if (!t) throw new Error('AI returned an empty topic.')
    return t
  }

  async function handleSurpriseMe() {
    if (suggestLoading || running) return
    setSuggestLoading(true)
    setError(null)
    try {
      const t = await fetchSuggestedTopic(niche)
      setTopic(t)
      setAutopickedTopic(t)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not pick a topic. Try again.')
    } finally {
      setSuggestLoading(false)
    }
  }

  async function handleGenerateClick() {
    if (running) return
    const trimmed = topic.trim()
    if (trimmed) {
      await handleGenerate(trimmed)
      return
    }
    if (credits !== null && credits <= 0) {
      setShowNoCreditsModal(true)
      return
    }
    try {
      setAutoPicking(true)
      setProgress(2)
      const t = await fetchSuggestedTopic(niche)
      setTopic(t)
      setAutopickedTopic(t)
      setAutoPicking(false)
      await handleGenerate(t)
    } catch (err) {
      setAutoPicking(false)
      setError(err instanceof Error ? err.message : 'Could not pick a topic. Try again.')
    }
  }

  // Autostart: when ?autostart=true, AI picks a topic and runs the pipeline immediately.
  useEffect(() => {
    if (!autostartParam) {
      autostartedRef.current = false
      return
    }
    if (autostartedRef.current) return
    if (creditsLoading) return
    if (running || autoPicking) return
    autostartedRef.current = true

    const targetNiche = NICHE_PILLS.find((n) => n.id === initialNicheParam)?.id ?? 'general'

    setFinal(null)
    setError(null)
    setNiche(targetNiche)

    ;(async () => {
      if (credits !== null && credits <= 0) {
        setShowNoCreditsModal(true)
        cleanAutostartUrl(targetNiche)
        return
      }
      try {
        setAutoPicking(true)
        setProgress(2)
        const t = await fetchSuggestedTopic(targetNiche)
        setTopic(t)
        setAutopickedTopic(t)
        setAutoPicking(false)
        cleanAutostartUrl(targetNiche)
        await handleGenerate(t, targetNiche)
      } catch (err) {
        setAutoPicking(false)
        setError(err instanceof Error ? err.message : 'Could not pick a topic. Try again.')
        cleanAutostartUrl(targetNiche)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autostartParam, creditsLoading, credits, initialNicheParam])

  const creditsZero = credits !== null && credits <= 0
  const currentStage = stageId ? STAGE_MESSAGES.find((s) => s.id === stageId) : null

  return (
    <div className="px-4 md:px-6 py-5 md:py-7 pb-24 md:pb-20 max-w-4xl mx-auto">
      {/* Toast */}
      {copyToast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 px-5 py-3 rounded-xl text-sm font-bold text-white"
          style={{
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg,#10b981,#059669)',
            boxShadow: '0 4px 24px rgba(16,185,129,.4)',
          }}
        >
          ✅ Copied!
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#7c3aed)', boxShadow: '0 0 24px rgba(99,102,241,.5)', flexShrink: 0, fontSize: '1.35rem', lineHeight: 1 }}>
            ⚡
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--indigo-light)', fontSize: '0.62rem' }}>
              Autopilot · v4.0
            </div>
            <h1 className="font-black tracking-tight" style={{ fontSize: 'clamp(1.2rem, 3vw, 1.7rem)', color: 'var(--text)', lineHeight: 1.1 }}>
              Generate a Short in <span className="grad-text">one click</span>
            </h1>
          </div>
        </div>
        <p className="text-sm" style={{ color: 'var(--muted2)' }}>
          AI writes the script, generates narration, finds visuals and renders everything automatically.
        </p>
      </div>

      {/* Form (hidden during run + final + auto-pick) */}
      {!running && !autoPicking && !final && (
        <div
          className="rounded-[20px] p-6 md:p-7 mb-5"
          style={{
            background: 'rgba(15,15,30,0.85)',
            border: '1px solid rgba(99,102,241,.22)',
            boxShadow: '0 0 30px rgba(99,102,241,.08)',
          }}
        >
          {/* Quick Surprise Me CTA */}
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--indigo-light)', fontSize: '0.62rem' }}>
                Hands-off mode
              </div>
              <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                Let AI pick a viral topic for you
              </div>
            </div>
            <button
              type="button"
              onClick={handleSurpriseMe}
              disabled={suggestLoading}
              className="rounded-xl px-4 py-2.5 text-xs font-black transition-all flex items-center gap-1.5"
              style={{
                background: suggestLoading
                  ? 'rgba(255,255,255,.04)'
                  : 'linear-gradient(135deg, rgba(168,85,247,.25), rgba(99,102,241,.18))',
                border: '1px solid rgba(168,85,247,.45)',
                color: suggestLoading ? 'var(--muted)' : '#c4b5fd',
                cursor: suggestLoading ? 'wait' : 'pointer',
                boxShadow: suggestLoading ? 'none' : '0 0 16px rgba(168,85,247,.18)',
              }}
            >
              {suggestLoading ? '⏳ Picking...' : '✨ Surprise me'}
            </button>
          </div>

          {/* Topic input */}
          <label className="block mb-4">
            <div className="text-xs font-black uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: 'var(--muted2)', fontSize: '0.62rem' }}>
              {autopickedTopic ? (
                <>
                  <span style={{ color: 'var(--indigo-light)' }}>Or type your own topic</span>
                  <span
                    className="px-2 py-0.5 rounded-full"
                    style={{
                      background: 'rgba(168,85,247,.15)',
                      color: '#c4b5fd',
                      fontSize: '0.55rem',
                      letterSpacing: '0.06em',
                    }}
                  >
                    AI-picked
                  </span>
                </>
              ) : (
                "What's your video about? (optional)"
              )}
            </div>
            <input
              type="text"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value)
                if (autopickedTopic && e.target.value !== autopickedTopic) {
                  setAutopickedTopic(null)
                }
              }}
              placeholder="e.g. 3 secrets about the Bermuda Triangle"
              className="w-full rounded-xl px-4 py-3.5 text-base outline-none transition-all"
              style={{
                background: 'rgba(0,0,0,.32)',
                border: '1px solid var(--border2)',
                color: 'var(--text)',
                fontWeight: 500,
              }}
              onFocus={(e) => {
                ;(e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(99,102,241,.5)'
              }}
              onBlur={(e) => {
                ;(e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border2)'
              }}
            />
            <div className="text-xs mt-1.5" style={{ color: 'var(--muted)', fontSize: '0.65rem' }}>
              Leave blank and click Generate — AI will pick a topic for you.
            </div>
          </label>

          {/* Niche pills — horizontal scroll on mobile */}
          <div className="mb-4">
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted2)', fontSize: '0.62rem' }}>
              Niche
            </div>
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
            >
              {NICHE_PILLS.map((n) => (
                <Pill
                  key={n.id}
                  active={niche === n.id}
                  emoji={n.emoji}
                  label={n.label}
                  onClick={() => setNiche(n.id)}
                  noShrink
                />
              ))}
            </div>
          </div>

          {/* Tone pills */}
          <div className="mb-4">
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted2)', fontSize: '0.62rem' }}>
              Tone
            </div>
            <div className="flex flex-wrap gap-2">
              {TONE_PILLS.map((t) => (
                <Pill
                  key={t.id}
                  active={tone === t.id}
                  emoji={t.emoji}
                  label={t.label}
                  onClick={() => setTone(t.id)}
                />
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="mb-4">
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted2)', fontSize: '0.62rem' }}>
              Duration
            </div>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.map((d) => (
                <Pill
                  key={d}
                  active={duration === d}
                  label={`${d}s`}
                  onClick={() => setDuration(d)}
                />
              ))}
            </div>
          </div>

          {/* Platform */}
          <div className="mb-4">
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted2)', fontSize: '0.62rem' }}>
              Platform
            </div>
            <div className="flex flex-wrap gap-2">
              {PLATFORM_OPTIONS.map((p) => (
                <Pill
                  key={p.id}
                  active={platform === p.id}
                  emoji={p.emoji}
                  label={p.label}
                  onClick={() => setPlatform(p.id)}
                />
              ))}
            </div>
          </div>

          {/* Media Quality */}
          <div className="mb-6">
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'var(--muted2)', fontSize: '0.62rem' }}>
              Media
            </div>
            <div className="flex gap-3 flex-wrap">
              {MEDIA_OPTIONS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={m.disabled}
                  onClick={() => !m.disabled && setMedia(m.id)}
                  style={{
                    flex: '1 1 140px',
                    minWidth: 130,
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: media === m.id && !m.disabled
                      ? 'linear-gradient(135deg, rgba(99,102,241,.28), rgba(124,58,237,.18))'
                      : m.disabled
                      ? 'rgba(255,255,255,.02)'
                      : 'rgba(255,255,255,.04)',
                    border: media === m.id && !m.disabled
                      ? '1px solid rgba(99,102,241,.55)'
                      : '1px solid var(--border2)',
                    cursor: m.disabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    opacity: m.disabled ? 0.45 : 1,
                    boxShadow: media === m.id && !m.disabled ? '0 0 20px rgba(99,102,241,.15)' : 'none',
                    transition: 'all .15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: '0.9rem' }}>{m.emoji}</span>
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      color: media === m.id && !m.disabled ? 'var(--text)' : 'var(--muted2)',
                    }}>
                      {m.label}
                    </span>
                    {m.disabled && (
                      <span style={{ fontSize: '0.5rem', fontWeight: 800, color: '#a855f7', background: 'rgba(168,85,247,.15)', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.05em' }}>
                        SOON
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.62rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                    {m.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm mb-4 flex items-center gap-2"
              style={{
                background: 'rgba(239,68,68,.08)',
                border: '1px solid rgba(239,68,68,.22)',
                color: '#f87171',
              }}
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerateClick}
            disabled={creditsLoading || suggestLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-4 text-base font-black text-white transition-all"
            style={{
              background: creditsZero
                ? 'linear-gradient(135deg, #94a3b8, #64748b)'
                : 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)',
              boxShadow: creditsZero ? 'none' : '0 4px 28px rgba(99,102,241,.45)',
              cursor: creditsLoading || suggestLoading ? 'not-allowed' : 'pointer',
              border: 'none',
              opacity: creditsLoading || suggestLoading ? 0.7 : 1,
            }}
          >
            ⚡ Generate — 1 credit
          </button>

          {/* Credits hint */}
          <div className="mt-3 text-center text-xs" style={{ color: creditsZero ? '#f87171' : 'var(--muted)' }}>
            {creditsLoading
              ? 'Loading balance…'
              : creditsZero
              ? 'No credits left. Get more in Pricing.'
              : `You have ${credits ?? 0} credit${credits === 1 ? '' : 's'} available.`}
          </div>
        </div>
      )}

      {/* Mobile sticky Generate CTA — shows when form is visible and not running */}
      {!running && !autoPicking && !final && (
        <div
          className="fixed bottom-14 left-0 right-0 px-4 pb-2 md:hidden z-40"
          style={{
            background: 'linear-gradient(to top, rgba(8,8,15,0.98) 60%, transparent)',
            pointerEvents: 'none',
          }}
        >
          <button
            onClick={handleGenerateClick}
            disabled={creditsLoading || suggestLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-4 text-base font-black text-white"
            style={{
              background: creditsZero
                ? 'linear-gradient(135deg, #94a3b8, #64748b)'
                : 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)',
              boxShadow: creditsZero ? 'none' : '0 4px 28px rgba(99,102,241,.55)',
              cursor: creditsLoading || suggestLoading ? 'not-allowed' : 'pointer',
              border: 'none',
              opacity: creditsLoading || suggestLoading ? 0.7 : 1,
              pointerEvents: 'auto',
            }}
          >
            ⚡ Generate — 1 credit
          </button>
        </div>
      )}

      {/* Progress view */}
      {(running || autoPicking) && (
        <ProgressView
          progress={progress}
          stageLabel={
            autoPicking && !running
              ? '🎯 Picking a viral topic...'
              : currentStage?.label ?? '⚡ Starting...'
          }
          pickedTopic={running && autopickedTopic ? autopickedTopic : null}
        />
      )}

      {/* Final / export view */}
      {final && (
        <FinalView
          final={final}
          onCopy={handleCopy}
          onRegenerate={handleRegenerate}
          userEmail={userEmail}
        />
      )}

      {/* No-credits modal */}
      {showNoCreditsModal && (
        <NoCreditsModal onClose={() => setShowNoCreditsModal(false)} />
      )}
    </div>
  )
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function Pill({
  active,
  emoji,
  label,
  onClick,
  noShrink,
}: {
  active: boolean
  emoji?: string
  label: string
  onClick: () => void
  noShrink?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3.5 py-2 rounded-full text-xs font-bold transition-all"
      style={{
        background: active
          ? 'linear-gradient(135deg, rgba(99,102,241,.25), rgba(124,58,237,.18))'
          : 'rgba(255,255,255,.04)',
        border: active ? '1px solid rgba(99,102,241,.5)' : '1px solid var(--border2)',
        color: active ? 'var(--text)' : 'var(--muted2)',
        cursor: 'pointer',
        boxShadow: active ? '0 0 16px rgba(99,102,241,.2)' : 'none',
        flexShrink: noShrink ? 0 : undefined,
        whiteSpace: 'nowrap',
      }}
    >
      {emoji ? `${emoji} ` : ''}
      {label}
    </button>
  )
}

function ProgressView({
  progress,
  stageLabel,
  pickedTopic,
}: {
  progress: number
  stageLabel: string
  pickedTopic?: string | null
}) {
  return (
    <div
      className="rounded-[20px] p-7 md:p-9 mb-5 text-center"
      style={{
        background: 'rgba(15,15,30,0.85)',
        border: '1px solid rgba(99,102,241,.32)',
        boxShadow: '0 0 50px rgba(99,102,241,.18)',
      }}
    >
      <style jsx>{`
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 32px rgba(168,85,247,.4); transform: scale(1); }
          50% { box-shadow: 0 0 56px rgba(168,85,247,.65); transform: scale(1.04); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      <div
        className="w-20 h-20 rounded-3xl mx-auto flex items-center justify-center mb-5"
        style={{
          background: 'linear-gradient(135deg, rgba(168,85,247,.35), rgba(99,102,241,.2))',
          border: '1px solid rgba(168,85,247,.5)',
          fontSize: '2rem',
          animation: 'pulseGlow 1.6s ease-in-out infinite',
        }}
      >
        ⚡
      </div>

      <div className="font-black text-base mb-2" style={{ color: 'var(--text)' }}>
        {stageLabel}
      </div>
      <div className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
        Hang tight — we&apos;re building your Short from start to finish.
      </div>

      {pickedTopic && (
        <div
          className="rounded-xl px-4 py-2.5 mb-4 mx-auto inline-block max-w-full"
          style={{
            background: 'rgba(168,85,247,.08)',
            border: '1px solid rgba(168,85,247,.25)',
            color: '#c4b5fd',
            fontSize: '0.78rem',
            fontWeight: 600,
          }}
        >
          🎯 Topic: <span style={{ color: 'var(--text)' }}>{pickedTopic}</span>
        </div>
      )}

      {/* Progress bar */}
      <div className="rounded-full overflow-hidden mb-3" style={{ height: 10, background: 'rgba(255,255,255,.05)' }}>
        <div
          className="h-full transition-all"
          style={{
            width: `${Math.min(100, Math.max(2, progress))}%`,
            background: 'linear-gradient(90deg, #6366f1, #a855f7, #ec4899, #a855f7, #6366f1)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 2.4s linear infinite',
            transitionDuration: '600ms',
          }}
        />
      </div>
      <div className="text-xs font-bold" style={{ color: 'var(--indigo-light)' }}>
        {Math.min(100, Math.max(0, Math.round(progress)))}%
      </div>
    </div>
  )
}

function FinalView({
  final,
  onCopy,
  onRegenerate,
  userEmail,
}: {
  final: FinalAssets
  onCopy: (text: string) => void
  onRegenerate: () => void
  userEmail: string
}) {
  const { video, scenes, selectedClips, renderUrl, renderError } = final
  const previewClip = scenes[0] ? selectedClips[scenes[0].sceneNumber] : null
  const userInitial = userEmail ? userEmail[0].toUpperCase() : 'S'

  return (
    <div className="flex flex-col gap-4">

      {/* Render error notice (non-fatal) */}
      {!renderUrl && renderError && (
        <div
          className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
          style={{
            background: 'rgba(245,158,11,.07)',
            border: '1px solid rgba(245,158,11,.25)',
            color: '#fbbf24',
          }}
        >
          <span className="text-lg mt-0.5">⚠️</span>
          <div>
            <div className="font-bold mb-0.5" style={{ color: '#fde68a' }}>MP4 render pending</div>
            <div className="text-xs" style={{ color: '#fbbf24', opacity: 0.85 }}>{renderError}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              Script and visuals are ready below. Use the AI Video button to generate the final MP4.
            </div>
          </div>
        </div>
      )}

      {/* ─── Video Player Card ─── */}
      <div
        className="rounded-[24px] overflow-hidden"
        style={{
          background: 'rgba(10,10,22,0.95)',
          border: '1px solid rgba(99,102,241,.25)',
          boxShadow: '0 0 60px rgba(99,102,241,.12)',
        }}
      >
        {/* Top bar: version + format */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 }}>
              ⚡
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--indigo-light)', letterSpacing: '0.04em' }}>
              AUTOPILOT v4.0
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, padding: '3px 10px' }}>
            📱 YouTube Shorts · 9:16
          </div>
        </div>

        {/* Video preview — centered, 9:16 */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 20px 0' }}>
          <div
            style={{
              width: 'min(300px, 100%)',
              aspectRatio: '9 / 16',
              borderRadius: 16,
              overflow: 'hidden',
              background: 'rgba(0,0,0,.7)',
              border: '1px solid rgba(255,255,255,.08)',
              boxShadow: '0 12px 48px rgba(0,0,0,.6)',
              position: 'relative',
            }}
          >
            {renderUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={renderUrl}
                controls
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
              />
            ) : previewClip ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={previewClip.url}
                muted
                loop
                autoPlay
                controls
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--muted)' }}>
                <span style={{ fontSize: '3rem' }}>🎬</span>
                <span style={{ fontSize: '0.78rem' }}>Preview unavailable</span>
              </div>
            )}
          </div>
        </div>

        {/* Title below video */}
        <div style={{ padding: '18px 20px 4px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', fontWeight: 900, color: 'var(--text)', lineHeight: 1.25, letterSpacing: '-0.02em', margin: 0 }}>
            {video.title}
          </h2>
        </div>

        {/* Creator row + reactions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.88rem', fontWeight: 900, color: '#fff', flexShrink: 0, boxShadow: '0 0 12px rgba(99,102,241,.4)' }}>
              {userInitial}
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text)' }}>ShortsForgeAI</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--muted)', marginTop: 1 }}>AI-generated · {final.niche}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['👍', '👎'] as const).map((icon) => (
              <button
                key={icon}
                style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,.15)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,.3)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.08)' }}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Bottom Action Bar ─── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'rgba(12,12,24,0.9)',
          border: '1px solid rgba(99,102,241,.2)',
          borderRadius: 16,
          padding: '12px 14px',
          flexWrap: 'wrap',
        }}
      >
        {/* Left action icons */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={onRegenerate}
            title="Generate another"
            style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >🔄</button>
          <button
            onClick={() => onCopy(video.script)}
            title="Copy script"
            style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >📋</button>
          <Link
            href={`/generate?prompt=${encodeURIComponent(video.videoPrompt || video.title)}`}
            title="Generate AI video"
            style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(168,85,247,.12)', border: '1px solid rgba(168,85,247,.28)', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
          >🎬</Link>
        </div>

        {/* Version badge */}
        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--muted)', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, padding: '5px 10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Version 1
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Download MP4 button */}
        {renderUrl ? (
          <a
            href={renderUrl}
            download={`short-${final.niche}.mp4`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 24px', borderRadius: 12,
              background: 'linear-gradient(135deg,#6366f1,#7c3aed,#a855f7)',
              boxShadow: '0 4px 24px rgba(99,102,241,.45)',
              color: '#fff', fontWeight: 900, fontSize: '0.95rem',
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            ⬇️ Download MP4
          </a>
        ) : (
          <Link
            href={`/generate?prompt=${encodeURIComponent(video.videoPrompt || video.title)}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 24px', borderRadius: 12,
              background: 'linear-gradient(135deg,#6366f1,#7c3aed,#a855f7)',
              boxShadow: '0 4px 24px rgba(99,102,241,.45)',
              color: '#fff', fontWeight: 900, fontSize: '0.95rem',
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            🎬 Generate AI Video
          </Link>
        )}
      </div>

      {/* Script fields */}
      <FieldBlock label="Title" value={video.title} onCopy={onCopy} />
      <FieldBlock label="Hashtags" value={video.hashtags.join(' ')} onCopy={onCopy} />
      <FieldBlock label="YouTube Description" value={video.youtubeDescription} onCopy={onCopy} multiline />
      <FieldBlock label="Full Script" value={video.script} onCopy={onCopy} multiline />

      {/* Footer actions */}
      <div className="flex flex-wrap gap-3 justify-center mt-2 pb-4">
        <Link
          href="/dashboard"
          className="rounded-xl px-6 py-3 text-sm font-bold"
          style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid var(--border)',
            color: 'var(--muted2)',
            textDecoration: 'none',
          }}
        >
          ← Dashboard
        </Link>
      </div>
    </div>
  )
}

function FieldBlock({
  label,
  value,
  onCopy,
  multiline,
}: {
  label: string
  value: string
  onCopy: (text: string) => void
  multiline?: boolean
}) {
  return (
    <div
      className="rounded-[20px] p-5"
      style={{
        background: 'rgba(15,15,30,0.85)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--muted)', fontSize: '0.6rem' }}>
          {label}
        </div>
        <button
          onClick={() => onCopy(value)}
          className="text-xs font-bold px-2.5 py-1 rounded-md"
          style={{
            background: 'rgba(99,102,241,.07)',
            border: '1px solid rgba(99,102,241,.18)',
            color: 'var(--indigo-light)',
            cursor: 'pointer',
            fontSize: '0.62rem',
          }}
        >
          📋 Copy
        </button>
      </div>
      <div
        className="text-sm leading-relaxed"
        style={{
          color: 'var(--text2)',
          whiteSpace: multiline ? 'pre-wrap' : 'normal',
          maxHeight: multiline ? 360 : undefined,
          overflowY: multiline ? 'auto' : undefined,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function NoCreditsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(8,8,15,.92)', backdropFilter: 'blur(24px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl relative overflow-hidden"
        style={{
          background: 'var(--card2)',
          border: '1px solid rgba(99,102,241,.32)',
          boxShadow: '0 0 80px rgba(99,102,241,.25), 0 30px 80px rgba(0,0,0,.5)',
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-0.5 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, #6366f1, #a855f7, transparent)' }} />
        <div className="p-7 relative z-10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all"
            style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid var(--border)',
              color: 'var(--muted2)',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
          <div className="text-4xl mb-4 text-center">⚡</div>
          <h2 className="text-xl font-black tracking-tight mb-3 text-center" style={{ color: 'var(--text)' }}>
            No credits left
          </h2>
          <p className="text-sm text-center mb-6" style={{ color: 'var(--muted2)', lineHeight: 1.6 }}>
            You&apos;ve used all your credits. Get more in Pricing to keep building viral videos.
          </p>
          <Link
            href="/pricing"
            className="block w-full text-center rounded-xl py-3.5 text-sm font-black text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)',
              boxShadow: '0 4px 28px rgba(99,102,241,.45)',
              textDecoration: 'none',
            }}
          >
            💳 Buy Credits
          </Link>
          <button
            onClick={onClose}
            className="block w-full text-center mt-2 py-2 text-xs font-bold transition-all"
            style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  )
}
