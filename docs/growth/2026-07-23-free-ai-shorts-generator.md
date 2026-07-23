# 2026-07-23 - Organic acquisition run: Free AI Shorts Generator

## Objective

Move toward 100 new paying customers per week with zero paid media, no founder-led outreach, and measurable organic acquisition.

## Funnel snapshot before this push

- Last 24h qualified visitors: 64-65.
- External signups: 2.
- Completed-video users in period: 1.
- Pricing actors: 2.
- Checkout started: 0.
- New paid recurring subscriptions: 0.

## What shipped locally

- Added `/free-ai-shorts-generator`, a tool-first SEO page for the exact high-intent query "free AI Shorts generator".
- The first action is the topic/script form, carrying `push60_free_ai_shorts_generator` through signup.
- Added FAQ and VideoObject structured data.
- Added the URL to `sitemap.xml`.
- Added the URL to `public/llms.txt` for AI answer-engine citation.
- Extended `scripts/measure-growth-funnel.mjs` to report both:
  - `push58TextToVideoShorts`
  - `push60FreeAiShortsGenerator`

## Why this page

Current traffic is too low for the 100 paid customers/week goal. This page targets visitors already searching for a free tool, not generic education. The desired path is:

`organic query -> free generator page -> topic submit -> signup -> first Fast video -> pricing/checkout`

## Validation

- `npm.cmd run growth:measure -- --days=1` completed and includes the new PUSH #58 and PUSH #60 experiment blocks.
- `npm.cmd run build` completed successfully.
- Build output includes `/free-ai-shorts-generator` as a static route.

## Post-deploy gates

- Verify `https://www.usekineo.com/free-ai-shorts-generator` returns 200.
- Verify production `sitemap.xml` and `llms.txt` include `/free-ai-shorts-generator`.
- Submit updated sitemap with IndexNow.
- Track campaign `push60_free_ai_shorts_generator` for landing sessions, CTA clicks, topic submits, signups, activation, completed video, pricing view, checkout, and payment success.
