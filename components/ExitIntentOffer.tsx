'use client'

// Conversion — Exit-intent rescue modal for /pricing (59 abandoned
// checkouts/30d). Replaces the old inline "Don't leave yet!" modal with a
// low-commitment Starter Pack offer ($4.90 one-time / 10 Shorts) — the same
// checkout the featured entry-offer button already uses
// (/api/stripe/checkout?pack=starter, event starter_pack_checkout_clicked).
//
// Calibrated from 2025/26 exit-intent research (Wisepops / CrazyEgg /
// Popupsmart benchmarks):
//  - Never fire instantly: triggers arm only after 5s of engagement.
//  - Once per SESSION (sessionStorage) — repeat popups tank UX.
//  - Desktop: mouseleave through the top of the viewport.
//  - Mobile (coarse pointer): 25s inactivity OR fast scroll-up after the
//    user has scrolled down (classic mouse exit-intent is unreliable there).
//  - Don't show when the visitor is already subscribed (?already_subscribed=1)
//    or already carries a ?promo= code (they already got a rescue offer).
//  - Copy: short gain-framed headline, 2–5 word CTA, honest guarantee line.
//  - a11y: role=dialog, aria-modal, Escape closes, focus moves into the
//    dialog, close targets ≥44px.
//
// UI-only component: no payment/credit logic lives here — it navigates to
// the existing checkout endpoint and reuses the existing ?promo= forwarding
// (#453) for FOUNDING50.

import React, { useCallback, useEffect, useRef, useState } from 'react'

const SESSION_KEY = 'kineo_exit_offer_shown'
const ARM_DELAY_MS = 5000 // engagement gate before any trigger is live
const MOBILE_IDLE_MS = 25000 // mobile: show after 25s of inactivity
const MOBILE_MIN_DEPTH_PX = 400 // mobile: only consider scroll-up after real scroll depth
const MOBILE_SCROLLUP_PX = 350 // mobile: accumulated fast upward scroll that counts as exit

// Same fire-and-forget event beacon pattern the pricing page uses.
function trackEvent(name: string): void {
  try {
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_name: name,
        name,
        path: typeof window !== 'undefined' ? window.location?.pathname : undefined,
      }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // ignore — analytics must never break UI
  }
}

export default function ExitIntentOffer() {
  const [open, setOpen] = useState(false)
  const [promoApplied, setPromoApplied] = useState(false)
  const [buying, setBuying] = useState(false)
  const shownRef = useRef(false)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  const show = useCallback(() => {
    if (shownRef.current) return
    shownRef.current = true
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      // sessionStorage unavailable (private mode) — still show once via ref
    }
    trackEvent('exit_intent_shown')
    setOpen(true)
  }, [])

  // Trigger wiring — armed 5s after mount, desktop vs mobile strategies.
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Once per session.
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') return
    } catch {
      // ignore and fall through — shownRef still guards repeats this mount
    }

    // When NOT to show: active subscriber banner, or a promo code already
    // in the URL (win-back email traffic already has its offer).
    const params = new URLSearchParams(window.location.search)
    if (params.get('already_subscribed') === '1') return
    if (params.get('promo')) return

    const isTouch =
      (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) ||
      'ontouchstart' in window

    const cleanups: Array<() => void> = []

    const armTimer = window.setTimeout(() => {
      if (!isTouch) {
        // Desktop: cursor exits through the top of the viewport.
        const onMouseLeave = (e: MouseEvent) => {
          if (e.clientY <= 0) show()
        }
        document.addEventListener('mouseleave', onMouseLeave)
        cleanups.push(() => document.removeEventListener('mouseleave', onMouseLeave))
      } else {
        // Mobile 1: inactivity timer (reset on any interaction).
        let idleTimer = window.setTimeout(show, MOBILE_IDLE_MS)
        const resetIdle = () => {
          window.clearTimeout(idleTimer)
          idleTimer = window.setTimeout(show, MOBILE_IDLE_MS)
        }
        const idleEvents: Array<keyof WindowEventMap> = ['touchstart', 'touchmove', 'scroll', 'keydown']
        idleEvents.forEach((ev) => window.addEventListener(ev, resetIdle, { passive: true }))

        // Mobile 2: fast scroll-up after meaningful scroll depth.
        let lastY = window.scrollY
        let lastT = Date.now()
        let maxY = window.scrollY
        let upAccum = 0
        const onScroll = () => {
          const y = window.scrollY
          const now = Date.now()
          if (y > maxY) maxY = y
          const dy = lastY - y // positive = scrolling up
          if (dy > 0) {
            if (now - lastT > 400) upAccum = 0 // stale burst — restart
            upAccum += dy
            if (maxY > MOBILE_MIN_DEPTH_PX && upAccum > MOBILE_SCROLLUP_PX) show()
          } else {
            upAccum = 0
          }
          lastY = y
          lastT = now
        }
        window.addEventListener('scroll', onScroll, { passive: true })

        cleanups.push(() => {
          window.clearTimeout(idleTimer)
          idleEvents.forEach((ev) => window.removeEventListener(ev, resetIdle))
          window.removeEventListener('scroll', onScroll)
        })
      }
    }, ARM_DELAY_MS)
    cleanups.push(() => window.clearTimeout(armTimer))

    return () => cleanups.forEach((fn) => fn())
  }, [show])

  // Escape closes + move focus into the dialog when it opens.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    dialogRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // Primary CTA — EXACT same flow as the featured Starter Pack button on
  // /pricing: same event name, same GET checkout endpoint (server-side 302
  // to Stripe; no fetch so iOS Safari keeps the user-gesture chain).
  function handleStarterPack() {
    if (buying) return
    setBuying(true)
    trackEvent('starter_pack_checkout_clicked')
    trackEvent('exit_intent_starter_pack_clicked')
    window.location.href = '/api/stripe/checkout?pack=starter'
  }

  // Secondary CTA — reuse the existing #453 promo forwarding: put
  // ?promo=FOUNDING50 in the URL so handleBuy() on the page auto-applies it
  // at checkout when any plan is clicked. No duplicated checkout logic.
  function handleFounding50() {
    trackEvent('exit_intent_founding50_applied')
    try {
      const url = new URL(window.location.href)
      url.searchParams.set('promo', 'FOUNDING50')
      window.history.replaceState(null, '', url.toString())
    } catch {
      // ignore — worst case the user types the code at checkout
    }
    setPromoApplied(true)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
      onClick={() => setOpen(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-offer-title"
        aria-describedby="exit-offer-desc"
        tabIndex={-1}
        className="relative w-full max-w-md rounded-2xl p-7 text-center outline-none"
        style={{
          background: '#161618',
          border: '1px solid rgba(41,151,255,.35)',
          boxShadow: '0 0 60px rgba(41,151,255,.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close offer"
          className="absolute top-2 right-2 flex items-center justify-center rounded-lg text-[#86868b] hover:text-white hover:bg-white/[.06] transition"
          style={{ width: 44, height: 44, fontSize: 20, fontWeight: 700, lineHeight: 1 }}
        >
          ×
        </button>

        <span
          className="mb-3 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[.12em]"
          style={{
            background: 'rgba(41,151,255,0.14)',
            border: '1px solid rgba(41,151,255,0.4)',
            color: '#2997ff',
          }}
        >
          ⚡ One-time · no subscription
        </span>

        <h2 id="exit-offer-title" className="text-2xl font-black text-[#f5f5f7] mb-2 text-balance">
          Wait — get 25 Shorts for <span style={{ color: '#2997ff' }}>$4.90</span>
        </h2>
        <p id="exit-offer-desc" className="text-[13.5px] text-[#86868b] mb-5 leading-relaxed">
          One payment, 25 finished AI Shorts. Credits never expire — try the engine before any monthly plan.
        </p>

        <button
          type="button"
          onClick={handleStarterPack}
          disabled={buying}
          className="w-full rounded-xl py-3.5 text-[15px] font-extrabold text-white mb-3 transition disabled:opacity-60"
          style={{
            background: '#2997ff',
            boxShadow: '0 8px 24px rgba(41,151,255,.4)',
            minHeight: 48,
            cursor: 'pointer',
          }}
        >
          {buying ? 'Loading…' : 'Get 25 Shorts — $4.90 →'}
        </button>

        {promoApplied ? (
          <p
            className="w-full rounded-xl py-3 text-[13px] font-bold mb-3"
            style={{
              background: 'rgba(34,197,94,.08)',
              border: '1px solid rgba(34,197,94,.35)',
              color: '#22C55E',
            }}
          >
            ✓ FOUNDING50 armed — pick any plan below and 50% off your first month applies at checkout.
          </p>
        ) : (
          <button
            type="button"
            onClick={handleFounding50}
            className="w-full rounded-xl py-3 text-[13.5px] font-extrabold text-[#f5f5f7] mb-3 transition hover:bg-white/[.09]"
            style={{
              background: 'rgba(255,255,255,.06)',
              border: '1px solid rgba(255,255,255,.12)',
              minHeight: 48,
              cursor: 'pointer',
            }}
          >
            Prefer a plan? Code <span style={{ color: '#2997ff' }}>FOUNDING50</span> = 50% off first month
          </button>
        )}

        <p className="text-[11px] text-[#6e6e73]">
          7-day money-back guarantee · credits never expire
        </p>
      </div>
    </div>
  )
}
