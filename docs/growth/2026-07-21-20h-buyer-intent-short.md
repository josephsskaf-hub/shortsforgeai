# Growth run — 2026-07-21 20h BRT

## Verified evidence

Rolling seven-day audit at 20:04 BRT, excluding founder/internal/test accounts:

| Signal | Verified result |
|---|---:|
| Qualified external actors | 216 |
| External signups | 23 |
| Users with a completed first video | 6 |
| Pricing actors | 3 |
| Identifiable checkout-attempt actors | 3 |
| Unidentified checkout probes | 37 |
| Stripe subscription sessions | 2 expired, 0 open, 0 complete |
| New external recurring payments | 0 |

The raw checkout sequence is not a buyer cohort. Of 41 `checkout_attempted`
events, 37 had neither `user_id` nor `session_id`. The two authenticated attempts
created two Stripe subscription sessions; both later expired without payment.
There is no verified checkout, webhook, payment or rendering failure.

Signup attribution in the window: TAAFT 17, ChatGPT 4, direct/unknown 2. The
buyer-intent landing page `/youtube-shorts-from-topic` received 10 qualified
sessions, but there is still no signup or payment attributed to YouTube.

Production is healthy: the current Vercel deployment was `READY` at 20:04 BRT,
and the tracked landing URL resolved to HTTP 200 at `www.usekineo.com`.

## Channel decision

YouTube Studio provides a clear creative constraint:

- `The Nuclear Island You're Not Allowed to Visit`: 173 views since 20 July,
  103 above the usual range, with 98.8% of real-time traffic from the Shorts Feed.
- `New York's Forbidden Quarantine Island`: 14 views after 2h19, ranked 2/10.
- `I Gave AI One Sentence — It Made This Entire Video`: 21 lifetime views,
  below the normal 80–170 range; Studio says more viewers skipped it. It is 61
  seconds long and has 0% recent traffic from the Shorts Feed.

Therefore the next buyer-intent test must not repeat a product-demo opening.
It will earn attention as an evidence-led extreme-place story, then reveal the
real Kineo workflow after the payoff. This preserves the channel's strongest
current topic signal while testing purchase intent honestly.

## Next buyer-intent Short — production-ready brief

**Working title:** The Internet Gets the “Door to Hell” Wrong

**Format:** English, vertical 9:16, 34–36 seconds, dark/cinematic/fast-paced,
one burned-in subtitle track only. The final second must display
`shortsforgeai.com`.

**Engine gate:** create the publishable final with the best Kineo **AI Generated**
engine available. Do not substitute Fast Mode. If there are not enough credits,
defer production rather than claiming an external render was made by Kineo.

**Evidence gate:** a 2026 Geophysical Research Letters study reconstructed the
fire history from Landsat imagery and placed ignition between late 1987 and
early 1988. Use “burning for decades”; do not repeat the uncertain 1971 origin
story as fact. Source: <https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2025GL120321>.

### Voiceover and visual sequence

| Time | Voiceover | Visual direction |
|---|---|---|
| 0–3s | “The internet gets Turkmenistan's ‘Door to Hell’ wrong.” | Immediate aerial push toward the burning crater; no logo or UI. |
| 3–9s | “Satellite records show the fire began between late 1987 and early 1988—not 1971.” | Match-cut from archival satellite tiles to the crater at night. |
| 9–15s | “It is a natural-gas crater in the Karakum Desert, and it has burned for decades.” | Wide desert scale, then close flames; keep geography specific. |
| 15–22s | “Researchers traced that history across Landsat images—and measured methane escaping with the fire.” | Satellite time sequence, methane visualization, no fake dashboard numbers. |
| 22–27s | “This whole Short started as one sentence in Kineo.” | Hard reveal to a real screen capture of the exact prompt being submitted. |
| 27–34s | “Kineo built the script, AI scenes, voiceover and captions together.” | Show the actual generated scene timeline and the matching finished export. |
| 34–35s | “Make yours.” | Clean final card: `shortsforgeai.com`; no countdown or discount. |

**Exact Kineo prompt:**

> Create a 35-second dark cinematic YouTube Short correcting the common Darvaza
> “Door to Hell” origin story. Use the 2026 satellite finding that visible
> combustion began between late 1987 and early 1988, explain that the natural-gas
> crater has burned for decades and releases methane, then end with a concrete
> payoff. English, fast-paced, vertical 9:16, one subtitle track. Reserve the
> final second for shortsforgeai.com.

**Attribution URL:**

`https://www.usekineo.com/youtube-shorts-from-topic?utm_source=youtube&utm_medium=organic&utm_campaign=daily_short_20260722&utm_content=darvaza_satellite_truth_buyer_intent`

**Description CTA:**

> This Short started as one topic in Kineo. See the real prompt and make your
> own: [tracked URL]

## Hypothesis and next decision

Hypothesis: curiosity-first packaging will regain Shorts Feed distribution while
the real prompt-to-output reveal produces measurable buyer-intent visits.

Read at 24 and 48 hours. Count only identified funnel actors and Stripe-backed
recurring payments. Continue this format only if it produces at least one
qualified YouTube landing session and reaches the Shorts Feed; prefer a first
video start or payment over view volume. If distribution repeats the pure-demo
failure, return to curiosity-only Shorts and move the product proof to the
landing page instead of spending another channel slot.
