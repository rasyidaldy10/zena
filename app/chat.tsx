import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { claudeChat } from '../lib/claude'
import { getSystemPrompt } from '../lib/personas'
import { Persona, Language } from '../types'

const PRIMARY = '#185FA5'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_REPLIES = [
  'Rekap pengeluaran hari ini',
  'Budget bulan ini gimana?',
  'Tips hemat minggu ini',
  'Analisis spending ku',
]

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hei! Gue Zena, asisten keuangan lo. Mau ngomongin apa hari ini? 💙'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [persona] = useState<Persona>('bestie')
  const [language] = useState<Language>('id')
  const scrollRef = useRef<ScrollView>(null)

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || loading) return

    const userMessage: Message = { role: 'user', content: messageText }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user?.id)
        .single()

      const systemPrompt = getSystemPrompt(
        prefs?.persona || persona,
        prefs?.language || language,
        prefs?.nickname || 'Kamu',
        prefs?.monthly_income || 0
      )

      const response = await claudeChat(systemPrompt, newMessages)
      
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Maaf, gue lagi gangguan bentar. Coba lagi ya!'
      }])
    }

    setLoading(false)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Kembali</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Zena AI</Text>
          <Text style={styles.headerSub}>Si Bestie • Online</Text>
        </View>
        <View style={{ width: 80 }} />
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 16 }}
      >
        {messages.map((msg, i) => (
          <View
            key={i}
            style={[styles.msgRow, msg.role === 'user' && styles.msgRowUser]}
          >
            {msg.role === 'assistant' && (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>Z</Text>
              </View>
            )}
            <View style={[
              styles.bubble,
              msg.role === 'user' ? styles.bubbleUser : styles.bubbleAI
            ]}>
              <Text style={[
                styles.bubbleText,
                msg.role === 'user' && styles.bubbleTextUser
              ]}>
                {msg.content}
              </Text>
            </View>
          </View>
        ))}

        {loading && (
          <View style={styles.msgRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>Z</Text>
            </View>
            <View style={styles.bubbleAI}>
              <ActivityIndicator size="small" color={PRIMARY} />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Quick Replies */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickScroll}
        contentContainerStyle={styles.quickContent}
      >
        {QUICK_REPLIES.map((reply) => (
          <TouchableOpacity
            key={reply}
            style={styles.quickBtn}
            onPress={() => sendMessage(reply)}
          >
            <Text style={styles.quickText}>{reply}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder="Ketik pesan..."
          placeholderTextColor="#888780"
          value={input}
          onChangeText={setInput}
          multiline
          onSubmitEditing={() => sendMessage()}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => sendMessage()}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendIcon}>↑</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 0.5, borderBottomColor: '#2A2A2A',
  },
  backBtn: { width: 80 },
  backText: { fontSize: 14, color: PRIMARY },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  headerSub: { fontSize: 11, color: PRIMARY, marginTop: 2 },
  messages: { flex: 1, paddingHorizontal: 16 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 12 },
  msgRowUser: { flexDirection: 'row-reverse' },
  avatar: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 12 },
  bubbleAI: {
    backgroundColor: '#1A1A1A', borderRadius: 16, padding: 12,
    maxWidth: '75%', borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  bubbleUser: { backgroundColor: PRIMARY },
  bubbleText: { fontSize: 14, color: '#fff', lineHeight: 20 },
  bubbleTextUser: { color: '#fff' },
  quickScroll: { maxHeight: 44, borderTopWidth: 0.5, borderTopColor: '#1A1A1A' },
  quickContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  quickBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#1A1A1A', borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  quickText: { fontSize: 12, color: '#888780' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 0.5, borderTopColor: '#2A2A2A',
  },
  input: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 20, paddingHorizontal: 16,
    paddingVertical: 10, fontSize: 14, color: '#fff', maxHeight: 100,
    borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#2A2A2A' },
  sendIcon: { fontSize: 16, color: '#fff', fontWeight: '700' },
})