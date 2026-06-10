-- ================================================================
-- CHECK: Apakah table user_preferences ada + RLS policy benar?
-- Run di: Supabase SQL Editor
-- ================================================================

-- 1. Check apakah table ada
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'user_preferences';

-- 2. Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'user_preferences';

-- 3. Check apakah RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'user_preferences';

-- ================================================================
-- Expected results:
-- - Table harus ada
-- - RLS enabled = true
-- - Ada policy untuk SELECT yang allow auth.uid() = user_id
-- ================================================================
