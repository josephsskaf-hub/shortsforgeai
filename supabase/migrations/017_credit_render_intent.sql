-- KINEO-CREDIT-INTENT-2026-07-11 — close the credit leak in /api/compose/status.
--
-- ⚠️ APLICAR NO SUPABASE ANTES DO DEPLOY (run this migration first, then deploy
--    the code). If the code ships first, every new render's recordRenderIntent()
--    insert fails (table missing) → compose/status falls back to the legacy
--    client-param path → the leak stays open until the table exists. Applying
--    the table FIRST is harmless to the currently-live code (nothing reads it
--    yet), so there is no bad ordering window.
--
-- WHAT / WHY:
--   render_jobs pins the ENGINE (quality) and the intended COST to the
--   render_id at the moment the render is created, server-side, before the user
--   can poll status. /api/compose/status then reads the engine from HERE and
--   IGNORES the client-supplied ?quality / ?deducted query params for the
--   billing decision. That kills the forge-"?quality=fast&deducted=1"-to-get-a-
--   free-Avatar exploit (the recurrence of "avatar nunca debitava por quality
--   ausente").
--
--   Reads/writes go through the service-role client, so RLS is not required for
--   correctness. We still enable owner-scoped RLS as defense in depth.

create table if not exists public.render_jobs (
  render_id  text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  quality    text not null,
  cost       integer not null default 0,
  created_at timestamptz not null default now()
);

-- Fast lookups by owner (the read is by render_id PK, but this helps the
-- occasional per-user audit / cleanup query).
create index if not exists render_jobs_user_id_idx on public.render_jobs (user_id);

-- Defense in depth: owners may read their own intent rows; writes happen only
-- through the service role (which bypasses RLS), so there is no INSERT/UPDATE
-- policy for end users on purpose.
alter table public.render_jobs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'render_jobs'
      and policyname = 'Users can read own render jobs'
  ) then
    create policy "Users can read own render jobs"
      on public.render_jobs
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;
