'use client'

import { useEffect } from 'react'

// Static preview data keyed by niche id
const NICHE_PREVIEWS: Record<string, { hook: string; title: string; hashtags: string[] }> = {
  mideast: {
    hook: '"This secret about the Middle East was hidden for decades..."',
    title: 'The Hidden Truth About the Most Powerful Region in the World',
    hashtags: ['#middleeast', '#geopolitics', '#viral'],
  },
  money: {
    hook: '"This one money fact changed how I see wealth forever..."',
    title: 'The Hidden Truth About Wealth Nobody Tells You',
    hashtags: ['#money', '#wealth', '#mindset'],
  },
  mind: {
    hook: '"Scientists just discovered something that breaks our reality..."',
    title: 'Mind-Blowing Facts That Will Change How You See the World',
    hashtags: ['#mindblow', '#facts', '#education'],
  },
  dark: {
    hook: '"This secret was buried for 100 years..."',
    title: "The Mystery That Governments Don't Want You to Know",
    hashtags: ['#mystery', '#darkfacts', '#viral'],
  },
  motivation: {
    hook: '"He failed 27 times before becoming a billionaire..."',
    title: 'Why Failure Is the Only Path to True Success',
    hashtags: ['#motivation', '#success', '#mindset'],
  },
}

interface PreviewModalProps {
  niche: {
    id: string
    emoji: string
    name: string
    description: string
  }
  onConfirm: () => void
  onClose: () => void
}

export default function PreviewModal({ niche, onConfirm, onClose }: PreviewModalProps) {
  const preview = NICHE_PREVIEWS[niche.id] ?? {
    hook: '"This viral short is about to change your feed..."',
    title: `Top Viral ${niche.name} Script — Ready to Post`,
    hashtags: ['#viral', '#shorts', '#fyp'],
  }

  // Accessibility: close on Escape, reusing the existing onClose handler.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(24px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`${niche.name} Shorts preview`}
    >
      <div
        className="w-full max-w-lg rounded-[22px] overflow-hidden animate-fade-in relative"
        style={{
          background: 'var(--card2)',
          border: '1px solid #2a2a2d',
          boxShadow: '0 20px 60px rgba(0,0,0,.6)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all"
          style={{
            background: 'rgba(255,255,255,.04)',
            border: '1px solid var(--border)',
            color: 'var(--muted2)',
            cursor: 'pointer',
          }}
        >
          <span aria-hidden="true">✕</span>
        </button>

        {/* Header bar */}
        <div
          className="px-7 pt-7 pb-5"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{
                background: '#1d1d1f',
                border: '1px solid #2a2a2d',
              }}
              aria-hidden="true"
            >
              {niche.emoji}
            </div>
            <div>
              <div
                className="text-xs font-bold uppercase tracking-widest mb-0.5"
                style={{ color: 'var(--blue, #2997ff)' }}
              >
                Ready to generate
              </div>
              <h2
                className="font-black tracking-tight"
                style={{ fontSize: '1.15rem', color: 'var(--text)', lineHeight: 1.2 }}
              >
                {niche.name} Shorts
              </h2>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{
                background: 'rgba(245,245,247,.08)',
                border: '1px solid #2a2a2d',
                color: '#f5f5f7',
              }}
            >
              <span aria-hidden="true">⚡</span> Videos in a few minutes
            </div>
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
              style={{
                background: 'rgba(41,151,255,.1)',
                border: '1px solid rgba(41,151,255,.25)',
                color: 'var(--blue, #2997ff)',
              }}
            >
              <span aria-hidden="true">👥</span> 300+ creators use this
            </div>
          </div>
        </div>

        {/* Preview card */}
        <div className="px-7 py-5">
          <p
            className="text-xs font-black uppercase tracking-widest mb-3"
            style={{ color: 'var(--muted)' }}
          >
            Preview — Script #1 of 5
          </p>

          <div
            className="rounded-[14px] p-4"
            style={{
              background: '#161618',
              border: '1px solid #2a2a2d',
            }}
          >
            {/* Hook */}
            <div className="mb-3">
              <span
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--muted2)' }}
              >
                <span aria-hidden="true">🎣</span> Hook
              </span>
              <p
                className="mt-1.5 font-bold text-sm leading-snug"
                style={{
                  color: 'var(--text)',
                  fontStyle: 'italic',
                  borderLeft: '2px solid var(--blue, #2997ff)',
                  paddingLeft: 10,
                }}
              >
                {preview.hook}
              </p>
            </div>

            {/* Title */}
            <div className="mb-3">
              <span
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--muted2)' }}
              >
                <span aria-hidden="true">🎬</span> Title
              </span>
              <p className="mt-1.5 text-sm font-semibold" style={{ color: 'var(--text2)' }}>
                {preview.title}
              </p>
            </div>

            {/* Hashtags */}
            <div>
              <span
                className="text-xs font-black uppercase tracking-widest"
                style={{ color: 'var(--muted2)' }}
              >
                # Hashtags
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {preview.hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-md text-xs font-medium"
                    style={{
                      background: 'rgba(41,151,255,.1)',
                      border: '1px solid rgba(41,151,255,.25)',
                      color: 'var(--blue, #2997ff)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p
            className="text-center text-xs mt-3 mb-1"
            style={{ color: 'var(--muted)', fontStyle: 'italic' }}
          >
            + 4 more scripts, video prompts, YouTube descriptions...
          </p>
        </div>

        {/* CTA footer */}
        <div
          className="px-7 pb-7"
          style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}
        >
          <button
            onClick={onConfirm}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-black mb-3 transition-all"
            style={{
              background: '#f5f5f7',
              color: '#000',
              boxShadow: 'none',
              animation: 'btn-pulse 2.8s ease-in-out infinite',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <span aria-hidden="true">⚡</span> Generate 5 Shorts Now
          </button>
          <button
            onClick={onClose}
            className="w-full text-sm font-medium transition-colors"
            style={{
              color: 'var(--muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
