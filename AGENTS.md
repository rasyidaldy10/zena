# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

---

## STATUS SESI TERAKHIR (2026-05-30)

- ✅ TypeScript: semua error bersih (`npx tsc --noEmit` 0 error)
- ✅ Wallet balance: diambil dari `current_balance` di tabel `user_wallets` (bukan dihitung dari transaksi)
- ✅ Wallet type/fungsi: `app/tambah-wallet.tsx` sudah dibuat, `WALLET_TYPE_CONFIG` sudah ada di `types/index.ts`
- ✅ Seksi "Dompet Saya" di tab Profil: daftar wallet + tombol tambah
- ✅ Claude Code: sudah setup dan jalan di project ini
- ⚙️ Testing: belum bisa dicoba di emulator/device (Xcode tidak support macOS 12, Android emulator belum terbuka sempurna)

---

## FITUR YANG SUDAH JALAN

### Autentikasi
- Login & Register dengan Supabase Auth

### Onboarding
- Pilih bahasa (ID, EN, MY, ZH)
- Pilih nama panggilan
- Pilih AI persona (bestie, advisor, kakak, adek, pacar, stoic)
- Pilih metode budgeting (50/30/20, 70/30/10, zero-based, envelope, pay-first, custom)
- Input penghasilan bulanan
- Auto-buat 2 wallet default (Cash, Bank) saat onboarding selesai

### Dashboard (Home)
- Greeting dinamis pakai nama user + waktu (pagi/siang/sore/malam)
- Total saldo dihitung dari semua wallet aktif (bukan dari transaksi)
- Toggle mode Pribadi / Bisnis
- Quick actions: Catat transaksi, AI Chat
- Daftar 10 transaksi terakhir

### Transaksi
- Tambah transaksi manual (nominal, tipe income/expense, kategori, catatan)
- Pilih wallet sumber saat tambah transaksi
- Saldo wallet otomatis ter-update setelah transaksi disimpan

### Wallet
- Daftar wallet tampil di tab Profil (seksi "Dompet Saya")
- Tambah wallet baru via `app/tambah-wallet.tsx`
- Pilihan tipe/fungsi wallet: Rekening Utama, Dana Darurat, E-Wallet, Dompet Transit, Tabungan, Investasi
- Tersimpan ke kolom `wallet_type` di tabel `user_wallets`
- Picker ikon (emoji) dan warna untuk wallet
- Input saldo awal saat buat wallet

### Laporan
- Filter per bulan (navigasi bulan sebelum/sesudah)
- Ringkasan pemasukan, pengeluaran, saldo bersih
- Breakdown pengeluaran per kategori dengan progress bar
- Daftar semua transaksi bulan tersebut

### Profil
- Tampil financial score (0–100) dan tier (Starter → Sovereign)
- Edit nama panggilan dan penghasilan bulanan
- Ganti AI persona
- Ganti metode budgeting
- Seksi "Dompet Saya": daftar wallet aktif + tombol tambah wallet

### AI Chat
- Persona & bahasa AI mengikuti preferensi user
- Scan struk (receipt) via kamera
- Voice note input

### Reminder
- Halaman reminder (tab tersendiri)

### Bottom Navigation
- Tab: Home, Laporan, + (tambah transaksi), Reminder, Profil
- Tombol + di tengah navigasi bawah

---

## TASK LIST

### Sudah Selesai ✅
1. Auth: login, register
2. Onboarding 5 step: bahasa (pertama), nama, persona, budgeting, income - 4 bahasa (ID, EN, MY, ZH)
3. Dashboard: greeting pakai nama + waktu, balance card dari current_balance wallet, quick actions, transaksi terakhir
4. Bottom nav: tombol + di tengah naik (opsi A)
5. Tambah transaksi manual + pilih wallet + update current_balance otomatis
6. Laporan: breakdown kategori, chart, filter bulan
7. Reminder: tambah tagihan, toggle paid/unpaid
8. Profil: tier display, financial score, ganti persona, seksi Dompet Saya
9. Tambah wallet: app/tambah-wallet.tsx + WALLET_TYPE_CONFIG di types/index.ts
10. AI Chat: proxy via Supabase Edge Function (API key aman di server)
11. Scan struk di chat AI via Claude Vision
12. Voice note placeholder di chat (tombol ada, pending Whisper)
13. 6 persona AI (bestie, advisor, kakak, adek, pacar, stoic)
14. Tier system: Starter→Bronze→Silver→Gold→Platinum→Sovereign
15. Financial score engine
16. TypeScript errors semua bersih
17. Claude Code setup dan jalan
18. AGENTS.md selalu diupdate tiap akhir sesi

### Belum Dikerjakan
1. Hapus data transaksi test (skip dulu)
2. Google SSO + sekalian minta scope gmail.readonly
3. Gmail parsing - auto-detect transaksi & transfer antar wallet dari notif email bank
4. Push notification - budget alert 3 level (75%, 90%, 100%)
5. Push notification - notif real-time transaksi dari Gmail
6. Voice Note - integrasi Whisper OpenAI
7. Transaction chaining - transfer antar wallet bukan pengeluaran
8. Smart categorization - AI tanya jam 18.00 untuk transaksi uncategorized
9. Multi-wallet dashboard - saldo per wallet
10. Pattern detection AI - kirim tiap Sabtu/Minggu
11. Prediksi akhir bulan AI
12. Anomaly detection AI
13. Share laporan - generate gambar ringkasan bulanan untuk IG story
14. Couple mode - shared wallet dengan pasangan
15. Referral reward - ajak teman dapat 1 bulan Pro gratis
16. AdSense (web) / AdMob (mobile) untuk free tier
17. In-app purchase - Pro Rp 39k/bln, Bisnis Rp 79k/bln
18. PDF export laporan (fitur Bisnis)
19. Deploy ke Vercel
20. Submit Play Store & App Store
