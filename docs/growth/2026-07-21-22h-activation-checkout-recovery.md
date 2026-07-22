# PUSH #49 — Activation and checkout recovery

Date: 2026-07-21
Goal: move organic visitors from explicit creation intent to a completed first Short, then safely recover recurring Stripe checkouts without email outreach.

## Evidence before the change

Seven-day external funnel:

- 217 qualified visitors.
- 23 new signups.
- 23 reached `/generate`, but only 11 dispatched a generation and 6 completed a video.
- 4 users reached pricing.
- 2 recurring Stripe Checkout Sessions; both were ChatGPT-attributed, expired and unpaid.
- 0 new active or trialing subscriptions.

The largest controlled activation leak was the redundant second Generate click after signup. The commercial leak was a buyer leaving Stripe with no persistent on-site path back to the exact recurring offer.

## Change shipped

### Explicit-intent first video

- Public creation forms now send `create_intent=fast` only after the visitor submits a real prompt.
- Signup, login and OAuth preserve that marker and the prompt.
- A verified free account automatically enters the Fast pipeline after account and active-render state resolve.
- URL cleanup removes only `create_intent`; prompt and attribution remain intact.
- Session-scoped idempotency prevents duplicate dispatches.
- Paid, unknown, restored-render and already-processing states fail closed.
- Pack-buyer entitlement must resolve explicitly; a degraded balance query cannot classify a paid account as free.

Events:

- `activation_autostart_eligible`
- `activation_autostart_dispatched`
- `activation_autostart_skipped` with reason

### Recurring checkout recovery

- New recurring Checkout Sessions enable Stripe recovery after expiration.
- The browser stores only the opaque Stripe Session ID in an HttpOnly cookie.
- An authenticated endpoint revalidates user ownership, plan, Stripe Customer and subscription state before exposing any recovery path.
- Open sessions resume directly; ordinary expired sessions use Stripe recovery; introductory/private offers retry through the protected server checkout so the promised price cannot silently degrade.
- Any saved promotion that can no longer reproduce its original discount fails closed before Stripe opens.
- A compact on-site banner shows the real first charge and renewal amount and can be dismissed for seven days.
- Internal recovery retries are tagged `checkout_recovery=1` in event and Stripe metadata.
- BRL cancellation copy now preserves the real localized plan price.

Events:

- `checkout_resume_banner_viewed`
- `checkout_resume_banner_clicked`
- `checkout_resume_banner_dismissed`
- `checkout_started.metadata.checkout_recovery`

## Measurement gates

Activation gate, next 10 eligible explicit intents:

- At least 80% reach `activation_autostart_dispatched`.
- At least 50% create a completed video.
- Zero duplicate render, paid-engine or credit incidents.

Checkout-recovery gate, next 5 banner views:

- At least 30% click Resume checkout.
- At least one new recurring Stripe Session or payment.
- Zero wrong-price or duplicate-subscription incidents.

Stripe `active` or `trialing` remains the only payer truth. A view, click, signup or expired Checkout is not a sale.

## Organic distribution state

The no-email submission package for GPT Store, Uneed, SaaSHub, AIChief and G2 is prepared in `docs/growth/2026-07-21-organic-distribution-kit.md`. Duplicate checks and channel-specific UTMs are defined. No listing or GPT was publicly submitted in this change; that public representational action remains behind the founder's final confirmation.
