-- ============================================================
-- One-time cleanup for the test account josephskaf@hotmail.com
-- Push #016/#017 — Part 9.
--
-- Run in the Supabase SQL editor (service-role context).
-- Only affects rows belonging to josephskaf@hotmail.com.
-- Safe to re-run; the WHERE clauses no-op once the rows are clean.
-- ============================================================

-- 1) Mark any currently-stuck processing generation as cancelled.
--    No credits are deducted on this path.
UPDATE videos
SET status = 'cancelled',
    credits_used = 0,
    updated_at = NOW()
WHERE status = 'processing'
  AND user_id IN (
    SELECT id FROM profiles WHERE email = 'josephskaf@hotmail.com'
  );

-- 2) Restore test credits to 50 for the test account.
UPDATE profiles
SET video_credits = 50
WHERE email = 'josephskaf@hotmail.com';
