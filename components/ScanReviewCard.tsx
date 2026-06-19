import { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, ScrollView, Modal,
} from 'react-native'

const PRIMARY = '#185FA5'
const GREEN = '#1D9E75'
const RED = '#E24B4A'

export interface ScanRow {
  flow: 'in' | 'out'
  amount: number
  description: string
  category: string
  include: boolean
}

interface WalletOpt {
  id: string
  wallet_name: string
  current_balance: number
}

interface Props {
  rows: ScanRow[]
  wallets: WalletOpt[]
  incomeCategories: string[]
  expenseCategories: string[]
  initialWalletId?: string
  loading?: boolean
  onSave: (rows: ScanRow[], walletId: string) => void
  onCancel: () => void
}

const rupiah = (n: number) => `Rp ${(n || 0).toLocaleString('id-ID')}`

export default function ScanReviewCard({
  rows: initialRows, wallets, incomeCategories, expenseCategories,
  initialWalletId, loading, onSave, onCancel,
}: Props) {
  const [rows, setRows] = useState<ScanRow[]>(initialRows)
  const [walletId, setWalletId] = useState<string>(
    initialWalletId || wallets[0]?.id || ''
  )
  const [catPickerFor, setCatPickerFor] = useState<number | null>(null)

  const update = (i: number, patch: Partial<ScanRow>) => {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  const included = rows.filter(r => r.include)
  const totalIn = included.filter(r => r.flow === 'in').reduce((s, r) => s + (r.amount || 0), 0)
  const totalOut = included.filter(r => r.flow === 'out').reduce((s, r) => s + (r.amount || 0), 0)
  const net = totalIn - totalOut

  const canSave = included.length > 0 && !!walletId && included.every(r => r.amount > 0)

  const pickerOptions = catPickerFor !== null
    ? (rows[catPickerFor].flow === 'in' ? incomeCategories : expenseCategories)
    : []

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>🧾 Hasil Scan</Text>
        <Text style={styles.countBadge}>{included.length} transaksi</Text>
      </View>

      {/* Pilih dompet */}
      <Text style={styles.sectionLabel}>Masuk/keluar dari dompet:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.walletRow}>
        {wallets.map(w => (
          <TouchableOpacity
            key={w.id}
            style={[styles.walletChip, walletId === w.id && styles.walletChipActive]}
            onPress={() => setWalletId(w.id)}
          >
            <Text style={[styles.walletChipText, walletId === w.id && styles.walletChipTextActive]}>
              {w.wallet_name}
            </Text>
            <Text style={[styles.walletChipBal, walletId === w.id && styles.walletChipTextActive]}>
              {rupiah(w.current_balance)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Daftar transaksi */}
      <ScrollView style={styles.list} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {rows.map((r, i) => (
          <View key={i} style={[styles.rowItem, !r.include && styles.rowItemOff]}>
            {/* Toggle include */}
            <TouchableOpacity style={styles.check} onPress={() => update(i, { include: !r.include })}>
              <Text style={styles.checkText}>{r.include ? '☑' : '☐'}</Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              {/* Baris atas: arah + nominal */}
              <View style={styles.rowTop}>
                <TouchableOpacity
                  style={[styles.flowPill, { backgroundColor: (r.flow === 'in' ? GREEN : RED) + '22' }]}
                  onPress={() => update(i, { flow: r.flow === 'in' ? 'out' : 'in' })}
                >
                  <Text style={[styles.flowText, { color: r.flow === 'in' ? GREEN : RED }]}>
                    {r.flow === 'in' ? '↓ Masuk' : '↑ Keluar'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.amountWrap}>
                  <Text style={styles.rp}>Rp</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={r.amount ? String(r.amount) : ''}
                    onChangeText={t => update(i, { amount: parseInt(t.replace(/[^0-9]/g, ''), 10) || 0 })}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              {/* Keterangan */}
              {!!r.description && <Text style={styles.desc} numberOfLines={1}>{r.description}</Text>}

              {/* Kategori (tap untuk ubah) */}
              <TouchableOpacity style={styles.catChip} onPress={() => setCatPickerFor(i)}>
                <Text style={styles.catText}>🏷️ {r.category}  ▾</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Ringkasan */}
      <View style={styles.summary}>
        <Text style={styles.sumLine}>Masuk: <Text style={{ color: GREEN }}>{rupiah(totalIn)}</Text></Text>
        <Text style={styles.sumLine}>Keluar: <Text style={{ color: RED }}>{rupiah(totalOut)}</Text></Text>
        <Text style={styles.sumNet}>
          Efek saldo: <Text style={{ color: net >= 0 ? GREEN : RED }}>{net >= 0 ? '+' : '−'}{rupiah(Math.abs(net))}</Text>
        </Text>
      </View>

      {/* Aksi */}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onCancel} disabled={loading}>
          <Text style={styles.cancelText}>Batal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.saveBtn, !canSave && styles.saveBtnOff]}
          onPress={() => canSave && onSave(included, walletId)}
          disabled={loading || !canSave}
        >
          {loading ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveText}>✅ Simpan {included.length} transaksi</Text>}
        </TouchableOpacity>
      </View>

      {/* Modal pilih kategori */}
      <Modal visible={catPickerFor !== null} transparent animationType="fade" onRequestClose={() => setCatPickerFor(null)}>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setCatPickerFor(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pilih Kategori</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {pickerOptions.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={styles.catOption}
                  onPress={() => {
                    if (catPickerFor !== null) update(catPickerFor, { category: cat })
                    setCatPickerFor(null)
                  }}
                >
                  <Text style={styles.catOptionText}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16, marginVertical: 8,
    borderWidth: 1, borderColor: PRIMARY + '40',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: '#fff' },
  countBadge: {
    fontSize: 11, fontWeight: '700', color: PRIMARY,
    backgroundColor: PRIMARY + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  sectionLabel: { fontSize: 12, color: '#888780', marginBottom: 6 },
  walletRow: { flexGrow: 0, marginBottom: 12 },
  walletChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8,
    backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: '#2A2A2A', minWidth: 110,
  },
  walletChipActive: { borderColor: PRIMARY, backgroundColor: PRIMARY + '18' },
  walletChipText: { fontSize: 13, fontWeight: '600', color: '#ccc' },
  walletChipBal: { fontSize: 11, color: '#888780', marginTop: 2 },
  walletChipTextActive: { color: '#fff' },
  list: { maxHeight: 320 },
  rowItem: {
    flexDirection: 'row', gap: 10, backgroundColor: '#0A0A0A', borderRadius: 12,
    padding: 12, marginBottom: 8,
  },
  rowItemOff: { opacity: 0.4 },
  check: { paddingTop: 2 },
  checkText: { fontSize: 18, color: PRIMARY },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  flowPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  flowText: { fontSize: 12, fontWeight: '700' },
  amountWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' },
  rp: { fontSize: 13, color: '#888780', marginRight: 4 },
  amountInput: {
    fontSize: 15, fontWeight: '700', color: '#fff', minWidth: 90, textAlign: 'right',
    paddingVertical: 2, borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
  },
  desc: { fontSize: 12, color: '#aaa', marginTop: 6 },
  catChip: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: '#15233A', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  catText: { fontSize: 12, color: '#9DC2F0', fontWeight: '600' },
  summary: { marginTop: 6, marginBottom: 12, gap: 2 },
  sumLine: { fontSize: 12, color: '#888780' },
  sumNet: { fontSize: 14, fontWeight: '700', color: '#fff', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: '#2A2A2A', flex: 0.5 },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#888780' },
  saveBtn: { backgroundColor: PRIMARY },
  saveBtnOff: { backgroundColor: '#2A2A2A' },
  saveText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  modalBg: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalCard: { backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#2A2A2A' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12 },
  catOption: { paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#2A2A2A' },
  catOptionText: { fontSize: 14, color: '#fff' },
})
