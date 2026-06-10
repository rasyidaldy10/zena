-- ================================================================
-- DISABLE EMAIL VERIFICATION (For Development/Testing)
-- Run di: Supabase Dashboard → SQL Editor → New query
-- ================================================================

-- Auto-confirm semua existing users yang belum confirmed
UPDATE auth.users
SET email_confirmed_at = NOW(),
    confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- ================================================================
-- NEXT: Disable "Confirm email" di Supabase Dashboard
-- 
-- Step-by-step:
-- 1. Buka Supabase Dashboard
-- 2. Settings → Authentication
-- 3. Email → "Confirm email" → Toggle OFF
-- 4. Save
-- 
-- Setelah ini, semua signup baru akan langsung auto-login!
-- ================================================================
