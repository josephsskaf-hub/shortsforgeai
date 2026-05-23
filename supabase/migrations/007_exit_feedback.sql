-- STAGING ONLY: run in staging Supabase SQL editor (ref: quaurrzawdmjmzuzkhqo)
-- Do NOT apply to production Supabase (ref: cqqukkvjjrguayiyjvhh) without review.
--
-- Push #232 — exit-intent survey storage. The homepage exit-intent modal
-- POSTs { reason, comment } to /api/exit-feedback, which writes here using
-- the service role key. RLS stays on with insert-only + no public read so
-- the table is server-write-only (admins read via the service role).

CREATE TABLE IF NOT EXISTS public.exit_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reason text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS exit_feedback_created_at_idx ON public.exit_feedback(created_at DESC);

ALTER TABLE public.exit_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_insert" ON public.exit_feedback;
CREATE POLICY "service_insert" ON public.exit_feedback FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "no_public_read" ON public.exit_feedback;
CREATE POLICY "no_public_read" ON public.exit_feedback FOR SELECT USING (false);
