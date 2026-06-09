-- ================================================================
-- FINAL MIGRATIONS - CEO Flag + Bank Info only
-- (investment_holdings sudah dihandle terpisah)
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
-- DONE! ✅
-- ================================================================
