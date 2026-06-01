import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'

const PRIMARY = '#185FA5'

const BANK_EMAILS = [
  { bank: 'BCA', baseEmail: 'bca.co.id', icon: '🏦' },
  { bank: 'Mandiri', baseEmail: 'bankmandiri.co.id', icon: '🏦' },
  { bank: 'BRI', baseEmail: 'bri.co.id', icon: '🏦' },
  { bank: 'BNI', baseEmail: 'bni.co.id', icon: '🏦' },
  { bank: 'CIMB Niaga', baseEmail: 'cimbniaga.co.id', icon: '🏦' },
]

interface Wallet {
  id: string
  wallet_name: string
  icon: string
  color: string
}

interface Mapping {
  id: string
  sender_email: string
  wallet_id: string
  bank_name: string
  last_4_digits?: string
}

export default function GmailSetupScreen() {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedBank, setSelectedBank] = useState<{ bank: string; baseEmail: string } | null>(null)
  const [last4Digits, setLast4Digits] = useState('')
  const [selectedWalletId, setSelectedWalletId] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const [{ data: w }, { data: m }] = await Promise.all([
      supabase.from('user_wallets').select('id, wallet_name, icon, color').eq('user_id', session.user.id).eq('is_active', true),
      supabase.from('gmail_wallet_mappings').select('*').eq('user_id', session.user.id),
    ])

    setWallets((w ?? []) as Wallet[])
    setMappings((m ?? []) as Mapping[])
    setLoading(false)
  }

  const openModal = (bank: string, baseEmail: string) => {
    if (wallets.length === 0) {
      Alert.alert('Belum Ada Dompet', 'Buat dompet dulu di tab Profil')
      return
    }
    setSelectedBank({ bank, baseEmail })
    setLast4Digits('')
    setSelectedWalletId(wallets[0]?.id || '')
    setModalVisible(true)
  }

  const handleSave = async () => {
    if (!selectedBank || !selectedWalletId) return

    const digits = last4Digits.trim()
    if (!digits || digits.length !== 4 || !/^\d+$/.test(digits)) {
      Alert.alert('Oops', '4 digit terakhir rekening harus diisi (misal: 1234)')
      return
    }

    const senderEmail = `noreply@${selectedBank.baseEmail}`
    const uniqueKey = `${senderEmail}:${digits}`

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const wallet = wallets.find(w => w.id === selectedWalletId)

    const { error } = await supabase.from('gmail_wallet_mappings').insert({
      user_id: session.user.id,
      wallet_id: selectedWalletId,
      sender_email: uniqueKey,
      bank_name: `${selectedBank.bank} (...${digits})`,
      last_4_digits: digits,
    })

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Berhasil!', `Transaksi ${selectedBank.bank} rekening (...${digits}) akan masuk ke ${wallet?.wallet_name}`)
      setModalVisible(false)
      fetchData()
    }
  }

  const handleDelete = async (id: string) => {
    Alert.alert('Hapus Mapping?', 'Email dari bank ini tidak akan auto-import lagi', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('gmail_wallet_mappings').delete().eq('id', id)
          fetchData()
        },
      },
    ])
  }

  const getMappedWallet = (mapping: Mapping) => {
    return wallets.find(w => w.id === mapping.wallet_id)
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={PRIMARY} size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gmail Auto-Parsing</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>📧</Text>
          <Text style={styles.infoTitle}>Auto-Import Transaksi</Text>
          <Text style={styles.infoText}>
            Zena akan membaca email notifikasi dari bank dan otomatis mencatat transaksimu.
            Setiap rekening bank bisa dipetakan ke dompet berbeda.
          </Text>
        </View>

        {/* Mapping yang sudah ada */}
        {mappings.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Mapping Aktif ({mappings.length})</Text>
            {mappings.map(mapping => {
              const wallet = getMappedWallet(mapping)
              return (
                <View key={mapping.id} style={styles.mappingCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mappingBank}>{mapping.bank_name}</Text>
                    <Text style={styles.mappingEmail}>{mapping.sender_email.split(':')[0]}</Text>
                    {wallet && (
                      <View style={styles.mappingWallet}>
                        <Text style={styles.mappingWalletIcon}>{wallet.icon}</Text>
                        <Text style={styles.mappingWalletName}>→ {wallet.wallet_name}</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(mapping.id)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              )
            })}
          </>
        )}

        <Text style={styles.sectionLabel}>Tambah Mapping Baru</Text>

        {BANK_EMAILS.map(bank => (
          <TouchableOpacity
            key={bank.bank}
            style={styles.bankCard}
            onPress={() => openModal(bank.bank, bank.baseEmail)}
          >
            <Text style={styles.bankIcon}>{bank.icon}</Text>
            <View style={styles.bankInfo}>
              <Text style={styles.bankName}>{bank.bank}</Text>
              <Text style={styles.bankEmail}>noreply@{bank.baseEmail}</Text>
            </View>
            <Text style={styles.setupBtn}>+ Tambah</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>⚠️ Catatan Penting</Text>
          <Text style={styles.noteText}>
            • Masukkan 4 digit terakhir rekening untuk bedakan rekening berbeda dari bank yang sama{'\n'}
            • Parsing hanya untuk 7 hari terakhir{'\n'}
            • Transaksi dari Gmail bersifat read-only{'\n'}
            • Logout → Login lagi untuk aktifkan Gmail consent
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal Picker */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Setup {selectedBank?.bank}</Text>

            <Text style={styles.label}>4 Digit Terakhir Rekening</Text>
            <TextInput
              style={styles.input}
              value={last4Digits}
              onChangeText={setLast4Digits}
              placeholder="Misal: 1234"
              placeholderTextColor="#555"
              keyboardType="numeric"
              maxLength={4}
            />
            <Text style={styles.hint}>Untuk bedakan kalau punya 2+ rekening {selectedBank?.bank}</Text>

            <Text style={[styles.label, { marginTop: 20 }]}>Masuk ke Dompet</Text>
            {wallets.map(w => (
              <TouchableOpacity
                key={w.id}
                style={[styles.walletOption, selectedWalletId === w.id && styles.walletOptionActive]}
                onPress={() => setSelectedWalletId(w.id)}
              >
                <Text style={styles.walletOptionIcon}>{w.icon}</Text>
                <Text style={[styles.walletOptionName, selectedWalletId === w.id && styles.walletOptionNameActive]}>
                  {w.wallet_name}
                </Text>
                {selectedWalletId === w.id && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={handleSave}>
                <Text style={styles.modalBtnSaveText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  infoCard: {
    marginHorizontal: 20, marginTop: 20, backgroundColor: PRIMARY + '20',
    borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: PRIMARY + '40',
  },
  infoIcon: { fontSize: 48, marginBottom: 12 },
  infoTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  infoText: { fontSize: 13, color: '#888780', textAlign: 'center', lineHeight: 20 },
  sectionLabel: {
    fontSize: 13, fontWeight: '700', color: '#888780',
    marginHorizontal: 20, marginTop: 28, marginBottom: 12,
  },
  mappingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginBottom: 10, backgroundColor: '#0D1A2E',
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: PRIMARY + '40',
  },
  mappingBank: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 4 },
  mappingEmail: { fontSize: 11, color: '#555', marginBottom: 6 },
  mappingWallet: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mappingWalletIcon: { fontSize: 14 },
  mappingWalletName: { fontSize: 13, color: PRIMARY, fontWeight: '600' },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 20 },
  bankCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginBottom: 10, backgroundColor: '#1A1A1A',
    borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  bankIcon: { fontSize: 28 },
  bankInfo: { flex: 1 },
  bankName: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 4 },
  bankEmail: { fontSize: 11, color: '#555' },
  setupBtn: { fontSize: 13, color: PRIMARY, fontWeight: '600' },
  noteCard: {
    marginHorizontal: 20, marginTop: 24, backgroundColor: '#1A1A1A',
    borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  noteTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 8 },
  noteText: { fontSize: 12, color: '#888780', lineHeight: 18 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1A1A', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: '#888780', marginBottom: 8 },
  input: {
    backgroundColor: '#0F0F0F', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#fff', borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  hint: { fontSize: 11, color: '#555', marginTop: 6 },
  walletOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0F0F0F', borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  walletOptionActive: { borderColor: PRIMARY, backgroundColor: PRIMARY + '20' },
  walletOptionIcon: { fontSize: 20 },
  walletOptionName: { flex: 1, fontSize: 15, color: '#888780', fontWeight: '500' },
  walletOptionNameActive: { color: '#fff', fontWeight: '700' },
  checkmark: { fontSize: 18, color: PRIMARY, fontWeight: '900' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalBtnCancel: {
    flex: 1, backgroundColor: '#2A2A2A', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center',
  },
  modalBtnCancelText: { fontSize: 15, fontWeight: '600', color: '#888780' },
  modalBtnSave: {
    flex: 1, backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center',
  },
  modalBtnSaveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
