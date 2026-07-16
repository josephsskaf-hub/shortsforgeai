import { createClient as createServiceClient } from '@supabase/supabase-js'

type ServerEventInput = {
  name: string
  userId?: string | null
  metadata?: Record<string, unknown>
  path?: string | null
  sessionId?: string | null
}

/**
 * Persist an authoritative funnel event from a server route or Server
 * Component. Analytics must never interrupt auth or product navigation, so the
 * helper reports failure instead of throwing.
 */
export async function writeServerEvent(input: ServerEventInput): Promise<boolean> {
  try {
    const name = input.name.trim().slice(0, 64)
    if (!name) return false

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      console.error('[server-events] Supabase service role is not configured')
      return false
    }

    const admin = createServiceClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const row: Record<string, unknown> = {
      name,
      user_id: input.userId ?? null,
    }
    if (input.metadata && Object.keys(input.metadata).length > 0) {
      row.metadata = input.metadata
    }
    if (input.path) row.path = input.path.slice(0, 256)
    if (input.sessionId) row.session_id = input.sessionId.slice(0, 64)

    let { error } = await admin.from('events').insert(row)
    // Keep deploys compatible with older projects that still expose only the
    // original {name, user_id} event columns.
    if (error && /column .* does not exist/i.test(error.message ?? '')) {
      const fallback = await admin
        .from('events')
        .insert({ name, user_id: input.userId ?? null })
      error = fallback.error
    }

    if (error) {
      console.error('[server-events] insert failed:', error.message)
      return false
    }
    return true
  } catch (error) {
    console.error('[server-events] unexpected failure:', error)
    return false
  }
}
