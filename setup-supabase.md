# Setup Supabase FULL OTOMATIS

## 🎯 Tujuan
Deploy edge functions dan setup cron jobs tanpa install CLI lokal. Semua via GitHub Actions + SQL migration.

---

## 📋 Step-by-Step (Copy-Paste Aja!)

### 1. Setup GitHub Secrets

Buka: https://github.com/rasyidaldy10/zena/settings/secrets/actions

**Secret 1: SUPABASE_ACCESS_TOKEN**
1. Buka Supabase Dashboard → klik avatar kanan atas → **Account Settings**
2. Klik tab **Access Tokens** (https://supabase.com/dashboard/account/tokens)
3. Klik **"Generate new token"** → kasih nama "GitHub Actions"
4. Copy token → paste ke GitHub secret dengan nama: `SUPABASE_ACCESS_TOKEN`

**Secret 2: SUPABASE_PROJECT_ID**
1. Buka project Zena: https://supabase.com/dashboard/project/_
2. Lihat URL, ambil yang setelah `/project/`: contoh `abcdefghijklmnop`
3. Copy project ID → paste ke GitHub secret dengan nama: `SUPABASE_PROJECT_ID`

---

### 2. Deploy Edge Functions (Otomatis via GitHub Actions)

File workflow sudah dibuat: `.github/workflows/deploy-supabase.yml`

**Cara trigger:**
- **Otomatis**: Setiap kali push ke branch `main` dan ada perubahan di folder `supabase/functions/`
- **Manual**: Buka https://github.com/rasyidaldy10/zena/actions → pilih workflow "Deploy Supabase Edge Functions" → klik "Run workflow"

Setelah push commit ini, GitHub Actions akan otomatis deploy semua edge functions!

---

### 3. Run SQL Migrations di Supabase Dashboard

Buka: https://supabase.com/dashboard/project/<your-project-id>/editor

**Copy-paste SQL ini satu per satu:**

#### Migration 3: Bank Info di Wallet
```sql
-- File: supabase/migrations/003_add_bank_info_to_wallets.sql
ALTER TABLE user_wallets
ADD COLUMN bank_name TEXT,
ADD COLUMN last_4_digits TEXT;

DROP TABLE IF EXISTS gmail_wallet_mappings;

CREATE INDEX idx_wallets_bank_info ON user_wallets(user_id, bank_name, last_4_digits)
WHERE bank_name IS NOT NULL AND last_4_digits IS NOT NULL;
```

#### Migration 4: Investment Tracking
```sql
-- File: supabase/migrations/004_investment_tracking.sql
-- Copy dari file lengkap
```

#### Migration 6: Project Settings (PENTING!)
```sql
-- Ganti <YOUR_PROJECT_REF> dan <YOUR_SERVICE_ROLE_KEY>

-- Ambil project ref dari URL: https://supabase.com/dashboard/project/<INI_PROJECT_REF>
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://<YOUR_PROJECT_REF>.supabase.co';

-- Ambil service role key: Dashboard > Settings > API > service_role key
ALTER DATABASE postgres SET app.settings.service_role_key = '<YOUR_SERVICE_ROLE_KEY>';
```

#### Migration 5: Setup Cron Jobs
```sql
-- File: supabase/migrations/005_setup_cron_jobs.sql
-- Copy lengkap dari file, jalankan terakhir setelah migration 6
```

---

### 4. Verify Cron Jobs Sudah Aktif

```sql
-- Lihat daftar cron jobs
SELECT jobid, jobname, schedule, active, command
FROM cron.job
ORDER BY jobname;

-- Lihat log execution
SELECT *
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

---

## ✅ Checklist

- [ ] Setup 2 GitHub Secrets (SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID)
- [ ] Push commit ini ke GitHub → GitHub Actions auto-deploy edge functions
- [ ] Run migration 003 (bank info)
- [ ] Run migration 004 (investment tracking)
- [ ] Run migration 006 (project settings) - **GANTI VALUE-NYA DULU!**
- [ ] Run migration 005 (cron jobs)
- [ ] Verify cron jobs via SQL query

---

## 🧪 Test Manual Edge Function

Setelah deploy, test via curl:

```bash
# Ganti <project-ref> dan <anon-key>
curl -X POST \
  'https://<project-ref>.supabase.co/functions/v1/stock-price-updater' \
  -H 'Authorization: Bearer <anon-key>' \
  -H 'Content-Type: application/json'
```

Atau via Supabase Dashboard:
- Edge Functions → pilih function → tab "Invocations" → "Test function"

---

## 📅 Jadwal Cron Jobs

| Function | Jadwal | Deskripsi |
|----------|--------|-----------|
| `stock-price-updater` | Senin-Jumat 16:30 WIB | Update harga saham setelah penutupan bursa |
| `weekly-insight` | Sabtu 09:00 WIB | Generate insight mingguan via Claude AI |
| `daily-summary` | Setiap hari 21:00 WIB | Ringkasan harian + motivasi |

---

## 🔧 Troubleshooting

**Cron job tidak jalan?**
1. Cek `cron.job_run_details` untuk error log
2. Pastikan `app.settings.service_role_key` sudah diset
3. Test edge function manual via Supabase Dashboard

**Edge function deploy gagal?**
1. Cek GitHub Actions logs
2. Pastikan secrets sudah diset dengan benar
3. Coba manual trigger workflow

**Permission error saat npm install?**
- Gunakan `sudo npm install -g supabase`
- Atau gunakan `npx supabase` (no install)
- Atau gunakan GitHub Actions (recommended)

---

## 🎉 Selesai!

Setelah semua checklist di atas selesai:
- ✅ Edge functions auto-deploy setiap push
- ✅ Cron jobs jalan otomatis sesuai jadwal
- ✅ Harga saham update otomatis setiap hari
- ✅ AI insights terkirim otomatis

No need to touch Supabase Dashboard lagi! 🚀
