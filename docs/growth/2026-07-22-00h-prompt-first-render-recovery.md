# PUSH #53 — prompt-first activation and Fast render recovery

Date: 2026-07-22
Goal: convert more of the traffic Kineo already receives into a completed first video, without changing price, checkout or the active PUSH #50/#52 experiments.

## Verified baseline before the change

External accounts and founder/test traffic excluded:

| Stage, rolling 7 days | Verified result |
|---|---:|
| Qualified visitors | 223 |
| New signups | 23 |
| Reached `/generate` server-side | 21 |
| Dispatched a render | 11 |
| Signup cohort with a completed video | 6 |
| Recurring Stripe Checkout Sessions | 2 |
| Paid Sessions / new paying subscribers | 0 / 0 |

Both recurring Sessions expired unpaid. There is no evidence of a Stripe creation error. The largest proven leak is signup to first completed video: 17 of 23 new accounts did not reach a completed result.

Five of the eleven dispatched renders reached B-roll processing but never produced a persisted video. In one observed sequence, `/api/generate-video-fast` returned successfully and the browser then navigated to login before a render job or video row existed. The Fast response was kept only in React memory until the Compose effect ran.

## Change 1 — prompt before signup

Campaign: `push53_home_prompt_first`

Measurement starts at 2026-07-22 00:15 BRT, deliberately after the production deploy and smoke validation so internal release traffic cannot enter the cohort.

- Logged-out homepage CTAs now return the visitor to the topic composer instead of opening a blank signup.
- The form sends `prompt`, `create_intent=fast` and `intent_campaign=push53_home_prompt_first` through signup or OAuth.
- The existing activation flow starts one free Fast render only for an eligible free account. Paid accounts keep the prompt but are not auto-started.
- The obsolete internal `utm_source=homepage` was removed. External TAAFT, ChatGPT, Google and YouTube acquisition remains first-touch truth; the homepage action is measured separately as intent.
- The form emits `home_prompt_first_viewed` and `organic_topic_submitted` without storing or sending the prompt text.

## Change 2 — preserve a successful Fast handoff

- The authenticated server page passes the current user's id into `GenerateClient`, eliminating the background-auth race before the first recovery snapshot.
- Immediately after a valid Fast response, the client persists the exact clips, narration, captions, options and server `generationId` before any React state/effect boundary.
- A reload, auth hop or navigation can replay `/api/compose` with that same id.
- Compose already uses a deterministic claim per user + generation id, so retries converge on one render and cannot consume the free quota or paid credits twice.

This deliberately does not claim to recover a computer shutdown while the long Fast request is still in flight. That requires a separate server-side checkpoint/response cache.

## Measurement

`npm run growth:measure -- --days=14` reports `experiments.push53HomePromptFirst`:

- qualified form views and topic submits, including signed-out submits;
- activation autostart eligible, dispatched and skipped actors;
- campaign-attributed new signups and actual render dispatches;
- signup-cohort users with a completed video;
- pricing and checkout actors;
- recurring Stripe Sessions by state;
- active versus trialing subscriptions;
- paid recurring customers, which requires a complete, paid Session linked to an active subscription.

The new-signup cohort is kept separate from already-registered users who submit the homepage form. The decision gate uses only signed-out submitters who become new accounts; `allIntentActivationAutostart` and `allIntentMonetization` remain diagnostic and cannot declare the experiment a win. Experiment rows are fetched cumulatively from their launch cutoff for 21 days even when the headline funnel is requested with a shorter rolling window.

The pre-existing `generation_render_resumed` event proves a recovered render. PUSH #53 also emits `generation_checkpoint_saved` when the Fast handoff is made durable.

## Decision gate

Evaluate after 10 identifiable signed-out topic submitters or 14 days, whichever comes first:

- At least 50% become real signups.
- At least 80% of eligible activation attempts dispatch exactly once.
- At least 50% of the signup cohort completes a first video.
- At least one user reaches pricing or checkout.
- At least one recurring Stripe Session is created.
- At least one paid recurring customer is the success condition.
- Zero duplicate renders, duplicate quota use, duplicate debit or cross-user snapshot incidents.

Do not change price or Stripe based on the current sample of two unpaid Sessions. Revenue truth remains Stripe-paid recurring state, not a page view, click, signup, render or open Checkout Session.

## Next acquisition action (separate experiment)

At the scheduled 17:00 BRT content run, keep the curiosity-first Short format and use a clickable YouTube Related Video bridge. Shorts description/comment URLs are not clickable; the Related Video should lead to a screen-only, no-founder workflow demo whose first description line uses the exact YouTube UTM. Its publication timestamp starts a separate acquisition cutoff and must not be combined with the homepage intent totals.
