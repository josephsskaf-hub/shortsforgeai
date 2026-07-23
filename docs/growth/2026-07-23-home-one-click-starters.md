# 2026-07-23 - Home one-click topic starters

## Objective

Increase the share of qualified homepage visitors who submit a topic, preserve that exact intent through signup, and reach a completed first video before asking for payment.

## Verified pre-change evidence

The prior prompt-first homepage cohort recorded:

- 58 homepage prompt views.
- 3 topic submissions (5.2% view-to-topic).
- 1 attributed signup.
- 1 automatic first-video dispatch.
- 0 completed first videos from the signup cohort.
- 0 pricing views, checkouts, paid sessions, or new subscriptions.

The dispatched render did reach the Fast response and durable checkpoint, then failed with `AI-generated clips cannot be submitted as Fast footage.` The event occurred at 2026-07-22 19:37 UTC. PUSH #57 removed the legacy AI hook at 2026-07-23 01:13 UTC, so the observed failure predates the deployed fix. No later activation attempt yet proves the repaired path.

## PUSH #69 change

- Keeps the free-form topic field.
- Adds three one-click starters across mystery, money, and history formats.
- States the exact free outcome next to the form: full watermarked video, no card.
- Makes the primary CTA explicit: `Create my free Short`.
- Preserves the chosen topic and `create_intent=fast` through signup.
- Records starter clicks and topic submissions under `push69_home_one_click_starters`.
- Extends the growth report through signup, autostart, first-video completion, pricing, checkout, recurring Stripe session, and active/trialing subscription.
- Adds a privacy-safe activation failure inspector that emits no email or user identity.

## Commands

```powershell
npm.cmd run growth:activation -- --hours=72
npm.cmd run growth:measure -- --days=1
```

## Decision gate

Review after 60 signed-out homepage views or 72 hours, whichever is later:

- View-to-topic target: at least 10%.
- At least 3 attributed signups.
- At least 1 completed first video from the new signup cohort.
- At least 1 pricing view and 1 authenticated checkout attempt.
- Commercial success requires at least 1 paid recurring subscription.

If topic submissions rise but first-video completion remains zero, stop modifying acquisition copy and fix the next activation error from authoritative event metadata. If first videos complete but checkout stays zero, improve the clean-export offer rather than adding another top-of-funnel page.
