import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { Transaction } from '../../types'

const PRIMARY = '#185FA5'

export default function DashboardScreen() {
  const [mode, setMode] = useState<'personal' | 'business'>('personal')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [totalBalance, setTotalBalance] = useState(0)

  const fetchTransactions = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (data) {
      setTransactions(data)
      const total = data.reduce((sum, t) => {
        return t.type === 'income' ? sum + t.amount : sum - t.amount
      }, 0)
      setTotalBalance(total)
    }
    setLoading(false)
  }

  useFocusEffect(
    useCallback(() => {
      fetchTransactions()
    }, [])
  )

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login')
  }

  const formatRupiah = (amount: number) => {
    return 'Rp ' + Math.abs(amount).toLocaleString('id-ID')
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Selamat datang 👋</Text>
          <Text style={styles.appName}>Zena</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
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
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>
            {mode === 'personal' ? 'Total saldo pribadi' : 'Total saldo bisnis'}
          </Text>
          <Text style={styles.balanceAmount}>{formatRupiah(totalBalance)}</Text>
          <Text style={styles.balanceSub}>
            {transactions.length > 0 ? `${transactions.length} transaksi tercatat` : 'Belum ada transaksi'}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Aksi cepat</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.qaBtn}
            onPress={() => router.push('/tambah-transaksi')}
          >
            <Text style={styles.qaIcon}>➕</Text>
            <Text style={styles.qaLabel}>Catat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaBtn}>
            <Text style={styles.qaIcon}>📷</Text>
            <Text style={styles.qaLabel}>Scan struk</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaBtn}>
            <Text style={styles.qaIcon}>🎤</Text>
            <Text style={styles.qaLabel}>Voice</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaBtn}>
            <Text style={styles.qaIcon}>🤖</Text>
            <Text style={styles.qaLabel}>AI Chat</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Transaksi terakhir</Text>

        {loading ? (
          <ActivityIndicator color={PRIMARY} style={{ marginTop: 20 }} />
        ) : transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💸</Text>
            <Text style={styles.emptyText}>Belum ada transaksi</Text>
            <Text style={styles.emptySubtext}>Mulai catat pengeluaran pertamamu!</Text>
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
  logoutBtn: { padding: 8 },
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
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#888780', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
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