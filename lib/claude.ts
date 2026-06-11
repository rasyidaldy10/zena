import { supabase } from './supabase'

const PROXY_URL = 'https://lcvenmsxauasaemjjxtc.supabase.co/functions/v1/claude-proxy'
const MODEL = 'claude-sonnet-4-6'

const getAuthHeader = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session ? `Bearer ${session.access_token}` : ''
}

export const claudeChat = async (
  systemPrompt: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> => {
  const auth = await getAuthHeader()

  // SPEED OPTIMIZATION: Reduce max_tokens for faster response
  // Simple queries need ~300 tokens, complex ~800
  const lastUserMsg = messages[messages.length - 1]?.content || ''
  const isSimpleQuery = lastUserMsg.length < 50
  const maxTokens = isSimpleQuery ? 300 : 600 // Was: 1024

  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': auth },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
      // CATATAN: anthropic_version DIHAPUS dari body — itu header, bukan field
      // body. Kalau dikirim di body, Anthropic nolak 400 "Extra inputs not
      // permitted" -> AI selalu gagal. Edge function sudah set header-nya.
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`HTTP ${response.status}: ${errText}`)
  }

  const data = await response.json()

  if (data.type === 'error' || data.error) {
    throw new Error(data.error?.message || 'API error')
  }

  if (!data.content || !data.content[0]?.text) {
    throw new Error('Respons AI tidak valid')
  }

  return data.content[0].text
}

export const claudeVision = async (
  imageBase64: string,
  mediaType: string,
  prompt: string
): Promise<string> => {
  const auth = await getAuthHeader()
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': auth },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`HTTP ${response.status}: ${errText}`)
  }

  const data = await response.json()

  if (data.type === 'error' || data.error) {
    throw new Error(data.error?.message || 'API error')
  }

  if (!data.content || !data.content[0]?.text) {
    throw new Error('Respons AI tidak valid')
  }

  return data.content[0].text
}
