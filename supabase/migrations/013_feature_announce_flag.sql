-- KINEO-FEATURE-ANNOUNCE-2026-07-10 — idempotency flag for the avatar-suite
-- announcement campaign (AI Presenter / Character Lock / Transparent Clips /
-- UGC Ads). Same pattern as pack_offer_emailed: flag on SUCCESSFUL send only,
-- re-runs never double-send.
alter table public.profiles
  add column if not exists feature_announce_emailed boolean not null default false;
