-- Investment Holdings Table
-- Tracks user's stock/crypto/reksadana holdings

CREATE TABLE IF NOT EXISTS public.investment_holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Asset Info
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'crypto', 'reksadana', 'obligasi')),
  symbol TEXT NOT NULL, -- e.g. 'BBCA', 'BTC', 'RDU0001'
  asset_name TEXT NOT NULL, -- e.g. 'Bank BCA', 'Bitcoin', 'Mandiri Saham Unggulan'

  -- Holding Details
  quantity DECIMAL(18, 8) NOT NULL DEFAULT 0, -- Amount owned (supports decimals for crypto)
  average_buy_price DECIMAL(18, 2) NOT NULL DEFAULT 0, -- Average price per unit
  current_price DECIMAL(18, 2) NOT NULL DEFAULT 0, -- Latest market price
  total_value DECIMAL(18, 2) NOT NULL DEFAULT 0, -- quantity × current_price

  -- Performance
  unrealized_gain_loss DECIMAL(18, 2) NOT NULL DEFAULT 0, -- (current_price - average_buy_price) × quantity
  unrealized_gain_loss_percent DECIMAL(8, 2) NOT NULL DEFAULT 0, -- Percentage gain/loss

  -- Metadata
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes
  CONSTRAINT unique_user_asset UNIQUE (user_id, asset_type, symbol)
);

-- Enable Row Level Security
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

-- Create indexes for faster queries
CREATE INDEX idx_holdings_user_id ON public.investment_holdings(user_id);
CREATE INDEX idx_holdings_asset_type ON public.investment_holdings(asset_type);
CREATE INDEX idx_holdings_symbol ON public.investment_holdings(symbol);

-- Function to update total_value and gain/loss automatically
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

-- Trigger to auto-calculate on INSERT/UPDATE
CREATE TRIGGER trigger_update_holding_calculations
  BEFORE INSERT OR UPDATE ON public.investment_holdings
  FOR EACH ROW
  EXECUTE FUNCTION update_holding_calculations();

-- Sample data function (for testing)
CREATE OR REPLACE FUNCTION seed_sample_holdings(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Stock holdings
  INSERT INTO public.investment_holdings (user_id, asset_type, symbol, asset_name, quantity, average_buy_price, current_price)
  VALUES
    (target_user_id, 'stock', 'BBCA', 'Bank BCA', 100, 9500, 9800),
    (target_user_id, 'stock', 'TLKM', 'Telkom Indonesia', 200, 3600, 3800),
    (target_user_id, 'stock', 'GOTO', 'GoTo Gojek Tokopedia', 1000, 70, 65);

  -- Crypto holdings
  INSERT INTO public.investment_holdings (user_id, asset_type, symbol, asset_name, quantity, average_buy_price, current_price)
  VALUES
    (target_user_id, 'crypto', 'BTC', 'Bitcoin', 0.05, 1000000000, 1140000000),
    (target_user_id, 'crypto', 'ETH', 'Ethereum', 0.5, 28000000, 31870000);

  -- Reksadana holdings
  INSERT INTO public.investment_holdings (user_id, asset_type, symbol, asset_name, quantity, average_buy_price, current_price)
  VALUES
    (target_user_id, 'reksadana', 'RDU0001', 'Mandiri Investa Atraktif', 10000, 2100, 2250);
END;
$$ LANGUAGE plpgsql;
