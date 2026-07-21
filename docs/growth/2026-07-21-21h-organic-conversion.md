# Growth run — 2026-07-21 21h BRT

## Objective

Advance the weekly target of 100 new external recurring customers without paid
media, email outreach or founder-led content. This run selected improvements
from live acquisition and product-loop evidence rather than adding another
unproven page or changing the offer again.

## Evidence used

### Google organic

Search Console data available through 19/07/2026:

| Window | Impressions | Clicks | CTR | Average position |
|---|---:|---:|---:|---:|
| 7 days | 31 | 1 | 3.2% | 23.1 |
| 28 days | 138 | 8 | 5.8% | 13.4 |

`/ai-shorts-without-filming` was the only page with a Google click in the
7-day view: 1 click from 2 impressions, 50% CTR and average position 11. Live
product telemetry connects that visit to signup, generation, a completed first
video and download. It did not create a checkout. The journey happened before
the current post-video offer was deployed, so it is evidence for query/page fit
and activation, not evidence against the current offer.

Decision: improve this already validated page instead of publishing more thin
SEO pages.

### Share and referral loop

External users only; founder/test accounts excluded:

| Window | Completed-video users | Share prompt views | Share clicks | Completed shares | `/v/` landings | Qualified referrals |
|---|---:|---:|---:|---:|---:|---:|
| 1 day | 2 | 1 | 0 | 0 | 0 | 0 |
| 7 days | 6 | 3 | 1 | 0 | 0 | 0 |

The single 7-day click opened native share and was cancelled about two seconds
later. Across the current external profile base, 479 profiles have a referral
code, but there are zero `referred_by` users, zero positive referral counts and
zero qualified referrals. The public `/v/[id]` path already preserves referral
and UTM attribution; the observed break is distribution before that page.

Decision: make the voluntary share action visible near the win moment, while
keeping the clean-export/revenue decision ahead of it. Use WhatsApp as the
primary share action, keep copy-link as the secondary action and show the
existing 30/30 incentive only when a referral code is available.

### ChatGPT discovery

The verified 7-day signup mix includes four ChatGPT-attributed signups, and one
ChatGPT signup on 21/07 completed a first video. Campaign-level payment matching
then traced both recurring Stripe Sessions in the 7-day window back to ChatGPT
signups: one had no stored campaign and one used `push35_faceless_idea`. Both
sessions expired and neither paid, so this is purchase-intent evidence, not
revenue. No other source produced a recurring Stripe Session in the window.

The connected ChatGPT account is eligible to open the GPT editor and currently
has no custom GPTs. The prior local publishing package was not safe to use
because it contained unsupported claims and the obsolete “first one free”
promise.

Decision: replace it with a useful, source-checking faceless Shorts script GPT,
one non-spammy production CTA and a dedicated full UTM. Creation/publication is
not counted until a public URL is verified. Creator-profile/domain verification
remains unknown.

## Implemented experiment — proof-led no-camera landing

Page: `/ai-shorts-without-filming`

Campaign: `push48_no_filming_proof`

- Hero CTA now scrolls to an inline topic/script form.
- The form preserves the visitor's prompt through signup.
- A real, founder-owned Kineo output and its original prompt appear before the
  explanatory sections.
- Added `FAQPage`, `HowTo` and `VideoObject` structured data.
- Added image/video social metadata.
- Replaced absolute or subjective quality statements with verified engine,
  timing and credit facts.
- Removed the second sticky CTA so the page has one clear conversion path.

Gate: 20 qualified landing sessions or 14 days, whichever happens first.

- At least 25% `organic_topic_submitted`.
- At least 15% signup.
- At least 10% completed first video.
- At least one recurring Stripe Session.
- Search Console average position at or above the top 10 and at least five
  clicks are useful secondary signals; payment remains the north star.

## Implemented experiment — post-render WhatsApp referral card

Variant: `whatsapp_first_30_30_v1`

- Consolidates the previous share controls and referral mini-card.
- Places the card after the clean-vs-watermarked export decision for free users,
  and after the primary download for paid users, before secondary actions.
- Primary action opens WhatsApp with the attributed public watch page.
- Secondary action copies the same page.
- Preserves the legacy funnel events and adds variant-level impression,
  WhatsApp-open and copy-success events.
- Sharing remains manual; nothing is sent automatically.
- If the referral code is unavailable, sharing still works with the plain public
  page and the UI does not promise the 30/30 reward.

Gate: next seven external completed-video users.

- At least 80% card exposure (baseline 50%).
- At least 30% WhatsApp-open or successful-copy among exposed users (baseline
  0% completed share).
- At least one qualified `/v/[id]` landing within 24–48 hours.
- If seven completed users still create no public landing, stop iterating on
  referral copy and return capacity to acquisition.

## Prepared acquisition asset — GPT Store

`KINEO-GPT-STORE.md` now contains:

- a clear search-oriented name and description;
- source-checking instructions and four Preview QA cases;
- the canonical free promise: up to 3 watermarked Fast videos every 24 hours,
  no card;
- no “retention-tested”, “high RPM”, virality or performance claim;
- one production CTA with
  `utm_source=chatgpt&utm_medium=gpt_store&utm_campaign=faceless_shorts_gpt&utm_content=script_to_video_cta`;
- publication checks for creator identity, verified domain and policy review.

`scripts/measure-growth-funnel.mjs` now reports signup, recurring Stripe Session
and active/trialing subscription counts by `utm_source`, `utm_medium` and
`utm_campaign`, with no emails or other user identifiers in its output. This is
required to prove whether the GPT Store creates revenue rather than merely
adding generic ChatGPT signups.

The asset is prepared, not published. A public GPT URL is the completion proof.

## Verification status

- The landing-page implementation passed the production build and static HTML
  inspection.
- The campaign-level measurement command passed for 1-day and 7-day windows and
  exposed the two expired ChatGPT-attributed Stripe Sessions described above.
- The repository-wide TypeScript check still reports known pre-existing errors
  outside the changed landing file; this is not represented as a clean global
  typecheck.
- Final build, focused review, commit, push, Vercel READY check and canonical
  production smoke test are required before this run is labeled published.
