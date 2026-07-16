'use client'

// Push #076 — Standalone /pricing page (real route, not just an anchor).
// Mirrors the Cyber Blue theme used by HomePageClient.
//
// Push #097 — added launch-offer banner with live countdown, a "Most
// Popular" badge on Basic, and a cancel/instant-access/money-back trust
// row directly under the plan cards. The countdown is a UX/urgency
// device; the underlying Stripe discount is the open 50%-off-first-month
// launch offer.

import Link from 'next/link'
import React, { useEffect, useRef, useState } from 'react'
import { trackCheckoutClick } from '@/lib/trackClick'
import { trackEvent } from '@/lib/analytics'
import ExitIntentOffer from '@/components/ExitIntentOffer'

// PAYPAL-DISABLED-2026-07-06 — PayPal checkout is hidden on pricing until it's
// verified working end-to-end (business account still needs verification). All
// "pay with PayPal" buttons are gated behind this flag. Flip to `true` to
// re-enable everywhere at once. Stripe checkout is unaffected.
const PAYPAL_ENABLED = false

// Push #099 — FAQ entries shown below the pricing comparison table. Pure
// content array so the accordion renders from one source of truth.
const FAQS: { q: string; a: string }[] = [
  {
    // KINEO-FAQ-NOCARD-2026-07-13 — a resposta antiga ("Yes, a card is
    // required... charged immediately") CONTRADIZIA a oferta de previews sem
    // cartão três telas acima. Conversion-killer clássico: o FAQ
    // é onde o indeciso vai tirar a última dúvida antes de clicar.
    // KINEO-SPRINT-OFFER-2026-07-14 — dropped the "$4.90 one-time pack"
    // mention: the pack has no public CTA anymore (single-offer cleanup),
    // so naming it here would advertise a product the page doesn't sell.
    q: 'Do I need a credit card to start?',
    a: 'No. A new free account can create, watch, download and share up to 3 Fast videos with a watermark every 24 hours, with no card. Free access grants no credits and no premium AI Generated videos. Subscribe only when you want a clean, watermark-free MP4: Starter is $4.90 for the first month then $9.90/month, Creator is $9.90 for the first month then $24.90/month, and Studio is $37.90/month.',
  },
  {
    q: 'How fast are videos generated?',
    a: 'Each AI video renders in about 3–5 minutes. We use AI to write, voice, and edit everything automatically.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes, cancel from your account settings at any time. No contracts, no commitments.',
  },
  {
    q: 'Is there a money-back guarantee?',
    a: 'Yes — Starter, Creator, and Studio come with a 7-day money-back guarantee. If you\'re not satisfied, email us within 7 days of your purchase and we\'ll refund 100%. No questions asked.',
  },
  {
    q: 'What happens if a video fails to generate?',
    a: 'Your credits are refunded automatically, the moment the render fails — no support ticket needed. You only ever pay for videos you actually receive.',
  },
  {
    q: 'What’s the difference between AI Generated and Cinematic AI?',
    // KINEO-REBASE-2026-07-10 — 2:1 rebase (Seedance 20, Kling 45) + universal
    // engines: every engine is on every paid plan now (no Studio exclusivity).
    a: 'AI Generated uses the Seedance engine (great quality, 20 credits/video). Cinematic AI uses the premium Kling engine for top-tier cinematic motion (50 credits/video). Every paid plan can access every engine once its balance covers the full cost; you can add extra credits when needed. Fast Mode uses smart stock footage.',
  },
  {
    q: 'How do credits work?',
    // KINEO-PRICING-V3B-2026-07-10 — Creator 150 credits, Kling 50 credits.
    a: 'An AI Generated video (Seedance) uses 20 credits. A Cinematic AI video (Kling) uses 50 credits. A Hollywood film uses 150 credits. Starter includes 25 credits/month; Creator includes 150 credits/month (a Hollywood film every month, included); Studio includes 200 credits/month. Credits reset each month (no rollover).',
  },
]

// Push #267 — removed Free card. Pricing page now shows only paid plans.
// Free tier still exists for new signups via /signup, but is not shown here
// to avoid users exploiting the $0 entry point.
// Push #339 — added Starter plan at $2.90/mo (15 credits).
function buildPricing() {
  // Push #404 — 3 plans: Starter (Fast) · Creator (Seedance, popular) · Studio (Kling).
  return [
    {
      tier: 'starter',
      name: 'Starter',
      price: '$9.90',
      priceSub: '/ month',
      // KINEO-REBASE-2026-07-10 — 50 → 25 credits (2:1 rebase, USD unchanged).
      // KINEO-SHOWCASE-2026-07-10 — V3C wording: Fast = 1 credit per video for
      // paid accounts (25 credits ≈ 25 Fast videos), engines universal.
      tagline: '25 credits/month — up to 25 Fast videos, or 1 AI Generated video (20 cr). Kling and AI Presenter require extra credits.',
      features: [
        '⚡ 25 credits/month (Fast videos = 1 credit)',
        'Smart stock footage matched per scene',
        'AI writes script + voiceover',
        'Auto-captions pipeline',
        'Download watermark-free MP4',
        'My Videos history',
      ],
      cta: { label: 'Get Started', href: '#checkout' },
    },
    {
      tier: 'basic',
      name: 'Creator',
      price: '$24.90',
      priceSub: '/ month',
      // KINEO-PRICING-V3B-2026-07-10 — $24.90/150cr: 1 Hollywood film every
      // month included (150 cr), or ~7 AI-generated videos (20 cr each).
      tagline: '150 credits/month — 1 Hollywood film every month included, or ~7 AI-generated videos.',
      features: [
        '🎬 1 Hollywood film every month — included',
        '✨ Or 150 credits/mo → ~7 AI-generated videos (Seedance)',
        // KINEO-SHOWCASE-2026-07-10 — new avatar suite surfaced.
        '🗣️ AI Presenter — talking avatars with perfect lip-sync (70 cr)',
        '🎭 Character Lock + transparent gesture clips + UGC product ads',
        'Every scene generated by AI',
        'AI writes script + voiceover',
        'Download watermark-free MP4',
        'My Videos history',
      ],
      cta: { label: 'Get Started', href: '#checkout' },
      highlight: true,
      popular: true,
    },
    {
      tier: 'pro',
      name: 'Studio',
      price: '$37.90',
      priceSub: '/ month',
      // KINEO-STUDIO-400-2026-07-06 — Studio's extra value: more credits, Kling
      // at 1080p, priority render queue, and premium voices.
      // KINEO-REBASE-2026-07-10 — 400 → 200 credits (2:1 rebase, USD unchanged);
      // engines are UNIVERSAL now (no "Studio only" lock — any paid plan).
      tagline: 'Cinematic quality — our best AI engine. 200 credits/month (vs Creator\'s 150) + the cinematic Kling engine at 1080p, priority render queue — about 4 premium videos, or up to 10 with Seedance.',
      features: [
        '🎬 ~4 cinematic AI videos/mo (Kling at 1080p)',
        '33% more credits than Creator (200 vs 150/mo)',
        '➕ Or stretch credits to ~10 Seedance videos/mo',
        // KINEO-SHOWCASE-2026-07-10 — new avatar suite surfaced.
        '🗣️ AI Presenter + Character Lock + gesture clips + UGC ads',
        '⚡ Priority render queue + premium voices',
        'Highest visual quality + motion',
        'Download watermark-free MP4',
        'My Videos history',
      ],
      cta: { label: 'Get Started', href: '#checkout' },
    },
  ]
}

function trackPricingEvent(name: string): void {
  void trackEvent(name)
}

export default function PricingPage() {

  // Push #099 — open FAQ index for the accordion (null = all collapsed). First
  // question is open by default so the section reads as scannable, not empty.
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  // Push #114 — CTA state. `purchasing` is the tier whose button shows
  // "Loading…" while the API call is in flight; `checkoutError` surfaces
  // any server-returned error below the cards.
  const [purchasing, setPurchasing] = useState<'starter' | 'basic' | 'pro' | null>(null)
  // KINEO-CHECKOUT-IDEMPOTENCY-2026-07-15 — state alone is not a synchronous
  // click lock: a fast double-click can run the handler twice before React
  // paints the disabled button. Keep an immediate ref guard as the client-side
  // half of the server idempotency protection.
  const checkoutNavigationLockedRef = useRef(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  // Push #171 — show a friendly "already subscribed" info banner instead of
  // silently redirecting to /generate when the API blocks a duplicate purchase.
  const [alreadySubscribed, setAlreadySubscribed] = useState(false)

  // Browsers may restore this page from the back-forward cache after the user
  // leaves Stripe. React state and refs are restored too, so release the click
  // lock on pageshow or every plan button can remain disabled forever.
  useEffect(() => {
    const releaseCheckoutLock = () => {
      checkoutNavigationLockedRef.current = false
      setPurchasing(null)
    }
    window.addEventListener('pageshow', releaseCheckoutLock)
    return () => window.removeEventListener('pageshow', releaseCheckoutLock)
  }, [])
  // KINEO-SPRINT-OFFER-2026-07-14 — ROI slider state removed with the widget
  // (unverifiable "estimated views/month" promise — see note at the old block).
  // Push #117 — sticky mobile CTA bar shows after 300px scroll so phone
  // users always have the "Basic / Pro" choice in reach without
  // scrolling back up to the cards.
  const [showStickyCta, setShowStickyCta] = useState<boolean>(false)

  // #381 — monthly vs annual billing toggle. Annual ≈ 2 months free.
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const ANNUAL: Record<string, { total: string; perMonth: string }> = {
    starter: { total: '$99', perMonth: '$8.25' },
    basic: { total: '$199', perMonth: '$16.58' },
    pro: { total: '$379', perMonth: '$31.58' },
  }

  // Conversion — exit-intent modal extracted to <ExitIntentOffer />
  // (components/ExitIntentOffer.tsx): Starter Pack rescue offer, once per
  // session, desktop mouseleave + mobile inactivity/scroll-up triggers.

  // KINEO-PRICING-VIEW-2026-07-15 — admin/funnel and admin/metrics already
  // query this event; the pricing page simply never emitted it before.
  useEffect(() => {
    trackPricingEvent('pricing_view')
  }, [])

  // Push #173 — iOS Safari blocks window.location.href inside async/await
  // (user gesture chain is severed after the first await). Fix: navigate
  // directly to the GET checkout endpoint which does a server-side 302
  // redirect to Stripe. No fetch(), no await, no gesture breakage.
  function handleBuy(tier: 'starter' | 'basic' | 'pro') {
    if (checkoutNavigationLockedRef.current) return
    checkoutNavigationLockedRef.current = true
    setPurchasing(tier)
    const eventName = tier === 'pro' ? 'pro_checkout_clicked' : tier === 'starter' ? 'starter_checkout_clicked' : 'basic_checkout_clicked'
    trackPricingEvent(eventName)
    trackCheckoutClick(tier as 'basic' | 'pro')
    // #457 — TikTok Pixel: InitiateCheckout = purchase intent (warmest retargeting audience)
    try {
      const ttq = (window as unknown as { ttq?: { track: Function } }).ttq
      if (ttq && typeof ttq.track === 'function') ttq.track('InitiateCheckout', { content_name: tier })
    } catch { /* non-blocking */ }
    const billingParam = billing === 'annual' ? '&billing=annual' : ''
    // #453 — forward a ?promo= code (e.g. /pricing?promo=FOUNDING50 from the
    // win-back emails) into checkout so the discount auto-applies on plan click.
    const promo = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('promo') : null
    const promoParam = promo ? `&promo=${encodeURIComponent(promo)}` : ''
    // KINEO-INTRO-MONTH-2026-07-13 — Starter/Creator monthly levam o 1º mês
    // com desconto ($4.90/$9.90). O servidor valida elegibilidade (1 por
    // cliente) e ignora o param em annual/pro — aqui só pedimos.
    const introParam = billing === 'monthly' && (tier === 'starter' || tier === 'basic') ? '&intro=1' : ''
    window.location.href = `/api/stripe/checkout?tier=${tier}${billingParam}${promoParam}${introParam}`
  }

  // Push #173 — read checkout_error / already_subscribed from URL params
  // set by the GET checkout handler when it can't create a Stripe session.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const err = params.get('checkout_error')
    if (err) setCheckoutError(decodeURIComponent(err))
    if (params.get('already_subscribed') === '1') setAlreadySubscribed(true)
  }, [])

  // Push #117 — show the sticky mobile CTA only after the user scrolls
  // past the hero. We pin the listener to passive so it never blocks
  // scroll on slower phones.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onScroll = () => {
      setShowStickyCta(window.scrollY > 300)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-[#000000] text-[#f5f5f7] font-sans">
      {/* Subtle cyber-blue glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed -top-[300px] -right-[200px] h-[800px] w-[800px] rounded-full opacity-[0.07]"
        style={{ background: '#2997ff', filter: 'blur(140px)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-[400px] -left-[200px] h-[700px] w-[700px] rounded-full opacity-[0.05]"
        style={{ background: '#2997ff', filter: 'blur(160px)' }}
      />

      {/* ───────── Top Nav (simple) ───────── */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#161618]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#161618] border border-[#2997ff]/40 text-lg shadow-[0_0_14px_rgba(41,151,255,.35)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="#2997ff" stroke="#2997ff" strokeWidth="0.5" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-extrabold tracking-tight text-white">
                Kineo
              </span>
            </div>
          </Link>

          <Link
            href="/"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-[#86868b] hover:text-[#f5f5f7] hover:bg-white/[.04] transition"
          >
            ← Back to Home
          </Link>
        </div>
      </nav>

      {/* ───────── Exit-intent modal (Starter Pack rescue offer) ───────── */}
      <ExitIntentOffer />

      {/* ───────── Pricing ───────── */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 pt-12 pb-16 sm:px-6 sm:pt-16">
        <div className="mb-10 text-center">
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#2997ff]">
            Pricing
          </div>
          <h1 className="text-balance text-4xl font-black tracking-tight sm:text-5xl text-[#f5f5f7]">
            Start for $4.90. Keep creating for $9.90/mo.
          </h1>
          {/* KINEO-SHOWCASE-2026-07-10 — Joseph: parágrafo comparativo removido
              ("texto sujo") — os CARDS de preço são a estrela do hero. */}

          {/* ROBO1-PRICE-2026-06-28 — honest trust row. Replaced the
              unverifiable "300+ Shorts created" + "4.8 / 5 average rating"
              with real, checkable signals: 3 watermarked Fast videos / 24h,
              cancel anytime, and the 7-day money-back guarantee. */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {[
              { icon: '🎬', label: '3 watermarked Fast videos / 24h — no card' },
              { icon: '↩️', label: 'Cancel anytime' },
              { icon: '🔒', label: '7-day money-back guarantee' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[#86868b]">
                <span>{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* KINEO-SPRINT-OFFER-2026-07-14 — ROI slider REMOVED. The
            "estimated N views/month" math and "any plan pays for itself
            with just 1 viral Short" were unverifiable promises (nobody can
            guarantee views) sitting right above the buy buttons — classic
            trust-killer for the skeptical buyer. The plan cards are the
            hero now; nothing stands between the headline and them. */}

        {/* Push #267 — Free banner removed with Free card */}

        {/* #381 — monthly / annual billing toggle */}
        <div className="mb-7 flex items-center justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              className={`rounded-full px-4 py-1.5 text-[13px] font-extrabold transition ${
                billing === 'monthly' ? 'bg-[#2997ff] text-white' : 'text-[#86868b] hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling('annual')}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-extrabold transition ${
                billing === 'annual' ? 'bg-[#2997ff] text-white' : 'text-[#86868b] hover:text-white'
              }`}
            >
              Annual
              <span className="rounded-full bg-[#2997ff]/20 px-2 py-0.5 text-[10px] font-black text-[#2997ff]">
                2 MONTHS FREE
              </span>
            </button>
          </div>
        </div>

        {/* KINEO-SPRINT-OFFER-2026-07-14 — SINGLE OFFER cleanup. Three stacked
            competing offers used to sit here (FOUNDING50 "50% for life" banner,
            the Starter-intro strip, and — pre-13/07 — the $4.90 one-time pack).
            A buyer arriving saw 3 different "deals" before the cards. Now the
            plan cards ARE the offer (intro badge lives on each card); the only
            thing above them is the honest free-video nudge. The one-time pack
            endpoint (?pack=starter) still exists for the watermark unlock flow —
            it just has no public CTA here. */}
        <div
          className="mx-auto mb-7 max-w-2xl rounded-2xl px-5 py-4 text-center"
          style={{ background: 'rgba(41,151,255,0.07)', border: '1px solid rgba(41,151,255,0.4)' }}
        >
          <p className="text-[12.5px] font-semibold text-[#86868b]">
            Not sure yet? <Link href="/signup" className="font-bold text-[#2997ff] hover:text-[#2997ff]">Create up to 3 Fast videos free every 24h</Link> — no card; download and share with a watermark.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3 max-w-5xl mx-auto">
          {buildPricing().map((p) => {
            const isPaid = p.tier === 'starter' || p.tier === 'basic' || p.tier === 'pro'
            // KINEO-2026-07-06 — cleaner pricing UI: same blue CTA on every card,
            // labeled with the plan name ("Choose Starter/Creator/Studio") so the
            // action is specific. The card displays; the button acts.
            const ctaLabel = `Choose ${p.name}`
            return (
              <div
                key={p.tier}
                className={`group relative flex flex-col rounded-2xl border p-6 transition-all duration-200 ${
                  p.highlight
                    ? 'border-[#2997ff] bg-[#161618] shadow-[0_0_30px_rgba(41,151,255,0.15)]'
                    : 'border-white/[0.08] bg-[#161618] hover:border-[#2997ff]/60 hover:bg-[rgba(41,151,255,0.05)]'
                }`}
              >
                {/* Push #116 — Pro now carries the amber "MOST POPULAR"
                    flag instead of the blue "Best Value" pill. Popular
                    takes precedence when both are set so we don't paint
                    two stacked badges. */}
                {p.popular ? (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[.12em]"
                    style={{
                      background: 'rgba(41,151,255,.15)',
                      border: '1px solid rgba(41,151,255,.4)',
                      color: '#2997ff',
                      boxShadow: '0 4px 18px rgba(41,151,255,.25)',
                    }}
                  >
                    🔥 Most Popular
                  </div>
                ) : p.highlight ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2997ff] px-3 py-1 text-[10px] font-black uppercase tracking-[.12em] text-white shadow-[0_4px_18px_rgba(41,151,255,.45)]">
                    Best Value
                  </div>
                ) : null}
                <div className="text-[11px] font-extrabold uppercase tracking-[.14em] text-[#86868b]">
                  {p.name}
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-[2.4rem] font-black leading-none tracking-tight text-[#f5f5f7]">
                    {billing === 'annual' && ANNUAL[p.tier] ? ANNUAL[p.tier].perMonth : p.price}
                  </span>
                </div>
                <div className="mt-1 text-[12.5px] font-semibold text-[#2997ff]">
                  {billing === 'annual' && ANNUAL[p.tier]
                    ? `/ month · billed annually (${ANNUAL[p.tier].total}/yr)`
                    : p.priceSub}
                </div>
                {/* KINEO-INTRO-MONTH-2026-07-13 — badge do 1º mês com desconto
                    (monthly only). Starter $4.90 / Creator $9.90 na 1ª fatura;
                    o checkout aplica via ?intro=1 (handleBuy). */}
                {/* KINEO-SPRINT-OFFER-2026-07-14 — renewal made explicit on the
                    badge itself (price + when it renews + cancel anytime), so
                    the intro can never read as the permanent price. */}
                {billing === 'monthly' && (p.tier === 'starter' || p.tier === 'basic') && (
                  <div className="mt-2">
                    <div
                      className="inline-block rounded-full px-2.5 py-1 text-[11px] font-black"
                      style={{ background: 'rgba(41,151,255,0.12)', border: '1px solid rgba(41,151,255,0.4)', color: '#2997ff' }}
                    >
                      🎁 First month {p.tier === 'starter' ? '$4.90' : '$9.90'} — applied at checkout
                    </div>
                    <p className="mt-1.5 text-[11px] font-semibold text-[#86868b]">
                      Renews at {p.price}/mo in 30 days — cancel anytime.
                    </p>
                  </div>
                )}
                {'tagline' in p && p.tagline && (
                  <p className="mt-2 text-[12px] text-[#86868b] leading-snug">
                    {p.tagline}
                  </p>
                )}
                <ul className="mt-5 mb-6 flex flex-col gap-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13.5px] text-[#f5f5f7]">
                      <span className="mt-[3px] text-[#2997ff]">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {/* Push #114 — paid tiers go through /api/stripe/checkout
                    (button + POST) so the route can pick BRL based on
                    x-vercel-ip-country. Free tier keeps the plain anchor
                    to /signup. */}
                <button
                  type="button"
                  disabled={purchasing !== null}
                  onClick={() => handleBuy(p.tier as 'starter' | 'basic' | 'pro')}
                  className="mt-auto block w-full rounded-xl bg-[#2997ff] px-4 py-3 text-center text-[14px] font-extrabold text-white shadow-[0_8px_24px_rgba(41,151,255,.35)] transition hover:bg-[#1f86ee] hover:shadow-[0_10px_30px_rgba(41,151,255,.45)] disabled:opacity-60"
                >
                  {purchasing === p.tier ? 'Loading…' : `${ctaLabel} →`}
                </button>
                {/* PAYPAL-2026-07-06 — alternate rail for international buyers
                    (US audit 06/07: USD abandoners want a no-card option).
                    Same GET-redirect pattern as handleBuy, zero Stripe changes.
                    USD-only — PayPal converts for the buyer.
                    Hidden until verified working (PAYPAL_ENABLED). */}
                {PAYPAL_ENABLED && isPaid && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      trackPricingEvent(`${p.tier}_paypal_checkout_clicked`)
                      const billingParam = billing === 'annual' ? '&billing=annual' : ''
                      window.location.href = `/api/paypal/checkout?tier=${p.tier}${billingParam}`
                    }}
                    className="mt-2 block w-full rounded-xl border border-white/[0.08] px-4 py-2 text-center text-[12.5px] font-bold text-[#f5f5f7] transition hover:bg-white/5 hover:border-[#2997ff]/40"
                  >
                    or pay with <span style={{ color: '#009cde', fontWeight: 900 }}>Pay</span><span style={{ color: '#2997ff', fontWeight: 900 }}>Pal</span> (USD)
                  </button>
                )}
                {/* Marker: KINEO-CHECKOUT-TRUST-2026-07-05 — trust cues at the buy button (billed by Kineo after Stripe name fix) */}
                {isPaid && (
                  <p className="mt-2 text-center text-[12px] font-semibold text-[#86868b]">
                    🔒 Secure Stripe checkout · billed by Kineo · cancel anytime · 7-day money-back
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* ROBO-ENTRY-490 — the one-time $4.90 Starter Pack was moved UP to a
            featured entry offer above the plans; the duplicate secondary button
            that used to sit here was removed to avoid a repeated adjacent CTA. */}

        {/* KINEO-2026-07-06 — Pix/Mercado Pago (BR) section removed at Joseph's request. */}

        {/* Push #114 — surface any checkout error inline so users aren't
            stranded silently when the API rejects the request. */}
        {checkoutError && (
          <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] font-semibold text-[#f87171]">
            {checkoutError}
          </p>
        )}

        {/* Push #171 — "already subscribed" info banner. Shown instead of
            the old silent redirect so users understand their plan is active. */}
        {alreadySubscribed && (
          <div className="mx-auto mt-4 max-w-2xl rounded-xl border border-[#2997ff]/30 bg-[#2997ff]/[0.07] px-5 py-4 text-center">
            <p className="text-[13px] font-bold text-[#2997ff]">
              ✅ You already have an active subscription!
            </p>
            <p className="mt-1 text-[12px] text-[#86868b]">
              Your plan is active. If your credits look low, they may still be syncing.
            </p>
            <a
              href="/generate"
              className="mt-3 inline-block rounded-lg bg-[#2997ff] px-5 py-2 text-[13px] font-extrabold text-white shadow-[0_4px_14px_rgba(41,151,255,.35)] transition hover:bg-[#2997ff]"
            >
              Go to Dashboard →
            </a>
          </div>
        )}

        {/* Push #097 — Guarantee row directly under the plan cards.
            Reinforces buyer confidence between the CTA and the comparison
            table below. */}
        <div className="mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13.5px] font-bold text-[#f5f5f7]">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[#2997ff]">✓</span> Cancel anytime
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[#2997ff]">✓</span> Instant access
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[#2997ff]">✓</span> 7-day money-back guarantee
          </span>
        </div>

        {/* ROBO1-PRICE-2026-06-28 — replaced three fabricated 5-star
            testimonials (invented names + invented view/subscriber numbers)
            with honest "what you actually get" cards. Same spot, same job:
            answer "does this really work?" before the comparison table —
            but with real product facts instead of fake proof. */}
        <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">
          {[
            {
              icon: '🎬',
              title: 'A finished Short, per idea',
              body: 'One topic in → hook, script, AI voice, captions and B-roll out. Built deliberately for that idea, not re-clipped from a long video.',
            },
            {
              icon: '🆓',
              title: 'Try before you pay',
              body: 'Create, watch, download and share up to 3 watermarked Fast videos every 24h, no card. Free access grants no credits or premium AI Generated videos.',
            },
            {
              icon: '📲',
              title: 'Ready to post anywhere',
              body: 'Paid plans export a clean, watermark-free 9:16 MP4 — download and upload straight to YouTube Shorts, TikTok and Reels.',
            },
          ].map((c) => (
            <div
              key={c.title}
              className="rounded-2xl p-4"
              style={{
                background: 'rgba(255,255,255,.03)',
                border: '1px solid rgba(255,255,255,.06)',
              }}
            >
              <div className="text-[18px] mb-2" aria-hidden>
                {c.icon}
              </div>
              <p className="text-[13.5px] font-bold text-[#f5f5f7] leading-snug mb-1.5">
                {c.title}
              </p>
              <p className="text-[12.5px] text-[#86868b] leading-snug">
                {c.body}
              </p>
            </div>
          ))}
        </div>

        {/* Push #087 — feature comparison table. Makes the Fast vs.
            Cinematic split explicit so users understand exactly what
            they're paying for at each tier. Scrolls horizontally on
            small viewports so the table never breaks layout. */}
        <div className="mt-16">
          <div className="mb-6 text-center">
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#2997ff]">
              Compare plans
            </div>
            <h2 className="text-balance text-2xl font-black tracking-tight sm:text-3xl text-[#f5f5f7]">
              What you get at each tier
            </h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#161618]">
            <table className="w-full min-w-[700px] text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="px-5 py-4 text-[11px] font-extrabold uppercase tracking-[.14em] text-[#86868b]">
                    Feature
                  </th>
                  <th className="px-5 py-4 text-center text-[11px] font-extrabold uppercase tracking-[.14em] text-[#86868b]">
                    Free
                  </th>
                  {/* KINEO-SPRINT-OFFER-2026-07-14 — column emphasis moved
                      Studio → Creator so the table agrees with the cards
                      ("Most Popular" = Creator is the primary CTA). */}
                  <th className="px-5 py-4 text-center text-[11px] font-extrabold uppercase tracking-[.14em] text-[#86868b]">
                    Starter
                  </th>
                  <th className="px-5 py-4 text-center text-[11px] font-extrabold uppercase tracking-[.14em] text-[#2997ff]">
                    Creator
                  </th>
                  <th className="px-5 py-4 text-center text-[11px] font-extrabold uppercase tracking-[.14em] text-[#86868b]">
                    Studio
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  // #409 — table rebuilt for the 3-tier ladder (was still 2-plan).
                  // KINEO-SHOWCASE-2026-07-10 — synced to the V3C economy
                  // (rebase 2:1 + universal engines): credits 25/150/200, AI Gen
                  // 20cr, Kling 50cr, Presenter 70cr, Hollywood 150cr. Engines
                  // unlock for ANY paid plan (balance permitting).
                  {
                    label: 'Fast mode (smart stock)',
                    free: 'Up to 3 / 24h · watermark',
                    starter: '✅ 1 cr',
                    basic: '✅ 1 cr',
                    pro: '✅ 1 cr',
                  },
                  {
                    label: 'AI Generated videos (Seedance, 20 cr)',
                    free: '— Paid only',
                    starter: '✅',
                    basic: '✅',
                    pro: '✅',
                  },
                  {
                    label: 'Cinematic AI videos (Kling, 50 cr)',
                    free: '—',
                    starter: 'Needs +25 cr',
                    basic: '✅',
                    pro: '✅ 1080p',
                  },
                  {
                    label: '🎬 AI Presenter — talking avatar (70 cr)',
                    free: '—',
                    starter: 'Needs +45 cr',
                    basic: '✅',
                    pro: '✅',
                  },
                  {
                    label: '🎥 Hollywood film (150 cr)',
                    free: '—',
                    starter: 'Needs +125 cr',
                    basic: '✅ 1/mo included',
                    pro: '✅',
                  },
                  {
                    label: '🎭 Saved characters (same face every video)',
                    free: '1',
                    starter: '12',
                    basic: '12',
                    pro: '12',
                  },
                  {
                    label: 'Monthly credits',
                    free: '0',
                    starter: '25',
                    basic: '150',
                    pro: '200',
                  },
                  {
                    label: 'Render time',
                    free: '~60 sec (Fast)',
                    starter: '~60 sec',
                    basic: '~3-5 min',
                    pro: '~3-5 min',
                  },
                  {
                    label: 'Watermark-free MP4',
                    free: '— Watermarked MP4',
                    starter: '✅',
                    basic: '✅',
                    pro: '✅',
                  },
                  {
                    label: 'Priority support',
                    free: '—',
                    starter: 'Email',
                    basic: 'Email',
                    pro: 'Priority',
                  },
                ].map((row) => (
                  <tr key={row.label} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-5 py-3.5 font-semibold text-[#f5f5f7]">{row.label}</td>
                    <td className="px-5 py-3.5 text-center text-[#86868b]">{row.free}</td>
                    <td className="px-5 py-3.5 text-center text-[#86868b]">{row.starter}</td>
                    <td className="px-5 py-3.5 text-center font-bold text-[#2997ff]">{row.basic}</td>
                    <td className="px-5 py-3.5 text-center text-[#86868b]">{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-center text-[12px] text-[#86868b]">
            Free access lets you create, watch, download and share up to 3 watermarked Fast videos per 24h; it includes no credits or premium AI Generated videos. Every paid plan unlocks clean, watermark-free MP4s and can access every engine when its balance covers the full credit cost.
          </p>
        </div>

        {/* Push #099 — FAQ accordion. Five evergreen objections lifted from
            support tickets and the homepage CRO copy. Pure client-side
            useState toggle so the page stays static-renderable. */}
        <div className="mt-16">
          <div className="mb-6 text-center">
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.16em] text-[#2997ff]">
              FAQ
            </div>
            <h2 className="text-balance text-2xl font-black tracking-tight sm:text-3xl text-[#f5f5f7]">
              💬 Frequently Asked Questions
            </h2>
          </div>

          <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-white/[0.08] bg-[#161618]">
            {FAQS.map((item, i) => {
              const isOpen = openFaq === i
              return (
                <div
                  key={item.q}
                  className="border-b border-white/[0.06] last:border-0"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[.02]"
                  >
                    <span className="text-[14.5px] font-bold text-[#f5f5f7]">
                      {item.q}
                    </span>
                    <span
                      aria-hidden
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.08] text-[#2997ff] transition-transform duration-200 ${
                        isOpen ? 'rotate-45' : ''
                      }`}
                      style={{ fontSize: 16, lineHeight: 1 }}
                    >
                      +
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 -mt-1">
                      <p className="text-[13.5px] leading-relaxed text-[#86868b]">
                        {item.a}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <p className="mt-5 text-center text-[12.5px] text-[#86868b]">
            Still have questions?{' '}
            <a
              href="mailto:support@usekineo.com"
              className="font-bold text-[#2997ff] hover:text-[#2997ff]"
            >
              Email us →
            </a>
          </p>
        </div>

        {/* Push #116 — explicit 7-day money-back guarantee callout under
            the FAQ. The trust row at the top of the page mentions the
            guarantee in passing; this spells out the terms so the buyer
            who scrolled all the way through gets the reassurance
            without leaving the page. */}
        <div
          className="mx-auto mt-12 max-w-3xl rounded-2xl p-5 sm:p-6"
          style={{
            background: 'rgba(41,151,255,.06)',
            border: '1px solid rgba(41,151,255,.35)',
            boxShadow: '0 0 40px rgba(41,151,255,.10)',
          }}
        >
          <div className="flex items-start gap-3 sm:gap-4">
            <div
              aria-hidden
              style={{
                fontSize: '1.6rem',
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              🛡️
            </div>
            <div>
              <div className="text-[14px] font-black text-[#f5f5f7] mb-1">
                7-day money-back guarantee — all plans
              </div>
              <p className="text-[13px] text-[#86868b] leading-relaxed m-0">
                If you&apos;re not happy in the first 7 days, email us and we&apos;ll refund 100%. No questions asked. Works for all plans.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Push #117 — spacer so the sticky bar below doesn't cover the
          last bit of the FAQ on mobile. Desktop ignores it. */}
      {showStickyCta && <div aria-hidden className="h-24 md:hidden" />}

      {/* Push #117 — sticky mobile checkout bar. Only renders on
          small viewports (md:hidden), only after 300 px of scroll, and
          uses backdrop-blur + the safe-area class so the bar clears the
          iOS home-indicator. Buttons go through the same handleBuy used
          by the cards above. */}
      {showStickyCta && (
        <div
          className="mobile-sticky-cta md:hidden"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'rgba(10,10,15,0.96)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderTop: '1px solid rgba(255,255,255,.08)',
            padding: '12px 16px',
            display: 'flex',
            gap: 8,
            zIndex: 50,
          }}
        >
          {/* #409 — Starter added to the sticky bar (was missing after the 3-tier launch) */}
          {/* KINEO-SPRINT-OFFER-2026-07-14 — primary (filled blue) button moved
              Studio → Creator so the sticky bar matches the card hierarchy
              ("Most Popular" = Creator). Studio goes neutral. */}
          <button
            type="button"
            disabled={purchasing !== null}
            onClick={() => handleBuy('starter')}
            style={{
              flex: 1,
              padding: '12px 6px',
              borderRadius: 10,
              background: 'rgba(255,255,255,.06)',
              border: '1px solid rgba(255,255,255,.12)',
              color: '#f5f5f7',
              fontSize: '0.75rem',
              fontWeight: 800,
              cursor: 'pointer',
              minHeight: 48,
            }}
          >
            {purchasing === 'starter' ? 'Loading…' : 'Starter $4.90'}
          </button>
          <button
            type="button"
            disabled={purchasing !== null}
            onClick={() => handleBuy('basic')}
            style={{
              flex: 1,
              padding: '12px 8px',
              borderRadius: 10,
              background: '#2997ff',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              minHeight: 48,
              border: 'none',
              boxShadow: '0 8px 22px rgba(41,151,255,.35)',
            }}
          >
            {purchasing === 'basic' ? 'Loading…' : 'Creator $9.90 🔥'}
          </button>
          <button
            type="button"
            disabled={purchasing !== null}
            onClick={() => handleBuy('pro')}
            style={{
              flex: 1,
              padding: '12px 6px',
              borderRadius: 10,
              background: 'rgba(255,255,255,.06)',
              border: '1px solid rgba(255,255,255,.12)',
              color: '#f5f5f7',
              fontSize: '0.75rem',
              fontWeight: 800,
              cursor: 'pointer',
              minHeight: 48,
            }}
          >
            {purchasing === 'pro' ? 'Loading…' : 'Studio $37.90'}
          </button>
        </div>
      )}

      {/* ───────── Footer ───────── */}
      <footer className="relative z-10 border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#161618] border border-[#2997ff]/40 text-sm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="#2997ff" />
              </svg>
            </div>
            <span className="text-[13px] font-bold text-[#f5f5f7]">
              Kineo
            </span>
          </div>
          <p className="text-[11.5px] text-[#86868b]">© 2026 Kineo</p>
        </div>
        {/* Push #116 — legal + contact strip. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 pb-6 sm:px-6">
          <Link href="/terms" className="text-[11.5px] font-medium text-[#86868b] hover:text-[#f5f5f7]">Terms of Service</Link>
          <span aria-hidden className="text-[11.5px] text-[#86868b] opacity-40">·</span>
          <Link href="/privacy" className="text-[11.5px] font-medium text-[#86868b] hover:text-[#f5f5f7]">Privacy Policy</Link>
          <span aria-hidden className="text-[11.5px] text-[#86868b] opacity-40">·</span>
          <a href="mailto:support@usekineo.com" className="text-[11.5px] font-medium text-[#86868b] hover:text-[#f5f5f7]">Contact</a>
        </div>
      </footer>
    </div>
  )
}
