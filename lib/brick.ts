/**
 * Brick.co Open Banking API Integration
 * Documentation: https://onebrick.readme.io/reference/api-introduction
 */

import type {
  BrickBank,
  BrickAccessToken,
  BrickBankAccount,
  BrickTransaction,
  BankConnection,
} from '../types'

const BRICK_BASE_URL =
  process.env.BRICK_ENVIRONMENT === 'production'
    ? 'https://api.onebrick.io/v2'
    : 'https://sandbox.onebrick.io/v2'

const BRICK_CLIENT_ID = process.env.BRICK_CLIENT_ID || ''
const BRICK_CLIENT_SECRET = process.env.BRICK_CLIENT_SECRET || ''
const BRICK_REDIRECT_URI = process.env.BRICK_REDIRECT_URI || 'zena://brick-callback'

// Popular Indonesian banks
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
 * Get list of supported banks
 */
export async function getBankList(): Promise<BrickBank[]> {
  // In production, fetch from Brick API
  // For now, return static list
  return POPULAR_BANKS
}

/**
 * Generate Brick OAuth authorization URL
 */
export function getBrickAuthUrl(bankCode: string, userId: string): string {
  const params = new URLSearchParams({
    client_id: BRICK_CLIENT_ID,
    redirect_uri: BRICK_REDIRECT_URI,
    bank_code: bankCode,
    state: userId, // Pass user_id to identify user after OAuth callback
  })

  return `${BRICK_BASE_URL}/auth/token?${params.toString()}`
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeAuthCode(
  code: string
): Promise<BrickAccessToken | null> {
  try {
    const response = await fetch(`${BRICK_BASE_URL}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: BRICK_CLIENT_ID,
        client_secret: BRICK_CLIENT_SECRET,
        code: code,
        redirect_uri: BRICK_REDIRECT_URI,
      }),
    })

    if (!response.ok) {
      console.error('Brick auth token exchange failed:', response.status)
      return null
    }

    const data = await response.json()
    return data as BrickAccessToken
  } catch (error) {
    console.error('Error exchanging Brick auth code:', error)
    return null
  }
}

/**
 * Get bank accounts for authenticated user
 */
export async function getBankAccounts(
  accessToken: string
): Promise<BrickBankAccount[]> {
  try {
    const response = await fetch(`${BRICK_BASE_URL}/accounts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('Failed to fetch Brick bank accounts:', response.status)
      return []
    }

    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error('Error fetching Brick bank accounts:', error)
    return []
  }
}

/**
 * Get transactions for a bank account
 */
export async function getBankTransactions(
  accessToken: string,
  accountId: string,
  fromDate?: string,
  toDate?: string
): Promise<BrickTransaction[]> {
  try {
    const params = new URLSearchParams()
    if (fromDate) params.append('from', fromDate)
    if (toDate) params.append('to', toDate)

    const response = await fetch(
      `${BRICK_BASE_URL}/accounts/${accountId}/transactions?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error('Failed to fetch Brick transactions:', response.status)
      return []
    }

    const data = await response.json()
    return data.data || []
  } catch (error) {
    console.error('Error fetching Brick transactions:', error)
    return []
  }
}

/**
 * Sync bank transactions to Zena database
 * This should be called from a Supabase Edge Function for security
 */
export async function syncBankTransactions(
  connectionId: string,
  accessToken: string,
  accountId: string
): Promise<{ synced: number; errors: number }> {
  try {
    // Get transactions from last 30 days
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - 30)

    const transactions = await getBankTransactions(
      accessToken,
      accountId,
      fromDate.toISOString().split('T')[0]
    )

    let synced = 0
    let errors = 0

    // TODO: Insert transactions to Supabase via Edge Function
    // For now, just return counts
    synced = transactions.length

    return { synced, errors }
  } catch (error) {
    console.error('Error syncing bank transactions:', error)
    return { synced: 0, errors: 1 }
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshBrickToken(
  refreshToken: string
): Promise<BrickAccessToken | null> {
  try {
    const response = await fetch(`${BRICK_BASE_URL}/auth/token/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: BRICK_CLIENT_ID,
        client_secret: BRICK_CLIENT_SECRET,
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) {
      console.error('Failed to refresh Brick token:', response.status)
      return null
    }

    const data = await response.json()
    return data as BrickAccessToken
  } catch (error) {
    console.error('Error refreshing Brick token:', error)
    return null
  }
}

/**
 * Disconnect bank account (revoke access)
 */
export async function disconnectBankAccount(
  accessToken: string
): Promise<boolean> {
  try {
    const response = await fetch(`${BRICK_BASE_URL}/auth/revoke`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    return response.ok
  } catch (error) {
    console.error('Error disconnecting bank account:', error)
    return false
  }
}
