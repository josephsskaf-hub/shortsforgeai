// KINEO-CREDIT-INTENT-2026-07-11 — SINGLE SOURCE OF TRUTH for per-engine credit
// cost. Extracted verbatim from app/api/compose/status/[renderId]/route.ts so
// that BOTH the place a render is BORN (/api/compose) and the place it is
// SETTLED (/api/compose/status) compute the price from the same function — no
// drift, no second copy to forget when prices change.
//
// The historical credit-leak class ("avatar nunca debitava por quality
// ausente", #315/#361) came from the billing amount being decided far from a
// trusted source. Keeping the cost table here, imported by every biller, is the
// structural guard against that.

export type Quality =
  | 'fast'
  | 'basic'
  | 'basic_ai'
  | 'pro'
  | 'cinematic_ai'
  | 'cinematic_kling'
  | 'cinematic_veo'
  | 'cinematic_sora'
  | 'cinematic_hollywood'
  | 'avatar'
  | 'presenter'

// KINEO-PRICING-V3C-2026-07-10 — creditCostFor now takes isPaidUser so Fast
// can cost 1 credit for PAYING accounts while staying 0 for free users (the
// KINEO-ZERO-SIGNUP watch-free funnel is untouched).
export function creditCostFor(quality: Quality, isPaidUser = false): number {
  // Matches the per-quality cost shown to the user on the Generate screen.
  // The UI display lives in app/(dashboard)/generate/GenerateClient.tsx — keep
  // these two in sync when adjusting prices. Push #084 added 'fast' = 1
  // credit for the Pexels + TTS Fast Mode pipeline. Basic / Basic AI = 15,
  // Pro = 20. Push #315 added 'cinematic_ai' = 3 for fal.ai Wan 2.1.
  switch (quality) {
    case 'fast':
      // KINEO-ZERO-SIGNUP-2026-07-09 — Fast is FREE again (was 1cr since
      // KINEO-FAST-1CR-2026-07-06). InVideo model: render/watch free with
      // watermark, pay $4.90 to download (KINEO-DL-PAYWALL). Fast costs
      // ~$0.02-0.05 to serve — it's the growth engine, not the revenue line.
      // KINEO-PRICING-V3C-2026-07-10 — for PAYING accounts (has_paid=true or
      // any paid plan) Fast now costs 1 credit per video. Free users stay at
      // 0 (watermarked render + download paywall — funnel unchanged). Product
      // rule: a paid user with 0 balance still renders fine — the debit is
      // simply skipped ([fast-credit] skip below); never break a render over
      // 1 credit.
      return isPaidUser ? 1 : 0
    case 'avatar':
      // KINEO-AVATAR-120-2026-07-06 — AI Avatar folded into the UNIVERSAL
      // video_credits system (was the separate avatar_credits add-on @ 1/video).
      // KINEO-AVATAR-220-2026-07-07 — repriced 120→220 (real VEED cost ~$9.60/video).
      // KINEO-REBASE-2026-07-10 — 220 → 110 (2:1 credit rebase; same USD value).
      return 110
    case 'presenter':
      // KINEO-PRESENTER-2026-07-10 — AI Presenter (Kling AI Avatar v2 Standard).
      // 70 credits ≈ ~71% margin (Joseph subiu 60→70 em 10/07). Keep in sync with
      // AVATAR_CREDIT_COST in generate-avatar.
      return 70
    case 'cinematic_ai':
      // KINEO-REBASE-2026-07-10 — 40 → 20 (2:1 rebase). Keep in sync with
      // SEEDANCE_CREDIT_COST in generate-video-cinematic.
      return 20
    case 'cinematic_kling':
      // KINEO-KLING-90-2026-07-06 margin math intact.
      // KINEO-REBASE-2026-07-10 — 90 → 45 (2:1 rebase; same USD value).
      // KINEO-PRICING-V3B-2026-07-10 — 45 → 50 (margin bump). Keep in sync
      // with KLING_CREDIT_COST in generate-video-cinematic.
      return 50
    case 'cinematic_veo':
      // #489/#491 — Veo 3.1 Fast premium. Keep in sync with VEO_CREDIT_COST.
      // KINEO-REBASE-2026-07-10 — 180 → 90.
      return 90
    case 'cinematic_sora':
      // #491 — Sora 2 premium (engine still BLOCKED upstream).
      // KINEO-REBASE-2026-07-10 — 200 → 100.
      return 100
    case 'cinematic_hollywood':
      // KINEO-REBASE-2026-07-10 — Hollywood = 150 créditos: preço FINAL aprovado
      // 10/07. Keep in sync with HOLLYWOOD_CREDIT_COST in generate-video-cinematic.
      return 150
    case 'pro':
      // KINEO-REBASE-2026-07-10 — legacy 20 → 10.
      return 10
    case 'basic':
    case 'basic_ai':
    default:
      // KINEO-REBASE-2026-07-10 — legacy 15 → 8 (ceil of 15/2).
      return 8
  }
}

// KINEO-CREDIT-INTENT-2026-07-11 — normalize an arbitrary string (e.g. a value
// read back from the render_jobs intent row, or a client query param) into the
// Quality union. Anything unrecognized collapses to 'basic_ai' — the same
// defensive default the routes already used. Centralized here so the compose
// status route and any future biller validate identically.
export function normalizeQuality(raw: string | null | undefined): Quality {
  const q = (raw ?? '').toString()
  switch (q) {
    case 'fast':
    case 'basic':
    case 'basic_ai':
    case 'pro':
    case 'cinematic_ai':
    case 'cinematic_kling':
    case 'cinematic_veo':
    case 'cinematic_sora':
    case 'cinematic_hollywood':
    case 'avatar':
    case 'presenter':
      return q
    default:
      return 'basic_ai'
  }
}
