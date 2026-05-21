-- ============================================================
-- ShortsForgeAI — Initial Schema Migration
-- Run this in the Supabase SQL editor or via supabase db push
-- ============================================================

-- ─── profiles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                       UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email                    TEXT,
  is_pro                   BOOLEAN DEFAULT FALSE,
  generations_used         INTEGER DEFAULT 0,
  free_generations_remaining INTEGER DEFAULT 5,
  plan                     TEXT DEFAULT 'free',
  stripe_customer_id       TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ─── generations ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generations (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  niche       TEXT NOT NULL,
  content     JSONB,
  scripts     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

-- profiles policies
DROP POLICY IF EXISTS "Users can view own profile"   ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- generations policies
DROP POLICY IF EXISTS "Users can view own generations"   ON generations;
DROP POLICY IF EXISTS "Users can insert own generations" ON generations;

CREATE POLICY "Users can view own generations"
  ON generations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generations"
  ON generations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── Auto-create profile on signup ──────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, is_pro, generations_used)
  VALUES (NEW.id, NEW.email, FALSE, 0)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ─── updated_at trigger ─────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON profiles;

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
