# Cara Update Logo Zena (SIMPLE!)

## 🎨 Logo Zena Yang Bagus Sudah Ada!

Logo yang Mas kasih ke saya (Z biru dengan garis horizontal) **KEREN & COCOK!** ✅

---

## 📋 CARA CEPAT (3 Langkah):

### **1. Simpan Logo ke Desktop**

Simpan file logo (yang Mas kirim via WhatsApp) ke Desktop dengan nama: `zena-logo.png`

**Path:** `/Users/rasyid/Desktop/zena-logo.png`

---

### **2. Jalankan Script (Otomatis Generate Semua Size)**

Buka Terminal di folder project:

```bash
cd /Users/rasyid/Desktop/zena

# Run script (ganti dengan path logo kalau beda):
./UPDATE_LOGO_NOW.sh ~/Desktop/zena-logo.png
```

**Script ini akan otomatis bikin:**
- `icon.png` (1024x1024) - Main app icon
- `favicon.png` (48x48) - Web favicon
- `splash-icon.png` (1242x2436) - Splash screen
- `android-icon-foreground.png` (1024x1024) - Android adaptive
- `android-icon-background.png` (1024x1024) - Android background
- `android-icon-monochrome.png` (1024x1024) - Android mono

---

### **3. Test Logo Baru**

```bash
# Clear cache
rm -rf .expo node_modules/.cache

# Restart app
npm start --clear
```

**Refresh browser** → Logo Zena baru muncul! 🎉

---

## 🛠️ CARA MANUAL (Kalau Script Gagal):

### Kalau ImageMagick belum install:

```bash
# Install ImageMagick (butuh Homebrew)
brew install imagemagick

# Atau kalau Homebrew belum ada, skip manual ini
# Pakai cara online (lihat bawah)
```

### Atau pakai online tool (TERMUDAH):

1. **Buka:** https://appicon.co/
2. **Upload:** Logo Zena (1024x1024px atau lebih besar)
3. **Download:** Generate semua icon size
4. **Copy:** Hasil download ke folder `assets/`

---

## 📱 VERIFIKASI LOGO SUDAH UPDATE:

### **Web:**
- Buka `http://localhost:8081`
- Cek tab browser → Favicon Zena muncul ✅

### **App (Development):**
- Logo Zena muncul di center button ✅
- Logo Zena muncul saat loading ✅

---

## 🚀 PRODUCTION BUILD (Setelah Logo Update):

### **Build Android APK:**
```bash
eas build --platform android
```

### **Build iOS IPA:**
```bash
eas build --platform ios
```

**File yang dihasilkan:**
- `zena.apk` (Android) → Bisa install di HP Android
- `zena.ipa` (iOS) → Bisa install via TestFlight

**Submit ke Store:**
```bash
eas submit --platform android  # Play Store
eas submit --platform ios      # App Store
```

---

## ❓ TROUBLESHOOTING

### **Q: Script error "ImageMagick not installed"?**
**A:** Install manual:
```bash
brew install imagemagick
```

### **Q: Homebrew not installed?**
**A:** Pakai online tool (appicon.co) lebih simple!

### **Q: Logo gak muncul setelah update?**
**A:** Clear cache:
```bash
rm -rf .expo node_modules/.cache
npm start --clear
```

### **Q: Logo terpotong/aneh?**
**A:** Pastikan logo source minimal 1024x1024px dan ada transparent background

---

## 🎯 KESIMPULAN

**Logo Zena yang Mas punya SUDAH BAGUS!** Tinggal:

1. ✅ Simpan ke Desktop
2. ✅ Run script: `./UPDATE_LOGO_NOW.sh ~/Desktop/zena-logo.png`
3. ✅ Restart app
4. ✅ **DONE!**

**Setelah logo update → SIAP PRODUCTION BUILD!** 🚀

---

**Need help?** Kalau script gagal, kasih tau error message nya!
