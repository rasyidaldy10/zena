/**
 * AES-256-GCM Encryption Service
 * Pentagon-grade encryption for bank access tokens
 *
 * Security Features:
 * - AES-256-GCM (authenticated encryption)
 * - Random IV per encryption (prevents pattern analysis)
 * - Key derivation from environment variable
 * - Constant-time operations (timing attack resistant)
 */

const ENCRYPTION_KEY_ENV = Deno.env.get('BANK_TOKEN_ENCRYPTION_KEY')

if (!ENCRYPTION_KEY_ENV) {
  throw new Error('CRITICAL: BANK_TOKEN_ENCRYPTION_KEY not set in environment')
}

// Validate key length (must be 32 bytes for AES-256)
if (ENCRYPTION_KEY_ENV.length !== 64) {
  throw new Error('CRITICAL: BANK_TOKEN_ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
}

// Convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  return bytes
}

const ENCRYPTION_KEY_BYTES = hexToBytes(ENCRYPTION_KEY_ENV)

/**
 * Encrypt sensitive data (access tokens, refresh tokens)
 * Returns base64-encoded: IV (12 bytes) + Ciphertext + Auth Tag (16 bytes)
 */
export async function encryptToken(plaintext: string): Promise<string> {
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(plaintext)

    // Generate random IV (96 bits / 12 bytes - recommended for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12))

    // Import encryption key
    const key = await crypto.subtle.importKey(
      'raw',
      ENCRYPTION_KEY_BYTES,
      { name: 'AES-GCM', length: 256 },
      false, // Not extractable (security hardening)
      ['encrypt']
    )

    // Encrypt with AES-256-GCM
    // GCM provides both confidentiality and authenticity
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128, // 128-bit authentication tag
      },
      key,
      data
    )

    // Combine IV + ciphertext (includes auth tag)
    const combined = new Uint8Array(iv.length + ciphertext.byteLength)
    combined.set(iv, 0)
    combined.set(new Uint8Array(ciphertext), iv.length)

    // Return as base64 for storage
    return btoa(String.fromCharCode(...combined))
  } catch (error) {
    console.error('Encryption failed:', error)
    throw new Error('Token encryption failed')
  }
}

/**
 * Decrypt sensitive data
 * Input: base64-encoded IV + Ciphertext + Auth Tag
 */
export async function decryptToken(encryptedBase64: string): Promise<string> {
  try {
    // Decode base64
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0))

    // Extract IV (first 12 bytes)
    const iv = combined.slice(0, 12)

    // Extract ciphertext + auth tag (remaining bytes)
    const ciphertext = combined.slice(12)

    // Import decryption key
    const key = await crypto.subtle.importKey(
      'raw',
      ENCRYPTION_KEY_BYTES,
      { name: 'AES-GCM', length: 256 },
      false, // Not extractable
      ['decrypt']
    )

    // Decrypt with AES-256-GCM
    // Will throw if auth tag verification fails (tamper detection)
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128,
      },
      key,
      ciphertext
    )

    return new TextDecoder().decode(decrypted)
  } catch (error) {
    console.error('Decryption failed:', error)
    // DO NOT expose decryption errors (prevents oracle attacks)
    throw new Error('Token decryption failed - possible tampering detected')
  }
}

/**
 * Generate a new encryption key (for initial setup)
 * Returns 64 hex characters (32 bytes)
 *
 * Usage: Call this ONCE to generate key, then store in Supabase secrets
 */
export function generateEncryptionKey(): string {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(keyBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Securely compare two strings (constant-time to prevent timing attacks)
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Hash sensitive data for audit logs (one-way, cannot reverse)
 */
export async function hashForAudit(data: string): Promise<string> {
  const encoder = new TextEncoder()
  const dataBytes = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBytes)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
