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
}

export interface BrollPlan {
  globalStyle: GlobalVisualStyle
  scenes: BrollScene[]
  niche: string
  tone: string
  totalDuration: number
}

export interface BrollEngineInput {
  script: string
  niche: string
  tone: string
  duration: number
  language: string
  globalStyle?: Partial<GlobalVisualStyle>
}
