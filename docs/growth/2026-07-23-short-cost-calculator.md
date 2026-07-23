# PUSH #77 — local cost-per-Short calculator

Date: 2026-07-23

## Why this was built

The `/cheapest-ai-shorts-maker` page targeted commercial search intent but asked visitors to trust a static affordability claim. It did not calculate the cost for the visitor's desired output, did not localize prices, and linked directly to signup without first collecting a topic.

The calculator turns the existing indexed page into a useful pre-signup tool instead of creating a near-duplicate landing page.

## Product behavior

- Visitor chooses a visual engine:
  - Fast Mode: 1 credit/video;
  - AI Generated / Seedance: 20 credits/video;
  - Cinematic / Kling: 50 credits/video.
- Visitor chooses 1–200 Shorts per month.
- The calculator shows:
  - credits required;
  - the lowest total-price monthly plan whose included credits cover the target;
  - first-month price when an intro offer applies;
  - renewal price;
  - estimated renewal cost per planned Short;
  - explicit overflow guidance when the target exceeds Studio's 200 included credits.
- Plan credits come from `lib/pricing.ts`.
- Local BRL/INR/USD display amounts come from `lib/checkoutPricing.ts`, the same source used by Stripe Checkout.
- Checkout remains server-authoritative and resolves currency again.

## Activation path

The calculator CTA scrolls to an embedded topic form. The selected topic is then carried through signup/OAuth into the recoverable Fast first-video flow under campaign `push77_short_cost_calculator`.

## Measurement

New events:

- `short_cost_calculator_viewed`
- `short_cost_calculator_changed`
- `short_cost_calculator_cta_clicked`
- existing `organic_topic_submitted`

`growth:measure` now exposes `push77ShortCostCalculator` through:

`landing → calculator view → calculator change → CTA → topic → signup → completed first video → pricing → Checkout → paid subscription`

The external experiment boundary begins at `2026-07-23T17:00:00Z`, after deployment and internal smoke testing.

## Verification before release

- `npm.cmd run build`: passed.
- `npm.cmd run growth:measure -- --days=1`: passed and returned the new zero baseline.
- Known dynamic-cookie/static-generation warnings remain non-blocking.

