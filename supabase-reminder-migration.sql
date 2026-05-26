-- Migration: add reminder_sent_at to profiles
-- Run once in Supabase SQL editor before deploying conversion-v1
alter table public.profiles
  add column if not exists reminder_sent_at timestamptz default null;

-- Index so the cron query is fast
create index if not exists profiles_reminder_sent_at_idx
  on public.profiles (reminder_sent_at)
  where reminder_sent_at is null;
