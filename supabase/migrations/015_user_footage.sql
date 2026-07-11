-- KINEO-USER-FOOTAGE-2026-07-10 — "My footage" (Prioridade 2 do briefing;
-- pedido literal do cliente $200/mês Abhijeet: "How do I add my own
-- photos/videos raw footage along with my own script?").
-- Tabela-biblioteca dos clipes/fotos do usuário; os arquivos vivem no bucket
-- público 'user-footage' (upload direto via signed URL — bypass do limite de
-- body da Vercel). Quota por plano validada NO SERVIDOR somando size_bytes.

create table if not exists public.user_footage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  kind text not null default 'video', -- 'video' | 'image'
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists user_footage_user_created_idx
  on public.user_footage (user_id, created_at desc);

alter table public.user_footage enable row level security;

drop policy if exists "user_footage_select_own" on public.user_footage;
create policy "user_footage_select_own" on public.user_footage
  for select using (auth.uid() = user_id);

drop policy if exists "user_footage_insert_own" on public.user_footage;
create policy "user_footage_insert_own" on public.user_footage
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_footage_delete_own" on public.user_footage;
create policy "user_footage_delete_own" on public.user_footage
  for delete using (auth.uid() = user_id);
