-- ================================================================
-- CLEANUP ALL DATABASE ISSUES
-- Run di: Supabase SQL Editor
-- ================================================================

-- 1. Remove duplicate user_preferences (keep latest)
DELETE FROM public.user_preferences
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM public.user_preferences
  ORDER BY user_id, created_at DESC
);

-- 2. Verify no duplicates remain
SELECT user_id, COUNT(*) as count, array_agg(id) as ids
FROM public.user_preferences
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Expected: 0 rows (no duplicates)

-- 3. Fix any orphaned user_preferences (user doesn't exist)
DELETE FROM public.user_preferences
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 4. Ensure RLS policies are correct
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
CREATE POLICY "Users can view own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
CREATE POLICY "Users can update own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- 5. Check auth.users for issues
SELECT 
  id, 
  email, 
  email_confirmed_at IS NOT NULL as confirmed,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- ================================================================
-- DONE! Database cleaned up
-- ================================================================
