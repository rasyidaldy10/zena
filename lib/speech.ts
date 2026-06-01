import { Platform } from 'react-native'
import type { Persona } from '../types'

const PERSONA_PITCH: Record<Persona, number> = {
  bestie: 1.1,
  advisor: 0.85,
  kakak: 1.0,
  adek: 1.15,
  pacar: 1.05,
  stoic: 0.8,
}

const PERSONA_RATE: Record<Persona, number> = {
  bestie: 1.0,
  advisor: 0.85,
  kakak: 0.9,
  adek: 1.05,
  pacar: 0.92,
  stoic: 0.78,
}

const cleanText = (text: string): string =>
  text
    // Hapus emoji lengkap: emoticons, symbols, flags, ZWJ sequences
    .replace(/[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#+\s/g, '')
    .trim()

export const speak = (text: string, persona: Persona = 'bestie', lang = 'id-ID'): void => {
  if (Platform.OS !== 'web') return
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(cleanText(text))
  utterance.rate = PERSONA_RATE[persona]
  utterance.pitch = PERSONA_PITCH[persona]
  utterance.lang = lang
  window.speechSynthesis.speak(utterance)
}

export const stopSpeaking = (): void => {
  if (Platform.OS !== 'web') return
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
}

export const isSpeaking = (): boolean => {
  if (Platform.OS !== 'web') return false
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
  return window.speechSynthesis.speaking
}
