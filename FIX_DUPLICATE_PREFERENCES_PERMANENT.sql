-- ============================================================
-- FIX PERMANEN: Duplikat user_preferences + UNIQUE constraint
-- Jalankan SEKALI di Supabase SQL Editor
-- ============================================================

-- 1. Hapus baris duplikat, simpan yang PALING AWAL (created_at terkecil)
--    per user_id. Baris asli (yang ada datanya) biasanya yang pertama.
DELETE FROM user_preferences a
USING user_preferences b
WHERE a.user_id = b.user_id
  AND a.created_at > b.created_at;  -- hapus yang lebih baru, simpan yang asli

-- 2. Pasang UNIQUE constraint di user_id supaya upsert berfungsi benar
--    dan TIDAK akan pernah ada duplikat lagi.
ALTER TABLE user_preferences
  ADD CONSTRAINT user_preferences_user_id_unique UNIQUE (user_id);

-- 3. Verifikasi: harus 0 baris (tidak ada lagi user dengan >1 prefs)
SELECT user_id, COUNT(*) AS jumlah
FROM user_preferences
GROUP BY user_id
HAVING COUNT(*) > 1;
