'use client'

// Push #060 — first-user onboarding panel.
// Shows on the Generate page when the user is signed in AND has never
// finished a video (recent videos list is empty). Three quick-start
// buttons drop a starter prompt into the textarea (or navigate to
// /generate?prompt= when used from another page). Dismiss button writes
// `onboarding_dismissed` to localStorage so it stays hidden after that.

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export interface OnboardingQuickStart {
  key: string
  label: string
  prompt: string
}

export const ONBOARDING_QUICK_STARTS: OnboardingQuickStart[] = [
  {
    key: 'space',
    label: '🚀 Space Mystery',
    prompt:
      'Create a mysterious cinematic YouTube Short about a strange signal coming from deep space.',
  },
  {
    key: 'history',
    label: '📜 History Facts',
    prompt:
      'Create a cinematic YouTube Short about 5 strange history facts that sound fake but are real.',
  },
  {
    key: 'places',
    label: '🌍 Hidden Places',
    prompt:
      'Create a cinematic YouTube Short about 5 hidden places on Earth that look impossible.',
  },
]

const DISMISSED_KEY = 'onboarding_dismissed'

interface OnboardingPanelProps {
  // True when the current user has zero videos in public.videos. The parent
  // is responsible for this check — we just decide what to render based on
  // it + the dismissed-in-localStorage flag.
  hasNoVideos: boolean
  // When the user picks a quick-start from inside /generate, we just fill
  // the textarea. Parent passes a handler. When undefined we navigate.
  onFillPrompt?: (prompt: string) => void
}

export default function OnboardingPanel({ hasNoVideos, onFillPrompt }: OnboardingPanelProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [dismissed, setDismissed] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(DISMISSED_KEY)
      setDismissed(v === 'true')
    } catch {
      setDismissed(false)
    }
  }, [])

  if (!hasNoVideos) return null
  if (dismissed !== false) return null // null = still checking, true = hide

  function handleDismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, 'true')
    } catch {
      // localStorage can be unavailable — still hide for this session.
    }
    setDismissed(true)
  }

  function handlePick(prompt: string) {
    if (onFillPrompt && pathname?.startsWith('/generate')) {
      onFillPrompt(prompt)
      return
    }
    router.push(`/generate?prompt=${encodeURIComponent(prompt)}`)
  }

  return (
    <section
      className="rounded-2xl p-5 sm:p-6 mb-6 relative"
      style={{
        background: '#161618',
        border: '1px solid #2a2a2d',
        boxShadow: 'none',
      }}
    >
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss onboarding"
        title="Dismiss"
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 28,
          height: 28,
          borderRadius: 8,
          background: 'rgba(255,255,255,.04)',
          border: '1px solid #2a2a2d',
          color: '#86868b',
          cursor: 'pointer',
          fontSize: '0.95rem',
          lineHeight: 1,
        }}
      >
        <span aria-hidden="true">×</span>
      </button>

      <div className="mb-4 pr-8">
        <div
          className="text-[10px] font-black uppercase tracking-widest mb-1"
          style={{ color: '#2997ff' }}
        >
          Welcome
        </div>
        <h2
          className="font-black tracking-tight mb-1"
          style={{ fontSize: '1.25rem', color: '#f5f5f7' }}
        >
          Create your first AI Short
        </h2>
        <p className="text-sm" style={{ color: '#6e6e73' }}>
          Pick a topic below to get started.
        </p>
      </div>

      <div
        className="grid gap-2 mb-5"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
      >
        {ONBOARDING_QUICK_STARTS.map((q) => (
          <button
            key={q.key}
            type="button"
            onClick={() => handlePick(q.prompt)}
            className="rounded-xl px-4 py-3 text-sm font-bold text-left"
            style={{
              background: '#1d1d1f',
              border: '1px solid #2a2a2d',
              color: '#f5f5f7',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = '#232325'
              ;(e.currentTarget as HTMLElement).style.borderColor = '#48484a'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = '#1d1d1f'
              ;(e.currentTarget as HTMLElement).style.borderColor = '#2a2a2d'
            }}
          >
            <span aria-hidden="true">{q.label.slice(0, q.label.indexOf(' '))}</span> {q.label.slice(q.label.indexOf(' ') + 1)}
          </button>
        ))}
      </div>

      <ol
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
      >
        {[
          'Choose a topic',
          'Generate your AI Short',
          'Download and post',
        ].map((step, i) => (
          <li
            key={step}
            className="flex items-center gap-2 text-xs"
            style={{ color: '#6e6e73' }}
          >
            <span
              className="inline-flex items-center justify-center font-black"
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: 'rgba(41,151,255,.16)',
                color: '#2997ff',
                fontSize: '0.7rem',
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
