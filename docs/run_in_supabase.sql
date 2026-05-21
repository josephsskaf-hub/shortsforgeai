-- ============================================================
-- Push #088 — Run this in the Supabase SQL Editor to activate
-- cinematic_tokens (the 1-per-month Runway token system).
-- ============================================================
-- This is a verbatim copy of supabase/migrations/006_cinematic_tokens.sql,
-- kept here as a no-tool-needed paste target. Idempotent — safe to re-run
-- on any environment.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cinematic_tokens INTEGER NOT NULL DEFAULT 0;

UPDATE public.profiles
  SET cinematic_tokens = 1
  WHERE (is_pro = TRUE OR plan = 'pro') AND cinematic_tokens < 1;

CREATE OR REPLACE FUNCTION public.reset_cinematic_tokens_for_pro()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
    SET cinematic_tokens = 1
    WHERE is_pro = TRUE OR plan = 'pro';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.reset_cinematic_tokens_for_pro() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_cinematic_tokens_for_pro() TO service_role;

-- ============================================================
-- Verify
-- ============================================================
-- SELECT id, is_pro, plan, video_credits, cinematic_tokens
--   FROM public.profiles
--   WHERE is_pro = TRUE OR plan = 'pro'
--   ORDER BY created_at DESC LIMIT 20;
