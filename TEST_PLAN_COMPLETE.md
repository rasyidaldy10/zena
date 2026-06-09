# 🧪 COMPLETE TEST PLAN - FIX ALL BUGS

## ⚠️ PREREQUISITES (HARUS DILAKUKAN DULU!):

### 1. Run SQL Cleanup
📁 File: `CLEANUP_ALL_ISSUES.sql`
- Copy semua isi file
- Paste ke Supabase SQL Editor
- Run
- ✅ Expected: DELETE success, 0 duplicate rows

### 2. Clear Browser Storage (PENTING!)
**Console command:**
```javascript
localStorage.clear();
sessionStorage.clear();
await supabase.auth.signOut();
location.reload();
```

**Atau pakai Incognito Mode** (lebih gampang)

---

## 🚀 TEST FLOW (Tunggu Deployment 2-3 Menit):

### **TEST 1: Fresh Google Login (Incognito)**

**Steps:**
1. Buka Incognito window
2. https://zena-mu.vercel.app
3. Open Console (Cmd+Opt+I)
4. Clear console (Cmd+K)
5. Klik "**Masuk dengan Google**"
6. Pilih account Google

**Expected Console Logs (CLEAN!):**
```
🔵 Google login clicked
🔵 Web OAuth flow
✅ Redirecting to Google...
🔔 Auth event: SIGNED_IN
🔵 SIGNED_IN, checking preferences...
✅ Has prefs → dashboard  (atau ✅ New user → onboarding)
```

**Expected Result:**
- ✅ Redirect ke onboarding (first time) ATAU dashboard (existing user)
- ✅ NO ERRORS in console
- ✅ NO infinite loops
- ✅ NO INVALID_GRANT errors

---

### **TEST 2: Edit Profile**

**After login success:**
1. Klik tab **Profil**
2. Scroll ke section "Informasi"
3. Klik tombol **"Edit"** (kanan atas)

**Expected Console:**
```
🔵 Edit button pressed, current editing: false
```

**Expected UI:**
- ✅ Input fields muncul (Nama panggilan, Penghasilan/bulan)
- ✅ Button berubah jadi "Simpan"

**Continue:**
4. Edit nama → "Rasyid"
5. Edit income → "5000000"
6. Klik "**Simpan**"

**Expected:**
- ✅ Saving indicator
- ✅ Data tersimpan
- ✅ Input fields kembali read-only
- ✅ Button kembali jadi "Edit"
- ✅ Refresh page → nama berubah di greeting

---

### **TEST 3: Logout**

**Steps:**
1. Scroll ke bawah di Profil
2. Klik "**🚪 Keluar dari Akun**"

**Expected Console:**
```
🔵 Logout button pressed
```

**Expected UI:**
- ✅ Alert muncul: "Keluar dari Zena?"
- ✅ Ada 2 tombol: "Batal" dan "Keluar"

**Continue:**
3. Klik "**Keluar**"

**Expected Console:**
```
🔵 Logging out...
✅ Signed out successfully
🔔 Auth event: SIGNED_OUT
🔴 SIGNED_OUT
```

**Expected Result:**
- ✅ Redirect ke login screen
- ✅ Session cleared
- ✅ Refresh page → tetap di login screen

---

## ✅ SUCCESS CRITERIA:

**Console harus BERSIH (no red errors):**
- ❌ NO "INVALID_GRANT" errors
- ❌ NO "Failed to load resource: 400" errors
- ❌ NO "OIDC_URL_MISMATCH" errors
- ❌ NO infinite login loops
- ❌ NO duplicate auth events

**UI harus RESPONSIF:**
- ✅ Google login works
- ✅ Edit button works
- ✅ Logout button works
- ✅ Redirects work correctly

---

## 🐛 IF BUGS STILL EXIST:

**Screenshot yang saya butuh:**
1. Full screen UI (apa yang tampil)
2. Console tab (semua logs, termasuk yang merah)
3. Network tab → Filter "400" atau "error" (kalau ada API errors)

**Dan kasih tau:**
- Step mana yang gagal?
- Error message apa?
- Expected vs Actual result?

---

## 📝 NOTES:

- Deployment butuh 2-3 menit setelah push
- Incognito mode = fresh start (recommended)
- Console logs pakai emoji untuk mudah dibaca:
  - 🔵 = Info/Action
  - ✅ = Success
  - ❌ = Error
  - 🔔 = Auth event
  - 🔴 = Logout/Critical

