import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Share, Alert
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Transaction, CATEGORIES, BudgetMethod } from '../../types'
import { BUDGET_METHODS } from '../../constants'
import { COLORS, RADIUS, SHADOW } from '../../constants/theme'
import LineChart from '../../components/LineChart'

const PRIMARY = COLORS.primary
const INCOME = COLORS.income
const EXPENSE = COLORS.expense
const TEXT_MAIN = COLORS.text
const TEXT_MUTED = COLORS.textMuted
const CARD = COLORS.card
const BORDER = COLORS.border
const BG_APP = COLORS.bg

const CATEGORY_EMOJI: Record<string, string> = {
  'Makan & Minum': '🍔', 'Transport': '🚗', 'Belanja': '🛍️',
  'Tagihan': '📋', 'Hiburan': '🎮', 'Kesehatan': '💊',
  'Bisnis': '💼', 'Investasi': '📈', 'Tabungan': '🏦',
  'Biaya Admin & Fee': '💳', 'Lainnya': '📦',
}

const NEEDS_CATEGORIES = ['Makan & Minum', 'Transport', 'Tagihan', 'Kesehatan']
const WANTS_CATEGORIES = ['Hiburan', 'Belanja', 'Lainnya', 'Biaya Admin & Fee', 'Bisnis']
const SAVINGS_CATEGORIES = ['Tabungan', 'Investasi']

type BudgetBucket = {
  label: string
  emoji: string
  budget: number
  spent: number
  color: string
}

export default function LaporanScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  )
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [budgetMethod, setBudgetMethod] = useState<BudgetMethod>('503020')
  const [activeMode, setActiveMode] = useState<'personal' | 'business'>('personal')
  const [wallets, setWallets] = useState<{ id: string; wallet_function: string }[]>([])
  const [receivables, setReceivables] = useState<{ type: string; status: string; amount: number }[]>([])
  const [reportTab, setReportTab] = useState<'ringkasan' | 'cashflow' | 'kategori'>('ringkasan')

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    // Batas akhir = awal bulan BERIKUTNYA (pakai .lt), supaya tidak pakai
    // '-31' yang invalid untuk bulan <31 hari (Feb/Apr/Jun/Sep/Nov) yang
    // bikin query error & laporan kosong.
    const [y, m] = selectedMonth.split('-').map(Number)
    const nextMonth = m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, '0')}-01`

    const [{ data }, { data: prefsRows }, { data: walletRows }, { data: receivableRows }] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user?.id)
        .gte('date', selectedMonth + '-01')
        .lt('date', nextMonth)
        .order('date', { ascending: false }),
      supabase
        .from('user_preferences')
        .select('monthly_income, budget_method, active_mode')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: true })
        .limit(1),
      supabase
        .from('user_wallets')
        .select('id, wallet_function')
        .eq('user_id', user?.id),
      supabase
        .from('receivables')
        .select('type, status, amount')
        .eq('user_id', user?.id),
    ])

    if (data) setTransactions(data)
    if (walletRows) setWallets(walletRows)
    if (receivableRows) setReceivables(receivableRows)
    const prefs = prefsRows?.[0]
    if (prefs) {
      setMonthlyIncome(prefs.monthly_income || 0)
      setBudgetMethod((prefs.budget_method as BudgetMethod) || '503020')
      setActiveMode((prefs.active_mode as 'personal' | 'business') || 'personal')
    }
    setLoading(false)
  }

  useFocusEffect(useCallback(() => { fetchData() }, [selectedMonth]))

  // Klasifikasi transaksi → personal/business.
  // Aturan: kalau transaksi terkait PROJECT atau punya kategori bisnis → BISNIS
  // (walau dompetnya personal). Selain itu ikut fungsi dompetnya.
  const walletFn = new Map(wallets.map(w => [w.id, w.wallet_function]))
  const txMode = (t: any): 'personal' | 'business' => {
    if (t.project_id || t.business_category) return 'business'
    return walletFn.get(t.wallet_id || '') === 'business' ? 'business' : 'personal'
  }
  const realTransactions = transactions.filter(
    t => !t.is_wallet_transfer && txMode(t) === activeMode
  )

  const totalIncome = realTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const totalExpense = realTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)

  // Metrik bisnis (piutang/hutang) — dari receivables pending
  const totalPiutang = receivables
    .filter(r => r.type === 'piutang' && r.status === 'pending')
    .reduce((sum, r) => sum + r.amount, 0)
  const totalHutang = receivables
    .filter(r => r.type === 'hutang' && r.status === 'pending')
    .reduce((sum, r) => sum + r.amount, 0)
  const labaBersih = totalIncome - totalExpense

  // Data cashflow: saldo kumulatif per hari dalam bulan terpilih (untuk line chart)
  const cashflowData = (() => {
    const [yy, mm] = selectedMonth.split('-').map(Number)
    const daysInMonth = new Date(yy, mm, 0).getDate()
    const daily = new Array(daysInMonth).fill(0)
    realTransactions.forEach(t => {
      const day = parseInt(t.date.slice(8, 10)) - 1
      if (day >= 0 && day < daysInMonth) {
        daily[day] += t.type === 'income' ? t.amount : -t.amount
      }
    })
    // kumulatif
    let run = 0
    return daily.map(d => (run += d))
  })()

  const formatRupiah = (amount: number) => 'Rp ' + Math.abs(amount).toLocaleString('id-ID')

  const getCategoryTotal = (category: string) =>
    realTransactions.filter(t => t.category === category && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)

  const getMonthLabel = (month: string) => {
    const [year, m] = month.split('-')
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
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

  // Budget tracking berdasarkan metode
  const getBudgetBuckets = (): BudgetBucket[] => {
    if (!monthlyIncome) return []

    const needsSpent = realTransactions
      .filter(t => t.type === 'expense' && NEEDS_CATEGORIES.includes(t.category))
      .reduce((sum, t) => sum + t.amount, 0)
    const wantsSpent = realTransactions
      .filter(t => t.type === 'expense' && WANTS_CATEGORIES.includes(t.category))
      .reduce((sum, t) => sum + t.amount, 0)
    const savingsSpent = realTransactions
      .filter(t => t.type === 'expense' && SAVINGS_CATEGORIES.includes(t.category))
      .reduce((sum, t) => sum + t.amount, 0)

    const method = BUDGET_METHODS[budgetMethod]
    if (!method) return []

    if (budgetMethod === '503020') {
      return [
        { label: 'Kebutuhan', emoji: '🏠', budget: monthlyIncome * 0.5, spent: needsSpent, color: '#1D9E75' },
        { label: 'Keinginan', emoji: '🎉', budget: monthlyIncome * 0.3, spent: wantsSpent, color: '#BA7517' },
        { label: 'Tabungan', emoji: '🐷', budget: monthlyIncome * 0.2, spent: savingsSpent, color: '#534AB7' },
      ]
    } else if (budgetMethod === '703010') {
      return [
        { label: 'Biaya Hidup', emoji: '🏠', budget: monthlyIncome * 0.7, spent: needsSpent + wantsSpent, color: '#1D9E75' },
        { label: 'Tabungan', emoji: '🐷', budget: monthlyIncome * 0.2, spent: savingsSpent, color: '#534AB7' },
        { label: 'Investasi', emoji: '📈', budget: monthlyIncome * 0.1, spent: 0, color: '#185FA5' },
      ]
    } else if (budgetMethod === 'payfirst') {
      return [
        { label: 'Tabungan & Invest', emoji: '💎', budget: monthlyIncome * 0.25, spent: savingsSpent, color: '#534AB7' },
        { label: 'Kebutuhan', emoji: '🏠', budget: monthlyIncome * 0.5, spent: needsSpent, color: '#1D9E75' },
        { label: 'Keinginan', emoji: '🎉', budget: monthlyIncome * 0.25, spent: wantsSpent, color: '#BA7517' },
      ]
    } else {
      return [
        { label: 'Total Pengeluaran', emoji: '💰', budget: monthlyIncome, spent: totalExpense, color: PRIMARY },
      ]
    }
  }

  const budgetBuckets = getBudgetBuckets()

  const getBudgetBarColor = (pct: number) => {
    if (pct >= 100) return '#E24B4A'
    if (pct >= 90) return '#BA7517'
    if (pct >= 75) return '#EF9F27'
    return '#1D9E75'
  }

  const handleShare = async () => {
    const budgetLine = budgetBuckets.length > 0
      ? '\n📊 Budget:\n' + budgetBuckets.map(b =>
          `  ${b.emoji} ${b.label}: ${formatRupiah(b.spent)} / ${formatRupiah(b.budget)} (${b.budget > 0 ? Math.round(b.spent / b.budget * 100) : 0}%)`
        ).join('\n')
      : ''

    const topExp = categoriesWithData.slice(0, 3).map(({ cat, total }) =>
      `  ${CATEGORY_EMOJI[cat] || '📦'} ${cat}: ${formatRupiah(total)}`
    ).join('\n')

    const shareText =
`📱 Laporan Keuangan Zena
📅 ${getMonthLabel(selectedMonth)}

💰 Pemasukan: ${formatRupiah(totalIncome)}
💸 Pengeluaran: ${formatRupiah(totalExpense)}
${totalIncome - totalExpense >= 0 ? '✅' : '🔴'} Saldo Bersih: ${totalIncome - totalExpense >= 0 ? '+' : '-'}${formatRupiah(totalIncome - totalExpense)}
${budgetLine}

🏆 Top Pengeluaran:
${topExp || '  Belum ada data'}

Dicatat pakai Zena 🌿`

    try {
      await Share.share({ message: shareText, title: 'Laporan Keuangan Zena' })
    } catch {
      Alert.alert('Gagal', 'Tidak bisa share laporan')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Laporan</Text>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>↑ Share</Text>
        </TouchableOpacity>
      </View>

      {/* Tab pills */}
      <View style={styles.tabPills}>
        {(['ringkasan', 'cashflow', 'kategori'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabPill, reportTab === tab && styles.tabPillActive]}
            onPress={() => setReportTab(tab)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabPillText, reportTab === tab && styles.tabPillTextActive]}>
              {tab === 'ringkasan' ? 'Ringkasan' : tab === 'cashflow' ? 'Cashflow' : 'Kategori'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Month selector */}
      <View style={styles.monthSelector}>
        <TouchableOpacity onPress={() => setSelectedMonth(getPrevMonth())} style={styles.monthArrowBtn}>
          <Ionicons name="chevron-back" size={18} color={PRIMARY} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="calendar-outline" size={16} color={TEXT_MUTED} />
          <Text style={styles.monthLabel}>{getMonthLabel(selectedMonth)}</Text>
        </View>
        <TouchableOpacity onPress={() => setSelectedMonth(getNextMonth())} style={styles.monthArrowBtn}>
          <Ionicons name="chevron-forward" size={18} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>

          {/* Mode indicator */}
          <View style={styles.modeRow}>
            <Text style={[styles.modeChip, { color: activeMode === 'business' ? '#1D9E75' : PRIMARY,
              borderColor: activeMode === 'business' ? '#1D9E75' : PRIMARY }]}>
              {activeMode === 'business' ? '💼 Laporan Bisnis' : '👤 Laporan Pribadi'}
            </Text>
          </View>

          {/* Summary cards */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, { borderTopColor: '#1D9E75' }]}>
              <Text style={styles.summaryLabel}>{activeMode === 'business' ? 'Omzet' : 'Pemasukan'}</Text>
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
            { borderTopColor: labaBersih >= 0 ? '#1D9E75' : '#E24B4A' }]}>
            <Text style={styles.summaryLabel}>{activeMode === 'business' ? 'Laba Bersih' : 'Saldo bersih'}</Text>
            <Text style={[styles.summaryAmount,
              { color: labaBersih >= 0 ? '#1D9E75' : '#E24B4A' }]}>
              {labaBersih >= 0 ? '+' : '-'}{formatRupiah(labaBersih)}
            </Text>
          </View>

          {/* CASHFLOW tab — tren saldo kumulatif */}
          {reportTab === 'cashflow' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tren Cashflow</Text>
              <View style={styles.chartCard}>
                <LineChart
                  data={cashflowData}
                  width={320}
                  height={150}
                  color={labaBersih >= 0 ? INCOME : EXPENSE}
                />
                <View style={styles.chartFootRow}>
                  <Ionicons name={labaBersih >= 0 ? 'trending-up' : 'trending-down'} size={15} color={labaBersih >= 0 ? INCOME : EXPENSE} />
                  <Text style={[styles.chartFootText, { color: labaBersih >= 0 ? INCOME : EXPENSE }]}>
                    {labaBersih >= 0 ? 'Surplus' : 'Defisit'} {formatRupiah(labaBersih)} bulan ini
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* BISNIS: Piutang & Hutang */}
          {reportTab === 'ringkasan' && activeMode === 'business' && (
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { borderTopColor: '#1D9E75' }]}>
                <Text style={styles.summaryLabel}>Piutang (belum ditagih)</Text>
                <Text style={[styles.summaryAmount, { color: '#1D9E75', fontSize: 18 }]}>
                  {formatRupiah(totalPiutang)}
                </Text>
              </View>
              <View style={[styles.summaryCard, { borderTopColor: '#BA7517' }]}>
                <Text style={styles.summaryLabel}>Hutang (belum dibayar)</Text>
                <Text style={[styles.summaryAmount, { color: '#BA7517', fontSize: 18 }]}>
                  {formatRupiah(totalHutang)}
                </Text>
              </View>
            </View>
          )}

          {/* Budget tracking — hanya mode Pribadi (konsep budget 50/30/20 dst) */}
          {reportTab === 'ringkasan' && activeMode === 'personal' && monthlyIncome > 0 && budgetBuckets.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Budget Bulan Ini</Text>
              <Text style={styles.sectionSub}>Metode: {BUDGET_METHODS[budgetMethod]?.name}</Text>
              {budgetBuckets.map((bucket, i) => {
                const pct = bucket.budget > 0 ? Math.min(100, (bucket.spent / bucket.budget) * 100) : 0
                const barColor = getBudgetBarColor(pct)
                return (
                  <View key={i} style={styles.budgetRow}>
                    <View style={styles.budgetHeader}>
                      <Text style={styles.budgetLabel}>{bucket.emoji} {bucket.label}</Text>
                      <Text style={[styles.budgetPct, { color: barColor }]}>{Math.round(pct)}%</Text>
                    </View>
                    <View style={styles.budgetBarBg}>
                      <View style={[styles.budgetBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                    </View>
                    <View style={styles.budgetAmounts}>
                      <Text style={styles.budgetSpent}>{formatRupiah(bucket.spent)}</Text>
                      <Text style={styles.budgetLimit}>dari {formatRupiah(bucket.budget)}</Text>
                    </View>
                    {pct >= 100 && <Text style={styles.budgetOverLabel}>🚨 Budget habis!</Text>}
                    {pct >= 90 && pct < 100 && <Text style={styles.budgetWarnLabel}>⚠️ Hampir habis</Text>}
                  </View>
                )
              })}
            </View>
          )}

          {/* Savings rate — hanya mode Pribadi */}
          {reportTab === 'ringkasan' && activeMode === 'personal' && monthlyIncome > 0 && (
            <View style={styles.savingsCard}>
              <Text style={styles.savingsLabel}>Saving Rate</Text>
              <Text style={styles.savingsValue}>
                {totalIncome > 0 ? Math.max(0, Math.round(((totalIncome - totalExpense) / monthlyIncome) * 100)) : 0}%
              </Text>
              <Text style={styles.savingsSub}>
                {totalIncome - totalExpense > 0
                  ? `Tersimpan ${formatRupiah(totalIncome - totalExpense)}`
                  : 'Pengeluaran melebihi pemasukan'}
              </Text>
            </View>
          )}

          {/* Category breakdown */}
          {reportTab === 'kategori' && categoriesWithData.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pengeluaran per Kategori</Text>
              {categoriesWithData.map(({ cat, total }) => (
                <View key={cat} style={styles.catRow}>
                  <Text style={styles.catEmoji}>{CATEGORY_EMOJI[cat] || '📦'}</Text>
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
            <Text style={styles.sectionTitle}>Semua Transaksi</Text>
            {transactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📊</Text>
                <Text style={styles.emptyText}>Belum ada transaksi bulan ini</Text>
              </View>
            ) : (
              transactions.map((txn) => (
                <View key={txn.id} style={styles.txnItem}>
                  <View style={styles.txnIcon}>
                    <Text>{txn.is_wallet_transfer ? '🔄' : (CATEGORY_EMOJI[txn.category] || '📦')}</Text>
                  </View>
                  <View style={styles.txnInfo}>
                    <Text style={styles.txnCategory}>
                      {txn.is_wallet_transfer
                        ? (txn.type === 'expense' ? 'Transfer Keluar' : 'Transfer Masuk')
                        : txn.category
                      }
                    </Text>
                    <Text style={styles.txnDate}>{txn.date}{txn.note ? ' · ' + txn.note : ''}</Text>
                  </View>
                  <Text style={[
                    styles.txnAmount,
                    txn.type === 'income' ? styles.income : styles.expense,
                    txn.is_wallet_transfer && { color: '#888780' }
                  ]}>
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
  container: { flex: 1, backgroundColor: BG_APP },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 8,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: TEXT_MAIN },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: PRIMARY + '12', borderRadius: RADIUS.pill,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  shareBtnText: { fontSize: 13, color: PRIMARY, fontWeight: '700' },
  tabPills: {
    flexDirection: 'row', backgroundColor: '#EAEEF4', borderRadius: RADIUS.md,
    padding: 4, marginHorizontal: 20, marginTop: 6, gap: 4,
  },
  tabPill: { flex: 1, paddingVertical: 9, borderRadius: RADIUS.sm, alignItems: 'center' },
  tabPillActive: { backgroundColor: PRIMARY, ...SHADOW.card },
  tabPillText: { fontSize: 12.5, fontWeight: '700', color: TEXT_MUTED },
  tabPillTextActive: { color: '#fff' },
  monthSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 20,
  },
  monthArrowBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', ...SHADOW.card },
  monthLabel: { fontSize: 15, fontWeight: '700', color: TEXT_MAIN, textAlign: 'center' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  modeRow: { marginBottom: 12, alignItems: 'flex-start' },
  modeChip: {
    fontSize: 13, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, overflow: 'hidden',
  },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  summaryCard: {
    flex: 1, backgroundColor: CARD, borderRadius: RADIUS.lg,
    padding: 14, borderTopWidth: 3, ...SHADOW.card,
  },
  summaryCardFull: { marginBottom: 20 },
  summaryLabel: { fontSize: 12, color: TEXT_MUTED, marginBottom: 4 },
  summaryAmount: { fontSize: 16, fontWeight: '800' },
  chartCard: { backgroundColor: CARD, borderRadius: RADIUS.lg, padding: 16, ...SHADOW.card },
  chartFootRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  chartFootText: { fontSize: 13, fontWeight: '700' },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: TEXT_MUTED,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  sectionSub: { fontSize: 11, color: TEXT_MUTED, marginBottom: 12, marginTop: -6 },
  budgetRow: { backgroundColor: CARD, borderRadius: RADIUS.md, padding: 14, marginBottom: 8, ...SHADOW.card },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  budgetLabel: { fontSize: 13, fontWeight: '600', color: TEXT_MAIN },
  budgetPct: { fontSize: 13, fontWeight: '700' },
  budgetBarBg: { height: 6, backgroundColor: BORDER, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  budgetBarFill: { height: '100%', borderRadius: 3 },
  budgetAmounts: { flexDirection: 'row', justifyContent: 'space-between' },
  budgetSpent: { fontSize: 12, fontWeight: '600', color: TEXT_MAIN },
  budgetLimit: { fontSize: 12, color: TEXT_MUTED },
  budgetOverLabel: { fontSize: 11, color: EXPENSE, marginTop: 4, fontWeight: '600' },
  budgetWarnLabel: { fontSize: 11, color: '#BA7517', marginTop: 4, fontWeight: '600' },
  savingsCard: {
    backgroundColor: CARD, borderRadius: RADIUS.lg, padding: 16, marginBottom: 20,
    borderLeftWidth: 4, borderLeftColor: '#7C3AED', ...SHADOW.card,
  },
  savingsLabel: { fontSize: 11, color: TEXT_MUTED, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  savingsValue: { fontSize: 28, fontWeight: '800', color: '#7C3AED', marginBottom: 2 },
  savingsSub: { fontSize: 12, color: TEXT_MUTED },
  catRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  catEmoji: { fontSize: 20, marginTop: 2 },
  catInfo: { flex: 1 },
  catLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  catName: { fontSize: 13, fontWeight: '600', color: TEXT_MAIN },
  catAmount: { fontSize: 13, fontWeight: '700', color: TEXT_MAIN },
  catBarBg: { height: 5, backgroundColor: BORDER, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  catBarFill: { height: '100%', borderRadius: 3 },
  catPct: { fontSize: 11, color: TEXT_MUTED },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyText: { fontSize: 14, color: TEXT_MUTED },
  txnItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  txnIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: BG_APP, alignItems: 'center', justifyContent: 'center' },
  txnInfo: { flex: 1 },
  txnCategory: { fontSize: 13, fontWeight: '600', color: TEXT_MAIN },
  txnDate: { fontSize: 11, color: TEXT_MUTED, marginTop: 1 },
  txnAmount: { fontSize: 13, fontWeight: '700' },
  income: { color: INCOME },
  expense: { color: EXPENSE },
})
