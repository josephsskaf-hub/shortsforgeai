-- PUSH #270 — Zero out free credits for non-paying users
-- Run this in Supabase SQL editor BEFORE or AFTER deploying the code fix.

-- 1. Change the column default to 0 so all NEW signups start with 0 credits
ALTER TABLE profiles ALTER COLUMN video_credits SET DEFAULT 0;

-- 2. Zero out existing free users who got the 1 free credit but haven't paid
--    Only affects users with exactly 1 credit (the free signup credit).
--    Users with 2+ credits are preserved — they may have earned them.
UPDATE profiles
SET video_credits = 0
WHERE (plan IS NULL OR plan = 'free')
  AND is_pro = FALSE
  AND stripe_customer_id IS NULL
  AND video_credits = 1;  -- preserves users with 2+ credits

-- Verify: should return 0 rows after running
SELECT id, email, video_credits, plan, is_pro, stripe_customer_id
FROM profiles
WHERE (plan IS NULL OR plan = 'free')
  AND is_pro = FALSE
  AND stripe_customer_id IS NULL
  AND video_credits = 1;  -- preserves users with 2+ credits
