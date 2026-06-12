import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Ambil harga saham IDX dari Yahoo Finance. Symbol IDX butuh suffix .JK
// (mis. BBRI -> BBRI.JK). IHSG = ^JKSE.
async function fetchPrice(symbol: string): Promise<number | null> {
  const isIndex = symbol.startsWith('^')
  const yfSymbol = isIndex ? symbol : `${symbol}.JK`
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSymbol)}?interval=1d&range=1d`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) return null
    const data = await res.json()
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
    return typeof price === 'number' ? price : null
  } catch {
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { symbols } = await req.json()
    if (!Array.isArray(symbols)) {
      return new Response(JSON.stringify({ error: 'symbols harus array' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    // Ambil semua harga paralel
    const entries = await Promise.all(
      symbols.slice(0, 50).map(async (s: string) => {
        const price = await fetchPrice(String(s).toUpperCase().trim())
        return [String(s).toUpperCase().trim(), price] as const
      })
    )

    const prices: Record<string, number | null> = {}
    for (const [sym, price] of entries) prices[sym] = price

    return new Response(JSON.stringify({ prices, updated_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
