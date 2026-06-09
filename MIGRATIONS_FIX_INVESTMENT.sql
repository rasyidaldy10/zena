-- ================================================================
-- FIX: Drop old investment_holdings, create new structure
-- ================================================================

-- Drop old table (data akan hilang, tapi harusnya masih kosong)
DROP TABLE IF EXISTS public.investment_holdings CASCADE;

-- Create new structure
CREATE TABLE public.investment_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Asset Info
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'crypto', 'reksadana', 'obligasi')),
  symbol TEXT NOT NULL,
  asset_name TEXT NOT NULL,

  -- Holding Details
  quantity DECIMAL(18, 8) NOT NULL DEFAULT 0,
  average_buy_price DECIMAL(18, 2) NOT NULL DEFAULT 0,
  current_price DECIMAL(18, 2) NOT NULL DEFAULT 0,
  total_value DECIMAL(18, 2) NOT NULL DEFAULT 0,

  -- Performance
  unrealized_gain_loss DECIMAL(18, 2) NOT NULL DEFAULT 0,
  unrealized_gain_loss_percent DECIMAL(8, 2) NOT NULL DEFAULT 0,

  -- Metadata
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_user_asset UNIQUE (user_id, asset_type, symbol)
);

-- Enable RLS
ALTER TABLE public.investment_holdings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own holdings"
  ON public.investment_holdings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own holdings"
  ON public.investment_holdings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own holdings"
  ON public.investment_holdings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own holdings"
  ON public.investment_holdings FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_holdings_user_id ON public.investment_holdings(user_id);
CREATE INDEX idx_holdings_asset_type ON public.investment_holdings(asset_type);
CREATE INDEX idx_holdings_symbol ON public.investment_holdings(symbol);

-- Function to auto-calculate values
CREATE OR REPLACE FUNCTION update_holding_calculations()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_value = NEW.quantity * NEW.current_price;
  NEW.unrealized_gain_loss = (NEW.current_price - NEW.average_buy_price) * NEW.quantity;
  NEW.unrealized_gain_loss_percent =
    CASE
      WHEN NEW.average_buy_price > 0 THEN
        ((NEW.current_price - NEW.average_buy_price) / NEW.average_buy_price) * 100
      ELSE 0
    END;
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER trigger_update_holding_calculations
  BEFORE INSERT OR UPDATE ON public.investment_holdings
  FOR EACH ROW
  EXECUTE FUNCTION update_holding_calculations();

-- ================================================================
-- DONE! ✅ investment_holdings struktur baru siap dipakai
-- ================================================================
