// Push #051 — Provider abstraction registry (skeleton).
//
// This file is a TYPE-SAFE REGISTRY ONLY. It deliberately does not make
// any network calls, hold any API keys, or expose any runnable methods.
// Its purpose is to give the V2 prototype UI a stable, typed list of
// providers it can render — and to give Phase 2 work a place to slot
// concrete implementations behind without touching call sites.
//
// See V2_PROVIDER_RESEARCH.md for the per-provider status table and
// the homework needed before any `status: 'research'` entry can be
// promoted to `active`.

export type ProviderStatus = 'active' | 'research' | 'planned' | 'coming_soon'

export interface VideoProvider {
  id: string
  name: string
  status: ProviderStatus
  use: string
  /**
   * Native clip durations the provider supports (seconds). The V2 pipeline
   * tiles / loops these to hit the user's chosen video length, so a
   * provider that only emits 10s clips can still drive a 120s render.
   */
  supportedDurations?: number[]
  /**
   * Multiplier applied to the base V2 credit cost when this provider is
   * selected. 1.0 = base; >1 charges more (premium models); <1 charges
   * less (commodity stock-clip path). Phase 2 will read this when
   * computing per-generation cost.
   */
  creditMultiplier?: number
}

export const VIDEO_PROVIDERS: Record<string, VideoProvider> = {
  runway: {
    id: 'runway',
    name: 'Runway Gen-4.5',
    status: 'active',
    use: 'Visual generation (clips)',
    supportedDurations: [10],
    creditMultiplier: 1.0,
  },
  kling: {
    id: 'kling',
    name: 'Kling AI',
    status: 'research',
    use: 'Future video generation candidate',
    supportedDurations: [10, 30],
    creditMultiplier: 1.2,
  },
  futureProvider: {
    id: 'futureProvider',
    name: 'Future Provider',
    status: 'planned',
    use: 'Backup or premium model',
  },
}

/**
 * Working credit estimates for V2 durations. The 10s / 30s / 50s rows
 * MUST stay in lockstep with V1's `creditCostFor()` so a user who
 * generates from `/generate` and a user who generates from `/v2` at
 * the same duration pay the same. The 90s and 120s rows are V2-only
 * beta estimates and may change before public launch.
 */
export const V2_CREDIT_MODEL = {
  '10s': { basic: 15, pro: 20 },
  '30s': { basic: 15, pro: 20 },
  '50s': { basic: 15, pro: 20 },
  '90s': { basic: 30, pro: 40 }, // V2 beta estimate
  '120s': { basic: 40, pro: 55 }, // V2 beta estimate
}

export type V2DurationKey = keyof typeof V2_CREDIT_MODEL
export type V2Tier = keyof (typeof V2_CREDIT_MODEL)['10s']
