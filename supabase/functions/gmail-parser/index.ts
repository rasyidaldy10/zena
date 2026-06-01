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

// ── PLACEHOLDER ──
// Fungsi ini akan aktif setelah Google OAuth dengan scope gmail.readonly diaktifkan.
// Saat ini hanya menyimpan log dan notifikasi demo.

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const body = await req.json().catch(() => ({}))

    await admin.from('agent_logs').insert({
      agent_name: 'gmail-parser',
      user_id: user.id,
      action: 'parse_attempt',
      result: 'placeholder — awaiting Google OAuth gmail.readonly scope',
    })

    // Jika dipanggil dengan data email simulasi (untuk testing)
    if (body.simulate === 'success') {
      const merchant = body.merchant ?? 'Merchant Tidak Dikenal'
      const amount = body.amount ?? 0

      await admin.from('notifications').insert({
        user_id: user.id,
        type: 'gmail',
        title: '📧 Transaksi Terdeteksi dari Email',
        message: `Transaksi baru dari email: ${merchant} Rp ${amount.toLocaleString('id-ID')}. Sudah dicatat otomatis.`,
        metadata: { merchant, amount, source: 'gmail' },
      })
      return new Response(JSON.stringify({ status: 'simulated_success', merchant, amount }), { headers: cors })
    }

    if (body.simulate === 'fail') {
      await admin.from('notifications').insert({
        user_id: user.id,
        type: 'gmail',
        title: '📧 Email Bank Tidak Terbaca',
        message: 'Ada email bank baru tapi gagal dibaca. Cek manual ya?',
        metadata: { source: 'gmail', error: 'parse_failed' },
      })
      return new Response(JSON.stringify({ status: 'simulated_fail' }), { headers: cors })
    }

    return new Response(JSON.stringify({
      status: 'placeholder',
      message: 'Gmail Parser belum aktif. Aktifkan Google OAuth dengan scope gmail.readonly untuk mulai parse otomatis.',
    }), { headers: cors })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})
