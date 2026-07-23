# PUSH #71 — Fast render trust and latency

**Date:** 2026-07-23  
**Objective:** reduce first-video abandonment by showing truthful render status and evidence-based timing.

## Production evidence before the change

A controlled authenticated Fast render was run through the live Kineo production flow with the topic `The island too dangerous to visit`.

- The prior `AI-generated clips cannot be submitted as Fast footage` failure did not recur.
- Fast sourcing passed its checkpoint and Compose accepted the payload.
- Render id: `e338f235-47bf-4d28-8411-19aebf66c949`.
- The final 45-second MP4 was delivered and persisted to the owner's history.
- Exactly one credit was charged after successful delivery.
- Server render intent: 2026-07-23 15:13:33 UTC.
- Completed video row: 2026-07-23 15:19:46 UTC.
- Measured end-to-end render latency: 6.22 minutes.

This proves the stock-only Fast/Compose hotfix works in the live pipeline. It also exposed a conversion problem: the UI and public pages repeatedly promised approximately 60 seconds while the real render was still active after five minutes.

## Seven-day latency baseline

The new `npm.cmd run growth:latency -- --hours=168` report joined authoritative `render_jobs` birth timestamps to completed `videos` rows by `render_id`.

- 20 render jobs.
- 19 jobs old enough to be judged after a 20-minute maturity window.
- 15 mature jobs completed: 78.9% observed mature completion rate.
- 16 completed jobs had a valid latency pair.
- Overall median: 2.10 minutes.
- Overall p90: 3.50 minutes.
- Fast-only sample: 12 completed renders.
- Fast median: 2.30 minutes.
- Fast p75: 2.53 minutes.
- Fast p90: 3.50 minutes.
- Fast observed range: 1.77–6.22 minutes.

## Changes

1. Fast timing now says `usually 2–4 minutes`; broader acquisition copy says `a few minutes`.
2. The render screen shows the actual API phase (`Generating AI clips`, `Generating voiceover & captions`, or `Rendering final video`) instead of cycling through cosmetic work that may already be finished.
3. The render screen explains that busy queues can take longer and tells users how to reconnect if they leave.
4. The unsupported “we'll notify you” promise was removed from the render wait state.
5. Public Fast claims were corrected across the homepage, signup, niche pages, free tools, comparison pages, shared-video pages, social proof, footer, and OG copy.
6. Avatar timing copy was left unchanged because it is a separate pipeline and was not part of the Fast latency sample.
7. A reusable aggregate-only latency report was added. It exposes no user ids, email addresses, or render URLs.

## Decision gate

The activation bottleneck is not considered solved by the owner test alone. Success requires new external signup cohorts to produce completed first videos. Watch:

- `signupCohortWithCompletedVideo`;
- `activation_autostart_dispatched` followed by `activation_autostart_checkpointed`;
- first-video render latency and mature completion rate;
- post-video offer views, checkout attempts, and new recurring subscriptions.

The commercial goal remains a verified paid recurring subscription, not a successful internal render.
