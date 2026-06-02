# ZENA Testing Checklist - Pre-Production

## ✅ Core Features (Must Work)

### Authentication
- [ ] Login dengan email/password
- [ ] Login dengan Google SSO
- [ ] Register new user
- [ ] Logout
- [ ] Session persists (no forced re-login)
- [ ] Auto-redirect: user baru → onboarding, user lama → dashboard

### Onboarding
- [ ] 5 steps complete: bahasa, nama, persona, budget method, income
- [ ] Auto-create 2 default wallets (Cash, Bank)
- [ ] Save preferences to database

### Dashboard (Home)
- [ ] Greeting dinamis (pagi/siang/sore/malam + nama)
- [ ] Balance card shows total dari semua wallet
- [ ] Today stats (pemasukan + pengeluaran hari ini)
- [ ] Multi-wallet section (horizontal scroll)
- [ ] Click wallet → filter transaksi
- [ ] 10 transaksi terakhir tampil
- [ ] Quick actions work:
  - [ ] AI Chat button
  - [ ] ZENA Intel button
  - [ ] Tabungan button (shows "coming soon")
  - [ ] Leaderboard button (shows "coming soon")
  - [ ] Reminder button

### Transaksi
- [ ] Tambah transaksi (income/expense)
- [ ] Pilih wallet sumber
- [ ] Custom tanggal via DatePicker
- [ ] Saldo wallet auto-update
- [ ] Transfer antar wallet (linked pair)
- [ ] Edit transaksi
- [ ] Hapus transaksi (saldo restored)
- [ ] Hapus transfer (both sides deleted)

### Wallet
- [ ] List wallet di Profil & Home
- [ ] Tambah wallet baru (7 types)
- [ ] Pilih icon & warna
- [ ] Input saldo awal
- [ ] Filter transaksi by wallet

### Laporan
- [ ] Filter per bulan (prev/next navigation)
- [ ] Ringkasan: pemasukan, pengeluaran, saldo bersih
- [ ] Saving rate indicator
- [ ] Budget tracking (breakdown per bucket)
- [ ] Breakdown kategori dengan progress bar
- [ ] Share laporan (text format)

### AI Chat
- [ ] Open chat screen tanpa crash
- [ ] No redirect ke login (if logged in)
- [ ] Send message & receive AI response
- [ ] Quick replies work
- [ ] Scan struk (camera upload)
- [ ] Context-aware (fetch 3 bulan transaksi)
- [ ] Persona & language sesuai preferensi

### ZENA Intelligence
- [ ] Open intelligence screen
- [ ] 6 agent cards tampil dengan status
- [ ] Live Alerts section
- [ ] AI Insights section
- [ ] Realtime updates via Supabase

### Notifications
- [ ] Notification bell dengan badge count
- [ ] Open notifications screen
- [ ] List all alerts
- [ ] Mark as read
- [ ] Delete notification
- [ ] Realtime badge update

### Profil
- [ ] Financial score & tier tampil
- [ ] Edit nama & income
- [ ] Ganti AI persona
- [ ] Ganti budget method
- [ ] List "Dompet Saya"
- [ ] Tambah wallet dari profil
- [ ] ZENA Intelligence banner

### Reminder
- [ ] Open reminder screen
- [ ] List reminders
- [ ] Add reminder (if implemented)

---

## 🎯 Known Issues (Documented)

### Non-Critical (Won't Block Production)
- ⚠️ Shadow style warnings (cosmetic)
- ⚠️ textShadow warnings (cosmetic)
- ⚠️ pointerEvents deprecated (cosmetic)
- ⚠️ Animated `useNativeDriver` fallback on web (expected)

### Features Disabled (TODO Later)
- 🚧 Voice Note (expo-av removed, TODO: expo-audio)
- 🚧 Tabungan screen (placeholder - "coming soon")
- 🚧 Leaderboard (placeholder - "coming soon")
- 🚧 Gmail Parser (needs OAuth scope gmail.readonly)
- 🚧 Couple mode (future feature)
- 🚧 In-app purchase (RevenueCat integration)

---

## 🔥 Critical Tests (Must Pass)

### Error Handling
- [ ] No ERROR messages in console (only WARNings OK)
- [ ] Error boundary catches crashes gracefully
- [ ] Auth guards prevent null user errors
- [ ] Database errors show user-friendly messages

### Performance
- [ ] Bundle time < 3 seconds (web)
- [ ] App loads without freeze/hang
- [ ] Navigation smooth (no lag)
- [ ] Hot reload works (dev mode)

### Data Integrity
- [ ] Wallet balance always correct after transactions
- [ ] Transfer creates 2 linked records
- [ ] Deleting transfer removes both sides
- [ ] Editing transaction updates wallet correctly
- [ ] Budget alerts fire at 75%/90%/100%

---

## 📱 Platform Testing

### Web (Priority 1)
- [ ] Chrome/Edge
- [ ] Safari
- [ ] Firefox
- [ ] Mobile browser (responsive)

### Native (Priority 2)
- [ ] iOS Simulator
- [ ] Android Emulator
- [ ] Real iOS device (Expo Go)
- [ ] Real Android device (Expo Go)

---

## 🚀 Production Build Tests

### Before Submit to Stores:

#### Android (Play Store)
```bash
eas build --platform android --profile production
```
- [ ] APK builds without errors
- [ ] Install APK on real device
- [ ] Test critical flows (login, transaction, chat)
- [ ] Check permissions (camera, storage)
- [ ] Verify app icon & splash screen

#### iOS (App Store)
```bash
eas build --platform ios --profile production
```
- [ ] IPA builds without errors
- [ ] Install via TestFlight
- [ ] Test critical flows
- [ ] Check permissions (camera, photos)
- [ ] Verify app icon & splash screen

---

## 🔐 Security Checks

- [ ] API keys not exposed in client code
- [ ] Supabase RLS policies active
- [ ] Auth tokens stored securely
- [ ] HTTPS only for API calls
- [ ] No sensitive data in logs

---

## 📝 Pre-Launch Checklist

### Code
- [ ] TypeScript: 0 errors (`npm run type-check`)
- [ ] No console.errors in production
- [ ] All TODOs documented
- [ ] Comments removed/cleaned

### Database
- [ ] SQL migrations applied
- [ ] RLS policies verified
- [ ] Indexes optimized for queries

### Edge Functions
- [ ] All 5 functions deployed
- [ ] Cron jobs scheduled (Weekly Insight, Daily Summary)
- [ ] Function logs monitored

### Documentation
- [ ] README updated
- [ ] API documentation
- [ ] User guide (optional)

### App Store Assets
- [ ] App icon (1024x1024)
- [ ] Screenshots (all required sizes)
- [ ] App description (ID & EN)
- [ ] Privacy policy URL
- [ ] Terms of service URL
- [ ] Support email/website

---

## ✅ Sign-Off

### Developer Testing
Date: _____________
Tested by: _____________
Status: ⬜ Pass ⬜ Fail
Notes: _____________

### User Acceptance Testing (UAT)
Date: _____________
Tested by: _____________
Status: ⬜ Pass ⬜ Fail
Notes: _____________

### Production Ready
Date: _____________
Approved by: _____________
Ready for: ⬜ Play Store ⬜ App Store ⬜ Both

---

## 🎯 Success Criteria

App is ready for production when:
1. ✅ All "Core Features" checked
2. ✅ All "Critical Tests" passed
3. ✅ No ERROR messages (WARNings OK)
4. ✅ Production build works on real device
5. ✅ Security checks passed
6. ✅ Store assets prepared

---

**Current Status:** 🟡 In Testing

**Blockers:** None

**Next Step:** Complete testing checklist above
