-- PUSH #299 — 2 free credits on signup (up from 1)
-- Run this in Supabase SQL editor AFTER deploying.

-- 1. Change the column default to 2 so all NEW signups get 2 credits
ALTER TABLE profiles ALTER COLUMN video_credits SET DEFAULT 2;

-- 2. Give existing free users who currently have 1 credit → 2 credits
--    (they signed up recently and haven't paid yet)
UPDATE profiles
SET video_credits = 2
WHERE (plan IS NULL OR plan = 'free')
  AND is_pro = FALSE
  AND stripe_customer_id IS NULL
  AND video_credits = 1;

-- Verify: should show free users now at 2 credits
SELECT COUNT(*) as free_users_now_at_2
FROM profiles
WHERE (plan IS NULL OR plan = 'free')
  AND is_pro = FALSE
  AND stripe_customer_id IS NULL
  AND video_credits = 2;
