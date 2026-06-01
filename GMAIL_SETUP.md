# Gmail Integration untuk Zena

## Setup Google Cloud Console

1. Buka https://console.cloud.google.com/
2. Pilih project yang sama dengan Google SSO (atau buat baru)
3. **APIs & Services → Enable APIs**
   - Cari "Gmail API"
   - Klik **Enable**

4. **OAuth consent screen**
   - Tambahkan scope: `https://www.googleapis.com/auth/gmail.readonly`
   - Scope ini allow Zena membaca email (tidak bisa kirim/hapus)

5. **Credentials → OAuth 2.0 Client IDs**
   - Client ID yang sudah ada untuk Google SSO sudah cukup
   - Pastikan redirect URI sudah include: `https://zena-mu.vercel.app`

## Setup Supabase

1. **Supabase Dashboard → Authentication → Providers → Google**
   - Tambahkan scope: `https://www.googleapis.com/auth/gmail.readonly`
   - Klik **Save**

2. **Test Login**
   - User login pertama kali dengan scope baru akan diminta consent untuk akses Gmail
   - Refresh token akan disimpan di `auth.users.user_metadata`

## Cara Parsing Email Bank

Edge function `gmail-parser` sudah siap di `supabase/functions/gmail-parser/index.ts`.

**Flow:**
1. Cron job jalan setiap 1 jam
2. Fetch emails dari Gmail API dengan query: `from:noreply@bca.co.id OR from:noreply@mandiri.co.id` (contoh)
3. Parse subject & body untuk ambil:
   - Nominal transaksi
   - Tipe (debit/kredit)
   - Merchant name
   - Timestamp
4. Insert ke tabel `transactions` dengan flag `source: 'gmail'`
5. Update saldo wallet yang sesuai

**Contoh format email BCA:**
```
Subject: Mutasi Rekening BCA
Body:
Trx: Pembelian di INDOMARET
Nominal: Rp 50.000
Saldo: Rp 1.500.000
Tanggal: 01/06/2026 10:30
```

**Regex untuk parsing:**
```typescript
const nominalMatch = body.match(/Rp\s?([\d.,]+)/i)
const merchantMatch = body.match(/(?:di|at)\s+(.+)/i)
const dateMatch = body.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/i)
```

## Deploy

```bash
# Deploy gmail-parser function
npx supabase functions deploy gmail-parser

# Setup cron di Supabase Dashboard
# Cron: 0 * * * * (setiap jam)
# URL: POST /functions/v1/gmail-parser
```

## Testing

Setelah deploy, test manual:
```bash
curl -X POST https://lcvenmsxauasaemjjxtc.supabase.co/functions/v1/gmail-parser \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

Cek tabel `agent_logs` untuk lihat hasil parsing.

## Notes

- Gmail API quota: 1 billion units/day (cukup untuk jutaan user)
- Rate limit: 250 queries/user/second
- Email di-parse hanya untuk 7 hari terakhir (avoid duplicate)
- Transaksi dari Gmail auto-tagged `source: 'gmail'` dan read-only (user tidak bisa edit/hapus)
