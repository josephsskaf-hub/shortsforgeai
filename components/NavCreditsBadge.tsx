'use client'

// Nav credits badge for the public Kineo landing (app/KineoLanding.tsx).
// Mirrors the dashboard TopBar's CreditsBadge (components/TopBar.tsx) so
// logged-in visitors see their real balance next to "Open app" instead of
// the button just sitting there with no account context. Only rendered
// when initialUser is present (KineoLanding decides that), but it does its
// own client-side fetch/realtime so the number stays live after signup,
// purchases, or generations elsewhere in the app.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function NavCreditsBadge() {
  const [credits, setCredits] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchCredits() {
      try {
        const res = await fetch('/api/credits', { cache: 'no-store' })
        if (res.status === 401) {
          if (!cancelled) setCredits(null)
          return
        }
        const data = await res.json()
        if (!cancelled) {
          // Bug fix 30/06: /api/credits responds with the field `credits`
          // (see app/api/credits/route.ts), not `video_credits` (that's the
          // underlying Postgres column name) — this badge was always
          // falling through to 0 regardless of the real balance. TopBar's
          // CreditsBadge already reads `data.credits` correctly; matched here.
          setCredits(typeof data.credits === 'number' ? data.credits : 0)
        }
      } catch {
        if (!cancelled) setCredits(null)
      }
    }
    fetchCredits()
    window.addEventListener('creditsChanged', fetchCredits)
    return () => {
      cancelled = true
      window.removeEventListener('creditsChanged', fetchCredits)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return
      channel = supabase
        .channel('credits-realtime-nav')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
          (payload) => {
            const row = payload.new as { video_credits?: number }
            if (typeof row.video_credits === 'number') setCredits(row.video_credits)
          },
        )
        .subscribe()
    })
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  if (credits === null) return null

  const isZero = credits <= 0

  return (
    <Link
      href={isZero ? '/pricing' : '/generate'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 13,
        fontWeight: 600,
        padding: '8px 14px',
        borderRadius: 980,
        border: `1px solid ${isZero ? 'rgba(248,113,113,.35)' : 'rgba(41,151,255,.3)'}`,
        background: isZero ? 'rgba(248,113,113,.1)' : 'rgba(41,151,255,.1)',
        color: isZero ? '#f87171' : '#2997ff',
        whiteSpace: 'nowrap',
      }}
    >
      ⚡ {credits} credit{credits === 1 ? '' : 's'}
    </Link>
  )
}
