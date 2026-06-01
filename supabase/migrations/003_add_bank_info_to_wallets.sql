-- Add bank info to user_wallets for Gmail auto-import
ALTER TABLE user_wallets
ADD COLUMN bank_name TEXT,
ADD COLUMN last_4_digits TEXT;

-- Drop old gmail_wallet_mappings table (tidak dipakai lagi)
DROP TABLE IF EXISTS gmail_wallet_mappings;

-- Index untuk query cepat saat Gmail parser matching
CREATE INDEX idx_wallets_bank_info ON user_wallets(user_id, bank_name, last_4_digits)
WHERE bank_name IS NOT NULL AND last_4_digits IS NOT NULL;
