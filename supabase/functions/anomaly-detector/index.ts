import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

    const { amount, type, category, note } = await req.json()

    if (type !== 'expense') {
      return new Response(JSON.stringify({ skipped: true }), { headers: cors })
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const results: string[] = []

    // ── ANOMALY DETECTION ──
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
    const { data: history } = await admin
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .eq('category', category)
      .eq('is_wallet_transfer', false)
      .gte('date', thirtyDaysAgo)

    if (history && history.length >= 3) {
      const avg = history.reduce((s: number, t: { amount: number }) => s + t.amount, 0) / history.length
      if (amount > avg * 3) {
        const title = '🔍 Pengeluaran Tidak Wajar'
        const message = `Pengeluaran ${category} Rp ${amount.toLocaleString('id-ID')} adalah ${Math.round(amount / avg)}x lebih besar dari rata-rata (Rp ${Math.round(avg).toLocaleString('id-ID')})`

        await admin.from('notifications').insert({
          user_id: user.id,
          type: 'anomaly',
          title,
          message,
          metadata: { amount, average: avg, category, multiplier: amount / avg },
        })
        results.push(`anomaly: ${Math.round(amount / avg)}x avg`)
      }
    }

    // ── SMART CATEGORIZATION ──
    // Kalau kategori "Lainnya" atau tidak ada note → minta user kategorikan
    if (category === 'Lainnya' || !note) {
      const merchant = note || `transaksi Rp ${amount.toLocaleString('id-ID')}`
      await admin.from('notifications').insert({
        user_id: user.id,
        type: 'categorization',
        title: '🏷️ Bantu kategorikan transaksi',
        message: `Ada transaksi Rp ${amount.toLocaleString('id-ID')} dari "${merchant}" — ini masuk kategori apa?`,
        metadata: { amount, merchant: note, suggested_category: category },
      })
      results.push('categorization requested')
    }

    await admin.from('agent_logs').insert({
      agent_name: 'anomaly-detector',
      user_id: user.id,
      action: 'analyze_transaction',
      result: results.length ? results.join(', ') : 'normal',
    })

    return new Response(JSON.stringify({ results }), { headers: cors })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})
