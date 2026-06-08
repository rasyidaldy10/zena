-- Migration 005: HPP Otomatis & PPN (Pajak Pertambahan Nilai)
-- Created: 2026-06-08
-- Description: Add HPP tracking to transaction_items and PPN tax system

-- ============================================
-- 1. ALTER TRANSACTION_ITEMS (HPP)
-- ============================================

ALTER TABLE transaction_items
  ADD COLUMN IF NOT EXISTS hpp_per_unit NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hpp_total NUMERIC NOT NULL DEFAULT 0;

COMMENT ON COLUMN transaction_items.hpp_per_unit IS 'Harga Pokok Penjualan per unit (from products.buy_price at transaction time)';
COMMENT ON COLUMN transaction_items.hpp_total IS 'Total HPP (hpp_per_unit * qty)';

-- ============================================
-- 2. ALTER USER_PREFERENCES (PPN SETTINGS)
-- ============================================

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS ppn_rate NUMERIC DEFAULT 11,
  ADD COLUMN IF NOT EXISTS ppn_enabled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN user_preferences.ppn_rate IS 'PPN tax rate in percentage (default 11%)';
COMMENT ON COLUMN user_preferences.ppn_enabled IS 'Whether PPN tax calculation is enabled for this business';

-- ============================================
-- 3. ALTER TRANSACTIONS (PPN FIELDS)
-- ============================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS ppn_type TEXT CHECK (ppn_type IN ('masukan', 'keluaran')),
  ADD COLUMN IF NOT EXISTS ppn_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_before_ppn NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_ppn_inclusive BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN transactions.ppn_type IS 'PPN type: masukan (input VAT from purchases) or keluaran (output VAT from sales)';
COMMENT ON COLUMN transactions.ppn_amount IS 'PPN tax amount';
COMMENT ON COLUMN transactions.amount_before_ppn IS 'DPP - Dasar Pengenaan Pajak (amount before tax)';
COMMENT ON COLUMN transactions.is_ppn_inclusive IS 'Whether amount already includes PPN (true) or PPN is added on top (false)';

-- ============================================
-- 4. CREATE TAX_SUMMARY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS tax_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  ppn_keluaran NUMERIC NOT NULL DEFAULT 0,
  ppn_masukan NUMERIC NOT NULL DEFAULT 0,
  ppn_terutang NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, period_month, period_year)
);

COMMENT ON TABLE tax_summary IS 'Monthly tax summary for PPN (VAT) reporting';
COMMENT ON COLUMN tax_summary.ppn_keluaran IS 'Total output VAT from sales (PPN Keluaran)';
COMMENT ON COLUMN tax_summary.ppn_masukan IS 'Total input VAT from purchases (PPN Masukan)';
COMMENT ON COLUMN tax_summary.ppn_terutang IS 'Net VAT payable (ppn_keluaran - ppn_masukan)';

-- ============================================
-- 5. CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_tax_summary_user_period ON tax_summary(user_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_transactions_ppn_type ON transactions(ppn_type) WHERE ppn_type IS NOT NULL;

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE tax_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tax summary"
  ON tax_summary FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tax summary"
  ON tax_summary FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tax summary"
  ON tax_summary FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tax summary"
  ON tax_summary FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

-- Function to calculate PPN amount
CREATE OR REPLACE FUNCTION calculate_ppn(
  p_amount NUMERIC,
  p_ppn_rate NUMERIC,
  p_is_inclusive BOOLEAN
) RETURNS TABLE (
  ppn_amount NUMERIC,
  amount_before_ppn NUMERIC
) AS $$
BEGIN
  IF p_is_inclusive THEN
    -- PPN already included in amount
    -- DPP = amount / (1 + rate/100)
    -- PPN = amount - DPP
    RETURN QUERY SELECT
      p_amount - (p_amount / (1 + p_ppn_rate / 100)),
      p_amount / (1 + p_ppn_rate / 100);
  ELSE
    -- PPN added on top of amount
    -- PPN = amount * (rate/100)
    -- DPP = amount
    RETURN QUERY SELECT
      p_amount * (p_ppn_rate / 100),
      p_amount;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get monthly gross profit report
CREATE OR REPLACE FUNCTION get_monthly_gross_profit(
  p_user_id UUID,
  p_month INTEGER,
  p_year INTEGER
) RETURNS TABLE (
  total_sales NUMERIC,
  total_hpp NUMERIC,
  gross_profit NUMERIC,
  gross_margin_pct NUMERIC
) AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  -- Calculate period boundaries
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := (v_start_date + INTERVAL '1 month')::DATE;

  RETURN QUERY
  SELECT
    COALESCE(SUM(t.amount) FILTER (WHERE t.business_category = 'penjualan'), 0) AS total_sales,
    COALESCE(SUM(ti.hpp_total), 0) AS total_hpp,
    COALESCE(SUM(t.amount) FILTER (WHERE t.business_category = 'penjualan'), 0) -
      COALESCE(SUM(ti.hpp_total), 0) AS gross_profit,
    CASE
      WHEN COALESCE(SUM(t.amount) FILTER (WHERE t.business_category = 'penjualan'), 0) > 0 THEN
        ((COALESCE(SUM(t.amount) FILTER (WHERE t.business_category = 'penjualan'), 0) -
          COALESCE(SUM(ti.hpp_total), 0)) /
          COALESCE(SUM(t.amount) FILTER (WHERE t.business_category = 'penjualan'), 0)) * 100
      ELSE 0
    END AS gross_margin_pct
  FROM transactions t
  LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
  WHERE t.user_id = p_user_id
    AND t.date >= v_start_date
    AND t.date < v_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get product sales report
CREATE OR REPLACE FUNCTION get_product_sales_report(
  p_user_id UUID,
  p_month INTEGER,
  p_year INTEGER
) RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  qty_sold NUMERIC,
  total_hpp NUMERIC,
  total_sales NUMERIC,
  profit NUMERIC,
  margin_pct NUMERIC
) AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := (v_start_date + INTERVAL '1 month')::DATE;

  RETURN QUERY
  SELECT
    p.id AS product_id,
    p.name AS product_name,
    COALESCE(SUM(ti.qty), 0) AS qty_sold,
    COALESCE(SUM(ti.hpp_total), 0) AS total_hpp,
    COALESCE(SUM(ti.subtotal), 0) AS total_sales,
    COALESCE(SUM(ti.subtotal - ti.hpp_total), 0) AS profit,
    CASE
      WHEN COALESCE(SUM(ti.subtotal), 0) > 0 THEN
        (COALESCE(SUM(ti.subtotal - ti.hpp_total), 0) / COALESCE(SUM(ti.subtotal), 0)) * 100
      ELSE 0
    END AS margin_pct
  FROM products p
  INNER JOIN transaction_items ti ON ti.product_id = p.id
  INNER JOIN transactions t ON t.id = ti.transaction_id
  WHERE p.user_id = p_user_id
    AND t.date >= v_start_date
    AND t.date < v_end_date
    AND t.business_category = 'penjualan'
  GROUP BY p.id, p.name
  HAVING COALESCE(SUM(ti.qty), 0) > 0
  ORDER BY COALESCE(SUM(ti.subtotal), 0) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to upsert tax summary (called after transaction with PPN is saved)
CREATE OR REPLACE FUNCTION upsert_tax_summary(
  p_user_id UUID,
  p_month INTEGER,
  p_year INTEGER,
  p_ppn_type TEXT,
  p_ppn_amount NUMERIC
) RETURNS VOID AS $$
BEGIN
  INSERT INTO tax_summary (user_id, period_month, period_year, ppn_keluaran, ppn_masukan, ppn_terutang)
  VALUES (
    p_user_id,
    p_month,
    p_year,
    CASE WHEN p_ppn_type = 'keluaran' THEN p_ppn_amount ELSE 0 END,
    CASE WHEN p_ppn_type = 'masukan' THEN p_ppn_amount ELSE 0 END,
    CASE WHEN p_ppn_type = 'keluaran' THEN p_ppn_amount ELSE -p_ppn_amount END
  )
  ON CONFLICT (user_id, period_month, period_year)
  DO UPDATE SET
    ppn_keluaran = tax_summary.ppn_keluaran +
      CASE WHEN p_ppn_type = 'keluaran' THEN p_ppn_amount ELSE 0 END,
    ppn_masukan = tax_summary.ppn_masukan +
      CASE WHEN p_ppn_type = 'masukan' THEN p_ppn_amount ELSE 0 END,
    ppn_terutang = (tax_summary.ppn_keluaran +
      CASE WHEN p_ppn_type = 'keluaran' THEN p_ppn_amount ELSE 0 END) -
      (tax_summary.ppn_masukan +
      CASE WHEN p_ppn_type = 'masukan' THEN p_ppn_amount ELSE 0 END),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Migration 005 applied successfully
-- HPP tracking and PPN tax system enabled
