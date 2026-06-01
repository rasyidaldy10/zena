-- Tabel untuk mapping email bank → wallet user
CREATE TABLE IF NOT EXISTS public.gmail_wallet_mappings (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id      UUID        NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
  sender_email   TEXT        NOT NULL, -- e.g., noreply@bca.co.id:1234 (unique key)
  bank_name      TEXT        NOT NULL, -- e.g., BCA (...1234)
  last_4_digits  TEXT,                 -- 4 digit terakhir rekening
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, sender_email)
);

CREATE INDEX gmail_mappings_user_idx ON public.gmail_wallet_mappings(user_id);

-- Enable RLS
ALTER TABLE public.gmail_wallet_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "gmail_mappings_own" ON public.gmail_wallet_mappings
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Enable Realtime (opsional)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.gmail_wallet_mappings;
