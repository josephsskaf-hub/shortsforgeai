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
//   left:  $4.90 one-time · 10 videos (same ?pack=starter checkout as before)
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
  // KINEO-SPRINT-OFFER-2026-07-14 — 'pack' removed from the union with the
  // one-time escape-hatch link (single-offer cleanup: the modal now sells
  // exactly two things — intro Starter and intro Creator, both recurring).
  const [buying, setBuying] = useState<'starter' | 'creator' | null>(null)
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

  // KINEO-INTRO-MONTH-2026-07-13 — EXIT-INTENT v3 "RECORRÊNCIA": os dois
  // cards agora são ASSINATURAS com 1º mês de entrada ($4.90 Starter /
  // $9.90 Creator). Mesma mecânica GET (302 servidor, gesture-chain do
  // iOS preservada).
  // KINEO-SPRINT-OFFER-2026-07-14 — o link discreto do pack one-time
  // ("prefer no subscription? 10 videos for $4.90 once") foi REMOVIDO:
  // era a 3ª oferta no mesmo modal e reabria o beco sem saída one-time.
  // O endpoint ?pack=starter segue vivo só para o fluxo return=wm.
  function handleIntroStarter() {
    if (buying) return
    setBuying('starter')
    trackEvent('starter_checkout_clicked')
    trackEvent('exit_intent_intro_starter_clicked')
    window.location.href = '/api/stripe/checkout?tier=starter&intro=1'
  }

  function handleIntroCreator() {
    if (buying) return
    setBuying('creator')
    trackEvent('basic_checkout_clicked')
    trackEvent('exit_intent_intro_creator_clicked')
    window.location.href = '/api/stripe/checkout?tier=basic&intro=1'
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
        {/* KINEO-SPRINT-OFFER-2026-07-14 — copy no longer implies a one-time
            option ("try it once" was the pack); both cards are subscriptions. */}
        <p id="exit-offer-desc" className="text-[13.5px] text-[#86868b] mb-5 leading-relaxed">
          Half-price first month, fresh credits every month. One click.
        </p>

        {/* KINEO-INTRO-MONTH-2026-07-13 — v3 ladder: intro Starter (left) vs
            intro Creator (right, highlighted). Ambos assinaturas → MRR. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-left">
          {/* Left — Starter: first month $4.90, then $9.90/mo */}
          <div
            className="rounded-xl p-4 flex flex-col"
            style={{
              background: 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.14)',
            }}
          >
            <span className="text-[10px] font-black uppercase tracking-[.12em] text-[#86868b] mb-1.5">
              Starter · 25 credits/mo
            </span>
            <span className="text-xl font-black text-[#f5f5f7]">
              $4.90 <span className="text-[12px] font-bold text-[#86868b]">first month</span>
            </span>
            <span className="text-[12.5px] text-[#a1a1a6] mt-1 mb-3 leading-relaxed">
              then $9.90/mo · no watermark · cancel anytime
            </span>
            <button
              type="button"
              onClick={handleIntroStarter}
              disabled={buying !== null}
              className="mt-auto w-full rounded-lg py-2.5 text-[13.5px] font-extrabold text-[#f5f5f7] transition hover:bg-white/[.10] disabled:opacity-60"
              style={{
                background: 'rgba(255,255,255,.08)',
                border: '1px solid rgba(255,255,255,.18)',
                minHeight: 44,
                cursor: 'pointer',
              }}
            >
              {buying === 'starter' ? 'Loading…' : 'Start for $4.90 →'}
            </button>
          </div>

          {/* Right — Creator: first month $9.90, then $24.90/mo (HIGHLIGHTED) */}
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
              Creator · 150 credits/mo
            </span>
            <span className="text-xl font-black text-[#f5f5f7]">
              $9.90 <span className="text-[12px] font-bold text-[#86868b]">first month</span>
            </span>
            <span className="text-[12.5px] text-[#cfe7ff] mt-1 mb-3 leading-relaxed">
              then $24.90/mo · 1 Hollywood film included · AI Presenter
            </span>
            <button
              type="button"
              onClick={handleIntroCreator}
              disabled={buying !== null}
              className="mt-auto w-full rounded-lg py-2.5 text-[13.5px] font-extrabold text-white transition disabled:opacity-60"
              style={{
                background: '#2997ff',
                boxShadow: '0 8px 24px rgba(41,151,255,.4)',
                minHeight: 44,
                cursor: 'pointer',
              }}
            >
              {buying === 'creator' ? 'Loading…' : 'Start for $9.90 →'}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-[#6e6e73]">
          7-day money-back guarantee · cancel anytime · renews at the full monthly price after month 1
        </p>
      </div>
    </div>
  )
}
