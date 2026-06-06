# 🔒 SECURITY REVIEW - BRICK.CO BANK INTEGRATION
**Reviewer:** Pentagon-Level Security Engineering Review  
**Date:** 2026-06-06  
**Status:** ⚠️ **CRITICAL ISSUES FOUND - DO NOT CONNECT BANK YET**

---

## 🚨 CRITICAL VULNERABILITIES (Must Fix Before Bank Connection)

### 1. **CLIENT_SECRET EXPOSED IN CLIENT CODE** ❌ CRITICAL
**Location:** `lib/brick.ts` line 20  
**Issue:**
```typescript
const BRICK_CLIENT_SECRET = process.env.BRICK_CLIENT_SECRET || ''
```

**Why This is Critical:**
- `lib/brick.ts` runs on the CLIENT (React Native app)
- React Native bundles ALL JavaScript code into the APK
- Anyone can decompile APK → extract `BRICK_CLIENT_SECRET`
- With your secret, attacker can:
  - Impersonate your app
  - Access ALL your users' bank connections
  - Steal bank access tokens
  - Perform unauthorized transactions

**Attack Vector:**
```bash
# Attacker extracts APK
unzip zena.apk
grep -r "BRICK_CLIENT_SECRET" .
# Found: <BRICK_CLIENT_SECRET>
# Now attacker has your Brick.co credentials
```

**Impact:** 🔴 **SEVERE** - Full compromise of all bank integrations

---

### 2. **ACCESS TOKENS NOT ENCRYPTED IN DATABASE** ❌ CRITICAL
**Location:** `types/index.ts` BankConnection interface  
**Issue:**
```typescript
export interface BankConnection {
  access_token: string  // Stored as plain text!
  refresh_token?: string  // Stored as plain text!
}
```

**Why This is Critical:**
- Bank access tokens stored in plain text di Supabase
- If database compromised (SQL injection, admin account hack, etc) → all tokens stolen
- Access token = full access to user's bank account
- No encryption at rest

**Attack Vector:**
- Supabase admin account compromised
- SQL injection vulnerability
- Database backup leak
- Insider threat (Supabase employee)

**Impact:** 🔴 **SEVERE** - Attacker can access all connected bank accounts

---

### 3. **NO BANK_CONNECTIONS TABLE WITH RLS** ❌ CRITICAL
**Location:** Missing migration file  
**Issue:**
- `BankConnection` interface exists in types
- NO corresponding database table
- NO Row Level Security (RLS) policies
- Tokens have nowhere secure to be stored

**Impact:** 🔴 **SEVERE** - Cannot securely store bank connections

---

### 4. **OAUTH FLOW IN CLIENT CODE** ⚠️ HIGH RISK
**Location:** `lib/brick.ts` functions: `exchangeAuthCode()`, `refreshBrickToken()`  
**Issue:**
```typescript
export async function exchangeAuthCode(code: string): Promise<BrickAccessToken | null> {
  const response = await fetch(`${BRICK_BASE_URL}/auth/token`, {
    body: JSON.stringify({
      client_secret: BRICK_CLIENT_SECRET,  // ❌ Exposed!
    })
  })
}
```

**Why This is High Risk:**
- OAuth token exchange happens in client
- Client secret sent from client (visible in network logs)
- Anyone can intercept with Charles Proxy / Burp Suite
- Violates OAuth 2.0 security best practices

**Impact:** 🔴 **HIGH** - Token theft, man-in-the-middle attacks

---

### 5. **NO TOKEN EXPIRY HANDLING** ⚠️ MEDIUM RISK
**Location:** `lib/brick.ts`  
**Issue:**
- Access tokens expire (typically 1 hour)
- No automatic refresh logic
- No expiry timestamp validation
- User will lose bank access after 1 hour

**Impact:** 🟡 **MEDIUM** - Service disruption, poor UX

---

### 6. **NO RATE LIMITING** ⚠️ MEDIUM RISK
**Location:** All Brick API calls  
**Issue:**
- No rate limiting on API calls
- Malicious user can spam requests
- Could hit Brick.co rate limits
- Could cause account suspension

**Impact:** 🟡 **MEDIUM** - Service disruption, account ban

---

## ✅ SECURITY REQUIREMENTS (Must Implement)

### **REQUIREMENT 1: Move OAuth to Supabase Edge Function**
**Create:** `supabase/functions/brick-oauth/index.ts`

```typescript
// SERVER-SIDE ONLY
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BRICK_CLIENT_SECRET = Deno.env.get('BRICK_CLIENT_SECRET')! // ✅ Server-side only

serve(async (req) => {
  const { code, userId } = await req.json()
  
  // Exchange code for token (SERVER-SIDE)
  const response = await fetch('https://sandbox.onebrick.io/v2/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: Deno.env.get('BRICK_CLIENT_ID'),
      client_secret: BRICK_CLIENT_SECRET,  // ✅ Never leaves server
      code,
    })
  })
  
  const { access_token, refresh_token, expires_in } = await response.json()
  
  // Encrypt tokens before storage
  const encryptedAccessToken = await encryptToken(access_token)
  const encryptedRefreshToken = await encryptToken(refresh_token)
  
  // Store in database with RLS
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  
  await supabase.from('bank_connections').insert({
    user_id: userId,
    access_token_encrypted: encryptedAccessToken,
    refresh_token_encrypted: encryptedRefreshToken,
    token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
  })
  
  return new Response(JSON.stringify({ success: true }))
})
```

---

### **REQUIREMENT 2: Create bank_connections Table with RLS**
**Create:** `supabase/migrations/004_bank_connections_secure.sql`

```sql
-- Encrypted bank connections table
CREATE TABLE IF NOT EXISTS public.bank_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Bank info
  bank_id INTEGER NOT NULL,
  bank_name TEXT NOT NULL,
  bank_code TEXT NOT NULL,
  account_id TEXT NOT NULL,
  account_number TEXT NOT NULL,  -- Last 4 digits only
  account_name TEXT NOT NULL,
  
  -- ENCRYPTED tokens (AES-256-GCM)
  access_token_encrypted BYTEA NOT NULL,  -- ✅ Encrypted
  refresh_token_encrypted BYTEA,          -- ✅ Encrypted
  encryption_key_id TEXT NOT NULL,        -- Key rotation support
  
  -- Token management
  token_expires_at TIMESTAMPTZ NOT NULL,
  last_sync_at TIMESTAMPTZ,
  
  -- Connection status
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  
  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT unique_user_bank_account UNIQUE (user_id, bank_code, account_id)
);

-- Enable RLS (CRITICAL)
ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can ONLY see their own connections
CREATE POLICY "Users view own bank connections"
  ON public.bank_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own bank connections"
  ON public.bank_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own bank connections"
  ON public.bank_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own bank connections"
  ON public.bank_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_bank_connections_user ON public.bank_connections(user_id);
CREATE INDEX idx_bank_connections_status ON public.bank_connections(status);
CREATE INDEX idx_bank_connections_expiry ON public.bank_connections(token_expires_at);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_bank_connection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bank_connection_timestamp
  BEFORE UPDATE ON public.bank_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_connection_timestamp();
```

---

### **REQUIREMENT 3: Token Encryption Service**
**Create:** `supabase/functions/_shared/encryption.ts`

```typescript
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts'

const ENCRYPTION_KEY = Deno.env.get('BANK_TOKEN_ENCRYPTION_KEY')! // 32-byte key

export async function encryptToken(plaintext: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)
  
  // Generate random IV (Initialization Vector)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  // Import encryption key
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(ENCRYPTION_KEY),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
  
  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  )
  
  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.length)
  
  // Return as base64
  return btoa(String.fromCharCode(...combined))
}

export async function decryptToken(encrypted: string): Promise<string> {
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
  
  // Extract IV and ciphertext
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  
  // Import decryption key
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(ENCRYPTION_KEY),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
  
  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  )
  
  return new TextDecoder().decode(decrypted)
}
```

---

### **REQUIREMENT 4: Remove Client-Side Secrets**
**Update:** `lib/brick.ts`

```typescript
// ❌ DELETE ALL CLIENT_SECRET REFERENCES
// const BRICK_CLIENT_SECRET = process.env.BRICK_CLIENT_SECRET // DELETE THIS

// ✅ ONLY call Edge Functions
export async function exchangeAuthCode(code: string, userId: string) {
  // Call SERVER-SIDE Edge Function
  const { data, error } = await supabase.functions.invoke('brick-oauth', {
    body: { action: 'exchange', code, userId }
  })
  
  if (error) throw error
  return data
}

export async function getBankAccounts(connectionId: string) {
  // Call SERVER-SIDE Edge Function
  const { data, error } = await supabase.functions.invoke('brick-get-accounts', {
    body: { connectionId }
  })
  
  if (error) throw error
  return data
}
```

---

### **REQUIREMENT 5: Implement Auto Token Refresh**
**Create:** `supabase/functions/brick-refresh-tokens/index.ts`

```typescript
// Cron job: Every 30 minutes, refresh expiring tokens
serve(async (req) => {
  const supabase = createClient(...)
  
  // Find tokens expiring in next 10 minutes
  const { data: connections } = await supabase
    .from('bank_connections')
    .select('*')
    .eq('status', 'active')
    .lt('token_expires_at', new Date(Date.now() + 10 * 60 * 1000).toISOString())
  
  for (const conn of connections || []) {
    // Decrypt refresh token
    const refreshToken = await decryptToken(conn.refresh_token_encrypted)
    
    // Call Brick API to refresh
    const response = await fetch('https://sandbox.onebrick.io/v2/auth/token/refresh', {
      method: 'POST',
      body: JSON.stringify({
        client_id: Deno.env.get('BRICK_CLIENT_ID'),
        client_secret: Deno.env.get('BRICK_CLIENT_SECRET'),
        refresh_token: refreshToken,
      })
    })
    
    const { access_token, expires_in } = await response.json()
    
    // Re-encrypt and update
    const encryptedToken = await encryptToken(access_token)
    await supabase.from('bank_connections').update({
      access_token_encrypted: encryptedToken,
      token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', conn.id)
  }
  
  return new Response(JSON.stringify({ refreshed: connections?.length || 0 }))
})
```

---

## 📋 SECURITY CHECKLIST (Before Bank Connection)

### Critical (Must Do):
- [ ] **Move OAuth to Edge Function** - Create `brick-oauth` function
- [ ] **Create bank_connections table** - Run migration with RLS
- [ ] **Implement token encryption** - AES-256-GCM
- [ ] **Remove CLIENT_SECRET from client** - Delete from lib/brick.ts
- [ ] **Generate encryption key** - Store in Supabase secrets
- [ ] **Test RLS policies** - Verify users can't see others' connections
- [ ] **Implement auto-refresh** - Cron job every 30 min

### High Priority (Strongly Recommended):
- [ ] **Rate limiting** - Max 10 requests/minute per user
- [ ] **Audit logging** - Log all bank connection events
- [ ] **Token rotation** - Rotate encryption keys every 90 days
- [ ] **Webhook validation** - Verify Brick.co webhook signatures
- [ ] **IP whitelist** - Restrict Edge Functions to known IPs
- [ ] **2FA for bank connect** - Require 2FA before connecting bank

### Medium Priority (Should Do):
- [ ] **Session timeout** - Auto-revoke after 30 days inactivity
- [ ] **Anomaly detection** - Alert on suspicious bank access patterns
- [ ] **Backup encryption keys** - Store in separate secure vault
- [ ] **Penetration testing** - Hire security firm to test
- [ ] **Bug bounty program** - Incentivize ethical hackers

---

## 🎯 RECOMMENDATION

**⚠️ DO NOT CONNECT YOUR BANK ACCOUNT YET**

**Current Risk Level:** 🔴 **CRITICAL**

**Why:**
1. Your `CLIENT_SECRET` is exposed in client code (APK can be decompiled)
2. No encryption for bank access tokens
3. No secure database table for storing connections
4. OAuth flow runs client-side (violates security best practices)

**Action Plan:**
1. ✅ Implement all "Critical" items in checklist above (estimated: 4-6 hours)
2. ✅ Run security tests (RLS bypass attempts, token theft simulation)
3. ✅ Deploy to production with Edge Functions
4. ✅ Test with Brick.co sandbox first
5. ✅ Only then connect real bank account

**Timeline:**
- **Today:** DO NOT connect bank
- **After fixes (4-6 hours):** Safe to connect

---

## 🔐 ADDITIONAL SECURITY NOTES

### Best Practices:
1. **Never log tokens** - Don't console.log access_token
2. **Use HTTPS only** - Brick API calls must be HTTPS
3. **Validate all inputs** - Sanitize userId, code, etc
4. **Implement CSRF protection** - Use state parameter in OAuth
5. **Monitor for breaches** - Set up alerts for unusual access patterns

### Compliance:
- **GDPR:** Bank data is PII - need explicit consent + encryption
- **PCI DSS:** Not directly applicable (Brick handles card data) but encryption still required
- **OJK (Indonesia):** Brick.co is OJK compliant, but YOU must secure the tokens

### Incident Response:
If tokens are compromised:
1. Immediately revoke all access_tokens via Brick API
2. Rotate encryption keys
3. Force re-authentication for all users
4. Notify affected users within 72 hours (GDPR)
5. Report to Brick.co security team

---

## ✅ AFTER FIXES - VERIFICATION

Once you implement all fixes, verify with:

```bash
# 1. Check no secrets in client code
grep -r "CLIENT_SECRET" app/ lib/ components/
# Should return: NO RESULTS

# 2. Check RLS enabled
psql supabase -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=true;"
# Should include: bank_connections

# 3. Check tokens encrypted
psql supabase -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='bank_connections' AND column_name LIKE '%token%';"
# Should show: access_token_encrypted BYTEA

# 4. Test Edge Function
curl -X POST https://your-project.supabase.co/functions/v1/brick-oauth \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"action":"test"}'
# Should return: {"status":"ok"}
```

---

**Pentagon Security Review: FAILED ❌**  
**Clearance for Bank Connection: DENIED ❌**  
**Required Actions: 7 Critical Items**  
**Estimated Fix Time: 4-6 hours**  
**Re-review After: All critical items completed**
