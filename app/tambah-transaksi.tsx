import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  ScrollView, KeyboardAvoidingView, Platform
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { CATEGORIES } from '../types'

const PRIMARY = '#185FA5'

type Wallet = {
  id: string
  wallet_name: string
  icon: string
  color: string
  current_balance: number
}

export default function TambahTransaksiScreen() {
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [selectedWallet, setSelectedWallet] = useState<string>('')

  useEffect(() => {
    fetchWallets()
  }, [])

  const fetchWallets = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('user_wallets')
      .select('id, wallet_name, icon, color, current_balance')
      .eq('user_id', user?.id)
      .eq('is_active', true)
    if (data && data.length > 0) {
      setWallets(data)
      setSelectedWallet(data[0].id)
    }
  }

  const handleSave = async () => {
    if (!amount || !category) {
      Alert.alert('Oops', 'Nominal dan kategori harus diisi ya')
      return
    }
    if (!selectedWallet) {
      Alert.alert('Oops', 'Pilih dompet dulu ya')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const nominal = parseFloat(amount.replace(/\./g, ''))

    // Simpan transaksi
    const { error } = await supabase.from('transactions').insert({
      user_id: user?.id,
      amount: nominal,
      type,
      category,
      note,
      source: 'manual',
      is_categorized: true,
      date: new Date().toISOString().split('T')[0],
      wallet_source: selectedWallet,
    })

    if (error) {
      Alert.alert('Gagal', error.message)
      setLoading(false)
      return
    }

    // Update current_balance di wallet
    const wallet = wallets.find(w => w.id === selectedWallet)
    if (wallet) {
      const newBalance = type === 'income'
        ? wallet.current_balance + nominal
        : wallet.current_balance - nominal

      await supabase
        .from('user_wallets')
        .update({ current_balance: newBalance })
        .eq('id', selectedWallet)
    }

    Alert.alert('Berhasil! ✅', 'Transaksi berhasil dicatat', [
      { text: 'OK', onPress: () => router.back() }
    ])
    setLoading(false)
  }

  const formatAmount = (text: string) => {
    const numbers = text.replace(/\D/g, '')
    const formatted = numbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    setAmount(formatted)
  }

  const formatRupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

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
          <TouchableOpacity
            style={[styles.typeBtn, type === 'expense' && styles.typeBtnExpense]}
            onPress={() => setType('expense')}
          >
            <Text style={[styles.typeText, type === 'expense' && styles.typeTextActive]}>
              💸 Pengeluaran
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, type === 'income' && styles.typeBtnIncome]}
            onPress={() => setType('income')}
          >
            <Text style={[styles.typeText, type === 'income' && styles.typeTextActive]}>
              💰 Pemasukan
            </Text>
          </TouchableOpacity>
        </View>

        {/* Amount */}
        <View style={styles.amountWrap}>
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

        {/* Wallet */}
        {wallets.length > 0 && (
          <>
            <Text style={styles.label}>Dompet</Text>
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
          </>
        )}

        {/* Category */}
        <Text style={styles.label}>Kategori</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.catBtn, category === cat && styles.catBtnActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.catText, category === cat && styles.catTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Simpan Transaksi</Text>
          }
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    borderRadius: 12, padding: 3, marginTop: 20, marginBottom: 24, gap: 3,
  },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  typeBtnExpense: { backgroundColor: '#E24B4A' },
  typeBtnIncome: { backgroundColor: '#1D9E75' },
  typeText: { fontSize: 13, color: '#888780', fontWeight: '500' },
  typeTextActive: { color: '#fff', fontWeight: '600' },
  amountWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A',
    borderRadius: 16, paddingHorizontal: 20, marginBottom: 28,
    borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  amountPrefix: { fontSize: 24, color: '#888780', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 32, fontWeight: '600', color: '#fff', paddingVertical: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#888780', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  walletRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  walletBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 12,
    borderWidth: 0.5, borderColor: '#2A2A2A',
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
  catBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  catText: { fontSize: 12, color: '#888780' },
  catTextActive: { color: '#fff', fontWeight: '600' },
  noteInput: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14,
    fontSize: 14, color: '#fff', borderWidth: 0.5, borderColor: '#2A2A2A',
    minHeight: 80, marginBottom: 24, textAlignVertical: 'top',
  },
  saveBtn: {
    height: 52, backgroundColor: PRIMARY, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})