// Push #232 — Exit-intent survey sink.
// POST { reason, comment } → inserts one row into public.exit_feedback using
// the Supabase service role key. The survey fires for anonymous visitors
// (no auth session), so we deliberately bypass RLS via the service role
// rather than the cookie client. Always returns 200 so the modal closes
// cleanly even if storage fails — survey collection must never block exit.
//
// ── Run this in the Supabase SQL editor if the table does not exist yet ──
//
//   create table if not exists public.exit_feedback (
//     id uuid primary key default gen_random_uuid(),
//     reason text,
//     comment text,
//     created_at timestamptz not null default now()
//   );
//
//   -- Writes go through the service role key, which bypasses RLS. Keep RLS
//   -- on with no public policies so the table is server-write-only and
//   -- never readable by anon/authenticated clients.
//   alter table public.exit_feedback enable row level security;
//   drop policy if exists "service_insert" on public.exit_feedback;
//   create policy "service_insert" on public.exit_feedback for insert with check (true);
//   drop policy if exists "no_public_read" on public.exit_feedback;
//   create policy "no_public_read" on public.exit_feedback for select using (false);

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    const rawReason = typeof body?.reason === 'string' ? body.reason.trim() : ''
    const reason = rawReason ? rawReason.slice(0, 200) : null
    const rawComment = typeof body?.comment === 'string' ? body.comment.trim() : ''
    const comment = rawComment ? rawComment.slice(0, 2000) : null

    // Nothing meaningful submitted — succeed silently.
    if (!reason && !comment) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      // Don't surface config gaps to the visitor; just no-op.
      return NextResponse.json({ ok: true, stored: false })
    }

    const admin = createServiceClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { error } = await admin
      .from('exit_feedback')
      .insert({ reason, comment })

    if (error) {
      console.error('[exit-feedback] insert error:', error.message)
      return NextResponse.json({ ok: true, stored: false })
    }

    return NextResponse.json({ ok: true, stored: true })
  } catch {
    // Always succeed — the survey must never break the exit flow.
    return NextResponse.json({ ok: true })
  }
}
