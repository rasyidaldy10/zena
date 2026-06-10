import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '../lib/supabase'
import { UserWallet } from '../types'

const PRIMARY = '#185FA5'

export default function TambahInvestasiScreen() {
  const params = useLocalSearchParams()
  const walletId = params.walletId as string

  const [wallet, setWallet] = useState<UserWallet | null>(null)
  const [ticker, setTicker] = useState('')
  const [quantity, setQuantity] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchWallet()
  }, [])

  const fetchWallet = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('id', walletId)
      .eq('user_id', session.user.id)
      .single()

    setWallet(data as UserWallet)
    setLoading(false)
  }

  const formatNumber = (text: string, setter: (v: string) => void) => {
    const nums = text.replace(/\D/g, '')
    setter(nums.replace(/\B(?=(\d{3})+(?!\d))/g, '.'))
  }

  const handleSave = async () => {
    if (!ticker.trim()) {
      Alert.alert('Oops', 'Masukkan kode saham (ticker)')
      return
    }
    if (!quantity || parseInt(quantity.replace(/\./g, '')) <= 0) {
      Alert.alert('Oops', 'Jumlah lot harus lebih dari 0')
      return
    }
    if (!buyPrice || parseFloat(buyPrice.replace(/\./g, '')) <= 0) {
      Alert.alert('Oops', 'Harga beli harus lebih dari 0')
      return
    }

    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setSaving(false)
      return
    }

    const qty = parseInt(quantity.replace(/\./g, ''))
    const price = parseFloat(buyPrice.replace(/\./g, ''))

    const { error } = await supabase.from('investment_holdings').insert({
      wallet_id: walletId,
      user_id: session.user.id,
      ticker: ticker.toUpperCase().trim(),
      quantity: qty,
      buy_price: price,
      current_price: price, // default sama dengan buy price
    })

    setSaving(false)

    if (error) {
      Alert.alert('Gagal', error.message)
      return
    }

    // Update wallet balance (nilai investasi)
    const totalValue = qty * 100 * price // 1 lot = 100 saham
    const { data: currentWallet } = await supabase
      .from('user_wallets')
      .select('current_balance')
      .eq('id', walletId)
      .single()

    if (currentWallet) {
      await supabase
        .from('user_wallets')
        .update({ current_balance: currentWallet.current_balance + totalValue })
        .eq('id', walletId)
    }

    Alert.alert('Berhasil! 🎉', 'Investasi berhasil ditambahkan', [
      { text: 'OK', onPress: () => router.replace('/investment-portfolio') },
    ])
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 100 }} />
      </View>
    )
  }

  const previewQty = parseInt(quantity.replace(/\./g, '')) || 0
  const previewPrice = parseFloat(buyPrice.replace(/\./g, '')) || 0
  const previewTotal = previewQty * 100 * previewPrice

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/investment-portfolio')}>
          <Text style={styles.backText}>← Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tambah Investasi</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Wallet Info */}
        {wallet && (
          <View style={[styles.walletCard, { backgroundColor: wallet.color }]}>
            <Text style={styles.walletIcon}>{wallet.icon}</Text>
            <Text style={styles.walletName}>{wallet.wallet_name}</Text>
          </View>
        )}

        {/* Ticker */}
        <Text style={styles.label}>Kode Saham (Ticker)</Text>
        <TextInput
          style={styles.input}
          placeholder="Contoh: BBRI, BMRI, TLKM"
          placeholderTextColor="#444"
          value={ticker}
          onChangeText={(text) => setTicker(text.toUpperCase())}
          autoCapitalize="characters"
        />

        {/* Quantity */}
        <Text style={styles.label}>Jumlah Lot</Text>
        <TextInput
          style={styles.input}
          placeholder="Contoh: 100"
          placeholderTextColor="#444"
          value={quantity}
          onChangeText={(text) => formatNumber(text, setQuantity)}
          keyboardType="numeric"
        />

        {/* Buy Price */}
        <Text style={styles.label}>Harga Beli per Saham (Rp)</Text>
        <TextInput
          style={styles.input}
          placeholder="Contoh: 5000"
          placeholderTextColor="#444"
          value={buyPrice}
          onChangeText={(text) => formatNumber(text, setBuyPrice)}
          keyboardType="numeric"
        />

        {/* Preview */}
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Ringkasan</Text>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Ticker</Text>
            <Text style={styles.previewValue}>{ticker.toUpperCase() || '-'}</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Jumlah Saham</Text>
            <Text style={styles.previewValue}>{previewQty * 100} lembar</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Harga Beli</Text>
            <Text style={styles.previewValue}>Rp {previewPrice.toLocaleString('id-ID')}</Text>
          </View>
          <View style={[styles.previewRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#2A2A2A' }]}>
            <Text style={styles.previewLabelBold}>Total Investasi</Text>
            <Text style={styles.previewValueBold}>Rp {previewTotal.toLocaleString('id-ID')}</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            💡 1 lot = 100 saham{'\n'}
            📊 Harga akan di-update otomatis setiap hari setelah penutupan bursa{'\n'}
            💰 Saldo wallet akan disesuaikan dengan nilai pasar terkini
          </Text>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Simpan Investasi</Text>
          )}
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
  backText: { fontSize: 14, color: PRIMARY },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  walletCard: {
    borderRadius: 16, padding: 20, marginTop: 20, marginBottom: 24, alignItems: 'center',
  },
  walletIcon: { fontSize: 32, marginBottom: 8 },
  walletName: { fontSize: 18, fontWeight: '600', color: '#fff' },
  label: {
    fontSize: 12, fontWeight: '600', color: '#888780',
    marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  input: {
    height: 48, backgroundColor: '#1A1A1A', borderRadius: 12,
    paddingHorizontal: 16, fontSize: 15, color: '#fff',
    borderWidth: 0.5, borderColor: '#2A2A2A', marginBottom: 24,
  },
  previewCard: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16,
    marginBottom: 16, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  previewTitle: {
    fontSize: 12, fontWeight: '700', color: '#888780',
    textTransform: 'uppercase', marginBottom: 12,
  },
  previewRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6,
  },
  previewLabel: { fontSize: 13, color: '#888780' },
  previewValue: { fontSize: 13, color: '#fff', fontWeight: '500' },
  previewLabelBold: { fontSize: 14, color: '#fff', fontWeight: '700' },
  previewValueBold: { fontSize: 14, color: PRIMARY, fontWeight: '700' },
  infoCard: {
    backgroundColor: PRIMARY + '20', borderRadius: 12, padding: 16,
    marginBottom: 24, borderWidth: 1, borderColor: PRIMARY + '40',
  },
  infoText: { fontSize: 12, color: '#B8D4F1', lineHeight: 20 },
  footer: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 0.5, borderTopColor: '#2A2A2A',
  },
  saveBtn: {
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
})
