// Helpers for the async-video-generation flow (push #016/#017).
// State lives in the existing `videos` table â no schema rewrite required.
// The 003 migration is additive (`updated_at` + trigger + index) and the code
// below degrades cleanly when the migration has not yet been applied.

import type { SupabaseClient } from '@supabase/supabase-js'

export const STALE_GENERATION_MS = 15 * 60 * 1000 // 15 minutes

export type GenerationStatus = 'processing' | 'completed' | 'failed' | 'cancelled'

export interface PersistedTaskHandle {
  id: string
  promptText: string
  index: number
}

// Caption segment used to overlay text on the composed video. `start` and
// `duration` are in seconds, relative to the start of the composed MP4.
export interface CaptionSegment {
  text: string
  start: number
  duration: number
}

export interface GenerationMeta {
  task_ids: PersistedTaskHandle[]
  prompt: string
  scenes: string[]
  cost: number
  platform: string
  duration: number
  quality: string
  pending_scenes?: string[]       // scenes not yet sent to Runway (multi-clip)
  completed_clip_urls?: string[]  // video URLs from already-finished clips

  // Push #026 — audio + captions + final composition. Populated by the
  // /api/generate-video POST handler from the analyze-idea creative brief, then
  // consumed by /api/generate-video/status when all Runway clips are done.
  voiceover_script?: string       // full English narration text
  scene_captions?: string[]       // short 6-8 word caption per scene
  // Final composition state (filled in by /status after Runway succeeds).
  voiceover_url?: string          // public URL of the uploaded TTS mp3
  compose_render_id?: string      // Creatomate render job id
  compose_status?: 'idle' | 'submitting' | 'rendering' | 'succeeded' | 'failed'
  final_video_url?: string        // composed MP4 (visual + audio + captions)
}

export function encodeGenerationMeta(meta: GenerationMeta): string {
  return JSON.stringify(meta)
}

export function decodeGenerationMeta(raw: string | null | undefined): GenerationMeta | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.task_ids)) return null
    return parsed as GenerationMeta
  } catch {
    return null
  }
}

export interface ActiveGenerationRow {
  id: string
  user_id: string
  status: string | null
  video_url: string | null
  credits_used: number | null
  prompt: string | null
  script: string | null
  created_at: string
  updated_at?: string | null
}

export function isStale(row: { created_at: string; updated_at?: string | null }): boolean {
  const ref = row.updated_at ?? row.created_at
  const ageMs = Date.now() - new Date(ref).getTime()
  return ageMs > STALE_GENERATION_MS
}

/**
 * Fetch the user's currently-active (status=processing) generation, if any.
 * Selects `updated_at` defensively so the route still works on a database
 * where migration 003 has not yet been applied.
 */
export async function fetchActiveGeneration(
  supabase: SupabaseClient,
  userId: string
): Promise<ActiveGenerationRow | null> {
  const fields = 'id,user_id,status,video_url,credits_used,topic,script,created_at,updated_at'
  let query = await supabase
    .from('videos')
    .select(fields)
    .eq('user_id', userId)
    .eq('status', 'processing')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // If the migration hasn't been applied yet, retry without `updated_at`.
  if (query.error && /updated_at/.test(query.error.message ?? '')) {
    query = await supabase
      .from('videos')
      .select('id,user_id,status,video_url,credits_used,topic,script,created_at')
      .eq('user_id', userId)
      .eq('status', 'processing')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  }

  if (query.error || !query.data) return null
  const data = query.data as Record<string, unknown>
  return {
    id: String(data.id),
    user_id: String(data.user_id),
    status: typeof data.status === 'string' ? data.status : null,
    video_url: typeof data.video_url === 'string' ? data.video_url : null,
    credits_used: typeof data.credits_used === 'number' ? data.credits_used : null,
    prompt: typeof data.topic === 'string' ? data.topic : null,
    script: typeof data.script === 'string' ? data.script : null,
    created_at: String(data.created_at),
    updated_at: typeof data.updated_at === 'string' ? data.updated_at : null,
  }
}

/**
 * Mark a generation row as `failed` or `cancelled` and zero out credits_used.
 * Atomic on `status='processing'` to avoid clobbering a row another request
 * already finalised.
 */
export async function finalizeGeneration(
  supabase: SupabaseClient,
  generationId: string,
  finalStatus: 'failed' | 'cancelled' | 'completed',
  patch: Record<string, unknown> = {}
): Promise<boolean> {
  const update = { status: finalStatus, ...patch }
  const { data, error } = await supabase
    .from('videos')
    .update(update)
    .eq('id', generationId)
    .eq('status', 'processing')
    .select('id')

  if (error) {
    console.error('[generations] finalize update error:', error.message)
    return false
  }
  return Array.isArray(data) && data.length > 0
}

/**
 * Touch `updated_at` so the stale-job sweeper can tell the row is still alive.
 * Best-effort; ignores the "column updated_at does not exist" error that fires
 * when migration 003 has not yet been applied to this database.
 */
export async function touchGeneration(
  supabase: SupabaseClient,
  generationId: string
): Promise<void> {
  const { error } = await supabase
    .from('videos')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', generationId)
    .eq('status', 'processing')

  if (error && !/updated_at/.test(error.message ?? '')) {
    console.error('[generations] touch error:', error.message)
  }
}
