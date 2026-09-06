import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
  ScrollView, KeyboardAvoidingView, Platform, Modal
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '../lib/supabase'
import { notify } from '../lib/alert'
import ScanSourceSheet from '../components/ScanSourceSheet'
import { claudeVision } from '../lib/claude'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types'
import { COLORS, RADIUS, SHADOW } from '../constants/theme'
import { formatMoney, formatDelta, parseAmountInput } from '../lib/format'
import { getRates, isForeign, currencyMeta, weightedAvgRate, type FxRateMap } from '../lib/fx'

const PRIMARY = COLORS.primary
const GREEN = COLORS.income
const RED = COLORS.expense
const PURPLE = '#7C3AED'
const TEXT_MAIN = COLORS.text
const TEXT_MUTED = COLORS.textMuted
const BG_APP = COLORS.bg
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''

const triggerAgents = (
  token: string,
  payload: { amount: number; type: string; category: string; note: string }
) => {
  if (!SUPABASE_URL || !token) return
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
  const body = JSON.stringify(payload)
  fetch(`${SUPABASE_URL}/functions/v1/budget-monitor`, { method: 'POST', headers, body }).catch(() => {})
  fetch(`${SUPABASE_URL}/functions/v1/anomaly-detector`, { method: 'POST', headers, body }).catch(() => {})
}

type TxType = 'expense' | 'income' | 'transfer'

type Wallet = {
  id: string
  wallet_name: string
  wallet_function?: 'personal' | 'business'
  icon: string
  color: string
  current_balance: number
  currency?: string
  avg_buy_rate?: number | null
}

const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']

function DatePicker({ value, onChange }: { value: string, onChange: (d: string) => void }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
  const getFirstDay = (y: number, m: number) => new Date(y, m, 1).getDay()

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const days = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDay(viewYear, viewMonth)
  const cells = Array(firstDay).fill(null).concat(Array.from({ length: days }, (_, i) => i + 1))

  return (
    <View style={dpStyles.wrap}>
      <View style={dpStyles.header}>
        <TouchableOpacity onPress={prevMonth}><Text style={dpStyles.arrow}>‹</Text></TouchableOpacity>
        <Text style={dpStyles.monthYear}>{MONTHS[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={nextMonth}><Text style={dpStyles.arrow}>›</Text></TouchableOpacity>
      </View>
      <View style={dpStyles.dayNames}>
        {['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map(d => (
          <Text key={d} style={dpStyles.dayName}>{d}</Text>
        ))}
      </View>
      <View style={dpStyles.grid}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e-${i}`} style={dpStyles.cell} />
          const dateStr = `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
          const isSelected = value === dateStr
          const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
          return (
            <TouchableOpacity
              key={dateStr}
              style={[dpStyles.cell, isSelected && dpStyles.cellSelected, isToday && !isSelected && dpStyles.cellToday]}
              onPress={() => onChange(dateStr)}
            >
              <Text style={[dpStyles.cellText, isSelected && dpStyles.cellTextSelected, isToday && !isSelected && dpStyles.cellTextToday]}>
                {day}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const dpStyles = StyleSheet.create({
  wrap: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 12, marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  arrow: { fontSize: 22, color: PRIMARY, paddingHorizontal: 8 },
  monthYear: { fontSize: 14, fontWeight: '600', color: '#fff' },
  dayNames: { flexDirection: 'row', marginBottom: 4 },
  dayName: { flex: 1, textAlign: 'center', fontSize: 11, color: '#888780' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellSelected: { backgroundColor: PRIMARY, borderRadius: 20 },
  cellToday: { borderWidth: 1, borderColor: PRIMARY, borderRadius: 20 },
  cellText: { fontSize: 13, color: '#fff' },
  cellTextSelected: { fontWeight: '700', color: '#fff' },
  cellTextToday: { color: PRIMARY, fontWeight: '600' },
})

type Project = {
  id: string
  name: string
  client_name: string | null
}

type Product = {
  id: string
  name: string
  unit: string
  buy_price: number
  sell_price: number
  stock_qty: number
}

type LinkType = 'none' | 'project' | 'product'

export default function TambahTransaksiScreen() {
  const params = useLocalSearchParams()
  const projectIdParam = params.project_id as string | undefined
  const modeParam = params.mode as string | undefined

  const [type, setType] = useState<TxType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [selectedWallet, setSelectedWallet] = useState<string>('')
  const [toWallet, setToWallet] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [showProjectPicker, setShowProjectPicker] = useState(false)
  // Kaitkan ke: none | project | product
  const [linkType, setLinkType] = useState<LinkType>('none')
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [productQty, setProductQty] = useState('1')
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanSheet, setScanSheet] = useState(false)
  const [rates, setRates] = useState<FxRateMap>({})
  const [rateInput, setRateInput] = useState('')       // kurs yang dipakai mengunci nilai rupiah
  const [receiveAmount, setReceiveAmount] = useState('') // sisi tujuan saat tukar valas

  useEffect(() => {
    fetchWallets()
    fetchProjects()
    fetchProducts()
    getRates().then(setRates).catch(() => { /* form tetap jalan; valas dicegah di handleSave */ })
  }, [])

  // --- valas ---
  const walletData    = wallets.find(w => w.id === selectedWallet)
  const txCurrency    = walletData?.currency || 'IDR'
  const foreignTx     = isForeign(txCurrency)
  const txMeta        = currencyMeta(txCurrency)
  // Nilai saldo (dan karenanya nilai transaksi) memakai kurs BELI bank, sama
  // seperti cara Home menilai saldo — supaya angka di dua layar tidak beda.
  const defaultRate   = rates[txCurrency]?.buy ?? null
  const effectiveRate = parseAmountInput(rateInput) || defaultRate || 0
  const nominalInput  = parseAmountInput(amount)
  const previewIDR    = foreignTx ? nominalInput * effectiveRate : nominalInput

  // Ganti dompet -> kurs ikut ganti; kosongkan supaya tidak terbawa kurs mata uang lain
  useEffect(() => { setRateInput('') }, [selectedWallet])

  // Auto-select project from query param
  useEffect(() => {
    if (projectIdParam && projects.length > 0) {
      setSelectedProject(projectIdParam)
      setLinkType('project')
    }
  }, [projectIdParam, projects])

  // Auto-select business wallet if mode=business
  useEffect(() => {
    if (modeParam === 'business' && wallets.length > 0) {
      const businessWallet = wallets.find(w => w.wallet_function === 'business')
      if (businessWallet) {
        setSelectedWallet(businessWallet.id)
      }
    }
  }, [modeParam, wallets])

  // Reset category when type changes (income vs expense have different categories)
  useEffect(() => {
    setCategory('')
  }, [type])


  const fetchWallets = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data }, { data: prefsRows }] = await Promise.all([
      supabase
        .from('user_wallets')
        .select('id, wallet_name, wallet_function, icon, color, current_balance, currency, avg_buy_rate')
        .eq('user_id', user?.id)
        .eq('is_active', true),
      supabase
        .from('user_preferences')
        .select('active_mode')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: true })
        .limit(1),
    ])
    if (data && data.length > 0) {
      setWallets(data)
      // Smart default: pilih wallet yang sesuai mode aktif (tetap bisa diganti)
      const activeMode = prefsRows?.[0]?.active_mode || 'personal'
      const matched = data.find(w => w.wallet_function === activeMode)
      setSelectedWallet((matched || data[0]).id)
      setToWallet(data.length > 1 ? data[1].id : data[0].id)
    }
  }

  const fetchProjects = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('projects')
      .select('id, name, client_name')
      .eq('user_id', user?.id)
      .eq('status', 'aktif')
      .order('created_at', { ascending: false })
    if (data) {
      setProjects(data)
    }
  }

  const fetchProducts = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('products')
      .select('id, name, unit, buy_price, sell_price, stock_qty')
      .eq('user_id', user?.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (data) {
      setProducts(data)
    }
  }

  // Scan struk: kamera (native) / galeri (web) → Claude Vision baca → isi form
  const CAT_MAP: Record<string, string> = {
    makanan: 'Makan & Minum', belanja: 'Belanja', transport: 'Transport',
    hiburan: 'Hiburan', kesehatan: 'Kesehatan', tagihan: 'Tagihan', pendidikan: 'Pendidikan',
  }

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
        result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true })
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: true })
      }
      if (result.canceled || !result.assets?.[0]?.base64) return

      const asset = result.assets[0]
      const base64 = asset.base64 as string
      const mimeType = asset.uri?.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
      setScanning(true)

      const prompt = `Analisis struk belanja ini, extract data sebagai JSON:
{"store_name":"nama toko","date":"YYYY-MM-DD","total":<angka tanpa titik>,"category":"makanan/belanja/transport/hiburan/kesehatan/tagihan/pendidikan/lainnya"}
Return ONLY valid JSON, tanpa markdown.`

      const res = await claudeVision(base64, mimeType, prompt)
      const clean = res.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const data = JSON.parse(clean)

      // Isi form (user tinggal cek & Simpan)
      setType('expense')
      if (data.total) setAmount(Number(String(data.total).replace(/[^0-9]/g, '')).toLocaleString('id-ID'))
      setCategory(CAT_MAP[String(data.category || '').toLowerCase()] || 'Lainnya')
      if (data.store_name) setNote(`Struk: ${data.store_name}`)
      if (typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) setSelectedDate(data.date)

      notify('Struk Terbaca ✅', 'Cek datanya dulu, lalu tap Simpan.')
    } catch {
      notify('Gagal Baca Struk', 'Pastikan foto struk jelas, lalu coba lagi.')
    } finally {
      setScanning(false)
    }
  }

  // Auto-hitung nominal saat jual produk: harga jual × qty
  useEffect(() => {
    if (linkType === 'product' && selectedProduct) {
      const product = products.find(p => p.id === selectedProduct)
      const qty = parseInt(productQty) || 0
      if (product) {
        const total = product.sell_price * qty
        setAmount(total ? total.toLocaleString('id-ID') : '')
      }
    }
  }, [linkType, selectedProduct, productQty, products])

  // Jual produk = penjualan = income. Reset produk kalau ganti ke expense.
  useEffect(() => {
    if (type === 'expense' && linkType === 'product') {
      setLinkType('none')
      setSelectedProduct('')
    }
  }, [type])

  const formatRupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

  const formatDateLabel = (d: string) => {
    const [y, m, day] = d.split('-')
    return `${day} ${MONTHS[parseInt(m) - 1]} ${y}`
  }

  // getBudgetWarning() dihapus — duplicate dengan budget-monitor edge function
  // Budget alert sekarang datang dari notifications table via Realtime

  const handleSave = async () => {
    if (!amount) {
      notify('Oops', 'Nominal harus diisi ya')
      return
    }
    if (type !== 'transfer' && !category) {
      notify('Oops', 'Kategori harus diisi ya')
      return
    }
    if (!selectedWallet) {
      notify('Oops', 'Pilih dompet dulu ya')
      return
    }
    if (type === 'transfer' && wallets.length <= 1) {
      notify('Oops', 'Butuh minimal 2 dompet untuk transfer')
      return
    }
    if (type === 'transfer' && toWallet === selectedWallet) {
      notify('Oops', 'Dompet asal dan tujuan tidak boleh sama')
      return
    }

    // Transaksi valas butuh kurs untuk mengunci nilai rupiahnya. Tanpa kurs,
    // laporan akan menganggap "50" itu Rp 50 — jadi lebih baik ditolak.
    if (foreignTx && type !== 'transfer' && !(effectiveRate > 0)) {
      notify('Kurs Belum Ada', `Kurs ${txCurrency} belum termuat, jadi nilai rupiahnya belum bisa dihitung. Coba lagi sebentar atau isi kurs manual.`)
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const nominal = parseAmountInput(amount)

    if (type === 'transfer') {
      const fromWalletData = wallets.find(w => w.id === selectedWallet)
      const toWalletData = wallets.find(w => w.id === toWallet)

      if (!fromWalletData || !toWalletData) {
        notify('Error', 'Data dompet tidak ditemukan')
        setLoading(false)
        return
      }

      if (fromWalletData.current_balance < nominal) {
        notify('Saldo Tidak Cukup', `Saldo ${fromWalletData.wallet_name}: ${formatMoney(fromWalletData.current_balance, fromWalletData.currency)}`)
        setLoading(false)
        return
      }

      // Tukar valas: dompet asal & tujuan beda mata uang, jadi kedua kaki
      // transfer punya NOMINAL BERBEDA (mis. keluar Rp 1.180.000, masuk S$100).
      // Nilai rupiahnya sama supaya laporan tetap seimbang.
      const fromCur   = fromWalletData.currency || 'IDR'
      const toCur     = toWalletData.currency || 'IDR'
      const isExchange = fromCur !== toCur
      const received  = isExchange ? parseAmountInput(receiveAmount) : nominal

      if (isExchange && !(received > 0)) {
        notify('Oops', `Isi jumlah ${toCur} yang kamu terima`)
        setLoading(false)
        return
      }

      // Kurs riil transaksi = perbandingan kedua sisi, jadi spread & biaya bank
      // ikut terhitung tanpa perlu kolom biaya terpisah.
      const idrValue = isExchange
        ? (fromCur === 'IDR' ? nominal : received)   // sisi rupiah adalah nilai rupiahnya
        : (isForeign(fromCur) ? nominal * effectiveRate : nominal)

      if (isExchange && fromCur !== 'IDR' && toCur !== 'IDR') {
        notify('Belum Didukung', 'Tukar langsung antar dua mata uang asing belum bisa. Tukar ke rupiah dulu ya.')
        setLoading(false)
        return
      }

      // Buat ID unik untuk linking kedua transaksi
      const chainId = `transfer-${Date.now()}`

      const { data: expenseTxn, error: e1 } = await supabase.from('transactions').insert({
        user_id: user?.id,
        amount: nominal,
        currency: fromCur,
        amount_idr: idrValue,
        fx_rate: isForeign(fromCur) ? idrValue / nominal : null,
        type: 'expense',
        category: 'Transfer',
        note: `Transfer ke ${toWalletData.wallet_name}${note ? ' · ' + note : ''}`,
        source: 'manual',
        is_categorized: true,
        is_wallet_transfer: true,
        transaction_chain: chainId,
        wallet_source: selectedWallet,
        wallet_id: selectedWallet,
        date: selectedDate,
      }).select().single()

      if (e1) { notify('Gagal', e1.message); setLoading(false); return }

      const { error: e2 } = await supabase.from('transactions').insert({
        user_id: user?.id,
        amount: received,
        currency: toCur,
        amount_idr: idrValue,
        fx_rate: isForeign(toCur) ? idrValue / received : null,
        type: 'income',
        category: 'Transfer',
        note: `Transfer dari ${fromWalletData.wallet_name}${note ? ' · ' + note : ''}`,
        source: 'manual',
        is_categorized: true,
        is_wallet_transfer: true,
        transaction_chain: chainId,
        parent_transaction_id: expenseTxn?.id || null,
        wallet_source: toWallet,
        wallet_id: toWallet,
        date: selectedDate,
      })

      if (e2) { notify('Gagal', e2.message); setLoading(false); return }

      await supabase.from('user_wallets')
        .update({ current_balance: fromWalletData.current_balance - nominal })
        .eq('id', selectedWallet)

      // Beli valas: kurs rata-rata perolehan dompet tujuan dihitung ulang.
      const toUpdate: Record<string, unknown> = { current_balance: toWalletData.current_balance + received }
      let realized: number | null = null
      if (isExchange && isForeign(toCur)) {
        toUpdate.avg_buy_rate = weightedAvgRate(
          toWalletData.current_balance, toWalletData.avg_buy_rate, received, idrValue / received
        )
      }
      // Jual valas: kurs rata-rata TIDAK berubah (metode average cost); yang
      // terjadi adalah untung/rugi terealisasi sebesar selisih dengan modal.
      if (isExchange && isForeign(fromCur) && fromWalletData.avg_buy_rate) {
        realized = idrValue - nominal * fromWalletData.avg_buy_rate
      }
      await supabase.from('user_wallets').update(toUpdate).eq('id', toWallet)

      setLoading(false)
      router.replace('/(tabs)')
      setTimeout(() => {
        if (isExchange) {
          const kurs = fromCur === 'IDR' ? nominal / received : idrValue / nominal
          const cuan = realized !== null && Math.abs(realized) >= 1
            ? `\n\n${realized > 0 ? '🎉 Cuan' : '📉 Rugi'} ${formatDelta(realized)} terealisasi.`
            : ''
          notify(
            'Tukar Valas Berhasil! 💱',
            `${formatMoney(nominal, fromCur)} → ${formatMoney(received, toCur)}\nKurs ${formatMoney(kurs)} per ${fromCur === 'IDR' ? toCur : fromCur}${cuan}`
          )
        } else {
          notify('Transfer Berhasil! 🔄', `${formatMoney(nominal, fromCur)} berhasil dipindahkan dari ${fromWalletData.wallet_name} ke ${toWalletData.wallet_name}`)
        }
      }, 300)
      return
    } else {
      const wallet = wallets.find(w => w.id === selectedWallet)
      const isProductSale = linkType === 'product' && !!selectedProduct
      const product = isProductSale ? products.find(p => p.id === selectedProduct) : undefined
      const qty = parseInt(productQty) || 0

      // Validasi jual produk
      if (isProductSale) {
        if (!product || qty <= 0) {
          notify('Oops', 'Pilih produk dan jumlah yang valid')
          setLoading(false)
          return
        }
        if (qty > product.stock_qty) {
          notify('Stok Kurang', `Stok ${product.name} cuma ${product.stock_qty} ${product.unit}`)
          setLoading(false)
          return
        }
      }

      // Nilai rupiah DIKUNCI di sini. Semua laporan membaca amount_idr, jadi
      // angka bulan lalu tidak ikut bergerak saat kurs berubah.
      const amountIDR = foreignTx ? nominal * effectiveRate : nominal

      // Catatan: kolom wallet_function ADA di tabel wallets, BUKAN transactions.
      const { data: txn, error } = await supabase.from('transactions').insert({
        user_id: user?.id,
        amount: nominal,
        currency: txCurrency,
        amount_idr: amountIDR,
        fx_rate: foreignTx ? effectiveRate : null,
        type,
        category,
        note,
        source: 'manual',
        is_categorized: true,
        is_wallet_transfer: false,
        has_items: isProductSale,
        wallet_source: selectedWallet,
        wallet_id: selectedWallet,
        project_id: linkType === 'project' ? (selectedProject || null) : null,
        date: selectedDate,
      }).select().single()

      if (error) {
        notify('Gagal', error.message)
        setLoading(false)
        return
      }

      // Jual produk: catat item (HPP), stock movement (out), potong stok
      if (isProductSale && product && txn) {
        await supabase.from('transaction_items').insert({
          transaction_id: txn.id,
          product_id: product.id,
          qty,
          price_per_unit: product.sell_price,
          subtotal: product.sell_price * qty,
          hpp_per_unit: product.buy_price,
          hpp_total: product.buy_price * qty,
        })
        await supabase.from('stock_movements').insert({
          user_id: user?.id,
          product_id: product.id,
          transaction_id: txn.id,
          type: 'out',
          qty,
          price_per_unit: product.sell_price,
          note: `Penjualan - ${product.name}`,
        })
        await supabase.from('products')
          .update({ stock_qty: product.stock_qty - qty })
          .eq('id', product.id)
      }

      if (wallet) {
        // Saldo dompet selalu dalam mata uangnya sendiri, jadi pakai nominal asli.
        const newBalance = type === 'income'
          ? wallet.current_balance + nominal
          : wallet.current_balance - nominal

        const update: Record<string, unknown> = { current_balance: newBalance }
        // Valas masuk = menambah kepemilikan valas, jadi kurs rata-rata perolehan
        // dihitung ulang tertimbang — sama seperti "Tambah Posisi" di investasi.
        if (foreignTx && type === 'income') {
          update.avg_buy_rate = weightedAvgRate(
            wallet.current_balance, wallet.avg_buy_rate, nominal, effectiveRate
          )
        }
        await supabase.from('user_wallets').update(update).eq('id', selectedWallet)
      }

      // Trigger agents (fire and forget — tidak blok UI).
      // Kirim nilai rupiah: budget & anomali dibandingkan terhadap angka rupiah.
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          triggerAgents(session.access_token, { amount: amountIDR, type, category, note: note || '' })
        }
      })

      setLoading(false)

      // Auto redirect tanpa tunggu OK (prevent double submission)
      router.replace('/(tabs)')

      // Show success toast di home (jangan blocking)
      setTimeout(() => {
        notify('Berhasil! ✅', 'Transaksi berhasil dicatat')
      }, 300)
      return
    }

    setLoading(false)
  }

  // Rupiah: titik = pemisah ribuan. Valas: titik/koma = desimal (S$ 100,50).
  // Dua aturan ini tidak boleh dicampur — lihat parseAmountInput di lib/format.
  const formatMoneyInput = (text: string, currency: string): string => {
    if (isForeign(currency)) {
      const cleaned = text.replace(/[^\d.,]/g, '').replace(/,/g, '.')
      const parts = cleaned.split('.')
      return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned
    }
    const numbers = text.replace(/\D/g, '')
    const cleaned = numbers.replace(/^0+/, '') || (numbers ? '0' : '')
    return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  }

  const formatAmount = (text: string) => setAmount(formatMoneyInput(text, txCurrency))

  const typeColor = type === 'expense' ? RED : type === 'income' ? GREEN : PURPLE

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScanSourceSheet visible={scanSheet} onClose={() => setScanSheet(false)} onPick={runScan} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={TEXT_MAIN} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Catat Transaksi</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Type Toggle — segmented pill */}
        <View style={styles.typeToggle}>
          {(['income', 'expense', 'transfer'] as TxType[]).map((t) => {
            const c = t === 'income' ? GREEN : t === 'expense' ? RED : PURPLE
            return (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, type === t && { backgroundColor: c }]}
                onPress={() => setType(t)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={t === 'income' ? 'arrow-down' : t === 'expense' ? 'arrow-up' : 'swap-horizontal'}
                  size={15}
                  color={type === t ? '#fff' : c}
                />
                <Text style={[styles.typeText, type === t && styles.typeTextActive]}>
                  {t === 'income' ? 'Pemasukan' : t === 'expense' ? 'Pengeluaran' : 'Transfer'}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Scan Struk — kamera/galeri → auto-isi form (hasil dikonfirmasi user) */}
        {type !== 'transfer' && (
          <TouchableOpacity style={styles.scanBtn} onPress={handleScanStruk} disabled={scanning}>
            {scanning ? (
              <>
                <ActivityIndicator color={PRIMARY} size="small" />
                <Text style={styles.scanBtnText}>Membaca struk...</Text>
              </>
            ) : (
              <Text style={styles.scanBtnText}>📷 Scan Struk (auto-isi)</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Amount */}
        <View style={[styles.amountWrap, { borderColor: typeColor }]}>
          <Text style={styles.amountPrefix}>{txMeta.symbol}</Text>
          <TextInput
            style={styles.amountInput}
            placeholder={foreignTx ? '0,00' : '0'}
            placeholderTextColor="#444"
            value={amount}
            onChangeText={formatAmount}
            keyboardType="numeric"
          />
        </View>

        {/* Konversi + kurs — hanya untuk transaksi non-transfer di dompet valas */}
        {foreignTx && type !== 'transfer' && (
          <View style={styles.fxPanel}>
            <View style={styles.fxPanelRow}>
              <Text style={styles.fxPanelLabel}>Nilai rupiah</Text>
              <Text style={styles.fxPanelValue}>
                {effectiveRate > 0 ? `≈ ${formatMoney(previewIDR)}` : 'kurs belum termuat'}
              </Text>
            </View>
            <View style={styles.fxPanelRow}>
              <Text style={styles.fxPanelLabel}>Kurs</Text>
              <View style={styles.fxRateInputWrap}>
                <Text style={styles.fxRatePrefix}>Rp</Text>
                <TextInput
                  style={styles.fxRateInput}
                  placeholder={defaultRate ? String(Math.round(defaultRate)) : '0'}
                  placeholderTextColor="#8A96A3"
                  value={rateInput}
                  onChangeText={(t) => setRateInput(t.replace(/[^\d.,]/g, ''))}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <Text style={styles.fxPanelNote}>
              Nilai rupiah dikunci di angka ini — laporan bulan ini tidak akan berubah
              walau kurs bergerak. Kosongkan untuk pakai kurs BCA hari ini.
            </Text>
          </View>
        )}

        {/* Tukar valas: sisi yang diterima di dompet tujuan */}
        {type === 'transfer' && (() => {
          const toW = wallets.find(w => w.id === toWallet)
          const toCur = toW?.currency || 'IDR'
          if (!toW || toCur === txCurrency) return null
          const got = parseAmountInput(receiveAmount)
          const paid = parseAmountInput(amount)
          const kurs = got > 0 && paid > 0
            ? (txCurrency === 'IDR' ? paid / got : paid > 0 ? got / paid : 0)
            : 0
          const foreignCode = txCurrency === 'IDR' ? toCur : txCurrency
          const market = rates[foreignCode]
          return (
            <View style={styles.fxPanel}>
              <Text style={styles.fxPanelTitle}>💱 Tukar {txCurrency} → {toCur}</Text>
              <View style={styles.fxPanelRow}>
                <Text style={styles.fxPanelLabel}>Diterima ({toCur})</Text>
                <View style={styles.fxRateInputWrap}>
                  <Text style={styles.fxRatePrefix}>{currencyMeta(toCur).symbol}</Text>
                  <TextInput
                    style={styles.fxRateInput}
                    placeholder={isForeign(toCur) ? '0,00' : '0'}
                    placeholderTextColor="#8A96A3"
                    value={receiveAmount}
                    onChangeText={(t) => setReceiveAmount(formatMoneyInput(t, toCur))}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              {kurs > 0 && (
                <View style={styles.fxPanelRow}>
                  <Text style={styles.fxPanelLabel}>Kurs kamu</Text>
                  <Text style={styles.fxPanelValue}>{formatMoney(kurs)} / {foreignCode}</Text>
                </View>
              )}
              {kurs > 0 && market && (
                <Text style={styles.fxPanelNote}>
                  Kurs BCA hari ini: beli {formatMoney(market.buy)} / jual {formatMoney(market.sell)}.
                </Text>
              )}
              <Text style={styles.fxPanelNote}>
                Isi apa adanya sesuai mutasi bank — selisih kurs & biaya admin otomatis ikut terhitung.
              </Text>
            </View>
          )
        })()}

        {/* Date */}
        <Text style={styles.label}>Tanggal</Text>
        <TouchableOpacity
          style={styles.dateBtn}
          onPress={() => setShowDatePicker(!showDatePicker)}
        >
          <Text style={styles.dateBtnText}>📅 {formatDateLabel(selectedDate)}</Text>
          <Text style={styles.dateBtnArrow}>{showDatePicker ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DatePicker value={selectedDate} onChange={(d) => { setSelectedDate(d); setShowDatePicker(false) }} />
        )}

        {/* Wallet */}
        {wallets.length > 0 && (
          <>
            <Text style={styles.label}>{type === 'transfer' ? 'Dari Dompet' : 'Dompet'}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={styles.walletRow}>
                {wallets.map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    style={[styles.walletBtn, selectedWallet === w.id && styles.walletBtnActive]}
                    onPress={() => setSelectedWallet(w.id)}
                  >
                    <Text style={styles.walletIcon}>{w.icon}</Text>
                    <View>
                      <Text style={[styles.walletName, selectedWallet === w.id && styles.walletNameActive]}>
                        {w.wallet_name}
                      </Text>
                      <Text style={styles.walletBalance}>{formatRupiah(w.current_balance)}</Text>
                      <Text style={[styles.walletBadge, { color: w.wallet_function === 'business' ? GREEN : PRIMARY }]}>
                        {w.wallet_function === 'business' ? '💼 Bisnis' : '👤 Pribadi'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </>
        )}

        {/* To Wallet (transfer only) */}
        {type === 'transfer' && wallets.length <= 1 && (
          <View style={styles.transferWarning}>
            <Text style={styles.transferWarningText}>
              ⚠️ Butuh minimal 2 dompet untuk transfer. Tambah dompet baru dulu di tab Profil.
            </Text>
          </View>
        )}
        {type === 'transfer' && wallets.length > 1 && (
          <>
            <Text style={styles.label}>Ke Dompet</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={styles.walletRow}>
                {wallets.filter(w => w.id !== selectedWallet).map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    style={[styles.walletBtn, toWallet === w.id && { borderColor: PURPLE, borderWidth: 2 }]}
                    onPress={() => setToWallet(w.id)}
                  >
                    <Text style={styles.walletIcon}>{w.icon}</Text>
                    <View>
                      <Text style={[styles.walletName, toWallet === w.id && { color: PURPLE }]}>
                        {w.wallet_name}
                      </Text>
                      <Text style={styles.walletBalance}>{formatRupiah(w.current_balance)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </>
        )}

        {/* Category (bukan transfer) */}
        {type !== 'transfer' && (
          <>
            <Text style={styles.label}>Kategori</Text>
            <View style={styles.categoryGrid}>
              {(type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catBtn, category === cat && { backgroundColor: typeColor, borderColor: typeColor }]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.catText, category === cat && styles.catTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Kaitkan ke (opsional): Tidak ada / Project / Produk.
            Tampil kalau ada proyek atau produk. Kalau "Tidak ada" = transaksi biasa. */}
        {type !== 'transfer' && (projects.length > 0 || products.length > 0) && (
          <>
            <Text style={styles.label}>Kaitkan ke (opsional)</Text>
            <View style={styles.linkTabs}>
              <TouchableOpacity
                style={[styles.linkTab, linkType === 'none' && styles.linkTabActive]}
                onPress={() => { setLinkType('none'); setSelectedProject(''); setSelectedProduct('') }}
              >
                <Text style={[styles.linkTabText, linkType === 'none' && styles.linkTabTextActive]}>Tidak ada</Text>
              </TouchableOpacity>
              {projects.length > 0 && (
                <TouchableOpacity
                  style={[styles.linkTab, linkType === 'project' && styles.linkTabActive]}
                  onPress={() => { setLinkType('project'); setSelectedProduct('') }}
                >
                  <Text style={[styles.linkTabText, linkType === 'project' && styles.linkTabTextActive]}>📁 Project</Text>
                </TouchableOpacity>
              )}
              {products.length > 0 && type === 'income' && (
                <TouchableOpacity
                  style={[styles.linkTab, linkType === 'product' && styles.linkTabActive]}
                  onPress={() => { setLinkType('product'); setSelectedProject('') }}
                >
                  <Text style={[styles.linkTabText, linkType === 'product' && styles.linkTabTextActive]}>📦 Jual Produk</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Picker Project */}
            {linkType === 'project' && (
              <TouchableOpacity style={styles.projectPicker} onPress={() => setShowProjectPicker(true)}>
                <Text style={styles.projectPickerText}>
                  {selectedProject
                    ? projects.find(p => p.id === selectedProject)?.name || 'Pilih Project'
                    : 'Pilih Project'}
                </Text>
                <Text style={styles.projectPickerArrow}>›</Text>
              </TouchableOpacity>
            )}

            {/* Picker Produk + Qty (nominal auto = harga jual × qty) */}
            {linkType === 'product' && (
              <>
                <TouchableOpacity style={styles.projectPicker} onPress={() => setShowProductPicker(true)}>
                  <Text style={styles.projectPickerText}>
                    {selectedProduct
                      ? products.find(p => p.id === selectedProduct)?.name || 'Pilih Produk'
                      : 'Pilih Produk'}
                  </Text>
                  <Text style={styles.projectPickerArrow}>›</Text>
                </TouchableOpacity>
                {selectedProduct && (
                  <>
                    <Text style={[styles.label, { marginTop: 12 }]}>Jumlah (Qty)</Text>
                    <View style={styles.qtyRow}>
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => setProductQty(String(Math.max(1, (parseInt(productQty) || 1) - 1)))}
                      >
                        <Text style={styles.qtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={styles.qtyInput}
                        value={productQty}
                        onChangeText={(t) => setProductQty(t.replace(/\D/g, '') || '')}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={styles.qtyBtn}
                        onPress={() => setProductQty(String((parseInt(productQty) || 0) + 1))}
                      >
                        <Text style={styles.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    {(() => {
                      const p = products.find(p => p.id === selectedProduct)
                      const qty = parseInt(productQty) || 0
                      if (!p) return null
                      return (
                        <Text style={styles.productInfo}>
                          Stok: {p.stock_qty} {p.unit} · Harga: {formatRupiah(p.sell_price)} · Total: {formatRupiah(p.sell_price * qty)}
                          {qty > p.stock_qty ? '  ⚠️ Stok kurang!' : ''}
                        </Text>
                      )
                    })()}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* Note */}
        <Text style={styles.label}>Catatan (opsional)</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="Tambah catatan..."
          placeholderTextColor="#888780"
          value={note}
          onChangeText={setNote}
          multiline
        />

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: typeColor }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>
                {type === 'transfer' ? 'Simpan Transfer' : 'Simpan Transaksi'}
              </Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Project Picker Modal */}
      <Modal visible={showProjectPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih Project</Text>
              <TouchableOpacity onPress={() => setShowProjectPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {projects.map((project) => (
                <TouchableOpacity
                  key={project.id}
                  style={styles.projectOption}
                  onPress={() => {
                    setSelectedProject(project.id)
                    setShowProjectPicker(false)
                  }}
                >
                  <View>
                    <Text style={styles.projectOptionName}>{project.name}</Text>
                    {project.client_name && (
                      <Text style={styles.projectOptionClient}>{project.client_name}</Text>
                    )}
                  </View>
                  {selectedProject === project.id && (
                    <Text style={styles.projectOptionCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Product Picker Modal */}
      <Modal visible={showProductPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih Produk</Text>
              <TouchableOpacity onPress={() => setShowProductPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {products.map((product) => (
                <TouchableOpacity
                  key={product.id}
                  style={styles.projectOption}
                  onPress={() => {
                    setSelectedProduct(product.id)
                    setProductQty('1')
                    setShowProductPicker(false)
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.projectOptionName}>{product.name}</Text>
                    <Text style={styles.projectOptionClient}>
                      Stok: {product.stock_qty} {product.unit} · {formatRupiah(product.sell_price)}
                    </Text>
                  </View>
                  {selectedProduct === product.id && (
                    <Text style={styles.projectOptionCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const CARD = COLORS.card
const BORDER = COLORS.border
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_APP },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, backgroundColor: CARD,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: BG_APP },
  headerTitle: { fontSize: 17, fontWeight: '700', color: TEXT_MAIN },
  scroll: { flex: 1, paddingHorizontal: 16 },
  typeToggle: {
    flexDirection: 'row', backgroundColor: '#F1F4F9',
    borderRadius: RADIUS.md, padding: 4, marginTop: 16, marginBottom: 20, gap: 4,
  },
  typeBtn: { flex: 1, flexDirection: 'row', gap: 5, paddingVertical: 11, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  typeText: { fontSize: 12.5, color: TEXT_MUTED, fontWeight: '700' },
  typeTextActive: { color: '#fff', fontWeight: '700' },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY + '12', borderRadius: RADIUS.md, paddingVertical: 14, marginBottom: 16,
    borderWidth: 1, borderColor: PRIMARY + '30',
  },
  scanBtnText: { fontSize: 14, fontWeight: '700', color: PRIMARY },
  amountWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: CARD,
    borderRadius: RADIUS.lg, paddingHorizontal: 20, marginBottom: 20,
    borderWidth: 1.5, ...SHADOW.card,
  },
  amountPrefix: { fontSize: 24, color: TEXT_MUTED, marginRight: 8, fontWeight: '700' },
  amountInput: { flex: 1, fontSize: 32, fontWeight: '800', color: TEXT_MAIN, paddingVertical: 16 },
  fxPanel: {
    backgroundColor: '#EEF4FD', borderRadius: RADIUS.md, padding: 14,
    marginBottom: 20, borderWidth: 1, borderColor: PRIMARY + '30',
  },
  fxPanelTitle: { fontSize: 13, fontWeight: '700', color: PRIMARY, marginBottom: 10 },
  fxPanelRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  fxPanelLabel: { fontSize: 13, color: TEXT_MUTED },
  fxPanelValue: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN },
  fxRateInputWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: PRIMARY + '30',
    minWidth: 130,
  },
  fxRatePrefix: { fontSize: 12, color: TEXT_MUTED, marginRight: 6 },
  fxRateInput: { flex: 1, fontSize: 14, fontWeight: '700', color: TEXT_MAIN, paddingVertical: 8, textAlign: 'right' },
  fxPanelNote: { fontSize: 11, color: TEXT_MUTED, lineHeight: 16, marginTop: 4 },
  label: { fontSize: 12, fontWeight: '700', color: TEXT_MUTED, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: CARD, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 12, borderWidth: 1, borderColor: BORDER,
  },
  dateBtnText: { fontSize: 14, color: TEXT_MAIN, fontWeight: '600' },
  dateBtnArrow: { fontSize: 12, color: TEXT_MUTED },
  walletRow: { flexDirection: 'row', gap: 10 },
  walletBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: CARD, borderRadius: RADIUS.md, padding: 12,
    borderWidth: 1, borderColor: BORDER, minWidth: 150,
  },
  walletBtnActive: { borderColor: PRIMARY, borderWidth: 2 },
  walletIcon: { fontSize: 22 },
  walletName: { fontSize: 13, fontWeight: '700', color: TEXT_MAIN },
  walletNameActive: { color: PRIMARY },
  walletBalance: { fontSize: 11, color: TEXT_MUTED, marginTop: 2 },
  walletBadge: { fontSize: 10, fontWeight: '700', marginTop: 3 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  catBtn: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.pill,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  catText: { fontSize: 12, color: TEXT_MUTED, fontWeight: '600' },
  catTextActive: { color: '#fff', fontWeight: '700' },
  noteInput: {
    backgroundColor: CARD, borderRadius: RADIUS.md, padding: 14,
    fontSize: 14, color: TEXT_MAIN, borderWidth: 1, borderColor: BORDER,
    minHeight: 80, marginBottom: 24, textAlignVertical: 'top',
  },
  saveBtn: {
    height: 54, borderRadius: RADIUS.lg,
    alignItems: 'center', justifyContent: 'center', marginBottom: 30,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  transferWarning: {
    backgroundColor: '#FFF7E6', borderRadius: RADIUS.md, padding: 14,
    borderWidth: 1, borderColor: COLORS.warning + '60', marginBottom: 16,
  },
  transferWarningText: { fontSize: 13, color: '#9A6700', lineHeight: 20 },
  linkTabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  linkTab: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.pill,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  linkTabActive: { backgroundColor: PRIMARY + '15', borderColor: PRIMARY },
  linkTabText: { fontSize: 13, color: TEXT_MUTED, fontWeight: '600' },
  linkTabTextActive: { color: PRIMARY, fontWeight: '700' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  qtyBtn: {
    width: 44, height: 44, borderRadius: RADIUS.md, backgroundColor: CARD,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BORDER,
  },
  qtyBtnText: { fontSize: 22, color: TEXT_MAIN, fontWeight: '700' },
  qtyInput: {
    flex: 1, height: 44, backgroundColor: CARD, borderRadius: RADIUS.md,
    textAlign: 'center', fontSize: 16, color: TEXT_MAIN, borderWidth: 1, borderColor: BORDER,
  },
  productInfo: { fontSize: 12, color: TEXT_MUTED, marginBottom: 16, lineHeight: 18 },
  projectPicker: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: CARD, borderRadius: RADIUS.md, paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 8, borderWidth: 1, borderColor: BORDER,
  },
  projectPickerText: { fontSize: 14, color: TEXT_MAIN, fontWeight: '600' },
  projectPickerArrow: { fontSize: 18, color: TEXT_MUTED },
  clearProjectBtn: {
    alignSelf: 'flex-start', marginBottom: 16, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, backgroundColor: RED + '12', borderWidth: 1, borderColor: RED + '30',
  },
  clearProjectText: { fontSize: 12, color: RED, fontWeight: '600' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: CARD, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: TEXT_MAIN },
  modalClose: { fontSize: 24, color: TEXT_MUTED },
  projectOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  projectOptionName: { fontSize: 15, fontWeight: '600', color: TEXT_MAIN },
  projectOptionClient: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  projectOptionCheck: { fontSize: 20, color: PRIMARY },
})
