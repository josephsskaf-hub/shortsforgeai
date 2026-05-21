-- Push #088 — Cinematic Tokens
-- Separates Runway/Cinematic usage from the regular `video_credits` pool
-- so the Pro plan can include exactly 1 Cinematic video / month without
-- making it possible to "cinema-spend" the regular 100 Fast Mode credits.
--
-- Run this in the Supabase SQL editor for the active project (staging or
-- production). Idempotent — safe to re-run.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cinematic_tokens INTEGER NOT NULL DEFAULT 0;

-- Seed existing Pro users with 1 token so the new gate doesn't lock them
-- out immediately. Subsequent monthly resets are handled by the Stripe
-- renewal webhook + the /api/cron/reset-cinematic-tokens cron job.
UPDATE public.profiles
  SET cinematic_tokens = 1
  WHERE (is_pro = TRUE OR plan = 'pro') AND cinematic_tokens < 1;

-- Helper used by the monthly cron. Resets every Pro user's tokens to 1
-- regardless of their previous balance (a missed reset shouldn't carry
-- multiple months of tokens forward).
CREATE OR REPLACE FUNCTION public.reset_cinematic_tokens_for_pro()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
    SET cinematic_tokens = 1
    WHERE is_pro = TRUE OR plan = 'pro';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow the service role to call the function. Anon/auth users have no
-- direct execute path — the cron route hits this through the service-role
-- client.
REVOKE ALL ON FUNCTION public.reset_cinematic_tokens_for_pro() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_cinematic_tokens_for_pro() TO service_role;
