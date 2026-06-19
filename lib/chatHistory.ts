import AsyncStorage from '@react-native-async-storage/async-storage'

// Persistensi history chat Zena AI.
// Reset otomatis setelah 24 jam (biar konteks "kemarin" gak kebawa selamanya,
// tapi keluar-masuk app dalam sehari TETAP nyambung).

export interface StoredMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatHistoryPayload {
  savedAt: number
  messages: StoredMessage[]
}

const TTL_MS = 24 * 60 * 60 * 1000 // 1 hari
const MAX_MESSAGES = 60 // batasi biar storage + konteks ke Claude gak bengkak

const keyFor = (userId: string) => `zena-chat-history:${userId}`

export async function loadChatHistory(userId: string): Promise<StoredMessage[] | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId))
    if (!raw) return null
    const payload = JSON.parse(raw) as ChatHistoryPayload
    if (!payload?.savedAt || !Array.isArray(payload.messages)) return null
    if (Date.now() - payload.savedAt > TTL_MS) {
      await AsyncStorage.removeItem(keyFor(userId))
      return null
    }
    return payload.messages.length > 0 ? payload.messages : null
  } catch {
    return null
  }
}

export async function saveChatHistory(userId: string, messages: StoredMessage[]): Promise<void> {
  try {
    const trimmed = messages.slice(-MAX_MESSAGES)
    const payload: ChatHistoryPayload = { savedAt: Date.now(), messages: trimmed }
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(payload))
  } catch {
    // abaikan — persistensi best-effort
  }
}

export async function clearChatHistory(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId))
  } catch {
    // abaikan
  }
}
