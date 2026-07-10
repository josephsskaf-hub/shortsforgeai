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
// the existing checkout endpoints.
//
// KINEO-REBASE-2026-07-10 — EXIT-INTENT v2 "ESCADA": the single $4.90 rescue
// is now a two-step ladder shown side by side —
//   left:  $4.90 one-time · 25 Shorts (same ?pack=starter checkout as before)
//   right: $9.90/mo Starter (HIGHLIGHTED, "BEST VALUE") — 25 credits every
//          month + no watermark + cancel anytime (?tier=starter, the same
//          GET checkout PricingCards uses)
// The FOUNDING50 secondary CTA is retired (the Starter card replaces it).
// New event: exit_intent_starter_monthly_clicked. Everything else (arm delay,
// once-per-session, desktop/mobile triggers, a11y) is unchanged.
//
// KINEO-REBASE-2026-07-10 — countdown hook: when the modal is SHOWN we write
// `kineo_exit_seen_at` (localStorage). If the visitor doesn't convert, the
// $2.90/24h countdown offer (Offer290Banner) uses that timestamp to arm
// itself on their next visits inside the 24h window. Converters end up
// has_paid=true, which the banner already filters out server-side.

import React, { useCallback, useEffect, useRef, useState } from 'react'

const SESSION_KEY = 'kineo_exit_offer_shown'
// KINEO-REBASE-2026-07-10 — read by Offer290Banner (post-exit $2.90 countdown).
const EXIT_SEEN_KEY = 'kineo_exit_seen_at'
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
  const [buying, setBuying] = useState<'pack' | 'starter' | null>(null)
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
    // KINEO-REBASE-2026-07-10 — arm the post-exit $2.90 countdown
    // (Offer290Banner). Written at show time; converters become has_paid
    // and the banner filters them out server-side.
    try {
      if (!localStorage.getItem(EXIT_SEEN_KEY)) {
        localStorage.setItem(EXIT_SEEN_KEY, String(Date.now()))
      }
    } catch {
      // ignore — countdown just won't arm on this device
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

  // Left CTA — EXACT same flow as the featured Starter Pack button on
  // /pricing: same event name, same GET checkout endpoint (server-side 302
  // to Stripe; no fetch so iOS Safari keeps the user-gesture chain).
  function handleStarterPack() {
    if (buying) return
    setBuying('pack')
    trackEvent('starter_pack_checkout_clicked')
    trackEvent('exit_intent_starter_pack_clicked')
    window.location.href = '/api/stripe/checkout?pack=starter'
  }

  // Right CTA (KINEO-REBASE-2026-07-10) — the Starter SUBSCRIPTION, reusing
  // the exact GET checkout PricingCards/handleBuy uses (?tier=starter). Same
  // abandon-recovery event family (starter_checkout_clicked) + the new
  // exit-intent-specific event.
  function handleStarterMonthly() {
    if (buying) return
    setBuying('starter')
    trackEvent('starter_checkout_clicked')
    trackEvent('exit_intent_starter_monthly_clicked')
    window.location.href = '/api/stripe/checkout?tier=starter'
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
        className="relative w-full max-w-lg rounded-2xl p-7 text-center outline-none"
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

        <h2 id="exit-offer-title" className="text-2xl font-black text-[#f5f5f7] mb-2 text-balance">
          Wait — pick your <span style={{ color: '#2997ff' }}>deal</span> before you go
        </h2>
        <p id="exit-offer-desc" className="text-[13.5px] text-[#86868b] mb-5 leading-relaxed">
          Try it once, or get fresh credits every month. Both take one click.
        </p>

        {/* KINEO-REBASE-2026-07-10 — the v2 ladder: one-time pack (left) vs
            Starter subscription (right, highlighted BEST VALUE). */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-left">
          {/* Left — $4.90 one-time pack (existing ?pack=starter checkout) */}
          <div
            className="rounded-xl p-4 flex flex-col"
            style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.14)',
            }}
          >
            <span className="text-[10px] font-black uppercase tracking-[.12em] text-[#86868b] mb-1.5">
              One-time · no subscription
            </span>
            <span className="text-xl font-black text-[#f5f5f7]">
              $4.90 <span className="text-[12px] font-bold text-[#86868b]">once</span>
            </span>
            <span className="text-[12.5px] text-[#a1a1a6] mt-1 mb-3 leading-relaxed">
              25 Shorts · credits never expire
            </span>
            <button
              type="button"
              onClick={handleStarterPack}
              disabled={buying !== null}
              className="mt-auto w-full rounded-lg py-2.5 text-[13.5px] font-extrabold text-[#f5f5f7] transition hover:bg-white/[.10] disabled:opacity-60"
              style={{
                background: 'rgba(255,255,255,.08)',
                border: '1px solid rgba(255,255,255,.18)',
                minHeight: 44,
                cursor: 'pointer',
              }}
            >
              {buying === 'pack' ? 'Loading…' : 'Get 25 Shorts →'}
            </button>
          </div>

          {/* Right — Starter $9.90/mo (HIGHLIGHTED, best value) */}
          <div
            className="relative rounded-xl p-4 flex flex-col"
            style={{
              background: 'rgba(41,151,255,.08)',
              border: '1.5px solid #2997ff',
              boxShadow: '0 0 26px rgba(41,151,255,.22)',
            }}
          >
            <span
              className="absolute -top-2.5 right-3 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[.12em]"
              style={{ background: '#2997ff', color: '#fff' }}
            >
              Best value
            </span>
            <span className="text-[10px] font-black uppercase tracking-[.12em] mb-1.5" style={{ color: '#7cc0ff' }}>
              Starter plan
            </span>
            <span className="text-xl font-black text-[#f5f5f7]">
              $9.90 <span className="text-[12px] font-bold text-[#86868b]">/mo</span>
            </span>
            <span className="text-[12.5px] text-[#cfe7ff] mt-1 mb-3 leading-relaxed">
              25 credits every month + no watermark + cancel anytime
            </span>
            <button
              type="button"
              onClick={handleStarterMonthly}
              disabled={buying !== null}
              className="mt-auto w-full rounded-lg py-2.5 text-[13.5px] font-extrabold text-white transition disabled:opacity-60"
              style={{
                background: '#2997ff',
                boxShadow: '0 8px 24px rgba(41,151,255,.4)',
                minHeight: 44,
                cursor: 'pointer',
              }}
            >
              {buying === 'starter' ? 'Loading…' : 'Start for $9.90/mo →'}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-[#6e6e73]">
          7-day money-back guarantee · cancel anytime
        </p>
      </div>
    </div>
  )
}
