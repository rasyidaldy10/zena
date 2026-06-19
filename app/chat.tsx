import { useState, useRef, useEffect } from 'react'
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
import { getContextualSystemPrompt } from '../lib/personas'
import { speak, stopSpeaking } from '../lib/speech'
import { processVoiceNote } from '../lib/groq'
import { parseTransactionText, ParsedTransaction } from '../lib/transaction-parser'
import TransactionConfirmCard from '../components/TransactionConfirmCard'
import { Persona, Language, BudgetMethod, Transaction } from '../types'
import { notify, confirmAsync } from '../lib/alert'
import { loadChatHistory, saveChatHistory, clearChatHistory } from '../lib/chatHistory'

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
  const [recording, setRecording] = useState<Audio.Recording | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [pendingTransaction, setPendingTransaction] = useState<ParsedTransaction | null>(null)
  const [savingTransaction, setSavingTransaction] = useState(false)
  const [activeMode, setActiveMode] = useState<'personal' | 'business'>('personal')
  const userIdRef = useRef<string | null>(null)
  const historyReadyRef = useRef(false)
  const scrollRef = useRef<ScrollView>(null)

  useEffect(() => {
    initChat()
  }, [])

  // Simpan history tiap kali pesan berubah (setelah init selesai) — reset 1 hari (lib/chatHistory)
  useEffect(() => {
    if (!historyReadyRef.current || !userIdRef.current) return
    if (messages.length === 0) return
    saveChatHistory(userIdRef.current, messages)
  }, [messages])

  const initChat = async () => {
    const prefs = await loadPrefs()
    const txns = await loadTransactions()

    // Lanjutkan percakapan sebelumnya kalau masih < 24 jam
    if (userIdRef.current) {
      const saved = await loadChatHistory(userIdRef.current)
      if (saved && saved.length > 0) {
        setMessages(saved)
        historyReadyRef.current = true
        setInitLoading(false)
        return
      }
    }

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
    historyReadyRef.current = true
    setInitLoading(false)
  }

  const loadPrefs = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.replace('/(auth)/login')
      return null
    }
    userIdRef.current = user.id

    const { data: prefsRows } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
    const prefs = prefsRows?.[0]

    if (prefs?.persona) setPersona(prefs.persona)
    if (prefs?.language) setLanguage(prefs.language)
    if (prefs?.nickname) setNickname(prefs.nickname)
    if (prefs?.monthly_income) setMonthlyIncome(prefs.monthly_income)
    if (prefs?.budget_method) setBudgetMethod(prefs.budget_method)
    if (prefs?.active_mode) setActiveMode(prefs.active_mode)
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

    // Try to parse as transaction input first
    const parsed = parseTransactionText(messageText, activeMode)
    if (parsed && parsed.confidence >= 0.5) {
      // Show confirmation card
      setPendingTransaction(parsed)
      setMessages(prev => [...prev, { role: 'user', content: messageText }])
      setInput('')
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
      return
    }

    // Normal chat flow
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
    } catch (err: any) {
      // Tampilkan error asli (sementara) supaya gampang debug kalau masih gagal
      const detail = err?.message ? `\n\n(${String(err.message).slice(0, 200)})` : ''
      setMessages(prev => [...prev, { role: 'assistant', content: `Maaf, lagi gangguan bentar. Coba lagi ya!${detail}` }])
    }
    setLoading(false)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }

  // ── SAVE TRANSACTION FROM CHAT ──
  const handleSaveTransaction = async () => {
    if (!pendingTransaction) return

    setSavingTransaction(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSavingTransaction(false)
      return
    }

    try {
      // Ambil dompet pertama sesuai mode (sekalian saldo buat update current_balance)
      const { data: wallets } = await supabase
        .from('user_wallets')
        .select('id, current_balance')
        .eq('user_id', user.id)
        .eq('wallet_function', activeMode)
        .eq('is_active', true)
        .limit(1)

      if (!wallets || wallets.length === 0) {
        notify('Oops', `Kamu belum punya dompet ${activeMode === 'personal' ? 'pribadi' : 'bisnis'}. Tambah dulu ya!`)
        setPendingTransaction(null)
        setSavingTransaction(false)
        return
      }

      const wallet = wallets[0]
      const txnType: 'income' | 'expense' =
        pendingTransaction.type === 'personal'
          ? (pendingTransaction.transaction_type === 'income' ? 'income' : 'expense')
          : 'expense' // mayoritas transaksi bisnis = pengeluaran

      // NOTE: tabel transactions pakai kolom `note` (BUKAN description) — samain dgn tambah-transaksi
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        wallet_id: wallet.id,
        wallet_source: wallet.id,
        type: txnType,
        amount: pendingTransaction.amount,
        category: pendingTransaction.type === 'personal' ? (pendingTransaction.category || 'lainnya') : 'lainnya',
        business_category: pendingTransaction.type === 'business' ? pendingTransaction.business_category : null,
        note: pendingTransaction.description || '',
        source: 'manual',
        is_categorized: true,
        is_wallet_transfer: false,
        date: new Date().toISOString().split('T')[0],
      })

      if (error) throw error

      // Update saldo dompet (kalau gak diupdate, saldo gak nambah/kurang)
      const newBalance = txnType === 'income'
        ? (wallet.current_balance || 0) + pendingTransaction.amount
        : (wallet.current_balance || 0) - pendingTransaction.amount
      await supabase.from('user_wallets').update({ current_balance: newBalance }).eq('id', wallet.id)

      const label = pendingTransaction.type === 'business'
        ? `Transaksi bisnis (${pendingTransaction.business_category})`
        : `Transaksi ${txnType === 'income' ? 'pemasukan' : 'pengeluaran'}`
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ Oke! ${label} Rp ${pendingTransaction.amount.toLocaleString('id-ID')} udah tersimpan & saldo dompet diperbarui!`
      }])

      setPendingTransaction(null)
    } catch (error: any) {
      notify('Gagal', `Gagal menyimpan transaksi: ${error?.message || 'coba lagi ya!'}`)
    }

    setSavingTransaction(false)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }

  const handleCancelTransaction = () => {
    setPendingTransaction(null)
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: 'Oke, dibatalin. Ada yang bisa gue bantu lagi?'
    }])
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

    // Di web, Alert chooser tidak jalan + kamera browser terbatas → langsung galeri/file picker
    if (Platform.OS === 'web') {
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 })
      if (!result.canceled) await processStruk(result.assets[0].uri)
      return
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

      // Different prompts for personal vs business
      let prompt = ''
      if (activeMode === 'business') {
        prompt = `Analisis struk/invoice bisnis ini dan extract data dalam format JSON:
{
  "store_name": "nama toko/supplier",
  "date": "YYYY-MM-DD",
  "items": [{"name": "nama item", "qty": 1, "price": 50000}],
  "total": 150000,
  "category": "penjualan/pembelian_alat/operasional",
  "is_business": true
}

Jika ini struk penjualan produk kamu → category: "penjualan"
Jika ini struk beli alat/bahan → category: "pembelian_alat"
Jika ini struk operasional (sewa, listrik) → category: "operasional"

Return ONLY valid JSON, no markdown, no explanation.`
      } else {
        prompt = `Kamu menganalisis sebuah gambar yang bisa berupa STRUK BELANJA atau BUKTI TRANSFER/MUTASI BANK/E-WALLET. Extract data dalam format JSON:
{
  "doc_type": "struk" | "transfer",
  "flow": "in" | "out",
  "store_name": "nama toko / nama pengirim atau penerima transfer",
  "date": "YYYY-MM-DD",
  "items": [{"name": "nama item", "price": 15000}],
  "total": 50000,
  "category": "makanan/belanja/transport/hiburan/kesehatan/tagihan/transfer/gaji/lainnya",
  "is_business": false
}

ATURAN:
1. Kalau ini STRUK BELANJA (ada daftar item, nama toko, total bayar) → doc_type "struk", flow "out".
   Kategori: Resto/cafe/warung → "makanan"; Supermarket/minimarket → "belanja"; Bensin/parkir/grab → "transport"; Bioskop/game → "hiburan"; Apotek/klinik → "kesehatan"; Listrik/pulsa/internet → "tagihan".
2. Kalau ini BUKTI TRANSFER / MUTASI (mobile banking, e-wallet, ATM, "Transfer Berhasil", nominal + nama rekening) → doc_type "transfer", items [].
   - Kalau uang KELUAR / kamu mengirim (kata: "Transfer ke", "Pembayaran ke", "Kirim", "Pengeluaran") → flow "out", category "transfer".
   - Kalau uang MASUK / kamu menerima (kata: "Transfer dari", "Dana masuk", "Diterima dari", "Kredit", gaji/payroll) → flow "in", category "transfer" (atau "gaji" kalau jelas gaji).
   - "store_name" = nama lawan transaksi (pengirim kalau masuk, penerima kalau keluar).
   - "total" = nominal transfer.

Return ONLY valid JSON, no markdown, no explanation.`
      }

      const result = await claudeVision(base64, mimeType, prompt)

      // Parse JSON response
      const cleanResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const data = JSON.parse(cleanResult)

      // Create parsed transaction from OCR data
      if (data.is_business) {
        const parsed: ParsedTransaction = {
          type: 'business',
          business_category: data.category || 'lainnya',
          amount: data.total,
          description: `${data.store_name} - ${data.items?.map((i: any) => i.name).join(', ') || 'Scan struk'}`,
          product_name: data.items?.[0]?.name,
          quantity: data.items?.[0]?.qty,
          ppn_type: data.category === 'penjualan' ? 'keluaran' : 'masukan',
          confidence: 0.9,
        }
        setPendingTransaction(parsed)
        setMessages(prev => [...prev, { role: 'assistant', content: `✅ Berhasil scan struk bisnis dari ${data.store_name}!` }])
      } else {
        const isTransfer = data.doc_type === 'transfer'
        const isIncome = data.flow === 'in'
        const itemsText = data.items?.map((i: any) => i.name).join(', ')
        const desc = isTransfer
          ? `${isIncome ? 'Transfer masuk dari' : 'Transfer ke'} ${data.store_name || '-'}`
          : `${data.store_name || 'Struk'}${itemsText ? ` - ${itemsText}` : ''}`
        const parsed: ParsedTransaction = {
          type: 'personal',
          transaction_type: isIncome ? 'income' : 'expense',
          amount: data.total,
          description: desc,
          category: data.category || (isTransfer ? 'transfer' : 'lainnya'),
          confidence: 0.9,
        }
        setPendingTransaction(parsed)
        const kind = isTransfer ? `bukti transfer (${isIncome ? 'masuk' : 'keluar'})` : 'struk'
        setMessages(prev => [...prev, { role: 'assistant', content: `✅ Berhasil baca ${kind} — ${data.store_name || ''}!` }])
      }
    } catch (error) {
      console.error('OCR Error:', error)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Maaf, gagal baca struk. Pastikan foto jelas ya!' }])
    }
    setLoading(false)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }

  // ── VOICE NOTE ── Powered by Groq Whisper
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
        Alert.alert('Izin diperlukan', 'Izin mikrofon dibutuhkan untuk voice note.')
        return
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true
      })
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      setRecording(rec)
      setIsRecording(true)
    } catch (err: any) {
      console.error('Recording start error:', err)
      Alert.alert('Error', 'Gagal memulai rekaman.')
    }
  }

  const stopRecording = async () => {
    if (!recording) return

    setIsRecording(false)
    setLoading(true)

    try {
      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()
      setRecording(null)

      if (!uri) {
        throw new Error('No audio URI')
      }

      // Convert audio to base64 untuk dikirim ke Edge Function
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      })
      const audioUri = `data:audio/m4a;base64,${base64Audio}`

      // Process dengan Groq: Transcribe + Parse
      const result = await processVoiceNote(audioUri)

      setMessages(prev => [
        ...prev,
        { role: 'user', content: `🎤 "${result.transcription}"` }
      ])

      // If parsed successfully, create ParsedTransaction
      if (result.nominal && result.kategori) {
        const parsed: ParsedTransaction = {
          type: 'personal',
          transaction_type: result.tipe === 'income' ? 'income' : 'expense',
          amount: result.nominal,
          description: result.catatan || result.transcription,
          category: result.kategori,
          confidence: 0.85,
        }
        setPendingTransaction(parsed)
        setMessages(prev => [...prev, { role: 'assistant', content: `✅ Berhasil parse voice note!` }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `Maaf, nominal atau kategori tidak terdeteksi. Coba ketik manual ya!` }])
      }

      setLoading(false)
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)

    } catch (err: any) {
      console.error('Recording stop error:', err)
      setLoading(false)
      Alert.alert('Error', `Gagal memproses voice note: ${err.message}`)
    }
  }

  const handleNewChat = async () => {
    const ok = await confirmAsync('Mulai chat baru?', 'Percakapan sekarang akan dihapus. Transaksi yang sudah tersimpan tidak terpengaruh.')
    if (!ok) return
    if (userIdRef.current) await clearChatHistory(userIdRef.current)
    setPendingTransaction(null)
    historyReadyRef.current = false
    setInitLoading(true)
    await initChat()
  }

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
        <TouchableOpacity onPress={handleNewChat} style={styles.newChatBtn}>
          <Text style={styles.newChatText}>＋ Baru</Text>
        </TouchableOpacity>
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
        {pendingTransaction && (
          <TransactionConfirmCard
            parsed={pendingTransaction}
            onConfirm={handleSaveTransaction}
            onCancel={handleCancelTransaction}
            loading={savingTransaction}
          />
        )}
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
        <TouchableOpacity
          style={[styles.iconBtn, isRecording && styles.iconBtnRecording]}
          onPress={handleVoiceNote}
        >
          <Text style={styles.iconBtnText}>{isRecording ? '⏹' : '🎤'}</Text>
        </TouchableOpacity>
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
  newChatBtn: { width: 80, alignItems: 'flex-end' },
  newChatText: { fontSize: 14, color: PRIMARY, fontWeight: '600' },
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
