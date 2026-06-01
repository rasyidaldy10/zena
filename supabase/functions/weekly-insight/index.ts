import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Ambil semua user yang punya preferensi
    const { data: allPrefs } = await admin
      .from('user_preferences')
      .select('user_id, persona, language, monthly_income, nickname')

    if (!allPrefs?.length) {
      return new Response(JSON.stringify({ processed: 0 }), { headers: cors })
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const weekStart = sevenDaysAgo
    let processed = 0

    for (const prefs of allPrefs) {
      try {
        // Cek apakah insight minggu ini sudah ada
        const { data: existing } = await admin
          .from('ai_insights')
          .select('id')
          .eq('user_id', prefs.user_id)
          .eq('week_start', weekStart)
          .single()

        if (existing) continue

        const { data: txns } = await admin
          .from('transactions')
          .select('amount, type, category, date')
          .eq('user_id', prefs.user_id)
          .eq('is_wallet_transfer', false)
          .gte('date', sevenDaysAgo)

        if (!txns?.length) continue

        const totalExpense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
        const totalIncome = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
        const byCategory: Record<string, number> = {}
        txns.filter(t => t.type === 'expense').forEach(t => {
          byCategory[t.category] = (byCategory[t.category] ?? 0) + t.amount
        })
        const topCat = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 3)
          .map(([c, a]) => `${c}: Rp ${a.toLocaleString('id-ID')}`).join(', ')

        const langMap: Record<string, string> = {
          id: 'Bahasa Indonesia',
          en: 'English',
          my: 'Bahasa Melayu',
          zh: '中文',
        }
        const lang = langMap[prefs.language ?? 'id'] ?? 'Bahasa Indonesia'

        const prompt = `Kamu adalah asisten keuangan pribadi yang berperan sebagai ${prefs.persona ?? 'advisor'}.
Buat insight keuangan mingguan singkat (max 3 kalimat) dalam ${lang} untuk ${prefs.nickname ?? 'pengguna'}.

Data minggu ini:
- Pemasukan: Rp ${totalIncome.toLocaleString('id-ID')}
- Pengeluaran: Rp ${totalExpense.toLocaleString('id-ID')}
- Saldo bersih: Rp ${(totalIncome - totalExpense).toLocaleString('id-ID')}
- Top pengeluaran: ${topCat || 'belum ada data'}
- Penghasilan bulanan: Rp ${(prefs.monthly_income ?? 0).toLocaleString('id-ID')}

Berikan insight yang personal, actionable, dan sesuai persona. Jangan terlalu formal.`

        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': CLAUDE_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 300,
            messages: [{ role: 'user', content: prompt }],
          }),
        })

        const aiData = await aiRes.json()
        const insightText = aiData.content?.[0]?.text ?? 'Insight tidak tersedia saat ini.'

        await admin.from('ai_insights').insert({
          user_id: prefs.user_id,
          insight_text: insightText,
          week_start: weekStart,
        })

        await admin.from('agent_logs').insert({
          agent_name: 'weekly-insight',
          user_id: prefs.user_id,
          action: 'generate_insight',
          result: `${txns.length} transaksi dianalisis`,
        })

        processed++
      } catch {
        // Skip user yang gagal, lanjut ke berikutnya
      }
    }

    return new Response(JSON.stringify({ processed }), { headers: cors })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})
