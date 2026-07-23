# 2026-07-23 - Affiliate acquisition loop

## Objective

Recruit distribution partners organically through search and answer engines, without founder-led content, email outreach, or paid media. Partners earn only after they create attributable revenue.

## Verified baseline

The custom Kineo affiliate system was technically present but commercially dormant. The verified 30-day baseline before PUSH #68 was:

- `/partners` landing sessions recorded: 0.
- Partner CTA clicks: 0.
- Affiliate applications: 0.
- Signups attributed to the partner campaign: 0.
- Custom affiliates: 0.
- Affiliate clicks: 0.
- Referred signups: 0.
- Paid referrals: 0.
- Custom commissions: 0.

Rewardful is an external system and is not included in those database counts.

## Financial safety finding

The codebase contained both the custom Kineo affiliate system and Rewardful. Normal links used separate paths, but a customer could theoretically acquire both attributions over time, allowing an initial charge or renewal to create two affiliate liabilities.

PUSH #68 makes the systems mutually exclusive per subscription:

- A permanent custom `profiles.affiliate_id` attribution wins.
- Otherwise an existing Rewardful referral may own the checkout.
- The chosen system is written to Checkout and Subscription metadata.
- Stripe renewals carry the same ownership decision.
- The custom commission writer refuses any charge marked as Rewardful-owned.
- The checkout idempotency signature includes the selected affiliate system.

## Acquisition changes

- Retitles `/partners` around the exact `AI video affiliate program` intent.
- Keeps the verified 40% recurring offer and 90-day first-touch terms.
- Adds a product-demo path so applicants can test what they would recommend.
- Adds the global footer to the partner page.
- Links the program from the global public footer and `public/llms.txt`.
- Raises `/partners` sitemap priority to 0.8.
- Counts `/partners` as an organic acquisition landing.
- Writes an authoritative `affiliate_application_submitted` event.

## Measurement

Run:

```powershell
npm.cmd run growth:affiliate -- --days=30
```

The report includes:

- Partner landing sessions and CTA clicks.
- Affiliate applications and partner-campaign signups.
- Affiliates by status.
- Affiliate clicks, referrals, paid referrals, and commission totals by currency.

No emails, user identities, raw IP addresses, or sensitive payout details are emitted.

## Success gate

Review after 30 qualified `/partners` sessions or 14 days:

- At least 3 applications.
- At least 1 approved, active affiliate.
- At least 10 attributable affiliate-link clicks.
- At least 1 referred signup reaching first-video completion.
- At least 1 paid recurring referral.

Visits and applications are leading indicators. The channel succeeds only when it produces an attributable recurring subscriber with a single commission owner.
