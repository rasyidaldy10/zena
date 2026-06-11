import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '../lib/supabase'
import { confirmAsync, notify } from '../lib/alert'
import { WALLET_TYPE_CONFIG, WalletType } from '../types'

const PRIMARY = '#185FA5'
const COLORS = ['#185FA5', '#534AB7', '#BA7517', '#1D9E75', '#E24B4A', '#888780']
const ICONS = ['💵', '🏦', '💳', '📱', '🏠', '📊', '🎯', '💎', '🔒', '🌟']

export default function EditWalletScreen() {
  const params = useLocalSearchParams()
  const walletId = params.id as string

  const [name, setName] = useState('')
  const [type, setType] = useState<WalletType>('personal')
  const [balance, setBalance] = useState('')
  const [icon, setIcon] = useState('💵')
  const [color, setColor] = useState(PRIMARY)
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

    if (data) {
      setName(data.wallet_name)
      setType(data.wallet_type || 'personal')
      setBalance(data.current_balance.toString())
      setIcon(data.icon || '💵')
      setColor(data.color || PRIMARY)
    }
    setLoading(false)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Oops', 'Nama dompet harus diisi')
      return
    }

    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('user_wallets')
      .update({
        wallet_name: name.trim(),
        wallet_type: type,
        current_balance: parseFloat(balance.replace(/\./g, '')) || 0,
        icon,
        color,
      })
      .eq('id', walletId)
      .eq('user_id', session.user.id)

    setSaving(false)

    if (error) {
      Alert.alert('Error', 'Gagal menyimpan perubahan')
    } else {
      // Navigate to profil tab
      router.replace('/(tabs)/profil')
    }
  }

  const handleDelete = async () => {
    const ok = await confirmAsync(
      'Hapus Dompet?',
      'Semua transaksi dari dompet ini akan tetap ada, tapi tidak akan terlihat lagi di dompet ini.',
      'Hapus'
    )
    if (!ok) return

    setSaving(true)
    const { error } = await supabase
      .from('user_wallets')
      .update({ is_active: false })
      .eq('id', walletId)

    setSaving(false)

    if (error) {
      notify('Error', 'Gagal menghapus dompet')
    } else {
      router.replace('/(tabs)/profil')
    }
  }

  const formatBalance = (text: string) => {
    const numbers = text.replace(/\D/g, '')
    const formatted = numbers.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    setBalance(formatted)
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={PRIMARY} size="large" />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Dompet</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Preview */}
        <View style={[styles.preview, { backgroundColor: color }]}>
          <Text style={styles.previewIcon}>{icon}</Text>
          <Text style={styles.previewName}>{name || 'Nama Dompet'}</Text>
          <Text style={styles.previewBalance}>
            Rp {balance ? parseFloat(balance.replace(/\./g, '')).toLocaleString('id-ID') : '0'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.section}>
          <Text style={styles.label}>Nama Dompet</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Misal: Rekening BCA"
            placeholderTextColor="#555"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Jenis Dompet</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            {Object.entries(WALLET_TYPE_CONFIG).map(([key, cfg]) => (
              <TouchableOpacity
                key={key}
                style={[styles.typeChip, type === key && styles.typeChipActive]}
                onPress={() => setType(key as WalletType)}
              >
                <Text style={styles.typeEmoji}>{cfg.icon}</Text>
                <Text style={[styles.typeLabel, type === key && styles.typeLabelActive]}>
                  {cfg.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Saldo Saat Ini</Text>
          <TextInput
            style={styles.input}
            value={balance}
            onChangeText={formatBalance}
            placeholder="0"
            placeholderTextColor="#555"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Ikon</Text>
          <View style={styles.iconGrid}>
            {ICONS.map(ic => (
              <TouchableOpacity
                key={ic}
                style={[styles.iconBtn, icon === ic && styles.iconBtnActive]}
                onPress={() => setIcon(ic)}
              >
                <Text style={styles.iconText}>{ic}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Warna</Text>
          <View style={styles.colorRow}>
            {COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.colorBtn, { backgroundColor: c }, color === c && styles.colorBtnActive]}
                onPress={() => setColor(c)}
              />
            ))}
          </View>
        </View>

        {/* Delete Button */}
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={saving}>
          <Text style={styles.deleteBtnText}>🗑️ Hapus Dompet</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
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
            <Text style={styles.saveBtnText}>Simpan Perubahan</Text>
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
  scroll: { flex: 1 },
  preview: {
    marginHorizontal: 20, marginTop: 24, borderRadius: 20,
    padding: 24, alignItems: 'center', minHeight: 160, justifyContent: 'center',
  },
  previewIcon: { fontSize: 48, marginBottom: 12 },
  previewName: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  previewBalance: { fontSize: 28, fontWeight: '900', color: '#fff' },
  section: { marginHorizontal: 20, marginTop: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#888780', marginBottom: 8 },
  input: {
    backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#fff', borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
    marginRight: 8, borderWidth: 1, borderColor: '#2A2A2A',
  },
  typeChipActive: { backgroundColor: PRIMARY + '30', borderColor: PRIMARY },
  typeEmoji: { fontSize: 18 },
  typeLabel: { fontSize: 13, color: '#888780', fontWeight: '500' },
  typeLabelActive: { color: '#fff', fontWeight: '700' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconBtn: {
    width: 52, height: 52, borderRadius: 12, backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2A2A2A',
  },
  iconBtnActive: { backgroundColor: PRIMARY + '30', borderColor: PRIMARY },
  iconText: { fontSize: 24 },
  colorRow: { flexDirection: 'row', gap: 12 },
  colorBtn: {
    width: 48, height: 48, borderRadius: 12, borderWidth: 2, borderColor: 'transparent',
  },
  colorBtnActive: { borderColor: '#fff', transform: [{ scale: 1.1 }] },
  bankInfoCard: {
    marginHorizontal: 20, marginTop: 20, backgroundColor: '#0D1A2E',
    borderRadius: 12, padding: 16, borderWidth: 1, borderColor: PRIMARY + '40',
  },
  bankInfoTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 4 },
  bankInfoDesc: { fontSize: 11, color: '#888780', lineHeight: 16 },
  deleteBtn: {
    marginHorizontal: 20, marginTop: 32, backgroundColor: '#2A1A1A',
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#E24B4A30',
  },
  deleteBtnText: { fontSize: 15, color: '#E24B4A', fontWeight: '600' },
  footer: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 0.5, borderTopColor: '#2A2A2A',
  },
  saveBtn: {
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
})
