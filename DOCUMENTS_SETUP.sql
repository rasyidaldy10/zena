-- ============================================================
-- FASE 3: Invoice & Penawaran (documents)
-- Jalankan SEKALI di Supabase SQL Editor.
-- (Butuh BUSINESS_PROFILE_SETUP.sql sudah dijalankan dulu)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('invoice', 'quotation')),
  doc_number TEXT NOT NULL,                 -- terkunci setelah dibuat
  client_name TEXT,
  client_address TEXT,
  issue_date DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','approved','rejected')),
  items JSONB DEFAULT '[]'::jsonb,          -- [{name, qty, price, subtotal}]
  subtotal NUMERIC DEFAULT 0,
  ppn_amount NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  note TEXT,
  bank_account_id UUID,
  template_key TEXT DEFAULT 'professional',
  project_id UUID,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents(user_id, doc_type);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "doc_select_own" ON public.documents;
CREATE POLICY "doc_select_own" ON public.documents FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "doc_insert_own" ON public.documents;
CREATE POLICY "doc_insert_own" ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "doc_update_own" ON public.documents;
CREATE POLICY "doc_update_own" ON public.documents FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "doc_delete_own" ON public.documents;
CREATE POLICY "doc_delete_own" ON public.documents FOR DELETE USING (auth.uid() = user_id);

-- RPC: increment counter ATOMIK & return nomor urut baru (anti-duplikat).
-- p_doc_type: 'invoice' atau 'quotation'
CREATE OR REPLACE FUNCTION public.next_doc_counter(p_doc_type TEXT)
RETURNS INT AS $$
DECLARE
  v_new INT;
BEGIN
  -- pastikan ada row business_profile
  INSERT INTO public.business_profile (user_id)
    VALUES (auth.uid())
    ON CONFLICT (user_id) DO NOTHING;

  IF p_doc_type = 'invoice' THEN
    UPDATE public.business_profile
      SET invoice_counter = COALESCE(invoice_counter, 0) + 1
      WHERE user_id = auth.uid()
      RETURNING invoice_counter INTO v_new;
  ELSE
    UPDATE public.business_profile
      SET quote_counter = COALESCE(quote_counter, 0) + 1
      WHERE user_id = auth.uid()
      RETURNING quote_counter INTO v_new;
  END IF;

  RETURN v_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
