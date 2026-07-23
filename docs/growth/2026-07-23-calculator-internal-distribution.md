# PUSH #78 — Internal distribution for the Short cost calculator

## Decision

PUSH #77 made the calculator useful and measurable, but discovery depended mainly on search and a low-visibility footer link. PUSH #78 distributes the existing tool through pages that already carry product, price, and comparison intent without replacing their primary signup or purchase CTAs.

## Live paths

- Homepage pricing section → calculator
- Pricing pre-card decision box → calculator
- Alternatives hero → calculator
- Global public footer → calculator

Each link carries `internal_source=<origin path>` and records `cost_calculator_internal_clicked` with its placement. Calculator view, change, topic CTA, and pricing CTA events retain that internal source.

## Measurement

`npm run growth:measure -- --days=1` now reports:

- internal calculator-link clicks;
- calculator views by internal source;
- calculator views and changes;
- topic/pricing CTA clicks;
- topic submissions;
- signups and completed first videos;
- pricing, checkout, recurring Stripe sessions, and subscriptions.

## Guardrails

- No email or paid media.
- No external publication.
- Existing primary conversion actions remain primary.
- No client-controlled pricing or checkout currency.
- Success still requires a verified paid recurring subscription.
