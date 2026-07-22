import { createClient as createSupabaseClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { createClient as createCookieClient } from '@/lib/supabase/server'

export type AnimateRequestAuth = {
  supabase: SupabaseClient
  user: User
  method: 'bearer' | 'cookie'
}

/**
 * Browser calls keep using the normal Supabase cookie session. Automation may
 * send its own short-lived Supabase access token as Authorization: Bearer.
 * The token is validated with auth.getUser and the same token is attached to
 * PostgREST/RPC calls, so RLS and debit_video_credits still run as that user.
 */
export async function authenticateAnimateRequest(req: NextRequest): Promise<AnimateRequestAuth | null> {
  const authorization = req.headers.get('authorization')?.trim() ?? ''
  if (authorization) {
    const match = /^Bearer\s+([^\s]{20,4096})$/i.exec(authorization)
    if (!match) return null
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) return null
    const token = match[1]
    const supabase = createSupabaseClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return null
    return { supabase, user, method: 'bearer' }
  }

  const supabase = createCookieClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ? { supabase, user, method: 'cookie' } : null
}
