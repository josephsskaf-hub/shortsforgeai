-- Migration #009 — Viral Now topics table
-- Stores daily trending topic cards shown on the dashboard.
-- Refresh via /api/cron/refresh-viral-now (runs at 6 AM UTC daily).

CREATE TABLE IF NOT EXISTS viral_now_topics (
  id          SERIAL PRIMARY KEY,
  date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  slot        SMALLINT    NOT NULL CHECK (slot BETWEEN 1 AND 3),  -- 1, 2, or 3
  emoji       TEXT        NOT NULL,
  label       TEXT        NOT NULL,  -- short pill label e.g. "💸 Money"
  title       TEXT        NOT NULL,  -- card headline
  prompt      TEXT        NOT NULL,  -- pre-built prompt sent to /generate
  duration    SMALLINT    NOT NULL DEFAULT 45,
  vertical    TEXT        NOT NULL,  -- billionaire | mystery | country | money | learning
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (date, slot)
);

-- Enable RLS (public can read today's topics, only service role writes)
ALTER TABLE viral_now_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read today viral topics"
  ON viral_now_topics FOR SELECT
  USING (date = CURRENT_DATE);

-- Only service role (server-side) can insert/update
-- (no insert policy = only service role key can write)
