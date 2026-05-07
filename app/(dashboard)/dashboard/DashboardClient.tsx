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

const DEFAULT_PILLS = ['🎬 YouTube Shorts', '🔥 High Engagement', '📋 Ready to Copy']

const NICHES = [
  {
    id: 'mideast',
    emoji: '🔥',
    name: 'Middle East Secrets',
    description: 'Hidden stories, geopolitics & untold facts from the region',
    tags: ['High RPM', 'Viral', 'Geopolitics'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'money',
    emoji: '💰',
    name: 'Money Facts',
    description: 'Finance niche, top CPM, huge audience & viral potential',
    tags: ['High RPM', 'Finance', 'Monetization'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'mind',
    emoji: '🧠',
    name: 'Mind Blowing Facts',
    description: 'Education niche with massive shareability & saves',
    tags: ['Viral', 'Curiosity', 'Fast Views'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'dark',
    emoji: '😱',
    name: 'Dark Mysteries',
    description: 'Horror & mystery niche that creates binge-watch loops',
    tags: ['Mystery', 'High Retention', 'Suspense'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'motivation',
    emoji: '🏋',
    name: 'Motivation',
    description: 'Lifestyle niche — save & share magnet, evergreen content',
    tags: ['Evergreen', 'Daily Content', 'Reels/TikTok'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'ancient',
    emoji: '🏛️',
    name: 'Ancient Civilizations',
    description: 'Lost empires, hidden ruins, and forgotten history',
    tags: ['History', 'Viral', 'Mystery'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'space',
    emoji: '🚀',
    name: 'Space Mysteries',
    description: 'Black holes, alien theories & cosmic wonders',
    tags: ['Science', 'Viral', 'Curiosity'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'truecrime',
    emoji: '🔍',
    name: 'True Crime',
    description: 'Real cases that shocked the world',
    tags: ['True Crime', 'High Retention', 'Suspense'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'psychology',
    emoji: '🧠',
    name: 'Psychology Facts',
    description: 'Mind tricks, biases & human behavior',
    tags: ['Psychology', 'Saves', 'Viral'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'business',
    emoji: '💼',
    name: 'Money & Business',
    description: 'Wealth secrets, startups & passive income',
    tags: ['Finance', 'High RPM', 'Viral'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'ai',
    emoji: '🤖',
    name: 'AI & Technology',
    description: 'Future tech, AI breakthroughs & disruption',
    tags: ['Tech', 'Trending', 'Future'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'celebrity',
    emoji: '⭐',
    name: 'Celebrity Secrets',
    description: 'Untold stories behind famous names',
    tags: ['Entertainment', 'Gossip', 'Viral'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'darkhistory',
    emoji: '☠️',
    name: 'Dark History',
    description: 'Disturbing events the textbooks skip',
    tags: ['History', 'Shocking', 'Viral'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'health',
    emoji: '🧬',
    name: 'Health & Longevity',
    description: 'Science-backed tips to live longer',
    tags: ['Health', 'Evergreen', 'Saves'],
    pills: DEFAULT_PILLS,
  },
  {
    id: 'luxury',
    emoji: '💎',
    name: 'Luxury Lifestyle',
    description: 'Billionaire habits, ultra-luxury & wealth flex',
    tags: ['Luxury', 'Aspirational', 'Viral'],
    pills: DEFAULT_PILLS,
  },
]

// Free users only see Money Facts unlocked; the rest are shown as locked
const FREE_NICHE_ID = 'money'

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

// AI Video Beta Modal
function AIVideoBetaModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(8,8,15,.92)', backdropFilter: 'blur(24px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl relative overflow-hidden"
        style={{
          background: 'var(--card2)',
          border: '1px solid rgba(99,102,241,.3)',
          boxShadow: '0 0 100px rgba(99,102,241,.25), 0 30px 80px rgba(0,0,0,.5)',
        }}
      >
        {/* Top accent */}
        <div className="absolute top-0 left-0 right-0 h-0.5 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, #6366f1, #a855f7, transparent)' }} />
        <div className="relative z-10 p-7">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all"
            style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--muted2)', cursor: 'pointer' }}
          >
            ✕
          </button>

          <div className="text-4xl mb-4 text-center">🎬</div>
          <h2 className="text-xl font-black tracking-tight mb-3 text-center" style={{ color: 'var(--text)' }}>
            AI Video Generator{' '}
            <span
              className="text-xs font-black px-2 py-0.5 rounded-full align-middle"
              style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)', color: '#fff', fontSize: '0.58rem', letterSpacing: '0.08em' }}
            >
              COMING SOON
            </span>
          </h2>
          <p className="text-sm text-center mb-6" style={{ color: 'var(--muted)', lineHeight: 1.65 }}>
            Soon you&apos;ll be able to turn your scripts into ready-to-post Shorts with visuals, subtitles, voiceover, and music — all in one click.
          </p>

          <div className="flex flex-col gap-3 mb-6">
            {['🎥 Auto-generated visuals matching your script', '🗣️ AI voiceover in multiple styles', '📝 Auto-subtitles & captions', '🎵 Royalty-free background music'].map((feat) => (
              <div key={feat} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text2)' }}>
                <span style={{ color: '#34d399' }}>✓</span> {feat}
              </div>
            ))}
          </div>

          <a
            href="mailto:josephsskaf@gmail.com?subject=Beta Access Request — AI Video Generator"
            className="block w-full text-center rounded-xl py-3.5 text-sm font-black text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)',
              boxShadow: '0 4px 28px rgba(99,102,241,.45)',
              textDecoration: 'none',
            }}
          >
            🚀 Join Beta — Get Early Access
          </a>
          <p className="text-center text-xs mt-3" style={{ color: 'var(--muted)' }}>Free for early adopters. Limited spots.</p>
        </div>
      </div>
    </div>
  )
}

export default function DashboardClient({
  isPro,
  generationsUsed: initialUsed,
  totalGenerations,
  isLoggedIn,
}: DashboardClientProps) {
  const [loadingNiche, setLoadingNiche] = useState<string | null>(null)
  const [results, setResults] = useState<ShortVideo[] | null>(null)
  const [activeNiche, setActiveNiche] = useState<string | null>(null)
  const [selectedNiche, setSelectedNiche] = useState<string | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showVideoBetaModal, setShowVideoBetaModal] = useState(false)
  const [previewNiche, setPreviewNiche] = useState<(typeof NICHES)[0] | null>(null)
  const [generationsUsed, setGenerationsUsed] = useState(initialUsed)
  const [error, setError] = useState<string | null>(null)
  const [copyAllToast, setCopyAllToast] = useState(false)
  const nichesSectionRef = useRef<HTMLDivElement>(null)

  const FREE_LIMIT = 2
  const canGenerate = isPro || generationsUsed < FREE_LIMIT
  const freeRemaining = Math.max(0, FREE_LIMIT - generationsUsed)

  // Scroll to niches section
  function scrollToNiches() {
    nichesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // NicheCard click → open preview modal (or auth/upgrade gates first)
  function handleNicheClick(nicheId: string) {
    setSelectedNiche(nicheId)
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
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCopyAll() {
    if (!results) return
    const text = results
      .map((v, i) =>
        `SHORT #${i + 1}\nTitle: ${v.title}\nScript: ${v.script}\nHashtags: ${v.hashtags.join(' ')}\nVideo Prompt: ${v.videoPrompt}\n`
      )
      .join('\n---\n\n')
    navigator.clipboard.writeText(text)
    setCopyAllToast(true)
    setTimeout(() => setCopyAllToast(false), 2200)
  }

  function handleCopyPackage() {
    if (!results || !activeNiche) return
    const nicheData = NICHES.find((n) => n.id === activeNiche)
    const header = `=== VIRAL SHORTS PACKAGE ===\nNiche: ${nicheData?.emoji ?? ''} ${nicheData?.name ?? activeNiche}\nGenerated by ShortsForgeAI\n\n`
    const body = results
      .map((v, i) =>
        `--- SHORT #${i + 1} ---\n🎬 TITLE: ${v.title}\n\n🪝 HOOK / SCRIPT:\n${v.script}\n\n#️⃣ HASHTAGS: ${v.hashtags.join(' ')}\n\n🎥 VIDEO PROMPT: ${v.videoPrompt}\n`
      )
      .join('\n\n')
    navigator.clipboard.writeText(header + body)
    setCopyAllToast(true)
    setTimeout(() => setCopyAllToast(false), 2200)
  }

  const activeNicheData = NICHES.find((n) => n.id === activeNiche)

  function handleDownloadAll() {
    if (!results || !activeNiche) return
    const nicheData = NICHES.find((n) => n.id === activeNiche)
    const nicheName = nicheData?.name ?? activeNiche
    const dateStr = new Date().toISOString().slice(0, 10)

    const content = results
      .map((v, i) => {
        const hookMatch = v.script.match(/🎯\s*HOOK[:\s]+([^\n]+(?:\n(?!📝|🔗)[^\n]+)*)/i)
        const hook = hookMatch ? hookMatch[1].trim() : v.script.split('\n')[0]
        return [
          `===== SCRIPT ${i + 1} OF ${results.length} =====`,
          `HOOK: ${hook}`,
          `TITLE: ${v.title}`,
          `SCRIPT:\n${v.script}`,
          `HASHTAGS: ${v.hashtags.join(' ')}`,
          `VIDEO PROMPT: ${v.videoPrompt}`,
          `YOUTUBE DESCRIPTION: ${v.youtubeDescription}`,
        ].join('\n\n')
      })
      .join('\n\n' + '─'.repeat(50) + '\n\n')

    const header = `SHORTS SCRIPTS PACKAGE\nNiche: ${nicheData?.emoji ?? ''} ${nicheName}\nGenerated: ${dateStr} | ShortsForgeAI\n\n${'═'.repeat(50)}\n\n`
    const blob = new Blob([header + content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shorts-scripts-${activeNiche}-${dateStr}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-4 md:px-6 py-7 pb-28 md:pb-20">
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
            ⚡{' '}
            <strong style={{ color: freeRemaining === 0 ? '#f87171' : '#818cf8' }}>
              You have {freeRemaining} viral Short{freeRemaining !== 1 ? 's' : ''} left
            </strong>{' '}
            — Upgrade for unlimited access
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
          className="relative rounded-[20px] overflow-hidden mb-4 px-6 md:px-8 py-6 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,.1) 0%, rgba(124,58,237,.07) 50%, rgba(168,85,247,.06) 100%)',
            border: '1px solid rgba(99,102,241,.18)',
            boxShadow: '0 0 60px rgba(99,102,241,.07)',
          }}
        >
          <div
            className="absolute pointer-events-none"
            style={{
              width: 400, height: 300,
              background: 'radial-gradient(ellipse, rgba(99,102,241,.15) 0%, transparent 70%)',
              top: -80, left: '50%', transform: 'translateX(-50%)',
            }}
          />

          <div className="flex justify-center mb-3">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.22)', color: '#34d399' }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: '#10b981', boxShadow: '0 0 6px rgba(52,211,153,.6)' }} />
              ⚡ Viral Engine Active
            </div>
          </div>

          <h1
            className="font-black tracking-tight mb-2 relative z-10"
            style={{ fontSize: 'clamp(1.4rem, 3.5vw, 2rem)', color: 'var(--text)', lineHeight: 1.1 }}
          >
            Pick a Niche →{' '}
            <span className="grad-text">Build Viral Shorts</span>
          </h1>

          <p
            className="relative z-10 mx-auto"
            style={{ fontSize: '0.9rem', color: 'var(--muted2)', maxWidth: 420, lineHeight: 1.5 }}
          >
            {!isLoggedIn
              ? '🔑 Create a free account to generate your first Shorts package.'
              : 'Choose your niche, enter a topic, and generate 5 retention-optimized Shorts scripts instantly.'}
          </p>
        </div>
      )}



      {/* ─── ERROR ─── */}
      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm mb-5 flex items-center gap-3"
          style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171' }}
        >
          <span>⚠️</span>
          {error}
          <button onClick={() => setError(null)} className="ml-auto font-bold" style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ─── FULLSCREEN LOADER ─── */}
      {loadingNiche && <FullscreenLoader />}

      {/* ─── RESULTS ─── */}
      {results && !loadingNiche ? (
        <div className="animate-results-reveal">
          {/* Copy toast */}
          {copyAllToast && (
            <div
              className="fixed bottom-6 left-1/2 z-50 px-5 py-3 rounded-xl text-sm font-bold text-white flex items-center gap-2"
              style={{ transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 24px rgba(16,185,129,.4)' }}
            >
              ✅ Copied to clipboard!
            </div>
          )}

          {/* Success banner */}
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3 mb-5 text-sm"
            style={{ background: 'linear-gradient(90deg, rgba(16,185,129,.08), rgba(16,185,129,.04))', border: '1px solid rgba(16,185,129,.2)', color: 'var(--muted2)' }}
          >
            <span className="text-lg">✅</span>
            <span><strong style={{ color: 'var(--text)' }}>Generated in seconds — ready to post.</strong></span>
          </div>

          {/* Results topbar */}
          <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--indigo-light)' }}>
                ⚡ Viral Shorts Pack
              </div>
              <h2 className="font-black tracking-tight mb-1" style={{ fontSize: '1.4rem', color: 'var(--text)', lineHeight: 1.15 }}>
                Your Viral Shorts Package is <span className="grad-text">Ready 🎉</span>
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 8 }}>
                Copy everything and paste into your favorite video tool.
              </p>
              {activeNicheData && (
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(99,102,241,.09)', border: '1px solid rgba(99,102,241,.18)', color: 'var(--indigo-light)' }}
                >
                  {activeNicheData.emoji} {activeNicheData.name}
                </div>
              )}
            </div>
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-xs font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--muted2)', cursor: 'pointer' }}
            >
              ← Back to Dashboard
            </button>
          </div>

          {/* Global action bar */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, var(--indigo), var(--purple))', boxShadow: '0 4px 18px rgba(99,102,241,.35)', border: 'none', cursor: 'pointer' }}
            >
              📋 Copy All
            </button>
            <button
              onClick={handleDownloadAll}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.22)', color: '#34d399', cursor: 'pointer' }}
            >
              ⬇️ Download All (.txt)
            </button>
            <button
              onClick={handleCopyPackage}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'rgba(99,102,241,.07)', border: '1px solid rgba(99,102,241,.18)', color: 'var(--indigo-light)', cursor: 'pointer' }}
            >
              📦 Copy Package
            </button>
            <button
              onClick={() => setShowVideoBetaModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'rgba(168,85,247,.1)', border: '1px solid rgba(168,85,247,.3)', color: '#c084fc', cursor: 'pointer' }}
            >
              🎬 AI Video
              <span
                className="text-xs font-black px-1.5 py-0.5 rounded-full"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: '0.55rem' }}
              >
                BETA
              </span>
            </button>
            <button
              onClick={() => handleGenerate(activeNiche!)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', color: 'var(--indigo-light)', cursor: 'pointer' }}
            >
              🔄 Regenerate
            </button>
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', color: 'var(--muted2)', cursor: 'pointer' }}
            >
              ← Back
            </button>
          </div>

          {/* Result cards */}
          <div className="flex flex-col gap-4">
            {results.map((video, i) => (
              <ResultCard key={i} video={video} index={i} total={results.length} />
            ))}
          </div>

          {/* Bottom — Generate Again + Download */}
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-black text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, var(--indigo), var(--purple))',
                boxShadow: '0 4px 28px rgba(99,102,241,.4)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ⚡ Generate Again — Pick a New Niche
            </button>
            <button
              onClick={handleDownloadAll}
              className="flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold transition-all"
              style={{
                background: 'rgba(16,185,129,.08)',
                border: '1px solid rgba(16,185,129,.25)',
                color: '#34d399',
                cursor: 'pointer',
              }}
            >
              ⬇️ Download All Scripts
            </button>
          </div>
        </div>
      ) : !loadingNiche ? (
        <>
          {/* ─── NICHE CARDS ─── */}
          <div className="mb-4" ref={nichesSectionRef}>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <div className="font-black uppercase tracking-widest mb-0.5" style={{ fontSize: '0.62rem', color: 'var(--indigo-light)' }}>
                  STEP 1 — PICK YOUR NICHE
                </div>
                <div className="font-bold" style={{ fontSize: '1rem', color: 'var(--text)' }}>
                  Choose your niche → Generate viral content
                </div>
              </div>
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0"
                style={{ background: 'rgba(99,102,241,.07)', border: '1px solid rgba(99,102,241,.13)', color: 'var(--indigo-light)' }}
              >
                ⚡ 5 scripts per package
              </div>
            </div>

            {/* Niche grid — 4 cols desktop, 2 tablet, 1 mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Unlocked niche for free users */}
              {!isPro ? (
                <>
                  {NICHES.filter((n) => n.id === FREE_NICHE_ID).map((niche) => (
                    <NicheCard
                      key={niche.id}
                      {...niche}
                      onGenerate={handleNicheClick}
                      loading={false}
                      disabled={!canGenerate}
                      selected={selectedNiche === niche.id}
                    />
                  ))}
                  {/* Locked niches */}
                  {NICHES.filter((n) => n.id !== FREE_NICHE_ID).map((niche) => (
                    <div
                      key={niche.id}
                      onClick={() => isLoggedIn ? setShowUpgradeModal(true) : setShowAuthModal(true)}
                      className="relative rounded-2xl p-5 cursor-pointer transition-all duration-300"
                      style={{
                        background: 'rgba(15,15,30,.5)',
                        border: '1px solid rgba(255,255,255,.07)',
                        boxShadow: '0 0 30px rgba(139,92,246,.06)',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,.3)'; (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.07)'; (e.currentTarget as HTMLElement).style.opacity = '1' }}
                    >
                      <div
                        className="absolute top-3 right-3 text-xs font-black px-2 py-0.5 rounded-full"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: '0.6rem' }}
                      >
                        🔒 Pro
                      </div>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3" style={{ background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.12)' }}>
                        {niche.emoji}
                      </div>
                      <div className="font-bold text-sm mb-1" style={{ color: 'var(--text2)' }}>{niche.name}</div>
                      <div className="text-xs mb-3" style={{ color: 'var(--muted)', lineHeight: 1.4 }}>{niche.description}</div>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {niche.tags.map((tag) => (
                          <span key={tag} className="text-xs px-2 py-0.5 rounded-md font-semibold" style={{ background: 'rgba(99,102,241,.07)', border: '1px solid rgba(99,102,241,.1)', color: 'var(--muted)', fontSize: '0.58rem' }}>{tag}</span>
                        ))}
                      </div>
                      <div
                        className="w-full rounded-xl py-2.5 text-xs font-black text-center"
                        style={{ background: 'rgba(124,58,237,.15)', border: '1px solid rgba(124,58,237,.25)', color: '#c084fc' }}
                      >
                        🔒 Unlock This Niche
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                NICHES.map((niche) => (
                  <NicheCard
                    key={niche.id}
                    {...niche}
                    onGenerate={handleNicheClick}
                    loading={false}
                    disabled={false}
                    selected={selectedNiche === niche.id}
                  />
                ))
              )}
            </div>

            {!isPro && generationsUsed >= FREE_LIMIT && (
              <div
                className="mt-5 rounded-xl px-5 py-4 flex items-center justify-between flex-wrap gap-4"
                style={{ background: 'rgba(99,102,241,.06)', border: '1px solid rgba(99,102,241,.18)' }}
              >
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                    🔒 You&apos;ve used all your free generations
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    Upgrade to keep building viral Shorts.
                  </p>
                </div>
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--indigo), var(--purple))', boxShadow: '0 4px 22px rgba(99,102,241,.3)', border: 'none', cursor: 'pointer' }}
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
          style={{ background: 'rgba(8,8,15,.95)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--border)' }}
        >
          <button
            onClick={scrollToNiches}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-black text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 55%, #a855f7 100%)', boxShadow: '0 4px 28px rgba(99,102,241,.5)', animation: 'btn-pulse 2.8s ease-in-out infinite', border: 'none', cursor: 'pointer' }}
          >
            ⚡ Generate New Short
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

      {showVideoBetaModal && (
        <AIVideoBetaModal onClose={() => setShowVideoBetaModal(false)} />
      )}
    </div>
  )
}
