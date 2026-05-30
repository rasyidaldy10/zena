import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useState, useCallback } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { Transaction, UserWallet } from '../../types'

const PRIMARY = '#185FA5'

export default function DashboardScreen() {
  const [mode, setMode] = useState<'personal' | 'business'>('personal')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [wallets, setWallets] = useState<UserWallet[]>([])
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [totalBalance, setTotalBalance] = useState(0)
  const [nickname, setNickname] = useState('')

  const fetchData = async (walletFilter: string | null = null) => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('nickname')
      .eq('user_id', user?.id)
      .single()
    if (prefs?.nickname) setNickname(prefs.nickname)

    const { data: walletsData } = await supabase
      .from('user_wallets')
      .select('id, wallet_name, wallet_type, current_balance, color, icon, is_active')
      .eq('user_id', user?.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (walletsData) {
      setWallets(walletsData as UserWallet[])
      const total = walletsData.reduce((sum: number, w: any) => sum + (w.current_balance || 0), 0)
      setTotalBalance(total)
    }

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (walletFilter) {
      query = query.eq('wallet_id', walletFilter)
    }

    const { data } = await query
    if (data) setTransactions(data)

    setLoading(false)
  }

  useFocusEffect(useCallback(() => { fetchData(selectedWalletId) }, []))

  const handleSelectWallet = (walletId: string) => {
    const newId = selectedWalletId === walletId ? null : walletId
    setSelectedWalletId(newId)
    fetchData(newId)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login')
  }

  const formatRupiah = (amount: number) =>
    'Rp ' + Math.abs(amount).toLocaleString('id-ID')

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Selamat pagi'
    if (hour < 15) return 'Selamat siang'
    if (hour < 18) return 'Selamat sore'
    return 'Selamat malam'
  }

  const getCategoryEmoji = (category: string) => {
    const map: Record<string, string> = {
      'Makan & Minum': '🍔', 'Transport': '🚗', 'Belanja': '🛍️',
      'Tagihan': '📋', 'Hiburan': '🎮', 'Kesehatan': '💊',
      'Bisnis': '💼', 'Investasi': '📈', 'Tabungan': '🏦',
      'Biaya Admin & Fee': '💳', 'Lainnya': '📦',
    }
    return map[category] || '📦'
  }

  const selectedWallet = wallets.find(w => w.id === selectedWalletId)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}, {nickname || 'Kamu'} 👋</Text>
          <Text style={styles.appName}>Zena</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Keluar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toggleWrap}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'personal' && styles.toggleBtnActive]}
          onPress={() => setMode('personal')}
        >
          <Text style={[styles.toggleText, mode === 'personal' && styles.toggleTextActive]}>Pribadi</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'business' && styles.toggleBtnActive]}
          onPress={() => setMode('business')}
        >
          <Text style={[styles.toggleText, mode === 'business' && styles.toggleTextActive]}>Bisnis</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>
            {mode === 'personal' ? 'Total saldo pribadi' : 'Total saldo bisnis'}
          </Text>
          <Text style={styles.balanceAmount}>{formatRupiah(totalBalance)}</Text>
          <Text style={styles.balanceSub}>
            {wallets.length} dompet aktif
          </Text>
        </View>

        {/* Dompet Saya */}
        {wallets.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Dompet Saya</Text>
              <TouchableOpacity onPress={() => router.push('/tambah-wallet')}>
                <Text style={styles.sectionAction}>+ Tambah</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.walletScroll}
              contentContainerStyle={styles.walletScrollContent}
            >
              {wallets.map((wallet) => {
                const isSelected = selectedWalletId === wallet.id
                return (
                  <TouchableOpacity
                    key={wallet.id}
                    style={[
                      styles.walletCard,
                      { borderColor: wallet.color || PRIMARY },
                      isSelected && { backgroundColor: wallet.color || PRIMARY },
                    ]}
                    onPress={() => handleSelectWallet(wallet.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.walletIcon}>{wallet.icon || '💰'}</Text>
                    <Text style={[styles.walletName, isSelected && styles.walletNameSelected]} numberOfLines={1}>
                      {wallet.wallet_name}
                    </Text>
                    <Text style={[styles.walletBalance, isSelected && styles.walletBalanceSelected]}>
                      {formatRupiah(wallet.current_balance)}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Aksi cepat</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.qaBtn} onPress={() => router.push('/tambah-transaksi')}>
            <Text style={styles.qaIcon}>➕</Text>
            <Text style={styles.qaLabel}>Catat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaBtn} onPress={() => router.push('/chat')}>
            <Text style={styles.qaIcon}>🤖</Text>
            <Text style={styles.qaLabel}>AI Chat</Text>
          </TouchableOpacity>
        </View>

        {/* Transaksi */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>
            {selectedWallet ? `Transaksi: ${selectedWallet.wallet_name}` : 'Transaksi terakhir'}
          </Text>
          {selectedWalletId && (
            <TouchableOpacity onPress={() => { setSelectedWalletId(null); fetchData(null) }}>
              <Text style={styles.sectionAction}>Semua</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={PRIMARY} style={{ marginTop: 20 }} />
        ) : transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💸</Text>
            <Text style={styles.emptyText}>Belum ada transaksi</Text>
            <Text style={styles.emptySubtext}>
              {selectedWalletId ? 'Di dompet ini belum ada transaksi' : 'Mulai catat pengeluaran pertamamu!'}
            </Text>
          </View>
        ) : (
          transactions.map((txn) => (
            <View key={txn.id} style={styles.txnItem}>
              <View style={styles.txnIcon}>
                <Text style={styles.txnEmoji}>{getCategoryEmoji(txn.category)}</Text>
              </View>
              <View style={styles.txnInfo}>
                <Text style={styles.txnCategory}>{txn.category}</Text>
                <Text style={styles.txnDate}>{txn.date}</Text>
              </View>
              <Text style={[styles.txnAmount, txn.type === 'income' ? styles.income : styles.expense]}>
                {txn.type === 'income' ? '+' : '-'}{formatRupiah(txn.amount)}
              </Text>
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  greeting: { fontSize: 13, color: '#888780' },
  appName: { fontSize: 24, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.5 },
  logoutText: { fontSize: 13, color: '#888780' },
  toggleWrap: {
    flexDirection: 'row', backgroundColor: '#1A1A1A',
    marginHorizontal: 20, borderRadius: 12, padding: 3, marginBottom: 16, gap: 3,
  },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: PRIMARY },
  toggleText: { fontSize: 13, color: '#888780', fontWeight: '500' },
  toggleTextActive: { color: '#fff', fontWeight: '600' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  balanceCard: { backgroundColor: PRIMARY, borderRadius: 16, padding: 20, marginBottom: 24 },
  balanceLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  balanceAmount: { fontSize: 32, fontWeight: '600', color: '#fff', letterSpacing: -1 },
  balanceSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionAction: { fontSize: 13, color: PRIMARY, fontWeight: '500' },
  walletScroll: { marginBottom: 24, marginHorizontal: -20 },
  walletScrollContent: { paddingHorizontal: 20, gap: 10 },
  walletCard: {
    width: 130, backgroundColor: '#1A1A1A', borderRadius: 14,
    padding: 14, borderWidth: 1.5,
  },
  walletIcon: { fontSize: 22, marginBottom: 8 },
  walletName: { fontSize: 12, color: '#888780', fontWeight: '500', marginBottom: 4 },
  walletNameSelected: { color: '#fff' },
  walletBalance: { fontSize: 13, color: '#fff', fontWeight: '600' },
  walletBalanceSelected: { color: '#fff' },
  quickActions: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  qaBtn: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 0.5, borderColor: '#2A2A2A' },
  qaIcon: { fontSize: 20, marginBottom: 6 },
  qaLabel: { fontSize: 11, color: '#888780', fontWeight: '500' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#FFFFFF', fontWeight: '500', marginBottom: 4 },
  emptySubtext: { fontSize: 13, color: '#888780' },
  txnItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#1A1A1A',
  },
  txnIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  txnEmoji: { fontSize: 18 },
  txnInfo: { flex: 1 },
  txnCategory: { fontSize: 14, fontWeight: '500', color: '#fff' },
  txnDate: { fontSize: 12, color: '#888780', marginTop: 2 },
  txnAmount: { fontSize: 14, fontWeight: '600' },
  income: { color: '#1D9E75' },
  expense: { color: '#E24B4A' },
})
