-- ============================================================
-- ZENA — DOMPET VALAS (MULTI-CURRENCY) — FASE 1
-- Sumber kurs: BCA e-Rate (https://www.bca.co.id/id/informasi/kurs)
-- Aturan: beli valas pakai kurs JUAL bank, valuasi saldo pakai kurs BELI bank.
-- ============================================================

-- 1) user_wallets: mata uang + dompet anak + kurs rata-rata perolehan
ALTER TABLE user_wallets
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS parent_wallet_id UUID REFERENCES user_wallets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS avg_buy_rate NUMERIC;

COMMENT ON COLUMN user_wallets.currency IS 'Kode ISO 4217. IDR = dompet rupiah biasa.';
COMMENT ON COLUMN user_wallets.parent_wallet_id IS 'Dompet induk (mis. BCA) supaya dompet valas tampil nempel di rekening yang sama.';
COMMENT ON COLUMN user_wallets.avg_buy_rate IS 'Kurs rata-rata tertimbang saat memperoleh valas. NULL untuk dompet IDR.';

-- Dompet IDR tidak boleh punya avg_buy_rate; dompet valas tidak boleh jadi induk.
ALTER TABLE user_wallets DROP CONSTRAINT IF EXISTS user_wallets_currency_check;
ALTER TABLE user_wallets ADD CONSTRAINT user_wallets_currency_check
  CHECK (currency ~ '^[A-Z]{3}$');

CREATE INDEX IF NOT EXISTS idx_user_wallets_parent ON user_wallets(parent_wallet_id)
  WHERE parent_wallet_id IS NOT NULL;

-- 2) transactions: nominal asli + nilai rupiah yang DIKUNCI saat transaksi
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS amount_idr NUMERIC,
  ADD COLUMN IF NOT EXISTS fx_rate NUMERIC;

COMMENT ON COLUMN transactions.amount_idr IS 'Nilai rupiah terkunci memakai kurs saat transaksi. Laporan WAJIB baca COALESCE(amount_idr, amount) agar angka historis tidak berubah saat kurs bergerak.';
COMMENT ON COLUMN transactions.fx_rate IS 'Kurs yang dipakai saat transaksi (1 unit valas = berapa rupiah).';

-- Backfill: semua transaksi lama = rupiah murni
UPDATE transactions SET amount_idr = amount WHERE amount_idr IS NULL;

-- 3) Snapshot kurs harian — dibutuhkan untuk hitung naik/turun harian,
--    karena halaman BCA hanya menampilkan kurs hari ini (tanpa previous close).
CREATE TABLE IF NOT EXISTS fx_rates_daily (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date   DATE NOT NULL,
  currency    TEXT NOT NULL,
  rate_type   TEXT NOT NULL DEFAULT 'erate',  -- erate | tt_counter | bank_notes
  buy         NUMERIC NOT NULL,               -- bank beli dari kita  -> dipakai menilai saldo
  sell        NUMERIC NOT NULL,               -- bank jual ke kita    -> dipakai saat beli valas
  source      TEXT NOT NULL DEFAULT 'bca',    -- bca | yahoo (fallback)
  source_time TEXT,                           -- stempel waktu dari halaman BCA
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rate_date, currency, rate_type, source)
);

CREATE INDEX IF NOT EXISTS idx_fx_rates_lookup
  ON fx_rates_daily(currency, rate_type, rate_date DESC);

-- Kurs bersifat publik (bukan data pribadi): semua user login boleh baca,
-- tapi hanya service role (edge function) yang boleh menulis.
ALTER TABLE fx_rates_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fx_rates_read_all" ON fx_rates_daily;
CREATE POLICY "fx_rates_read_all" ON fx_rates_daily
  FOR SELECT TO authenticated USING (true);

-- 4) View: kurs terakhir per mata uang + kurs hari sebelumnya (untuk delta harian)
--
-- Satu tanggal bisa punya dua baris kalau BCA sempat gagal dibaca lalu fallback
-- Yahoo ikut tersimpan. Tanpa dedup, "kurs sebelumnya" bisa jatuh ke baris
-- di TANGGAL YANG SAMA, sehingga delta harian sebenarnya cuma mengukur selisih
-- antar sumber data. Jadi: pilih satu baris per tanggal dulu (BCA diutamakan),
-- baru dibandingkan antar tanggal.
CREATE OR REPLACE VIEW fx_rates_latest AS
WITH per_day AS (
  SELECT DISTINCT ON (currency, rate_type, rate_date) *
  FROM fx_rates_daily
  ORDER BY currency, rate_type, rate_date,
           CASE WHEN source = 'bca' THEN 0 ELSE 1 END,  -- kurs bank menang atas kurs pasar
           created_at DESC
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY currency, rate_type ORDER BY rate_date DESC
  ) AS rn
  FROM per_day
)
SELECT
  c.currency,
  c.rate_type,
  c.rate_date,
  c.buy,
  c.sell,
  c.source,
  c.source_time,
  p.buy       AS prev_buy,
  p.sell      AS prev_sell,
  p.rate_date AS prev_date
FROM ranked c
LEFT JOIN ranked p
  ON p.currency = c.currency AND p.rate_type = c.rate_type AND p.rn = 2
WHERE c.rn = 1;
