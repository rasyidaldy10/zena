import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'

const PRIMARY = '#185FA5'

const BANK_EMAILS = [
  { bank: 'BCA', email: 'noreply@bca.co.id', icon: '🏦' },
  { bank: 'Mandiri', email: 'noreply@bankmandiri.co.id', icon: '🏦' },
  { bank: 'BRI', email: 'noreply@bri.co.id', icon: '🏦' },
  { bank: 'BNI', email: 'noreply@bni.co.id', icon: '🏦' },
  { bank: 'CIMB Niaga', email: 'noreply@cimbniaga.co.id', icon: '🏦' },
]

interface Wallet {
  id: string
  wallet_name: string
  icon: string
  color: string
}

interface Mapping {
  sender_email: string
  wallet_id: string
  bank_name: string
}

export default function GmailSetupScreen() {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [loading, setLoading] = useState(true)

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

  const handleSetMapping = async (bankEmail: string, bankName: string) => {
    if (wallets.length === 0) {
      Alert.alert('Belum Ada Dompet', 'Buat dompet dulu di tab Profil')
      return
    }

    const walletOptions = wallets.map(w => w.wallet_name)

    Alert.prompt(
      `Pilih Dompet untuk ${bankName}`,
      `Transaksi dari ${bankEmail} akan masuk ke dompet mana?\n\nKetik nomor:\n${wallets.map((w, i) => `${i + 1}. ${w.wallet_name}`).join('\n')}`,
      async (input) => {
        const idx = parseInt(input) - 1
        if (idx < 0 || idx >= wallets.length) {
          Alert.alert('Invalid', 'Nomor tidak valid')
          return
        }

        const wallet = wallets[idx]
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        const { error } = await supabase.from('gmail_wallet_mappings').upsert({
          user_id: session.user.id,
          wallet_id: wallet.id,
          sender_email: bankEmail,
          bank_name: bankName,
        })

        if (error) {
          Alert.alert('Error', error.message)
        } else {
          Alert.alert('Berhasil!', `Transaksi ${bankName} akan masuk ke ${wallet.wallet_name}`)
          fetchData()
        }
      }
    )
  }

  const getMappedWallet = (email: string) => {
    const mapping = mappings.find(m => m.sender_email === email)
    if (!mapping) return null
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
            Pilih dompet mana untuk setiap bank.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Mapping Bank → Dompet</Text>

        {BANK_EMAILS.map(bank => {
          const mapped = getMappedWallet(bank.email)
          return (
            <TouchableOpacity
              key={bank.email}
              style={styles.bankCard}
              onPress={() => handleSetMapping(bank.email, bank.bank)}
            >
              <Text style={styles.bankIcon}>{bank.icon}</Text>
              <View style={styles.bankInfo}>
                <Text style={styles.bankName}>{bank.bank}</Text>
                <Text style={styles.bankEmail}>{bank.email}</Text>
              </View>
              {mapped ? (
                <View style={styles.mappedWallet}>
                  <Text style={styles.mappedIcon}>{mapped.icon}</Text>
                  <Text style={styles.mappedName}>{mapped.wallet_name}</Text>
                </View>
              ) : (
                <Text style={styles.setupBtn}>Setup →</Text>
              )}
            </TouchableOpacity>
          )
        })}

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>⚠️ Catatan Penting</Text>
          <Text style={styles.noteText}>
            • Gmail API hanya membaca email, tidak bisa kirim/hapus{'\n'}
            • Parsing hanya untuk 7 hari terakhir{'\n'}
            • Transaksi dari Gmail bersifat read-only (tidak bisa diedit manual){'\n'}
            • Scope Gmail harus di-enable di Supabase Dashboard dulu
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  bankCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginBottom: 10, backgroundColor: '#1A1A1A',
    borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  bankIcon: { fontSize: 28 },
  bankInfo: { flex: 1 },
  bankName: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 4 },
  bankEmail: { fontSize: 11, color: '#555' },
  mappedWallet: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mappedIcon: { fontSize: 16 },
  mappedName: { fontSize: 13, color: PRIMARY, fontWeight: '600' },
  setupBtn: { fontSize: 13, color: '#888780' },
  noteCard: {
    marginHorizontal: 20, marginTop: 24, backgroundColor: '#1A1A1A',
    borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  noteTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 8 },
  noteText: { fontSize: 12, color: '#888780', lineHeight: 18 },
})
