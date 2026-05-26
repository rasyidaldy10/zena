import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { Audio } from 'expo-av'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { claudeChat, claudeVision } from '../lib/claude'
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
    { role: 'assistant', content: 'Hei! Gue Zena, asisten keuangan lo. Mau ngomongin apa hari ini? 💙' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [persona] = useState<Persona>('bestie')
  const [language] = useState<Language>('id')
  const [recording, setRecording] = useState<Audio.Recording | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  const getPrefs = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user?.id)
      .single()
    return prefs
  }

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || loading) return
    const userMessage: Message = { role: 'user', content: messageText }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      const prefs = await getPrefs()
      const systemPrompt = getSystemPrompt(
        prefs?.persona || persona,
        prefs?.language || language,
        prefs?.nickname || 'Kamu',
        prefs?.monthly_income || 0
      )
      const response = await claudeChat(systemPrompt, newMessages)
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Maaf, gue lagi gangguan bentar. Coba lagi ya!' }])
    }
    setLoading(false)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }

  // ── SCAN STRUK ──
  const handleScanStruk = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!galleryPermission.granted) {
        Alert.alert('Izin diperlukan', 'Izin kamera atau galeri dibutuhkan.')
        return
      }
    }

    Alert.alert('Scan Struk', 'Pilih sumber gambar:', [
      {
        text: 'Kamera', onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({ quality: 0.8 })
          if (!result.canceled) await processStruk(result.assets[0].uri)
        }
      },
      {
        text: 'Galeri', onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 })
          if (!result.canceled) await processStruk(result.assets[0].uri)
        }
      },
      { text: 'Batal', style: 'cancel' }
    ])
  }

  const processStruk = async (uri: string) => {
    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', content: '📷 [Mengirim foto struk...]' }])
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
      const mimeType = uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
      const result = await claudeVision(base64, mimeType,
        `Kamu adalah asisten keuangan Zena. Analisis struk/nota ini dan:
1. Sebutkan nama toko dan tanggal (jika ada)
2. List item-item yang dibeli beserta harganya
3. Sebutkan total belanja
4. Berikan 1 komentar singkat tentang pengeluaran ini (friendly, bahasa gaul)
Format jawaban natural dan friendly, bukan JSON.`)
      setMessages(prev => [...prev, { role: 'assistant', content: result }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Maaf, gagal baca struk. Pastikan foto jelas ya!' }])
    }
    setLoading(false)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }

  // ── VOICE NOTE ──
  const handleVoiceNote = async () => {
    if (isRecording) {
      await stopRecording()
    } else {
      await startRecording()
    }
  }

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Izin diperlukan', 'Izin mikrofon dibutuhkan.')
        return
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
      setRecording(rec)
      setIsRecording(true)
    } catch {
      Alert.alert('Error', 'Gagal memulai rekaman.')
    }
  }

  const stopRecording = async () => {
    if (!recording) return
    setIsRecording(false)
    setLoading(true)
    try {
      await recording.stopAndUnloadAsync()
      setRecording(null)
      // Tanpa Whisper, minta user ketik manual
      setLoading(false)
      Alert.alert(
        '🎤 Voice Note',
        'Rekaman selesai! Ketik transaksinya di chat ya (contoh: "beli nasi 15 ribu")',
        [{ text: 'OK' }]
      )
    } catch {
      setLoading(false)
      Alert.alert('Error', 'Gagal memproses rekaman.')
    }
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
          <View key={i} style={[styles.msgRow, msg.role === 'user' && styles.msgRowUser]}>
            {msg.role === 'assistant' && (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>Z</Text>
              </View>
            )}
            <View style={[styles.bubble, msg.role === 'user' ? styles.bubbleUser : styles.bubbleAI]}>
              <Text style={[styles.bubbleText, msg.role === 'user' && styles.bubbleTextUser]}>
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
          <TouchableOpacity key={reply} style={styles.quickBtn} onPress={() => sendMessage(reply)}>
            <Text style={styles.quickText}>{reply}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputWrap}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleScanStruk}>
          <Text style={styles.iconBtnText}>📷</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, isRecording && styles.iconBtnRecording]}
          onPress={handleVoiceNote}
        >
          <Text style={styles.iconBtnText}>{isRecording ? '⏹' : '🎤'}</Text>
        </TouchableOpacity>
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
    paddingHorizontal: 12, paddingVertical: 12,
    borderTopWidth: 0.5, borderTopColor: '#2A2A2A',
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  iconBtnRecording: { backgroundColor: '#E24B4A' },
  iconBtnText: { fontSize: 16 },
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