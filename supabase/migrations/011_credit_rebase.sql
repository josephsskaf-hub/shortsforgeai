-- KINEO-REBASE-2026-07-10 — CREDIT REBASE 2:1 (one-time balance conversion).
--
-- The whole credit economy was divided by 2 on 10/07/2026: plan grants
-- (Starter 50→25, Creator 240→120, Studio 400→200), engine costs
-- (Seedance 40→20, Kling 90→45, Veo 180→90, Sora 200→100, Hollywood 260→150,
-- Avatar 220→110, Animate 10→5, legacy 15/15/20→8/8/10) and every UI surface.
-- USD prices are UNCHANGED — 1 new credit is worth exactly 2 old credits.
--
-- This migration converts existing user balances so nobody loses value:
-- video_credits are halved, rounding UP (ceil) so odd balances round in the
-- USER'S favor (e.g. 45 old → 23 new, worth 46 old).
--
-- avatar_credits is INTENTIONALLY untouched — the legacy avatar add-on
-- balance was never part of the universal video_credits economy.
--
-- Run ONCE in prod, at the same time the KINEO-REBASE code deploy goes live.

update profiles
set video_credits = ceil(video_credits / 2.0)
where video_credits > 0;
