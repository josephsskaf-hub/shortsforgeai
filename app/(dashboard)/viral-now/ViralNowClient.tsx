'use client'

// Push #303 — Viral Now: dedicated page — 3 trending topic cards, 1 click = video
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ViralTopic {
  slot: number
  emoji: string
  label: string
  title: string
  prompt: string
  duration: number
  vertical: string
}

const VERTICAL_COLORS: Record<string, { bg: string; border: string; pill: string; text: string }> = {
  billionaire: { bg: 'rgba(251,191,36,.07)', border: 'rgba(251,191,36,.25)', pill: 'rgba(251,191,36,.15)', text: '#fbbf24' },
  money:       { bg: 'rgba(34,197,94,.07)',  border: 'rgba(34,197,94,.25)',  pill: 'rgba(34,197,94,.15)',  text: '#4ade80' },
  mystery:     { bg: 'rgba(168,85,247,.07)', border: 'rgba(168,85,247,.25)', pill: 'rgba(168,85,247,.15)', text: '#c084fc' },
  country:     { bg: 'rgba(59,130,246,.07)', border: 'rgba(59,130,246,.25)', pill: 'rgba(59,130,246,.15)', text: '#60a5fa' },
  learning:    { bg: 'rgba(236,72,153,.07)', border: 'rgba(236,72,153,.25)', pill: 'rgba(236,72,153,.15)', text: '#f472b6' },
}

export default function ViralNowClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  const router = useRouter()
  const [topics, setTopics] = useState<ViralTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<number | null>(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetch('/api/viral-now', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d?.topics)) setTopics(d.topics) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleGenerate(topic: ViralTopic) {
    if (!isLoggedIn) {
      router.push('/login?redirect=/viral-now')
      return
    }
    setGenerating(topic.slot)
    const url = `/generate?prompt=${encodeURIComponent(topic.prompt)}&autoanalyze=1&duration=${topic.duration}`
    router.push(url)
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="px-4 md:px-6 py-6 pb-28 md:pb-10 max-w-2xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: '#ef4444', boxShadow: '0 0 10px rgba(239,68,68,.9)', animation: 'pulse 1.4s ease-in-out infinite' }}
          />
          <span className="text-xs font-black uppercase tracking-widest" style={{ color: '#f87171' }}>Live · Updated Daily</span>
        </div>
        <h1 className="font-black tracking-tight mb-1" style={{ fontSize: 'clamp(1.6rem, 4vw, 2rem)', color: 'var(--text)', lineHeight: 1.1 }}>
          🔥 Viral Now
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted2)' }}>
          3 topics trending today — {today}. One click generates the video automatically.
        </p>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-4">
        {loading
          ? [1, 2, 3, 4, 5, 6].map(i => (
              <div
                key={i}
                className="rounded-[20px]"
                style={{ height: 140, background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)', animation: 'pulse 1.4s ease-in-out infinite' }}
              />
            ))
          : topics.map(topic => {
              const c = VERTICAL_COLORS[topic.vertical] ?? VERTICAL_COLORS.money
              const isGen = generating === topic.slot
              return (
                <div
                  key={topic.slot}
                  className="rounded-[20px] px-5 py-5"
                  style={{ background: c.bg, border: `1px solid ${c.border}`, boxShadow: `0 0 40px ${c.bg}` }}
                >
                  {/* Pill + duration row */}
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <span
                      className="text-xs font-black px-2.5 py-1 rounded-full"
                      style={{ background: c.pill, color: c.text, border: `1px solid ${c.border}` }}
                    >
                      {topic.label}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                      ⏱ {topic.duration}s · Fast Mode
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="font-black mb-4" style={{ fontSize: '1.1rem', color: 'var(--text)', lineHeight: 1.25 }}>
                    {topic.title}
                  </h2>

                  {/* CTA button */}
                  <button
                    type="button"
                    onClick={() => handleGenerate(topic)}
                    disabled={isGen}
                    className="w-full rounded-xl py-3 text-sm font-black text-white transition-all"
                    style={{
                      background: isGen
                        ? 'rgba(255,255,255,.08)'
                        : `linear-gradient(135deg, ${c.text}, #ef4444)`,
                      border: 'none',
                      cursor: isGen ? 'default' : 'pointer',
                      boxShadow: isGen ? 'none' : `0 4px 20px ${c.bg}`,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {isGen ? '⏳ Sending to generator…' : '⚡ Generate This Video →'}
                  </button>
                </div>
              )
            })}
      </div>

      {/* Footer note */}
      <p className="text-center text-xs mt-6" style={{ color: 'var(--muted)' }}>
        Topics refresh every day at 6 AM UTC · Powered by ShortsForgeAI
      </p>
    </div>
  )
}
