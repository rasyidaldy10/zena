-- ============================================
-- ZENA BUSINESS MODE - SAFE SETUP SCRIPT
-- ============================================
-- DROP existing tables first untuk clean install
-- Copy-paste script ini ke Supabase SQL Editor
-- ============================================

-- Drop existing tables (cascading deletes)
DROP TABLE IF EXISTS transaction_items CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS project_terms CASCADE;
DROP TABLE IF EXISTS receivables CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS tax_summary CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS get_project_stats(UUID);
DROP FUNCTION IF EXISTS get_low_stock_count(UUID);
DROP FUNCTION IF EXISTS calculate_ppn(NUMERIC, NUMERIC, BOOLEAN);
DROP FUNCTION IF EXISTS get_monthly_gross_profit(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_product_sales_report(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS upsert_tax_summary(UUID, INTEGER, INTEGER, TEXT, NUMERIC);

-- ============================================
-- Migration 004: Business Mode Tables
-- ============================================

-- 1. Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client_name TEXT,
  type TEXT NOT NULL CHECK (type IN ('alkes', 'servis', 'konsultasi', 'lainnya')),
  contract_value NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('aktif', 'selesai', 'pending')) DEFAULT 'aktif',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = user_id);

-- 2. Project Terms
CREATE TABLE project_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  condition_text TEXT,
  paid_at TIMESTAMPTZ,
  wallet_id UUID REFERENCES user_wallets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_project_terms_project_id ON project_terms(project_id);

ALTER TABLE project_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view project terms" ON project_terms FOR SELECT
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_terms.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can insert project terms" ON project_terms FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_terms.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can update project terms" ON project_terms FOR UPDATE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_terms.project_id AND projects.user_id = auth.uid()));
CREATE POLICY "Users can delete project terms" ON project_terms FOR DELETE
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_terms.project_id AND projects.user_id = auth.uid()));

-- 3. Receivables
CREATE TABLE receivables (
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

CREATE INDEX idx_receivables_user_id ON receivables(user_id);
CREATE INDEX idx_receivables_status ON receivables(status);
CREATE INDEX idx_receivables_project_id ON receivables(project_id);

ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own receivables" ON receivables FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own receivables" ON receivables FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own receivables" ON receivables FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own receivables" ON receivables FOR DELETE USING (auth.uid() = user_id);

-- 4. Products
CREATE TABLE products (
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

CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_products_is_active ON products(is_active);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own products" ON products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own products" ON products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" ON products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" ON products FOR DELETE USING (auth.uid() = user_id);

-- 5. Stock Movements
CREATE TABLE stock_movements (
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

CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_user_id ON stock_movements(user_id);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stock movements" ON stock_movements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert stock movements" ON stock_movements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update stock movements" ON stock_movements FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete stock movements" ON stock_movements FOR DELETE USING (auth.uid() = user_id);

-- 6. Transaction Items
CREATE TABLE transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty NUMERIC NOT NULL,
  price_per_unit NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  hpp_per_unit NUMERIC NOT NULL DEFAULT 0,
  hpp_total NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_product_id ON transaction_items(product_id);

ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transaction items" ON transaction_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM transactions WHERE transactions.id = transaction_items.transaction_id AND transactions.user_id = auth.uid()));
CREATE POLICY "Users can insert transaction items" ON transaction_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM transactions WHERE transactions.id = transaction_items.transaction_id AND transactions.user_id = auth.uid()));
CREATE POLICY "Users can update transaction items" ON transaction_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM transactions WHERE transactions.id = transaction_items.transaction_id AND transactions.user_id = auth.uid()));
CREATE POLICY "Users can delete transaction items" ON transaction_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM transactions WHERE transactions.id = transaction_items.transaction_id AND transactions.user_id = auth.uid()));

-- 7. Tax Summary
CREATE TABLE tax_summary (
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

CREATE INDEX idx_tax_summary_user_period ON tax_summary(user_id, period_year, period_month);

ALTER TABLE tax_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tax summary" ON tax_summary FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tax summary" ON tax_summary FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tax summary" ON tax_summary FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tax summary" ON tax_summary FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- Update existing tables
-- ============================================

-- Add columns to transactions (safe - IF NOT EXISTS equivalent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='project_id') THEN
    ALTER TABLE transactions ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
    CREATE INDEX idx_transactions_project_id ON transactions(project_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='business_category') THEN
    ALTER TABLE transactions ADD COLUMN business_category TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='has_items') THEN
    ALTER TABLE transactions ADD COLUMN has_items BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='ppn_type') THEN
    ALTER TABLE transactions ADD COLUMN ppn_type TEXT CHECK (ppn_type IN ('masukan', 'keluaran'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='ppn_amount') THEN
    ALTER TABLE transactions ADD COLUMN ppn_amount NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='amount_before_ppn') THEN
    ALTER TABLE transactions ADD COLUMN amount_before_ppn NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='is_ppn_inclusive') THEN
    ALTER TABLE transactions ADD COLUMN is_ppn_inclusive BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add columns to user_preferences
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_preferences' AND column_name='business_mode') THEN
    ALTER TABLE user_preferences ADD COLUMN business_mode BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_preferences' AND column_name='active_mode') THEN
    ALTER TABLE user_preferences ADD COLUMN active_mode TEXT CHECK (active_mode IN ('personal', 'business')) DEFAULT 'personal';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_preferences' AND column_name='ppn_rate') THEN
    ALTER TABLE user_preferences ADD COLUMN ppn_rate NUMERIC DEFAULT 11;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_preferences' AND column_name='ppn_enabled') THEN
    ALTER TABLE user_preferences ADD COLUMN ppn_enabled BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add column to user_wallets
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_wallets' AND column_name='wallet_function') THEN
    ALTER TABLE user_wallets ADD COLUMN wallet_function TEXT;
  END IF;
END $$;

-- Create index for PPN transactions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='idx_transactions_ppn_type') THEN
    CREATE INDEX idx_transactions_ppn_type ON transactions(ppn_type) WHERE ppn_type IS NOT NULL;
  END IF;
END $$;

-- ============================================
-- Helper Functions
-- ============================================

-- 1. Get project stats
CREATE FUNCTION get_project_stats(p_project_id UUID)
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
CREATE FUNCTION get_low_stock_count(p_user_id UUID)
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
CREATE FUNCTION calculate_ppn(
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
CREATE FUNCTION get_monthly_gross_profit(
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
CREATE FUNCTION get_product_sales_report(
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
CREATE FUNCTION upsert_tax_summary(
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
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE information_schema.columns.table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN ('projects', 'receivables', 'products', 'stock_movements', 'transaction_items', 'tax_summary', 'project_terms')
ORDER BY table_name;
-- Should return 7 rows
-- ============================================
