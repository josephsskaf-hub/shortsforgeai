'use client'

import { useState, useRef } from 'react'
import NicheCard from '@/components/NicheCard'
import ResultCard from '@/components/ResultCard'
import UpgradeModal from '@/components/UpgradeModal'
import AuthModal from '@/components/AuthModal'
import PreviewModal from '@/components/PreviewModal'
import FullscreenLoader from '@/components/FullscreenLoader'
import { ShortVideo } from '@/lib/openai'

interface DashboardClientProps {
  isPro: boolean
  generationsUsed: number
  totalGenerations: number
  isLoggedIn: boolean
}

const NICHES = [
  {
    id: 'mideast',
    emoji: '🔥',
    name: 'Middle East Secrets',
    description: 'Hidden stories, geopolitics & untold facts from the region',
    tags: ['High RPM', 'Viral', 'Geopolitics'],
    pills: ['🎬 YouTube Shorts', '🔥 High Engagement', '📋 Ready to Copy'],
  },
  {
    id: 'money',
    emoji: '💰',
    name: 'Money Facts',
    description: 'Finance niche, top CPM, huge audience & viral potential',
    tags: ['High RPM', 'Finance', 'Monetization'],
    pills: ['🎬 YouTube Shorts', '🔥 High Engagement', '📋 Ready to Copy'],
  },
  {
    id: 'mind',
    emoji: '🧠',
    name: 'Mind Blowing Facts',
    description: 'Education niche with massive shareability & saves',
    tags: ['Viral', 'Curiosity', 'Fast Views'],
    pills: ['🎬 YouTube Shorts', '🔥 High Engagement', '📋 Ready to Copy'],
  },
  {
    id: 'dark',
    emoji: '😱',
    name: 'Dark Mysteries',
    description: 'Horror & mystery niche that creates binge-watch loops',
    tags: ['Mystery', 'High Retention', 'Suspense'],
    pills: ['🎬 YouTube Shorts', '🔥 High Engagement', '📋 Ready to Copy'],
  },
  {
    id: 'motivation',
    emoji: '🏋',
    name: 'Motivation',
    description: 'Lifestyle niche — save & share magnet, evergreen content',
    tags: ['Evergreen', 'Daily Content', 'Reels/TikTok'],
    pills: ['🎬 YouTube Shorts', '🔥 High Engagement', '📋 Ready to Copy'],
  },
]

const SAMPLE_OUTPUTS = [
  {
    niche: 'Money',
    emoji: '💰',
    hook: '"This one fact changed how I see money forever..."',
    title: 'The Hidden Truth About Wealth Nobody Tells You',
    hashtags: ['#money', '#wealth', '#mindset'],
  },
  {
    niche: 'Motivation',
    emoji: '🏋',
    hook: '"He failed 27 times before becoming a billionaire..."',
    title: 'Why Failure Is the Only Path to Success',
    hashtags: ['#motivation', '#success', '#mindset'],
  },
  {
    niche: 'Dark Mysteries',
    emoji: '😱',
    hook: '"This secret was buried for 100 years..."',
    title: "The Mystery That Governments Don't Want You to Know",
    hashtags: ['#mystery', '#facts', '#viral'],
  },
]

export default function DashboardClient({
  isPro,
  generationsUsed: initialUsed,
  totalGenerations,
  isLoggedIn,
}: DashboardClientProps) {
  const [loadingNiche, setLoadingNiche] = useState<string | null>(null)
  const [results, setResults] = useState<ShortVideo[] | null>(null)
  const [activeNiche, setActiveNiche] = useState<string | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewNiche, setPreviewNiche] = useState<(typeof NICHES)[0] | null>(null)
  const [generationsUsed, setGenerationsUsed] = useState(initialUsed)
  const [error, setError] = useState<string | null>(null)
  const nichesSectionRef = useRef<HTMLDivElement>(null)

  const FREE_LIMIT = 1
  const canGenerate = isPro || generationsUsed < FREE_LIMIT
  const freeRemaining = Math.max(0, FREE_LIMIT - generationsUsed)
  // Free users only see 1 niche (Money Facts); Pro unlocks all
  const visibleNiches = isPro ? NICHES : NICHES.filter((n) => n.id === 'money')

  // Scroll to niches section
  function scrollToNiches() {
    nichesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // NicheCard click → open preview modal (or auth/upgrade gates first)
  function handleNicheClick(nicheId: string) {
    if (!isLoggedIn) {
      setShowAuthModal(true)
      return
    }
    if (!canGenerate) {
      setShowUpgradeModal(true)
      return
    }
    const niche = NICHES.find((n) => n.id === nicheId)
    if (niche) {
      setPreviewNiche(niche)
      setShowPreviewModal(true)
    }
  }

  // Confirmed from preview modal → actually generate
  async function handleGenerate(nicheId: string) {
    setShowPreviewModal(false)
    setLoadingNiche(nicheId)
    setError(null)
    setResults(null)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: nicheId }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 402) {
          setShowUpgradeModal(true)
          setLoadingNiche(null)
          return
        }
        throw new Error(data.error || 'Generation failed')
      }

      setResults(data.videos)
      setActiveNiche(nicheId)
      if (!isPro) {
        setGenerationsUsed((prev) => prev + 1)
        window.dispatchEvent(new CustomEvent('generationComplete'))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoadingNiche(null)
    }
  }

  function handleBack() {
    setResults(null)
    setActiveNiche(null)
  }

  const activeNicheData = NICHES.find((n) => n.id === activeNiche)

  return (
    <div className="px-6 py-7 pb-28 md:pb-20">
      {/* ─── Urgency banner (free users) ─── */}
      {!isPro && isLoggedIn && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 mb-5 flex-wrap"
          style={{
            background: 'linear-gradient(90deg, rgba(99,102,241,.1), rgba(124,58,237,.07))',
            border: '1px solid rgba(99,102,241,.22)',
          }}
        >
          <span className="text-xs font-semibold" style={{ color: 'var(--muted2)' }}>
            ⚡ You have{' '}
            <strong style={{ color: freeRemaining === 0 ? '#f87171' : '#818cf8' }}>
              {freeRemaining} free generation{freeRemaining !== 1 ? 's' : ''}
            </strong>{' '}
            left — Upgrade for unlimited
          </span>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
              boxShadow: '0 2px 12px rgba(99,102,241,.35)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Upgrade Now →
          </button>
        </div>
      )}

      {/* ─── HERO SECTION ─── */}
      {!results && !loadingNiche && (
        <div
          className="relative rounded-[24px] overflow-hidden mb-8 px-8 py-10 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,.1) 0%, rgba(124,58,237,.07) 50%, rgba(168,85,247,.06) 100%)',
            border: '1px solid rgba(99,102,241,.18)',
            boxShadow: '0 0 80px rgba(99,102,241,.08)',
          }}
        >
          {/* Background glow blobs */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: 500,
              height: 400,
              background: 'radial-gradient(ellipse, rgba(99,102,241,.18) 0%, transparent 70%)',
              top: -100,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          />

          {/* Live badge */}
          <div className="flex justify-center mb-4">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{
                background: 'rgba(16,185,129,.1)',
                border: '1px solid rgba(16,185,129,.22)',
                color: '#34d399',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
                style={{ background: '#10b981', boxShadow: '0 0 6px rgba(52,211,153,.6)' }}
              />
              Live · AI Ready
            </div>
          </div>

          {/* Headline */}
          <h1
            className="font-black tracking-tight mb-3 relative z-10"
            style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', color: 'var(--text)', lineHeight: 1.1 }}
          >
            Your Next Viral Short{' '}
            <span className="grad-text">Starts Here</span>
          </h1>

          {/* Subheadline */}
          <p
            className="relative z-10 mb-6 mx-auto"
            style={{ fontSize: '1rem', color: 'var(--muted2)', maxWidth: 480, lineHeight: 1.55 }}
          >
            Pick a niche and generate{' '}
            <strong style={{ color: 'var(--text)' }}>5 viral-ready shorts</strong> in seconds.
          </p>

          {/* Trust signals */}
          <div className="flex items-center justify-center gap-4 flex-wrap mb-7 relative z-10">
            {[
              { icon: '👥', text: '1,200+ creators' },
              { icon: '📱', text: 'YouTube · TikTok · Reels' },
              { icon: '⚡', text: 'Avg generation: <10 seconds' },
            ].map((t) => (
              <div
                key={t.text}
                className="flex items-center gap-1.5 text-xs font-medium"
                style={{ color: 'var(--muted2)' }}
              >
                <span>{t.icon}</span>
                <span>{t.text}</span>
              </div>
            ))}
          </div>

          {/* CTA button */}
          <button
            onClick={scrollToNiches}
            className="relative z-10 inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl text-base font-black text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)',
              boxShadow: '0 6px 32px rgba(99,102,241,.5)',
              animation: 'btn-pulse 2.8s ease-in-out infinite',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Generate Now ⚡
          </button>
        </div>
      )}

      {/* ─── SAMPLE OUTPUTS ─── */}
      {!results && !loadingNiche && (
        <div className="mb-8">
          <div className="text-center mb-4">
            <span
              className="text-xs font-black uppercase tracking-widest"
              style={{ color: 'var(--indigo-light)' }}
            >
              Example Output
            </span>
            <p className="text-sm font-semibold mt-1" style={{ color: 'var(--muted2)' }}>
              See what you&apos;ll get — instantly
            </p>
          </div>
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
          >
            {SAMPLE_OUTPUTS.map((sample, i) => (
              <div
                key={i}
                className="relative rounded-2xl p-5 overflow-hidden"
                style={{
                  background: 'rgba(13,13,28,0.8)',
                  border: '1px solid transparent',
                  backgroundClip: 'padding-box',
                  boxShadow: 'inset 0 0 0 1px rgba(99,102,241,.25), 0 4px 24px rgba(99,102,241,.08)',
                }}
              >
                {/* Shimmer overlay */}
                <div
                  className="absolute inset-0 pointer-events-none rounded-2xl shimmer-overlay"
                  style={{ zIndex: 0 }}
                />

                {/* EXAMPLE OUTPUT badge */}
                <div className="relative z-10 flex items-center justify-between mb-3">
                  <span
                    className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded-md"
                    style={{
                      background: 'rgba(99,102,241,.15)',
                      border: '1px solid rgba(99,102,241,.3)',
                      color: 'var(--indigo-light)',
                      fontSize: '0.58rem',
                    }}
                  >
                    Example Output
                  </span>
                  <span className="text-lg">{sample.emoji}</span>
                </div>

                <div className="relative z-10">
                  {/* Hook */}
                  <p
                    className="font-bold text-sm mb-2 leading-snug"
                    style={{
                      color: 'var(--text)',
                      fontStyle: 'italic',
                      borderLeft: '2px solid var(--indigo-light)',
                      paddingLeft: 10,
                    }}
                  >
                    {sample.hook}
                  </p>

                  {/* Title */}
                  <p
                    className="text-xs font-semibold mb-3 leading-snug"
                    style={{ color: 'var(--muted2)' }}
                  >
                    {sample.title}
                  </p>

                  {/* Hashtags */}
                  <div className="flex flex-wrap gap-1">
                    {sample.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md text-xs font-medium"
                        style={{
                          background: 'rgba(124,58,237,.1)',
                          border: '1px solid rgba(124,58,237,.2)',
                          color: 'var(--purple-light)',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── STATS ROW ─── */}
      {!results && !loadingNiche && (
        <div
          className="grid gap-2.5 mb-5"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
        >
          {[
            { icon: '🎬', val: totalGenerations, label: 'Scripts Generated', trend: '↑ All time' },
            { icon: '🎯', val: 5, label: 'Viral Topics', trend: null },
            { icon: '⚡', val: '~10s', label: 'Avg. Generate Time', trend: null },
            {
              icon: isPro ? '⭐' : '💚',
              val: isPro ? 'Unlimited' : `${freeRemaining} left`,
              label: isPro ? 'Pro Plan' : 'Free Generations',
              trend: isPro ? 'Pro' : 'Free',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
              }}
            >
              <div
                className="w-9 h-9 rounded-[10px] flex items-center justify-center text-lg flex-shrink-0"
                style={{
                  background: 'rgba(99,102,241,.1)',
                  border: '1px solid rgba(99,102,241,.18)',
                }}
              >
                {stat.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="font-black tracking-tight"
                  style={{ fontSize: '1.2rem', color: 'var(--text)', lineHeight: 1 }}
                >
                  {stat.val}
                </div>
                <div style={{ fontSize: '0.63rem', color: 'var(--muted)' }}>{stat.label}</div>
              </div>
              {stat.trend && (
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded ml-auto flex-shrink-0"
                  style={{
                    background: stat.trend === 'Free' || stat.trend === 'Pro'
                      ? 'rgba(99,102,241,.1)' : 'rgba(16,185,129,.1)',
                    border: stat.trend === 'Free' || stat.trend === 'Pro'
                      ? '1px solid rgba(99,102,241,.15)' : '1px solid rgba(16,185,129,.15)',
                    color: stat.trend === 'Free' || stat.trend === 'Pro'
                      ? 'var(--indigo-light)' : '#34d399',
                    fontSize: '0.62rem',
                  }}
                >
                  {stat.trend}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── ERROR ─── */}
      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm mb-5 flex items-center gap-3"
          style={{
            background: 'rgba(239,68,68,.08)',
            border: '1px solid rgba(239,68,68,.2)',
            color: '#f87171',
          }}
        >
          <span>⚠️</span>
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto font-bold"
            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ─── FULLSCREEN LOADER ─── */}
      {loadingNiche && <FullscreenLoader />}

      {/* ─── RESULTS ─── */}
      {results && !loadingNiche ? (
        <div className="animate-results-reveal">
          {/* Success banner */}
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3 mb-5 text-sm"
            style={{
              background: 'linear-gradient(90deg, rgba(16,185,129,.08), rgba(16,185,129,.04))',
              border: '1px solid rgba(16,185,129,.2)',
              color: 'var(--muted2)',
            }}
          >
            <span className="text-lg">✅</span>
            <span>
              <strong style={{ color: 'var(--text)' }}>Generated in seconds — ready to post.</strong>
            </span>
          </div>

          {/* Results topbar */}
          <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
            <div>
              <div
                className="text-xs font-bold uppercase tracking-widest mb-1"
                style={{ color: 'var(--indigo-light)' }}
              >
                ⚡ Viral Shorts Pack
              </div>
              <h2
                className="font-black tracking-tight mb-1"
                style={{ fontSize: '1.4rem', color: 'var(--text)', lineHeight: 1.15 }}
              >
                Your Viral Shorts Package is{' '}
                <span className="grad-text">Ready 🎉</span>
              </h2>
              <p style={{ fontSize: '0.76rem', color: '#94a3b8', marginBottom: 8 }}>
                Copy everything and paste into your favorite video tool.
              </p>
              {activeNicheData && (
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{
                    background: 'rgba(99,102,241,.09)',
                    border: '1px solid rgba(99,102,241,.18)',
                    color: 'var(--indigo-light)',
                  }}
                >
                  {activeNicheData.emoji} {activeNicheData.name}
                </div>
              )}
            </div>
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-xs font-semibold transition-all"
              style={{
                background: 'rgba(255,255,255,.04)',
                border: '1px solid var(--border)',
                color: 'var(--muted2)',
                cursor: 'pointer',
              }}
            >
              ← Back to Topics
            </button>
          </div>

          {/* Global action bar */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => {
                const allText = results
                  .map((v, i) =>
                    `SHORT #${i + 1}\nTitle: ${v.title}\nScript: ${v.script}\nHashtags: ${v.hashtags.join(' ')}\nVideo Prompt: ${v.videoPrompt}\n`
                  )
                  .join('\n---\n\n')
                navigator.clipboard.writeText(allText)
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
                boxShadow: '0 4px 18px rgba(99,102,241,.35)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              📋 Copy All Scripts
            </button>
            <button
              onClick={() => handleGenerate(activeNiche!)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: 'rgba(99,102,241,.1)',
                border: '1px solid rgba(99,102,241,.2)',
                color: 'var(--indigo-light)',
                cursor: 'pointer',
              }}
            >
              🔄 Regenerate
            </button>
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: 'rgba(255,255,255,.04)',
                border: '1px solid var(--border)',
                color: 'var(--muted2)',
                cursor: 'pointer',
              }}
            >
              ⚡ Generate Another Niche
            </button>
          </div>

          {/* Result cards */}
          <div className="flex flex-col gap-4">
            {results.map((video, i) => (
              <ResultCard key={i} video={video} index={i} />
            ))}
          </div>

          {/* Bottom generate again */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
                boxShadow: '0 4px 22px rgba(99,102,241,.3)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ⚡ Generate Another Niche
            </button>
          </div>
        </div>
      ) : !loadingNiche ? (
        <>
          {/* ─── NICHE CARDS ─── */}
          <div className="mb-4" ref={nichesSectionRef}>
            <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
              <div>
                <div
                  className="font-black uppercase tracking-widest mb-1"
                  style={{ fontSize: '0.62rem', color: 'var(--indigo-light)' }}
                >
                  Step 1 — Pick a niche
                </div>
                <div className="font-bold" style={{ fontSize: '1rem', color: 'var(--text)' }}>
                  Choose your viral topic
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 2 }}>
                  Click any card to generate 5 viral scripts, titles, hashtags and video prompts instantly.
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0"
                  style={{
                    background: 'rgba(99,102,241,.07)',
                    border: '1px solid rgba(99,102,241,.13)',
                    color: 'var(--indigo-light)',
                  }}
                >
                  ⚡ 5 ready-to-post viral videos in seconds
                </div>
                <span className="text-xs" style={{ color: 'var(--muted)', fontSize: '0.68rem' }}>
                  👥 1,200+ active creators
                </span>
              </div>
            </div>

            {/* Responsive grid: 1-col mobile, 2-col tablet, 3-col desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleNiches.map((niche) => (
                <NicheCard
                  key={niche.id}
                  {...niche}
                  onGenerate={handleNicheClick}
                  loading={false}
                  disabled={!canGenerate}
                />
              ))}
              {/* Locked niches for free users */}
              {!isPro && NICHES.filter((n) => n.id !== 'money').map((niche) => (
                <div
                  key={niche.id}
                  onClick={() => setShowUpgradeModal(true)}
                  className="relative rounded-2xl border border-white/10 bg-white/5 p-5 cursor-pointer opacity-60 hover:opacity-80 transition-all"
                >
                  <div className="absolute top-3 right-3 text-xs bg-purple-600/80 text-white px-2 py-0.5 rounded-full">🔒 Pro</div>
                  <div className="text-2xl mb-2">{niche.emoji}</div>
                  <div className="font-semibold text-white/80">{niche.name}</div>
                  <div className="text-xs text-white/40 mt-1">{niche.description}</div>
                </div>
              ))}
            </div>

            {!isPro && generationsUsed >= FREE_LIMIT && (
              <div
                className="mt-5 rounded-xl px-5 py-4 flex items-center justify-between flex-wrap gap-4"
                style={{
                  background: 'rgba(99,102,241,.06)',
                  border: '1px solid rgba(99,102,241,.18)',
                }}
              >
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                    🔒 You&apos;ve used all {FREE_LIMIT} free generations
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    Upgrade to Pro for unlimited viral scripts — just $5/month
                  </p>
                </div>
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
                    boxShadow: '0 4px 22px rgba(99,102,241,.3)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  ⭐ Upgrade to Pro
                </button>
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* ─── MOBILE STICKY CTA ─── */}
      {!results && !loadingNiche && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 p-4 md:hidden"
          style={{
            background: 'rgba(8,8,15,.95)',
            backdropFilter: 'blur(20px)',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            onClick={scrollToNiches}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-black text-white"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)',
              boxShadow: '0 4px 28px rgba(99,102,241,.5)',
              animation: 'btn-pulse 2.8s ease-in-out infinite',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ⚡ Generate Now
          </button>
        </div>
      )}

      {/* ─── MODALS ─── */}
      {showPreviewModal && previewNiche && (
        <PreviewModal
          niche={previewNiche}
          onConfirm={() => handleGenerate(previewNiche.id)}
          onClose={() => setShowPreviewModal(false)}
        />
      )}

      {showUpgradeModal && (
        <UpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          generationsUsed={generationsUsed}
        />
      )}

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          defaultTab="signup"
        />
      )}
    </div>
  )
}
