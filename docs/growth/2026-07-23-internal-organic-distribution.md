# 2026-07-23 - Internal organic distribution pass

## Objective

Move toward 100 new paying customers per week with zero paid media, no founder-led outreach, and measurable organic acquisition.

## Problem

PUSH #58 and PUSH #60 created high-intent organic pages, but fresh pages need internal links and dashboard classification to become discoverable and measurable. The current 24h funnel still shows:

- Qualified visitors: 64.
- External signups: 2.
- Completed-video users: 1.
- Pricing actors: 2.
- Checkout started: 0.
- New paid subscriptions: 0.

## What changed

- Added `/free-ai-shorts-generator` and `/text-to-video-shorts` to the global public footer.
- Updated homepage proof caption to link to the free generator and text-to-video workflow.
- Replaced the lower homepage toolkit "Channel Builder" card with a direct "Free AI Shorts" card that points at `/free-ai-shorts-generator`.
- Updated `/facts` so AI answer engines see the new free generator and text-to-video pages as first-class Kineo resources.
- Updated `app/api/admin/funnel/route.ts` so `/free-ai-shorts-generator` and `/text-to-video-shorts` count as organic acquisition landings in the admin funnel.

## Validation

- `npm.cmd run growth:measure -- --days=1` completed successfully.
- `npm.cmd run build` completed successfully.
- Build kept `/free-ai-shorts-generator` and `/text-to-video-shorts` as static routes.

## Next gate

- Deploy PUSH #62.
- Verify homepage, `/facts`, and footer links are live in production.
- Continue measuring `push58_text_to_video_shorts` and `push60_free_ai_shorts_generator`.
