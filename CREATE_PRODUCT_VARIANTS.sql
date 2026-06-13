-- ============================================================
-- VARIAN PRODUK (tipe) — mis. produk "Outlet Samping" punya tipe O2, Air, dll
-- Total stok produk = jumlah stok semua varian.
-- Jalankan SEKALI di Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                 -- nama tipe, mis. "O2", "Air"
  stock_qty NUMERIC NOT NULL DEFAULT 0,
  sell_price NUMERIC NOT NULL DEFAULT 0,
  buy_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product
  ON public.product_variants(product_id);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- RLS: user hanya akses varian miliknya
DROP POLICY IF EXISTS "variants_select_own" ON public.product_variants;
CREATE POLICY "variants_select_own" ON public.product_variants
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "variants_insert_own" ON public.product_variants;
CREATE POLICY "variants_insert_own" ON public.product_variants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "variants_update_own" ON public.product_variants;
CREATE POLICY "variants_update_own" ON public.product_variants
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "variants_delete_own" ON public.product_variants;
CREATE POLICY "variants_delete_own" ON public.product_variants
  FOR DELETE USING (auth.uid() = user_id);

-- Verifikasi:
-- SELECT * FROM product_variants LIMIT 1;
