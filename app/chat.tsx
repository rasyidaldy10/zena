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
import { transcribeAudio } from '../lib/groq'
import { terbilang } from '../lib/terbilang'
import { parseTransactionText, ParsedTransaction } from '../lib/transaction-parser'
import { amountInIDR } from '../lib/format'
import TransactionConfirmCard from '../components/TransactionConfirmCard'
import ScanReviewCard, { ScanRow } from '../components/ScanReviewCard'
import { Persona, Language, BudgetMethod, Transaction, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types'
import { BUSINESS_CATEGORIES } from '../constants/business'
import { notify, confirmAsync } from '../lib/alert'
import ScanSourceSheet from '../components/ScanSourceSheet'
import { loadChatHistory, saveChatHistory, clearChatHistory } from '../lib/chatHistory'

interface ScanWalletOpt { id: string; wallet_name: string; current_balance: number }

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

// Hitung jumlah "nominal" di teks: dotted ribuan (50.000), shorthand (50rb/5jt), atau angka 4+ digit
const countAmounts = (text: string): number => {
  const m = text.match(/(\b\d{1,3}(?:[.,]\d{3})+\b)|(\b\d+\s*(?:k|rb|ribu|jt|juta)\b)|(\b\d{4,}\b)/gi)
  return m ? m.length : 0
}
// Pertanyaan/analisa → jangan dianggap input transaksi
const looksLikeQuestion = (text: string): boolean =>
  /\?|^\s*(berapa|brp|gimana|gmn|bagaimana|kenapa|napa|apa|apakah|kapan|tips|analisa|analisis|prediksi|rekap|saran|budget|sisa)/i.test(text)

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
  const [scanSheet, setScanSheet] = useState(false)
  const [scanRows, setScanRows] = useState<ScanRow[] | null>(null)
  const [scanWallets, setScanWallets] = useState<ScanWalletOpt[]>([])
  const [scanWalletInitial, setScanWalletInitial] = useState<string | undefined>(undefined)
  const [savingScan, setSavingScan] = useState(false)
  const [activeMode, setActiveMode] = useState<'personal' | 'business'>('personal')
  const userIdRef = useRef<string | null>(null)
  const historyReadyRef = useRef(false)
  const scrollRef = useRef<ScrollView>(null)

  // Percakapan suara dua arah:
  //   idle    -> tidak ada sesi
  //   answer  -> Zena sudah bertanya, menunggu user menyebut transaksi
  //   confirm -> Zena sudah membacakan hasil, menunggu "betul" / koreksi / "batal"
  // Disimpan di ref karena dibaca di dalam callback async (stopRecording, onEnd TTS).
  type VoiceStage = 'idle' | 'answer' | 'confirm'
  const voiceStageRef = useRef<VoiceStage>('idle')
  const [voiceStage, setVoiceStage] = useState<VoiceStage>('idle')
  const setStage = (st: VoiceStage) => { voiceStageRef.current = st; setVoiceStage(st) }

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
      const totalExp = thisMonthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + amountInIDR(t), 0)

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

    // Banyak transaksi sekaligus / tempelan mutasi (≥2 nominal & bukan pertanyaan)
    // → ekstrak via AI jadi banyak kartu editable
    if (!looksLikeQuestion(messageText) && countAmounts(messageText) >= 2) {
      setMessages(prev => [...prev, { role: 'user', content: messageText }])
      setInput('')
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
      await processTypedTransactions(messageText)
      return
    }

    // Try to parse as transaction input first (single)
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

    // Guard: nominal harus valid (cegah insert amount kosong/0 → error/membingungkan)
    if (!pendingTransaction.amount || pendingTransaction.amount <= 0) {
      notify('Nominal tidak terbaca', 'Nominal transaksi gak kebaca. Coba ketik manual atau foto ulang ya!')
      setPendingTransaction(null)
      return
    }

    setSavingTransaction(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSavingTransaction(false)
      return
    }

    try {
      // Ambil dompet pertama sesuai mode (sekalian saldo buat update current_balance).
      // Dibatasi ke dompet RUPIAH: nominal dari chat/voice selalu dalam rupiah,
      // jadi kalau nyasar ke dompet valas, "Rp 50.000" akan memotong 50.000 dolar.
      const { data: wallets } = await supabase
        .from('user_wallets')
        .select('id, current_balance')
        .eq('user_id', user.id)
        .eq('wallet_function', activeMode)
        .eq('is_active', true)
        .or('currency.eq.IDR,currency.is.null')
        .limit(1)

      if (!wallets || wallets.length === 0) {
        notify('Oops', `Kamu belum punya dompet rupiah ${activeMode === 'personal' ? 'pribadi' : 'bisnis'}. Tambah dulu ya!`)
        setPendingTransaction(null)
        setSavingTransaction(false)
        return
      }

      const wallet = wallets[0]
      const txnType: 'income' | 'expense' =
        pendingTransaction.type === 'personal'
          ? (pendingTransaction.transaction_type === 'income' ? 'income' : 'expense')
          // Bisnis: penjualan = uang masuk (income), sisanya pengeluaran
          : (pendingTransaction.business_category === 'penjualan' ? 'income' : 'expense')

      // NOTE: tabel transactions pakai kolom `note` (BUKAN description) — samain dgn tambah-transaksi
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        wallet_id: wallet.id,
        wallet_source: wallet.id,
        type: txnType,
        amount: pendingTransaction.amount,
        currency: 'IDR',
        amount_idr: pendingTransaction.amount,
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
  // Buka sheet pilihan (Kamera / Galeri) — konsisten di web & native
  const handleScanStruk = () => setScanSheet(true)

  const runScan = async (source: 'camera' | 'gallery') => {
    setScanSheet(false)
    try {
      let result: ImagePicker.ImagePickerResult
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync()
        if (!perm.granted) {
          notify('Izin diperlukan', 'Izin kamera dibutuhkan untuk foto struk.')
          return
        }
        result = await ImagePicker.launchCameraAsync({ quality: 0.8 })
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (!perm.granted && Platform.OS !== 'web') {
          notify('Izin diperlukan', 'Izin galeri dibutuhkan.')
          return
        }
        result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 })
      }
      if (!result.canceled && result.assets?.[0]) await processStruk(result.assets[0].uri)
    } catch {
      notify('Gagal Buka Kamera', 'Coba pilih dari galeri/upload ya.')
    }
  }

  // Kategori sesuai mode (buat prompt + picker di kartu review)
  const incomeCats = activeMode === 'business'
    ? BUSINESS_CATEGORIES.filter(c => c.value === 'penjualan').map(c => c.label)
    : INCOME_CATEGORIES
  const expenseCats = activeMode === 'business'
    ? BUSINESS_CATEGORIES.filter(c => c.value !== 'penjualan').map(c => c.label)
    : EXPENSE_CATEGORIES

  // Bangun kartu review dari array transaksi mentah (dipakai scan & input teks)
  const presentRows = async (rawList: any[], emptyMsg: string): Promise<ScanRow[] | null> => {
    const validCats = (flow: string) => (flow === 'in' ? incomeCats : expenseCats)
    const rows: ScanRow[] = rawList
      .map((t) => {
        const flow: 'in' | 'out' = t?.flow === 'in' ? 'in' : 'out'
        const amount = parseInt(String(t?.amount ?? '').replace(/[^0-9]/g, ''), 10) || 0
        const cats = validCats(flow)
        const category = cats.includes(t?.category) ? t.category : (cats[cats.length - 1] || 'Lainnya')
        return { flow, amount, description: String(t?.description || '').slice(0, 120), category, include: true }
      })
      .filter(r => r.amount > 0)

    if (rows.length === 0) {
      setMessages(prev => [...prev, { role: 'assistant', content: emptyMsg }])
      return null
    }
    const { data: { user } } = await supabase.auth.getUser()
    // Hasil scan struk/mutasi selalu dalam rupiah, jadi hanya tawarkan dompet
    // rupiah — memilih dompet valas akan memotong saldo dalam satuan yang salah.
    const { data: wallets } = await supabase
      .from('user_wallets')
      .select('id, wallet_name, current_balance')
      .eq('user_id', user?.id)
      .eq('wallet_function', activeMode)
      .eq('is_active', true)
      .or('currency.eq.IDR,currency.is.null')
      .order('created_at', { ascending: true })

    const wl = (wallets || []) as ScanWalletOpt[]
    if (wl.length === 0) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Kebaca ${rows.length} transaksi, tapi kamu belum punya dompet rupiah ${activeMode === 'personal' ? 'pribadi' : 'bisnis'}. Tambah dompet dulu ya!` }])
      return null
    }
    setScanWallets(wl)
    setScanWalletInitial(wl[0]?.id)
    setScanRows(rows)
    setMessages(prev => [...prev, { role: 'assistant', content: `✅ Kebaca ${rows.length} transaksi. Cek satu-satu — bisa pilih dompet, ubah masuk/keluar, nominal, kategori, batalin per item, atau simpan sekaligus.` }])
    return rows
  }

  // Input TEKS dengan banyak transaksi / tempelan mutasi → ekstrak jadi banyak kartu
  const processTypedTransactions = async (text: string): Promise<ScanRow[] | null> => {
    setLoading(true)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
    try {
      const sys = 'Kamu mesin ekstraksi transaksi keuangan. Balas HANYA JSON valid, tanpa penjelasan.'
      const prompt = `Dari teks user berikut, ekstrak SEMUA transaksi (bisa beberapa transaksi sekaligus, atau tempelan mutasi/riwayat rekening) ke JSON:
{ "transactions": [ { "flow": "in" | "out", "amount": 50000, "description": "keterangan singkat", "category": "<kategori valid>" } ] }
ATURAN:
- "flow" = "in" kalau uang MASUK/diterima; "out" kalau uang KELUAR/dibayar.
- "amount" = angka bersih tanpa titik/Rp. "50rb"=50000, "1jt"=1000000, "1.000.000"=1000000.
- Pisahkan tiap transaksi jadi objek sendiri (mis. "belanja A 20rb dan B 35rb" = 2 objek).
- ${activeMode === 'business'
  ? `Kategori valid (income): ${incomeCats.join(', ')}. Kategori valid (expense): ${expenseCats.join(', ')}.`
  : `Kategori untuk uang KELUAR: ${expenseCats.join(', ')}. Kategori untuk uang MASUK: ${incomeCats.join(', ')}.`}
- Ragu kategori → "Lainnya". Abaikan baris saldo/total.
Teks user: """${text}"""
Return ONLY valid JSON.`
      const result = await claudeChat(sys, [{ role: 'user', content: prompt }], { maxTokens: 1800 })
      const clean = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const data = JSON.parse(clean)
      const rawList: any[] = Array.isArray(data?.transactions) ? data.transactions : []
      return await presentRows(rawList, 'Hmm, belum kebaca transaksinya. Coba tulis lebih jelas ya, misal: "belanja sayur 20rb dan ayam 35rb".')
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Hmm, belum kebaca transaksinya. Coba tulis lebih jelas ya, misal: "belanja sayur 20rb dan ayam 35rb".' }])
      return null
    }
    setLoading(false)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }

  const processStruk = async (uri: string) => {
    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', content: '📷 [Mengirim foto untuk discan...]' }])
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50)
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
      const mimeType = uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'

      const prompt = `Kamu menganalisis gambar keuangan: bisa STRUK BELANJA, BUKTI TRANSFER tunggal, atau MUTASI/RIWAYAT REKENING (banyak baris transaksi sekaligus).

Ekstrak SEMUA transaksi yang terlihat ke dalam JSON:
{
  "transactions": [
    { "flow": "in" | "out", "amount": 50000, "description": "keterangan singkat / nama lawan transaksi", "category": "<salah satu kategori valid>" }
  ]
}

ATURAN:
- "flow" = "in" kalau uang MASUK/diterima/kredit; "out" kalau uang KELUAR/dibayar/debet.
- Kalau ini MUTASI/riwayat → buat SATU objek per baris transaksi (boleh banyak).
- Kalau STRUK belanja → satu transaksi "out", description = nama toko.
- "amount" = angka bersih tanpa titik/koma/Rp.
- ABAIKAN baris saldo/total/biaya admin gabungan; ambil transaksi sebenarnya saja.
${activeMode === 'business'
  ? `- Kategori valid (income): ${incomeCats.join(', ')}. Kategori valid (expense): ${expenseCats.join(', ')}.`
  : `- Kategori valid untuk uang KELUAR: ${expenseCats.join(', ')}.\n- Kategori valid untuk uang MASUK: ${incomeCats.join(', ')}.`}
- Pilih kategori paling masuk akal. Kalau ragu pakai "Lainnya".

Return ONLY valid JSON, no markdown, no explanation.`

      const result = await claudeVision(base64, mimeType, prompt)
      const cleanResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const data = JSON.parse(cleanResult)

      const rawList: any[] = Array.isArray(data?.transactions) ? data.transactions : []
      await presentRows(rawList, 'Hmm, gak nemu transaksi yang kebaca. Pastikan foto jelas ya — boleh struk, bukti transfer, atau mutasi rekening.')
    } catch (error) {
      console.error('OCR Error:', error)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Maaf, gagal baca gambar. Pastikan foto jelas ya!' }])
    }
    setLoading(false)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }

  // ── SIMPAN HASIL SCAN (batch, banyak transaksi sekaligus) ──
  const handleSaveScan = async (rows: ScanRow[], walletId: string) => {
    if (rows.length === 0 || !walletId) return
    setSavingScan(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingScan(false); return }

    try {
      const today = new Date().toISOString().split('T')[0]
      const bizValueByLabel = new Map(BUSINESS_CATEGORIES.map(c => [c.label, c.value]))

      const payload = rows.map(r => {
        const type: 'income' | 'expense' = r.flow === 'in' ? 'income' : 'expense'
        const base: any = {
          user_id: user.id,
          wallet_id: walletId,
          wallet_source: walletId,
          type,
          amount: r.amount,
          currency: 'IDR',
          amount_idr: r.amount,
          note: r.description || '',
          source: 'manual',
          is_categorized: true,
          is_wallet_transfer: false,
          date: today,
        }
        if (activeMode === 'business') {
          base.business_category = bizValueByLabel.get(r.category) || 'lainnya'
          base.category = 'lainnya'
        } else {
          base.category = r.category || 'Lainnya'
        }
        return base
      })

      const { error } = await supabase.from('transactions').insert(payload)
      if (error) throw error

      // Update saldo dompet sekali: net = total masuk − total keluar
      const net = rows.reduce((s, r) => s + (r.flow === 'in' ? r.amount : -r.amount), 0)
      const { data: w } = await supabase
        .from('user_wallets').select('current_balance').eq('id', walletId).limit(1)
      const cur = w?.[0]?.current_balance || 0
      await supabase.from('user_wallets').update({ current_balance: cur + net }).eq('id', walletId)

      setScanRows(null)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ ${rows.length} transaksi tersimpan! Saldo dompet diperbarui ${net >= 0 ? '+' : '−'}Rp ${Math.abs(net).toLocaleString('id-ID')}.`
      }])
    } catch (error: any) {
      notify('Gagal', `Gagal menyimpan transaksi: ${error?.message || 'coba lagi ya!'}`)
    }
    setSavingScan(false)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }

  const handleCancelScan = () => {
    setScanRows(null)
    setMessages(prev => [...prev, { role: 'assistant', content: 'Oke, hasil scan dibatalin. Ada lagi yang bisa gue bantu?' }])
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }

  // ── VOICE NOTE ── Powered by Groq Whisper
  const handleVoiceNote = async () => {
    if (isRecording) {
      await stopRecording()
      return
    }
    if (voiceStageRef.current === 'idle') {
      // Sesi baru: Zena bertanya dulu, lalu otomatis mendengarkan.
      startVoiceSession()
      return
    }
    // Sesi sedang berjalan & Zena masih bicara: potong, langsung dengarkan.
    stopSpeaking()
    await startRecording()
  }

  // Simpan/batalkan lewat kartu (bukan suara) juga harus mengakhiri sesi,
  // supaya Zena tidak tiba-tiba menyalakan mic lagi setelah bicara.
  const handleSaveScanFromCard = async (rows: ScanRow[], walletId: string) => {
    stopSpeaking(); setStage('idle')
    await handleSaveScan(rows, walletId)
  }
  const handleCancelScanFromCard = () => {
    stopSpeaking(); setStage('idle')
    handleCancelScan()
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

  // ── Percakapan suara dua arah ──────────────────────────────────────────
  // Zena bertanya → user menjawab → Zena membacakan hasil → user bilang
  // "betul" (simpan) / mengoreksi (parsing ulang) / "batal". Tiap giliran
  // user tetap menekan mic, tapi perekaman dimulai otomatis begitu Zena
  // selesai bicara supaya terasa seperti percakapan.

  const speakThenListen = (text: string) => {
    setMessages(prev => [...prev, { role: 'assistant', content: `🔊 ${text}` }])
    speak(text, persona, 'id-ID', () => {
      // Mulai mendengarkan hanya kalau sesi masih aktif (user bisa saja membatalkan)
      if (voiceStageRef.current !== 'idle') startRecording()
    })
  }

  const endVoiceSession = (sayThis?: string) => {
    setStage('idle')
    if (sayThis) {
      setMessages(prev => [...prev, { role: 'assistant', content: `🔊 ${sayThis}` }])
      speak(sayThis, persona, 'id-ID')
    }
  }

  const startVoiceSession = () => {
    stopSpeaking()
    setStage('answer')
    speakThenListen('Mau catat apa hari ini?')
  }

  /** Kalimat ringkasan yang dibacakan, dengan nominal sebagai kata. */
  const rowsToSpeech = (rows: ScanRow[]): string => {
    const items = rows.filter(r => r.include)
    const wallet = scanWallets.find(w => w.id === scanWalletInitial)?.wallet_name
    const parts = items.map(r => {
      const arah = r.flow === 'in' ? 'masuk' : 'keluar'
      const nama = r.description || r.category
      return `${nama} ${terbilang(r.amount)} rupiah ${arah}`
    })
    const daftar = parts.length === 1 ? parts[0]
      : parts.slice(0, -1).join(', ') + ', dan ' + parts[parts.length - 1]
    return `Oke, aku catat ${items.length} transaksi: ${daftar}${wallet ? `, ke dompet ${wallet}` : ''}. Betul?`
  }

  const YES = /^\s*(ya|iya|yes|yup|betul|bener|benar|oke|ok|okay|sip|siap|simpan|lanjut|setuju|boleh)\b/i
  const NO  = /^\s*(batal|gak jadi|nggak jadi|ga jadi|tidak jadi|tidak|jangan|cancel|enggak|nggak|gak)\b/i

  /** Koreksi lisan → Claude memperbaiki daftar transaksi yang sudah ada. */
  const reviseRowsByVoice = async (current: ScanRow[], correction: string): Promise<ScanRow[] | null> => {
    const sys = 'Kamu mesin koreksi daftar transaksi keuangan. Balas HANYA JSON valid, tanpa penjelasan.'
    const currentJson = JSON.stringify(
      current.filter(r => r.include).map(r => ({ flow: r.flow, amount: r.amount, description: r.description, category: r.category }))
    )
    const prompt = [
      'Daftar transaksi saat ini (JSON):',
      currentJson,
      '',
      `User mengoreksi lewat suara: "${correction.replace(/"/g, "'")}"`,
      '',
      'Terapkan koreksinya (ubah nominal/keterangan/kategori, hapus, atau tambah transaksi) dan kembalikan daftar LENGKAP yang sudah benar:',
      '{ "transactions": [ { "flow": "in" | "out", "amount": 50000, "description": "keterangan singkat", "category": "<kategori valid>" } ] }',
      `Kategori valid uang KELUAR: ${expenseCats.join(', ')}. Uang MASUK: ${incomeCats.join(', ')}.`,
      '"amount" angka bersih tanpa titik. Kalau koreksinya tidak jelas, kembalikan daftar apa adanya.',
      'Return ONLY valid JSON.',
    ].join('\n')
    try {
      const result = await claudeChat(sys, [{ role: 'user', content: prompt }], { maxTokens: 1500 })
      const clean = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const data = JSON.parse(clean)
      const rawList: any[] = Array.isArray(data?.transactions) ? data.transactions : []
      return await presentRows(rawList, 'Hmm, koreksinya belum kebaca. Coba ulangi ya.')
    } catch {
      return null
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
      if (!uri) throw new Error('No audio URI')

      // Format rekaman beda per platform: browser = webm/opus, HP = m4a.
      // Labelnya harus benar supaya decoder Whisper tidak salah menafsirkan.
      const mime = Platform.OS === 'web' ? 'audio/webm' : 'audio/m4a'
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      })
      const transcript = (await transcribeAudio(`data:${mime};base64,${base64Audio}`)).trim()

      setMessages(prev => [...prev, { role: 'user', content: `🎤 "${transcript}"` }])

      if (!transcript) {
        if (voiceStageRef.current !== 'idle') speakThenListen('Maaf, aku nggak kedengeran. Coba ulangi ya.')
        else setMessages(prev => [...prev, { role: 'assistant', content: 'Maaf, suaranya nggak kedengeran. Coba lagi ya.' }])
        return
      }

      const stage = voiceStageRef.current

      if (stage === 'confirm' && scanRows) {
        if (YES.test(transcript)) {
          const rows = scanRows.filter(r => r.include)
          if (rows.length > 0 && scanWalletInitial) {
            await handleSaveScan(rows, scanWalletInitial)
            endVoiceSession('Sip, sudah tersimpan.')
          } else {
            endVoiceSession('Nggak ada yang bisa disimpan. Coba lagi ya.')
          }
          return
        }
        if (NO.test(transcript)) {
          setScanRows(null)
          endVoiceSession('Oke, dibatalkan.')
          return
        }
        // Bukan ya/tidak → anggap koreksi
        const revised = await reviseRowsByVoice(scanRows, transcript)
        if (revised) speakThenListen(rowsToSpeech(revised))
        else speakThenListen('Koreksinya belum kebaca. Coba sebutkan lagi, atau bilang "betul" kalau sudah pas.')
        return
      }

      // Tahap 'answer' (atau mic ditekan langsung tanpa sesi): ekstrak transaksi.
      // Lewat jalur yang sama dengan teks ketik, jadi bisa banyak transaksi
      // sekaligus dan keterangannya diekstrak per transaksi.
      const rows = await processTypedTransactions(transcript)
      if (rows) {
        setStage('confirm')
        speakThenListen(rowsToSpeech(rows))
      } else if (stage !== 'idle') {
        speakThenListen('Aku belum nangkep transaksinya. Coba sebutkan lagi, misalnya: bensin seratus lima puluh ribu.')
      }
    } catch (err: any) {
      endVoiceSession()
      notify('Error', `Gagal memproses voice note: ${err?.message || 'coba lagi ya'}`)
    } finally {
      setLoading(false)
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
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
      <ScanSourceSheet visible={scanSheet} onClose={() => setScanSheet(false)} onPick={runScan} />

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
        {scanRows && (
          <ScanReviewCard
            rows={scanRows}
            wallets={scanWallets}
            incomeCategories={incomeCats}
            expenseCategories={expenseCats}
            initialWalletId={scanWalletInitial}
            loading={savingScan}
            onSave={handleSaveScanFromCard}
            onCancel={handleCancelScanFromCard}
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

      {/* Status percakapan suara — supaya jelas Zena lagi nunggu apa */}
      {voiceStage !== 'idle' && (
        <View style={styles.voiceBar}>
          <View style={[styles.voiceDot, isRecording && styles.voiceDotLive]} />
          <Text style={styles.voiceBarText}>
            {isRecording
              ? (voiceStage === 'confirm' ? 'Mendengarkan… bilang "betul", koreksi, atau "batal"' : 'Mendengarkan… sebutkan transaksinya')
              : (loading ? 'Zena lagi mikir…' : 'Zena bicara… (tekan 🎤 untuk langsung jawab)')}
          </Text>
          <TouchableOpacity onPress={() => { stopSpeaking(); if (isRecording) stopRecording(); setStage('idle') }} hitSlop={8}>
            <Text style={styles.voiceBarEnd}>Selesai</Text>
          </TouchableOpacity>
        </View>
      )}

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
  voiceBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#12202E', borderTopWidth: 0.5, borderTopColor: PRIMARY + '60',
  },
  voiceDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY },
  voiceDotLive: { backgroundColor: '#E24B4A' },
  voiceBarText: { flex: 1, fontSize: 12, color: '#C9D6E4' },
  voiceBarEnd: { fontSize: 12, color: PRIMARY, fontWeight: '700' },
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
