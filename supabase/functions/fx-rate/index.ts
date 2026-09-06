import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = (Deno.env.get('secretkeynew') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BCA_URL = 'https://www.bca.co.id/id/informasi/kurs'

// Kolom pada tabel kurs BCA, sesuai urutan di halaman.
const RATE_TYPES = ['erate', 'tt_counter', 'bank_notes'] as const
type RateType = typeof RATE_TYPES[number]

type Rate = {
  currency: string
  rate_type: RateType
  buy: number
  sell: number
  source: 'bca' | 'yahoo'
  source_time: string | null
}

// "13.804,43" (format Indonesia) -> 13804.43
function parseId(num: string): number {
  return Number(num.trim().replace(/\./g, '').replace(',', '.'))
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Ambil kurs dari halaman BCA. Angkanya server-rendered di dalam <table>,
 * jadi cukup fetch HTML — tidak butuh browser/JS.
 * Baris tabel: Mata Uang | e-Rate beli | e-Rate jual | TT beli | TT jual | Notes beli | Notes jual
 */
async function fetchBCA(): Promise<Rate[]> {
  const res = await fetch(BCA_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
      'Accept-Language': 'id-ID,id;q=0.9',
    },
  })
  if (!res.ok) throw new Error(`BCA HTTP ${res.status}`)
  const html = await res.text()

  // Stempel waktu e-Rate, mis. "e-Rate 05 Sep 2026 / 04.00 WIB"
  const stamp = html.match(/e-Rate\s*<[^>]*>?\s*([0-9]{1,2}\s+\w+\s+[0-9]{4}[^<]*WIB)/i)
    ?? stripTags(html).match(/e-Rate\s+([0-9]{1,2}\s+\w+\s+[0-9]{4}\s*\/\s*[0-9.]+\s*WIB)/i)
  const sourceTime = stamp ? stamp[1].trim() : null

  const rates: Rate[] = []
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []

  for (const row of rows) {
    const cells = (row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g) ?? [])
      .map(stripTags)
      .filter((c) => c !== '')
    if (cells.length < 7) continue

    const currency = cells[0].toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency)) continue

    RATE_TYPES.forEach((rt, i) => {
      const buy = parseId(cells[1 + i * 2])
      const sell = parseId(cells[2 + i * 2])
      // BCA menulis 0,00 untuk mata uang yang tidak dilayani (mis. Bank Notes DKK).
      if (!isFinite(buy) || !isFinite(sell) || buy <= 0 || sell <= 0) return
      // Bank selalu beli lebih murah daripada menjual. Kalau terbalik, berarti
      // kolomnya bergeser (struktur halaman berubah) — lebih baik dilewati
      // daripada menyimpan angka yang tampak masuk akal tapi salah.
      if (buy >= sell) return
      rates.push({ currency, rate_type: rt, buy, sell, source: 'bca', source_time: sourceTime })
    })
  }

  if (rates.length === 0) throw new Error('Tabel kurs BCA tidak terbaca (struktur halaman berubah?)')
  return rates
}

/**
 * Cadangan kalau struktur halaman BCA berubah. Yahoo hanya memberi kurs tengah
 * pasar, jadi spread bank tidak tercermin — kita tandai source='yahoo' supaya
 * UI bisa memberi tahu user bahwa angkanya bukan kurs BCA.
 */
async function fetchYahoo(currencies: string[]): Promise<Rate[]> {
  const out: Rate[] = []
  await Promise.all(
    currencies.map(async (cur) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${cur}IDR=X?interval=1d&range=1d`
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        if (!res.ok) return
        const data = await res.json()
        const mid = data?.chart?.result?.[0]?.meta?.regularMarketPrice
        if (typeof mid !== 'number' || !(mid > 0)) return
        out.push({ currency: cur, rate_type: 'erate', buy: mid, sell: mid, source: 'yahoo', source_time: null })
      } catch { /* biarkan kosong, mata uang lain tetap jalan */ }
    })
  )
  return out
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    })

  try {
    let currencies: string[] = ['USD', 'SGD', 'EUR']
    try {
      const body = await req.json()
      if (Array.isArray(body?.currencies) && body.currencies.length > 0) {
        currencies = body.currencies.map((c: string) => String(c).toUpperCase().trim()).slice(0, 20)
      }
    } catch { /* tanpa body = pakai default (dipanggil cron) */ }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    let rates: Rate[] = []
    let warning: string | null = null
    try {
      rates = await fetchBCA()
    } catch (err) {
      warning = `Kurs BCA gagal diambil (${String(err)}), pakai kurs pasar Yahoo.`
      rates = await fetchYahoo(currencies)
    }

    if (rates.length === 0) return json({ error: 'Semua sumber kurs gagal', warning }, 502)

    // Simpan snapshot hari ini. Tanggal pakai WIB supaya batas harinya sama
    // dengan jam rilis kurs BCA (04.00 WIB).
    const wib = new Date(Date.now() + 7 * 60 * 60 * 1000)
    const rateDate = wib.toISOString().slice(0, 10)

    const rowsToSave = rates.map((r) => ({ ...r, rate_date: rateDate }))
    const { error: saveErr } = await admin
      .from('fx_rates_daily')
      .upsert(rowsToSave, { onConflict: 'rate_date,currency,rate_type,source' })
    if (saveErr) warning = `${warning ?? ''} Gagal simpan snapshot: ${saveErr.message}`.trim()

    // Balikan untuk app: kurs terakhir + kurs hari sebelumnya (buat delta harian).
    const { data: latest } = await admin
      .from('fx_rates_latest')
      .select('*')
      .in('currency', currencies)
      .eq('rate_type', 'erate')

    return json({
      rates: latest ?? [],
      rate_date: rateDate,
      saved: rowsToSave.length,
      warning,
      updated_at: new Date().toISOString(),
    })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
