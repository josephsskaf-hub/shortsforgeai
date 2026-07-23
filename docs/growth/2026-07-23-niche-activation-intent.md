# 2026-07-23 - Niche activation intent

## Objective

Move toward 100 new paying customers per week without paid media, founder-led outreach, or email blasts by reducing the gap between organic niche traffic and first-video activation.

## Problem

The 24h funnel still shows traffic but no checkout:

- Qualified visitors: 65.
- External signups: 2.
- Completed-video users in period: 1.
- Pricing actors: 2.
- Checkout started: 0.
- New active/trialing subscriptions: 0.

This means the current constraint is still before payment: visitors need to become activated users who create a first video.

## What changed

- Updated `/free-ai-shorts` hub CTA attribution from the old `push22_niche_hub` campaign to `push63_niche_activation_hub`.
- Added `intent_campaign` and `create_intent=fast` to the hub signup URL.
- Added a strong default prompt to the hub CTA: "The island nobody is allowed to visit".
- Updated every `/free-ai-shorts/[niche]` campaign from `push22_niche_*` to `push63_niche_*`.
- Changed each niche page's hero and final CTA to carry the first high-potential niche idea as `prompt=...`.
- Added `intent_campaign` and `create_intent=fast` to every niche CTA so signup/OAuth can preserve the exact activation intent.
- Added a `push63NicheActivationIntent` block to `scripts/measure-growth-funnel.mjs`.

## Why this matters

The niche pages were already useful for SEO, but the generic CTAs could still send a visitor into signup without a concrete first video idea. This push turns those clicks into intent-rich activation URLs:

`/signup?...&intent_campaign=push63_niche_money&create_intent=fast&prompt=<idea>`

That gives the app a better chance to route new users straight into a first Fast render after auth.

## Measurement

The new measurement block tracks:

- Niche landing sessions.
- Organic CTA clicks.
- New signup cohort.
- Activation autostart eligibility and dispatch.
- Generate started.
- Completed first video users.
- Pricing views.
- Checkout attempted/started.
- Recurring Stripe sessions and paid recurring customers.

## Validation

- `npm.cmd run growth:measure -- --days=1` completed successfully and includes `push63NicheActivationIntent`.
- `npm.cmd run build` completed successfully.
- Build kept `/free-ai-shorts` static.
- Build kept `/free-ai-shorts/[niche]` as SSG.

## Next gate

After deploy:

- Verify `/free-ai-shorts` CTA contains `push63_niche_activation_hub`, `create_intent=fast`, and the default prompt.
- Verify a niche page CTA contains `push63_niche_<slug>`, `create_intent=fast`, and a prompt.
- Watch whether `push63NicheActivationIntent` produces signup -> autostart -> completed video.
