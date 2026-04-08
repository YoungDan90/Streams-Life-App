-- ============================================================
-- Streams Life — Full Database Schema with RLS
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  big_why TEXT,
  notification_time TEXT,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  subscription_plan TEXT NOT NULL DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro')),
  notify_checkin BOOLEAN NOT NULL DEFAULT TRUE,
  notify_weekly BOOLEAN NOT NULL DEFAULT TRUE,
  notify_goals BOOLEAN NOT NULL DEFAULT TRUE,
  appearance_mode TEXT NOT NULL DEFAULT 'light' CHECK (appearance_mode IN ('light', 'dark')),
  text_size TEXT NOT NULL DEFAULT 'medium' CHECK (text_size IN ('small', 'medium', 'large')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================
-- LIFE AREAS
-- ============================================================
CREATE TABLE IF NOT EXISTS life_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_custom BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE life_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own life areas"
  ON life_areas FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- CHECKINS
-- ============================================================
CREATE TABLE IF NOT EXISTS checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  scores JSONB NOT NULL DEFAULT '{}',
  focus_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own checkins"
  ON checkins FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS checkins_user_date_idx ON checkins(user_id, date DESC);

-- ============================================================
-- GOALS
-- ============================================================
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  life_area_id UUID REFERENCES life_areas(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  target_date DATE NOT NULL,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own goals"
  ON goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- GOAL ACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS goal_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  action_text TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE goal_actions ENABLE ROW LEVEL SECURITY;

-- RLS via goal → user
CREATE POLICY "Users can manage own goal actions"
  ON goal_actions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = goal_actions.goal_id
        AND goals.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM goals
      WHERE goals.id = goal_actions.goal_id
        AND goals.user_id = auth.uid()
    )
  );

-- ============================================================
-- FOCUS SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  life_area_id UUID REFERENCES life_areas(id) ON DELETE SET NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own focus sessions"
  ON focus_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS sessions_user_completed_idx ON focus_sessions(user_id, completed_at DESC);

-- ============================================================
-- COACH CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS coach_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE coach_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conversations"
  ON coach_conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS conversations_user_created_idx ON coach_conversations(user_id, created_at DESC);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, onboarding_complete)
  VALUES (NEW.id, FALSE)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- VISION BOARD ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS vision_board_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image', 'quote', 'goal')),
  content TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vision_board_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own vision board items"
  ON vision_board_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS vision_board_user_idx ON vision_board_items(user_id, created_at DESC);

-- ============================================================
-- FEEDBACK
-- ============================================================
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- MIGRATION: Add new profile columns to existing installs
-- (Safe to run on a fresh install too — IF NOT EXISTS handles it)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='subscription_plan') THEN
    ALTER TABLE profiles ADD COLUMN subscription_plan TEXT NOT NULL DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='notify_checkin') THEN
    ALTER TABLE profiles ADD COLUMN notify_checkin BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='notify_weekly') THEN
    ALTER TABLE profiles ADD COLUMN notify_weekly BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='notify_goals') THEN
    ALTER TABLE profiles ADD COLUMN notify_goals BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='appearance_mode') THEN
    ALTER TABLE profiles ADD COLUMN appearance_mode TEXT NOT NULL DEFAULT 'light' CHECK (appearance_mode IN ('light', 'dark'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='text_size') THEN
    ALTER TABLE profiles ADD COLUMN text_size TEXT NOT NULL DEFAULT 'medium' CHECK (text_size IN ('small', 'medium', 'large'));
  END IF;
END $$;

-- ============================================================
-- DATA RETENTION (optional scheduled job via pg_cron)
-- ============================================================
-- To enable 12-month checkin retention and 30-day conversation
-- retention, set up pg_cron in Supabase or use a scheduled
-- Edge Function. Example queries:
--
-- DELETE FROM checkins
--   WHERE created_at < NOW() - INTERVAL '12 months';
--
-- DELETE FROM coach_conversations
--   WHERE created_at < NOW() - INTERVAL '30 days';
