import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { Transaction, CATEGORIES } from '../../types'

const PRIMARY = '#185FA5'

export default function LaporanScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  )

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user?.id)
      .gte('date', selectedMonth + '-01')
      .lte('date', selectedMonth + '-31')
      .order('date', { ascending: false })

    if (data) setTransactions(data)
    setLoading(false)
  }

  useFocusEffect(useCallback(() => { fetchData() }, [selectedMonth]))

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const formatRupiah = (amount: number) =>
    'Rp ' + Math.abs(amount).toLocaleString('id-ID')

  const getCategoryTotal = (category: string) =>
    transactions
      .filter(t => t.category === category && t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0)

  const getCategoryEmoji = (category: string) => {
    const map: Record<string, string> = {
      'Makan & Minum': '🍔', 'Transport': '🚗', 'Belanja': '🛍️',
      'Tagihan': '📋', 'Hiburan': '🎮', 'Kesehatan': '💊',
      'Bisnis': '💼', 'Investasi': '📈', 'Tabungan': '🏦',
      'Biaya Admin & Fee': '💳', 'Lainnya': '📦',
    }
    return map[category] || '📦'
  }

  const getMonthLabel = (month: string) => {
    const [year, m] = month.split('-')
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    return `${months[parseInt(m) - 1]} ${year}`
  }

  const getPrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const prev = new Date(year, month - 2, 1)
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
  }

  const getNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const next = new Date(year, month, 1)
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
  }

  const categoriesWithData = CATEGORIES
    .map(cat => ({ cat, total: getCategoryTotal(cat) }))
    .filter(item => item.total > 0)
    .sort((a, b) => b.total - a.total)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Laporan</Text>
      </View>

      {/* Month selector */}
      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={() => setSelectedMonth(getPrevMonth())}>
          <Text style={styles.monthArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{getMonthLabel(selectedMonth)}</Text>
        <TouchableOpacity onPress={() => setSelectedMonth(getNextMonth())}>
          <Text style={styles.monthArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>

          {/* Summary cards */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { borderTopColor: '#1D9E75' }]}>
              <Text style={styles.summaryLabel}>Pemasukan</Text>
              <Text style={[styles.summaryAmount, { color: '#1D9E75' }]}>
                {formatRupiah(totalIncome)}
              </Text>
            </View>
            <View style={[styles.summaryCard, { borderTopColor: '#E24B4A' }]}>
              <Text style={styles.summaryLabel}>Pengeluaran</Text>
              <Text style={[styles.summaryAmount, { color: '#E24B4A' }]}>
                {formatRupiah(totalExpense)}
              </Text>
            </View>
          </View>

          <View style={[styles.summaryCard, styles.summaryCardFull,
            { borderTopColor: totalIncome - totalExpense >= 0 ? '#1D9E75' : '#E24B4A' }]}>
            <Text style={styles.summaryLabel}>Saldo bersih</Text>
            <Text style={[styles.summaryAmount,
              { color: totalIncome - totalExpense >= 0 ? '#1D9E75' : '#E24B4A' }]}>
              {totalIncome - totalExpense >= 0 ? '+' : '-'}{formatRupiah(totalIncome - totalExpense)}
            </Text>
          </View>

          {/* Category breakdown */}
          {categoriesWithData.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pengeluaran per kategori</Text>
              {categoriesWithData.map(({ cat, total }) => (
                <View key={cat} style={styles.catRow}>
                  <Text style={styles.catEmoji}>{getCategoryEmoji(cat)}</Text>
                  <View style={styles.catInfo}>
                    <View style={styles.catLabelRow}>
                      <Text style={styles.catName}>{cat}</Text>
                      <Text style={styles.catAmount}>{formatRupiah(total)}</Text>
                    </View>
                    <View style={styles.catBarBg}>
                      <View style={[styles.catBarFill, {
                        width: `${Math.min(100, (total / totalExpense) * 100)}%`,
                        backgroundColor: PRIMARY,
                      }]} />
                    </View>
                    <Text style={styles.catPct}>
                      {totalExpense > 0 ? Math.round((total / totalExpense) * 100) : 0}% dari total pengeluaran
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Transaction list */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Semua transaksi</Text>
            {transactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📊</Text>
                <Text style={styles.emptyText}>Belum ada transaksi bulan ini</Text>
              </View>
            ) : (
              transactions.map((txn) => (
                <View key={txn.id} style={styles.txnItem}>
                  <View style={styles.txnIcon}>
                    <Text>{getCategoryEmoji(txn.category)}</Text>
                  </View>
                  <View style={styles.txnInfo}>
                    <Text style={styles.txnCategory}>{txn.category}</Text>
                    <Text style={styles.txnDate}>{txn.date} · {txn.note || txn.source}</Text>
                  </View>
                  <Text style={[styles.txnAmount,
                    txn.type === 'income' ? styles.income : styles.expense]}>
                    {txn.type === 'income' ? '+' : '-'}{formatRupiah(txn.amount)}
                  </Text>
                </View>
              ))
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '600', color: '#fff' },
  monthSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 24, paddingVertical: 12,
  },
  monthArrow: { fontSize: 24, color: PRIMARY, fontWeight: '300' },
  monthLabel: { fontSize: 16, fontWeight: '600', color: '#fff', minWidth: 100, textAlign: 'center' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  summaryCard: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 12,
    padding: 14, borderTopWidth: 2,
  },
  summaryCardFull: { marginBottom: 20 },
  summaryLabel: { fontSize: 12, color: '#888780', marginBottom: 4 },
  summaryAmount: { fontSize: 16, fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  catRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  catEmoji: { fontSize: 20, marginTop: 2 },
  catInfo: { flex: 1 },
  catLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  catName: { fontSize: 13, fontWeight: '500', color: '#fff' },
  catAmount: { fontSize: 13, fontWeight: '600', color: '#fff' },
  catBarBg: { height: 5, backgroundColor: '#2A2A2A', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  catBarFill: { height: '100%', borderRadius: 3 },
  catPct: { fontSize: 11, color: '#888780' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyText: { fontSize: 14, color: '#888780' },
  txnItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#1A1A1A',
  },
  txnIcon: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  txnInfo: { flex: 1 },
  txnCategory: { fontSize: 13, fontWeight: '500', color: '#fff' },
  txnDate: { fontSize: 11, color: '#888780', marginTop: 1 },
  txnAmount: { fontSize: 13, fontWeight: '600' },
  income: { color: '#1D9E75' },
  expense: { color: '#E24B4A' },
})