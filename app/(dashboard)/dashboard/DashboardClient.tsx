'use client'

import { useState } from 'react'
import NicheCard from '@/components/NicheCard'
import ResultCard from '@/components/ResultCard'
import UpgradeModal from '@/components/UpgradeModal'
import { ShortVideo } from '@/lib/openai'

interface DashboardClientProps {
  isPro: boolean
  generationsUsed: number
  totalGenerations: number
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

export default function DashboardClient({
  isPro,
  generationsUsed: initialUsed,
  totalGenerations,
}: DashboardClientProps) {
  const [loadingNiche, setLoadingNiche] = useState<string | null>(null)
  const [results, setResults] = useState<ShortVideo[] | null>(null)
  const [activeNiche, setActiveNiche] = useState<string | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [generationsUsed, setGenerationsUsed] = useState(initialUsed)
  const [error, setError] = useState<string | null>(null)

  const FREE_LIMIT = 5
  const canGenerate = isPro || generationsUsed < FREE_LIMIT

  async function handleGenerate(nicheId: string) {
    if (!canGenerate) {
      setShowUpgradeModal(true)
      return
    }

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
          return
        }
        throw new Error(data.error || 'Generation failed')
      }

      setResults(data.videos)
      setActiveNiche(nicheId)
      if (!isPro) {
        setGenerationsUsed((prev) => prev + 1)
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
  const freeRemaining = Math.max(0, FREE_LIMIT - generationsUsed)

  return (
    <div className="px-6 py-7 pb-20">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4 relative">
        <div
          className="absolute pointer-events-none"
          style={{
            width: 700,
            height: 500,
            background: 'radial-gradient(ellipse at 30% 50%, rgba(99,102,241,0.15) 0%, rgba(124,58,237,0.08) 40%, transparent 70%)',
            top: -150,
            left: -150,
            borderRadius: '50%',
          }}
        />
        <div className="relative z-10">
          <h1
            className="font-black tracking-tight mb-1.5"
            style={{ fontSize: '1.45rem', color: 'var(--text)', lineHeight: 1.15 }}
          >
            Create <span className="grad-text">5 Viral Shorts</span>
            <br />
            in 30 Seconds
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.77rem', maxWidth: 480, lineHeight: 1.5 }}>
            Pick a viral topic. Get scripts, titles, hashtags, and video prompts ready to use.
          </p>
          <div className="mt-2">
            <p className="text-sm font-bold" style={{ color: '#94a3b8' }}>
              Stop thinking. Start posting.
            </p>
            <p className="text-xs" style={{ color: '#64748b', lineHeight: 1.5 }}>
              Ready-to-use viral content for YouTube Shorts, TikTok and Reels.
            </p>
          </div>
        </div>
        <div
          className="relative z-10 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0"
          style={{
            background: 'rgba(16,185,129,.08)',
            border: '1px solid rgba(16,185,129,.18)',
            color: '#34d399',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
            style={{ background: '#34d399', boxShadow: '0 0 6px rgba(52,211,153,.5)' }}
          />
          Live · Ready to Generate
        </div>
      </div>

      {/* Stats Row */}
      <div
        className="grid gap-2.5 mb-5"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
      >
        {[
          { icon: '🎬', val: totalGenerations, label: 'Scripts Generated', style: 'si-purple', trend: '↑ All time' },
          { icon: '🎯', val: 5, label: 'Viral Topics', style: 'si-violet', trend: null },
          { icon: '⚡', val: '~30s', label: 'Avg. Generate Time', style: 'si-cyan', trend: null },
          {
            icon: isPro ? '⭐' : '💚',
            val: isPro ? 'Unlimited' : `${freeRemaining} left`,
            label: isPro ? 'Pro Plan' : 'Free Generations',
            style: 'si-green',
            trend: isPro ? 'Pro' : 'Free',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all relative overflow-hidden"
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
                    ? 'rgba(99,102,241,.1)'
                    : 'rgba(16,185,129,.1)',
                  border: stat.trend === 'Free' || stat.trend === 'Pro'
                    ? '1px solid rgba(99,102,241,.15)'
                    : '1px solid rgba(16,185,129,.15)',
                  color: stat.trend === 'Free' || stat.trend === 'Pro'
                    ? 'var(--indigo-light)'
                    : '#34d399',
                  fontSize: '0.62rem',
                }}
              >
                {stat.trend}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Error */}
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

      {/* Loading overlay */}
      {loadingNiche && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(8,8,15,.92)', backdropFilter: 'blur(20px)' }}
        >
          <div
            className="rounded-[22px] p-12 text-center"
            style={{
              background: 'var(--card2)',
              border: '1px solid rgba(99,102,241,.2)',
              boxShadow: '0 0 80px rgba(99,102,241,.14)',
            }}
          >
            <div className="relative w-16 h-16 mx-auto mb-5">
              <div className="spinner" />
              <div className="spinner-inner" />
              <div className="absolute inset-0 flex items-center justify-center text-2xl">⚡</div>
            </div>
            <div
              className="font-bold mb-1"
              style={{ fontSize: '0.94rem', color: 'var(--text)' }}
            >
              Forging viral shorts...
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>
              Building hooks, titles and prompts... ✨
            </div>
            <div
              className="w-44 h-0.5 rounded-full mx-auto mt-4 overflow-hidden"
              style={{ background: 'rgba(255,255,255,.05)' }}
            >
              <div
                className="h-full rounded-full animate-progress"
                style={{
                  background: 'linear-gradient(90deg, var(--indigo), var(--purple))',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Results section */}
      {results && !loadingNiche ? (
        <div className="animate-results-reveal">
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
                Your Viral Shorts Pack is{' '}
                <span className="grad-text">Ready</span>
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

          {/* Success bar */}
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3 mb-5 text-sm"
            style={{
              background: 'rgba(16,185,129,.06)',
              border: '1px solid rgba(16,185,129,.14)',
              color: 'var(--muted2)',
            }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: 'rgba(16,185,129,.12)',
                border: '1px solid rgba(16,185,129,.22)',
              }}
            >
              ✅
            </div>
            <span>
              <strong style={{ color: 'var(--text)' }}>5 viral scripts generated!</strong>{' '}
              Copy each script and post today.
            </span>
          </div>

          {/* Result cards */}
          <div className="flex flex-col gap-4">
            {results.map((video, i) => (
              <ResultCard key={i} video={video} index={i} />
            ))}
          </div>

          {/* Generate again */}
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
                boxShadow: '0 4px 22px rgba(99,102,241,.3)',
              }}
            >
              ⚡ Generate Another Niche
            </button>
          </div>
        </div>
      ) : !loadingNiche ? (
        <>
          {/* Niche cards */}
          <div className="mb-4">
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
                  Click any card to instantly generate 5 viral scripts, titles, hashtags and video prompts.
                </p>
              </div>
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
            </div>

            <div
              className="grid gap-3.5"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}
            >
              {NICHES.map((niche) => (
                <NicheCard
                  key={niche.id}
                  {...niche}
                  onGenerate={handleGenerate}
                  loading={loadingNiche === niche.id}
                  disabled={!canGenerate}
                />
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
                  }}
                >
                  ⭐ Upgrade to Pro
                </button>
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* Upgrade modal */}
      {showUpgradeModal && (
        <UpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          generationsUsed={generationsUsed}
        />
      )}
    </div>
  )
}
