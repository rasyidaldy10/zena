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

// Parse email bank format (BCA, Mandiri, dll.)
function parseEmailBody(body: string, sender: string): { amount: number; merchant: string; type: 'income' | 'expense' } | null {
  // BCA format: "Trx: ... Rp 50.000"
  // Mandiri format: "Mutasi Debit/Kredit: Rp 100.000"

  const amountMatch = body.match(/Rp\s?([\d.,]+)/i)
  if (!amountMatch) return null

  const amount = parseFloat(amountMatch[1].replace(/\.|,/g, ''))
  if (isNaN(amount)) return null

  // Detect debit vs kredit
  const isDebit = /debit|keluar|pembayaran|pembelian|tarik tunai/i.test(body)
  const isKredit = /kredit|masuk|terima|transfer masuk/i.test(body)

  const type: 'income' | 'expense' = isKredit ? 'income' : 'expense'

  // Extract merchant
  const merchantMatch = body.match(/(?:di|at|ke|dari)\s+([A-Z\s]+)/i)
  const merchant = merchantMatch ? merchantMatch[1].trim() : 'Transaksi Bank'

  return { amount, merchant, type }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Fetch semua user yang punya Gmail mapping
    const { data: mappings } = await admin
      .from('gmail_wallet_mappings')
      .select('user_id, wallet_id, sender_email, bank_name')

    if (!mappings || mappings.length === 0) {
      await admin.from('agent_logs').insert({
        agent_name: 'gmail-parser',
        user_id: null,
        action: 'cron_run',
        result: 'No user mappings found',
      })
      return new Response(JSON.stringify({ status: 'no_mappings' }), { headers: cors })
    }

    let parsed = 0
    let failed = 0

    // Loop setiap user mapping
    for (const mapping of mappings) {
      try {
        // TODO: Fetch Gmail API untuk user ini
        // const gmail = await fetchGmailAPI(mapping.user_id, mapping.sender_email)

        // SIMULATION: untuk testing tanpa Gmail API
        const simulatedEmail = {
          from: mapping.sender_email,
          body: `Transaksi di INDOMARET Rp 50.000 - Debit`,
        }

        const parsed_data = parseEmailBody(simulatedEmail.body, simulatedEmail.from)
        if (!parsed_data) {
          failed++
          continue
        }

        // Insert transaksi ke wallet yang dimapping
        const { error } = await admin.from('transactions').insert({
          user_id: mapping.user_id,
          wallet_id: mapping.wallet_id,
          type: parsed_data.type,
          amount: parsed_data.amount,
          category: parsed_data.type === 'expense' ? 'Belanja' : 'Pemasukan',
          note: `Auto-import dari ${mapping.bank_name}: ${parsed_data.merchant}`,
          date: new Date().toISOString().split('T')[0],
          source: 'gmail',
          is_wallet_transfer: false,
        })

        if (error) {
          failed++
          continue
        }

        // Update wallet balance
        await admin.rpc('update_wallet_balance', {
          p_wallet_id: mapping.wallet_id,
          p_amount: parsed_data.type === 'income' ? parsed_data.amount : -parsed_data.amount,
        })

        // Kirim notif ke user
        await admin.from('notifications').insert({
          user_id: mapping.user_id,
          type: 'gmail',
          title: `📧 Transaksi dari ${mapping.bank_name}`,
          message: `${parsed_data.merchant}: Rp ${parsed_data.amount.toLocaleString('id-ID')} dicatat otomatis.`,
          metadata: { source: 'gmail', bank: mapping.bank_name },
        })

        parsed++
      } catch (err) {
        failed++
        console.error(`Failed to parse email for user ${mapping.user_id}:`, err)
      }
    }

    await admin.from('agent_logs').insert({
      agent_name: 'gmail-parser',
      user_id: null,
      action: 'cron_run',
      result: `Parsed: ${parsed}, Failed: ${failed}`,
    })

    return new Response(JSON.stringify({ status: 'success', parsed, failed }), { headers: cors })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})
