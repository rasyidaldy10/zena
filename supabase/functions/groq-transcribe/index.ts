// Groq Transcribe Edge Function
// Transcribe audio menggunakan Groq Whisper API

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { audioUri } = await req.json()

    if (!audioUri) {
      throw new Error('audioUri required')
    }

    // Get Groq API key dari Supabase secrets
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not configured')
    }

    // Read audio file dari URI (Expo FileSystem or base64)
    // For now, assume audioUri is accessible URL or base64
    let audioBlob: Blob

    // Format audio BEDA per platform: browser merekam webm/opus, HP merekam
    // m4a. Dulu semuanya dilabeli m4a — decoder Whisper dikasih petunjuk
    // format yang salah, dan itu ikut menurunkan akurasi di web.
    let mime = 'audio/m4a'

    if (audioUri.startsWith('data:')) {
      // Base64 data URL: "data:<mime>;base64,<data>"
      const header = audioUri.slice(5, audioUri.indexOf(';'))
      if (header.startsWith('audio/')) mime = header
      const base64Data = audioUri.split(',')[1]
      const binaryData = atob(base64Data)
      const uint8Array = new Uint8Array(binaryData.length)
      for (let i = 0; i < binaryData.length; i++) {
        uint8Array[i] = binaryData.charCodeAt(i)
      }
      audioBlob = new Blob([uint8Array], { type: mime })
    } else if (audioUri.startsWith('http')) {
      // HTTP URL
      const response = await fetch(audioUri)
      audioBlob = await response.blob()
    } else {
      throw new Error('Invalid audioUri format. Use base64 data URL or HTTP URL')
    }

    // Ekstensi nama file ikut mime — Whisper memakainya sebagai petunjuk container.
    const ext = mime.includes('webm') ? 'webm'
      : mime.includes('ogg') ? 'ogg'
      : mime.includes('wav') ? 'wav'
      : mime.includes('mp3') || mime.includes('mpeg') ? 'mp3'
      : 'm4a'

    // Call Groq Whisper API
    const formData = new FormData()
    formData.append('file', audioBlob, `audio.${ext}`)
    formData.append('model', 'whisper-large-v3')
    formData.append('language', 'id') // Indonesian
    formData.append('response_format', 'json')
    // Hasil deterministik — tanpa ini Whisper kadang "mengarang" di bagian
    // yang kurang jelas terdengar.
    formData.append('temperature', '0')
    // Kamus istilah: contoh kalimat bergaya catatan keuangan lisan. Whisper
    // memakainya untuk membiaskan pengenalan ke kosakata & pola angka Indonesia
    // (mis. "seratus lima puluh ribu"), bukan ke kata yang mirip bunyinya.
    formData.append('prompt',
      'Catatan keuangan harian dalam bahasa Indonesia. Bensin seratus lima puluh ribu, ' +
      'makan siang empat puluh lima ribu, parkir lima ribu, tol dua puluh ribu, ' +
      'transfer ke BCA dua juta, bayar listrik tiga ratus ribu, belanja sayur dua puluh ribu, ' +
      'gaji masuk delapan juta lima ratus, pulsa lima puluh ribu, kopi dua puluh lima ribu, ' +
      'Gojek, Grab, Shopee, Tokopedia, Indomaret, Alfamart, Mandiri, BCA, GoPay, OVO, Dana, ' +
      'sejuta, dua juta setengah, tiga ratus ribu, lima puluh ribu, seratus ribu.'
    )

    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: formData,
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      throw new Error(`Groq API error: ${groqResponse.status} - ${errorText}`)
    }

    const result = await groqResponse.json()

    return new Response(
      JSON.stringify({ text: result.text }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
