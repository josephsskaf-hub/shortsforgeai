// KINEO-OFFER290-2026-07-07 — central, importable feature flags.
//
// OFFER_290_ENABLED gates the entire first-purchase URGENCY offer
// ($4.90 → $2.90, 10 Fast videos, 24h countdown, 1-per-account). While it is
// `false`:
//   • the <Offer290Banner/> renders nothing,
//   • /api/stripe/checkout?pack=starter290 returns 410 (SKU disabled),
//   • /api/credits does not surface the offer fields.
// The founder flips it to `true` (single line below) to go live. Build-only for now.
// KINEO-SPRINT-OFFER-2026-07-14 — DESLIGADO por ordem do Joseph (sprint de
// oferta única: só intro-month $4.90/$9.90 nas superfícies públicas; o $2.90
// one-time conflitava e não gera MRR). Banner some, SKU volta 410.
export const OFFER_290_ENABLED = false
