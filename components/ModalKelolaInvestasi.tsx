import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { notify } from '../lib/alert'
import type { InvestmentHolding } from '../types'

const PRIMARY = '#185FA5'
const GREEN = '#16A34A'
const RED = '#E24B4A'

type Tab = 'add' | 'edit' | 'history'
type HistoryRow = { id: string; type: string; quantity: number; price_per_unit: number; total: number; date: string }

interface Props {
  visible: boolean
  holding: InvestmentHolding | null
  onClose: () => void
  onSuccess: () => void
}

export default function ModalKelolaInvestasi({ visible, holding, onClose, onSuccess }: Props) {
  const [tab, setTab] = useState<Tab>('add')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<HistoryRow[]>([])

  // Tambah posisi
  const [addQty, setAddQty] = useState('')
  const [addPrice, setAddPrice] = useState('')
  // Koreksi
  const [editAvg, setEditAvg] = useState('')
  const [editCurrent, setEditCurrent] = useState('')

  const isStock = holding?.asset_type === 'stock'
  const unitLabel = isStock ? 'lot' : 'unit'

  useEffect(() => {
    if (visible && holding) {
      setTab('add')
      setAddQty(''); setAddPrice('')
      setEditAvg(holding.average_buy_price ? String(holding.average_buy_price) : '')
      setEditCurrent(holding.current_price ? String(holding.current_price) : '')
      fetchHistory()
    }
  }, [visible, holding])

  async function fetchHistory() {
    if (!holding) return
    const { data } = await supabase
      .from('investment_transactions')
      .select('id, type, quantity, price_per_unit, total, date')
      .eq('holding_id', holding.id)
      .order('date', { ascending: false })
    setHistory((data as HistoryRow[]) || [])
  }

  const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')
  const num = (s: string) => parseFloat(s.replace(/[^0-9]/g, '')) || 0

  // 1 lot = 100 lembar (saham)
  const sharesOwned = holding?.quantity || 0
  const lotsOwned = isStock ? sharesOwned / 100 : sharesOwned

  async function handleAddPosition() {
    if (!holding) return
    const qtyInput = num(addQty)
    const price = num(addPrice)
    if (qtyInput <= 0 || price <= 0) {
      notify('Oops', 'Isi jumlah & harga beli yang valid')
      return
    }
    const addShares = isStock ? qtyInput * 100 : qtyInput
    const oldShares = sharesOwned
    const oldAvg = holding.average_buy_price
    const newShares = oldShares + addShares
    const newAvg = newShares > 0 ? (oldShares * oldAvg + addShares * price) / newShares : price

    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    const { error } = await supabase.from('investment_holdings')
      .update({ quantity: newShares, average_buy_price: Math.round(newAvg), last_updated_at: new Date().toISOString() })
      .eq('id', holding.id)
    if (error) { setLoading(false); notify('Gagal', error.message); return }

    // Catat riwayat (best-effort; tabel mungkin belum dibuat)
    await supabase.from('investment_transactions').insert({
      holding_id: holding.id, user_id: session.user.id, type: 'buy',
      quantity: addShares, price_per_unit: price, total: addShares * price,
      note: 'Tambah posisi',
    })

    setLoading(false)
    onSuccess(); onClose()
    notify('Berhasil ✅', 'Posisi ditambahkan & harga rata-rata diperbarui')
  }

  async function handleSaveEdit() {
    if (!holding) return
    const avg = num(editAvg)
    const cur = num(editCurrent)
    if (avg <= 0) { notify('Oops', 'Harga rata-rata harus diisi'); return }

    setLoading(true)
    const { error } = await supabase.from('investment_holdings')
      .update({ average_buy_price: avg, current_price: cur || avg, last_updated_at: new Date().toISOString() })
      .eq('id', holding.id)
    setLoading(false)
    if (error) { notify('Gagal', error.message); return }
    onSuccess(); onClose()
    notify('Berhasil ✅', 'Data investasi dikoreksi')
  }

  if (!holding) return null

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{holding.symbol}</Text>
              <Text style={styles.sub}>
                {lotsOwned.toLocaleString('id-ID')} {unitLabel} · rata-rata {fmt(holding.average_buy_price)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}><Text style={styles.close}>✕</Text></TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {([['add', '➕ Tambah Posisi'], ['edit', '✏️ Koreksi'], ['history', '🧾 Riwayat']] as [Tab, string][]).map(([t, label]) => (
              <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ padding: 16 }}>
            {tab === 'add' && (
              <>
                <Text style={styles.label}>Jumlah {unitLabel} yang dibeli</Text>
                <TextInput style={styles.input} value={addQty} onChangeText={(t) => setAddQty(t.replace(/[^0-9]/g, ''))}
                  placeholder={isStock ? 'Contoh: 5 lot' : 'Contoh: 100'} placeholderTextColor="#888" keyboardType="numeric" />
                <Text style={styles.label}>Harga beli per {isStock ? 'lembar' : 'unit'} (Rp)</Text>
                <TextInput style={styles.input} value={addPrice} onChangeText={(t) => setAddPrice(t.replace(/[^0-9]/g, ''))}
                  placeholder="Contoh: 5000" placeholderTextColor="#888" keyboardType="numeric" />
                <Text style={styles.hint}>Harga rata-rata akan dihitung ulang otomatis.</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleAddPosition} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Tambah Posisi</Text>}
                </TouchableOpacity>
              </>
            )}

            {tab === 'edit' && (
              <>
                <Text style={styles.label}>Harga Rata-rata per {isStock ? 'lembar' : 'unit'} (Rp)</Text>
                <TextInput style={styles.input} value={editAvg} onChangeText={(t) => setEditAvg(t.replace(/[^0-9]/g, ''))}
                  placeholder="0" placeholderTextColor="#888" keyboardType="numeric" />
                <Text style={styles.label}>Harga Sekarang per {isStock ? 'lembar' : 'unit'} (Rp)</Text>
                <TextInput style={styles.input} value={editCurrent} onChangeText={(t) => setEditCurrent(t.replace(/[^0-9]/g, ''))}
                  placeholder="0" placeholderTextColor="#888" keyboardType="numeric" />
                <Text style={styles.hint}>Buat koreksi kalau salah input harga rata-rata.</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveEdit} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Simpan Koreksi</Text>}
                </TouchableOpacity>
              </>
            )}

            {tab === 'history' && (
              <>
                {history.length === 0 ? (
                  <Text style={styles.hint}>Belum ada riwayat pembelian. Pakai "Tambah Posisi" untuk mulai mencatat.</Text>
                ) : history.map((h) => (
                  <View key={h.id} style={styles.histRow}>
                    <View>
                      <Text style={styles.histType}>{h.type === 'buy' ? '📥 Beli' : '📤 Jual'}</Text>
                      <Text style={styles.histDate}>{new Date(h.date).toLocaleDateString('id-ID')}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.histQty}>{(isStock ? h.quantity / 100 : h.quantity).toLocaleString('id-ID')} {unitLabel} @ {fmt(h.price_per_unit)}</Text>
                      <Text style={styles.histTotal}>{fmt(h.total)}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#141414', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 0.5, borderBottomColor: '#2A2A2A' },
  title: { fontSize: 20, fontWeight: '800', color: '#fff' },
  sub: { fontSize: 12, color: '#888', marginTop: 2 },
  close: { fontSize: 22, color: '#888' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1F1F1F', alignItems: 'center' },
  tabActive: { backgroundColor: PRIMARY + '30', borderWidth: 1, borderColor: PRIMARY },
  tabText: { fontSize: 12, color: '#888', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  label: { fontSize: 12, color: '#888', fontWeight: '600', marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  input: { height: 48, backgroundColor: '#1F1F1F', borderRadius: 12, paddingHorizontal: 16, fontSize: 15, color: '#fff', borderWidth: 0.5, borderColor: '#2A2A2A' },
  hint: { fontSize: 12, color: '#888', marginTop: 10, lineHeight: 18 },
  primaryBtn: { marginTop: 18, backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  histRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#2A2A2A' },
  histType: { fontSize: 14, color: '#fff', fontWeight: '600' },
  histDate: { fontSize: 11, color: '#888', marginTop: 2 },
  histQty: { fontSize: 13, color: '#fff' },
  histTotal: { fontSize: 12, color: GREEN, fontWeight: '600', marginTop: 2 },
})
