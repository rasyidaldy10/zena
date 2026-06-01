import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'

const PRIMARY = '#185FA5'

interface Wallet {
  id: string
  wallet_name: string
  icon: string
  color: string
  bank_name?: string
  last_4_digits?: string
}

export default function GmailSetupScreen() {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [gmailConnected, setGmailConnected] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Check Gmail connection
    if (session.provider_refresh_token) {
      setGmailConnected(true)
    }

    // Fetch wallets dengan bank info
    const { data: w } = await supabase
      .from('user_wallets')
      .select('id, wallet_name, icon, color, bank_name, last_4_digits')
      .eq('user_id', session.user.id)
      .eq('is_active', true)

    setWallets((w ?? []) as Wallet[])
    setLoading(false)
  }

  const walletsWithBank = wallets.filter(w => w.bank_name && w.last_4_digits)

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 100 }} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gmail Auto-Import</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Status Koneksi</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: gmailConnected ? '#1D9E75' : '#666' }]} />
            <Text style={styles.statusText}>
              {gmailConnected ? 'Gmail Terhubung' : 'Gmail Belum Terhubung'}
            </Text>
          </View>
          <Text style={styles.statusDesc}>
            {gmailConnected
              ? 'Zena sudah bisa membaca email bank otomatis'
              : 'Hubungkan Gmail di Profile untuk auto-import transaksi'}
          </Text>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📬 Cara Kerja</Text>
          <Text style={styles.infoText}>
            1. Tambah/Edit dompet → isi Nama Bank + 4 Digit Terakhir{'\n'}
            2. Hubungkan Gmail di tab Profil{'\n'}
            3. Email bank masuk → Zena deteksi otomatis{'\n'}
            4. Transaksi langsung tercatat di dompet yang sesuai
          </Text>
        </View>

        {/* Dompet dengan Bank Info */}
        {walletsWithBank.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Dompet Siap Auto-Import ({walletsWithBank.length})</Text>
            {walletsWithBank.map((wallet) => (
              <View key={wallet.id} style={[styles.walletCard, { borderLeftColor: wallet.color }]}>
                <Text style={styles.walletIcon}>{wallet.icon}</Text>
                <View style={styles.walletInfo}>
                  <Text style={styles.walletName}>{wallet.wallet_name}</Text>
                  <Text style={styles.walletBank}>
                    {wallet.bank_name} • •••{wallet.last_4_digits}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push(`/edit-wallet?id=${wallet.id}`)}
                  style={styles.editBtn}
                >
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* Empty State */}
        {walletsWithBank.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🏦</Text>
            <Text style={styles.emptyTitle}>Belum Ada Dompet Bank</Text>
            <Text style={styles.emptyText}>
              Tambah dompet dan isi data bank + 4 digit terakhir rekening untuk mengaktifkan auto-import
            </Text>
            <TouchableOpacity
              style={styles.addWalletBtn}
              onPress={() => router.push('/tambah-wallet')}
            >
              <Text style={styles.addWalletBtnText}>+ Tambah Dompet</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Note Card */}
        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>💡 Tips</Text>
          <Text style={styles.noteText}>
            • Pastikan nama bank sama dengan yang ada di email (BCA, Mandiri, BRI, dll){'\n'}
            • 4 digit terakhir harus persis seperti di email bank{'\n'}
            • Satu wallet bisa match ke satu rekening bank
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
  statusCard: {
    marginHorizontal: 20, marginTop: 20, backgroundColor: '#1A1A1A',
    borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  statusTitle: { fontSize: 12, fontWeight: '700', color: '#888780', textTransform: 'uppercase', marginBottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  statusDesc: { fontSize: 12, color: '#888780', lineHeight: 18 },
  infoCard: {
    marginHorizontal: 20, marginTop: 16, backgroundColor: PRIMARY + '20',
    borderRadius: 16, padding: 20, borderWidth: 1, borderColor: PRIMARY + '40',
  },
  infoTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12 },
  infoText: { fontSize: 13, color: '#B8D4F1', lineHeight: 22 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#888780',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginHorizontal: 20, marginTop: 28, marginBottom: 12,
  },
  walletCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginBottom: 10, backgroundColor: '#1A1A1A',
    borderRadius: 12, padding: 14, borderLeftWidth: 3,
  },
  walletIcon: { fontSize: 24 },
  walletInfo: { flex: 1 },
  walletName: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 4 },
  walletBank: { fontSize: 12, color: '#888780' },
  editBtn: {
    backgroundColor: PRIMARY + '30', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  editBtnText: { fontSize: 12, color: PRIMARY, fontWeight: '600' },
  emptyCard: {
    marginHorizontal: 20, marginTop: 20, backgroundColor: '#1A1A1A',
    borderRadius: 12, padding: 32, alignItems: 'center', borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 8 },
  emptyText: { fontSize: 13, color: '#888780', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  addWalletBtn: {
    backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24,
  },
  addWalletBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  noteCard: {
    marginHorizontal: 20, marginTop: 24, backgroundColor: '#1A1A1A',
    borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  noteTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 8 },
  noteText: { fontSize: 12, color: '#888780', lineHeight: 18 },
})
