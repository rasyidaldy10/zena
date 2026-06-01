import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

/**
 * Stock Price Updater Agent
 *
 * Dijalankan setiap hari setelah penutupan bursa (sekitar 16:30 WIB)
 *
 * Flow:
 * 1. Ambil semua ticker unik dari investment_holdings
 * 2. Fetch harga real-time dari API (Yahoo Finance / IDX API)
 * 3. Update tabel stock_prices
 * 4. Update current_price di investment_holdings
 * 5. Recalculate wallet balance untuk wallet investasi
 *
 * TODO: Integrate dengan Yahoo Finance API atau IDX API
 * Untuk sekarang: manual update atau placeholder
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Fetch semua ticker unik yang ada di holdings
    const { data: holdings } = await admin
      .from('investment_holdings')
      .select('ticker')

    if (!holdings || holdings.length === 0) {
      await admin.from('agent_logs').insert({
        agent_name: 'stock-price-updater',
        user_id: null,
        action: 'cron_run',
        result: 'No holdings found',
      })
      return new Response(JSON.stringify({ status: 'no_holdings' }), { headers: cors })
    }

    const uniqueTickers = [...new Set(holdings.map(h => h.ticker))]
    let updated = 0
    let failed = 0

    // Loop per ticker
    for (const ticker of uniqueTickers) {
      try {
        // TODO: Fetch real price from API
        // const realPrice = await fetchYahooFinance(ticker + '.JK')

        // SIMULATION: Random price update ±5%
        const { data: oldPrice } = await admin
          .from('stock_prices')
          .select('price')
          .eq('ticker', ticker)
          .maybeSingle()

        let newPrice: number
        if (oldPrice) {
          const changePercent = (Math.random() - 0.5) * 10 // -5% to +5%
          newPrice = oldPrice.price * (1 + changePercent / 100)
        } else {
          // Default price jika belum ada
          newPrice = 5000
        }

        // Upsert stock price
        await admin.from('stock_prices').upsert({
          ticker,
          price: newPrice,
          change_percent: oldPrice ? ((newPrice - oldPrice.price) / oldPrice.price) * 100 : 0,
          last_updated: new Date().toISOString(),
          source: 'simulation',
        }, { onConflict: 'ticker' })

        // Update current_price di holdings
        await admin
          .from('investment_holdings')
          .update({ current_price: newPrice, last_updated: new Date().toISOString() })
          .eq('ticker', ticker)

        updated++
      } catch (err) {
        console.error(`Failed to update ${ticker}:`, err)
        failed++
      }
    }

    // Recalculate wallet balances untuk wallet investasi
    const { data: investmentWallets } = await admin
      .from('user_wallets')
      .select('id')
      .eq('wallet_type', 'investasi')
      .eq('is_active', true)

    if (investmentWallets && investmentWallets.length > 0) {
      for (const wallet of investmentWallets) {
        const { data: walletHoldings } = await admin
          .from('investment_holdings')
          .select('quantity, current_price, buy_price')
          .eq('wallet_id', wallet.id)

        if (walletHoldings && walletHoldings.length > 0) {
          const totalValue = walletHoldings.reduce((sum, h) => {
            const price = h.current_price || h.buy_price
            return sum + (h.quantity * 100 * price)
          }, 0)

          await admin
            .from('user_wallets')
            .update({ current_balance: totalValue })
            .eq('id', wallet.id)
        }
      }
    }

    await admin.from('agent_logs').insert({
      agent_name: 'stock-price-updater',
      user_id: null,
      action: 'cron_run',
      result: `Updated: ${updated}, Failed: ${failed}`,
    })

    return new Response(
      JSON.stringify({ status: 'success', updated, failed }),
      { headers: cors }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: cors }
    )
  }
})
