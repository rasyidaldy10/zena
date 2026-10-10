-- ============================================================
-- PERBAIKAN HITUNGAN PROFIT PROJECT
--
-- MASALAH 1 — dua sumber data dicampur.
--   total_paid diambil dari project_terms (termin yang ditandai lunas),
--   tapi estimated_profit memakai pemasukan dari tabel transactions.
--   Kedua sumber itu rutin berbeda: terbukti pada 4 project, ke dua arah
--   (termin lunas tanpa transaksi, dan transaksi tanpa termin). Akibatnya
--   angka di kartu yang sama tidak pernah konsisten.
--
-- MASALAH 2 — "Estimasi Profit" sebenarnya arus kas, bukan estimasi.
--   Rumus lama = uang masuk − pengeluaran. Untuk project yang masih jalan
--   angkanya hampir selalu minus karena belanja mendahului tagihan.
--   Contoh nyata: HYDRANT (kontrak 940jt, pengeluaran 536jt) tampil
--   −136jt / margin −14%, seolah project rugi padahal sehat.
--
-- PERBAIKAN:
--   estimated_profit = contract_value − pengeluaran   (perkiraan hasil akhir)
--   margin_pct       = estimated_profit / contract_value
--   cash_flow        = uang masuk − pengeluaran       (posisi kas, kolom BARU)
--   total_paid       = termin lunas ATAU pemasukan tercatat, mana yang lebih
--                      besar — supaya pembayaran yang tercatat hanya di salah
--                      satu tempat tidak hilang dari hitungan.
--   income_recorded & terms_paid dikembalikan terpisah supaya UI bisa
--   memperingatkan saat keduanya tidak cocok, bukan menyembunyikannya.
--
-- Semua nilai rupiah memakai COALESCE(amount_idr, amount) agar transaksi
-- valas terhitung sebagai rupiah terkunci, bukan nominal asingnya.
-- Pengeluaran & pemasukan diagregasi di subquery terpisah supaya tidak
-- terjadi fan-out seperti bug margin project yang dulu pernah diperbaiki.
-- ============================================================

DROP FUNCTION IF EXISTS get_project_stats(uuid);

CREATE FUNCTION get_project_stats(p_project_id UUID)
RETURNS TABLE (
  total_paid NUMERIC,
  total_expense NUMERIC,
  estimated_profit NUMERIC,
  margin_pct NUMERIC,
  cash_flow NUMERIC,
  income_recorded NUMERIC,
  terms_paid NUMERIC
) AS $$
DECLARE
  v_terms    NUMERIC := 0;
  v_income   NUMERIC := 0;
  v_expense  NUMERIC := 0;
  v_contract NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(amount) FILTER (WHERE paid_at IS NOT NULL), 0)
    INTO v_terms
    FROM project_terms
   WHERE project_id = p_project_id;

  SELECT
    COALESCE(SUM(COALESCE(amount_idr, amount)) FILTER (WHERE type = 'income'), 0),
    COALESCE(SUM(COALESCE(amount_idr, amount)) FILTER (WHERE type = 'expense'), 0)
    INTO v_income, v_expense
    FROM transactions
   WHERE project_id = p_project_id;

  SELECT COALESCE(contract_value, 0) INTO v_contract
    FROM projects WHERE id = p_project_id;

  terms_paid       := v_terms;
  income_recorded  := v_income;
  total_paid       := GREATEST(v_terms, v_income);
  total_expense    := v_expense;
  estimated_profit := v_contract - v_expense;
  cash_flow        := v_income - v_expense;
  margin_pct       := CASE WHEN v_contract > 0
                           THEN ((v_contract - v_expense) / v_contract) * 100
                           ELSE 0 END;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
