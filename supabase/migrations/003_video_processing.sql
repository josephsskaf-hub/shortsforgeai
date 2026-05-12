-- ============================================================
-- ShortsForgeAI — Push #016/#017
-- Add async-processing state to `videos` table.
-- Idempotent and additive. Safe to re-run.
-- ============================================================

-- 1) updated_at column (for the 15-min stale check)
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2) updated_at trigger (reuses generic helper from migration 001)
DROP TRIGGER IF EXISTS set_videos_updated_at ON videos;
CREATE TRIGGER set_videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- 3) index used by the active-generation lookup and the stale-job sweeper
CREATE INDEX IF NOT EXISTS videos_user_status_idx
  ON videos(user_id, status);
