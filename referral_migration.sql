-- ============================================================
-- ShortsForgeAI — Referral Loop
-- "Invite a friend, you both get free credits."
--
-- Additive, idempotent migration. Adds four nullable columns to
-- public.profiles plus a unique index on the shareable code.
-- Does NOT drop or alter any existing column. Safe to re-run on
-- staging or production. Run this in the Supabase SQL editor.
-- ============================================================

-- 1) The user's own shareable referral code (8-char uppercase
--    alphanumeric, ambiguous chars 0/O/1/I excluded). Minted lazily
--    by GET /api/referral on first request. Nullable until minted.
alter table public.profiles
  add column if not exists referral_code text;

-- 2) Who referred this user (the referrer's profiles.id). Set once at
--    attribution time (first-touch wins). ON DELETE SET NULL so deleting
--    a referrer never cascade-deletes the people they referred.
alter table public.profiles
  add column if not exists referred_by uuid references public.profiles(id) on delete set null;

-- 3) Idempotency flag: has THIS user's referral reward already been paid?
--    Flipped to true (together with the credit grant) in one update by
--    POST /api/referral/qualify so a retry can never double-pay.
alter table public.profiles
  add column if not exists referral_reward_granted boolean default false;

-- 4) How many successful referrals this user has driven (the referrer's
--    running total; also drives the abuse cap MAX_REFERRALS_PER_USER).
alter table public.profiles
  add column if not exists referral_count integer default 0;

-- 5) Unique index on the shareable code. Partial (where referral_code is
--    not null) so the many existing NULLs never collide while still
--    guaranteeing every minted code is globally unique.
create unique index if not exists profiles_referral_code_key
  on public.profiles (referral_code)
  where referral_code is not null;
