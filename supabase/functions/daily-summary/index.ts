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

    const { data: allPrefs } = await admin
      .from('user_preferences')
      .select('user_id, persona, language, monthly_income, nickname, budget_method')

    if (!allPrefs?.length) {
      return new Response(JSON.stringify({ processed: 0 }), { headers: cors })
    }

    const today = new Date().toISOString().split('T')[0]
    let processed = 0

    for (const prefs of allPrefs) {
      try {
        // Hindari duplikat summary hari ini
        const { data: existing } = await admin
          .from('notifications')
          .select('id')
          .eq('user_id', prefs.user_id)
          .eq('type', 'daily_summary')
          .gte('created_at', `${today}T00:00:00Z`)
          .single()

        if (existing) continue

        const { data: todayTxns } = await admin
          .from('transactions')
          .select('amount, type, category')
          .eq('user_id', prefs.user_id)
          .eq('date', today)
          .eq('is_wallet_transfer', false)

        const totalExpense = (todayTxns ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
        const totalIncome = (todayTxns ?? []).filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
        const txnCount = (todayTxns ?? []).length

        // Hitung daily budget
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
        const dailyBudget = (prefs.monthly_income ?? 0) / daysInMonth
        let budgetStatus = 'aman'
        if (totalExpense > dailyBudget * 1.5) budgetStatus = 'bahaya'
        else if (totalExpense > dailyBudget) budgetStatus = 'waspada'

        const statusEmoji = { aman: '✅', waspada: '⚠️', bahaya: '🚨' }[budgetStatus]

        const langMap: Record<string, string> = {
          id: 'Bahasa Indonesia', en: 'English', my: 'Bahasa Melayu', zh: '中文',
        }
        const lang = langMap[prefs.language ?? 'id'] ?? 'Bahasa Indonesia'

        const prompt = `Kamu adalah asisten keuangan yang berperan sebagai ${prefs.persona ?? 'advisor'}.
Buat 1 kalimat motivasi singkat dalam ${lang} untuk ${prefs.nickname ?? 'pengguna'} berdasarkan ringkasan keuangan hari ini.
Status budget: ${budgetStatus}. ${budgetStatus === 'aman' ? 'Beri apresiasi.' : budgetStatus === 'waspada' ? 'Ingatkan dengan lembut.' : 'Beri dorongan untuk lebih hemat.'}
Tidak perlu menyebut angka. Hanya 1 kalimat. Langsung ke pesannya.`

        let motivasi = budgetStatus === 'aman'
          ? 'Keuangan hari ini terkontrol, pertahankan! 💪'
          : budgetStatus === 'waspada'
          ? 'Hati-hati ya, pengeluaran hari ini sedikit di atas rencana.'
          : 'Hari ini pengeluaran cukup besar — yuk mulai lebih bijak besok!'

        try {
          const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': CLAUDE_API_KEY,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6',
              max_tokens: 100,
              messages: [{ role: 'user', content: prompt }],
            }),
          })
          const aiData = await aiRes.json()
          if (aiData.content?.[0]?.text) motivasi = aiData.content[0].text
        } catch {
          // Pakai motivasi default jika AI gagal
        }

        const message = `${statusEmoji} ${txnCount} transaksi · Keluar Rp ${totalExpense.toLocaleString('id-ID')} · ${budgetStatus.charAt(0).toUpperCase() + budgetStatus.slice(1)}\n\n${motivasi}`

        await admin.from('notifications').insert({
          user_id: prefs.user_id,
          type: 'daily_summary',
          title: `📋 Ringkasan Hari Ini — ${today}`,
          message,
          metadata: { total_expense: totalExpense, total_income: totalIncome, txn_count: txnCount, budget_status: budgetStatus, daily_budget: dailyBudget },
        })

        await admin.from('agent_logs').insert({
          agent_name: 'daily-summary',
          user_id: prefs.user_id,
          action: 'generate_summary',
          result: `${txnCount} txn, status: ${budgetStatus}`,
        })

        processed++
      } catch {
        // Skip user yang gagal
      }
    }

    return new Response(JSON.stringify({ processed }), { headers: cors })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})
