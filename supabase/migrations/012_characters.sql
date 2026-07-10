-- KINEO-CHARACTER-LOCK-2026-07-10 — Character Lock (Feature 2, Upwork-validated)
-- Saved characters: a named face/portrait the user can reuse in ANY future
-- video (AI Presenter, Avatar Studio, Hollywood dialogue anchor) so the person
-- looks IDENTICAL across videos. Real client demand: Rick (3 channel niches),
-- Choice School ("Hope" advisor), Storyline360 (corporate presenters).
--
-- image_url always points at OUR public `avatars` storage bucket (external/fal
-- URLs are mirrored server-side before insert — fal CDN files can be GC'd).

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  image_url text not null,
  -- where the character came from: 'upload' | 'scene' | 'hollywood' | 'other'
  source text not null default 'upload',
  created_at timestamptz not null default now()
);

create index if not exists characters_user_created_idx
  on public.characters (user_id, created_at desc);

-- RLS: owners only. All API access goes through our routes (service role or
-- authed client), but the table must never be readable via the anon key
-- (lesson: rls-disabled hotmart_payments/partners finding, 01/07).
alter table public.characters enable row level security;

drop policy if exists "characters_select_own" on public.characters;
create policy "characters_select_own" on public.characters
  for select using (auth.uid() = user_id);

drop policy if exists "characters_insert_own" on public.characters;
create policy "characters_insert_own" on public.characters
  for insert with check (auth.uid() = user_id);

drop policy if exists "characters_delete_own" on public.characters;
create policy "characters_delete_own" on public.characters
  for delete using (auth.uid() = user_id);
