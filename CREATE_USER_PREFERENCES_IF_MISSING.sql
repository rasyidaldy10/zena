-- ================================================================
-- CREATE user_preferences table if missing + Fix RLS
-- Run di: Supabase SQL Editor
-- ================================================================

-- Create table if not exists
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language TEXT DEFAULT 'id',
  full_name TEXT,
  persona TEXT,
  budgeting_mode TEXT,
  monthly_income NUMERIC(18, 2) DEFAULT 0,
  business_mode BOOLEAN DEFAULT false,
  ppn_enabled BOOLEAN DEFAULT false,
  ppn_rate NUMERIC(5, 2) DEFAULT 11,
  active_mode TEXT DEFAULT 'personal',
  has_seen_ceo_welcome BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop old policies (if exist)
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;

-- Create new policies
CREATE POLICY "Users can view own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Create index
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- ================================================================
-- DONE! user_preferences table ready with correct RLS
-- ================================================================
