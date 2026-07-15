'use client'

// PROVA-SOCIAL-REAL-2026-07-02 — discreet live-stats badge fed exclusively by
// /api/stats/public (real database counts, cached 1h). HONESTY RULE: if the
// API fails, returns nothing, or the real numbers are too small to impress,
// this component renders NOTHING (return null). Better invisible than fake —
// the old fake-name toasts were removed for exactly this reason; never
// reintroduce invented social proof here.
//
// Thresholds (why): with <500 lifetime Shorts the video count reads as
// "nobody uses this", so we lead with total Shorts only past 500. Below
// that, the account count (signups) is the honest metric that already
// impresses, shown alone once past 200. Weekly volume only appears once
// it clears 100 — "12 this week" would undermine, not persuade.

import { useEffect, useState } from 'react'

type PublicStats = {
  ok?: boolean
  totalVideos?: number
  videosLast7Days?: number
  totalCreators?: number
}

const MIN_TOTAL_VIDEOS = 500
const MIN_CREATORS = 200
const MIN_WEEKLY = 100

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

export default function LiveStatsBadge({ style }: { style?: React.CSSProperties }) {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/stats/public')
      .then((res) => (res.ok ? (res.json() as Promise<PublicStats>) : null))
      .then((stats) => {
        if (cancelled || !stats || !stats.ok) return

        const videos = stats.totalVideos ?? 0
        const weekly = stats.videosLast7Days ?? 0
        const accounts = stats.totalCreators ?? 0

        const parts: string[] = []
        if (videos >= MIN_TOTAL_VIDEOS) {
          parts.push(`${fmt(videos)} Shorts created`)
          if (weekly >= MIN_WEEKLY) parts.push(`${fmt(weekly)} this week`)
          if (accounts >= MIN_CREATORS) parts.push(`${fmt(accounts)} accounts joined`)
        } else if (accounts >= MIN_CREATORS) {
          // Video count not impressive yet — show only the signup base.
          parts.push(`${fmt(accounts)} accounts joined`)
        }

        if (parts.length > 0) setLabel(parts.join(' · '))
      })
      .catch(() => {
        // Silent by design — no badge is better than a broken or fake one.
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (!label) return null

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontSize: 12.5,
        fontWeight: 500,
        color: '#86868b',
        letterSpacing: '0.01em',
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#30d158',
          flexShrink: 0,
          animation: 'kineoLivePulse 2s ease-out infinite',
        }}
      />
      {label}
      <style
        dangerouslySetInnerHTML={{
          __html:
            '@keyframes kineoLivePulse{0%{box-shadow:0 0 0 0 rgba(48,209,88,.45)}70%{box-shadow:0 0 0 6px rgba(48,209,88,0)}100%{box-shadow:0 0 0 0 rgba(48,209,88,0)}}',
        }}
      />
    </span>
  )
}
