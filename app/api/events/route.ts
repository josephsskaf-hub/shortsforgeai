// Push #060 — lightweight event tracking.
// Fire-and-forget POST endpoint that inserts a single row into
// public.events if that table exists in this Supabase project. If the
// table doesn't exist, or the insert fails for any reason, we return 200
// silently — event tracking must never affect the user-facing flow.
//
// Schema we assume (created out-of-band in staging only):
//   public.events (id uuid pk default uuid, name text not null,
//                  user_id uuid, created_at timestamptz default now())

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_EVENTS = new Set([
  'pricing_view',
  'checkout_basic_click',
  'checkout_pro_click',
  'generate_started',
  'generate_completed',
  'generate_failed',
])

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const name = typeof body?.name === 'string' ? body.name : ''
    if (!ALLOWED_EVENTS.has(name)) {
      // Unknown / unsafe event name — silently succeed so the client never
      // retries or errors out on tracking.
      return NextResponse.json({ ok: true, ignored: true })
    }

    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Best-effort insert. We don't care if it succeeds; if the table
    // doesn't exist (42P01) we still return ok.
    try {
      await supabase
        .from('events')
        .insert({
          name,
          user_id: user?.id ?? null,
        })
    } catch {
      // swallow
    }

    return NextResponse.json({ ok: true })
  } catch {
    // Always succeed — tracking should never break the calling page.
    return NextResponse.json({ ok: true })
  }
}
