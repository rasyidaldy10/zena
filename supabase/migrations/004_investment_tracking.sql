-- Investment Holdings: track saham/asset per wallet investasi
CREATE TABLE investment_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL, -- BBRI, BMRI, TLKM, dll
  quantity INTEGER NOT NULL, -- jumlah lot
  buy_price NUMERIC(15,2) NOT NULL, -- harga beli per saham (dalam Rupiah)
  current_price NUMERIC(15,2), -- harga saat ini per saham (update otomatis)
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Stock Prices Cache: simpan harga saham terkini
CREATE TABLE stock_prices (
  ticker TEXT PRIMARY KEY,
  price NUMERIC(15,2) NOT NULL, -- harga per saham dalam Rupiah
  change_percent NUMERIC(5,2), -- persentase perubahan hari ini
  last_updated TIMESTAMPTZ DEFAULT now(),
  source TEXT DEFAULT 'manual' -- manual, yahoo, idx
);

-- Indexes untuk query cepat
CREATE INDEX idx_holdings_wallet ON investment_holdings(wallet_id);
CREATE INDEX idx_holdings_user ON investment_holdings(user_id);
CREATE INDEX idx_holdings_ticker ON investment_holdings(ticker);

-- RLS Policies
ALTER TABLE investment_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own holdings"
  ON investment_holdings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own holdings"
  ON investment_holdings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own holdings"
  ON investment_holdings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own holdings"
  ON investment_holdings FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view stock prices"
  ON stock_prices FOR SELECT
  TO authenticated
  USING (true);

-- Function: calculate total value of investment wallet
CREATE OR REPLACE FUNCTION calculate_investment_wallet_value(p_wallet_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  total_value NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(
    quantity * 100 * COALESCE(current_price, buy_price)
  ), 0)
  INTO total_value
  FROM investment_holdings
  WHERE wallet_id = p_wallet_id;

  RETURN total_value;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE investment_holdings IS 'Track saham dan aset investasi per wallet';
COMMENT ON TABLE stock_prices IS 'Cache harga saham terkini dari bursa';
COMMENT ON FUNCTION calculate_investment_wallet_value IS 'Hitung total nilai wallet investasi berdasarkan current_price × quantity';
