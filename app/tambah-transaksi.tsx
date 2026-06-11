import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  ScrollView, KeyboardAvoidingView, Platform, Modal
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '../lib/supabase'
import { notify } from '../lib/alert'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types'

const PRIMARY = '#185FA5'
const GREEN = '#1D9E75'
const RED = '#E24B4A'
const PURPLE = '#534AB7'
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

  useEffect(() => {
    fetchWallets()
    fetchProjects()
  }, [])

  // Auto-select project from query param
  useEffect(() => {
    if (projectIdParam && projects.length > 0) {
      setSelectedProject(projectIdParam)
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

  // Reset project when switching wallet (in case new wallet is not business)
  useEffect(() => {
    const wallet = wallets.find(w => w.id === selectedWallet)
    if (wallet?.wallet_function !== 'business') {
      setSelectedProject('')
    }
  }, [selectedWallet])

  const fetchWallets = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('user_wallets')
      .select('id, wallet_name, wallet_function, icon, color, current_balance')
      .eq('user_id', user?.id)
      .eq('is_active', true)
    if (data && data.length > 0) {
      setWallets(data)
      setSelectedWallet(data[0].id)
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

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const nominal = parseFloat(amount.replace(/\./g, ''))

    if (type === 'transfer') {
      const fromWalletData = wallets.find(w => w.id === selectedWallet)
      const toWalletData = wallets.find(w => w.id === toWallet)

      if (!fromWalletData || !toWalletData) {
        notify('Error', 'Data dompet tidak ditemukan')
        setLoading(false)
        return
      }

      if (fromWalletData.current_balance < nominal) {
        notify('Saldo Tidak Cukup', `Saldo ${fromWalletData.wallet_name}: ${formatRupiah(fromWalletData.current_balance)}`)
        setLoading(false)
        return
      }

      // Buat ID unik untuk linking kedua transaksi
      const chainId = `transfer-${Date.now()}`

      const { data: expenseTxn, error: e1 } = await supabase.from('transactions').insert({
        user_id: user?.id,
        amount: nominal,
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
        amount: nominal,
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

      await supabase.from('user_wallets').update({ current_balance: fromWalletData.current_balance - nominal }).eq('id', selectedWallet)
      await supabase.from('user_wallets').update({ current_balance: toWalletData.current_balance + nominal }).eq('id', toWallet)

      setLoading(false)
      router.replace('/(tabs)')
      setTimeout(() => {
        notify('Transfer Berhasil! 🔄', `${formatRupiah(nominal)} berhasil dipindahkan dari ${fromWalletData.wallet_name} ke ${toWalletData.wallet_name}`)
      }, 300)
      return
    } else {
      // Get wallet to determine wallet_function
      const wallet = wallets.find(w => w.id === selectedWallet)

      const { error } = await supabase.from('transactions').insert({
        user_id: user?.id,
        amount: nominal,
        type,
        category,
        note,
        source: 'manual',
        is_categorized: true,
        is_wallet_transfer: false,
        wallet_source: selectedWallet,
        wallet_id: selectedWallet,
        wallet_function: wallet?.wallet_function || 'personal',
        project_id: selectedProject || null,
        date: selectedDate,
      })

      if (error) {
        notify('Gagal', error.message)
        setLoading(false)
        return
      }

      if (wallet) {
        const newBalance = type === 'income'
          ? wallet.current_balance + nominal
          : wallet.current_balance - nominal
        await supabase.from('user_wallets').update({ current_balance: newBalance }).eq('id', selectedWallet)
      }

      // Trigger agents (fire and forget — tidak blok UI)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          triggerAgents(session.access_token, { amount: nominal, type, category, note: note || '' })
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

  const formatAmount = (text: string) => {
    const numbers = text.replace(/\D/g, '')

    // Prevent leading zeros (e.g., "0123" → "123", "00" → "0")
    const cleaned = numbers.replace(/^0+/, '') || (numbers ? '0' : '')

    const formatted = cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    setAmount(formatted)
  }

  const typeColor = type === 'expense' ? RED : type === 'income' ? GREEN : PURPLE

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Catat Transaksi</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Type Toggle */}
        <View style={styles.typeToggle}>
          {(['expense', 'income', 'transfer'] as TxType[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[
                styles.typeBtn,
                type === t && { backgroundColor: t === 'expense' ? RED : t === 'income' ? GREEN : PURPLE }
              ]}
              onPress={() => setType(t)}
            >
              <Text style={[styles.typeText, type === t && styles.typeTextActive]}>
                {t === 'expense' ? '💸 Keluar' : t === 'income' ? '💰 Masuk' : '🔄 Transfer'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Amount */}
        <View style={[styles.amountWrap, { borderColor: typeColor }]}>
          <Text style={styles.amountPrefix}>Rp</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0"
            placeholderTextColor="#444"
            value={amount}
            onChangeText={formatAmount}
            keyboardType="numeric"
          />
        </View>

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

        {/* Project (hanya untuk business wallet) */}
        {type !== 'transfer' && wallets.find(w => w.id === selectedWallet)?.wallet_function === 'business' && projects.length > 0 && (
          <>
            <Text style={styles.label}>Project (opsional)</Text>
            <TouchableOpacity
              style={styles.projectPicker}
              onPress={() => setShowProjectPicker(true)}
            >
              <Text style={styles.projectPickerText}>
                {selectedProject
                  ? projects.find(p => p.id === selectedProject)?.name || 'Pilih Project'
                  : 'Pilih Project (Opsional)'}
              </Text>
              <Text style={styles.projectPickerArrow}>›</Text>
            </TouchableOpacity>
            {selectedProject && (
              <TouchableOpacity
                style={styles.clearProjectBtn}
                onPress={() => setSelectedProject('')}
              >
                <Text style={styles.clearProjectText}>✕ Hapus Project</Text>
              </TouchableOpacity>
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
                {type === 'transfer' ? '🔄 Simpan Transfer' : '✅ Simpan Transaksi'}
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
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  typeToggle: {
    flexDirection: 'row', backgroundColor: '#1A1A1A',
    borderRadius: 12, padding: 3, marginTop: 20, marginBottom: 20, gap: 3,
  },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  typeText: { fontSize: 12, color: '#888780', fontWeight: '500' },
  typeTextActive: { color: '#fff', fontWeight: '600' },
  amountWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A',
    borderRadius: 16, paddingHorizontal: 20, marginBottom: 20,
    borderWidth: 1.5,
  },
  amountPrefix: { fontSize: 24, color: '#888780', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 32, fontWeight: '600', color: '#fff', paddingVertical: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#888780', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 12, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  dateBtnText: { fontSize: 14, color: '#fff' },
  dateBtnArrow: { fontSize: 12, color: '#888780' },
  walletRow: { flexDirection: 'row', gap: 10 },
  walletBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 12,
    borderWidth: 0.5, borderColor: '#2A2A2A', minWidth: 140,
  },
  walletBtnActive: { borderColor: PRIMARY, borderWidth: 2 },
  walletIcon: { fontSize: 22 },
  walletName: { fontSize: 13, fontWeight: '600', color: '#fff' },
  walletNameActive: { color: PRIMARY },
  walletBalance: { fontSize: 11, color: '#888780', marginTop: 2 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  catBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1A1A1A', borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  catText: { fontSize: 12, color: '#888780' },
  catTextActive: { color: '#fff', fontWeight: '600' },
  noteInput: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14,
    fontSize: 14, color: '#fff', borderWidth: 0.5, borderColor: '#2A2A2A',
    minHeight: 80, marginBottom: 24, textAlignVertical: 'top',
  },
  saveBtn: {
    height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  transferWarning: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#BA7517', marginBottom: 16,
  },
  transferWarningText: { fontSize: 13, color: '#BA7517', lineHeight: 20 },
  projectPicker: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 8, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  projectPickerText: { fontSize: 14, color: '#fff' },
  projectPickerArrow: { fontSize: 18, color: '#888780' },
  clearProjectBtn: {
    alignSelf: 'flex-start', marginBottom: 16, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, backgroundColor: '#2A1A1A', borderWidth: 0.5, borderColor: '#E24B4A30',
  },
  clearProjectText: { fontSize: 12, color: '#E24B4A' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 0.5, borderBottomColor: '#2A2A2A',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  modalClose: { fontSize: 24, color: '#888780' },
  projectOption: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: '#2A2A2A',
  },
  projectOptionName: { fontSize: 15, fontWeight: '600', color: '#fff' },
  projectOptionClient: { fontSize: 12, color: '#888780', marginTop: 2 },
  projectOptionCheck: { fontSize: 20, color: PRIMARY },
})
