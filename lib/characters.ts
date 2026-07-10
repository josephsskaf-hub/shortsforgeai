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
  // KINEO-CHARLOCK-V2-2026-07-10 — fixed traits injected into images.edit
  // prompts ("same face, same <traits>") to reduce identity drift.
  traits?: string | null
}

/** KINEO-CHARLOCK-V2-2026-07-10 — per-plan limits (briefing validated with
 *  paid jobs): FREE = 0 (locked UI is the upgrade bait), Starter/Creator = 3,
 *  Studio = 10. Server-side gate — never localStorage (thumbnail-limit lesson). */
export function characterLimitFor(plan: string, hasPaid: boolean): number {
  const p = (plan ?? '').toLowerCase()
  if (p === 'pro' || p === 'pro_trial') return 10
  if (p === 'basic' || p === 'basic_trial' || p === 'starter' || p === 'starter_trial') return 3
  return hasPaid ? 3 : 0
}

const OUR_STORAGE_PREFIX = () =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`
const FAL_CDN = /^https:\/\/([a-z0-9-]+\.)*fal\.(media|run|ai)\//i
// KINEO-CHARLOCK-V2 — thumbnails come back from OpenAI as azure-blob URLs or
// data URIs; both are legit "save as character" sources.
const OPENAI_CDN = /^https:\/\/([a-z0-9-]+\.)*(oaidalleapiprodscus\.blob\.core\.windows\.net|openai\.com)\//i

/**
 * Persist the character image into OUR avatars bucket.
 * - Already our storage → returned as-is (no duplicate copy).
 * - fal CDN / OpenAI CDN (generated images) → downloaded and re-uploaded,
 *   because those files expire and a character anchor must live forever.
 * - data:image base64 (thumbnail generator results) → decoded and uploaded.
 * - Anything else → rejected (no SSRF / hot-linking surface).
 */
export async function persistCharacterImage(userId: string, url: string): Promise<string> {
  const clean = (url ?? '').trim()
  if (!clean) throw new Error('Character image URL is required.')
  if (clean.startsWith(OUR_STORAGE_PREFIX())) return clean

  // data URI (generated thumbnail) → decode straight to buffer.
  if (clean.startsWith('data:image/')) {
    const comma = clean.indexOf(',')
    if (comma < 0 || !clean.slice(0, comma).includes('base64')) {
      throw new Error('Unsupported image data format.')
    }
    const buf = Buffer.from(clean.slice(comma + 1), 'base64')
    if (buf.length === 0) throw new Error('Character image data was empty.')
    if (buf.length > 15 * 1024 * 1024) throw new Error('Character image is too large.')
    const mime: 'image/png' | 'image/jpeg' = clean.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png'
    return uploadAvatarPhoto(userId, buf, mime)
  }

  if (!FAL_CDN.test(clean) && !OPENAI_CDN.test(clean)) {
    throw new Error('Character image must be an uploaded photo or a generated image.')
  }
  const res = await fetch(clean)
  if (!res.ok) throw new Error(`Could not download the character image (${res.status}).`)
  const contentType = (res.headers.get('content-type') ?? '').toLowerCase()
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length === 0) throw new Error('Character image download was empty.')
  if (buf.length > 15 * 1024 * 1024) throw new Error('Character image is too large.')
  const mime: 'image/png' | 'image/jpeg' = contentType.includes('png') ? 'image/png' : 'image/jpeg'
  return uploadAvatarPhoto(userId, buf, mime)
}

/**
 * KINEO-CHARLOCK-V2 — best-effort trait extraction (GPT-4o-mini vision).
 * Returns a short comma-separated list ("bald, white goatee, rimless glasses")
 * or null on ANY failure — traits improve the lock but must never block a save.
 */
export async function extractCharacterTraits(imageUrl: string): Promise<string | null> {
  try {
    const { openai } = await import('@/lib/openai')
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 60,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'List the 3-5 most distinctive FIXED visual traits of this person for re-identification (hair, facial hair, glasses, notable clothing). Reply ONLY with a short comma-separated list, lowercase, no sentences. Example: "bald, white goatee, rimless glasses, black shirt"',
            },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    })
    const traits = (completion.choices[0]?.message?.content ?? '').trim().replace(/^["']|["']$/g, '').slice(0, 200)
    return traits.length >= 3 ? traits : null
  } catch (e) {
    console.warn('[characters] trait extraction failed (non-blocking):', e instanceof Error ? e.message : String(e))
    return null
  }
}

export async function listCharacters(userId: string, limit = 24): Promise<SavedCharacter[]> {
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('characters')
    .select('id, name, image_url, source, traits, created_at')
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
  traits?: string | null
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
      traits: args.traits ?? null,
    })
    .select('id, name, image_url, source, traits, created_at')
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

/** KINEO-CHARLOCK-V2 — full character record (anchor + traits + name) for the
 *  images.edit regeneration path. Ownership enforced. */
export async function getCharacter(
  userId: string,
  characterId: string,
): Promise<{ name: string; image_url: string; traits: string | null } | null> {
  const admin = getAdminClient()
  const { data, error } = await admin
    .from('characters')
    .select('name, image_url, traits')
    .eq('id', characterId)
    .eq('user_id', userId)
    .single()
  if (error || !data?.image_url) return null
  return data as { name: string; image_url: string; traits: string | null }
}
