-- ============================================================
-- RIWAYAT PEMBELIAN INVESTASI (history beli/jual per holding)
-- Buat fitur: tambah posisi + riwayat pembelian + koreksi harga rata2.
-- Jalankan SEKALI di Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.investment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holding_id UUID NOT NULL REFERENCES public.investment_holdings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'buy' CHECK (type IN ('buy', 'sell')),
  quantity NUMERIC NOT NULL DEFAULT 0,        -- jumlah (lembar utk saham)
  price_per_unit NUMERIC NOT NULL DEFAULT 0,  -- harga per lembar/unit
  total NUMERIC NOT NULL DEFAULT 0,           -- quantity × price_per_unit
  note TEXT,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_tx_holding
  ON public.investment_transactions(holding_id);

ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "inv_tx_select_own" ON public.investment_transactions;
CREATE POLICY "inv_tx_select_own" ON public.investment_transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "inv_tx_insert_own" ON public.investment_transactions;
CREATE POLICY "inv_tx_insert_own" ON public.investment_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "inv_tx_delete_own" ON public.investment_transactions;
CREATE POLICY "inv_tx_delete_own" ON public.investment_transactions
  FOR DELETE USING (auth.uid() = user_id);
