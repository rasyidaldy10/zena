# 🚨 MIGRATION CHECKLIST - WAJIB DIJALANKAN!

**Status:** ⏳ PENDING - Belum dijalankan di Supabase production

---

## ⚠️ ISSUE SAAT INI

### 1. Mode Bisnis Belum Muncul
**Cause:** Migration belum dijalankan di Supabase  
**Kolom yang hilang:**
- `user_preferences.business_mode`
- `user_preferences.active_mode`
- `user_preferences.ppn_enabled`
- `user_preferences.ppn_rate`
- `user_wallets.wallet_function`

**Fix:** Jalankan migration di bawah ⬇️

---

## 📋 STEP-BY-STEP MIGRATION

### ✅ STEP 1: Check Existing Columns

**Buka Supabase SQL Editor:**  
https://supabase.com/dashboard/project/fxftwdfdlxmjfxuadhfy/sql

**Run query ini:**
```sql
-- Check apakah kolom business_mode sudah ada
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND column_name IN ('business_mode', 'active_mode', 'ppn_enabled', 'ppn_rate');
```

**Expected result:**
- Kalau return **0 rows** → Migration belum dijalankan ❌
- Kalau return **4 rows** → Migration sudah jalan ✅

---

### ✅ STEP 2: Run Business Mode Migration

**File:** `SETUP_SUPABASE_SAFE.sql` (sudah ada di root folder)

**Cara:**
1. Buka file `/Users/rasyid/Desktop/zena/SETUP_SUPABASE_SAFE.sql`
2. Copy ALL content (Cmd+A, Cmd+C)
3. Paste ke Supabase SQL Editor
4. Klik **RUN**

**Expected result:**
```
Success! 
- 7 tables created (projects, project_terms, receivables, products, stock_movements, transaction_items, tax_summary)
- 6 helper functions created
- RLS policies active
```

**Verify dengan query:**
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('projects', 'receivables', 'products', 'stock_movements', 'transaction_items', 'tax_summary', 'project_terms')
ORDER BY table_name;
```

**Should return 7 rows** ✅

---

### ✅ STEP 3: Run Old Migrations (if not yet)

**Check apakah tabel sudah ada:**
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('notifications', 'ai_insights', 'investment_holdings');
```

**Kalau return 0 rows, run migrations ini:**

**001_zena_intelligence.sql:**
- Creates: notifications, ai_insights tables
- Creates: insert_notification() function

**002_add_ceo_welcome_flag.sql:**
- Adds: has_seen_ceo_welcome column to user_preferences

**003_investment_holdings.sql:**
- Creates: investment_holdings table

**Files location:** `/Users/rasyid/Desktop/zena/supabase/migrations/`

**Run satu-satu di Supabase SQL Editor**

---

### ✅ STEP 4: Verify Migration Success

**Run verification query:**
```sql
-- Check all business tables
SELECT 
  t.table_name,
  COUNT(c.column_name) as column_count
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
AND t.table_name IN (
  'projects', 'project_terms', 'receivables', 
  'products', 'stock_movements', 'transaction_items', 'tax_summary',
  'notifications', 'ai_insights', 'investment_holdings'
)
GROUP BY t.table_name
ORDER BY t.table_name;
```

**Expected result:** 10 tables dengan column count masing-masing

**Check RLS policies:**
```sql
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('projects', 'receivables', 'products')
ORDER BY tablename;
```

**Should return multiple policies per table** ✅

---

### ✅ STEP 5: Test di App

**After migration success:**

1. **Refresh Vercel app:** https://zena-mu.vercel.app
2. **Login**
3. **Tap Profil**
4. **Scroll ke "Mode Bisnis"**
5. **Toggle "Aktifkan Mode Bisnis"** → Should work ✅
6. **Kembali ke Home**
7. **Toggle button muncul di Balance Card** ✅
8. **Tap "⇄ Bisnis"** → UI switch ✅

---

## 🐛 TROUBLESHOOTING

### Issue: "column business_mode does not exist"
**Fix:** Migration belum dijalankan. Run SETUP_SUPABASE_SAFE.sql

### Issue: "relation projects does not exist"
**Fix:** Migration belum dijalankan. Run SETUP_SUPABASE_SAFE.sql

### Issue: "function get_low_stock_count does not exist"
**Fix:** Migration belum dijalankan. Run SETUP_SUPABASE_SAFE.sql

### Issue: Toggle muncul tapi UI tidak berubah
**Fix:** Clear browser cache (Cmd+Shift+R), atau hard refresh

### Issue: RPC function error
**Fix:** Check function exists:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'get_project_stats', 
  'get_low_stock_count', 
  'calculate_ppn', 
  'get_monthly_gross_profit',
  'get_product_sales_report',
  'upsert_tax_summary'
);
```
Should return 6 functions.

---

## 📝 AFTER MIGRATION

**Tasks:**
1. ✅ Test Business Mode toggle
2. ✅ Create sample project
3. ✅ Create sample product
4. ✅ Verify stats update real-time
5. ✅ Test balance filtering (personal vs business)
6. ⏳ Deploy Edge Functions (budget-monitor, anomaly-detector, dll)
7. ⏳ Setup cron jobs (weekly-insight, daily-summary)

---

## 🎯 MIGRATION STATUS TRACKER

**Last Check:** 2026-06-09  
**Environment:** Production (fxftwdfdlxmjfxuadhfy.supabase.co)

- [ ] SETUP_SUPABASE_SAFE.sql executed
- [ ] 001_zena_intelligence.sql executed
- [ ] 002_add_ceo_welcome_flag.sql executed
- [ ] 003_investment_holdings.sql executed
- [ ] Verification query passed
- [ ] App tested - Business Mode works
- [ ] Edge Functions deployed
- [ ] Cron jobs configured

**Tandai ✅ setelah selesai!**

---

**💡 TIP:** Bookmark checklist ini. Run setiap kali setup Supabase baru atau reset database!
