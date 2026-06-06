/**
 * Brick.co Bank Integration (CLIENT-SIDE)
 * Security: ALL sensitive operations run on server via Edge Functions
 *
 * ✅ SAFE: No CLIENT_SECRET in this file
 * ✅ SAFE: No access tokens stored in client
 * ✅ SAFE: All API calls via Supabase Edge Functions
 *
 * Architecture:
 * Client → Edge Function → Brick API
 * Client never talks to Brick API directly
 */

import { supabase } from './supabase'
import type {
  BrickBank,
  BrickBankAccount,
  BrickTransaction,
} from '../types'

const BRICK_ENVIRONMENT = process.env.BRICK_ENVIRONMENT || 'sandbox'
const BRICK_CLIENT_ID = process.env.BRICK_CLIENT_ID || '' // Only used for URL generation (safe)

// Popular Indonesian banks (static list - safe to be in client)
const POPULAR_BANKS: BrickBank[] = [
  { id: 1, name: 'Bank Central Asia (BCA)', code: 'bca', logo_url: '', is_popular: true },
  { id: 2, name: 'Bank Mandiri', code: 'mandiri', logo_url: '', is_popular: true },
  { id: 3, name: 'Bank Rakyat Indonesia (BRI)', code: 'bri', logo_url: '', is_popular: true },
  { id: 4, name: 'Bank Negara Indonesia (BNI)', code: 'bni', logo_url: '', is_popular: true },
  { id: 5, name: 'Bank CIMB Niaga', code: 'cimb', logo_url: '', is_popular: true },
  { id: 6, name: 'Bank Permata', code: 'permata', logo_url: '', is_popular: true },
  { id: 7, name: 'Bank Danamon', code: 'danamon', logo_url: '', is_popular: false },
  { id: 8, name: 'Bank OCBC NISP', code: 'ocbc', logo_url: '', is_popular: false },
  { id: 9, name: 'Bank UOB Indonesia', code: 'uob', logo_url: '', is_popular: false },
  { id: 10, name: 'Bank Maybank Indonesia', code: 'maybank', logo_url: '', is_popular: false },
]

/**
 * Get list of supported banks (static data - safe)
 */
export async function getBankList(): Promise<BrickBank[]> {
  return POPULAR_BANKS
}

/**
 * Generate Brick OAuth authorization URL
 * Safe to generate client-side (no secrets involved)
 */
export function getBrickAuthUrl(bankCode: string, userId: string): string {
  const baseUrl = BRICK_ENVIRONMENT === 'production'
    ? 'https://api.onebrick.io/v2'
    : 'https://sandbox.onebrick.io/v2'

  const params = new URLSearchParams({
    client_id: BRICK_CLIENT_ID,
    redirect_uri: 'zena://brick-callback',
    institution_id: bankCode,
    state: userId, // CSRF protection - will be validated server-side
  })

  return `${baseUrl}/auth?${params.toString()}`
}

/**
 * Exchange authorization code for access token
 * ✅ SECURE: Calls Edge Function (server-side)
 * ❌ NEVER calls Brick API directly from client
 */
export async function exchangeAuthCode(
  code: string,
  userId: string,
  state: string
): Promise<{ success: boolean; connection?: any; error?: string }> {
  try {
    // Validate CSRF state parameter
    if (state !== userId) {
      throw new Error('Invalid state parameter - possible CSRF attack')
    }

    // Call server-side Edge Function (CLIENT_SECRET never exposed)
    const { data, error } = await supabase.functions.invoke('brick-oauth', {
      body: {
        action: 'exchange',
        code,
        userId,
        state,
      },
    })

    if (error) {
      console.error('OAuth exchange error:', error)
      return {
        success: false,
        error: error.message || 'Failed to connect bank account',
      }
    }

    return data
  } catch (error: any) {
    console.error('Exchange auth code failed:', error)
    return {
      success: false,
      error: error.message || 'An error occurred',
    }
  }
}

/**
 * Get bank accounts for a connection
 * ✅ SECURE: Calls Edge Function, which decrypts token server-side
 */
export async function getBankAccounts(
  connectionId: string
): Promise<BrickBankAccount[]> {
  try {
    const { data, error } = await supabase.functions.invoke('brick-oauth', {
      body: {
        action: 'get-accounts',
        connectionId,
      },
    })

    if (error) {
      console.error('Get accounts error:', error)
      throw error
    }

    return data.accounts || []
  } catch (error: any) {
    console.error('Error fetching bank accounts:', error)
    return []
  }
}

/**
 * Get transactions for a bank account
 * ✅ SECURE: Edge Function decrypts token, calls Brick API server-side
 */
export async function getBankTransactions(
  connectionId: string,
  fromDate?: string,
  toDate?: string
): Promise<BrickTransaction[]> {
  try {
    const { data, error } = await supabase.functions.invoke('brick-oauth', {
      body: {
        action: 'get-transactions',
        connectionId,
        fromDate,
        toDate,
      },
    })

    if (error) {
      console.error('Get transactions error:', error)
      throw error
    }

    return data.transactions || []
  } catch (error: any) {
    console.error('Error fetching bank transactions:', error)
    return []
  }
}

/**
 * Refresh access token (when expired)
 * ✅ SECURE: Edge Function handles refresh token decryption + Brick API call
 */
export async function refreshBrickToken(
  connectionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('brick-oauth', {
      body: {
        action: 'refresh',
        connectionId,
      },
    })

    if (error) {
      console.error('Token refresh error:', error)
      return {
        success: false,
        error: error.message || 'Failed to refresh token',
      }
    }

    return data
  } catch (error: any) {
    console.error('Error refreshing Brick token:', error)
    return {
      success: false,
      error: error.message || 'An error occurred',
    }
  }
}

/**
 * Disconnect bank account (revoke access)
 * ✅ SECURE: Edge Function revokes token at Brick API + clears from database
 */
export async function disconnectBankAccount(
  connectionId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('brick-oauth', {
      body: {
        action: 'revoke',
        connectionId,
      },
    })

    if (error) {
      console.error('Disconnect error:', error)
      return false
    }

    return data.success || false
  } catch (error: any) {
    console.error('Error disconnecting bank account:', error)
    return false
  }
}

/**
 * Get user's bank connections from database
 * ✅ SECURE: RLS ensures user only sees their own connections
 */
export async function getUserBankConnections(): Promise<any[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return []

    const { data, error } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Get connections error:', error)
      return []
    }

    // Return safe data (tokens are encrypted in DB, not exposed here)
    return (data || []).map(conn => ({
      id: conn.id,
      bank_name: conn.bank_name,
      bank_code: conn.bank_code,
      account_last4: conn.account_number_last4,
      account_name: conn.account_name,
      status: conn.status,
      created_at: conn.created_at,
      last_sync_at: conn.last_sync_at,
    }))
  } catch (error: any) {
    console.error('Error fetching user bank connections:', error)
    return []
  }
}

/**
 * Sync bank transactions to Zena transactions table
 * Fetches transactions from bank → creates Zena transactions
 */
export async function syncBankTransactions(
  connectionId: string,
  walletId: string
): Promise<{ synced: number; errors: number }> {
  try {
    // Get transactions from last 30 days
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - 30)
    const fromDateStr = fromDate.toISOString().split('T')[0]

    const transactions = await getBankTransactions(connectionId, fromDateStr)

    let synced = 0
    let errors = 0

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    // Insert transactions into Zena database
    for (const txn of transactions) {
      try {
        const { error } = await supabase.from('transactions').insert({
          user_id: session.user.id,
          wallet_id: walletId,
          type: txn.direction === 'in' ? 'income' : 'expense',
          amount: Math.abs(txn.amount),
          category: txn.category || 'Lainnya',
          notes: txn.description || '',
          date: txn.date,
          is_recurring: false,
          tags: ['bank_sync', connectionId],
        })

        if (error) {
          console.error('Failed to insert transaction:', error)
          errors++
        } else {
          synced++
        }
      } catch (err) {
        errors++
      }
    }

    // Update last sync time
    await supabase
      .from('bank_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: errors === 0 ? 'success' : 'partial',
      })
      .eq('id', connectionId)

    return { synced, errors }
  } catch (error: any) {
    console.error('Error syncing bank transactions:', error)
    return { synced: 0, errors: 1 }
  }
}
