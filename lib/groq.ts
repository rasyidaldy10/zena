/**
 * Groq API Service
 * Used for: Voice Note transcription + parsing
 *
 * Hybrid AI Strategy:
 * - Groq: Voice transcription (fast, specialized)
 * - Claude: Chat, receipt scan, summaries (context-aware)
 */

import { supabase } from './supabase'

const GROQ_API_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions'
const GROQ_CHAT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

/**
 * Transcribe audio file menggunakan Groq Whisper
 * @param audioUri - URI file audio lokal
 * @returns Transcription text
 */
export async function transcribeAudio(audioUri: string): Promise<string> {
  try {
    // Get Groq API key dari Supabase Edge Function (secure)
    const { data, error } = await supabase.functions.invoke('groq-transcribe', {
      body: { audioUri }
    })

    if (error) throw error
    if (!data?.text) throw new Error('No transcription returned')

    return data.text
  } catch (err: any) {
    console.error('[Groq] Transcription error:', err)
    throw new Error(`Gagal transcribe audio: ${err.message}`)
  }
}

/**
 * Parse transaksi dari teks voice note
 * Contoh input: "Beli makan siang di warteg 25 ribu"
 * Output: { nominal: 25000, kategori: 'Makanan', catatan: 'Beli makan siang di warteg' }
 */
