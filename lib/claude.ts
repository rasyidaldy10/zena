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
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': auth },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
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
