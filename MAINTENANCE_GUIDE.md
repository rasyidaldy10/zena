# ZENA Long-Term Maintenance Guide

**For: Future developers, scaling, and ongoing maintenance**

---

## 🏗️ **ARCHITECTURE OVERVIEW**

### **Tech Stack**
- **Frontend:** React Native (Expo SDK 56)
- **Backend:** Supabase (PostgreSQL + Auth + Functions)
- **AI:** Claude API (via Edge Functions)
- **Deployment:** EAS Build + OTA Updates
- **Hosting:** Vercel (web), Expo (mobile)

### **Key Design Decisions**

**1. Supabase over Firebase**
- **Why:** PostgreSQL > NoSQL untuk financial data
- **Benefit:** ACID compliance, relations, RLS
- **Trade-off:** Slightly steeper learning curve

**2. Expo over Bare React Native**
- **Why:** Faster development, OTA updates
- **Benefit:** Ship features 10x faster
- **Trade-off:** Limited to Expo-compatible packages

**3. Edge Functions for AI**
- **Why:** Keep API keys secure server-side
- **Benefit:** No key exposure risk
- **Trade-off:** Extra hop (minimal latency)

---

## 📁 **CODEBASE STRUCTURE**

```
zena/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Login, register
│   ├── (tabs)/            # Main navigation
│   ├── _layout.tsx        # Root layout + auth logic
│   └── [other-screens]    # Modal screens
├── lib/                   # Utilities
│   ├── supabase.ts       # Database client
│   ├── claude.ts         # AI proxy functions
│   ├── personas.ts       # AI persona configs
│   └── scoring.ts        # Financial score engine
├── types/                 # TypeScript definitions
├── assets/               # Images, icons
├── supabase/
│   ├── migrations/       # SQL schema changes
│   └── functions/        # Edge Functions (Deno)
└── docs/                 # All *.md files

**Key Files to Know:**
- `app/_layout.tsx` - Auth & routing logic
- `app/(tabs)/index.tsx` - Dashboard/home
- `lib/supabase.ts` - Database connection
- `supabase/migrations/000_initial_schema_rls.sql` - **CRITICAL SECURITY**
```

---

## 🔧 **COMMON MAINTENANCE TASKS**

### **1. Add New Feature (JavaScript Only)**

```bash
# 1. Create new screen
touch app/new-feature.tsx

# 2. Add to _layout.tsx
# <Stack.Screen name="new-feature" />

# 3. Test locally
npm start

# 4. Deploy via OTA (instant!)
git add -A && git commit -m "feat: new feature"
eas update --branch production -m "New feature X"

# Users get update in 1-5 minutes!
```

**Timeline:** 1 hour dev → 5 minutes deploy → Live! ✅

---

### **2. Add New Native Package**

```bash
# 1. Install package
npx expo install expo-camera

# 2. Update app.json permissions
{
  "ios": {
    "infoPlist": {
      "NSCameraUsageDescription": "We need camera for..."
    }
  },
  "android": {
    "permissions": ["CAMERA"]
  }
}

# 3. CANNOT use OTA! Need new build
eas build --platform android --profile production

# 4. Submit to store
eas submit --platform android

# Users get update in 1-3 days (store review)
```

**Timeline:** 2 hours dev → 15 min build → 1-3 days review → Live

---

### **3. Database Schema Change**

```bash
# 1. Create migration
touch supabase/migrations/007_add_column.sql

# 2. Write SQL
ALTER TABLE transactions ADD COLUMN tags TEXT[];

# 3. Apply in Supabase Dashboard
# SQL Editor → Run migration

# 4. Update TypeScript types
# types/index.ts → add tags field

# 5. Update app code to use new field

# 6. Deploy via OTA
eas update --branch production -m "Add tags feature"
```

**IMPORTANT:** Always create migration files (never edit DB directly!)

---

### **4. Fix Production Bug (URGENT!)**

```bash
# 1. Identify issue
# Check Supabase logs / user reports

# 2. Reproduce locally
npm start

# 3. Fix code
git add -A && git commit -m "hotfix: critical bug X"

# 4. Deploy immediately
eas update --branch production -m "HOTFIX: Bug X"

# 5. Monitor
# Check logs for 30 minutes
```

**Timeline:** Identify (10 min) → Fix (30 min) → Deploy (5 min) → **LIVE!**

---

## 🔍 **DEBUGGING GUIDE**

### **Common Issues**

#### **Issue: "Can't find variable: X"**
**Cause:** Variable not imported or misspelled
**Fix:**
```typescript
// Add import
import { X } from './lib/X'
```

#### **Issue: "Network request failed"**
**Cause:** Supabase connection issue or RLS blocking
**Fix:**
```bash
# Check Supabase logs
# Verify RLS policies allow operation
# Check user authentication
```

#### **Issue: "Metro bundler stuck"**
**Cause:** Cache corruption
**Fix:**
```bash
rm -rf .expo node_modules/.cache
npm start --clear
```

#### **Issue: "OTA update not working"**
**Cause:** Channel mismatch or cache
**Fix:**
```bash
# Verify channel
eas channel:view production

# Force update
eas update --branch production -m "Force update"
```

---

## 📊 **MONITORING & ANALYTICS**

### **Setup Error Tracking (Sentry)**

```bash
# 1. Install
npx expo install sentry-expo

# 2. Configure app.json
{
  "expo": {
    "plugins": [
      [
        "sentry-expo",
        {
          "organization": "your-org",
          "project": "zena"
        }
      ]
    ]
  }
}

# 3. Init in _layout.tsx
import * as Sentry from 'sentry-expo'

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enableInExpoDevelopment: false,
})
```

### **Key Metrics to Track**

1. **Crash Rate:** < 1% (excellent), < 5% (acceptable)
2. **Daily Active Users (DAU):** Track growth
3. **Retention:** D1, D7, D30 retention rates
4. **Feature Usage:** Which features used most
5. **Financial Score Trend:** Are users improving?

---

## 🔐 **SECURITY MAINTENANCE**

### **Monthly Security Checklist**

```bash
☐ Review Supabase logs for suspicious activity
☐ Rotate API keys if exposed
☐ Update dependencies: npm audit fix
☐ Check for CVEs: npm audit
☐ Review RLS policies still correct
☐ Test auth flow (login, register, SSO)
☐ Verify no data leaks between users
```

### **If Security Breach**

```bash
# 1. IMMEDIATE: Disable affected feature
eas update --branch production -m "Disable X temporarily"

# 2. Investigate extent
# Check Supabase logs
# Identify affected users

# 3. Fix vulnerability
# Code fix + migration if needed

# 4. Deploy fix
eas build + submit (if native)
# OR
eas update (if JS only)

# 5. Notify users (if data exposed)
# Email affected users
# Publish incident report
```

---

## 📈 **SCALING GUIDE**

### **Current Capacity**
- **Users:** Up to ~100K users (Supabase free tier)
- **Transactions:** Unlimited (PostgreSQL)
- **AI Requests:** Based on Claude API quota
- **OTA Updates:** Unlimited (Expo)

### **When to Scale Up**

**Supabase ($25/month Pro):**
- When > 10K active users
- When > 500MB database size
- When need more Edge Function invocations

**Claude API:**
- Monitor token usage
- Implement rate limiting (see SECURITY_AUDIT.md)
- Consider caching common responses

**EAS ($29/month):**
- When > 30 builds/month
- When need faster build queue
- When team grows > 1 developer

---

## 🛠️ **TROUBLESHOOTING TOOLS**

### **Supabase Dashboard**
```
https://supabase.com/dashboard

Key sections:
- Database → SQL Editor (run queries)
- Authentication → Users (check accounts)
- Edge Functions → Logs (debug functions)
- Storage → Logs (debug uploads)
```

### **Expo Dashboard**
```
https://expo.dev/accounts/[username]/projects/zena

Key sections:
- Builds → Download APK/IPA
- Updates → View OTA history
- Insights → Analytics
```

### **Local Debugging**
```bash
# View Metro logs
npm start

# Type check
npm run type-check

# Check dependencies
npx expo-doctor

# View Supabase logs (local)
# In Supabase Dashboard → Logs
```

---

## 📝 **DEVELOPMENT WORKFLOW**

### **Daily Development**
```bash
# 1. Pull latest
git pull origin main

# 2. Create feature branch
git checkout -b feat/new-feature

# 3. Develop
npm start
# Code → Test → Repeat

# 4. Commit
git add -A
git commit -m "feat: description"

# 5. Push
git push origin feat/new-feature

# 6. Deploy (if main branch)
eas update --branch production -m "Update X"
```

### **Release Cycle**

**Weekly:** Minor fixes via OTA
**Bi-weekly:** Small features via OTA
**Monthly:** Major features via new build
**Quarterly:** SDK upgrades via new build

---

## 🎓 **ONBOARDING NEW DEVELOPER**

### **Day 1: Setup**
```bash
# 1. Clone repo
git clone [repo-url]
cd zena

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Fill in Supabase keys

# 4. Run app
npm start

# 5. Read docs
cat AGENTS.md
cat ARCHITECTURE.md
cat SECURITY_AUDIT.md
```

### **Week 1: Learn Codebase**
- Read all *.md files in root
- Understand file structure
- Make small bug fix
- Deploy via OTA

### **Month 1: Independent Features**
- Build new screen
- Add database table
- Create Edge Function
- Submit to store

---

## 🚨 **EMERGENCY PROCEDURES**

### **App Down / Crashes**
```bash
# 1. Check status
curl https://[your-api].supabase.co/status

# 2. Check Expo status
https://status.expo.dev

# 3. Rollback OTA
eas update:republish --branch production --group [previous-id]

# 4. Investigate
# Supabase logs
# Sentry error reports
```

### **Data Loss**
```bash
# 1. Stop writes immediately
# Disable affected features via OTA

# 2. Check Supabase backups
# Dashboard → Database → Backups

# 3. Restore if needed
# Contact Supabase support

# 4. Fix root cause
# Apply fix + migration

# 5. Re-enable features
```

---

## 📚 **LEARNING RESOURCES**

**Expo:**
- Official docs: https://docs.expo.dev
- EAS Build: https://docs.expo.dev/build/introduction
- OTA Updates: https://docs.expo.dev/eas-update/introduction

**Supabase:**
- Official docs: https://supabase.com/docs
- RLS Guide: https://supabase.com/docs/guides/auth/row-level-security
- Edge Functions: https://supabase.com/docs/guides/functions

**React Native:**
- Official docs: https://reactnative.dev
- Expo Router: https://expo.github.io/router/docs

---

## ✅ **MAINTENANCE BEST PRACTICES**

1. **Always test locally before deploy**
2. **Use OTA for 90% of updates (faster!)**
3. **Keep dependencies updated (monthly check)**
4. **Monitor error logs daily (first week post-launch)**
5. **Backup database weekly (Supabase does this)**
6. **Document ALL major changes (CHANGELOG.md)**
7. **Review RLS policies quarterly**
8. **Test on real device before store submission**

---

**For Questions:** Check docs/ folder or create GitHub issue

**For Emergencies:** Rollback first, debug second!
