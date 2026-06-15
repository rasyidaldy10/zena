import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_KEY = (Deno.env.get('secretkeynew') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!

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

    const { amount, type } = await req.json()
    if (type !== 'expense') {
      return new Response(JSON.stringify({ skipped: true }), { headers: cors })
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: prefs } = await admin
      .from('user_preferences')
      .select('monthly_income, budget_method')
      .eq('user_id', user.id)
      .single()

    if (!prefs?.monthly_income) {
      return new Response(JSON.stringify({ skipped: 'no income' }), { headers: cors })
    }

    const month = new Date().toISOString().slice(0, 7)
    const { data: expenses } = await admin
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .eq('is_wallet_transfer', false)
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`)

    const totalExpense = (expenses ?? []).reduce((s: number, t: { amount: number }) => s + t.amount, 0)

    let budget = prefs.monthly_income
    const m = prefs.budget_method
    if (m === '503020') budget = prefs.monthly_income * 0.8
    else if (m === '703010') budget = prefs.monthly_income * 0.9
    else if (m === 'payfirst') budget = prefs.monthly_income * 0.75
    else if (m === 'zero' || m === 'envelope') budget = prefs.monthly_income * 0.9

    const pct = Math.round((totalExpense / budget) * 100)

    let title = '', message = ''
    if (pct >= 100) {
      title = '🚨 Budget Habis!'
      message = `Pengeluaran bulan ini sudah ${pct}% dari budget (Rp ${totalExpense.toLocaleString('id-ID')} / Rp ${budget.toLocaleString('id-ID')})`
    } else if (pct >= 90) {
      title = '⚠️ Budget Hampir Habis'
      message = `Pengeluaran sudah ${pct}% dari budget. Sisa Rp ${(budget - totalExpense).toLocaleString('id-ID')}`
    } else if (pct >= 75) {
      title = '💡 Perhatian Budget'
      message = `Pengeluaran sudah ${pct}% dari budget bulan ini`
    }

    const shouldNotify = pct >= 75

    await admin.from('agent_logs').insert({
      agent_name: 'budget-monitor',
      user_id: user.id,
      action: 'check_budget',
      result: `${pct}% budget used${shouldNotify ? ' — notified' : ''}`,
    })

    if (shouldNotify) {
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString()
      const { data: recent } = await admin
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'budget_alert')
        .gte('created_at', oneHourAgo)
        .limit(1)

      if (!recent?.length) {
        await admin.from('notifications').insert({
          user_id: user.id,
          type: 'budget_alert',
          title,
          message,
          metadata: { pct, total_expense: totalExpense, budget },
        })
      }
    }

    return new Response(JSON.stringify({ pct, notified: shouldNotify }), { headers: cors })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})
