# PUSH #55 — YouTube Related Video buyer bridge

Date: 2026-07-22
Campaign: `push55_youtube_related_bridge`
Measurement boundary: 2026-07-22 17:00 BRT (`2026-07-22T20:00:00Z`)

## Objective

Turn existing curiosity-Short distribution into attributable product sessions and
new recurring customers without paid media, email outreach or founder-led video.

The YouTube path is deliberate: URLs in Shorts descriptions/comments are not a
clickable acquisition path, while a channel-owned Related Video is clickable below
the Short. The Related Video should be a 16:9 screen-only workflow demo whose first
description line sends the viewer to one dedicated Kineo page.

## Verified baseline before launch

At 12:11 BRT on 22 July:

- 1 day: 38 qualified visitors, 0 external signups, 0 recurring Stripe Sessions and 0 paid customers.
- 7 days: 241 qualified visitors, 22 signups, 6 signup-cohort users with a completed video, 2 recurring Sessions (both expired/unpaid) and 0 paid customers.
- PUSH #53 after its clean boundary: 10 signed-out views, 0 topic submissions, 0 signups and 0 payments.

This is not a price or Stripe experiment. It is a distribution-to-product bridge.

## Funnel

1. Curiosity-first Short reaches the Shorts Feed.
2. Its clickable Related Video opens a 45–60 second, 16:9, screen-only Kineo demo.
3. The demo description opens `/from-youtube` with the exact UTM below.
4. The landing shows a real founder-owned Kineo preview and one topic form,
   prefilled with the exact corrected demo topic so one click can start the test.
5. Topic, `create_intent=fast`, campaign and UTMs survive signup/OAuth.
6. Eligible free users auto-start one Fast video.
7. Any recurring checkout from the generation screen retains `intent_campaign` in Stripe.
8. Stripe complete+paid linked to an active subscription is revenue truth.

## Production URL

```text
https://www.usekineo.com/from-youtube?utm_source=youtube&utm_medium=related_video&utm_campaign=push55_youtube_related_bridge&utm_content=screen_demo
```

The landing is `noindex,follow`, is not placed in the sitemap and must not compete
with the active organic SEO pages. It exists only to preserve message match and
campaign attribution.

## Video assets

### Curiosity-first Short

- Format: 9:16, approximately 35 seconds, English, dark/cinematic/fast-paced.
- One subtitle track only.
- Curiosity and payoff first; product CTA only at the end.
- Final second: `shortsforgeai.com` until channel branding is migrated consistently.
- Set the screen demo below as its YouTube Related Video.

### Clickable screen demo

- Working title: `How I Make a Faceless Short From One Topic (No Camera)`
- Format: 16:9, 45–60 seconds, screen recording only; no founder on camera.
- Show: enter one topic → Fast generation → finished 9:16 result → download.
- Spoken/on-screen CTA: `Try your topic with the first link below.`
- First description line: exact production URL above.
- Do not claim guaranteed views, revenue, virality or a guaranteed render time.

## Measurement

`npm.cmd run growth:measure -- --days=1` reports
`experiments.push55YouTubeRelatedBridge`:

- dedicated landing and bridge views;
- signed-out topic submissions;
- new-signup cohort, autostart and completed first video;
- all-intent generation, completed-video, post-video offer and checkout steps for
  both new and existing free users;
- recurring Stripe Sessions by state;
- active and trialing subscriptions separately;
- paid recurring customers only when Checkout is complete+paid, the linked
  subscription is active/trialing and both Stripe objects carry the explicit
  `push55_youtube_related_bridge` intent campaign.

The new-signup cohort and all-intent monetization remain separate. An existing free
user who starts from the YouTube bridge and becomes a first-time subscriber is a
valid new paying customer only when Stripe carries the explicit campaign.
Merely viewing the bridge can count as influence, but never as attributable revenue.

## Decision gate

Evaluate after 500 combined Shorts Feed views across three curiosity-first Shorts,
or after 14 days, whichever happens first:

- at least 3 qualified `/from-youtube` sessions;
- at least 1 topic submission;
- at least 1 signup;
- at least 1 first video completed;
- at least 1 recurring Stripe Session;
- commercial success requires at least 1 attributed paid recurring customer;
- zero cross-user attribution, duplicate checkout or duplicate debit incidents.

If Shorts views exist but the landing receives no sessions, fix the Related Video/demo
CTA. If landing sessions exist but no topics are submitted, fix the landing promise.
If videos complete, diagnose the direct result-page path in order:
`postVideoOfferViewed → postVideoCleanExportClicked → checkoutStarted`. A zero
`pricingViewed` count is not itself a failure because this CTA intentionally goes
straight to Stripe.
Do not change price from this experiment without recurring checkout evidence.

## Google distribution action already completed

The separate `video-sitemap.xml` was submitted to Google Search Console on 22 July.
Search Console processed it and reported four pages and four videos found. This is a
parallel organic discovery action, not part of the PUSH #55 YouTube cohort.
