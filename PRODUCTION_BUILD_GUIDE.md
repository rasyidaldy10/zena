# ZENA Production Build & Distribution Guide

**LENGKAP:** Build → OTA Updates → Download Sebelum Store

---

## 🚀 **PRODUCTION BUILD (APK/IPA)**

### **Step 1: Install EAS CLI**

```bash
npm install -g eas-cli
```

### **Step 2: Login Expo Account**

```bash
eas login
# Masukkan email & password Expo account
# Kalau belum punya: daftar di https://expo.dev
```

### **Step 3: Build Android (APK)**

```bash
# Preview build (test internal)
eas build --platform android --profile preview

# Production build (untuk Play Store)
eas build --platform android --profile production
```

**Proses:**
1. Upload code ke Expo servers
2. Build di cloud (~10-15 menit)
3. Download APK setelah selesai

**File output:** `zena-xxx.apk` (~30-40MB)

### **Step 4: Build iOS (IPA)**

```bash
# Production build
eas build --platform ios --profile production
```

**Butuh:** Apple Developer Account ($99/tahun)

---

## ⚡ **OTA UPDATES (INSTANT UPDATE!)**

### **Apa itu OTA?**

**Over-The-Air Updates** = Update app **TANPA** download dari store!

**User experience:**
1. User buka app
2. App auto-download update (1-5 detik)
3. Restart app → versi baru!

**Timeline:** User dapat update dalam **1-5 MENIT** setelah publish!

### **Setup OTA (Sudah Done! ✅)**

File `eas.json` sudah di-configure dengan channels:
- `production` - For production app
- `preview` - For testing

### **Cara Publish OTA Update:**

```bash
# Update production app
eas update --branch production --message "Fix bug X"

# User langsung dapat update (tanpa download APK baru!)
```

### **What Can Be Updated via OTA:**

✅ **CAN (90% of updates):**
- JavaScript code (all app logic)
- UI changes (screens, components)
- Bug fixes
- New features (JavaScript only)
- Text changes
- Colors, styles
- API endpoints

❌ **CANNOT (Need new build):**
- Native dependencies (camera, maps, etc)
- App permissions (AndroidManifest.xml, Info.plist)
- Expo SDK version upgrade
- App icon/name change

### **Example Workflow:**

```bash
# Day 1: Build production
eas build --platform android --profile production

# Day 5: Fix bug (OTA - instant!)
eas update --branch production --message "Fix login bug"

# Day 10: Add feature (OTA - instant!)
eas update --branch production --message "Add dark mode"

# Day 30: Update Expo SDK (Need new build)
eas build --platform android --profile production
```

---

## 📱 **DOWNLOAD APP SEBELUM MASUK STORE**

### **Option 1: Expo Go (Easiest - Development)**

```bash
npm start
# Scan QR code dengan Expo Go app
```

**Limitations:**
- Butuh Expo Go app installed
- Development mode only
- Can't test production features

---

### **Option 2: Internal Distribution (APK/IPA) ✅ RECOMMENDED**

#### **Android (APK) - TERMUDAH!**

**Step 1: Build Preview**
```bash
eas build --platform android --profile preview
```

**Step 2: Download APK**
- Cek di Expo dashboard: https://expo.dev/accounts/[username]/projects/zena/builds
- Atau download link di terminal output
- Share link APK ke tester

**Step 3: Install**
- Tester download APK di HP Android
- Izinkan "Install from Unknown Sources"
- Install APK
- **DONE!** App ready tanpa Play Store

**Cara Share APK:**
1. Upload ke Google Drive/Dropbox
2. Share link
3. Atau kirim file langsung via WhatsApp/Telegram

#### **iOS (IPA) - Butuh TestFlight**

**Step 1: Build**
```bash
eas build --platform ios --profile preview
```

**Step 2: Submit to TestFlight**
```bash
eas submit --platform ios
```

**Step 3: Invite Testers**
- Login App Store Connect
- TestFlight → Add Internal/External Testers
- Tester install TestFlight app
- Tester download ZENA dari TestFlight

---

### **Option 3: Expo Updates (OTA Testing)**

**Setup Preview Channel:**

```bash
# Build preview dengan OTA enabled
eas build --platform android --profile preview

# Setelah user install preview APK:
eas update --branch preview --message "Testing new feature"

# User auto-dapat update tanpa download APK baru!
```

---

## 🎯 **COMPLETE WORKFLOW (PRODUCTION READY)**

### **Phase 1: Internal Testing (Week 1)**

```bash
# 1. Build preview APK
eas build --platform android --profile preview

# 2. Download & share APK dengan tester (keluarga, teman)
# Download dari: https://expo.dev/builds

# 3. Gather feedback

# 4. Fix bugs via OTA (instant!)
eas update --branch preview --message "Fix bug X"

# 5. Repeat until stable
```

### **Phase 2: Production Build (Week 2)**

```bash
# 1. Build production APK/IPA
eas build --platform android --profile production
eas build --platform ios --profile production

# 2. Test production builds

# 3. Submit to stores
eas submit --platform android
eas submit --platform ios
```

### **Phase 3: Post-Launch Updates**

```bash
# Small fixes/features (OTA - instant!)
eas update --branch production --message "Update X"

# Major updates (new build - 1-3 days review)
eas build --platform android --profile production
eas submit --platform android
```

---

## 📋 **STEP-BY-STEP: FIRST BUILD**

### **1. Persiapan (One-time setup)**

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Verify
eas whoami
```

### **2. Build Preview (Testing)**

```bash
cd /Users/rasyid/Desktop/zena

# Build Android preview
eas build --platform android --profile preview

# Wait 10-15 minutes
# Output: Link to download APK
```

### **3. Download & Test**

```bash
# Option A: Download dari terminal link
# Option B: Go to https://expo.dev/builds
# Option C: Check email (Expo sends notification)

# Install APK di HP Android
# Test semua fitur
```

### **4. Share dengan Tester**

```bash
# Upload APK ke Google Drive
# Share link ke tester:
# "Download ZENA app: [link]"

# Tester install → test → kasih feedback
```

### **5. Update via OTA (After feedback)**

```bash
# Fix bugs in code
git add -A
git commit -m "fix: bug X"

# Publish OTA update
eas update --branch preview --message "Fix bug X"

# Tester auto-dapat update dalam 5 menit!
```

---

## 💰 **COST (Expo EAS)**

### **Free Tier:**
- ✅ Unlimited OTA updates
- ✅ 30 builds/month (Android + iOS)
- ✅ Good for development & testing

### **Paid ($29/month):**
- More builds
- Priority queue
- Team collaboration

**For ZENA V1:** Free tier cukup! 💪

---

## ⚠️ **TROUBLESHOOTING**

### **Q: Build failed?**
**A:** Check:
```bash
# Verify Expo config
npx expo-doctor

# Check eas.json syntax
cat eas.json

# Re-run build
eas build --platform android --profile preview --clear-cache
```

### **Q: OTA update tidak masuk?**
**A:**
```bash
# Verify channel
eas channel:view production

# Check app version match
# App harus built dengan channel yang sama
```

### **Q: APK tidak bisa install?**
**A:**
- Enable "Install from Unknown Sources" di Android
- Check storage space di HP
- Download ulang APK (mungkin corrupt)

### **Q: Berapa lama build?**
**A:**
- Android: 10-15 menit
- iOS: 15-25 menit

---

## ✅ **CHECKLIST BEFORE BUILD**

```bash
☐ Logo updated (✅ Already done!)
☐ RLS migration applied (CRITICAL!)
☐ All features tested
☐ No critical bugs
☐ app.json configured correctly
☐ Expo account ready
☐ EAS CLI installed
```

---

## 🎯 **QUICK COMMANDS**

```bash
# Build preview (testing)
eas build -p android --profile preview

# Build production
eas build -p android --profile production

# OTA update production
eas update --branch production -m "Update X"

# OTA update preview
eas update --branch preview -m "Test feature X"

# Check builds status
eas build:list

# Check updates status
eas update:list
```

---

## 🚀 **READY TO BUILD?**

```bash
# START HERE:
cd /Users/rasyid/Desktop/zena

# 1. Install EAS
npm install -g eas-cli

# 2. Login
eas login

# 3. First preview build
eas build --platform android --profile preview

# 4. Wait & download APK
# 5. Share & test!
```

**After testing OK → Build production → Submit to stores!**

---

**Questions?** Check Expo docs: https://docs.expo.dev/build/introduction/
