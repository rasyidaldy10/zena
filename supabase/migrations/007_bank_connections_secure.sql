-- ============================================
-- SECURE BANK CONNECTIONS TABLE
-- Pentagon-Grade Security Implementation
-- ============================================
-- Features:
-- 1. Encrypted token storage (AES-256-GCM)
-- 2. Row Level Security (RLS) - users ONLY see their own data
-- 3. Audit trail (created_at, updated_at, last_accessed_at)
-- 4. Auto-expire tokens (token_expires_at)
-- 5. Connection status tracking
-- 6. Token rotation support (encryption_key_id)

-- ============================================
-- TABLE: bank_connections
-- ============================================

CREATE TABLE IF NOT EXISTS public.bank_connections (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- User Association (CASCADE delete when user deleted)
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Wallet Association (optional - for linking to specific wallet)
  wallet_id UUID REFERENCES public.user_wallets(id) ON DELETE SET NULL,

  -- Bank Information
  bank_id INTEGER NOT NULL,
  bank_name TEXT NOT NULL,
  bank_code TEXT NOT NULL,

  -- Account Information (SENSITIVE - minimize data)
  account_id TEXT NOT NULL,          -- Brick.co account ID
  account_number_last4 TEXT,         -- Only last 4 digits (PCI DSS compliant)
  account_name TEXT NOT NULL,        -- Account holder name
  account_type TEXT,                 -- savings, checking, credit

  -- ENCRYPTED TOKENS (CRITICAL SECURITY)
  -- Tokens are encrypted with AES-256-GCM before storage
  -- Stored as TEXT (base64-encoded ciphertext)
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,

  -- Token Management
  token_expires_at TIMESTAMPTZ NOT NULL,
  encryption_key_id TEXT NOT NULL DEFAULT 'v1',  -- For key rotation

  -- Connection Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'active', 'expired', 'revoked', 'error')
  ),

  -- Last Sync Information
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT CHECK (
    last_sync_status IS NULL OR
    last_sync_status IN ('success', 'failed', 'partial')
  ),

  -- Audit Trail (CRITICAL for security monitoring)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,

  -- Security: Prevent duplicate connections
  CONSTRAINT unique_user_bank_account UNIQUE (user_id, bank_code, account_id)
);

-- ============================================
-- INDEXES (Performance + Security)
-- ============================================

-- Fast user lookup (most common query)
CREATE INDEX idx_bank_connections_user_id
  ON public.bank_connections(user_id);

-- Fast status filtering (for monitoring)
CREATE INDEX idx_bank_connections_status
  ON public.bank_connections(status)
  WHERE status IN ('active', 'expired');

-- Fast expiry lookup (for auto-refresh cron)
CREATE INDEX idx_bank_connections_expiry
  ON public.bank_connections(token_expires_at)
  WHERE status = 'active';

-- Composite index for user + status queries
CREATE INDEX idx_bank_connections_user_status
  ON public.bank_connections(user_id, status);

-- ============================================
-- ROW LEVEL SECURITY (RLS) - CRITICAL!
-- ============================================

-- Enable RLS (BLOCKS all access by default)
ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can ONLY SELECT their own connections
DROP POLICY IF EXISTS "Users view own bank connections" ON public.bank_connections;
CREATE POLICY "Users view own bank connections"
  ON public.bank_connections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can ONLY INSERT their own connections
DROP POLICY IF EXISTS "Users insert own bank connections" ON public.bank_connections;
CREATE POLICY "Users insert own bank connections"
  ON public.bank_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can ONLY UPDATE their own connections
DROP POLICY IF EXISTS "Users update own bank connections" ON public.bank_connections;
CREATE POLICY "Users update own bank connections"
  ON public.bank_connections
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can ONLY DELETE their own connections
DROP POLICY IF EXISTS "Users delete own bank connections" ON public.bank_connections;
CREATE POLICY "Users delete own bank connections"
  ON public.bank_connections
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Service Role Policy (for Edge Functions ONLY)
-- Allows service role to refresh tokens automatically
DROP POLICY IF EXISTS "Service role can refresh tokens" ON public.bank_connections;
CREATE POLICY "Service role can refresh tokens"
  ON public.bank_connections
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- TRIGGERS (Auto-update timestamps)
-- ============================================

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bank_connection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Before UPDATE on bank_connections
DROP TRIGGER IF EXISTS trigger_update_bank_connection_timestamp ON public.bank_connections;
CREATE TRIGGER trigger_update_bank_connection_timestamp
  BEFORE UPDATE ON public.bank_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_bank_connection_timestamp();

-- Function: Auto-expire tokens past expiry date
CREATE OR REPLACE FUNCTION auto_expire_bank_tokens()
RETURNS TRIGGER AS $$
BEGIN
  -- If token expired and status still active, mark as expired
  IF NEW.token_expires_at < NOW() AND NEW.status = 'active' THEN
    NEW.status = 'expired';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Before INSERT/UPDATE, check token expiry
DROP TRIGGER IF EXISTS trigger_auto_expire_bank_tokens ON public.bank_connections;
CREATE TRIGGER trigger_auto_expire_bank_tokens
  BEFORE INSERT OR UPDATE ON public.bank_connections
  FOR EACH ROW
  EXECUTE FUNCTION auto_expire_bank_tokens();

-- ============================================
-- SECURITY AUDIT LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.bank_connection_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Audit Event
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'connection_created',
      'connection_updated',
      'connection_deleted',
      'token_refreshed',
      'token_accessed',
      'sync_initiated',
      'sync_completed',
      'sync_failed',
      'connection_revoked'
    )
  ),

  -- Event Details
  event_details JSONB,

  -- Request Metadata (for forensics)
  ip_address INET,
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE public.bank_connection_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own audit logs
CREATE POLICY "Users view own audit logs"
  ON public.bank_connection_audit_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for fast audit log queries
CREATE INDEX idx_audit_log_user_id ON public.bank_connection_audit_log(user_id);
CREATE INDEX idx_audit_log_connection_id ON public.bank_connection_audit_log(connection_id);
CREATE INDEX idx_audit_log_event_type ON public.bank_connection_audit_log(event_type);
CREATE INDEX idx_audit_log_created_at ON public.bank_connection_audit_log(created_at DESC);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function: Revoke bank connection (secure cleanup)
CREATE OR REPLACE FUNCTION revoke_bank_connection(connection_id_param UUID)
RETURNS VOID AS $$
DECLARE
  user_id_var UUID;
BEGIN
  -- Get user_id (for audit log)
  SELECT user_id INTO user_id_var
  FROM public.bank_connections
  WHERE id = connection_id_param AND user_id = auth.uid();

  -- Security check: only owner can revoke
  IF user_id_var IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Cannot revoke connection';
  END IF;

  -- Update connection status
  UPDATE public.bank_connections
  SET
    status = 'revoked',
    access_token_encrypted = '',  -- Clear token
    refresh_token_encrypted = '',  -- Clear token
    updated_at = NOW()
  WHERE id = connection_id_param AND user_id = auth.uid();

  -- Log revocation
  INSERT INTO public.bank_connection_audit_log (
    connection_id, user_id, event_type, event_details
  ) VALUES (
    connection_id_param,
    user_id_var,
    'connection_revoked',
    jsonb_build_object('revoked_at', NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMMENTS (Documentation)
-- ============================================

COMMENT ON TABLE public.bank_connections IS
  'Secure storage for bank OAuth connections. All tokens are encrypted with AES-256-GCM.';

COMMENT ON COLUMN public.bank_connections.access_token_encrypted IS
  'ENCRYPTED access token (AES-256-GCM). Never store plaintext tokens!';

COMMENT ON COLUMN public.bank_connections.refresh_token_encrypted IS
  'ENCRYPTED refresh token (AES-256-GCM). Used for automatic token renewal.';

COMMENT ON COLUMN public.bank_connections.encryption_key_id IS
  'Key version ID for token rotation. Change this when rotating encryption keys.';

COMMENT ON COLUMN public.bank_connections.account_number_last4 IS
  'Only last 4 digits of account number (PCI DSS compliant). Never store full account numbers!';

-- ============================================
-- SECURITY VALIDATION QUERIES
-- ============================================

-- Verify RLS is enabled
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'bank_connections') THEN
    RAISE EXCEPTION 'CRITICAL: RLS not enabled on bank_connections table!';
  END IF;
END $$;

-- Verify all policies exist
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'bank_connections';

  IF policy_count < 5 THEN
    RAISE EXCEPTION 'CRITICAL: Missing RLS policies on bank_connections (expected 5, got %)', policy_count;
  END IF;
END $$;
