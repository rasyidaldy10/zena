-- Migration 004: Business Mode - Projects, Receivables, Inventory
-- Created: 2026-06-08
-- Description: Add business account features (projects, piutang/hutang, inventory management)

-- ============================================
-- 1. CREATE NEW TABLES
-- ============================================

-- Projects table (kontrak/proyek bisnis)
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

-- Project terms/termin pembayaran
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

-- Receivables (piutang & hutang)
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

-- Products/inventory
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

-- Stock movements (mutasi stok)
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

-- Transaction items (item transaksi penjualan)
CREATE TABLE IF NOT EXISTS transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty NUMERIC NOT NULL,
  price_per_unit NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. ALTER EXISTING TABLES
-- ============================================

-- Add business fields to transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS business_category TEXT,
  ADD COLUMN IF NOT EXISTS has_items BOOLEAN DEFAULT FALSE;

-- Add business mode to user_preferences
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS business_mode BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS active_mode TEXT CHECK (active_mode IN ('personal', 'business')) DEFAULT 'personal';

-- Add wallet_function to user_wallets
ALTER TABLE user_wallets
  ADD COLUMN IF NOT EXISTS wallet_function TEXT;

-- ============================================
-- 3. CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_project_terms_project_id ON project_terms(project_id);
CREATE INDEX IF NOT EXISTS idx_receivables_user_id ON receivables(user_id);
CREATE INDEX IF NOT EXISTS idx_receivables_status ON receivables(status);
CREATE INDEX IF NOT EXISTS idx_receivables_project_id ON receivables(project_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_user_id ON stock_movements(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product_id ON transaction_items(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_project_id ON transactions(project_id);

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all new tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- Project terms policies (via project ownership)
CREATE POLICY "Users can view project terms"
  ON project_terms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_terms.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert project terms"
  ON project_terms FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_terms.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update project terms"
  ON project_terms FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_terms.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete project terms"
  ON project_terms FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_terms.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Receivables policies
CREATE POLICY "Users can view own receivables"
  ON receivables FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own receivables"
  ON receivables FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own receivables"
  ON receivables FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own receivables"
  ON receivables FOR DELETE
  USING (auth.uid() = user_id);

-- Products policies
CREATE POLICY "Users can view own products"
  ON products FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own products"
  ON products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products"
  ON products FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own products"
  ON products FOR DELETE
  USING (auth.uid() = user_id);

-- Stock movements policies (via product ownership)
CREATE POLICY "Users can view stock movements"
  ON stock_movements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert stock movements"
  ON stock_movements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update stock movements"
  ON stock_movements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete stock movements"
  ON stock_movements FOR DELETE
  USING (auth.uid() = user_id);

-- Transaction items policies (via transaction ownership)
CREATE POLICY "Users can view transaction items"
  ON transaction_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = transaction_items.transaction_id
      AND transactions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert transaction items"
  ON transaction_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = transaction_items.transaction_id
      AND transactions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update transaction items"
  ON transaction_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = transaction_items.transaction_id
      AND transactions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete transaction items"
  ON transaction_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM transactions
      WHERE transactions.id = transaction_items.transaction_id
      AND transactions.user_id = auth.uid()
    )
  );

-- ============================================
-- 5. HELPER FUNCTIONS
-- ============================================

-- Function to get project statistics
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

-- Function to check low stock products
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

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- Migration 004 applied successfully
-- Business mode tables created with RLS enabled
