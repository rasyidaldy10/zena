-- ================================================================
-- ZENA - ALL MIGRATIONS IN ONE FILE
-- Copy-paste semua isi file ini ke Supabase SQL Editor
-- Jalankan di: Supabase Dashboard → SQL Editor → New query
-- ================================================================

-- ================================================================
-- 001: ZENA Intelligence System
-- ================================================================

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL,
  title        TEXT        NOT NULL,
  message      TEXT        NOT NULL,
  is_read      BOOLEAN     NOT NULL DEFAULT FALSE,
  metadata     JSONB       NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Insights table
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_text TEXT        NOT NULL,
  week_start   DATE        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent Logs table
CREATE TABLE IF NOT EXISTS public.agent_logs (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name   TEXT        NOT NULL,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  action       TEXT        NOT NULL,
  result       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS notifications_user_id_idx   ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx    ON public.notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS ai_insights_user_id_idx     ON public.ai_insights(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_logs_user_agent_idx   ON public.agent_logs(user_id, agent_name, created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_logs     ENABLE ROW LEVEL SECURITY;

-- RLS Policies: notifications
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- RLS Policies: ai_insights
DROP POLICY IF EXISTS "ai_insights_select_own" ON public.ai_insights;
CREATE POLICY "ai_insights_select_own" ON public.ai_insights
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- RLS Policies: agent_logs
DROP POLICY IF EXISTS "agent_logs_select_own" ON public.agent_logs;
CREATE POLICY "agent_logs_select_own" ON public.agent_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Enable Realtime for live notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ================================================================
-- 002: CEO Welcome Flag
-- ================================================================

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS has_seen_ceo_welcome BOOLEAN DEFAULT FALSE;

UPDATE user_preferences
SET has_seen_ceo_welcome = FALSE
WHERE has_seen_ceo_welcome IS NULL;

-- ================================================================
-- 002: Gmail Wallet Mapping (Old - will be dropped)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.gmail_wallet_mappings (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id      UUID        NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
  sender_email   TEXT        NOT NULL,
  bank_name      TEXT        NOT NULL,
  last_4_digits  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, sender_email)
);

CREATE INDEX IF NOT EXISTS gmail_mappings_user_idx ON public.gmail_wallet_mappings(user_id);

ALTER TABLE public.gmail_wallet_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gmail_mappings_own" ON public.gmail_wallet_mappings;
CREATE POLICY "gmail_mappings_own" ON public.gmail_wallet_mappings
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- ================================================================
-- 003: Add Bank Info to Wallets (replaces gmail_wallet_mappings)
-- ================================================================

ALTER TABLE user_wallets
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS last_4_digits TEXT;

-- Drop old table (replaced by columns in user_wallets)
DROP TABLE IF EXISTS gmail_wallet_mappings;

-- Index untuk query cepat saat Gmail parser matching
CREATE INDEX IF NOT EXISTS idx_wallets_bank_info ON user_wallets(user_id, bank_name, last_4_digits)
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

  -- Indexes
  CONSTRAINT unique_user_asset UNIQUE (user_id, asset_type, symbol)
);

-- Enable Row Level Security
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

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON public.investment_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_asset_type ON public.investment_holdings(asset_type);
CREATE INDEX IF NOT EXISTS idx_holdings_symbol ON public.investment_holdings(symbol);

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
DROP TRIGGER IF EXISTS trigger_update_holding_calculations ON public.investment_holdings;
CREATE TRIGGER trigger_update_holding_calculations
  BEFORE INSERT OR UPDATE ON public.investment_holdings
  FOR EACH ROW
  EXECUTE FUNCTION update_holding_calculations();

-- ================================================================
-- DONE! ✅
-- Semua migrations berhasil dijalankan.
-- Next: Setup cron jobs di Supabase Dashboard → Edge Functions
-- ================================================================
