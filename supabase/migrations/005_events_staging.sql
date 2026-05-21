-- STAGING ONLY: run in staging Supabase SQL editor (ref: quaurrzawdmjmzuzkhqo)
-- Do NOT apply to production Supabase (ref: cqqukkvjjrguayiyjvhh).
--
-- Push #061 — extends the events table introduced in Push #060.
-- The original table used a single `name text` column. This migration:
--   1. Creates the table if it doesn't exist (idempotent — safe to re-run).
--   2. Adds metadata / path / session_id columns used by the new funnel
--      tracking pipeline.
--   3. Enables RLS with insert-only access (service role + authenticated
--      users), and forbids client SELECTs — admin metrics pages query via
--      the service role.

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  path text,
  session_id text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS path text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS session_id text;

CREATE INDEX IF NOT EXISTS events_name_idx ON public.events(name);
CREATE INDEX IF NOT EXISTS events_created_at_idx ON public.events(created_at DESC);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_insert" ON public.events;
CREATE POLICY "service_insert" ON public.events FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "no_public_read" ON public.events;
CREATE POLICY "no_public_read" ON public.events FOR SELECT USING (false);
