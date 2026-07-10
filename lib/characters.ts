// KINEO-CHARACTER-LOCK-2026-07-10 — Character Lock (Feature 2).
// Saved characters: a named portrait the user can reuse across videos so the
// person looks IDENTICAL every time (AI Presenter photo, Avatar Studio face,
// Hollywood dialogue anchor). Service-role helpers, mirroring the
// lib/avatar/storage.ts pattern.
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { uploadAvatarPhoto } from '@/lib/avatar/storage'

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

export interface SavedCharacter {
  id: string
  name: string
  image_url: string
  source: string
  created_at: string
}

/** Per-plan limit: free = 1, any paying account = 12. Characters are a clear
 *  premium surface (Rick wants 3 niches, Storyline360 wants male+female). */
export function characterLimitFor(isPaid: boolean): number {
  return isPaid ? 12 : 1
}

const OUR_STORAGE_PREFIX = () =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`
const FAL_CDN = /^https:\/\/([a-z0-9-]+\.)*fal\.(media|run|ai)\//i

/**
 * Persist the character image into OUR avatars bucket.
 * - Already our storage → returned as-is (no duplicate copy).
 * - fal CDN (generated portrait/scene) → downloaded and re-uploaded, because
 *   fal files can be garbage-collected and a character must live forever.
 * - Anything else → rejected (no SSRF / hot-linking surface).
 */
export async function persistCharacterImage(userId: string, url: string): Promise<string> {
  const clean = (url ?? '').trim()
  if (!clean) throw new Error('Character image URL is required.')
  if (clean.startsWith(OUR_STORAGE_PREFIX())) return clean
  if (!FAL_CDN.test(clean)) throw new Error('Character image must be an uploaded photo or a generated image.')
  const res = await fetch(clean)
  if (!res.ok) throw new Error(`Could not download the character image (${res.status}).`)
  const contentType = (res.headers.get('content-type') ?? '').toLowerCase()
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0) throw new Error('Character image download was empty.')
  if (buf.length > 15 * 1024 * 1024) throw new Error('Character image is too large.')
  const mime: 'image/png' | 'image/jpeg' = contentType.includes('png') ? 'image/png' : 'image/jpeg'
  return uploadAvatarPhoto(userId, buf, mime)
}

export async function listCharacters(userId: string, limit = 24): Promise<SavedCharacter[]> {
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('characters')
    .select('id, name, image_url, source, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    console.warn('[characters] list failed:', error.message)
    return []
  }
  return (data ?? []) as SavedCharacter[]
}

export async function countCharacters(userId: string): Promise<number> {
  const admin = getAdminClient()
  const { count, error } = await admin
    .from('characters')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) {
    console.warn('[characters] count failed:', error.message)
    return 0
  }
  return count ?? 0
}

export async function saveCharacter(args: {
  userId: string
  name: string
  imageUrl: string
  source?: string
}): Promise<SavedCharacter> {
  const admin = getAdminClient()
  const persistedUrl = await persistCharacterImage(args.userId, args.imageUrl)
  const { data, error } = await admin
    .from('characters')
    .insert({
      user_id: args.userId,
      name: args.name.trim().slice(0, 60),
      image_url: persistedUrl,
      source: args.source ?? 'upload',
    })
    .select('id, name, image_url, source, created_at')
    .single()
  if (error || !data) throw new Error(`Could not save the character: ${error?.message ?? 'unknown error'}`)
  return data as SavedCharacter
}

export async function deleteCharacter(userId: string, id: string): Promise<boolean> {
  const admin = getAdminClient()
  const { error } = await admin.from('characters').delete().eq('id', id).eq('user_id', userId)
  if (error) {
    console.warn('[characters] delete failed:', error.message)
    return false
  }
  return true
}

/** Server-side lookup used by generation routes: resolves a character id the
 *  USER owns to its image URL (never trusts a raw URL from the client). */
export async function getCharacterImageUrl(userId: string, characterId: string): Promise<string | null> {
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('characters')
    .select('image_url')
    .eq('id', characterId)
    .eq('user_id', userId)
    .single()
  if (error || !data?.image_url) return null
  return data.image_url as string
}
