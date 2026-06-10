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

/** Idempotent bucket bootstrap — "already exists" responses are benign. */
async function ensureAvatarsBucket(admin: SupabaseClient): Promise<void> {
  const { error } = await admin.storage.createBucket(AVATARS_BUCKET, {
    public: true,
    fileSizeLimit: 8 * 1024 * 1024, // 8 MB — plenty for a face photo
    allowedMimeTypes: ['image/jpeg', 'image/png'],
  })
  if (!error) {
    console.log(`[avatar/storage] created storage bucket "${AVATARS_BUCKET}"`)
    return
  }
  const msg = (error.message ?? '').toLowerCase()
  if (msg.includes('already exists') || msg.includes('duplicate') || msg.includes('resource already')) {
    return
  }
  console.error('[avatar/storage] ensureAvatarsBucket error:', JSON.stringify(error))
  throw new Error(`Could not ensure avatars bucket: ${error.message}`)
}

/**
 * Upload a face photo and return its public URL.
 * Path is namespaced per user so uploads never collide across accounts.
 */
export async function uploadAvatarPhoto(
  userId: string,
  buffer: Buffer,
  contentType: 'image/jpeg' | 'image/png',
): Promise<string> {
  const admin = getAdminClient()
  await ensureAvatarsBucket(admin)

  const ext = contentType === 'image/png' ? 'png' : 'jpg'
  const filePath = `${userId}/face-${Date.now()}.${ext}`
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
