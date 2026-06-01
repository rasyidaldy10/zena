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
function parseEmailBody(body: string, sender: string): {
  amount: number;
  merchant: string;
  type: 'income' | 'expense';
  bankName: string;
  last4Digits: string;
} | null {
  // Extract amount
  const amountMatch = body.match(/Rp\s?([\d.,]+)/i)
  if (!amountMatch) return null

  const amount = parseFloat(amountMatch[1].replace(/\.|,/g, ''))
  if (isNaN(amount)) return null

  // Detect bank name dari sender email
  let bankName = 'Unknown'
  if (sender.includes('bca.co.id')) bankName = 'BCA'
  else if (sender.includes('bankmandiri')) bankName = 'Mandiri'
  else if (sender.includes('bri.co.id')) bankName = 'BRI'
  else if (sender.includes('bni.co.id')) bankName = 'BNI'
  else if (sender.includes('cimbniaga')) bankName = 'CIMB Niaga'

  // Extract 4 digit terakhir rekening dari email body
  // Format: "Rek: 1234567890" atau "No.Rek: xxx-xxx-1234" atau "a/n 1234"
  const rekMatch = body.match(/(?:rek(?:ening)?[:\s]*.*?|a\/n[:\s]*)(\d{4})(?:\D|$)/i)
  const last4Digits = rekMatch ? rekMatch[1] : '0000'

  // Detect debit vs kredit
  const isDebit = /debit|keluar|pembayaran|pembelian|tarik tunai/i.test(body)
  const isKredit = /kredit|masuk|terima|transfer masuk/i.test(body)

  const type: 'income' | 'expense' = isKredit ? 'income' : 'expense'

  // Extract merchant
  const merchantMatch = body.match(/(?:di|at|ke|dari)\s+([A-Z\s]+)/i)
  const merchant = merchantMatch ? merchantMatch[1].trim() : 'Transaksi Bank'

  return { amount, merchant, type, bankName, last4Digits }
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

    // Group users yang punya mapping
    const uniqueUsers = [...new Set(mappings.map(m => m.user_id))]

    // Loop per user
    for (const userId of uniqueUsers) {
      try {
        // TODO: Fetch Gmail API untuk user ini
        // const emails = await fetchGmailAPI(userId)

        // SIMULATION: untuk testing tanpa Gmail API
        const simulatedEmails = [
          { from: 'noreply@bca.co.id', body: 'Debit Rek 1234567890 di INDOMARET Rp 50.000' },
        ]

        for (const email of simulatedEmails) {
          const parsed = parseEmailBody(email.body, email.from)
          if (!parsed) continue

          // Cari mapping yang cocok: bank + 4 digit
          const matchKey = `${email.from}:${parsed.last4Digits}`
          const mapping = mappings.find(m => m.user_id === userId && m.sender_email === matchKey)

          if (!mapping) {
            // Tidak ada mapping → kirim notif minta setup
            await admin.from('notifications').insert({
              user_id: userId,
              type: 'gmail',
              title: `📧 Email Bank Terdeteksi`,
              message: `Transaksi ${parsed.bankName} (...${parsed.last4Digits}) Rp ${parsed.amount.toLocaleString('id-ID')} belum ter-mapping. Setup di Gmail Auto-Import.`,
              metadata: { bank: parsed.bankName, last4: parsed.last4Digits },
            })
            continue
          }

          // Insert transaksi
          const { error } = await admin.from('transactions').insert({
            user_id: userId,
            wallet_id: mapping.wallet_id,
            type: parsed.type,
            amount: parsed.amount,
            category: parsed.type === 'expense' ? 'Belanja' : 'Pemasukan',
            note: `📧 ${parsed.merchant}`,
            date: new Date().toISOString().split('T')[0],
            source: 'gmail',
            is_wallet_transfer: false,
          })

          if (error) {
            failed++
            continue
          }

          // Update wallet balance
          const { data: wallet } = await admin.from('user_wallets').select('current_balance').eq('id', mapping.wallet_id).single()
          if (wallet) {
            const newBalance = wallet.current_balance + (parsed.type === 'income' ? parsed.amount : -parsed.amount)
            await admin.from('user_wallets').update({ current_balance: newBalance }).eq('id', mapping.wallet_id)
          }

          // Kirim notif sukses
          await admin.from('notifications').insert({
            user_id: userId,
            type: 'gmail',
            title: `📧 ${parsed.bankName} (...${parsed.last4Digits})`,
            message: `${parsed.merchant}: Rp ${parsed.amount.toLocaleString('id-ID')} dicatat otomatis.`,
            metadata: { source: 'gmail', bank: parsed.bankName },
          })

          parsed++
        }
      } catch (err) {
        failed++
        console.error(`Failed for user ${userId}:`, err)
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
