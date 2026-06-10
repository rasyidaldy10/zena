import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
  KeyboardAvoidingView, Platform
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { WALLET_TYPE_CONFIG } from '../types'
import BankConnectModal from '../components/BankConnectModal'

const PRIMARY = '#185FA5'

const WALLET_TYPES = Object.entries(WALLET_TYPE_CONFIG).map(([id, cfg]) => ({ id, ...cfg }))

const COLORS = ['#185FA5', '#534AB7', '#1D9E75', '#E24B4A', '#EF9F27', '#F0997B', '#AFA9EC', '#85B7EB']
const ICONS  = ['💵', '🏦', '💳', '📱', '🐷', '📈', '💰', '🛡️', '💎', '🏠']

export default function TambahWalletScreen() {
  const [walletName, setWalletName]     = useState('')
  const [walletType, setWalletType]     = useState('')
  const [walletFunction, setWalletFunction] = useState<'personal' | 'business'>('personal')
  const [selectedColor, setSelectedColor] = useState('#185FA5')
  const [selectedIcon, setSelectedIcon] = useState('💵')
  const [initialBalance, setInitialBalance] = useState('')
  const [loading, setLoading] = useState(false)
  const [showBankConnect, setShowBankConnect] = useState(false)
  const [userId, setUserId] = useState('')

  // Load user ID on mount
  useEffect(() => {
    loadUserId()
  }, [])

  const loadUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setUserId(user.id)
  }

  const formatBalance = (text: string) => {
    const nums = text.replace(/\D/g, '')
    setInitialBalance(nums.replace(/\B(?=(\d{3})+(?!\d))/g, '.'))
  }

  const handleBankConnect = (bankCode: string, bankName: string) => {
    Alert.alert(
      'Coming Soon! 🚀',
      `Connect ${bankName} sedang dalam tahap development.\n\nSilakan tambah wallet manual terlebih dahulu.`
    )
    // TODO: Implement OAuth flow with Brick.co
    // 1. Open getBrickAuthUrl(bankCode, userId)
    // 2. Handle callback at zena://brick-callback
    // 3. Exchange auth code for access token
    // 4. Get bank accounts
    // 5. Create wallet with bank connection
  }

  const handleSave = async () => {
    if (!walletName.trim()) {
      Alert.alert('Oops', 'Nama dompet harus diisi ya')
      return
    }
    if (!walletType) {
      Alert.alert('Oops', 'Pilih tipe / fungsi dompet dulu')
      return
    }

    // Cek jumlah wallet user saat ini per function
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { count } = await supabase
      .from('user_wallets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .eq('wallet_function', walletFunction)

    const maxWallets = 5
    const walletTypeLabel = walletFunction === 'personal' ? 'pribadi' : 'bisnis'

    if (count && count >= maxWallets) {
      Alert.alert('Batas Maksimal', `Kamu hanya bisa memiliki maksimal ${maxWallets} dompet ${walletTypeLabel}. Hapus dulu salah satu dompet lama untuk menambah yang baru.`)
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const balance = parseFloat(initialBalance.replace(/\./g, '')) || 0

    const { error } = await supabase.from('user_wallets').insert({
      user_id: user?.id,
      wallet_name: walletName.trim(),
      wallet_type: walletType,
      wallet_function: walletFunction,
      color: selectedColor,
      icon: selectedIcon,
      current_balance: balance,
      is_active: true,
    })

    if (error) {
      Alert.alert('Gagal', error.message)
      setLoading(false)
      return
    }

    setLoading(false)
    router.replace('/(tabs)/profil')
    setTimeout(() => {
      Alert.alert('Berhasil! 🎉', 'Dompet baru berhasil ditambahkan')
    }, 300)
  }

  const previewBalance = parseFloat(initialBalance.replace(/\./g, '')) || 0
  const selectedType   = WALLET_TYPE_CONFIG[walletType]

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tambah Dompet</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Bank Connect Option */}
        <TouchableOpacity
          style={styles.bankConnectCard}
          onPress={() => setShowBankConnect(true)}
        >
          <View style={styles.bankConnectIcon}>
            <Text style={{ fontSize: 24 }}>🏦</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bankConnectTitle}>Connect Bank Account</Text>
            <Text style={styles.bankConnectDesc}>
              Auto-sync transaksi dari 50+ bank Indonesia
            </Text>
          </View>
          <Text style={styles.bankConnectArrow}>›</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>atau tambah manual</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Preview card */}
        <View style={[styles.previewCard, { backgroundColor: selectedColor }]}>
          <Text style={styles.previewIcon}>{selectedIcon}</Text>
          <Text style={styles.previewName}>{walletName || 'Nama Dompet'}</Text>
          <Text style={styles.previewType}>{selectedType?.label || 'Tipe Dompet'}</Text>
          <Text style={styles.previewBalance}>Rp {previewBalance.toLocaleString('id-ID')}</Text>
        </View>

        {/* Nama */}
        <Text style={styles.label}>Nama Dompet</Text>
        <TextInput
          style={styles.input}
          placeholder="Contoh: BCA Utama, OVO, Cash..."
          placeholderTextColor="#888780"
          value={walletName}
          onChangeText={setWalletName}
        />

        {/* Fungsi Wallet (Personal / Business) */}
        <Text style={styles.label}>Untuk Keperluan</Text>
        <View style={styles.functionToggle}>
          <TouchableOpacity
            style={[styles.functionBtn, walletFunction === 'personal' && styles.functionBtnActive]}
            onPress={() => setWalletFunction('personal')}
          >
            <Text style={[styles.functionText, walletFunction === 'personal' && styles.functionTextActive]}>
              👤 Pribadi
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.functionBtn, walletFunction === 'business' && styles.functionBtnActive]}
            onPress={() => setWalletFunction('business')}
          >
            <Text style={[styles.functionText, walletFunction === 'business' && styles.functionTextActive]}>
              💼 Bisnis
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tipe / Fungsi */}
        <Text style={styles.label}>Tipe / Fungsi</Text>
        {WALLET_TYPES.map((wt) => (
          <TouchableOpacity
            key={wt.id}
            style={[styles.typeBtn, walletType === wt.id && styles.typeBtnActive]}
            onPress={() => setWalletType(wt.id)}
          >
            <Text style={styles.typeIcon}>{wt.icon}</Text>
            <View style={styles.typeInfo}>
              <Text style={[styles.typeName, walletType === wt.id && styles.typeNameActive]}>
                {wt.label}
              </Text>
              <Text style={styles.typeDesc}>{wt.desc}</Text>
            </View>
            {walletType === wt.id && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}

        {/* Ikon */}
        <Text style={[styles.label, { marginTop: 8 }]}>Ikon</Text>
        <View style={styles.iconGrid}>
          {ICONS.map((icon) => (
            <TouchableOpacity
              key={icon}
              style={[styles.iconBtn, selectedIcon === icon && styles.iconBtnActive]}
              onPress={() => setSelectedIcon(icon)}
            >
              <Text style={styles.iconText}>{icon}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Warna */}
        <Text style={styles.label}>Warna</Text>
        <View style={styles.colorRow}>
          {COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorDot,
                { backgroundColor: color },
                selectedColor === color && styles.colorDotActive,
              ]}
              onPress={() => setSelectedColor(color)}
            />
          ))}
        </View>

        {/* Saldo Awal */}
        <Text style={styles.label}>Saldo Awal</Text>
        <View style={styles.balanceWrap}>
          <Text style={styles.balancePrefix}>Rp</Text>
          <TextInput
            style={styles.balanceInput}
            placeholder="0"
            placeholderTextColor="#444"
            value={initialBalance}
            onChangeText={formatBalance}
            keyboardType="numeric"
          />
        </View>

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Simpan Dompet</Text>}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Bank Connect Modal */}
      <BankConnectModal
        visible={showBankConnect}
        onClose={() => setShowBankConnect(false)}
        onBankSelected={handleBankConnect}
        userId={userId}
      />
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
  previewCard: {
    borderRadius: 16, padding: 20, marginTop: 20, marginBottom: 28,
    alignItems: 'center',
  },
  previewIcon: { fontSize: 32, marginBottom: 8 },
  previewName: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 4 },
  previewType: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  previewBalance: { fontSize: 22, fontWeight: '600', color: '#fff' },
  label: {
    fontSize: 12, fontWeight: '600', color: '#888780',
    marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  input: {
    height: 48, backgroundColor: '#1A1A1A', borderRadius: 12,
    paddingHorizontal: 16, fontSize: 15, color: '#fff',
    borderWidth: 0.5, borderColor: '#2A2A2A', marginBottom: 24,
  },
  functionToggle: {
    flexDirection: 'row', gap: 12, marginBottom: 24,
  },
  functionBtn: {
    flex: 1, height: 48, backgroundColor: '#1A1A1A', borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  functionBtnActive: {
    backgroundColor: PRIMARY + '20', borderColor: PRIMARY, borderWidth: 2,
  },
  functionText: {
    fontSize: 15, fontWeight: '600', color: '#888780',
  },
  functionTextActive: {
    color: PRIMARY,
  },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  typeBtnActive: { borderColor: PRIMARY, borderWidth: 2 },
  typeIcon: { fontSize: 22 },
  typeInfo: { flex: 1 },
  typeName: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 2 },
  typeNameActive: { color: PRIMARY },
  typeDesc: { fontSize: 11, color: '#888780' },
  checkmark: { fontSize: 14, color: PRIMARY, fontWeight: '700' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  iconBtn: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  iconBtnActive: { borderColor: PRIMARY, borderWidth: 2 },
  iconText: { fontSize: 22 },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotActive: { borderWidth: 3, borderColor: '#fff' },
  balanceWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A',
    borderRadius: 16, paddingHorizontal: 20, marginBottom: 28,
    borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  balancePrefix: { fontSize: 24, color: '#888780', marginRight: 8 },
  balanceInput: { flex: 1, fontSize: 32, fontWeight: '600', color: '#fff', paddingVertical: 16 },
  bankInfoCard: {
    backgroundColor: '#0D1A2E', borderRadius: 12, padding: 16,
    marginBottom: 28, borderWidth: 1, borderColor: PRIMARY + '40',
  },
  bankInfoTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 4 },
  bankInfoDesc: { fontSize: 11, color: '#888780', lineHeight: 16 },
  saveBtn: {
    height: 52, backgroundColor: PRIMARY, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  bankConnectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D1A2E',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: PRIMARY + '60',
  },
  bankConnectIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  bankConnectTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  bankConnectDesc: {
    fontSize: 12,
    color: '#888780',
  },
  bankConnectArrow: {
    fontSize: 24,
    color: PRIMARY,
    marginLeft: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2A2A2A',
  },
  dividerText: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 12,
  },
})
