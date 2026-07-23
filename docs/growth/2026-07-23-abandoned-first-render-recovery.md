# 2026-07-23 - Abandoned first-render recovery

## Objective

Increase signup-to-first-video activation on the path to 100 new paying customers per week, without paid media, email outreach, or founder-led promotion.

## Evidence

The 24-hour funnel showed:

- 65 qualified visitors.
- 2 external signups.
- 1 completed-video user, but 0 completions inside the new-signup cohort.
- 0 checkout attempts and 0 new recurring subscriptions.

Event-level inspection found two concrete activation losses:

1. One email signup auto-started a Fast render but failed at Compose because the former first-video Seedance hook supplied a FAL URL to the stock-only Fast path. PUSH #57 already removed that incompatible hook.
2. One TAAFT signup dispatched a first Fast render and navigated away nine seconds later, before the Fast response created a durable Compose checkpoint. The user returned the next day with the prompt preserved but the create intent already consumed, so the app did not resume or restart the first video.

## What PUSH #64 changes

- Keeps `create_intent=fast` in the URL until the Fast response and full Compose payload have been checkpointed.
- Records the lifecycle in session storage as eligible, dispatched, checkpointed, or recovery-dispatched.
- On a return before checkpoint, confirms the account still has zero videos and retries the exact first-video intent once.
- Bounds recovery to one automatic retry. A second interruption leaves the prompt available for the normal manual flow.
- Removes the recovery handle immediately for paid accounts, active watermark unlocks, completed checkpoints, and already-consumed non-recoverable intents. A transient entitlement lookup failure keeps the handle for a later refresh.
- Adds explicit measurement for checkpointed activation, activation failures, recovery eligibility, and recovery dispatch.

## Measurement gate

The `activationAutostartFastV1` block now reports:

- Eligible.
- Dispatched.
- Checkpointed.
- Failed after autostart dispatch.
- Skipped.
- Recovery eligible.
- Recovery dispatched.

The immediate success condition is that future autostart dispatches either reach a durable checkpoint or produce an explicit failure, while interrupted first renders get one measurable recovery attempt.

## Safety

- Only free accounts are eligible.
- Entitlements and active-render restoration resolve before recovery.
- Recovery requires zero existing videos.
- Fast remains the stock-only, watermarked free engine.
- No email, paid media, or founder appearance is involved.
