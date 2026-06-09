-- ============================================
-- ZENA BUSINESS MODE - SETUP SCRIPT
-- ============================================
-- Copy-paste script ini ke Supabase SQL Editor
-- Eksekusi 1x untuk setup semua tabel business mode
-- ============================================

-- Migration 004: Business Mode Tables
-- ============================================

-- 1. Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client_name TEXT,
  type TEXT NOT NULL CHECK (type IN ('alkes', 'servis', 'konsultasi', 'lainnya')),
  contract_value NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('aktif', 'selesai', 'pending')) DEFAULT 'aktif',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can insert own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

-- 2. Project Terms
CREATE TABLE IF NOT EXISTS project_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  condition_text TEXT,
  paid_at TIMESTAMPTZ,
  wallet_id UUID REFERENCES user_wallets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_terms_project_id ON project_terms(project_id);

ALTER TABLE project_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view project terms" ON project_terms FOR SELECT
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_terms.project_id AND projects.user_id = auth.uid()));
CREATE POLICY IF NOT EXISTS "Users can insert project terms" ON project_terms FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_terms.project_id AND projects.user_id = auth.uid()));
CREATE POLICY IF NOT EXISTS "Users can update project terms" ON project_terms FOR UPDATE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_terms.project_id AND projects.user_id = auth.uid()));
CREATE POLICY IF NOT EXISTS "Users can delete project terms" ON project_terms FOR DELETE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_terms.project_id AND projects.user_id = auth.uid()));

-- 3. Receivables
CREATE TABLE IF NOT EXISTS receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('piutang', 'hutang')),
  party_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'lunas')) DEFAULT 'pending',
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receivables_user_id ON receivables(user_id);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status);
CREATE INDEX IF NOT EXISTS idx_receivables_project_id ON receivables(project_id);

ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view own receivables" ON receivables FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can insert own receivables" ON receivables FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can update own receivables" ON receivables FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can delete own receivables" ON receivables FOR DELETE USING (auth.uid() = user_id);

-- 4. Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'pcs',
  buy_price NUMERIC NOT NULL DEFAULT 0,
  sell_price NUMERIC NOT NULL DEFAULT 0,
  stock_qty NUMERIC NOT NULL DEFAULT 0,
  stock_min_alert NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view own products" ON products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can insert own products" ON products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can update own products" ON products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can delete own products" ON products FOR DELETE USING (auth.uid() = user_id);

-- 5. Stock Movements
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment')),
  qty NUMERIC NOT NULL,
  price_per_unit NUMERIC NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user_id ON stock_movements(user_id);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view stock movements" ON stock_movements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can insert stock movements" ON stock_movements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can update stock movements" ON stock_movements FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can delete stock movements" ON stock_movements FOR DELETE USING (auth.uid() = user_id);

-- 6. Transaction Items
CREATE TABLE IF NOT EXISTS transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty NUMERIC NOT NULL,
  price_per_unit NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hpp_per_unit NUMERIC NOT NULL DEFAULT 0,
  hpp_total NUMERIC NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product_id ON transaction_items(product_id);

ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view transaction items" ON transaction_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM transactions WHERE transactions.id = transaction_items.transaction_id AND transactions.user_id = auth.uid()));
CREATE POLICY IF NOT EXISTS "Users can insert transaction items" ON transaction_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM transactions WHERE transactions.id = transaction_items.transaction_id AND transactions.user_id = auth.uid()));
CREATE POLICY IF NOT EXISTS "Users can update transaction items" ON transaction_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM transactions WHERE transactions.id = transaction_items.transaction_id AND transactions.user_id = auth.uid()));
CREATE POLICY IF NOT EXISTS "Users can delete transaction items" ON transaction_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM transactions WHERE transactions.id = transaction_items.transaction_id AND transactions.user_id = auth.uid()));

-- 7. Update existing tables
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS business_category TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS has_items BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_transactions_project_id ON transactions(project_id);

ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS business_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS active_mode TEXT CHECK (active_mode IN ('personal', 'business')) DEFAULT 'personal';

ALTER TABLE user_wallets ADD COLUMN IF NOT EXISTS wallet_function TEXT;

-- Migration 005: HPP & PPN System
-- ============================================

-- 1. PPN settings in user_preferences
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS ppn_rate NUMERIC DEFAULT 11;
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS ppn_enabled BOOLEAN DEFAULT FALSE;

-- 2. PPN fields in transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ppn_type TEXT CHECK (ppn_type IN ('masukan', 'keluaran'));
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ppn_amount NUMERIC DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount_before_ppn NUMERIC DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_ppn_inclusive BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_transactions_ppn_type ON transactions(ppn_type) WHERE ppn_type IS NOT NULL;

-- 3. Tax Summary table
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

CREATE INDEX IF NOT EXISTS idx_tax_summary_user_period ON tax_summary(user_id, period_year, period_month);

ALTER TABLE tax_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view own tax summary" ON tax_summary FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can insert own tax summary" ON tax_summary FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can update own tax summary" ON tax_summary FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can delete own tax summary" ON tax_summary FOR DELETE USING (auth.uid() = user_id);

-- Helper Functions
-- ============================================

-- 1. Get project stats
CREATE OR REPLACE FUNCTION get_project_stats(p_project_id UUID)
RETURNS TABLE (
  total_paid NUMERIC,
  total_expense NUMERIC,
  estimated_profit NUMERIC,
  margin_pct NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(pt.amount) FILTER (WHERE pt.paid_at IS NOT NULL), 0) AS total_paid,
    COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0) AS total_expense,
    COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'income'), 0) -
      COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0) AS estimated_profit,
    CASE
      WHEN (SELECT contract_value FROM projects WHERE id = p_project_id) > 0 THEN
        ((COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'income'), 0) -
          COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0)) /
          (SELECT contract_value FROM projects WHERE id = p_project_id) * 100)
      ELSE 0
    END AS margin_pct
  FROM projects p
  LEFT JOIN project_terms pt ON pt.project_id = p.id
  LEFT JOIN transactions t ON t.project_id = p.id
  WHERE p.id = p_project_id
  GROUP BY p.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Get low stock count
CREATE OR REPLACE FUNCTION get_low_stock_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM products
    WHERE user_id = p_user_id
    AND is_active = TRUE
    AND stock_qty <= stock_min_alert
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Calculate PPN
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
    RETURN QUERY SELECT
      p_amount - (p_amount / (1 + p_ppn_rate / 100)),
      p_amount / (1 + p_ppn_rate / 100);
  ELSE
    RETURN QUERY SELECT
      p_amount * (p_ppn_rate / 100),
      p_amount;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Get monthly gross profit
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

-- 5. Get product sales report
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

-- 6. Upsert tax summary
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
-- SETUP COMPLETE! ✅
-- ============================================
-- Verify dengan query ini:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('projects', 'receivables', 'products', 'stock_movements', 'transaction_items', 'tax_summary');
-- Should return 6 rows
-- ============================================
