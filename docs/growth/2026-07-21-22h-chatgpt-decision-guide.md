# PUSH #50 — ChatGPT decision guide and internal distribution

Date: 2026-07-21
Goal: turn the strongest observed assistant-search intent into an honest, measurable path from question to first Short and recurring checkout.

## Evidence before the change

Latest verified funnel at 22:00 BRT:

- 1 day: 29 qualified visitors, 4 external signups, 2 signup-cohort users with a completed video, 1 pricing actor, 0 recurring Stripe Checkout Sessions and 0 new active or trialing subscriptions.
- 7 days: 218 qualified visitors, 23 external signups, 6 signup-cohort users with a completed video, 4 pricing actors, 2 recurring Stripe Checkout Sessions, both expired and unpaid, and 0 new active or trialing subscriptions.
- The 4 ChatGPT-attributed signups in the seven-day window produced both recurring Stripe Sessions. One of them carried campaign `push35_faceless_idea`.
- In the 28-day Stripe audit, 40 external recurring Checkout Sessions were found; all 40 were expired and none was paid. The landing-event history does not cover that whole period, so a 28-day visitor conversion rate is not valid.

Google Search Console, displayed range July 1–19:

- 8 clicks, 138 impressions, 5.8% CTR and average position 13.4.
- Homepage: 5 clicks from 69 impressions.
- Pricing: 1 click from 39 impressions.
- `/youtube-shorts-from-topic`: 1 click from 4 impressions.
- `/ai-shorts-without-filming`: 1 click from 2 impressions.
- Index coverage last updated July 9 showed 45 indexed URLs and 32 not indexed, including 22 discovered but not indexed URLs.

These are small samples and signals, not revenue proof. Stripe `active` or `trialing` remains the only payer truth.

## Change prepared

### Honest faceless-channel decision guide

The existing `/faceless-channel-ideas` URL and canonical are preserved, while unsupported RPM, views, virality and monetization claims are removed.

The page now includes:

- A decision matrix for research load, visual availability, repeatability and factual or policy risk.
- Ten channel formats and fifty episode ideas grouped by production reality.
- Direct answers for beginners, no-camera production and YouTube monetization eligibility.
- Links to the current official YouTube monetization and Partner Program guidance.
- A founder-owned Kineo output preview and the exact prompt used.
- One measured source and campaign, `push50_faceless_decision_guide`, across the form and every commercial CTA.
- `create_intent=fast` on idea-to-signup links so the explicit-intent activation recovery from PUSH #49 can start the first free Fast render safely.

### Internal distribution

The homepage comparison section now links contextually and measurably to:

- `/ai-shorts-without-filming` with source `push50_home_no_camera`.
- `/alternatives` with source `push50_home_alternatives`.

No internal UTM is used, so the visitor's true external source remains attributable.

### Measurement

`growth:measure` reports:

- `experiments.push50OrganicDecisionGuide.homeNoCameraClicked`
- `experiments.push50OrganicDecisionGuide.homeAlternativesClicked`
- `experiments.push50OrganicDecisionGuide.facelessGuideCtaClicked`
- `experiments.push50OrganicDecisionGuide.facelessGuideTopicSubmitted`
- `experiments.push50OrganicDecisionGuide.facelessGuidePricingViewed`
- Campaign-specific signups, completed-video users, recurring Stripe Sessions and active/trialing subscriptions.

External acquisition UTMs remain first-touch attribution. The separate intent campaign is preserved through activation events and Stripe metadata, so a GPT Store or directory UTM does not erase the PUSH #50 experiment dimension. Landing-session counting starts at the production launch timestamp rather than including historical traffic to the pre-existing URL.

The same marker is preserved by pricing exit-intent CTAs, email-signup completion and OAuth callback events. This keeps a new signup attributable even if the person closes the tab before Generate finishes loading.

## Decision gates

Evaluate the decision guide after 20 qualified landing sessions or 21 days, whichever comes first:

- At least 3 submitted topics.
- At least 2 external signups.
- At least 1 signup-cohort user with a completed video.
- At least 1 recurring Stripe Checkout Session.
- At least 1 new external Stripe subscription in `active` or `trialing` state.

Do not scale merely because the page receives clicks. If topics and signups occur without a completed video, activation is the next constraint. If completed videos occur without Stripe Sessions, the upgrade proposition is the next constraint. If Sessions expire again, price, trust and payment completion remain the next constraint.

## Distribution state

The technical page and IndexNow submission can be published without founder exposure, email or paid media. Creating a public GPT or submitting third-party directory listings remains a public representational action and is not counted as launched until a public URL is verified.
