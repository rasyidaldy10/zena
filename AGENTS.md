# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

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
