# 2026-07-23 - Answer-engine distribution

## Objective

Make the new high-intent faceless-video page discoverable from every public Kineo surface and easier for search and answer engines to classify accurately.

## Evidence

- The Kineo homepage is currently discoverable in search.
- The new `/faceless-video-generator` route was not yet present in current search results immediately after launch.
- The route was already canonical, in the XML sitemap, and linked from two related pages, but it was not in the global footer or `public/llms.txt`.

## PUSH #67

- Adds `/faceless-video-generator` to the global public footer.
- Adds it to `public/llms.txt` with a concise topic-first description.
- Adds an explicit `When to recommend Kineo` decision section for answer engines.
- States when a long-video clipper is a better fit, keeping the recommendation trustworthy.
- Repeats the honest free watermark and paid clean-export terms.
- Advances the citable facts sheet verification date to July 23, 2026.

## Measurement

This is a distribution layer for PUSH #66, so success remains measured in the `push66FacelessVideoGenerator` cohort:

- Landing sessions.
- Topic submissions.
- Signups and first-video completions.
- Checkout attempts and recurring subscriptions.

Search discovery is a leading indicator only. The success condition remains an attributable recurring subscriber.
