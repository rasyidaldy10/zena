// Groq Parse Transaction Edge Function
// Parse transcription jadi structured transaction data

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `Kamu adalah AI parser untuk aplikasi finance Zena.
Extract informasi transaksi dari teks voice note bahasa Indonesia.

Output format (JSON):
{
  "nominal": number (dalam rupiah, tanpa titik/koma),
  "kategori": string (Makanan | Transport | Belanja | Tagihan | Hiburan | Kesehatan | Pendidikan | Lainnya),
  "tipe": "income" | "expense",
  "catatan": string (deskripsi transaksi, clean & concise)
}

Rules:
1. Nominal: convert "25 ribu" → 25000, "2 juta" → 2000000, "500rb" → 500000
2. Kategori: pilih yang paling cocok dari list di atas
3. Tipe: default "expense" kecuali ada kata "terima", "gaji", "bonus", "income"
4. Catatan: clean version dari input (hapus nominal jika sudah di-extract)

Contoh:
Input: "Beli makan siang di warteg 25 ribu"
Output: {"nominal": 25000, "kategori": "Makanan", "tipe": "expense", "catatan": "Beli makan siang di warteg"}

Input: "Gojek ke kantor 15000"
Output: {"nominal": 15000, "kategori": "Transport", "tipe": "expense", "catatan": "Gojek ke kantor"}

Input: "Terima gaji bulanan 5 juta"
Output: {"nominal": 5000000, "kategori": "Lainnya", "tipe": "income", "catatan": "Gaji bulanan"}`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text } = await req.json()

    if (!text) {
      throw new Error('text required')
    }

    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not configured')
    }

    // Call Groq LLM untuk parsing
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mixtral-8x7b-32768', // Fast & accurate
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text }
        ],
        temperature: 0.3, // Low temp untuk consistency
        max_tokens: 200,
        response_format: { type: 'json_object' } // Force JSON output
      }),
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      throw new Error(`Groq API error: ${groqResponse.status} - ${errorText}`)
    }

    const result = await groqResponse.json()
    const parsed = JSON.parse(result.choices[0].message.content)

    // Validate output
    const output = {
      nominal: typeof parsed.nominal === 'number' ? parsed.nominal : null,
      kategori: parsed.kategori || 'Lainnya',
      tipe: parsed.tipe === 'income' ? 'income' : 'expense',
      catatan: parsed.catatan || text
    }

    return new Response(
      JSON.stringify(output),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Parse error:', error)

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
