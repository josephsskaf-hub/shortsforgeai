-- ============================================================
-- ShortsForgeAI — Push #050
-- Ensure the `videos` table exists with every column the runtime
-- code expects, plus the columns push #050 adds (duration, quality,
-- render_id). Fully idempotent — safe to re-run on any environment
-- (staging or production). Run from the Supabase SQL editor.
--
-- NOTE: this migration is staging-targeted for push #050. Production
-- already has a `videos` table from older work; the IF NOT EXISTS
-- guards make this a no-op there.
-- ============================================================

-- 1) Base table — present on most envs already; the IF NOT EXISTS
--    guard means we never clobber an existing table.
CREATE TABLE IF NOT EXISTS videos (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'processing',
  video_url     TEXT,
  credits_used  INT DEFAULT 0,
  topic         TEXT,
  script        TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Columns that push #050 wants surfaced in Visual History. Each is
--    additive — if it already exists the ALTER is a no-op.
ALTER TABLE videos ADD COLUMN IF NOT EXISTS duration       INT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS quality        TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS platform       TEXT DEFAULT 'YouTube Shorts';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS render_id      TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail_url  TEXT;

-- 3) updated_at trigger — reuses the generic helper from migration 001.
DROP TRIGGER IF EXISTS set_videos_updated_at ON videos;
CREATE TRIGGER set_videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- 4) Indexes used by the Visual History list + the existing active-
--    generation lookup.
CREATE INDEX IF NOT EXISTS videos_user_status_idx ON videos(user_id, status);
CREATE INDEX IF NOT EXISTS videos_user_created_idx ON videos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS videos_render_id_idx ON videos(render_id);

-- 5) RLS — owner-only read; INSERTs / UPDATEs go through the service
--    role (used by /api/compose and /api/compose/status), which
--    bypasses RLS, so we only need SELECT policies on the user side.
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own videos" ON videos;
CREATE POLICY "Users can view own videos"
  ON videos FOR SELECT
  USING (auth.uid() = user_id);
