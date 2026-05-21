# V2 Technical Architecture — ShortsForgeAI

Status: design doc, drafted as part of push #051. Nothing in this file
ships behavior yet; it's the plan that the staging `/v2` prototype is
sized against.

## V1 pipeline (today, do not break)

V1 is a 4-route pipeline orchestrated from `app/(dashboard)/generate/GenerateClient.tsx`:

```
[client]  POST /api/analyze-idea
          → returns CreativeBrief (hook, voiceover_script, scenes[], provider_prompt, viral_intelligence, …)

[client]  POST /api/generate-video
          → splits prompt into N scenes via OpenAI
          → starts N Runway Gen-4.5 text-to-video tasks in parallel (each 10s)
          → returns { generationId, tasks: [{id, promptText, index}], scenes }

[client]  GET /api/generate-video/status?tasks=id1,id2,...
          → polls Runway every 4s
          → transitions to phase=clips_ready when all clips are done

[client]  POST /api/compose
          → scales voiceover_script to target word count (OpenAI gpt-4o-mini)
          → generates TTS audio via OpenAI tts-1 (voice: onyx)
          → uploads MP3 to Supabase storage bucket "voiceovers" (push #049 fix)
          → builds Creatomate JSON: video clips tiled across duration, voiceover audio, captions, CTA tail
          → submits render to Creatomate, returns { render_id }

[client]  GET /api/compose/status/[renderId]?quality=…&duration=…&topic=…&deducted=…
          → polls Creatomate every 5s
          → on succeeded: deducts credits from profiles.video_credits
          → on succeeded (push #050): inserts row into `videos` for Visual History
          → returns { phase: 'done', final_video_url }
```

Key invariants V2 must preserve:

- Credits are deducted in **exactly one place**: `/api/compose/status` success branch, gated on `deductedParam`.
- `videos` history row is inserted **only once** per generation (same gate).
- `final_video_url` is the canonical output; the player + download both consume it.
- The voiceover MP3 must be reachable without auth (Creatomate fetches it). Today: public Supabase bucket.

## Proposed V2 pipeline (for longer videos)

V2 keeps the 4-route shape but adds branching at two points: provider selection and per-clip parallelism.

```
[client]  POST /api/analyze-idea
          → unchanged (idea + brief still come from OpenAI gpt-4o-mini)

[client]  POST /api/v2/generate-video         (NEW route, not yet implemented)
          → reads { duration, platform, engine, video_type } in addition to current fields
          → looks up provider via lib/providers/index.ts based on engine + duration
          → computes credit cost from V2_CREDIT_MODEL
          → BRANCH:
              - if engine=Fast: skip Runway, build a stock-clip plan (Pexels/Pixabay)
              - if engine=Cinematic: start Runway tasks (current path)
              - if engine=Premium: future provider (Kling AI / Sora-class)
          → for durations > 50s: N can grow to 12 (120s ÷ 10s per clip)
          → returns { generationId, tasks, scenes, planned_duration, engine }

[client]  GET /api/v2/generate-video/status   (NEW; reuses status logic but provider-aware)
          → polls whichever provider was selected
          → transitions to clips_ready when all clips are done

[client]  POST /api/v2/compose                (NEW; aspect-ratio aware)
          → same TTS step (OpenAI tts-1) but voiceover word count scales with duration
          → builds Creatomate JSON parameterised by platform aspect ratio:
              - 9:16 (1080×1920) for Shorts / Reels / TikTok
              - 1:1  (1080×1080) for IG Feed
              - 4:5  (1080×1350) for IG Feed portrait
              - 16:9 (1920×1080) for YouTube / General Video
          → caption presets per platform: font size, safe area, CTA position
          → submits to Creatomate, returns { render_id }

[client]  GET /api/v2/compose/status/[renderId]
          → identical to V1, with the new V2_CREDIT_MODEL for deduction
```

V2 routes are **additive**. V1 routes keep serving the existing `/generate` page untouched until V2 reaches feature parity.

## Provider abstraction layer

Lives at `lib/providers/index.ts` (created in push #051 as a registry skeleton, no callable methods yet).

Design contract (Phase 2):

```ts
interface VideoProviderImpl {
  id: ProviderId
  startTask(input: { prompt: string; durationSec: number; aspectRatio: AspectRatio }): Promise<{ taskId: string }>
  pollTask(taskId: string): Promise<{ status: 'pending' | 'running' | 'succeeded' | 'failed'; progress: number; videoUrl?: string; failure?: string }>
}
```

Concrete implementations (Phase 2 onwards):

- `lib/providers/runway.ts` — wraps the existing Runway calls from `app/api/generate-video/route.ts`.
- `lib/providers/stock.ts` — Fast engine: pull stock clips by keyword + cuts them to length.
- `lib/providers/kling.ts` — research; **not implemented in this push**. Stub stays inert until we have API access and verified pricing.

The V2 generate-video route picks one of these based on `engine` and walks the same `startTask → pollTask` contract.

## Duration handling

Today: `lib/compose.ts buildCreatomateSource` tiles 10s Runway clips across the target duration. For V2:

- **10s, 30s, 50s** — unchanged. 1 / 3 / 5 clips.
- **90s** — 9 clips. Caption density needs to drop (fewer per second) so the screen isn't constantly changing words.
- **120s** — 12 clips. Voiceover length needs the same scaling treatment but the TTS-1 model has a hard 4096-char input cap; at ~2.5 wps the 120s script is ~300 words = well under cap, so safe.

`targetWordCount(duration)` already scales linearly; no change needed there.

CTA tail: stays at 2.5s for V1 durations; on 90s+ we may want to extend to 3.5s so the URL is readable longer.

## Credit / pricing considerations

- V2 introduces a per-duration credit table (`V2_CREDIT_MODEL` in `lib/providers/index.ts`).
- Existing V1 credit deduction (push #049/#050) reads cost from `creditCostFor(quality)`. V2's status route will read from `V2_CREDIT_MODEL` instead, indexed by duration + tier.
- The free-tier 2 credits stay enough for one short V1 video. For V2 the free tier remains explicitly capped at short formats only; longer durations always require a paid plan.

## Failure handling

V1 already does these things; V2 should not regress any of them:

- Credits deducted only on confirmed Creatomate `succeeded` + a non-empty URL.
- Voiceover storage failure (push #049) returns 502 with the cause logged but does not charge credits.
- History row insert failure (push #050) is logged but never fails the user request.
- Video proxy (push #050) abstracts CDN CORS quirks — V2 inherits this verbatim.

New V2-specific failure modes to design around in Phase 2:

- **Provider not available**: if Kling is selected but `lib/providers/kling.ts` is in `research` state, the v2 generate-video route must reject the request cleanly (HTTP 400) with a "provider not yet available" message, not 500.
- **Partial Runway success on 12-clip jobs**: today the V1 status route only returns clips_ready when all clips succeed. For 12 clips at 5% individual failure rate, the probability all 12 succeed drops to ~54%. V2 must support a "best effort" mode (proceed with the clips we got, loop them) OR a "retry the failed indices once" mode. Either way, credits should only deduct if the final render succeeds.

## Staging-only rollout plan

| Step | Scope | Branch / flag |
|---|---|---|
| 1 (this push) | `/v2` page UI prototype, provider registry, planning docs. No real API calls from `/v2`. | `staging`. No flag — page is reachable but Generate button is disabled. |
| 2 | Wire `lib/providers/index.ts` runtime implementations behind feature flag `V2_PROVIDERS_ENABLED`. V1 paths unaffected. | `staging`. Flag default off. |
| 3 | Move `/v2` Generate button live on staging, using new `/api/v2/*` routes. V1 `/generate` continues to work. | `staging`. Flag on for staging only. |
| 4 | Ship V2 routes to production behind same flag, default off. | `main`. Flag off. |
| 5 | Enable the flag for canary users, monitor failure rate + cost. | `main`. Flag on for canary list. |
| 6 | Full rollout: V2 is the default. `/generate` keeps redirecting until decommissioned. | `main`. Flag on for everyone. |

We do not migrate V1 traffic to V2 until V2 has run a full week on staging without a single voiceover-upload or compose failure that isn't recoverable.
