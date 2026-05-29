export type VisualMood =
  | 'dark'
  | 'energetic'
  | 'luxurious'
  | 'mysterious'
  | 'futuristic'
  | 'emotional'
  | 'tense'
  | 'epic'

export type ShotType =
  | 'close_up'
  | 'drone'
  | 'tracking'
  | 'handheld'
  | 'pov'
  | 'wide'
  | 'macro'
  | 'cinematic_zoom'

export type ScenePurpose =
  | 'hook'
  | 'explanation'
  | 'escalation'
  | 'transition'
  | 'payoff'

export type VisualSource = 'pexels' | 'stock' | 'ai'

export interface GlobalVisualStyle {
  mood: VisualMood
  /** 0-1: 0 = abstract/stylized, 1 = documentary realism */
  realism: number
  pacing: 'slow' | 'medium' | 'fast' | 'ultra_fast'
  saturation: 'low' | 'normal' | 'high'
  cameraStyle: 'documentary' | 'cinematic' | 'handheld' | 'broadcast'
  lighting: 'natural' | 'cinematic_dark' | 'golden_hour' | 'neon' | 'studio'
}

export interface BrollScene {
  sceneNumber: number
  scenePurpose: ScenePurpose
  narration: string
  caption: string
  durationSeconds: number
  visualIntent: string
  visualMood: VisualMood
  shotType: ShotType
  source: VisualSource
  keywords: string[]
  brollPrompt: string
  negativePrompt: string
  relevanceScore?: number
  pexelsQuery: string
  /** 3-5 Pexels search queries, most specific first. pexelsQuery === pexelsQueries[0]. */
  pexelsQueries?: string[]
  /**
   * When true the AI found no suitable Pexels query for this scene.
   * The pipeline should skip Pexels entirely and extend the previous
   * relevant clip (FALLBACK-A) instead of firing a doomed search.
   */
  requiresExtension?: boolean
}

export interface BrollPlan {
  globalStyle: GlobalVisualStyle
  scenes: BrollScene[]
  niche: string
  tone: string
  totalDuration: number
  /**
   * #358 — true when the GPT visual-director call failed and the plan fell back
   * to built (template) prompts. Lets the frontend and generate-video-fast see
   * that the plan is degraded instead of silently treating it as a real plan.
   */
  degraded?: boolean
}

export interface BrollEngineInput {
  script: string
  niche: string
  tone: string
  duration: number
  language: string
  globalStyle?: Partial<GlobalVisualStyle>
}
