# PUSH #73 — Post-video local currency and source funnel

Date: 2026-07-23  
Goal: turn the only current signup source with volume into completed videos and price-consistent checkout intent.

## Evidence

The new privacy-safe seven-day source funnel found 23 external signups:

| Source | Signups | Started generation | Completed video | Saw post-video offer | Clean-export click | Recurring Checkout | Paid subscription |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TAAFT | 17 | 9 | 3 | 3 | 0 | 0 | 0 |
| ChatGPT | 4 | 2 | 2 | 2 | 1 | 2 | 0 |
| Google | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| Direct/unknown | 1 | 1 | 0 | 0 | 0 | 0 | 0 |

TAAFT supplied 73.9% of signups but zero Checkout Sessions. Its signup-to-completed-video rate was 17.6%, versus 50% for ChatGPT. Four of seven historical TAAFT Fast render jobs were mature without a completed video; those jobs predate the repaired Fast path and have no recoverable server-side input checkpoint.

Every completed TAAFT user saw the post-video clean-export offer, but none clicked it. The card still hardcoded `$4.90 today → $9.90/month`, while Stripe correctly switched Brazilian and Indian visitors to BRL or INR. The same currency surprise fixed on `/pricing` in PUSH #72 remained at the highest-intent post-video CTA.

## Change

- A single shared checkout price module now supplies monthly, annual, and first-month amounts to:
  - Stripe Checkout;
  - `/api/geo` currency resolution;
  - `/pricing`;
  - the post-video clean-export offer.
- The post-video offer now displays BRL, INR, or USD before the user clicks.
- Before geo resolution, the post-video card shows neutral copy rather than a possibly wrong USD amount.
- The browser still cannot choose checkout currency; Stripe resolves it again from the server request country.
- The offer and click events include the display currency, and a new `post_video_currency_resolved` event isolates the PUSH #73 cohort.
- `growth:sources` measures each signup source through generation, render job, completed video, offer view, clean-export click, pricing, Checkout Session, paid session, and active/trialing subscription.
- The source report prints no email, user ID, customer ID, subscription ID, or Checkout Session ID.

## Baseline and decision gate

Baseline before PUSH #73:

- TAAFT: 3 post-video offer viewers, 0 clean-export clicks, 0 recurring checkouts, 0 paid subscriptions.
- ChatGPT: 2 post-video offer viewers, 1 clean-export click, 2 recurring checkouts, 0 paid subscriptions.
- `post_video_currency_resolved`: 0 by construction before this push.

Evaluate after at least 10 new post-video offer views or seven days, whichever comes first. A positive leading result is at least two clean-export clicks and one recurring Checkout Session. Commercial success requires a verified paid recurring subscription.

## Validation before deploy

- `node --check scripts/measure-source-funnel.mjs`: passed.
- `npm run growth:sources -- --days=7`: passed and reproduced the source baseline above.
- Search confirmed the old hardcoded post-video `$4.90 today` and `$4.90` CTA no longer exist.
- `npm run build`: passed; existing dynamic-cookie warnings remained non-blocking.

## Production acceptance

After Vercel reports READY:

1. `/pricing` must still show the correct BRL values in Brazil after moving its values to the shared module.
2. Stripe must still receive the same Starter amount and renewal as the displayed price.
3. The deployed client bundle must contain the new local-price/neutral post-video copy and no old hardcoded post-video price.
4. No payment information is entered and no charge is made during the smoke test.
