# PUSH #52 — Vidyo.ai / Quso.ai pricing decision guide

Date: 2026-07-21
Goal: turn observed non-brand pricing demand into an honest, measurable path from comparison to first Kineo Short and recurring checkout.

## Evidence before the change

Latest verified external funnel at 22:36 BRT:

- 1 day: 30 qualified visitors, 3 signups, 1 signup-cohort user with a completed video, 1 pricing actor, 0 recurring Stripe Checkout Sessions and 0 new active or trialing subscriptions.
- 7 days: 220 qualified visitors, 23 signups, 6 signup-cohort users with a completed video, 4 pricing actors, 2 recurring Stripe Checkout Sessions, both expired and unpaid, and 0 new active or trialing subscriptions.
- Seven-day signup sources: TAAFT 18, ChatGPT 4 and Google 1. Both recurring Stripe Sessions came from ChatGPT; neither became revenue.
- Google Search Console for July 1–19 showed 138 impressions, 8 clicks, 5.8% CTR and average position 13.4. `/pricing` received 39 impressions and one click. Visible queries included `vidyo ai pricing`, `vidyo.ai pricing` and `short ai pricing`, with no clicks.

This is a small demand signal, not proof of conversion. Paid recurring Stripe state remains the revenue truth.

## Accuracy correction

The existing `/alternatives/quso` page described Quso as only a long-video re-clipper that required source footage. That is no longer accurate.

Official pages checked on July 21, 2026 show:

- Vidyo.ai rebranded to Quso.ai in January 2025; existing accounts, projects, plans and subscriptions carried over.
- Quso now advertises long-video clipping, captions, reframing, editing, text-to-video creation, repurposing, scheduling, planning, analytics and brand tools.
- Public monthly prices were Free $0, Lite $29, Essential $39 and Growth $49.
- Listed monthly credits were 75, 100, 300 and 600 respectively. Quso says roughly one credit corresponds to one processing minute, while exact cost varies and is shown before processing.

Primary sources:

- https://quso.ai/pricing
- https://quso.ai/vidyo-ai

## Implemented experiment

Canonical page: `/alternatives/quso`

Aliases:

- `/alternatives/vidyo` redirects permanently to the canonical page.
- `/alternatives/vidyo-ai` redirects permanently to the canonical page.

Campaign: `push52_vidyo_quso_pricing_decision`

The page now provides:

- A dated direct answer to the Vidyo.ai pricing query.
- Current monthly plan and credit rows sourced from Quso's official page.
- An honest workflow decision: Quso for a broad clipping, editing, scheduling and analytics suite; Kineo for a focused topic-to-faceless-Short workflow.
- Explicit disclosure that neither product guarantees views, virality, subscribers or monetization.
- A founder-owned Kineo preview and its exact prompt.
- An inline topic form that preserves the visitor's prompt through signup.
- Intent-only campaign parameters, so internal navigation does not overwrite the true external first-touch source.
- A footer link and sitemap freshness signal for internal discovery.

## Measurement

`growth:measure` reports `experiments.push52VidyoQusoPricingDecision` with:

- qualified landing sessions after the production launch cutoff;
- CTA clicks, submitted topics and pricing views;
- campaign-attributed signups;
- signup-cohort users with a completed video;
- recurring Stripe Sessions by open, complete, expired and paid state;
- active or trialing Stripe subscriptions.

Explicit Stripe `intent_campaign` metadata takes precedence over inherited profile attribution. This prevents a later checkout explicitly tagged to another campaign from being credited to PUSH #52.

## Decision gate

Evaluate after 20 qualified sessions or 21 days, whichever comes first:

- At least 3 CTA clicks or submitted topics.
- At least 2 external signups.
- At least 1 signup-cohort user with a completed video.
- At least 1 recurring Stripe Checkout Session.
- At least 1 new external Stripe subscription in `active` or `trialing` state.

Do not change the offer or page before the gate unless tracking, payment or factual accuracy is broken. Do not count impressions, clicks, Checkout Sessions or trial state as cash revenue.
