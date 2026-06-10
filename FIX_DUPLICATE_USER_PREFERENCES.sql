-- ================================================================
-- FIX: Remove duplicate user_preferences rows
-- Keep only the latest row per user
-- ================================================================

-- Delete duplicate rows, keep only the most recent one
DELETE FROM public.user_preferences
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM public.user_preferences
  ORDER BY user_id, created_at DESC
);

-- Verify: Should return 0 rows if no duplicates
SELECT user_id, COUNT(*) as count
FROM public.user_preferences
GROUP BY user_id
HAVING COUNT(*) > 1;

-- ================================================================
-- DONE! Each user now has only 1 row in user_preferences
-- ================================================================
