-- ============================================================
-- ShortsForgeAI — Supabase Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES TABLE
-- ============================================================
create table if not exists public.profiles (
  id                    uuid references auth.users on delete cascade primary key,
  email                 text not null,
  is_pro                boolean not null default false,
  generations_used      int not null default 0,
  stripe_customer_id    text,
  stripe_subscription_id text,
  created_at            timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Service role can do everything (for webhooks)
create policy "Service role full access on profiles"
  on public.profiles for all
  using (auth.role() = 'service_role');

-- ============================================================
-- GENERATIONS TABLE
-- ============================================================
create table if not exists public.generations (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references public.profiles(id) on delete cascade not null,
  niche      text not null,
  content    jsonb not null,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.generations enable row level security;

-- Policies
create policy "Users can view own generations"
  on public.generations for select
  using (auth.uid() = user_id);

create policy "Users can insert own generations"
  on public.generations for insert
  with check (auth.uid() = user_id);

create policy "Service role full access on generations"
  on public.generations for all
  using (auth.role() = 'service_role');

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP TRIGGER
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists generations_user_id_idx on public.generations(user_id);
create index if not exists generations_created_at_idx on public.generations(created_at desc);
create index if not exists profiles_stripe_customer_id_idx on public.profiles(stripe_customer_id);
