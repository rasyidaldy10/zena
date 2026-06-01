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
  const [connecting, setConnecting] = useState(false)

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

  const handleConnect = async () => {
    setConnecting(true)
    try {
      if (Platform.OS === 'web') {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + '/gmail-setup',
            scopes: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
            skipBrowserRedirect: false,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        })
        if (error) throw error
      } else {
        Alert.alert('Info', 'Gmail auto-import hanya tersedia di web/PWA.')
      }
    } catch (error: any) {
      Alert.alert('Gagal', error.message)
      setConnecting(false)
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
        <Text style={styles.headerTitle}>Gmail Auto-Import</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>📧</Text>
          <Text style={styles.infoTitle}>Auto-Detect Transaksi</Text>
          <Text style={styles.infoText}>
            Zena akan membaca email bank dan otomatis:
            {'\n'}• Deteksi nama bank (BCA, Mandiri, dll)
            {'\n'}• Deteksi 4 digit terakhir rekening
            {'\n'}• Catat transaksi ke wallet yang kamu pilih
          </Text>
        </View>

        {/* Connect Button */}
        {mappings.length === 0 && (
          <TouchableOpacity
            style={styles.connectBtnLarge}
            onPress={handleConnect}
            disabled={connecting}
            activeOpacity={0.8}
          >
            {connecting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.connectBtnIcon}>🔗</Text>
                <Text style={styles.connectBtnText}>Hubungkan Gmail Sekarang</Text>
                <Text style={styles.connectBtnSub}>Approve akses Gmail untuk auto-import</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Mapping Aktif */}
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

        {mappings.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📧</Text>
            <Text style={styles.emptyTitle}>Belum Ada Mapping</Text>
            <Text style={styles.emptyText}>
              Logout → Login lagi untuk approve Gmail consent, lalu tunggu email bank masuk.
            </Text>
          </View>
        )}

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>💡 Tips</Text>
          <Text style={styles.noteText}>
            • Bank + 4 digit rekening otomatis terdeteksi dari email{'\n'}
            • Notifikasi akan muncul setiap transaksi auto-import{'\n'}
            • Transaksi dari Gmail bersifat read-only{'\n'}
            • Parsing hanya untuk 7 hari terakhir
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
  stepCard: {
    marginHorizontal: 20, marginTop: 20, backgroundColor: '#1A1A1A',
    borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  stepTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 10 },
  stepText: { fontSize: 13, color: '#888780', lineHeight: 20 },
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
  emptyCard: {
    marginHorizontal: 20, marginTop: 20, backgroundColor: '#1A1A1A',
    borderRadius: 12, padding: 32, alignItems: 'center', borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 8 },
  emptyText: { fontSize: 13, color: '#888780', textAlign: 'center', lineHeight: 20 },
  noteCard: {
    marginHorizontal: 20, marginTop: 24, backgroundColor: '#1A1A1A',
    borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  noteTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 8 },
  noteText: { fontSize: 12, color: '#888780', lineHeight: 18 },
  connectBtnLarge: {
    marginHorizontal: 20, marginTop: 24, backgroundColor: PRIMARY,
    borderRadius: 16, paddingVertical: 20, paddingHorizontal: 24,
    alignItems: 'center', shadowColor: PRIMARY, shadowOpacity: 0.3,
    shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  connectBtnIcon: { fontSize: 32, marginBottom: 8 },
  connectBtnText: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 4 },
  connectBtnSub: { fontSize: 12, color: '#B8D4F1', textAlign: 'center' },
})
