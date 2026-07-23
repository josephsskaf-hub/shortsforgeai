# 2026-07-23 - SaaSHub directory bridge

## Objective

Acquire new high-intent visitors and recurring subscribers from a reputable free software directory, without paid media, email outreach, or founder-led content.

## Directory audit

- AlternativeTo: Kineo already has a live listing at `https://alternativeto.net/software/kineo/`; do not create a duplicate.
- There Is An AI For That: already sends attributable traffic and produced one signup in the latest 24-hour window.
- SaaSHub: no Kineo listing was found; the official free submission flow accepts released English-language SaaS products on a custom domain.
- Futurepedia: current official submission terms include paid services; excluded by the no-paid-media rule.
- Toolify directory: the official submission flow requires payment; excluded.
- BetaList: the current fit is weaker because Kineo is already launched, and current submission availability may require payment or a long queue; excluded from this batch.

## Bridge

PUSH #65 adds `/from-saashub`, a clean destination suitable for the directory listing. It:

- Identifies the visitor's SaaSHub context.
- Explains that Kineo creates from a topic rather than clipping an existing long video.
- Shows a real Kineo export preview.
- States the free watermark and recurring price clearly.
- Carries one concrete prompt through signup with `create_intent=fast`.
- Attributes the full path with campaign `push65_saashub_directory_bridge`.
- Is `noindex, follow` so it serves the directory audience without competing with public SEO pages.

## Listing sheet

- Product: `Kineo`
- Official listing URL: `https://www.usekineo.com/from-saashub`
- Tagline: `Turn one idea into a finished faceless Short.`
- Short description: `Kineo creates a ready-to-post vertical Short from one idea: hook-led script, AI voiceover, matched visuals, captions, and MP4 export.`
- Long description: `Kineo turns one topic into a finished faceless vertical video without requiring source footage, a camera, or an editing timeline. It creates the script, AI voiceover, scene-matched visuals, captions, and MP4 export in one workflow. New accounts can make up to three watermarked Fast videos every 24 hours with no credit card. Starter costs $4.90 for the first month and renews at $9.90/month; paid plans unlock clean exports and premium AI engines.`
- Categories: `AI Video Generator`, `Video Editing`, `Social Media Tools`, `YouTube Tools`
- Competitors: `InVideo`, `Pictory`, `AutoShorts.ai`, `Faceless.video`
- Pricing model: `Freemium`
- Platform: `Web / SaaS`
- Logo asset: `public/icon-512.png`

## Measurement

The `push65SaaSHubDirectoryBridge` block reports:

- Landing sessions.
- Bridge views.
- Topic submissions.
- New signups.
- Activation autostart eligibility and dispatch.
- Completed first videos.
- Pricing views.
- Checkout attempts and starts.
- Recurring Stripe sessions, active subscriptions, and paid recurring customers.

## Success gate

First seven days after the listing goes live:

- At least 10 qualified SaaSHub landing sessions.
- At least 2 topic submissions.
- At least 1 signup reaching first-video activation.
- At least 1 checkout attempt.

If the listing produces visits but no topic submissions, revise the bridge. If it produces activated users but no checkout, revise the post-video offer. If it produces no visits, move to the next verified free directory without changing the product funnel.
