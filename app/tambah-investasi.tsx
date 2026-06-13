import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { notify } from '../lib/alert'
import type { InvestmentAssetType } from '../types'

const PRIMARY = '#185FA5'

const ASSET_TYPES: { value: InvestmentAssetType; label: string; icon: string; symbolHint: string }[] = [
  { value: 'stock', label: 'Saham', icon: '📈', symbolHint: 'Contoh: BBRI, BBCA, TLKM' },
  { value: 'crypto', label: 'Kripto', icon: '₿', symbolHint: 'Contoh: BTC, ETH, SOL' },
  { value: 'reksadana', label: 'Reksadana', icon: '💼', symbolHint: 'Kode/nama produk' },
  { value: 'obligasi', label: 'Obligasi', icon: '📊', symbolHint: 'Kode obligasi' },
]

export default function TambahInvestasiScreen() {
  const [assetType, setAssetType] = useState<InvestmentAssetType>('stock')
  const [symbol, setSymbol] = useState('')
  const [assetName, setAssetName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [currentPrice, setCurrentPrice] = useState('')
  const [saving, setSaving] = useState(false)

  const formatNumber = (text: string, setter: (v: string) => void) => {
    const nums = text.replace(/\D/g, '')
    setter(nums.replace(/\B(?=(\d{3})+(?!\d))/g, '.'))
  }

  const cfg = ASSET_TYPES.find(a => a.value === assetType)!

  const handleSave = async () => {
    if (!symbol.trim()) {
      notify('Oops', 'Masukkan kode/simbol (mis. BBRI)')
      return
    }
    const qty = parseFloat(quantity.replace(/\./g, '')) || 0
    if (qty <= 0) {
      notify('Oops', 'Jumlah harus lebih dari 0')
      return
    }
    const avgBuy = parseFloat(buyPrice.replace(/\./g, '')) || 0
    if (avgBuy <= 0) {
      notify('Oops', 'Harga beli harus lebih dari 0')
      return
    }
    const curPrice = parseFloat(currentPrice.replace(/\./g, '')) || avgBuy

    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setSaving(false)
      return
    }

    // Saham IDX: simpan dalam LEMBAR (1 lot = 100 lembar) supaya total_value
    // (dihitung trigger DB = quantity × current_price per lembar) benar.
    const qtyToStore = assetType === 'stock' ? qty * 100 : qty

    const { data: holdingRow, error } = await supabase.from('investment_holdings').insert({
      user_id: session.user.id,
      asset_type: assetType,
      symbol: symbol.toUpperCase().trim(),
      asset_name: assetName.trim() || symbol.toUpperCase().trim(),
      quantity: qtyToStore,
      average_buy_price: avgBuy,
      current_price: curPrice,
    }).select().single()

    // Catat pembelian awal ke riwayat (best-effort; tabel mungkin belum dibuat)
    if (holdingRow) {
      await supabase.from('investment_transactions').insert({
        holding_id: holdingRow.id, user_id: session.user.id, type: 'buy',
        quantity: qtyToStore, price_per_unit: avgBuy, total: qtyToStore * avgBuy,
        note: 'Pembelian awal',
      })
    }

    setSaving(false)

    if (error) {
      // Kemungkinan duplikat (unique user_id+asset_type+symbol)
      notify('Gagal', error.message.includes('duplicate')
        ? 'Aset ini sudah ada di portfolio. Edit dari portfolio ya.'
        : error.message)
      return
    }

    router.replace('/investment-portfolio')
    setTimeout(() => notify('Berhasil! 🎉', 'Investasi ditambahkan ke portfolio'), 300)
  }

  const qtyNum = parseFloat(quantity.replace(/\./g, '')) || 0
  const buyNum = parseFloat(buyPrice.replace(/\./g, '')) || 0
  const isStock = assetType === 'stock'
  // Saham IDX: 1 lot = 100 lembar. Total = qty(lot) × 100 × harga
  const totalModal = isStock ? qtyNum * 100 * buyNum : qtyNum * buyNum

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/investment-portfolio')}>
          <Text style={styles.backText}>‹ Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tambah Investasi</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Asset Type */}
        <Text style={styles.label}>Jenis Aset</Text>
        <View style={styles.typeGrid}>
          {ASSET_TYPES.map((a) => (
            <TouchableOpacity
              key={a.value}
              style={[styles.typeBtn, assetType === a.value && styles.typeBtnActive]}
              onPress={() => setAssetType(a.value)}
            >
              <Text style={styles.typeIcon}>{a.icon}</Text>
              <Text style={[styles.typeLabel, assetType === a.value && styles.typeLabelActive]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Symbol */}
        <Text style={styles.label}>Kode / Simbol</Text>
        <TextInput
          style={styles.input}
          placeholder={cfg.symbolHint}
          placeholderTextColor="#444"
          value={symbol}
          onChangeText={(t) => setSymbol(t.toUpperCase())}
          autoCapitalize="characters"
        />

        {/* Name */}
        <Text style={styles.label}>Nama Aset (opsional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Contoh: Bank BRI"
          placeholderTextColor="#444"
          value={assetName}
          onChangeText={setAssetName}
        />

        {/* Quantity */}
        <Text style={styles.label}>{isStock ? 'Jumlah Lot' : 'Jumlah'}</Text>
        <TextInput
          style={styles.input}
          placeholder={isStock ? 'Contoh: 10' : 'Contoh: 100'}
          placeholderTextColor="#444"
          value={quantity}
          onChangeText={(t) => formatNumber(t, setQuantity)}
          keyboardType="numeric"
        />

        {/* Buy Price */}
        <Text style={styles.label}>Harga Beli {isStock ? 'per Saham' : 'per Unit'} (Rp)</Text>
        <TextInput
          style={styles.input}
          placeholder="Contoh: 5000"
          placeholderTextColor="#444"
          value={buyPrice}
          onChangeText={(t) => formatNumber(t, setBuyPrice)}
          keyboardType="numeric"
        />

        {/* Current Price */}
        <Text style={styles.label}>Harga Sekarang (Rp, opsional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Kosongkan = sama dengan harga beli"
          placeholderTextColor="#444"
          value={currentPrice}
          onChangeText={(t) => formatNumber(t, setCurrentPrice)}
          keyboardType="numeric"
        />

        {/* Preview */}
        <View style={styles.previewCard}>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Total Modal</Text>
            <Text style={styles.previewValueBold}>Rp {totalModal.toLocaleString('id-ID')}</Text>
          </View>
          {isStock && (
            <Text style={styles.previewHint}>💡 1 lot = 100 lembar saham</Text>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Simpan Investasi</Text>}
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
  backText: { fontSize: 15, color: PRIMARY, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#888780', marginTop: 18, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    height: 48, backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 16,
    fontSize: 15, color: '#fff', borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A',
  },
  typeBtnActive: { backgroundColor: PRIMARY + '30', borderColor: PRIMARY },
  typeIcon: { fontSize: 18 },
  typeLabel: { fontSize: 13, color: '#888780', fontWeight: '500' },
  typeLabelActive: { color: '#fff', fontWeight: '700' },
  previewCard: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16, marginTop: 20,
    borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewLabel: { fontSize: 13, color: '#888780' },
  previewValueBold: { fontSize: 16, color: PRIMARY, fontWeight: '700' },
  previewHint: { fontSize: 11, color: '#888780', marginTop: 8 },
  footer: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 0.5, borderTopColor: '#2A2A2A' },
  saveBtn: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
})
