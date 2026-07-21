'use client'

// Push #444 — Referral card surfaced on a real, reachable page (/referral).
// The same card markup previously lived inside DashboardClient.tsx, but that
// page redirects to /generate and never renders. This component ports that
// card so the invite UI finally shows up. The attribute/qualify side-effects
// are handled globally by <ReferralAutoTrigger/> in the dashboard layout, so
// this component is read-only: it fetches the share data and renders the card.
import { useEffect, useState } from 'react'

interface ReferralData {
  code: string
  count: number
  url: string
  rewardCredits: number
}

export default function ReferralCard() {
  const [referral, setReferral] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refCopied, setRefCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/referral')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && d.code) setReferral(d)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function copyReferral() {
    if (!referral?.url) return
    try {
      navigator.clipboard.writeText(referral.url)
      setRefCopied(true)
      setTimeout(() => setRefCopied(false), 2000)
    } catch {
      /* clipboard may be blocked — ignore */
    }
  }

  // Loading skeleton — matches the dashboard card height/shape.
  if (loading) {
    return (
      <div
        className="rounded-[20px] px-5 py-4 mb-5"
        style={{
          background: '#161618',
          border: '1px solid #2a2a2d',
          boxShadow: 'none',
          height: 168,
          animation: 'pulse 1.4s ease-in-out infinite',
        }}
      />
    )
  }

  // No code (401 / missing column / empty) — soft fallback, never crash.
  if (!referral) {
    return (
      <div
        className="rounded-[20px] px-5 py-4 mb-5"
        style={{
          background: '#161618',
          border: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
            style={{
              background: '#1d1d1f',
              border: '1px solid #2a2a2d',
            }}
          >
            🎁
          </div>
          <div className="text-sm" style={{ color: 'var(--muted2)' }}>
            Sign in to get your invite link and start earning free credits.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-[20px] px-5 py-4 mb-5"
      style={{
        background: '#161618',
        border: '1px solid #2a2a2d',
        boxShadow: 'none',
      }}
    >
      <div className="flex items-center gap-4 mb-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
          style={{
            background: '#1d1d1f',
            border: '1px solid #2a2a2d',
          }}
        >
          🎁
        </div>
        <div>
          <div
            className="text-xs font-black uppercase tracking-widest mb-0.5"
            style={{ color: 'var(--muted)', fontSize: '0.6rem' }}
          >
            Invite Friends &amp; Earn
          </div>
          <div className="font-black" style={{ fontSize: '1rem', color: 'var(--text)' }}>
            🎁 Invite friends — you both get{' '}
            <span style={{ color: 'var(--blue, #2997ff)' }}>{referral.rewardCredits} free credits</span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            You and your friend each get {referral.rewardCredits} free credits when they create their
            first video. Your account earns this reward on up to 20 qualifying referrals.
          </div>
        </div>
      </div>

      {/* Share URL + copy */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <input
          readOnly
          value={referral.url}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 rounded-xl px-3 py-2.5 text-xs"
          style={{
            background: '#161618',
            border: '1px solid #2a2a2d',
            color: 'var(--text)',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={copyReferral}
          className="rounded-xl px-5 py-2.5 text-sm font-black"
          style={{
            background: '#f5f5f7',
            color: '#000',
            boxShadow: 'none',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            border: 'none',
          }}
        >
          {refCopied ? '✓ Copied!' : 'Copy link'}
        </button>
      </div>

      {/* Earned stats */}
      <div className="text-xs font-bold" style={{ color: 'var(--muted2)' }}>
        🎉 <span style={{ color: 'var(--blue, #2997ff)' }}>{referral.count}</span> friend
        {referral.count === 1 ? '' : 's'} joined
        {' · '}
        <span style={{ color: 'var(--blue, #2997ff)' }}>{referral.count * referral.rewardCredits}</span> credits
        earned
      </div>
    </div>
  )
}
