-- ============================================
-- CRITICAL SECURITY: Enable RLS on All Tables
-- ============================================
-- This migration MUST be run first!
-- Prevents unauthorized access to user data

-- Enable RLS on core tables
ALTER TABLE IF EXISTS public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recurring_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES: user_preferences
-- ============================================

DROP POLICY IF EXISTS "user_prefs_select_own" ON public.user_preferences;
CREATE POLICY "user_prefs_select_own" ON public.user_preferences
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_prefs_insert_own" ON public.user_preferences;
CREATE POLICY "user_prefs_insert_own" ON public.user_preferences
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_prefs_update_own" ON public.user_preferences;
CREATE POLICY "user_prefs_update_own" ON public.user_preferences
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: user_wallets
-- ============================================

DROP POLICY IF EXISTS "wallets_select_own" ON public.user_wallets;
CREATE POLICY "wallets_select_own" ON public.user_wallets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "wallets_insert_own" ON public.user_wallets;
CREATE POLICY "wallets_insert_own" ON public.user_wallets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "wallets_update_own" ON public.user_wallets;
CREATE POLICY "wallets_update_own" ON public.user_wallets
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "wallets_delete_own" ON public.user_wallets;
CREATE POLICY "wallets_delete_own" ON public.user_wallets
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: transactions
-- ============================================

DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;
CREATE POLICY "transactions_insert_own" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_update_own" ON public.transactions;
CREATE POLICY "transactions_update_own" ON public.transactions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_delete_own" ON public.transactions;
CREATE POLICY "transactions_delete_own" ON public.transactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES: recurring_transactions
-- ============================================

DROP POLICY IF EXISTS "recurring_select_own" ON public.recurring_transactions;
CREATE POLICY "recurring_select_own" ON public.recurring_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "recurring_insert_own" ON public.recurring_transactions;
CREATE POLICY "recurring_insert_own" ON public.recurring_transactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "recurring_update_own" ON public.recurring_transactions;
CREATE POLICY "recurring_update_own" ON public.recurring_transactions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "recurring_delete_own" ON public.recurring_transactions;
CREATE POLICY "recurring_delete_own" ON public.recurring_transactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify RLS is enabled (should return 'true')
-- Run this after migration:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN ('user_preferences', 'user_wallets', 'transactions', 'recurring_transactions');
