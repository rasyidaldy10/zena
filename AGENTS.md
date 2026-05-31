# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

---

## STATUS SESI TERAKHIR (2026-05-31)

- ✅ TypeScript: semua error bersih (`npx tsc --noEmit` 0 error)
- ✅ Bug fix: wallet filter di Home sekarang pakai `wallet_id OR wallet_source` (filter sebelumnya broken)
- ✅ Transfer antar wallet: tipe transaksi "Transfer" di tambah-transaksi.tsx dengan linked pair transactions
- ✅ Custom tanggal transaksi: DatePicker di tambah-transaksi.tsx dan edit-transaksi.tsx
- ✅ Edit transaksi: screen baru `app/edit-transaksi.tsx` dengan restore saldo otomatis
- ✅ Hapus transaksi: dari home tap transaksi → opsi Edit/Hapus + saldo dikembalikan
- ✅ Hapus transfer: hapus kedua sisi transfer sekaligus via transaction_chain
- ✅ Budget tracking di Laporan: breakdown kebutuhan/keinginan/tabungan berdasarkan metode budget user
- ✅ Saving rate indicator di Laporan
- ✅ Share laporan: tombol "↑ Share" di Laporan, teks ringkasan yang bisa dikirim ke WhatsApp dll
- ✅ AI context-aware: chat.tsx fetch 3 bulan terakhir transaksi + kirim ke AI sebagai context real-time
- ✅ AI personas.ts: `getContextualSystemPrompt()` include data keuangan nyata (pengeluaran, budget, proyeksi)
- ✅ Proyeksi akhir bulan di AI context: daily avg × sisa hari
- ✅ Budget alerts: setelah simpan transaksi, cek budget dan tampilkan Alert jika 75%/90%/100%
- ✅ Quick replies AI: "Rekap pengeluaran bulan ini", "Prediksi akhir bulan", "Analisis pola belanjaku", dll
- ✅ Transfer keluar/masuk tampil di home dengan label yang benar (bukan expense biasa)
- ✅ Today stats di balance card: pemasukan + pengeluaran hari ini
- ✅ tsconfig.json: exclude `supabase/functions` agar Deno types tidak error TypeScript
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
16. TypeScript errors semua bersih (0 error)
17. Claude Code setup dan jalan
18. AGENTS.md selalu diupdate tiap akhir sesi
19. Multi-wallet dashboard: section "Dompet Saya" di Home + filter transaksi per wallet
20. Google SSO: login & register dengan Google, simpan avatar_url (perlu setup di Supabase Dashboard)
21. Deploy ke Vercel: vercel.json siap, web build sukses (perlu connect repo & set env vars di vercel.com)
22. **Transfer antar wallet**: tipe "Transfer" di tambah-transaksi, linked pair transactions, saldo auto-update di kedua wallet
23. **Edit transaksi**: screen `app/edit-transaksi.tsx`, restore saldo lama dulu lalu apply saldo baru
24. **Hapus transaksi**: dari home tap transaksi → Alert opsi Edit/Hapus, saldo dikembalikan otomatis
25. **Hapus transfer**: hapus kedua sisi sekaligus via `transaction_chain`
26. **Custom tanggal**: DatePicker di tambah-transaksi dan edit-transaksi
27. **Budget tracking di Laporan**: breakdown per bucket (kebutuhan/keinginan/tabungan) berdasarkan metode user, color-coded
28. **Saving rate**: indicator persentase tabungan bulanan di Laporan
29. **Share laporan**: tombol share di Laporan, format teks siap kirim ke WhatsApp/media sosial
30. **Budget alert in-app**: setelah save transaksi expense, cek total bulan ini, alert jika 75%/90%/100% dari budget
31. **AI context-aware**: fetch 3 bulan transaksi → kirim ke AI sebagai real-time financial context
32. **AI prediksi akhir bulan**: proyeksi = daily avg × sisa hari, tersedia dalam context AI
33. **AI analisis pattern**: AI pakai data nyata untuk analisis spending pattern
34. **Today stats di balance card**: mini stats pemasukan + pengeluaran hari ini
35. **Quick replies AI berbasis data**: "Prediksi akhir bulan", "Kategori terboros", "Analisis pola belanjaku"
36. **Bug fix**: wallet filter di Home sekarang pakai `wallet_id OR wallet_source`
37. **Bug fix**: tsconfig.json exclude `supabase/functions` agar Deno types tidak crash TypeScript

### Belum Dikerjakan
1. Hapus data transaksi test (skip dulu)
2. Gmail parsing - auto-detect transaksi dari notif email bank (butuh Google OAuth scope gmail.readonly)
3. Push notification server-side - notif real-time via Expo Push atau FCM (butuh EAS build)
4. Voice Note - integrasi Whisper OpenAI (butuh API key + upload audio ke server)
5. Couple mode - shared wallet dengan pasangan (butuh schema DB baru)
6. Referral reward - ajak teman dapat 1 bulan Pro gratis
7. AdSense (web) / AdMob (mobile) untuk free tier
8. In-app purchase - Pro Rp 39k/bln, Bisnis Rp 79k/bln (butuh RevenueCat/StoreKit)
9. PDF export laporan (fitur Bisnis) - butuh expo-print atau react-native-pdf
10. Share laporan sebagai gambar IG story (butuh react-native-view-shot)
11. Submit Play Store & App Store (butuh EAS build + developer account)

### Setup yang Sudah Selesai (Manual)
- ✅ **Google SSO**: Provider Google aktif di Supabase, Client ID/Secret dari Google Cloud terhubung, redirect URL `zena://` dan `https://zena-mu.vercel.app` sudah dikonfigurasi
- ✅ **Deploy Vercel**: Live di https://zena-mu.vercel.app, env vars sudah diset, auto-deploy dari GitHub main branch
