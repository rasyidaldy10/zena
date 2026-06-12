-- ============================================================
-- FIX: Margin/profit project salah (fan-out join)
-- Jalankan SEKALI di Supabase SQL Editor.
--
-- Masalah lama: get_project_stats nge-JOIN project_terms DAN transactions
-- sekaligus -> cartesian product (mis. 3 termin x 2 transaksi = 6 baris) ->
-- SUM ke-multiply -> total_paid, expense, profit, margin SALAH.
--
-- Fix: hitung agregat termin & transaksi TERPISAH (tanpa join silang).
-- ============================================================

CREATE OR REPLACE FUNCTION get_project_stats(p_project_id UUID)
RETURNS TABLE (
  total_paid NUMERIC,
  total_expense NUMERIC,
  estimated_profit NUMERIC,
  margin_pct NUMERIC
) AS $$
DECLARE
  v_paid     NUMERIC := 0;
  v_income   NUMERIC := 0;
  v_expense  NUMERIC := 0;
  v_contract NUMERIC := 0;
BEGIN
  -- Termin yang sudah dibayar
  SELECT COALESCE(SUM(amount) FILTER (WHERE paid_at IS NOT NULL), 0)
    INTO v_paid
    FROM project_terms
   WHERE project_id = p_project_id;

  -- Pemasukan & pengeluaran dari transaksi project
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0),
    COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)
    INTO v_income, v_expense
    FROM transactions
   WHERE project_id = p_project_id;

  -- Nilai kontrak
  SELECT COALESCE(contract_value, 0)
    INTO v_contract
    FROM projects
   WHERE id = p_project_id;

  total_paid       := v_paid;
  total_expense    := v_expense;
  estimated_profit := v_income - v_expense;
  margin_pct       := CASE WHEN v_contract > 0
                           THEN ((v_income - v_expense) / v_contract * 100)
                           ELSE 0 END;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verifikasi (ganti UUID dengan id project kamu):
-- SELECT * FROM get_project_stats('<project-uuid>');
