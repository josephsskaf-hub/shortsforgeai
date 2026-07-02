'use client'

// Referral loop — compact "Invite & Earn" card for the post-generation
// success screen ("Your video is ready" in GenerateClient). The user just had
// their win moment, so this is the highest-intent spot to surface the invite
// link. Read-only: fetches the share data from /api/referral and renders a
// one-line pitch + copy button. Attribution/qualification side-effects are
// handled globally by <ReferralAutoTrigger/> in the dashboard layout.
//
// Degrades to null (renders nothing) while loading, on 401, or if the
// referral columns are missing — it can never break the success screen.
import { useEffect, useState } from 'react'

interface ReferralData {
  code: string
  url: string
  rewardCredits: number
}

export default function ReferralMiniCard() {
  const [referral, setReferral] = useState<ReferralData | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/referral')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && d.code && d.url) setReferral(d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!referral) return null

  function copyLink() {
    if (!referral?.url) return
    try {
      navigator.clipboard.writeText(referral.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard may be blocked — ignore */
    }
  }

  return (
    <div
      className="rounded-2xl px-5 py-4 mt-6 w-full"
      style={{
        maxWidth: 480,
        background: '#161618',
        border: '1px solid #2a2a2d',
      }}
    >
      <div className="flex items-center gap-3">
        <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>🎁</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="text-sm font-black" style={{ color: '#f5f5f7', lineHeight: 1.35 }}>
            Give {referral.rewardCredits}, get {referral.rewardCredits}
          </div>
          <div className="text-xs mt-0.5" style={{ color: '#86868b', lineHeight: 1.4 }}>
            Share your link — you both get{' '}
            <span style={{ color: '#2997ff', fontWeight: 700 }}>
              {referral.rewardCredits} free credits
            </span>{' '}
            when a friend makes their first video.
          </div>
        </div>
        <button
          type="button"
          onClick={copyLink}
          className="shrink-0 rounded-lg px-4 py-2 text-xs font-extrabold"
          style={{
            background: copied ? '#2997ff' : '#f5f5f7',
            color: copied ? '#fff' : '#000',
            border: 'none',
            borderRadius: 980,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {copied ? '✓ Copied!' : 'Copy invite link'}
        </button>
      </div>
    </div>
  )
}
