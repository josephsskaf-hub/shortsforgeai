-- Push #339 — Increase free signup credits from 2 → 3
-- Run in Supabase SQL Editor (project: shortsforgeai)

-- 1. Change the default for new signups
ALTER TABLE profiles ALTER COLUMN video_credits SET DEFAULT 3;

-- 2. Give existing free users who still have exactly 2 credits the extra 1
UPDATE profiles
SET video_credits = 3
WHERE (plan IS NULL OR plan = 'free')
  AND is_pro = FALSE
  AND stripe_customer_id IS NULL
  AND video_credits = 2;

-- Verify
SELECT
  COUNT(*) AS free_users_with_3_credits
FROM profiles
WHERE (plan IS NULL OR plan = 'free')
  AND is_pro = FALSE
  AND stripe_customer_id IS NULL
  AND video_credits = 3;
