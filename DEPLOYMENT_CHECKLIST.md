# ZENA Deployment Checklist - FINAL

**Gunakan ini sebelum SETIAP deployment ke production!**

---

## 🔴 **CRITICAL (WAJIB!)**

### **Security**
- [ ] **RLS Migration Applied** - Run `000_initial_schema_rls.sql` di Supabase Dashboard
- [ ] **Verify RLS Working** - Test dengan 2 user accounts (tidak bisa lihat data satu sama lain)
- [ ] **API Keys Secure** - Cek tidak ada hardcoded keys di code
- [ ] **Environment Variables** - Semua secret di server-side

### **Build**
- [ ] **Logo Updated** - Bukan Expo default (✅ Already done!)
- [ ] **app.json Complete** - Name, version, bundle ID correct
- [ ] **TypeScript Clean** - `npm run type-check` → 0 errors
- [ ] **No Console Errors** - Check browser console

---

## 🟡 **RECOMMENDED (Strongly Advised)**

### **Testing**
- [ ] **All Core Features Work** - Transactions, wallets, reports, AI
- [ ] **Auth Flow** - Login, register, Google SSO, logout
- [ ] **Data Integrity** - Wallet balance correct after transactions
- [ ] **Mobile Responsive** - Test di browser mobile mode

### **Performance**
- [ ] **Bundle Size** - Check tidak terlalu besar (should be <50MB APK)
- [ ] **Load Time** - App start < 3 seconds
- [ ] **No Memory Leaks** - Use app for 10+ minutes, check performance

### **Documentation**
- [ ] **README Updated** - Install instructions current
- [ ] **CHANGELOG** - Note new features/fixes
- [ ] **Known Issues** - Document any non-critical bugs

---

## 🟢 **NICE TO HAVE (Optional)**

### **Monitoring**
- [ ] Error tracking setup (Sentry/Bugsnag)
- [ ] Analytics setup (Google Analytics/Mixpanel)
- [ ] Performance monitoring

### **Store Preparation**
- [ ] Screenshots prepared (all required sizes)
- [ ] Store description written (ID + EN)
- [ ] Privacy policy URL
- [ ] Terms of service URL

---

## 🚀 **DEPLOYMENT COMMANDS**

### **Preview Build (Internal Testing)**
```bash
# Build
eas build --platform android --profile preview

# After testing, update via OTA
eas update --branch preview --message "Update X"
```

### **Production Build (Store Submission)**
```bash
# 1. Final check
npm run type-check
git status

# 2. Build
eas build --platform android --profile production
eas build --platform ios --profile production

# 3. Test builds
# Install APK/IPA → test all features

# 4. Submit
eas submit --platform android
eas submit --platform ios
```

### **OTA Update (Post-Launch)**
```bash
# Fix/feature in JavaScript only
git add -A
git commit -m "fix: bug X"
eas update --branch production --message "Fix bug X"

# Users get update in 1-5 minutes!
```

---

## ⚠️ **ROLLBACK PROCEDURE**

### **If OTA Update Breaks App:**
```bash
# Revert to previous update
eas update:republish --branch production --group [previous-group-id]

# Or publish fix immediately
eas update --branch production --message "Hotfix"
```

### **If Build Breaks:**
```bash
# Don't submit to store yet!
# Fix issue → rebuild
eas build --platform android --profile production
```

---

## 📊 **POST-DEPLOYMENT**

### **Immediate (First 24 Hours)**
- [ ] Monitor crash reports
- [ ] Check user feedback (reviews/messages)
- [ ] Watch error logs (Supabase logs)
- [ ] Verify OTA updates working

### **First Week**
- [ ] Analyze usage patterns
- [ ] Identify top bugs
- [ ] Plan V1.1 features
- [ ] Respond to user reviews

### **First Month**
- [ ] Performance metrics review
- [ ] User retention analysis
- [ ] Feature usage stats
- [ ] Plan V2 roadmap

---

## 🎯 **QUALITY GATES**

**DO NOT DEPLOY IF:**
- ❌ RLS not applied (SECURITY RISK!)
- ❌ TypeScript errors exist
- ❌ Core features broken
- ❌ Critical bugs unfixed
- ❌ App crashes on startup

**SAFE TO DEPLOY IF:**
- ✅ All Critical items checked
- ✅ Most Recommended items checked
- ✅ No blockers from Quality Gates
- ✅ Tested on real device

---

## 📝 **DEPLOYMENT LOG**

Keep track of deployments:

```
# V1.0.0 - 2026-06-XX
- Initial release
- Features: [list]
- Build: preview-001
- Status: Internal testing

# V1.0.1 - 2026-06-XX  
- Fix: [bug description]
- OTA Update
- Users affected: All
- Rollout: Instant

# V1.1.0 - 2026-07-XX
- Feature: Gmail auto-import
- New build required
- Store submission: Pending
```

---

## 🆘 **EMERGENCY CONTACTS**

**Services:**
- Expo: https://expo.dev/support
- Supabase: https://supabase.com/support
- Claude API: support@anthropic.com

**Resources:**
- Expo Docs: https://docs.expo.dev
- Supabase Docs: https://supabase.com/docs
- React Native Docs: https://reactnative.dev

---

**BEFORE EVERY DEPLOYMENT:** Run through this checklist!

**AFTER EVERY DEPLOYMENT:** Monitor for 24 hours!

**IF EMERGENCY:** Rollback immediately, fix, redeploy!
