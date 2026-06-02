import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
// import { Audio } from 'expo-av' // TODO: Replace with expo-audio when implementing voice
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { claudeChat, claudeVision } from '../lib/claude'
import { getContextualSystemPrompt } from '../lib/personas'
import { speak, stopSpeaking } from '../lib/speech'
import { Persona, Language, BudgetMethod, Transaction } from '../types'

const PRIMARY = '#185FA5'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_REPLIES = [
  'Rekap pengeluaran bulan ini',
  'Budget aku gimana?',
  'Prediksi akhir bulan',
  'Analisis pola belanjaku',
  'Tips hemat bulan ini',
  'Kategori terboros aku apa?',
]

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initLoading, setInitLoading] = useState(true)
  const [persona, setPersona] = useState<Persona>('bestie')
  const [language, setLanguage] = useState<Language>('id')
  const [nickname, setNickname] = useState('Kamu')
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [budgetMethod, setBudgetMethod] = useState<BudgetMethod>('503020')
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  // const [recording, setRecording] = useState<Audio.Recording | null>(null)
  // const [isRecording, setIsRecording] = useState(false)
  // const [voiceEnabled, setVoiceEnabled] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    initChat()
  }, [])

  const initChat = async () => {
    const prefs = await loadPrefs()
    const txns = await loadTransactions()

    const welcomes: Record<Persona, string> = {
      bestie: 'Hei! Gue Zena — asisten keuangan lo yang paling ngerti lo 😎 Mau ngomongin apa?',
      advisor: 'Selamat datang. Saya siap membantu menganalisis kondisi keuangan Anda.',
      kakak: 'Halo dek! Kak Zena siap bantu yaa. Ada yang mau diceritain soal keuangan? 🧡',
      adek: 'Hiii Kak! Dek Zena seneng bisa bantu! Mau ngobrol apa hari ini? 🎉',
      pacar: 'Hei Sayang~ Aku di sini kok. Mau cerita soal keuangan? ♡',
      stoic: 'Apa yang ingin kamu ketahui tentang kondisi keuanganmu?',
    }

    const p = prefs?.persona || 'bestie'
    const income = prefs?.monthly_income || 0

    let welcome = welcomes[p as Persona] || welcomes.bestie

    if (income > 0 && txns.length > 0) {
      const currentMonth = new Date().toISOString().slice(0, 7)
      const thisMonthTxns = txns.filter(t => !t.is_wallet_transfer && t.date?.startsWith(currentMonth))
      const totalExp = thisMonthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

      if (totalExp > 0) {
        const pct = Math.round((totalExp / income) * 100)
        const emoji = pct > 80 ? '🔴' : pct > 60 ? '🟡' : '🟢'
        welcome += `\n\nFYI, bulan ini kamu udah keluar Rp ${totalExp.toLocaleString('id-ID')} (${pct}% dari penghasilan) ${emoji}`
      }
    }

    setMessages([{ role: 'assistant', content: welcome }])
    setInitLoading(false)
  }

  const loadPrefs = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/(auth)/login')
      return null
    }

    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (prefs?.persona) setPersona(prefs.persona)
    if (prefs?.language) setLanguage(prefs.language)
    if (prefs?.nickname) setNickname(prefs.nickname)
    if (prefs?.monthly_income) setMonthlyIncome(prefs.monthly_income)
    if (prefs?.budget_method) setBudgetMethod(prefs.budget_method)
    return prefs
  }

  const loadTransactions = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', threeMonthsAgo.toISOString().split('T')[0])
      .order('date', { ascending: false })
      .limit(100)

    const txns = (data || []) as Transaction[]
    setRecentTransactions(txns)
    return txns
  }

  const buildSystemPrompt = () => {
    return getContextualSystemPrompt(
      persona, language, nickname, monthlyIncome, recentTransactions, budgetMethod
    )
  }

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || loading) return
    const userMessage: Message = { role: 'user', content: messageText }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)

    try {
      const systemPrompt = buildSystemPrompt()
      const response = await claudeChat(systemPrompt, newMessages)
      setMessages(prev => [...prev, { role: 'assistant', content: response }])
      // Voice output disabled - TODO: Implement with expo-audio
      // if (voiceEnabled) speak(response, persona, language === 'en' ? 'en-US' : language === 'zh' ? 'zh-CN' : language === 'my' ? 'ms-MY' : 'id-ID')
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Maaf, lagi gangguan bentar. Coba lagi ya!' }])
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
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
      const mimeType = uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
      const result = await claudeVision(base64, mimeType,
        `Kamu adalah asisten keuangan Zena. Analisis struk/nota ini dan:
1. Sebutkan nama toko dan tanggal (jika ada)
2. List item-item yang dibeli beserta harganya
3. Sebutkan total belanja
4. Kategori transaksi yang tepat (Makan & Minum / Belanja / Tagihan / Hiburan / Kesehatan / Transport / dll)
5. Berikan 1 komentar singkat yang friendly tentang pengeluaran ini
Format jawaban natural, bahasa Indonesia, friendly. Bukan JSON.`)
      setMessages(prev => [...prev, { role: 'assistant', content: result }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Maaf, gagal baca struk. Pastikan foto jelas ya!' }])
    }
    setLoading(false)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }

  // ── VOICE NOTE ── (Disabled - TODO: Implement with expo-audio)
  // const handleVoiceNote = async () => {
  //   if (isRecording) {
  //     await stopRecording()
  //   } else {
  //     await startRecording()
  //   }
  // }

  // const startRecording = async () => {
  //   try {
  //     const permission = await Audio.requestPermissionsAsync()
  //     if (!permission.granted) {
  //       Alert.alert('Izin diperlukan', 'Izin mikrofon dibutuhkan.')
  //       return
  //     }
  //     await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
  //     const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
  //     setRecording(rec)
  //     setIsRecording(true)
  //   } catch {
  //     Alert.alert('Error', 'Gagal memulai rekaman.')
  //   }
  // }

  // const stopRecording = async () => {
  //   if (!recording) return
  //   setIsRecording(false)
  //   setLoading(true)
  //   try {
  //     await recording.stopAndUnloadAsync()
  //     setRecording(null)
  //     setLoading(false)
  //     Alert.alert(
  //       '🎤 Voice Note',
  //       'Rekaman selesai! Ketik transaksinya di chat ya (contoh: "beli nasi 15 ribu tadi siang")',
  //       [{ text: 'OK' }]
  //     )
  //   } catch {
  //     setLoading(false)
  //     Alert.alert('Error', 'Gagal memproses rekaman.')
  //   }
  // }

  const getPersonaLabel = () => {
    const labels: Record<Persona, string> = {
      bestie: 'Si Bestie',
      advisor: 'Pak/Bu Advisor',
      kakak: 'Kak Zena',
      adek: 'Dek Zena',
      pacar: 'Si Sayang',
      stoic: 'Mentor Zen',
    }
    return labels[persona] || 'Zena AI'
  }

  if (initLoading) return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator color={PRIMARY} />
      <Text style={styles.loadingText}>Zena lagi nyiapin konteks keuangan kamu...</Text>
    </View>
  )

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
          <Text style={styles.headerSub}>{getPersonaLabel()} · Online</Text>
        </View>
        {/* Voice toggle disabled - TODO: Implement with expo-audio */}
        {/* <TouchableOpacity
          style={[styles.voiceToggle, voiceEnabled && styles.voiceToggleActive]}
          onPress={() => { setVoiceEnabled(v => !v); if (voiceEnabled) stopSpeaking() }}
        >
          <Text style={styles.voiceToggleText}>{voiceEnabled ? '🔊' : '🔇'}</Text>
        </TouchableOpacity> */}
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
              <View style={styles.typingDots}>
                <ActivityIndicator size="small" color={PRIMARY} />
                <Text style={styles.typingText}>Zena lagi mikir...</Text>
              </View>
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
        {/* Voice button disabled - TODO: Implement with expo-audio */}
        {/* <TouchableOpacity
          style={[styles.iconBtn, isRecording && styles.iconBtnRecording]}
          onPress={handleVoiceNote}
        >
          <Text style={styles.iconBtnText}>{isRecording ? '⏹' : '🎤'}</Text>
        </TouchableOpacity> */}
        <TextInput
          style={styles.input}
          placeholder="Tanya Zena apa aja..."
          placeholderTextColor="#888780"
          value={input}
          onChangeText={setInput}
          multiline
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
  loadingWrap: { flex: 1, backgroundColor: '#0F0F0F', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: '#888780' },
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
  typingDots: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { fontSize: 12, color: '#888780' },
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
  voiceToggle: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  voiceToggleActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  voiceToggleText: { fontSize: 16 },
})
