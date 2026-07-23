# PUSH #57 — Fast activation / Compose compatibility hotfix

**Detected:** 2026-07-22 22:07 BRT

**North star at detection:** 0/100 new paid recurring customers; $0 new MRR

**Action type:** P0 activation integrity hotfix

## Live evidence

The rolling measurement at 22:07 BRT showed:

- 1 day: 51 qualified visitors, 2 external signups, 0 signup-cohort completed videos, 1 pricing actor, 0 recurring Stripe Sessions and 0 paid recurring customers.
- 7 days: 268 qualified visitors, 24 external signups, 6 signup-cohort completed videos, 4 pricing actors, 2 expired/unpaid recurring Stripe Sessions and 0 paid recurring customers.
- `activationAutostartFastV1`: 2 eligible actors, 1 dispatched actor and 0 completed videos in the new signup cohort.

The dispatched PUSH #53 signup reached `generation_checkpoint_saved`, then failed at Compose with the exact error:

`AI-generated clips cannot be submitted as Fast footage.`

The failure was deterministic. The legacy first-video Fast path prepended an unsigned Seedance URL hosted by FAL. The Compose security guard introduced in PUSH #17 correctly rejects FAL media submitted as `quality=fast`, because premium AI media requires a signed generation claim. This was an activation defect, not a Stripe, credit or provider outage.

## Fix

- Removed the legacy Seedance first-video hook from `/api/generate-video-fast`.
- Kept Fast as the free stock-footage path used by activation.
- Added defense in depth so the Fast route never returns a `fal.media`, `fal.run` or `fal.ai` URL to Compose.
- Preserved the existing Compose security guard; no payment, pricing, credit or entitlement rule changed.

## Hypothesis and decision rule

The next eligible Fast activation should pass the `clips_ready -> compose -> completed` boundary without the incompatible-media error. Continue reading `experiments.activationAutostartFastV1` at the existing gate:

- at least 80% eligible -> dispatched;
- at least 50% eligible signup cohort -> completed video;
- zero duplicate render, quota or debit incidents;
- no recurrence of `AI-generated clips cannot be submitted as Fast footage.`

This hotfix repairs activation integrity only. It does not count as a customer, traffic, checkout or revenue result.
