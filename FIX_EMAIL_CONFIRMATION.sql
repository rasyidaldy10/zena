-- ================================================================
-- FIX: Auto-confirm all users (CORRECT VERSION)
-- Run di: Supabase SQL Editor
-- ================================================================

-- Auto-confirm semua users yang belum verified
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- NOTE: Jangan update "confirmed_at" karena itu adalah generated column!

-- ================================================================
-- RESULT: Semua user sekarang bisa login tanpa email verification
-- ================================================================
