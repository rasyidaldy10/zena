---
name: zena-rasyid
description: Akses data keuangan Zena milik Rasyid — catat transaksi, baca saldo/laporan, kelola project/invoice/investasi/reminder. Pakai saat Rasyid minta dicatatkan pengeluaran/pemasukan atau ditanya soal keuangannya.
---

# Zena API — untuk agen Novi

Tool ini memberi Novi akses penuh ke data Zena milik **Rasyid** (kecuali kredensial bank
konvensional yang diblokir). Semua request otomatis ter-scope ke akun Rasyid — Novi tidak bisa
menyentuh akun orang lain.

## Cara panggil

Semua request: **HTTP POST** dengan JSON, plus header Authorization.

```
POST https://lcvenmsxauasaemjjxtc.supabase.co/functions/v1/novi-api
Authorization: Bearer novi_31892b8bd514dfbb7ee8669767fbaee5631d7bf4b8cdf66a51e4171266ea55b4
Content-Type: application/json

{ "action": "<nama_action>", ...params }
```

Contoh cURL:
```bash
curl -X POST "https://lcvenmsxauasaemjjxtc.supabase.co/functions/v1/novi-api" \
  -H "Authorization: Bearer novi_31892b8bd514dfbb7ee8669767fbaee5631d7bf4b8cdf66a51e4171266ea55b4" \
  -H "Content-Type: application/json" \
  -d '{"action":"record_transaction","type":"expense","amount":50000,"category":"Makanan","note":"makan siang"}'
```

Respons sukses: `{ "ok": true, "action": "...", "result": {...} }`
Respons gagal: `{ "ok": false, "error": "pesan" }` (HTTP 4xx/5xx).

⚠️ **API key di atas = akses penuh ke data Rasyid. Rahasiakan.** Jangan tulis di log/output publik.

---

## Action utama

### `record_transaction` — catat pemasukan/pengeluaran (paling sering dipakai)
Otomatis update saldo dompet.
| Param | Wajib | Catatan |
|-------|-------|---------|
| `type` | ✅ | `"income"` atau `"expense"` |
| `amount` | ✅ | angka (rupiah, tanpa titik), > 0 |
| `category` | ➖ | mis. `"Makanan"`, `"Transport"`, `"Gaji"`. Default `"Lainnya"` |
| `note` | ➖ | keterangan bebas |
| `wallet_id` | ➖ | **paling akurat**. Kalau kosong → pakai dompet pertama |
| `wallet_name` | ➖ | alternatif, cocokkan sebagian nama (fuzzy, ambil yang pertama cocok) |
| `date` | ➖ | `YYYY-MM-DD`. Default hari ini (WIB) |
| `project_id` | ➖ | kaitkan ke project bisnis |

Contoh: `{"action":"record_transaction","type":"expense","amount":50000,"category":"Makanan","note":"makan siang","wallet_id":"<id>"}`

### `transfer` — pindah dana antar dompet
Param: `amount`, `from_wallet_id`/`from_wallet_name`, `to_wallet_id`/`to_wallet_name`, `note?`, `date?`.

### `delete_transaction` — hapus transaksi (saldo otomatis dibalikin)
Param: `id`.

### `list_wallets` — daftar dompet + saldo
Tanpa param. Gunakan dulu untuk dapat `wallet_id` yang tepat sebelum mencatat.

### `list_transactions` — riwayat transaksi
Param opsional: `limit` (default 50), `filters` (mis. `{"type":"expense"}`), `order` (default `date`).

### `summary` — ringkasan bulan
Param: `month` (`YYYY-MM`, default bulan ini). Mengembalikan `income`, `expense`, `net`, `total_balance`.

---

## Generic CRUD (untuk fitur lain: project, invoice, investasi, reminder, produk, dll)

### `db_select` — baca tabel
`{"action":"db_select","table":"projects","filters":{"status":"aktif"},"order":"created_at","ascending":false,"limit":20}`

### `db_insert` — buat baris baru (`user_id` otomatis diisi)
`{"action":"db_insert","table":"reminders","values":{"title":"Bayar listrik","amount":350000,"due_date":"2026-07-05"}}`

### `db_update` — ubah baris milik Rasyid
`{"action":"db_update","table":"reminders","id":"<id>","values":{"is_paid":true}}`

### `db_delete` — hapus baris milik Rasyid
`{"action":"db_delete","table":"projects","id":"<id>"}`

**Tabel yang diizinkan:** `transactions`, `user_wallets`, `recurring_transactions`, `reminders`,
`investment_holdings`, `investment_transactions`, `projects`, `receivables`, `products`,
`stock_movements`, `tax_summary`, `documents`, `business_profile`, `business_bank_accounts`,
`user_preferences`, `notifications`, `ai_insights`.
Tabel anak (perlu fk induk milik Rasyid): `project_terms` (`project_id`), `transaction_items`
(`transaction_id`), `product_variants` (`product_id`).

### Util
- `whoami` → konfirmasi akun yang diakses.
- `list_actions` → daftar semua action.

---

## Aturan & batasan

- 🔒 **Data bank konvensional DIBLOKIR.** Tabel `bank_connections` & `bank_connection_audit_log`
  (token bank, nomor rekening) tidak bisa diakses sama sekali → balikin error 403. Jangan coba akses.
- Semua operasi terkunci ke akun Rasyid; `user_id` selalu dipaksa server-side.
- Untuk nominal: kirim angka murni (50000), bukan "Rp50.000".
- Sebelum mencatat ke dompet spesifik, panggil `list_wallets` dulu untuk ambil `wallet_id` yang benar
  (cocokkan nama persis), karena pencocokan via `wallet_name` bersifat fuzzy.
- Transaksi buatan Novi ditandai `source: "novi"` untuk jejak audit.
