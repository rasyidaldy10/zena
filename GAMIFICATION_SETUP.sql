-- ============================================================
-- FASE 4: Tier / Gamification system
-- Jalankan SEKALI di Supabase SQL Editor.
-- ============================================================

-- 1. Tambah kolom XP/tier/streak ke user_preferences
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS xp INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'starter',   -- starter/bronze/silver/gold/platinum
  ADD COLUMN IF NOT EXISTS streak_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_date DATE;

-- 2. Tabel badge
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL,            -- first_saver/consistent/investor/budget_pro
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, badge_key)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "badges_select_own" ON public.user_badges;
CREATE POLICY "badges_select_own" ON public.user_badges
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "badges_insert_own" ON public.user_badges;
CREATE POLICY "badges_insert_own" ON public.user_badges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "badges_delete_own" ON public.user_badges;
CREATE POLICY "badges_delete_own" ON public.user_badges
  FOR DELETE USING (auth.uid() = user_id);
