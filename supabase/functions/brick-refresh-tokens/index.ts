/**
 * Brick Token Auto-Refresh Cron Job
 * Runs every 30 minutes to refresh expiring tokens
 *
 * Security:
 * - Only accessible via Supabase Cron (not public)
 * - Uses service role key (full access)
 * - Logs all refresh attempts for audit
 *
 * Schedule: every 30 minutes
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { encryptToken, decryptToken } from '../_shared/encryption.ts'
import { quantumResistantEncrypt, quantumResistantDecrypt } from '../_shared/quantum-resistant.ts'

const BRICK_CLIENT_ID = Deno.env.get('BRICK_CLIENT_ID')!
const BRICK_CLIENT_SECRET = Deno.env.get('BRICK_CLIENT_SECRET')!
const BRICK_ENVIRONMENT = Deno.env.get('BRICK_ENVIRONMENT') || 'sandbox'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const BRICK_BASE_URL = BRICK_ENVIRONMENT === 'production'
  ? 'https://api.onebrick.io/v2'
  : 'https://sandbox.onebrick.io/v2'

serve(async (req) => {
  try {
    // Verify this is called from Supabase Cron (security check)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.includes('Bearer')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Find tokens expiring in next 15 minutes
    const expiryThreshold = new Date(Date.now() + 15 * 60 * 1000)

    const { data: connections, error: fetchError } = await supabase
      .from('bank_connections')
      .select('*')
      .eq('status', 'active')
      .lt('token_expires_at', expiryThreshold.toISOString())
      .not('refresh_token_encrypted', 'is', null)

    if (fetchError) {
      console.error('Failed to fetch connections:', fetchError)
      throw fetchError
    }

    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({
        message: 'No tokens to refresh',
        refreshed: 0,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log(`Found ${connections.length} tokens to refresh`)

    let refreshed = 0
    let failed = 0

    // Refresh each token
    for (const conn of connections) {
      try {
        console.log(`Refreshing token for connection ${conn.id} (${conn.bank_name})`)

        // Decrypt refresh token (QUANTUM-RESISTANT)
        const refreshToken = await quantumResistantDecrypt(conn.refresh_token_encrypted)

        // Call Brick API to refresh
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
          const errorText = await response.text()
          console.error(`Refresh failed for ${conn.id}:`, response.status, errorText)

          // Mark as expired
          await supabase.from('bank_connections').update({
            status: 'expired',
          }).eq('id', conn.id)

          // Log failure
          await supabase.from('bank_connection_audit_log').insert({
            connection_id: conn.id,
            user_id: conn.user_id,
            event_type: 'sync_failed',
            event_details: {
              reason: 'token_refresh_failed',
              status: response.status,
            },
          })

          failed++
          continue
        }

        const data = await response.json()
        const { access_token, expires_in, refresh_token: newRefreshToken } = data

        // Encrypt new tokens (QUANTUM-RESISTANT)
        const encryptedAccessToken = await quantumResistantEncrypt(access_token)
        const encryptedRefreshToken = newRefreshToken
          ? await quantumResistantEncrypt(newRefreshToken)
          : conn.refresh_token_encrypted

        const expiresAt = new Date(Date.now() + (expires_in * 1000))

        // Update database
        const { error: updateError } = await supabase
          .from('bank_connections')
          .update({
            access_token_encrypted: encryptedAccessToken,
            refresh_token_encrypted: encryptedRefreshToken,
            token_expires_at: expiresAt.toISOString(),
            status: 'active',
          })
          .eq('id', conn.id)

        if (updateError) {
          console.error(`Database update failed for ${conn.id}:`, updateError)
          failed++
          continue
        }

        // Log success
        await supabase.from('bank_connection_audit_log').insert({
          connection_id: conn.id,
          user_id: conn.user_id,
          event_type: 'token_refreshed',
          event_details: {
            expires_at: expiresAt.toISOString(),
            refreshed_by: 'cron',
          },
        })

        refreshed++
        console.log(`✓ Refreshed token for ${conn.bank_name} (expires: ${expiresAt.toISOString()})`)
      } catch (error: any) {
        console.error(`Error refreshing connection ${conn.id}:`, error)
        failed++
      }
    }

    return new Response(JSON.stringify({
      message: 'Token refresh completed',
      total: connections.length,
      refreshed,
      failed,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('Cron job error:', error)

    return new Response(JSON.stringify({
      error: error.message || 'Internal server error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
