import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  ScrollView, KeyboardAvoidingView, Platform, Modal
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '../lib/supabase'
import { confirmAsync, notify } from '../lib/alert'
import { CATEGORIES, Transaction } from '../types'
import { formatMoney, parseAmountInput } from '../lib/format'
import { isForeign, currencyMeta } from '../lib/fx'
import { isEditablePeriod, editableFromLabel } from '../lib/period'

const PRIMARY = '#185FA5'
const GREEN = '#1D9E75'
const RED = '#E24B4A'

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

type Wallet = {
  id: string
  wallet_name: string
  icon: string
  color: string
  current_balance: number
  currency?: string
}

type Project = { id: string; name: string; client_name: string | null; status: string }

export default function EditTransaksiScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedWallet, setSelectedWallet] = useState<string>('')
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [showProjectPicker, setShowProjectPicker] = useState(false)

  // Kunci periode: transaksi lebih lama dari 2 bulan kalender tidak boleh
  // diubah/dihapus. Dicek di sini (tampilan) DAN di handleSave/handleDelete
  // (penegakan), supaya semua jalan masuk ke layar ini kena aturan yang sama.
  const locked = !!transaction && !isEditablePeriod(transaction.date)

  // Mata uang transaksi mengikuti dompetnya; transaksi lama default rupiah.
  const txCurrency = wallets.find(w => w.id === selectedWallet)?.currency
    || transaction?.currency || 'IDR'

  useEffect(() => {
    fetchData()
  }, [id])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()

    const [{ data: txn }, { data: walletsData }, { data: projectRows }] = await Promise.all([
      supabase.from('transactions').select('*').eq('id', id).single(),
      supabase.from('user_wallets').select('id, wallet_name, icon, color, current_balance, currency').eq('user_id', user?.id).eq('is_active', true),
      // Semua project (bukan hanya aktif) supaya kaitan ke project yang sudah
      // selesai tetap terbaca namanya, bukan tampil "Pilih Project".
      supabase.from('projects').select('id, name, client_name, status').eq('user_id', user?.id)
        .order('status', { ascending: true }).order('created_at', { ascending: false }),
    ])
    if (projectRows) setProjects(projectRows as Project[])

    if (txn) {
      setTransaction(txn)
      setType(txn.type === 'income' ? 'income' : 'expense')
      const cur = txn.currency || 'IDR'
      setAmount(isForeign(cur) ? String(txn.amount) : txn.amount.toLocaleString('id-ID').replace(/,/g, '.'))
      setCategory(txn.category || '')
      setNote(txn.note || '')
      setSelectedDate(txn.date || new Date().toISOString().split('T')[0])
      setSelectedWallet(txn.wallet_id || txn.wallet_source || '')
      setSelectedProject(txn.project_id || '')
    }

    if (walletsData) setWallets(walletsData)
    setLoading(false)
  }

  const formatAmount = (text: string) => {
    // Valas pakai titik/koma sebagai desimal; rupiah pakai titik sebagai ribuan.
    if (isForeign(txCurrency)) {
      const cleaned = text.replace(/[^\d.,]/g, '').replace(/,/g, '.')
      const parts = cleaned.split('.')
      setAmount(parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned)
      return
    }
    const numbers = text.replace(/\D/g, '')
    setAmount(numbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.'))
  }

  const formatRupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

  const formatDateLabel = (d: string) => {
    if (!d) return 'Pilih tanggal'
    const [y, m, day] = d.split('-')
    return `${day} ${MONTHS[parseInt(m) - 1]} ${y}`
  }

  const handleSave = async () => {
    if (locked) {
      notify('Periode Sudah Ditutup', `Transaksi sebelum ${editableFromLabel()} tidak bisa diubah lagi.`)
      return
    }
    if (!amount || !category) {
      Alert.alert('Oops', 'Nominal dan kategori harus diisi')
      return
    }
    // Tanggal juga tidak boleh DIPINDAHKAN ke periode tertutup — kalau tidak,
    // kunci di atas bisa dilewati lewat pintu belakang.
    if (!isEditablePeriod(selectedDate)) {
      notify('Periode Sudah Ditutup', `Tanggal transaksi hanya bisa dari ${editableFromLabel()} sampai sekarang.`)
      return
    }

    // Pindah dompet lintas mata uang tidak bisa ditangani di sini: saldo lama
    // dikembalikan dalam mata uang lama lalu dipotong dalam mata uang baru,
    // sehingga angkanya tercampur (Rp 100.000 jadi $100.000). Tolak dengan jelas.
    const originalCurrency = transaction?.currency || 'IDR'
    if (txCurrency !== originalCurrency) {
      notify(
        'Tidak Bisa Pindah Mata Uang',
        `Transaksi ini tercatat dalam ${originalCurrency} (${formatMoney(transaction?.amount ?? 0, originalCurrency)}), sedangkan dompet tujuan pakai ${txCurrency}. Hapus transaksi ini lalu catat ulang di dompet yang benar ya.`
      )
      return
    }

    setSaving(true)
    const nominal = parseAmountInput(amount)

    const oldWalletId = transaction?.wallet_id || transaction?.wallet_source || ''
    const oldAmount = transaction?.amount || 0
    const oldType = transaction?.type || 'expense'

    // Fetch saldo terkini langsung dari DB (bukan dari state yang bisa stale)
    const { data: freshWallets } = await supabase
      .from('user_wallets')
      .select('id, current_balance')
      .in('id', [...new Set([oldWalletId, selectedWallet].filter(Boolean))])

    const getBalance = (wId: string) =>
      freshWallets?.find(w => w.id === wId)?.current_balance ?? 0

    // Kembalikan saldo dari transaksi lama
    if (oldWalletId) {
      const restored = oldType === 'income'
        ? getBalance(oldWalletId) - oldAmount
        : getBalance(oldWalletId) + oldAmount
      await supabase.from('user_wallets').update({ current_balance: restored }).eq('id', oldWalletId)
    }

    // Nilai rupiah dikunci ulang pakai kurs asli transaksi ini (fx_rate), bukan
    // kurs hari ini — mengedit catatan lama tidak boleh menggeser laporan bulan itu.
    const lockedRate = transaction?.fx_rate || null
    const newAmountIDR = isForeign(txCurrency) && lockedRate
      ? nominal * lockedRate
      : nominal

    // Update transaksi
    const { error } = await supabase.from('transactions').update({
      amount: nominal,
      amount_idr: newAmountIDR,
      type,
      category,
      note,
      date: selectedDate,
      wallet_source: selectedWallet,
      wallet_id: selectedWallet,
      project_id: selectedProject || null,
    }).eq('id', id)

    if (error) {
      // Rollback wallet balance restore jika update transaksi gagal
      if (oldWalletId) {
        const { data: curr } = await supabase.from('user_wallets').select('current_balance').eq('id', oldWalletId).single()
        if (curr) {
          const rollback = oldType === 'income'
            ? curr.current_balance + oldAmount
            : curr.current_balance - oldAmount
          await supabase.from('user_wallets').update({ current_balance: rollback }).eq('id', oldWalletId)
        }
      }
      Alert.alert('Gagal', error.message)
      setSaving(false)
      return
    }

    // Apply saldo baru — re-fetch untuk dapat saldo setelah restore
    const { data: afterRestore } = await supabase
      .from('user_wallets')
      .select('id, current_balance')
      .eq('id', selectedWallet)
      .single()

    if (afterRestore) {
      const newBalance = type === 'income'
        ? afterRestore.current_balance + nominal
        : afterRestore.current_balance - nominal
      await supabase.from('user_wallets').update({ current_balance: newBalance }).eq('id', selectedWallet)
    }

    setSaving(false)
    router.replace('/(tabs)')
    setTimeout(() => notify('Berhasil! ✅', 'Transaksi berhasil diperbarui'), 300)
  }

  const handleDelete = async () => {
    if (locked) {
      notify('Periode Sudah Ditutup', `Transaksi sebelum ${editableFromLabel()} tidak bisa dihapus lagi.`)
      return
    }
    const ok = await confirmAsync(
      'Hapus Transaksi',
      'Yakin mau hapus transaksi ini? Saldo dompet akan dikembalikan.',
      'Hapus'
    )
    if (!ok) return

    const oldWalletId = transaction?.wallet_id || transaction?.wallet_source || ''
    const oldAmount = transaction?.amount || 0
    const oldType = transaction?.type || 'expense'

    if (oldWalletId && !transaction?.is_wallet_transfer) {
      const oldWallet = wallets.find(w => w.id === oldWalletId)
      if (oldWallet) {
        const restoredBalance = oldType === 'income'
          ? oldWallet.current_balance - oldAmount
          : oldWallet.current_balance + oldAmount
        await supabase.from('user_wallets').update({ current_balance: restoredBalance }).eq('id', oldWalletId)
      }
    }

    await supabase.from('transactions').delete().eq('id', id)
    router.replace('/(tabs)')
  }

  const typeColor = type === 'expense' ? RED : GREEN

  if (loading) return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator color={PRIMARY} />
    </View>
  )

  if (locked && transaction) {
    const isTransfer = transaction.is_wallet_transfer
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Kembali</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detail Transaksi</Text>
          <View style={{ width: 80 }} />
        </View>
        <View style={styles.transferInfo}>
          <Text style={styles.transferIcon}>🔒</Text>
          <Text style={styles.transferTitle}>Periode Sudah Ditutup</Text>
          <Text style={styles.transferDesc}>
            Transaksi ini bertanggal {transaction.date}. Yang bisa diubah hanya
            transaksi dari {editableFromLabel()} sampai sekarang, supaya laporan
            bulan-bulan sebelumnya tidak berubah.
          </Text>
          <View style={styles.lockedCard}>
            <View style={styles.lockedRow}>
              <Text style={styles.lockedLabel}>{isTransfer ? 'Jenis' : 'Kategori'}</Text>
              <Text style={styles.lockedValue}>
                {isTransfer ? 'Transfer antar dompet' : (transaction.category || '-')}
              </Text>
            </View>
            <View style={styles.lockedRow}>
              <Text style={styles.lockedLabel}>Nominal</Text>
              <Text style={[styles.lockedValue, { color: transaction.type === 'income' ? GREEN : RED }]}>
                {transaction.type === 'income' ? '+' : '−'}{formatMoney(transaction.amount, transaction.currency)}
              </Text>
            </View>
            {!!transaction.note && (
              <View style={styles.lockedRow}>
                <Text style={styles.lockedLabel}>Catatan</Text>
                <Text style={styles.lockedValue} numberOfLines={3}>{transaction.note}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    )
  }

  if (transaction?.is_wallet_transfer) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.backBtn}>
            <Text style={styles.backText}>← Kembali</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detail Transaksi</Text>
          <View style={{ width: 80 }} />
        </View>
        <View style={styles.transferInfo}>
          <Text style={styles.transferIcon}>🔄</Text>
          <Text style={styles.transferTitle}>Transaksi Transfer</Text>
          <Text style={styles.transferDesc}>Transfer antar dompet tidak bisa diedit langsung. Hapus dan buat ulang jika perlu koreksi.</Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>🗑️ Hapus Transfer Ini</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.backBtn}>
          <Text style={styles.backText}>← Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Transaksi</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteHeaderBtn}>
          <Text style={styles.deleteHeaderText}>🗑️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Type Toggle */}
        <View style={styles.typeToggle}>
          <TouchableOpacity
            style={[styles.typeBtn, type === 'expense' && { backgroundColor: RED }]}
            onPress={() => setType('expense')}
          >
            <Text style={[styles.typeText, type === 'expense' && styles.typeTextActive]}>
              💸 Pengeluaran
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, type === 'income' && { backgroundColor: GREEN }]}
            onPress={() => setType('income')}
          >
            <Text style={[styles.typeText, type === 'income' && styles.typeTextActive]}>
              💰 Pemasukan
            </Text>
          </TouchableOpacity>
        </View>

        {/* Amount */}
        <View style={[styles.amountWrap, { borderColor: typeColor }]}>
          <Text style={styles.amountPrefix}>{currencyMeta(txCurrency).symbol}</Text>
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
            <Text style={styles.label}>Dompet</Text>
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
                      <Text style={styles.walletBalance}>{formatMoney(w.current_balance, w.currency)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </>
        )}

        {/* Category */}
        <Text style={styles.label}>Kategori</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
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

        {/* Project — bisa dikaitkan, diganti, atau dilepas */}
        <Text style={styles.label}>Project</Text>
        <View style={styles.projectRow}>
          <TouchableOpacity style={styles.projectPicker} onPress={() => setShowProjectPicker(true)}>
            <Text style={[styles.projectPickerText, !selectedProject && { color: '#888780' }]} numberOfLines={1}>
              {selectedProject
                ? (projects.find(p => p.id === selectedProject)?.name || 'Project tidak ditemukan')
                : 'Tidak dikaitkan ke project'}
            </Text>
            <Text style={styles.projectPickerArrow}>›</Text>
          </TouchableOpacity>
          {!!selectedProject && (
            <TouchableOpacity style={styles.projectClear} onPress={() => setSelectedProject('')} hitSlop={8}>
              <Text style={styles.projectClearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Note */}
        <Text style={styles.label}>Catatan</Text>
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
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Simpan Perubahan</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
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
              <TouchableOpacity
                style={styles.projectOption}
                onPress={() => { setSelectedProject(''); setShowProjectPicker(false) }}
              >
                <Text style={[styles.projectOptionName, { color: '#888780' }]}>Tidak dikaitkan</Text>
                {!selectedProject && <Text style={styles.projectOptionCheck}>✓</Text>}
              </TouchableOpacity>
              {projects.length === 0 && (
                <Text style={styles.projectEmpty}>Belum ada project. Buat dulu di menu Projects.</Text>
              )}
              {projects.map((project) => (
                <TouchableOpacity
                  key={project.id}
                  style={styles.projectOption}
                  onPress={() => { setSelectedProject(project.id); setShowProjectPicker(false) }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.projectOptionName}>{project.name}</Text>
                    <Text style={styles.projectOptionClient}>
                      {[project.client_name, project.status !== 'aktif' ? project.status : null]
                        .filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {selectedProject === project.id && <Text style={styles.projectOptionCheck}>✓</Text>}
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
  loadingWrap: { flex: 1, backgroundColor: '#0F0F0F', alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 0.5, borderBottomColor: '#2A2A2A',
  },
  backBtn: { width: 80 },
  backText: { fontSize: 14, color: PRIMARY },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  deleteHeaderBtn: { width: 80, alignItems: 'flex-end' },
  deleteHeaderText: { fontSize: 20 },
  scroll: { flex: 1, paddingHorizontal: 20 },
  typeToggle: {
    flexDirection: 'row', backgroundColor: '#1A1A1A',
    borderRadius: 12, padding: 3, marginTop: 20, marginBottom: 20, gap: 3,
  },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  typeText: { fontSize: 13, color: '#888780', fontWeight: '500' },
  typeTextActive: { color: '#fff', fontWeight: '600' },
  amountWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A',
    borderRadius: 16, paddingHorizontal: 20, marginBottom: 20, borderWidth: 1.5,
  },
  amountPrefix: { fontSize: 24, color: '#888780', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 32, fontWeight: '600', color: '#fff', paddingVertical: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#888780', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  projectRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 24 },
  projectPicker: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 48, backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 16,
    borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  projectPickerText: { fontSize: 15, color: '#fff', flex: 1 },
  projectPickerArrow: { fontSize: 20, color: '#888780', marginLeft: 8 },
  projectClear: {
    width: 40, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1A1A1A', borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  projectClearText: { fontSize: 14, color: '#888780' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  modalClose: { fontSize: 18, color: '#888780', padding: 4 },
  projectOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#2A2A2A', gap: 12,
  },
  projectOptionName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  projectOptionClient: { fontSize: 12, color: '#888780', marginTop: 2 },
  projectOptionCheck: { fontSize: 16, color: PRIMARY, fontWeight: '700' },
  projectEmpty: { fontSize: 13, color: '#888780', paddingVertical: 16, textAlign: 'center' },
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
    height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  deleteBtn: {
    height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: RED, marginTop: 12,
  },
  deleteBtnText: { color: RED, fontSize: 14, fontWeight: '600' },
  transferInfo: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  transferIcon: { fontSize: 48, marginBottom: 16 },
  transferTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 8 },
  transferDesc: { fontSize: 13, color: '#888780', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  lockedCard: {
    alignSelf: 'stretch', backgroundColor: '#1A1A1A', borderRadius: 12,
    padding: 14, borderWidth: 0.5, borderColor: '#2A2A2A', gap: 10,
  },
  lockedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  lockedLabel: { fontSize: 12, color: '#888780' },
  lockedValue: { fontSize: 13, fontWeight: '600', color: '#fff', flex: 1, textAlign: 'right' },
})
