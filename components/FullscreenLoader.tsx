'use client'

import { useState, useEffect } from 'react'

const STEPS = [
  { pct: 20, label: 'Analyzing Viral Patterns...' },
  { pct: 45, label: 'Finding High CTR Hooks...' },
  { pct: 65, label: 'Building Retention Structure...' },
  { pct: 85, label: 'Optimizing For Shorts Algorithm...' },
  { pct: 100, label: 'Creating Scroll-Stopping Ideas...' },
]

const STEP_DURATIONS = [1000, 1400, 1400, 1200, 1200] // ms per step

export default function FullscreenLoader() {
  const [stepIndex, setStepIndex] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let current = 0

    function advance() {
      if (current >= STEPS.length - 1) return
      current++
      setStepIndex(current)
      setProgress(STEPS[current].pct)
      setTimeout(advance, STEP_DURATIONS[current] ?? 1200)
    }

    // Kick off first step
    setProgress(STEPS[0].pct)
    const first = setTimeout(advance, STEP_DURATIONS[0])
    return () => clearTimeout(first)
  }, [])

  const currentStep = STEPS[stepIndex]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(8,8,15,.95)', backdropFilter: 'blur(24px) saturate(180%)' }}
    >
      <div
        className="rounded-[26px] p-10 text-center mx-4"
        style={{
          background: '#1d1d1f',
          border: '1px solid #2a2a2d',
          boxShadow: '0 0 100px rgba(41,151,255,.18)',
          minWidth: 320,
          maxWidth: 420,
          width: '100%',
        }}
      >
        {/* Spinner */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="spinner" style={{ width: 80, height: 80 }} />
          <div className="spinner-inner" style={{ inset: 11 }} />
          <div className="absolute inset-0 flex items-center justify-center text-3xl">⚡</div>
        </div>

        {/* Title */}
        <div
          className="font-black mb-1 tracking-tight"
          style={{ fontSize: '1.05rem', color: '#f5f5f7' }}
        >
          Forging your viral shorts...
        </div>

        {/* Step label */}
        <div
          className="text-sm mb-6 transition-all duration-500"
          style={{ color: '#2997ff', minHeight: 20 }}
        >
          {currentStep.label}
        </div>

        {/* Progress bar track */}
        <div
          className="w-full rounded-full overflow-hidden mb-3"
          style={{ height: 6, background: 'rgba(255,255,255,.06)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${progress}%`,
              background: '#2997ff',
              boxShadow: '0 0 12px rgba(41,151,255,.6)',
            }}
          />
        </div>

        {/* Progress pct */}
        <div
          className="text-xs font-bold"
          style={{ color: '#6e6e73' }}
        >
          {progress}% complete
        </div>

        {/* Steps list */}
        <div className="mt-6 flex flex-col gap-1.5 text-left">
          {STEPS.map((step, i) => {
            const done = i < stepIndex
            const active = i === stepIndex
            return (
              <div
                key={i}
                className="flex items-center gap-2.5 text-xs transition-all duration-300"
                style={{
                  color: done ? '#2997ff' : active ? '#f5f5f7' : '#86868b',
                  opacity: done || active ? 1 : 0.45,
                }}
              >
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-xs"
                  style={{
                    background: done
                      ? 'rgba(41,151,255,.2)'
                      : active
                      ? 'rgba(41,151,255,.2)'
                      : 'transparent',
                    border: done
                      ? '1px solid rgba(41,151,255,.3)'
                      : active
                      ? '1px solid rgba(41,151,255,.35)'
                      : '1px solid rgba(255,255,255,.08)',
                  }}
                >
                  {done ? '✓' : active ? '·' : ''}
                </span>
                {step.label}
              </div>
            )
          })}
        </div>

        {/* Trust tag */}
        <div
          className="mt-5 text-xs font-medium"
          style={{ color: '#86868b', fontSize: '0.68rem' }}
        >
          📱 YouTube Shorts · TikTok · Reels
        </div>
      </div>
    </div>
  )
}
