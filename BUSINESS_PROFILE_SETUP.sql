-- ============================================================
-- FASE 2: Profil Usaha + Rekening Bank + Foto Profil
-- Jalankan SEKALI di Supabase SQL Editor.
-- ============================================================

-- 1. Profil bisnis (1 per user)
CREATE TABLE IF NOT EXISTS public.business_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  business_name TEXT,
  business_abbr TEXT,            -- singkatan utk nomor invoice (mis. GMC)
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  default_note TEXT,            -- catatan default invoice
  invoice_counter INT DEFAULT 0,
  quote_counter INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.business_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bp_select_own" ON public.business_profile;
CREATE POLICY "bp_select_own" ON public.business_profile FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "bp_insert_own" ON public.business_profile;
CREATE POLICY "bp_insert_own" ON public.business_profile FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "bp_update_own" ON public.business_profile;
CREATE POLICY "bp_update_own" ON public.business_profile FOR UPDATE USING (auth.uid() = user_id);

-- 2. Rekening bank bisnis (banyak per user)
CREATE TABLE IF NOT EXISTS public.business_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT,
  account_number TEXT,
  account_holder TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.business_bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bba_select_own" ON public.business_bank_accounts;
CREATE POLICY "bba_select_own" ON public.business_bank_accounts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "bba_insert_own" ON public.business_bank_accounts;
CREATE POLICY "bba_insert_own" ON public.business_bank_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "bba_update_own" ON public.business_bank_accounts;
CREATE POLICY "bba_update_own" ON public.business_bank_accounts FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "bba_delete_own" ON public.business_bank_accounts;
CREATE POLICY "bba_delete_own" ON public.business_bank_accounts FOR DELETE USING (auth.uid() = user_id);

-- 3. Kolom avatar_url di user_preferences (foto profil pribadi)
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 4. Storage bucket publik 'logos' (untuk logo usaha & avatar)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy storage: user boleh upload/baca/hapus file miliknya di bucket logos
DROP POLICY IF EXISTS "logos_read_public" ON storage.objects;
CREATE POLICY "logos_read_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos_insert_auth" ON storage.objects;
CREATE POLICY "logos_insert_auth" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "logos_update_auth" ON storage.objects;
CREATE POLICY "logos_update_auth" ON storage.objects
  FOR UPDATE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "logos_delete_auth" ON storage.objects;
CREATE POLICY "logos_delete_auth" ON storage.objects
  FOR DELETE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');
