-- Push #317 — YouTube OAuth tokens stored per user in the profiles table.
-- The column holds the entire YouTubeTokens object as JSONB so we can
-- read/write with a single row update (no separate table needed).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS youtube_tokens JSONB DEFAULT NULL;
