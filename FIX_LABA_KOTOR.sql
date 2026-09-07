-- ============================================================
-- PERBAIKAN LAPORAN LABA KOTOR
--
-- Dua fungsi ini selalu mengembalikan NOL karena menyaring
-- `t.business_category = 'penjualan'`, padahal jalur pencatatan yang
-- benar-benar dipakai (tombol "Jual Produk" di app/tambah-transaksi.tsx)
-- hanya mengisi `has_items` + baris `transaction_items`, TIDAK pernah
-- mengisi business_category. Komponen yang mengisinya
-- (components/BusinessTransactionForm.tsx) tidak dipakai di layar mana pun.
-- Terbukti di data nyata: 11 penjualan berisi HPP, 0 transaksi ber-kategori
-- 'penjualan'.
--
-- Selain itu get_monthly_gross_profit menjumlahkan `t.amount` di atas hasil
-- JOIN ke transaction_items. Kalau satu transaksi punya >1 item, nilai
-- transaksinya ikut terhitung berkali-kali (fan-out). Sekarang seluruh
-- angka diambil dari transaction_items sehingga aman.
--
-- Sumber kebenaran laba kotor = transaction_items:
--   penjualan = SUM(subtotal), HPP = SUM(hpp_total)
-- ============================================================

CREATE OR REPLACE FUNCTION get_monthly_gross_profit(
  p_user_id UUID, p_month INT, p_year INT
)
RETURNS TABLE (
  total_sales NUMERIC,
  total_hpp NUMERIC,
  gross_profit NUMERIC,
  gross_margin_pct NUMERIC
) AS $$
DECLARE
  v_start DATE;
  v_end   DATE;
BEGIN
  v_start := make_date(p_year, p_month, 1);
  v_end   := (v_start + INTERVAL '1 month')::DATE;

  RETURN QUERY
  SELECT
    COALESCE(SUM(ti.subtotal), 0)::NUMERIC,
    COALESCE(SUM(ti.hpp_total), 0)::NUMERIC,
    COALESCE(SUM(ti.subtotal - ti.hpp_total), 0)::NUMERIC,
    CASE WHEN COALESCE(SUM(ti.subtotal), 0) > 0
         THEN (COALESCE(SUM(ti.subtotal - ti.hpp_total), 0)
               / SUM(ti.subtotal)) * 100
         ELSE 0 END::NUMERIC
  FROM transaction_items ti
  JOIN transactions t ON t.id = ti.transaction_id
  WHERE t.user_id = p_user_id
    AND t.date >= v_start
    AND t.date <  v_end;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION get_product_sales_report(
  p_user_id UUID, p_month INT, p_year INT
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  qty_sold NUMERIC,
  total_hpp NUMERIC,
  total_sales NUMERIC,
  profit NUMERIC,
  margin_pct NUMERIC
) AS $$
DECLARE
  v_start DATE;
  v_end   DATE;
BEGIN
  v_start := make_date(p_year, p_month, 1);
  v_end   := (v_start + INTERVAL '1 month')::DATE;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    COALESCE(SUM(ti.qty), 0)::NUMERIC,
    COALESCE(SUM(ti.hpp_total), 0)::NUMERIC,
    COALESCE(SUM(ti.subtotal), 0)::NUMERIC,
    COALESCE(SUM(ti.subtotal - ti.hpp_total), 0)::NUMERIC,
    CASE WHEN COALESCE(SUM(ti.subtotal), 0) > 0
         THEN (COALESCE(SUM(ti.subtotal - ti.hpp_total), 0)
               / SUM(ti.subtotal)) * 100
         ELSE 0 END::NUMERIC
  FROM products p
  JOIN transaction_items ti ON ti.product_id = p.id
  JOIN transactions t ON t.id = ti.transaction_id
  WHERE p.user_id = p_user_id
    AND t.date >= v_start
    AND t.date <  v_end
  GROUP BY p.id, p.name
  HAVING COALESCE(SUM(ti.qty), 0) > 0
  ORDER BY COALESCE(SUM(ti.subtotal), 0) DESC;
END;
$$ LANGUAGE plpgsql;
