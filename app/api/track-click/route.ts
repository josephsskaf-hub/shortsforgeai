// Push #233 — checkout/upgrade click tracking sink.
// POST { event, plan } → inserts one row into public.click_events using the
// Supabase service role key (bypasses RLS so anonymous visitors can be
// tracked). user_id is resolved server-side from the session cookie rather
// than trusting the request body. Always returns 200 — this is a
// fire-and-forget call from the click handler and must never block the user.
//
// ── Run this in the Supabase SQL editor if the table does not exist yet ──
//
//   create table if not exists public.click_events (
//     id uuid primary key default gen_random_uuid(),
//     event text not null,
//     plan text,
//     user_id uuid references auth.users(id) on delete set null,
//     created_at timestamptz not null default now()
//   );
//
//   -- Writes go through the service role key (bypasses RLS). Keep RLS on
//   -- with no public policies so the table is server-write-only and never
//   -- readable by anon/authenticated clients (admins read via service role).
//   alter table public.click_events enable row level security;
//   drop policy if exists "service_insert" on public.click_events;
//   create policy "service_insert" on public.click_events for insert with check (true);
//   drop policy if exists "no_public_read" on public.click_events;
//   create policy "no_public_read" on public.click_events for select using (false);

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    const rawEvent = typeof body?.event === 'string' ? body.event.trim() : ''
    const event = rawEvent ? rawEvent.slice(0, 64) : 'checkout_click'
    const rawPlan = typeof body?.plan === 'string' ? body.plan.trim().toLowerCase() : ''
    const plan = rawPlan === 'basic' || rawPlan === 'pro' ? rawPlan : null

    // Resolve the user from the session cookie (don't trust a client-sent id).
    let userId: string | null = null
    try {
      const cookieClient = createClient()
      const {
        data: { user },
      } = await cookieClient.auth.getUser()
      userId = user?.id ?? null
    } catch {
      // anonymous — leave userId null
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ ok: true, stored: false })
    }

    const admin = createServiceClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { error } = await admin
      .from('click_events')
      .insert({ event, plan, user_id: userId })

    if (error) {
      console.error('[track-click] insert error:', error.message)
      return NextResponse.json({ ok: true, stored: false })
    }

    return NextResponse.json({ ok: true, stored: true })
  } catch {
    // Always succeed — click tracking must never break the user flow.
    return NextResponse.json({ ok: true })
  }
}
