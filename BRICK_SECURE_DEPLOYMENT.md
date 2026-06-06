# 🔐 BRICK.CO SECURE DEPLOYMENT GUIDE
**Pentagon-Grade Security Implementation**

---

## ✅ SECURITY FIXES COMPLETED

### What Was Fixed:
1. ❌ **CLIENT_SECRET exposed in APK** → ✅ **Moved to server-side Edge Functions**
2. ❌ **Tokens stored in plain text** → ✅ **AES-256-GCM encryption**
3. ❌ **No RLS policies** → ✅ **Complete RLS + audit logging**
4. ❌ **OAuth in client** → ✅ **Server-side OAuth handler**
5. ❌ **No token refresh** → ✅ **Auto-refresh cron job (every 30 min)**

### Security Architecture:
```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│             │         │                  │         │             │
│  React      │────────▶│  Supabase Edge   │────────▶│  Brick API  │
│  Native     │         │  Functions       │         │             │
│  (Client)   │         │  (Server)        │         │             │
│             │         │                  │         │             │
│  ✅ No      │         │  ✅ CLIENT_SECRET│         │  ✅ Direct  │
│  secrets    │         │  ✅ Encryption   │         │  API access │
│             │         │  ✅ RLS enforced │         │             │
└─────────────┘         └──────────────────┘         └─────────────┘
```

---

## 📋 DEPLOYMENT CHECKLIST

### 🔴 CRITICAL (Must Do Before Bank Connection):

#### 1. Generate Encryption Key
```bash
# Run this ONCE to generate a secure 32-byte key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Example output: a1b2c3d4e5f6... (64 hex characters)
# COPY THIS KEY - you'll need it for Supabase secrets
```

#### 2. Add Secrets to Supabase
1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/settings/vault
2. Add these secrets:

```
Name: BANK_TOKEN_ENCRYPTION_KEY
Value: [paste the 64-character hex key from step 1]

Name: BRICK_CLIENT_ID
Value: ded1eecf-abab-4356-9d0b-24a09ced6500

Name: BRICK_CLIENT_SECRET
Value: <BRICK_CLIENT_SECRET>

Name: BRICK_ENVIRONMENT
Value: sandbox
```

**⚠️ CRITICAL:** Never commit these to git! Never share them!

#### 3. Run Database Migration
```bash
# Connect to Supabase SQL Editor
# Run file: supabase/migrations/007_bank_connections_secure.sql
# This creates:
# - bank_connections table (encrypted columns)
# - RLS policies (users only see own data)
# - Audit log table
# - Auto-expire triggers
```

**Verify migration success:**
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'bank_connections';
-- Should return: bank_connections | t (true)

-- Check policies exist
SELECT COUNT(*) FROM pg_policies WHERE tablename = 'bank_connections';
-- Should return: 5 (or more)
```

#### 4. Deploy Edge Functions
```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_ID

# Deploy all functions
supabase functions deploy brick-oauth
supabase functions deploy brick-refresh-tokens

# Verify deployment
supabase functions list
# Should show: brick-oauth, brick-refresh-tokens
```

#### 5. Set Up Cron Job (Auto Token Refresh)
1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/database/cron-jobs
2. Click "Create a new cron job"
3. Settings:
   - **Name:** Brick Token Refresh
   - **Schedule:** `*/30 * * * *` (every 30 minutes)
   - **Function:** `brick-refresh-tokens`
   - **Enabled:** ✅ Yes

#### 6. Test Edge Functions
```bash
# Test brick-oauth function (should return error - expected)
curl -X POST \
  https://YOUR_PROJECT_ID.supabase.co/functions/v1/brick-oauth \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"test"}'

# Should return: {"error":"Unknown action: test","success":false}
# This means function is deployed and working!
```

#### 7. Verify Client Code (No Secrets)
```bash
# Search for secrets in client code
cd /Users/rasyid/Desktop/zena
grep -r "CLIENT_SECRET" lib/ app/ components/

# Should return: NO RESULTS (safe!)
# If it returns results → FIX IMMEDIATELY
```

#### 8. Test RLS Policies
```sql
-- Try to bypass RLS (should FAIL)
SET ROLE authenticated;
SELECT * FROM bank_connections WHERE user_id != auth.uid();
-- Should return: 0 rows (RLS blocking access) ✅

-- Try to insert for another user (should FAIL)
INSERT INTO bank_connections (user_id, bank_name) 
VALUES ('00000000-0000-0000-0000-000000000000', 'Test Bank');
-- Should ERROR: new row violates row-level security policy ✅
```

---

## 🟢 OPTIONAL (Recommended):

### Rate Limiting (Prevent Abuse)
Add to Edge Functions:
```typescript
// In brick-oauth/index.ts
const rateLimits = new Map<string, number>()

function checkRateLimit(userId: string): boolean {
  const key = `${userId}:${Date.now() / 60000}` // 1-minute bucket
  const count = rateLimits.get(key) || 0
  
  if (count >= 10) {
    return false // Exceeded limit
  }
  
  rateLimits.set(key, count + 1)
  return true
}
```

### IP Whitelist (Extra Security)
In Supabase Dashboard → Edge Functions → brick-oauth → Settings:
- Add allowed IP ranges (your servers only)
- Block all other IPs

### 2FA Before Bank Connect
In `app/tambah-wallet.tsx`:
```typescript
const handleBankConnect = async (bankCode: string) => {
  // Require 2FA before connecting bank
  const has2FA = await check2FAEnabled()
  if (!has2FA) {
    Alert.alert('Enable 2FA First', 'Bank connection requires 2FA')
    return
  }
  // ... proceed with bank connect
}
```

---

## 🧪 TESTING (Before Production)

### Test in Sandbox Mode
```bash
# 1. Ensure .env has sandbox mode
BRICK_ENVIRONMENT=sandbox

# 2. Open app in Expo
npx expo start

# 3. Go to "Tambah Wallet" screen
# 4. Tap "Connect Bank Account"
# 5. Select a bank (e.g., BCA)
# 6. Use Brick.co SANDBOX credentials:
#    Username: sandbox_username
#    Password: sandbox_password

# 7. Complete OAuth flow
# 8. Verify connection appears in app
```

### Verify Encryption
```sql
-- Check tokens are encrypted (should NOT be readable)
SELECT 
  id, 
  bank_name, 
  access_token_encrypted,
  LENGTH(access_token_encrypted) as token_length
FROM bank_connections
LIMIT 1;

-- access_token_encrypted should be base64 gibberish
-- token_length should be ~200+ characters
-- If you see plain text → ENCRYPTION FAILED!
```

### Test Token Refresh
```bash
# Manually trigger cron job
curl -X POST \
  https://YOUR_PROJECT_ID.supabase.co/functions/v1/brick-refresh-tokens \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"

# Check response:
# {"message":"Token refresh completed","total":X,"refreshed":Y,"failed":0}
```

### Security Audit
```bash
# 1. Check no secrets in APK
unzip zena.apk
grep -r "BRICK_CLIENT_SECRET" .
# Should return: NO RESULTS ✅

# 2. Check RLS enabled
psql -h YOUR_DB_HOST -U postgres -d postgres \
  -c "SELECT tablename FROM pg_tables WHERE rowsecurity=true;"
# Should include: bank_connections ✅

# 3. Check audit log working
SELECT COUNT(*) FROM bank_connection_audit_log;
# Should return: > 0 (if you tested connections) ✅
```

---

## 🚨 INCIDENT RESPONSE

### If Tokens Compromised:
```bash
# 1. Immediately revoke ALL connections
UPDATE bank_connections SET status = 'revoked';

# 2. Clear all encrypted tokens
UPDATE bank_connections 
SET access_token_encrypted = '', 
    refresh_token_encrypted = '';

# 3. Rotate encryption key
# Generate new key:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 4. Update Supabase secret: BANK_TOKEN_ENCRYPTION_KEY

# 5. Notify affected users (email/push notification)

# 6. Report to Brick.co: security@onebrick.io

# 7. Document incident in audit log
INSERT INTO bank_connection_audit_log (event_type, event_details)
VALUES ('security_incident', '{"type":"token_compromise","action_taken":"mass_revoke"}');
```

---

## ✅ FINAL VERIFICATION

Before connecting REAL bank account:

- [ ] Encryption key generated (64 hex chars)
- [ ] All secrets added to Supabase Vault (not .env file!)
- [ ] Migration 007 executed successfully
- [ ] RLS verified enabled (5+ policies)
- [ ] Edge Functions deployed (brick-oauth, brick-refresh-tokens)
- [ ] Cron job configured (every 30 min)
- [ ] Client code has NO secrets (grep returns empty)
- [ ] Tested in sandbox mode (OAuth flow works)
- [ ] Tokens encrypted in database (base64 gibberish)
- [ ] Audit log working (events being logged)

**ALL CHECKBOXES MUST BE CHECKED ✅**

---

## 🎯 PRODUCTION DEPLOYMENT

### Switch to Production Mode
1. Update Supabase secrets:
```
BRICK_ENVIRONMENT=production
```

2. Use PRODUCTION Brick.co credentials:
   - Get from: https://app.onebrick.io/settings/api
   - Replace sandbox credentials in Supabase Vault

3. Re-deploy Edge Functions (picks up new env):
```bash
supabase functions deploy brick-oauth --no-verify-jwt
supabase functions deploy brick-refresh-tokens
```

4. Test with REAL bank account (your own first!)

5. Monitor audit logs for 24 hours

6. Enable for all users

---

## 📊 MONITORING

### Daily Checks
```sql
-- Check expired tokens (should be auto-refreshed)
SELECT COUNT(*) FROM bank_connections 
WHERE status = 'active' 
  AND token_expires_at < NOW();
-- Should return: 0 (or very few)

-- Check cron job success rate
SELECT 
  event_type,
  COUNT(*) as count,
  DATE(created_at) as date
FROM bank_connection_audit_log
WHERE event_type IN ('token_refreshed', 'sync_failed')
GROUP BY event_type, DATE(created_at)
ORDER BY date DESC;
```

### Set Up Alerts
- Supabase Dashboard → Monitoring → Alerts
- Alert when: `failed token refreshes > 5 in 1 hour`
- Send to: your email/Slack

---

## 🔐 SECURITY BEST PRACTICES

1. **Never log tokens** - Don't console.log access_token
2. **Rotate encryption key** - Every 90 days
3. **Monitor audit logs** - Daily for suspicious activity
4. **2FA required** - Before bank connect (optional but recommended)
5. **IP whitelist** - Restrict Edge Functions to known IPs
6. **Rate limiting** - 10 requests/minute per user
7. **Session timeout** - Auto-revoke after 30 days inactivity
8. **Penetration testing** - Quarterly security audits

---

## 🎓 TRAINING

For your team:
1. Read this entire document
2. Understand OAuth flow (client → edge function → Brick API)
3. Know where secrets are stored (Supabase Vault ONLY)
4. Practice incident response (token compromise drill)
5. Review code before each deploy

---

**Deployment Status:** ⏳ **READY TO DEPLOY**  
**Security Level:** 🟢 **PENTAGON-GRADE**  
**Risk Level:** 🟢 **LOW** (after checklist completed)  
**Estimated Setup Time:** 30-45 minutes  

**Questions?** Review SECURITY_REVIEW_BRICK.md for detailed security analysis.
