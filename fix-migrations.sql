-- ============================================
-- ZENA - Fixed Migrations (Without ALTER DATABASE)
-- ============================================

-- Migration 3: Bank Info di Wallet
ALTER TABLE user_wallets
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS last_4_digits TEXT;

DROP TABLE IF EXISTS gmail_wallet_mappings;

CREATE INDEX IF NOT EXISTS idx_wallets_bank_info ON user_wallets(user_id, bank_name, last_4_digits)
WHERE bank_name IS NOT NULL AND last_4_digits IS NOT NULL;

-- Migration 4: Investment Tracking
CREATE TABLE IF NOT EXISTS investment_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  buy_price NUMERIC(15,2) NOT NULL,
  current_price NUMERIC(15,2),
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_prices (
  ticker TEXT PRIMARY KEY,
  price NUMERIC(15,2) NOT NULL,
  change_percent NUMERIC(5,2),
  last_updated TIMESTAMPTZ DEFAULT now(),
  source TEXT DEFAULT 'manual'
);

CREATE INDEX IF NOT EXISTS idx_holdings_wallet ON investment_holdings(wallet_id);
CREATE INDEX IF NOT EXISTS idx_holdings_user ON investment_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_ticker ON investment_holdings(ticker);

ALTER TABLE investment_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own holdings" ON investment_holdings;
CREATE POLICY "Users can view own holdings" ON investment_holdings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own holdings" ON investment_holdings;
CREATE POLICY "Users can insert own holdings" ON investment_holdings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own holdings" ON investment_holdings;
CREATE POLICY "Users can update own holdings" ON investment_holdings FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own holdings" ON investment_holdings;
CREATE POLICY "Users can delete own holdings" ON investment_holdings FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view stock prices" ON stock_prices;
CREATE POLICY "Anyone can view stock prices" ON stock_prices FOR SELECT TO authenticated USING (true);

-- Migration 5: Setup Cron Jobs (FIXED VERSION)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Hardcode project URL dan service key langsung di function
CREATE OR REPLACE FUNCTION trigger_edge_function(function_name TEXT)
RETURNS void AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://lcvenmsxauasaemjjxtc.supabase.co/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Hapus cron jobs lama kalau ada
DO $$
BEGIN
  PERFORM cron.unschedule('stock-price-updater-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('weekly-insight-saturday');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('daily-summary-evening');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Buat cron jobs baru
SELECT cron.schedule(
  'stock-price-updater-daily',
  '30 9 * * 1-5',
  $$SELECT trigger_edge_function('stock-price-updater')$$
);

SELECT cron.schedule(
  'weekly-insight-saturday',
  '0 2 * * 6',
  $$SELECT trigger_edge_function('weekly-insight')$$
);

SELECT cron.schedule(
  'daily-summary-evening',
  '0 14 * * *',
  $$SELECT trigger_edge_function('daily-summary')$$
);

-- Verify
SELECT 'Migration completed successfully! ✅' as status;
SELECT '' as blank_line;
SELECT 'Active Cron Jobs:' as info;
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;
