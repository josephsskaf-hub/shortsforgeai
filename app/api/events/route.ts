// Push #060 / #061 — lightweight event tracking.
// Fire-and-forget POST endpoint that inserts a single row into
// public.events. If the table doesn't exist, or the insert fails for any
// reason, we return 200 silently — event tracking must never affect the
// user-facing flow.
//
// Schema (staging, see supabase/migrations/005_events_staging.sql):
//   public.events (
//     id uuid pk default uuid,
//     user_id uuid,
//     name text not null,
//     metadata jsonb default '{}',
//     path text,
//     session_id text,
//     created_at timestamptz default now()
//   )
//
// Body accepted (both shapes — `name` is the legacy field from Push #060,
// `event_name` is the new spec):
//   { name?: string, event_name?: string, metadata?: object, path?: string }

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const rawName = typeof body?.event_name === 'string'
      ? body.event_name
      : typeof body?.name === 'string'
        ? body.name
        : ''
    const name = rawName.trim().slice(0, 64)
    if (!name) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    const metadata =
      body?.metadata && typeof body.metadata === 'object'
        ? body.metadata
        : {}
    const path = typeof body?.path === 'string' ? body.path.slice(0, 256) : null
    const sessionId =
      typeof body?.session_id === 'string'
        ? body.session_id.slice(0, 64)
        : null

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Best-effort insert. We don't care if it succeeds; if the table
    // doesn't exist (42P01) we still return ok. We also try a minimal
    // fallback row in case the metadata / path columns aren't yet present
    // in older staging databases.
    try {
      const row: Record<string, unknown> = {
        name,
        user_id: user?.id ?? null,
      }
      if (metadata && Object.keys(metadata).length > 0) row.metadata = metadata
      if (path) row.path = path
      if (sessionId) row.session_id = sessionId

      const { error } = await supabase.from('events').insert(row)
      // If the insert failed because of an unknown column, retry with the
      // minimal {name, user_id} shape so push #060-era databases still log
      // the event.
      if (error && /column .* does not exist/i.test(error.message ?? '')) {
        await supabase
          .from('events')
          .insert({ name, user_id: user?.id ?? null })
      }
    } catch {
      // swallow
    }

    return NextResponse.json({ ok: true })
  } catch {
    // Always succeed — tracking should never break the calling page.
    return NextResponse.json({ ok: true })
  }
}
