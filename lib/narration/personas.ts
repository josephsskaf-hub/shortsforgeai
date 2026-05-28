/**
 * Dynamic AI Narration Engine — Persona Definitions
 * Phase 1: OpenAI TTS voice + speed mapping per persona
 *
 * Each persona maps to an OpenAI TTS voice and a base speed tuned for
 * that persona's emotional character. Phase 2 will add ElevenLabs/Cartesia
 * support; for now we maximise quality within OpenAI TTS by picking the right
 * voice and pace for each content vertical.
 *
 * OpenAI TTS voices (documented): alloy, ash, ballad, coral, echo, fable,
 * nova, onyx, sage, shimmer, verse.
 * We use the stable subset: alloy, echo, fable, nova, onyx, shimmer.
 */

export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'nova' | 'onyx' | 'shimmer'
export type PersonaTier = 'free' | 'premium' | 'cinematic'

export interface VoicePersona {
  id: string
  name: string
  description: string
  tier: PersonaTier
  /** OpenAI TTS voice ID */
  voice: OpenAIVoice
  /** Default speed (0.7–1.3) for this persona */
  defaultSpeed: number
  /** Speed multiplier for the hook section (first ~20% of script) */
  hookSpeedMultiplier: number
  /** Speed multiplier for the payoff section (last ~20% of script) */
  payoffSpeedMultiplier: number
}

export const VOICE_PERSONAS: VoicePersona[] = [
  {
    id: 'storyteller',
    name: 'Storyteller',
    description: 'Warm, engaging, like a friend telling an incredible story.',
    tier: 'free',
    voice: 'fable',
    defaultSpeed: 1.03,
    hookSpeedMultiplier: 1.08,
    payoffSpeedMultiplier: 0.96,
  },
  {
    id: 'dark-mystery',
    name: 'Dark Mystery',
    description: 'Deep, slow, suspenseful. Built for chills.',
    tier: 'premium',
    voice: 'onyx',
    defaultSpeed: 0.92,
    hookSpeedMultiplier: 1.00,
    payoffSpeedMultiplier: 0.87,
  },
  {
    id: 'finance-authority',
    name: 'Finance Authority',
    description: 'Confident, professional, direct. Absolute credibility.',
    tier: 'free',
    voice: 'onyx',
    defaultSpeed: 1.00,
    hookSpeedMultiplier: 1.06,
    payoffSpeedMultiplier: 0.97,
  },
  {
    id: 'documentary',
    name: 'Documentary',
    description: 'National Geographic energy. Serious, powerful, informative.',
    tier: 'premium',
    voice: 'echo',
    defaultSpeed: 0.96,
    hookSpeedMultiplier: 1.03,
    payoffSpeedMultiplier: 0.92,
  },
  {
    id: 'luxury-narrator',
    name: 'Luxury Narrator',
    description: 'Sophisticated, calm, aspirational. Like a Louis Vuitton ad.',
    tier: 'cinematic',
    voice: 'alloy',
    defaultSpeed: 0.90,
    hookSpeedMultiplier: 0.95,
    payoffSpeedMultiplier: 0.86,
  },
  {
    id: 'energetic-facts',
    name: 'Energetic Facts',
    description: 'Fast, animated, explosive. Perfect for viral facts.',
    tier: 'free',
    voice: 'fable',
    defaultSpeed: 1.10,
    hookSpeedMultiplier: 1.18,
    payoffSpeedMultiplier: 1.12,
  },
  {
    id: 'conspiracy',
    name: 'Conspiracy',
    description: 'Urgent, convincing. The viewer feels they\'re uncovering a secret.',
    tier: 'premium',
    voice: 'onyx',
    defaultSpeed: 0.96,
    hookSpeedMultiplier: 1.02,
    payoffSpeedMultiplier: 0.88,
  },
  {
    id: 'futuristic-ai',
    name: 'Futuristic AI',
    description: 'Clean, sharp, almost robotic but still human. Ideal for tech.',
    tier: 'premium',
    voice: 'alloy',
    defaultSpeed: 1.04,
    hookSpeedMultiplier: 1.10,
    payoffSpeedMultiplier: 1.00,
  },
  {
    id: 'emotional-storyteller',
    name: 'Emotional Storyteller',
    description: 'A voice with soul. Creates real emotional connection.',
    tier: 'cinematic',
    voice: 'nova',
    defaultSpeed: 0.97,
    hookSpeedMultiplier: 1.04,
    payoffSpeedMultiplier: 0.90,
  },
]

/** Find a persona by ID (returns undefined if not found) */
export function findPersona(id: string): VoicePersona | undefined {
  return VOICE_PERSONAS.find((p) => p.id === id)
}
