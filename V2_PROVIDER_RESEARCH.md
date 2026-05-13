# V2 Provider Research — ShortsForgeAI

Status: research notes, drafted as part of push #051. No secrets in this
file. Cross-references the registry skeleton at `lib/providers/index.ts`.

## Currently integrated providers (V1, active in production)

### Runway Gen-4.5 — `runway`

- **Status**: active
- **Use**: visual generation. Each Runway task produces one 10s vertical clip from a cinematic prompt.
- **Where in code**: `app/api/generate-video/route.ts` calls `startRunwayTask()` from `lib/runway.ts`. Polling lives in `app/api/generate-video/status/route.ts`.
- **Auth**: API key in `RUNWAY_API_KEY` env (server-side only). Never exposed to the client.
- **Output**: signed MP4 URL hosted on `cdn.runwayml.com`. V1 plays this through `/api/video-proxy` (push #050) to avoid the CDN's missing CORS headers.
- **Known quirks**:
  - Prompt is hard-capped at 500 chars by Runway. We clamp at the source in `lib/openai`'s `clampToProviderLimit`.
  - The text_to_image intermediate URL is sometimes returned in the task list; we filter on `looksLikeVideoUrl()` to avoid handing an image to the `<video>` element.
  - 5–10% of tasks fail on a fresh attempt with no obvious cause; V1 surfaces this as `phase=failed` and does not deduct credits.
- **Pricing today**: pay-per-clip. Internal credit cost: 15 (Basic / Basic AI) / 20 (Pro) per generation, *regardless* of clip count, because V1 durations cap at 50s = 5 clips and the credit price is per finished video, not per clip.

### Creatomate — `creatomate`

- **Status**: active
- **Use**: final video render. Takes the JSON source description (video clips + audio track + caption overlays + CTA) and produces a single MP4.
- **Where in code**: `lib/compose.ts` (`buildCreatomateSource`, `submitCreatomateRender`, `pollCreatomateRender`). Called from `app/api/compose/route.ts` and `app/api/compose/status/[renderId]/route.ts`.
- **Auth**: API key in `CREATOMATE_API_KEY` env (server-side only).
- **Output**: MP4 URL on Creatomate's CDN. Played through `/api/video-proxy`.
- **Known quirks**:
  - Compose latency scales with element count. 30s with 3 clips + voiceover + captions + CTA renders in 15–35s; 50s with 5 clips renders in 25–60s.
  - No native CORS on media URLs (the reason `/api/video-proxy` exists).
  - Caption text supports basic styling; emoji is unreliable across rendering nodes — `analyze-idea` strips emoji from thumbnail_texts.

### OpenAI — `openai`

- **Status**: active
- **Use**: three jobs in V1 — creative-brief generation (`gpt-4o-mini`), voiceover script scaling (`gpt-4o-mini`), TTS audio generation (`tts-1`, voice: onyx).
- **Where in code**: `lib/openai.ts` exports a shared OpenAI client. Used by `app/api/analyze-idea/route.ts` and `lib/compose.ts`.
- **Auth**: API key in `OPENAI_API_KEY` env.
- **Known quirks**:
  - `tts-1` has a 4096-character input limit. V1 caps script at 3800 chars before sending.
  - `tts-1` voice variety is limited to 6 voices; V1 ships with `onyx` (deep narration). V2 may expose a voice selector.

## Research-stage providers (NOT integrated yet)

### Kling AI — `kling`

- **Status**: **research only**. Not wired up. Stub entry in `lib/providers/index.ts` so the UI can list it.
- **Use (intended)**: alternative video generation engine, likely competing on quality + price with Runway Gen-4.5. Reported strengths around motion realism and longer single-shot durations (up to 30s native, vs. Runway's 10s).

Before we can promote Kling from `research` to `active` we need to verify the following items. **None of these are confirmed yet — this list is the homework, not the answer.**

| Item | What we need to confirm | Owner |
|---|---|---|
| API access | Is there a publicly available REST API with a stable endpoint, or only a third-party reseller (e.g. Replicate, PIAPI)? | TBD |
| Pricing | Per-clip cost in USD at the durations we plan to use (10s, 30s). Does it scale linearly? | TBD |
| Payload format | Required prompt structure, max length, accepted aspect ratios, max duration. Compare to Runway's text_to_video schema. | TBD |
| Output format | MP4 + codec details. Direct URL vs. expiring signed URL. CDN host (for our video-proxy allow-list). | TBD |
| Commercial usage rights | Can output be redistributed publicly (YouTube/TikTok)? Any watermarking? Any "no commercial use without pro tier" clauses? | TBD |
| Rate limits | Concurrent tasks per account, daily quota, surge handling on cost. | TBD |
| Latency | Wall-clock time for a 10s clip and a 30s clip. Compare to Runway's typical 30–90s per 10s clip. | TBD |
| Failure modes | What does the API return for a rejected prompt, a content-policy hit, a transient outage? Are errors retriable? | TBD |
| Region / data residency | Where the inference runs, what data they retain, whether prompts are logged. | TBD |
| Account / payment terms | Prepaid credits vs. invoice. Refund / SLA on failed renders. | TBD |

Until those items have answers and are documented here, the registry status stays `research` and the V2 page must not allow selecting Kling as a generation engine. The provider entry is intentionally present in the UI as a "Premium" tier so we have a clean upgrade path the day Kling (or an equivalent) gets greenlit.

### Future provider — `futureProvider`

- **Status**: planned (placeholder).
- **Use**: a generic slot for a backup or premium-tier model. Likely candidates if Kling research doesn't pan out: Pika 2.0, Luma Dream Machine, Sora (if/when the API opens up).
- This entry exists only so the V2 page can render a tier even before we pick a specific provider. It is not callable in any way.

## Secrets policy

This file describes capabilities and integration design, not credentials.

- No API keys, account identifiers, internal URLs, or staging-specific tokens are written here.
- All keys remain in environment variables (`RUNWAY_API_KEY`, `CREATOMATE_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and any future provider keys), set per environment in Vercel.
- `lib/providers/index.ts` is intentionally a type-safe registry only — no key handling, no network calls. Concrete implementations live in sibling files (`lib/providers/runway.ts`, etc., to be added in Phase 2) and read keys directly from `process.env`.
