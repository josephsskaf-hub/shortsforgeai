// KINEO-USER-FOOTAGE-2026-07-10 — "My footage" storage helpers (Prioridade 2).
// Users upload their OWN photos/clips (signed URL → direct to Supabase
// storage, bypassing Vercel's 4.5MB body cap) and the Fast pipeline uses them
// as per-scene B-roll with Pexels/vault fallback.
// Mirrors lib/avatar/storage.ts patterns (idempotent bucket bootstrap).
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

export const USER_FOOTAGE_BUCKET = 'user-footage'

// Per-plan TOTAL quota (bytes). Free = 0 (locked — the free→pro upgrade bait
// from the briefing: "assine pra usar SEU footage e SUA voz").
export const FOOTAGE_QUOTA_PAID = 500 * 1024 * 1024 // 500MB total
// Per-FILE cap. Supabase project file-size limit governs the hard ceiling
// (free tier caps at 50MB/file) — keep the bucket at 50MB/file so uploads
// never 500; the 500MB plan quota is enforced in our route by summing rows.
const FILE_SIZE_LIMIT = 50 * 1024 * 1024

const BUCKET_CONFIG = {
  public: true,
  fileSizeLimit: FILE_SIZE_LIMIT,
  // KINEO-OWN-VOICE — audio mimes included: the "my voiceover" upload (P3
  // Level A) rides the same signed-URL flow as footage.
  allowedMimeTypes: [
    'image/jpeg', 'image/png', 'video/mp4', 'video/quicktime', 'video/webm',
    'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a',
  ],
}

let cachedAdminClient: SupabaseClient | null = null
export function footageAdminClient(): SupabaseClient {
  if (cachedAdminClient) return cachedAdminClient
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured.')
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.')
  cachedAdminClient = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedAdminClient
}

/** Idempotent bucket bootstrap — "already exists" responses are benign
 *  (same battle-tested flow as ensureAvatarsBucket, incl. the 12/06 lesson:
 *  check getBucket FIRST and never let housekeeping kill an upload). */
export async function ensureFootageBucket(admin: SupabaseClient): Promise<void> {
  try {
    const { data: existing } = await admin.storage.getBucket(USER_FOOTAGE_BUCKET)
    if (existing) {
      const { error: updErr } = await admin.storage.updateBucket(USER_FOOTAGE_BUCKET, BUCKET_CONFIG)
      if (updErr) console.warn('[user-footage] updateBucket failed (non-blocking):', updErr.message)
      return
    }
    const { error } = await admin.storage.createBucket(USER_FOOTAGE_BUCKET, BUCKET_CONFIG)
    if (!error) {
      console.log(`[user-footage] created storage bucket "${USER_FOOTAGE_BUCKET}"`)
      return
    }
    const msg = (error.message ?? '').toLowerCase()
    if (msg.includes('already exists') || msg.includes('duplicate') || msg.includes('resource already')) return
    console.warn('[user-footage] ensureFootageBucket non-fatal:', JSON.stringify(error))
  } catch (err) {
    console.warn('[user-footage] ensureFootageBucket threw (non-fatal):', err instanceof Error ? err.message : String(err))
  }
}

export interface UserFootageItem {
  id: string
  url: string
  kind: string
  size_bytes: number
  created_at: string
}

export async function listUserFootage(userId: string, limit = 40): Promise<UserFootageItem[]> {
  const admin = footageAdminClient()
  const { data, error } = await admin
    .from('user_footage')
    .select('id, url, kind, size_bytes, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('[user-footage] list failed:', error.message)
    return []
  }
  return (data ?? []) as UserFootageItem[]
}

export async function totalFootageBytes(userId: string): Promise<number> {
  const admin = footageAdminClient()
  const { data, error } = await admin
    .from('user_footage')
    .select('size_bytes')
    .eq('user_id', userId)
  if (error) return 0
  return (data ?? []).reduce((sum, r) => sum + (Number((r as { size_bytes: number }).size_bytes) || 0), 0)
}

export const FOOTAGE_PUBLIC_PREFIX = () =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${USER_FOOTAGE_BUCKET}/`
