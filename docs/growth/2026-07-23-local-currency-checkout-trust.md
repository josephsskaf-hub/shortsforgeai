# PUSH #72 — Local-currency checkout trust

Date: 2026-07-23  
Goal: remove the price/currency surprise between `/pricing` and Stripe and add a repeatable checkout-abandonment diagnostic.

## Evidence that selected this change

A privacy-safe Stripe/Supabase audit of the prior 30 days found 39 external recurring Checkout Sessions:

- 39 expired;
- 39 unpaid;
- 20 Starter, 13 Creator, and 6 Studio;
- 31 USD and 8 INR;
- 0 completed and 0 paid.

The live owner smoke test confirmed that current Stripe Checkout is operational, applies the first-month discount, offers Link plus card checkout, and has expiration recovery enabled. No payment information was entered and no charge was made.

The same test exposed a high-trust conversion defect for a Brazilian visitor: `/pricing` displayed the public USD offer, but Stripe correctly opened in BRL. The visitor therefore saw an unexpected currency and amount change immediately after clicking a plan.

## Change

- `/api/geo` now mirrors the authoritative Stripe country mapping: Brazil → BRL, India → INR, all other countries → USD.
- `/pricing` resolves the display currency without accepting a client-side checkout override.
- Monthly, first-month, annual, renewal, hero, and mobile sticky-CTA prices use the same integer price table as the checkout route.
- The page states which currency is shown and that secure checkout uses the same currency.
- Before geo resolution, the page shows neutral price placeholders instead of briefly displaying a potentially incorrect USD price.
- The pricing FAQ no longer repeats hardcoded USD amounts.
- The last pricing-table `~60 sec` Fast claim now reads `Usually 2–4 min`, matching the measured seven-day baseline from PUSH #71.
- `growth:checkout` provides a privacy-safe aggregate of recurring sessions by status, payment status, tier, currency, origin, and campaign, plus a bounded number of non-identifying diagnostics.

## Safety properties

- Stripe remains server-authoritative for currency and amount.
- The browser cannot submit or override the checkout currency.
- The diagnostic excludes known internal/test identities unless `--include-internal` is explicitly supplied.
- The diagnostic prints no email addresses, customer IDs, Checkout Session IDs, or Supabase user IDs.
- PayPal stays disabled until the business account and intro-price behavior are verified end to end.

## Validation before deploy

- `node --check scripts/inspect-checkout-abandonment.mjs`: passed.
- `npm run growth:checkout -- --days=30`: passed and reproduced the 39 expired/unpaid external-session baseline.
- `npm run build`: passed. Existing dynamic-cookie static-generation warnings were non-blocking and the command exited successfully.

## Production acceptance

After Vercel reports READY:

1. From Brazil, `/pricing` must show BRL in the hero, all plan cards, intro/renewal copy, annual prices, and the mobile sticky CTA.
2. `GET /api/geo` must return `{ country: "BR", currency: "brl" }` for the production browser.
3. A no-payment Starter smoke must reach Stripe with the same BRL first-month and renewal prices displayed on `/pricing`.
4. The pricing comparison table must not contain `~60 sec`.
5. No payment information is entered and no charge is created during validation.

## Decision gate

Measure future recurring Checkout Sessions daily. The leading indicator is a reduction in the expired/unpaid share and at least one completed/paid external subscription. The weekly objective remains 100 verified new recurring subscribers; checkout starts are not counted as customers.
