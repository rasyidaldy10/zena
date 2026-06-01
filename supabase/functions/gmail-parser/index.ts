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

    // Fetch semua wallet yang punya bank_name + last_4_digits
    const { data: wallets } = await admin
      .from('user_wallets')
      .select('id, user_id, wallet_name, bank_name, last_4_digits')
      .not('bank_name', 'is', null)
      .not('last_4_digits', 'is', null)
      .eq('is_active', true)

    if (!wallets || wallets.length === 0) {
      await admin.from('agent_logs').insert({
        agent_name: 'gmail-parser',
        user_id: null,
        action: 'cron_run',
        result: 'No wallets with bank info found',
      })
      return new Response(JSON.stringify({ status: 'no_wallets' }), { headers: cors })
    }

    let parsed = 0
    let failed = 0

    // Group users
    const uniqueUsers = [...new Set(wallets.map(w => w.user_id))]

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
          const parsedEmail = parseEmailBody(email.body, email.from)
          if (!parsedEmail) continue

          // Cari wallet yang cocok: bank name + 4 digit terakhir
          const matchedWallet = wallets.find(w =>
            w.user_id === userId &&
            w.bank_name?.toLowerCase().includes(parsedEmail.bankName.toLowerCase()) &&
            w.last_4_digits === parsedEmail.last4Digits
          )

          if (!matchedWallet) {
            // Tidak ada wallet yang match → kirim notif setup
            await admin.from('notifications').insert({
              user_id: userId,
              type: 'gmail',
              title: `📧 Email Bank Terdeteksi`,
              message: `Transaksi ${parsedEmail.bankName} (...${parsedEmail.last4Digits}) Rp ${parsedEmail.amount.toLocaleString('id-ID')}. Tambahkan data bank di dompet untuk auto-import.`,
              metadata: { bank: parsedEmail.bankName, last4: parsedEmail.last4Digits },
            })
            continue
          }

          // Insert transaksi
          const { error } = await admin.from('transactions').insert({
            user_id: userId,
            wallet_id: matchedWallet.id,
            type: parsedEmail.type,
            amount: parsedEmail.amount,
            category: parsedEmail.type === 'expense' ? 'Belanja' : 'Pemasukan',
            note: `📧 ${parsedEmail.merchant}`,
            date: new Date().toISOString().split('T')[0],
            source: 'gmail',
            is_wallet_transfer: false,
          })

          if (error) {
            failed++
            continue
          }

          // Update wallet balance
          const { data: wallet } = await admin.from('user_wallets').select('current_balance').eq('id', matchedWallet.id).single()
          if (wallet) {
            const newBalance = wallet.current_balance + (parsedEmail.type === 'income' ? parsedEmail.amount : -parsedEmail.amount)
            await admin.from('user_wallets').update({ current_balance: newBalance }).eq('id', matchedWallet.id)
          }

          // Kirim notif sukses
          await admin.from('notifications').insert({
            user_id: userId,
            type: 'gmail',
            title: `📧 ${parsedEmail.bankName} → ${matchedWallet.wallet_name}`,
            message: `${parsedEmail.merchant}: Rp ${parsedEmail.amount.toLocaleString('id-ID')} dicatat otomatis.`,
            metadata: { source: 'gmail', bank: parsedEmail.bankName, wallet: matchedWallet.wallet_name },
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
