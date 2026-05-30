# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

---

## STATUS SESI TERAKHIR (2026-05-30)

- ✅ TypeScript: semua error bersih (`npx tsc --noEmit` 0 error)
- ✅ Multi-wallet dashboard: section "Dompet Saya" di Home, klik wallet filter transaksi
- ✅ Google SSO: tombol "Masuk/Daftar dengan Google" di login & register via Supabase OAuth
- ✅ Avatar URL dari Google disimpan ke `user_preferences.avatar_url`
- ✅ Deploy Vercel: `vercel.json` siap, `npx expo export --platform web` build sukses ke `dist/`
- ✅ `.env.example` dibuat untuk dokumentasi environment variables
- ⚙️ Google SSO butuh setup di Supabase Dashboard: aktifkan provider Google, tambah redirect URL `zena://`
- ⚙️ Deploy Vercel butuh: connect repo di vercel.com, set env vars EXPO_PUBLIC_SUPABASE_URL & EXPO_PUBLIC_SUPABASE_ANON_KEY
- ⚙️ Testing di emulator Android: emulator Pixel_6 sudah terinstall tapi boot sangat lambat di macOS 12

---

## FITUR YANG SUDAH JALAN

### Autentikasi
- Login & Register dengan Supabase Auth
- Google SSO di login & register via `expo-web-browser` + Supabase OAuth
- Avatar URL dari Google otomatis disimpan ke `user_preferences.avatar_url`
- Redirect otomatis: user baru → onboarding, user lama → dashboard

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

### Multi-wallet Dashboard
- Section "Dompet Saya" di tab Home (horizontal scroll cards)
- Setiap card tampilkan icon, nama, dan saldo wallet
- Klik wallet → filter transaksi by `wallet_id`
- Klik lagi → kembali ke semua transaksi
- Balance card tetap menampilkan total gabungan semua wallet

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
19. Multi-wallet dashboard: section "Dompet Saya" di Home + filter transaksi per wallet
20. Google SSO: login & register dengan Google, simpan avatar_url (perlu setup di Supabase Dashboard)
21. Deploy ke Vercel: vercel.json siap, web build sukses (perlu connect repo & set env vars di vercel.com)

### Belum Dikerjakan
1. Hapus data transaksi test (skip dulu)
2. Gmail parsing - auto-detect transaksi & transfer antar wallet dari notif email bank (butuh Google OAuth scope gmail.readonly)
3. Push notification - budget alert 3 level (75%, 90%, 100%)
4. Push notification - notif real-time transaksi dari Gmail
5. Voice Note - integrasi Whisper OpenAI
6. Transaction chaining - transfer antar wallet bukan pengeluaran
7. Smart categorization - AI tanya jam 18.00 untuk transaksi uncategorized
8. Pattern detection AI - kirim tiap Sabtu/Minggu
9. Prediksi akhir bulan AI
10. Anomaly detection AI
11. Share laporan - generate gambar ringkasan bulanan untuk IG story
12. Couple mode - shared wallet dengan pasangan
13. Referral reward - ajak teman dapat 1 bulan Pro gratis
14. AdSense (web) / AdMob (mobile) untuk free tier
15. In-app purchase - Pro Rp 39k/bln, Bisnis Rp 79k/bln
16. PDF export laporan (fitur Bisnis)
17. Submit Play Store & App Store

### Setup yang Dibutuhkan (Manual)
- **Google SSO**: Aktifkan provider Google di Supabase Dashboard → Authentication → Providers. Tambah redirect URL: `zena://` dan URL Vercel kamu.
- **Deploy Vercel**: Connect repo di vercel.com, set env vars `EXPO_PUBLIC_SUPABASE_URL` dan `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
