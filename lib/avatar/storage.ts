// AI Avatar (feature/ai-avatar) — photo storage helpers.
// Mirrors the voiceover storage pattern in lib/compose.ts (#049): service-role
// admin client + idempotent public-bucket bootstrap + upload returning the
// public URL (Creatomate/fal must reach the file with no auth headers).
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

export const AVATARS_BUCKET = 'avatars'

let cachedAdminClient: SupabaseClient | null = null
function getAdminClient(): SupabaseClient {
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

/** Idempotent bucket bootstrap — "already exists" responses are benign.
 *  Avatar Studio (12/06): the bucket now also accepts short source VIDEOS
 *  (mp4/quicktime, ≤60MB) for the lipsync engine, so existing buckets are
 *  updated in place (updateBucket is idempotent too). */
// Fix 12/06 (prod 500s) — 40MB, NOT 60: Supabase's plan-level cap is 50MB on
// free tier, and createBucket/updateBucket VALIDATE the config before the
// duplicate check, so 60MB made the call fail on the existing bucket and the
// old code treated that as fatal → every photo upload 500'd. We now check
// getBucket FIRST and never let bucket housekeeping kill an upload.
const AVATARS_BUCKET_CONFIG = {
  public: true,
  fileSizeLimit: 40 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'],
}

async function ensureAvatarsBucket(admin: SupabaseClient): Promise<void> {
  try {
    const { data: existing } = await admin.storage.getBucket(AVATARS_BUCKET)
    if (existing) {
      // Best-effort config refresh (video MIMEs / size). Never blocks.
      const { error: updErr } = await admin.storage.updateBucket(AVATARS_BUCKET, AVATARS_BUCKET_CONFIG)
      if (updErr) console.warn('[avatar/storage] updateBucket failed (non-blocking):', updErr.message)
      return
    }
    const { error } = await admin.storage.createBucket(AVATARS_BUCKET, AVATARS_BUCKET_CONFIG)
    if (!error) {
      console.log(`[avatar/storage] created storage bucket "${AVATARS_BUCKET}"`)
      return
    }
    const msg = (error.message ?? '').toLowerCase()
    if (msg.includes('already exists') || msg.includes('duplicate') || msg.includes('resource already')) {
      return
    }
    // Don't throw — the upload below will fail loudly if the bucket is truly
    // missing; a config validation hiccup must not take the feature down.
    console.warn('[avatar/storage] ensureAvatarsBucket non-fatal:', JSON.stringify(error))
  } catch (err) {
    console.warn('[avatar/storage] ensureAvatarsBucket threw (non-fatal):', err instanceof Error ? err.message : String(err))
  }
}

/**
 * Upload a face photo and return its public URL.
 * Path is namespaced per user so uploads never collide across accounts.
 */
export async function uploadAvatarPhoto(
  userId: string,
  buffer: Buffer,
  contentType: 'image/jpeg' | 'image/png' | 'video/mp4' | 'video/quicktime',
): Promise<string> {
  const admin = getAdminClient()
  await ensureAvatarsBucket(admin)

  const ext =
    contentType === 'image/png' ? 'png'
    : contentType === 'video/mp4' ? 'mp4'
    : contentType === 'video/quicktime' ? 'mov'
    : 'jpg'
  const prefix = contentType.startsWith('video/') ? 'source-video' : 'face'
  const filePath = `${userId}/${prefix}-${Date.now()}.${ext}`
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)

  const { error: uploadError } = await admin.storage
    .from(AVATARS_BUCKET)
    .upload(filePath, bytes, { contentType, cacheControl: '3600', upsert: false })

  if (uploadError) {
    console.error('[avatar/storage] upload failed:', JSON.stringify({
      name: uploadError.name,
      message: uploadError.message,
    }))
    throw new Error(`Avatar photo upload failed: ${uploadError.message}`)
  }

  const { data: pub } = admin.storage.from(AVATARS_BUCKET).getPublicUrl(filePath)
  if (!pub?.publicUrl) throw new Error('Avatar upload succeeded but no public URL was returned.')
  console.log(`[avatar/storage] photo stored: ${pub.publicUrl}`)
  return pub.publicUrl
}

// ── Face-app wave 1 (12/06) — avatar library ────────────────────────────────
// Approved (face-checked) photos are saved per user so /generate can offer
// one-click reuse instead of forcing a re-upload + re-check every video.

/** Best-effort save into the library — a failure must never fail the upload. */
export async function saveAvatarToLibrary(userId: string, url: string): Promise<void> {
  try {
    const admin = getAdminClient()
    const { error } = await admin.from('user_avatars').insert({ user_id: userId, url })
    if (error) console.warn('[avatar/storage] library insert failed (non-blocking):', error.message)
  } catch (err) {
    console.warn('[avatar/storage] library insert threw (non-blocking):', err instanceof Error ? err.message : String(err))
  }
}

export interface SavedAvatar {
  id: string
  url: string
  created_at: string
}

/** Latest saved faces for the user (service-role read, capped). */
export async function listUserAvatars(userId: string, limit = 6): Promise<SavedAvatar[]> {
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('user_avatars')
    .select('id, url, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('[avatar/storage] library list failed:', error.message)
    return []
  }
  return (data ?? []) as SavedAvatar[]
}
