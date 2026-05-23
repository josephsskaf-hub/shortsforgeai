-- STAGING ONLY: run in staging Supabase SQL editor (ref: quaurrzawdmjmzuzkhqo)
-- Do NOT apply to production Supabase (ref: cqqukkvjjrguayiyjvhh) without review.
--
-- Push #233 — checkout/upgrade click tracking. The Basic/Pro checkout
-- buttons POST { event, plan } to /api/track-click, which writes here using
-- the service role key. RLS stays on with insert-only + no public read so
-- the table is server-write-only (admin /api/admin/click-stats reads via
-- the service role).

CREATE TABLE IF NOT EXISTS public.click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  plan text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS click_events_plan_idx ON public.click_events(plan);
CREATE INDEX IF NOT EXISTS click_events_created_at_idx ON public.click_events(created_at DESC);

ALTER TABLE public.click_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_insert" ON public.click_events;
CREATE POLICY "service_insert" ON public.click_events FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "no_public_read" ON public.click_events;
CREATE POLICY "no_public_read" ON public.click_events FOR SELECT USING (false);
