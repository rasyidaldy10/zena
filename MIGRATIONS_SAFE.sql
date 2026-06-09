-- ================================================================
-- ZENA - SAFE MIGRATIONS (Skip existing tables)
-- Run di: Supabase Dashboard → SQL Editor → New query
-- ================================================================

-- ================================================================
-- 002: CEO Welcome Flag
-- ================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_preferences' AND column_name = 'has_seen_ceo_welcome'
  ) THEN
    ALTER TABLE user_preferences ADD COLUMN has_seen_ceo_welcome BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

UPDATE user_preferences
SET has_seen_ceo_welcome = FALSE
WHERE has_seen_ceo_welcome IS NULL;

-- ================================================================
-- 003: Add Bank Info to Wallets
-- ================================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_wallets' AND column_name = 'bank_name'
  ) THEN
    ALTER TABLE user_wallets ADD COLUMN bank_name TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_wallets' AND column_name = 'last_4_digits'
  ) THEN
    ALTER TABLE user_wallets ADD COLUMN last_4_digits TEXT;
  END IF;
END $$;

-- Index untuk query cepat
DROP INDEX IF EXISTS idx_wallets_bank_info;
CREATE INDEX idx_wallets_bank_info ON user_wallets(user_id, bank_name, last_4_digits)
WHERE bank_name IS NOT NULL AND last_4_digits IS NOT NULL;

-- ================================================================
-- 003: Investment Holdings
-- ================================================================
CREATE TABLE IF NOT EXISTS public.investment_holdings (
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
DROP POLICY IF EXISTS "Users can view their own holdings" ON public.investment_holdings;
CREATE POLICY "Users can view their own holdings"
  ON public.investment_holdings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own holdings" ON public.investment_holdings;
CREATE POLICY "Users can insert their own holdings"
  ON public.investment_holdings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own holdings" ON public.investment_holdings;
CREATE POLICY "Users can update their own holdings"
  ON public.investment_holdings FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own holdings" ON public.investment_holdings;
CREATE POLICY "Users can delete their own holdings"
  ON public.investment_holdings FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON public.investment_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_asset_type ON public.investment_holdings(asset_type);
CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON public.investment_holdings(symbol);

-- Function to update calculations
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
DROP TRIGGER IF EXISTS trigger_update_holding_calculations ON public.investment_holdings;
CREATE TRIGGER trigger_update_holding_calculations
  BEFORE INSERT OR UPDATE ON public.investment_holdings
  FOR EACH ROW
  EXECUTE FUNCTION update_holding_calculations();

-- ================================================================
-- DONE! ✅
-- ================================================================
