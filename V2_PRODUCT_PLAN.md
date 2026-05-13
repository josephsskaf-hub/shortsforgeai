# V2 Product Plan — ShortsForgeAI

Status: planning / staging-only prototype. Drafted as part of push #051.

## Vision

V1 of ShortsForgeAI is a single-format pipeline: idea → analyze → render → composed 9:16 MP4 with voiceover + captions + CTA. It is opinionated about 10–50s YouTube Shorts.

V2 broadens the surface area: the same "idea → finished video" promise, but across multiple content formats, durations, platforms, and rendering engines. The user picks a format and ShortsForgeAI handles the rest end to end.

## Target users (V2 priority order)

1. **Faceless YouTube/TikTok creators** (V1's existing audience) — keep them happy first.
2. **Solo founders / indie marketers** producing ads, explainers, product demos for landing pages and paid social.
3. **Educators and explainer-channel operators** producing 60-120s teaching content.
4. **Affiliate / niche-channel operators** producing high-volume themed content (Mystery, History, Facts, Money, etc.).

V2 explicitly does **not** target collaborative editing, brand-asset libraries, or enterprise compliance — those are out of scope.

## Supported video types (V2 selector)

| Type | Length sweet spot | Notes |
|---|---|---|
| Short Video | 10–50s | V1 default. Vertical, fast cuts. |
| Faceless Video | 30–90s | Hook + script + cinematic scenes, no on-camera talent. |
| Explainer | 60–120s | More narration, slower pacing, screen-recording style possible later. |
| Ad | 15–60s | Strong hook, CTA in last 3s, brand-color emphasis. |
| Educational | 60–120s | Captions front-and-center, less cinematic, more clarity. |
| Product Video | 15–60s | Product shots + USP overlays + CTA. |
| History / Facts | 30–60s | High-retention narration over cinematic stock or AI clips. |

## Duration options

- **V1 (no migration risk)**: 10s, 30s, 50s
- **V2 beta**: 90s, 120s — gated behind the new `/v2` prototype + a feature flag in production

Longer durations need a different pipeline (see V2_TECHNICAL_ARCHITECTURE.md) because Runway emits 10s clips and Creatomate compose latency grows roughly linearly with clip count.

## Platform options

- YouTube Shorts (9:16, default V1)
- TikTok (9:16, slightly different safe-area)
- Instagram Reels (9:16, IG-specific captions)
- YouTube (16:9, V2 only)
- Instagram Feed (1:1 or 4:5, V2 only)
- General Video (16:9 horizontal, V2 only)

V2 introduces aspect-ratio routing: the same idea/script gets composed at different dimensions depending on the chosen platform. Caption font size + position presets per platform.

## Engine options

User-facing tiers (V2):

| Tier | What it uses | When to pick |
|---|---|---|
| Fast | Stock-clip composition (Pexels/Pixabay) + TTS + captions | Highest volume, lowest cost. |
| Cinematic | Runway Gen-4.5 generative clips + TTS + captions | V1 default. Best look-to-cost ratio today. |
| Premium | Reserved for future model (Kling AI / Sora-class) | Long-form, narrative shots, higher per-credit cost. |

Engine selection is independent of platform and video type so a user can do, e.g., a "Cinematic 120s YouTube Explainer."

## Pricing implications

- **V1 pricing stays untouched.** All current Stripe products keep working, all current credit costs (15 / 15 / 20) keep working.
- **V2 longer durations cost more credits.** Working estimate, subject to change before launch:

| Duration | Basic / Fast | Pro / Premium |
|---|---|---|
| 10s | 15 | 20 |
| 30s | 15 | 20 |
| 50s | 15 | 20 |
| 90s | **30** | **40** |
| 120s | **40** | **55** |

These estimates are encoded in `lib/providers/index.ts` (`V2_CREDIT_MODEL`) so they're easy to tune before public launch.

- No new Stripe products in this push. If V2 ships with longer durations, we can either:
  - Charge from the existing credit pool at the new rates (preferred — minimum infra change), or
  - Introduce a "V2 add-on" product if longer durations need separate billing.

## Rollout phases

| Phase | Scope | Gate |
|---|---|---|
| 1 (this push) | `/v2` prototype page, provider registry, planning docs. **No real generation.** | Staging only. |
| 2 | Provider abstraction layer wired into V1's existing 4-route pipeline; no user-visible change. | Staging. Internal QA. |
| 3 | Enable 90s and 120s on staging via the V2 page, charging the new credit rates. | Staging + selected beta users. |
| 4 | Move V2 into production behind a feature flag. | Production, flag off by default. |
| 5 | Public V2 launch (announcement, pricing page update). | Production, flag on for all. |

## Risks

- **Latency**: 120s videos at Runway's 10s-per-clip granularity = 12 clips, parallel-rendered. Realistic wall-clock 90–180s before Creatomate compose. Need to surface this honestly in the UI ("Long videos take a few minutes").
- **Cost**: 12 Runway clips ≈ 12× the per-clip cost. The credit pricing above assumes Runway pricing stays comparable; if Runway raises rates the V2 multipliers need a retune.
- **Quality drift**: longer voiceovers reveal TTS artifacts more than 30s ones do; we may need to switch to a higher-tier OpenAI TTS voice for V2.
- **Aspect-ratio captions**: 16:9 captions need a different overlay strategy than 9:16. Caption presets in compose need to be parameterized by platform.
- **Provider lock-in**: V1 is implicitly Runway+Creatomate. V2 should not double down on that lock-in — the provider registry exists for exactly this reason.

## What stays in V1 verbatim

- The `/generate` page and its UI flow.
- The 4-route pipeline: `generate-video → generate-video/status → compose → compose/status`.
- All current credit costs, Stripe products, and Stripe-hosted links.
- The Supabase `videos` history table and `/api/videos` GET.
- All authentication, RLS policies, and session management.
- Push #050's video proxy (`/api/video-proxy`) — V2 uses it as well.

V2 lives at `/v2` and is a parallel surface, not a replacement. We will only deprecate `/generate` after V2 has reached parity AND is stable in production for at least one billing cycle.
