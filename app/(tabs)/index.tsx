import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image, Dimensions
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { UserWallet, Transaction, UserPreferences, TierName } from '../../types'
import { calculateFinancialScore } from '../../lib/scoring'
import { TIER_CONFIG } from '../../types'
import CEOWelcomeModal from '../../components/CEOWelcomeModal'

const PRIMARY = '#185FA5'
const BG_APP = '#F4F7FA'
const CARD_BG = '#FFFFFF'
const TEXT_MAIN = '#0D1B3E'
const TEXT_SECONDARY = '#888888'
const INCOME_COLOR = '#16A34A'
const EXPENSE_COLOR = '#E24B4A'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

type TabMode = 'personal' | 'business' | 'all'

export default function HomeScreen() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null)
  const [wallets, setWallets] = useState<UserWallet[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [notifCount, setNotifCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tabMode, setTabMode] = useState<TabMode>('all')
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [rincianExpanded, setRincianExpanded] = useState(false)
  const [showCEOWelcome, setShowCEOWelcome] = useState(false)
  const channelRef = useRef<any>(null)

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const [
      { data: p },
      { data: w },
      { data: t },
      { data: n }
    ] = await Promise.all([
      supabase.from('user_preferences').select('*').eq('user_id', session.user.id).single(),
      supabase.from('user_wallets').select('*').eq('user_id', session.user.id).eq('is_active', true),
      supabase.from('transactions').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('notifications').select('id').eq('user_id', session.user.id).eq('is_read', false)
    ])

    setPrefs(p as UserPreferences)
    setWallets((w ?? []) as UserWallet[])
    setTransactions((t ?? []) as Transaction[])
    setNotifCount(n?.length ?? 0)
    setLoading(false)

    // Check if user is new (show CEO welcome once)
    const hasSeenWelcome = await supabase
      .from('user_preferences')
      .select('has_seen_ceo_welcome')
      .eq('user_id', session.user.id)
      .single()

    if (p && !hasSeenWelcome.data?.has_seen_ceo_welcome) {
      setTimeout(() => setShowCEOWelcome(true), 1000) // Show after 1 second
    }
  }

  const handleCloseCEOWelcome = async () => {
    setShowCEOWelcome(false)
    // Mark as seen
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await supabase
        .from('user_preferences')
        .update({ has_seen_ceo_welcome: true })
        .eq('user_id', session.user.id)
    }
  }

  useFocusEffect(useCallback(() => { fetchData() }, []))

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      channelRef.current = supabase
        .channel(`notif-badge-${session.user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`,
        }, () => {
          setNotifCount(prev => prev + 1)
        })
        .subscribe()
    })
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  const getBalance = () => {
    if (tabMode === 'personal') return wallets.filter(w => w.wallet_type === 'personal').reduce((s, w) => s + w.current_balance, 0)
    if (tabMode === 'business') return wallets.filter(w => w.wallet_type === 'business').reduce((s, w) => s + w.current_balance, 0)
    return wallets.reduce((s, w) => s + w.current_balance, 0)
  }

  // Calculate streak
  const calcStreak = (txns: Transaction[]): number => {
    const dates = new Set(txns.filter(t => !t.is_wallet_transfer).map(t => t.date))
    let s = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      if (dates.has(d.toISOString().split('T')[0])) s++
      else break
    }
    return s
  }

  const streak = calcStreak(transactions)
  const score = prefs ? calculateFinancialScore(transactions, prefs.monthly_income, streak) : null
  const tierName = (score?.tier || 'Starter') as TierName
  const tierConfig = TIER_CONFIG[tierName]
  const initials = prefs?.nickname ? prefs.nickname.slice(0, 2).toUpperCase() : 'U'
  const balance = getBalance()

  // Greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Selamat Pagi'
    if (hour < 15) return 'Selamat Siang'
    if (hour < 18) return 'Selamat Sore'
    return 'Selamat Malam'
  }
  const greeting = getGreeting()

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 100 }} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* CEO WELCOME MODAL */}
      <CEOWelcomeModal
        visible={showCEOWelcome}
        onClose={handleCloseCEOWelcome}
        userName={prefs?.nickname || 'Friend'}
      />

      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.headerGreeting}>{greeting}</Text>
            <Text style={styles.headerName}>{prefs?.nickname || 'User'}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/notifications')}>
            <Text style={styles.headerBtnIcon}>🔔</Text>
            {notifCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{notifCount > 9 ? '9+' : notifCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/(tabs)/profil')}>
            <Text style={styles.headerBtnIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* BALANCE CARD */}
        <View style={styles.balanceCard}>
          {/* Tabs */}
          <View style={styles.balanceTabs}>
            {(['all', 'personal', 'business'] as TabMode[]).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.balanceTab, tabMode === tab && styles.balanceTabActive]}
                onPress={() => setTabMode(tab)}
              >
                <Text style={[styles.balanceTabText, tabMode === tab && styles.balanceTabTextActive]}>
                  {tab === 'all' ? 'Semua' : tab === 'personal' ? 'Pribadi' : 'Bisnis'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Balance */}
          <View style={styles.balanceContent}>
            <View style={styles.balanceLeft}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.balanceLabel}>Total Saldo</Text>
                <TouchableOpacity onPress={() => setBalanceVisible(!balanceVisible)}>
                  <Text style={{ fontSize: 16 }}>{balanceVisible ? '👁️' : '👁️‍🗨️'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.balanceAmount}>
                {balanceVisible ? `Rp ${balance.toLocaleString('id-ID')}` : 'Rp ••••••'}
              </Text>
              <Text style={styles.balanceChange}>↑ +12% bulan ini</Text>
            </View>
            <TouchableOpacity
              style={styles.rincianBtn}
              onPress={() => setRincianExpanded(!rincianExpanded)}
            >
              <Text style={styles.rincianBtnText}>Rincian</Text>
            </TouchableOpacity>
          </View>

          {/* Expanded Wallet List */}
          {rincianExpanded && (
            <View style={styles.walletList}>
              {wallets.map(w => (
                <View key={w.id} style={styles.walletItem}>
                  <Text style={styles.walletIcon}>{w.icon}</Text>
                  <View style={styles.walletInfo}>
                    <Text style={styles.walletName}>{w.wallet_name}</Text>
                    <Text style={styles.walletType}>{w.wallet_type}</Text>
                  </View>
                  <Text style={styles.walletBalance}>Rp {w.current_balance.toLocaleString('id-ID')}</Text>
                </View>
              ))}
            </View>
          )}

          {/* XP Progress */}
          <View style={styles.xpSection}>
            <View style={styles.xpBar}>
              <View style={[styles.xpFill, { width: `${(score?.total ?? 0)}%`, backgroundColor: tierConfig.color }]} />
            </View>
            <Text style={styles.xpText}>{score?.total ?? 0}% XP</Text>
          </View>
        </View>

        {/* QUICK ACTIONS */}
        <View style={styles.quickActions}>
          {/* Row 1 */}
          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/chat')}>
              <View style={[styles.quickIcon, { backgroundColor: '#F3EFFE' }]}>
                <Text style={{ fontSize: 24 }}>💬</Text>
              </View>
              <Text style={styles.quickLabel}>Zena AI</Text>
              <View style={styles.quickBadge}><Text style={styles.quickBadgeText}>AI</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/chat')}>
              <View style={[styles.quickIcon, { backgroundColor: '#EFF6FF' }]}>
                <Text style={{ fontSize: 24 }}>📸</Text>
              </View>
              <Text style={styles.quickLabel}>Scan Struk</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/(tabs)/laporan')}>
              <View style={[styles.quickIcon, { backgroundColor: '#FFFBEB' }]}>
                <Text style={{ fontSize: 24 }}>📊</Text>
              </View>
              <Text style={styles.quickLabel}>Laporan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/(tabs)/laporan')}>
              <View style={[styles.quickIcon, { backgroundColor: '#FEF2F2' }]}>
                <Text style={{ fontSize: 24 }}>🎯</Text>
              </View>
              <Text style={styles.quickLabel}>Budget</Text>
            </TouchableOpacity>
          </View>

          {/* Row 2 */}
          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/zena-intelligence')}>
              <View style={[styles.quickIcon, { backgroundColor: '#F0FDFA' }]}>
                <Text style={{ fontSize: 24 }}>🧠</Text>
              </View>
              <Text style={styles.quickLabel}>ZENA Intel</Text>
              <View style={styles.quickBadge}><Text style={styles.quickBadgeText}>NEW</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => Alert.alert('Tabungan', 'Fitur tabungan segera hadir! 💰')}>
              <View style={[styles.quickIcon, { backgroundColor: '#F0FDF4' }]}>
                <Text style={{ fontSize: 24 }}>💰</Text>
              </View>
              <Text style={styles.quickLabel}>Tabungan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => Alert.alert('Leaderboard 🏆', 'Fitur leaderboard akan datang segera! Bandingkan skor keuangan dengan pengguna lain.')}
            >
              <View style={[styles.quickIcon, { backgroundColor: '#FFFBEB' }]}>
                <Text style={{ fontSize: 24 }}>🏆</Text>
              </View>
              <Text style={styles.quickLabel}>Leaderboard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/(tabs)/reminder')}>
              <View style={[styles.quickIcon, { backgroundColor: '#EFF6FF' }]}>
                <Text style={{ fontSize: 24 }}>🔔</Text>
              </View>
              <Text style={styles.quickLabel}>Reminder</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* FINANCIAL SCORE */}
        <Text style={styles.sectionTitle}>Financial Score</Text>
        <View style={styles.scoreGrid}>
          {[
            { label: 'Konsistensi', value: score?.consistency ?? 0, color: INCOME_COLOR },
            { label: 'Budget', value: score?.budget_adherence ?? 0, color: PRIMARY },
            { label: 'Tabungan', value: score?.saving_rate ?? 0, color: '#B45309' },
            { label: 'Goal', value: score?.goal_completion ?? 0, color: '#7C3AED' },
          ].map(item => (
            <View key={item.label} style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>{item.label}</Text>
              <Text style={[styles.scoreValue, { color: item.color }]}>{item.value}</Text>
              <View style={styles.scoreBar}>
                <View style={[styles.scoreBarFill, { width: `${item.value}%`, backgroundColor: item.color }]} />
              </View>
              <Text style={styles.scoreStatus}>
                {item.value >= 80 ? 'Sangat Baik' : item.value >= 60 ? 'Baik' : item.value >= 40 ? 'Cukup' : 'Perlu Perbaikan'}
              </Text>
            </View>
          ))}
        </View>

        {/* TRANSAKSI TERAKHIR */}
        <View style={styles.txnHeader}>
          <Text style={styles.sectionTitle}>Transaksi Terakhir</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/laporan')}>
            <Text style={styles.txnSeeAll}>Semua →</Text>
          </TouchableOpacity>
        </View>

        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 36 }}>📝</Text>
            <Text style={styles.emptyText}>Belum ada transaksi</Text>
          </View>
        ) : (
          <View style={styles.txnList}>
            {transactions.map(txn => (
              <View key={txn.id} style={styles.txnItem}>
                <View style={[styles.txnIcon, { backgroundColor: txn.type === 'income' ? '#F0FDF4' : '#FEF2F2' }]}>
                  <Text style={{ fontSize: 20 }}>
                    {txn.type === 'income' ? '💰' : '💸'}
                  </Text>
                </View>
                <View style={styles.txnInfo}>
                  <Text style={styles.txnCategory}>{txn.category}</Text>
                  <Text style={styles.txnDate}>{new Date(txn.date).toLocaleDateString('id-ID')}</Text>
                </View>
                <Text style={[styles.txnAmount, { color: txn.type === 'income' ? INCOME_COLOR : EXPENSE_COLOR }]}>
                  {txn.type === 'income' ? '+' : '-'}Rp {txn.amount.toLocaleString('id-ID')}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_APP },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: PRIMARY, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 32,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerLogo: { width: 40, height: 40, borderRadius: 20 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerGreeting: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 2 },
  headerName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerTier: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  headerRight: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  headerBtnIcon: { fontSize: 20 },
  headerBadge: {
    position: 'absolute', top: 2, right: 2, backgroundColor: '#E24B4A',
    borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },
  headerBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  balanceCard: {
    backgroundColor: CARD_BG, marginHorizontal: 16, marginTop: -18,
    borderRadius: 24, padding: 20,
    shadowColor: PRIMARY, shadowOpacity: 0.12, shadowRadius: 32, shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  balanceTabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  balanceTab: { paddingVertical: 8, paddingHorizontal: 16 },
  balanceTabActive: { borderBottomWidth: 2, borderBottomColor: PRIMARY },
  balanceTabText: { fontSize: 13, color: TEXT_SECONDARY },
  balanceTabTextActive: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  balanceContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  balanceLeft: { flex: 1 },
  balanceLabel: { fontSize: 13, color: TEXT_SECONDARY },
  balanceAmount: { fontSize: 28, fontWeight: '800', color: TEXT_MAIN, marginTop: 4 },
  balanceChange: { fontSize: 12, color: INCOME_COLOR, marginTop: 4 },
  rincianBtn: {
    backgroundColor: PRIMARY + '10', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 16,
  },
  rincianBtnText: { fontSize: 12, fontWeight: '600', color: PRIMARY },
  walletList: { marginTop: 16, gap: 12 },
  walletItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  walletIcon: { fontSize: 24 },
  walletInfo: { flex: 1 },
  walletName: { fontSize: 14, fontWeight: '600', color: TEXT_MAIN },
  walletType: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 },
  walletBalance: { fontSize: 13, fontWeight: '600', color: TEXT_MAIN },
  xpSection: { marginTop: 16 },
  xpBar: { height: 6, backgroundColor: '#F0F4F8', borderRadius: 3, overflow: 'hidden' },
  xpFill: { height: '100%' },
  xpText: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 6, textAlign: 'center' },

  quickActions: { marginHorizontal: 20, marginTop: 24, gap: 16 },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quickBtn: { alignItems: 'center', width: (SCREEN_WIDTH - 60) / 4, position: 'relative' },
  quickIcon: {
    width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
  quickLabel: { fontSize: 11, color: TEXT_MAIN, marginTop: 6, textAlign: 'center' },
  quickBadge: {
    position: 'absolute', top: -4, right: 4, backgroundColor: '#E24B4A',
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
  },
  quickBadgeText: { fontSize: 8, fontWeight: '700', color: '#fff' },

  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: TEXT_MAIN,
    marginHorizontal: 20, marginTop: 24, marginBottom: 12,
  },
  scoreGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    marginHorizontal: 20,
  },
  scoreCard: {
    width: (SCREEN_WIDTH - 52) / 2, backgroundColor: '#F8FAFC',
    borderRadius: 14, padding: 16,
  },
  scoreLabel: { fontSize: 12, color: TEXT_SECONDARY, marginBottom: 8 },
  scoreValue: { fontSize: 24, fontWeight: '800' },
  scoreBar: {
    height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginTop: 8, overflow: 'hidden',
  },
  scoreBarFill: { height: '100%' },
  scoreStatus: { fontSize: 10, color: TEXT_SECONDARY, marginTop: 6 },

  txnHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 20, marginTop: 24,
  },
  txnSeeAll: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  txnList: { marginHorizontal: 20, marginTop: 12, gap: 12 },
  txnItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CARD_BG, borderRadius: 14, padding: 14,
  },
  txnIcon: {
    width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  txnInfo: { flex: 1 },
  txnCategory: { fontSize: 14, fontWeight: '600', color: TEXT_MAIN },
  txnDate: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 },
  txnAmount: { fontSize: 14, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 8 },
})
