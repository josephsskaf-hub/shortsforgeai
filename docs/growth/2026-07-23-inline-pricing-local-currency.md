# PUSH #74 — inline pricing in local currency

Date: 2026-07-23

## Verified problem

Production validation after PUSH #73 found one remaining currency mismatch in the purchase path. A Brazilian customer opening `/generate` saw the embedded plan cards in USD, even though `/pricing` and the Stripe Checkout correctly resolved to BRL.

This recreated the trust break fixed on `/pricing`: the displayed amount changed only after the customer committed to Checkout.

## Change

- `components/PricingCards.tsx` now reads the display currency from `/api/geo`.
- Brazil sees BRL, India sees INR, and all other countries see USD.
- Until the display-only lookup resolves, the cards show a neutral loading state instead of flashing USD.
- Monthly, first-month, and renewal amounts come from `lib/checkoutPricing.ts`, the same shared source used by Stripe Checkout.
- CTA labels are currency-neutral, so an unselected Starter card cannot retain a stale USD amount while the card itself displays BRL or INR.
- The browser never chooses or sends a currency to Checkout. The server remains authoritative and resolves it again from the request country.
- The cards explicitly state which currency is displayed and that Stripe uses the same currency.

## Measurement

Two privacy-safe events were added:

- `inline_pricing_currency_resolved`: currency-specific plan cards became visible.
- `inline_pricing_checkout_clicked`: a customer clicked a plan, including tier, display currency, displayed monthly amount, and displayed intro amount.

`scripts/measure-source-funnel.mjs` now reports both events by acquisition source and the rate from inline pricing exposure to Checkout click.

This creates the measurable sequence:

`source → signup → generation → completed video → inline pricing by currency → plan click → recurring Checkout Session → paid subscription`

## Verification

- `npm.cmd run build`: passed.
- Known dynamic-cookie/static-generation warnings remained non-blocking.
- Production validation must confirm BRL inside `/generate` and the matching BRL amount in Stripe without entering payment details.
