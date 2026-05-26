import { supabase } from './supabase'

const PROXY_URL = 'https://lcvenmsxauasaemjjxtc.supabase.co/functions/v1/claude-proxy'

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
        model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  })
  const data = await response.json()
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
        model: 'claude-sonnet-4-5',
      max_tokens: 1000,
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
  const data = await response.json()
  return data.content[0].text
}