import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { useState, useCallback, useEffect, useRef } from 'react'
import { router, useFocusEffect } from 'expo-router'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { Transaction, UserWallet, TIER_CONFIG, TierName } from '../../types'
import { calculateFinancialScore, getNextTier } from '../../lib/scoring'

const PRIMARY = '#185FA5'

const CATEGORY_EMOJI: Record<string, string> = {
  'Makan & Minum': '🍔', 'Transport': '🚗', 'Belanja': '🛍️',
  'Tagihan': '📋', 'Hiburan': '🎮', 'Kesehatan': '💊',
  'Bisnis': '💼', 'Investasi': '📈', 'Tabungan': '🏦',
  'Biaya Admin & Fee': '💳', 'Lainnya': '📦', 'Transfer': '🔄',
}

export default function DashboardScreen() {
  const [notifCount, setNotifCount] = useState(0)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [loading, setLoading] = useState(true)
  const [nickname, setNickname] = useState('')
  const [totalBalance, setTotalBalance] = useState(0)
  const [monthBalance, setMonthBalance] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [score, setScore] = useState<ReturnType<typeof calculateFinancialScore> | null>(null)
  const [streak, setStreak] = useState(0)
  const [daysInBudget, setDaysInBudget] = useState(0)
  const [monthlyIncome, setMonthlyIncome] = useState(0)

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const [
      { data: prefs },
      { data: walletsData },
      { data: allTxnsData },
      { data: monthTxnsData },
    ] = await Promise.all([
      supabase.from('user_preferences').select('*').eq('user_id', user?.id).single(),
      supabase.from('user_wallets').select('*').eq('user_id', user?.id).eq('is_active', true).order('created_at', { ascending: true }),
      supabase.from('transactions').select('*').eq('user_id', user?.id)
        .gte('date', (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString().split('T')[0] })())
        .order('date', { ascending: false }),
      supabase.from('transactions').select('*').eq('user_id', user?.id)
        .gte('date', new Date().toISOString().slice(0, 7) + '-01')
        .lte('date', new Date().toISOString().slice(0, 7) + '-31')
        .order('date', { ascending: false }),
    ])

    if (prefs?.nickname) setNickname(prefs.nickname)
    if (prefs?.monthly_income) setMonthlyIncome(prefs.monthly_income)

    // Fetch unread notification count (graceful — table mungkin belum ada)
    try {
      const { data: unread } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user?.id)
        .eq('is_read', false)
      setNotifCount(unread?.length ?? 0)
    } catch {
      setNotifCount(0)
    }

    if (walletsData) {
      const total = walletsData.reduce((s: number, w: any) => s + (w.current_balance || 0), 0)
      setTotalBalance(total)
    }

    const allTxns = (allTxnsData || []) as Transaction[]
    const monthTxns = (monthTxnsData || []) as Transaction[]
    setTransactions(monthTxns)

    const streakDays = calcStreak(allTxns)
    setStreak(streakDays)

    const scoreData = calculateFinancialScore(allTxns, prefs?.monthly_income || 0, streakDays)
    setScore(scoreData)

    const income = monthTxns.filter(t => t.type === 'income' && !t.is_wallet_transfer).reduce((s, t) => s + t.amount, 0)
    const expense = monthTxns.filter(t => t.type === 'expense' && !t.is_wallet_transfer).reduce((s, t) => s + t.amount, 0)
    setMonthBalance(income - expense)

    setDaysInBudget(calcDaysInBudget(monthTxns, prefs?.monthly_income || 0))

    setLoading(false)
  }

  useFocusEffect(useCallback(() => { fetchData() }, []))

  // Realtime subscription untuk badge notifikasi
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

  const calcDaysInBudget = (txns: Transaction[], income: number): number => {
    if (!income) return 0
    const today = new Date()
    const totalDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const dailyBudget = income / totalDays
    const byDate: Record<string, number> = {}
    txns.filter(t => t.type === 'expense' && !t.is_wallet_transfer).forEach(t => {
      byDate[t.date] = (byDate[t.date] || 0) + t.amount
    })
    let ok = 0, checked = 0
    for (let i = 1; i <= today.getDate(); i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), i)
      if (d > today) break
      checked++
      const dateStr = d.toISOString().split('T')[0]
      if ((byDate[dateStr] || 0) <= dailyBudget) ok++
    }
    return checked > 0 ? Math.round((ok / checked) * 100) : 100
  }

  const fmt = (n: number, short = false) => {
    if (short) {
      const abs = Math.abs(n)
      if (abs >= 1_000_000) return `Rp ${(abs / 1_000_000).toFixed(1)}jt`
      if (abs >= 1_000) return `Rp ${(abs / 1_000).toFixed(0)}rb`
      return `Rp ${abs}`
    }
    return 'Rp ' + Math.abs(n).toLocaleString('id-ID')
  }

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Pagi'
    if (h < 15) return 'Siang'
    if (h < 18) return 'Sore'
    return 'Malam'
  }

  const tierName = (score?.tier || 'Starter') as TierName
  const tierCfg = TIER_CONFIG[tierName]
  const nextTierName = getNextTier(tierName)
  const nextTierCfg = nextTierName ? TIER_CONFIG[nextTierName] : null
  const xpPct = nextTierCfg
    ? Math.min(100, Math.round(((score?.total || 0) - tierCfg.min) / (nextTierCfg.min - tierCfg.min) * 100))
    : 100
  const initials = nickname ? nickname.slice(0, 2).toUpperCase() : 'ZN'

  const leaderboard = [
    { rank: 1, name: 'Rizal P', tier: 'Platinum' as TierName, score: 88, isMe: false },
    { rank: 2, name: nickname || 'Kamu', tier: tierName, score: score?.total || 0, isMe: true },
    { rank: 3, name: 'Dani K', tier: 'Silver' as TierName, score: 61, isMe: false },
  ].sort((a, b) => b.score - a.score).map((item, i) => ({ ...item, rank: i + 1 }))

  const handleLogout = async () => {
    await supabase.auth.signOut()
    if (typeof window !== 'undefined') {
      window.location.href = '/'
    } else {
      router.replace('/(auth)/login')
    }
  }

  if (loading) return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator color={PRIMARY} size="large" />
      <Text style={styles.loadingText}>Memuat data keuanganmu...</Text>
    </View>
  )

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.avatar} onPress={() => router.push('/(tabs)/profil')}>
            <Text style={styles.avatarText}>{initials}</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.greeting}>Selamat {getGreeting()}</Text>
            <Text style={styles.name}>{nickname || 'Kamu'} 👋</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/notifications')}>
            <Text style={styles.iconBtnText}>🔔</Text>
            {notifCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{notifCount > 99 ? '99+' : String(notifCount)}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>Keluar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── TIER CARD ── */}
      <View style={[styles.tierCard, { borderColor: tierCfg.color + '60' }]}>
        <View style={styles.tierGlow} pointerEvents="none" />

        <View style={styles.tierTopRow}>
          <View style={styles.tierBadge}>
            <View style={[styles.tierEmojiWrap, { backgroundColor: tierCfg.color + '20' }]}>
              <Text style={styles.tierEmoji}>{tierCfg.icon}</Text>
            </View>
            <View>
              <Text style={[styles.tierRankName, { color: tierCfg.color }]}>{tierName}</Text>
              <Text style={styles.tierRankLabel}>Financial Rank</Text>
            </View>
          </View>
          <View style={styles.tierScoreWrap}>
            <Text style={[styles.tierScoreNum, { color: tierCfg.color }]}>{score?.total ?? 0}</Text>
            <Text style={styles.tierScoreUnit}>/ 100 XP</Text>
          </View>
        </View>

        <View style={styles.tierBalanceRow}>
          <View>
            <Text style={styles.tierBalLabel}>Total Saldo</Text>
            <Text style={styles.tierBalAmount}>{fmt(totalBalance)}</Text>
          </View>
          <View style={styles.tierChangePill}>
            <Text style={[styles.tierChangeText, { color: monthBalance >= 0 ? '#1D9E75' : '#E24B4A' }]}>
              {monthBalance >= 0 ? '↑' : '↓'} {fmt(monthBalance, true)} bulan ini
            </Text>
          </View>
        </View>

        <View style={styles.xpSection}>
          <View style={styles.xpBar}>
            <View style={[styles.xpFill, { width: `${Math.max(2, xpPct)}%`, backgroundColor: tierCfg.color }]} />
          </View>
          <View style={styles.xpLabels}>
            <Text style={styles.xpPct}>{xpPct}% XP</Text>
            <Text style={styles.xpNext}>
              {nextTierName ? `→ ${nextTierName}` : '🏆 MAX TIER'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── SCORE GRID 2×2 ── */}
      <Text style={styles.sectionTitle}>Financial Score</Text>
      <View style={styles.scoreGrid}>
        {[
          { label: 'Konsistensi', value: score?.consistency ?? 0, emoji: '📅', color: PRIMARY, desc: 'Streak harian' },
          { label: 'Budget', value: score?.budget_adherence ?? 0, emoji: '💰', color: '#1D9E75', desc: 'Pengeluaran vs income' },
          { label: 'Tabungan', value: score?.saving_rate ?? 0, emoji: '🐷', color: '#534AB7', desc: 'Saving rate' },
          { label: 'Target', value: score?.goal_completion ?? 0, emoji: '🎯', color: '#BA7517', desc: 'Goal completion' },
        ].map(item => (
          <View key={item.label} style={styles.scoreCard}>
            <View style={styles.scoreCardHeader}>
              <Text style={styles.scoreEmoji}>{item.emoji}</Text>
              <Text style={[styles.scoreNum, { color: item.color }]}>{item.value}</Text>
            </View>
            <View style={styles.scoreBarBg}>
              <View style={[styles.scoreBarFill, { width: `${item.value}%`, backgroundColor: item.color }]} />
            </View>
            <Text style={styles.scoreLabel}>{item.label}</Text>
            <Text style={styles.scoreDesc}>{item.desc}</Text>
          </View>
        ))}
      </View>

      {/* ── STREAK CARDS ── */}
      <Text style={styles.sectionTitle}>Statistik Bulan Ini</Text>
      <View style={styles.streakRow}>
        <View style={styles.streakCard}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakNum}>{streak}</Text>
          <Text style={styles.streakLabel}>Hari Streak</Text>
        </View>
        <View style={styles.streakCard}>
          <Text style={styles.streakEmoji}>📊</Text>
          <Text style={styles.streakNum}>{transactions.filter(t => !t.is_wallet_transfer).length}</Text>
          <Text style={styles.streakLabel}>Transaksi</Text>
        </View>
        <View style={styles.streakCard}>
          <Text style={styles.streakEmoji}>🎯</Text>
          <Text style={styles.streakNum}>{daysInBudget}%</Text>
          <Text style={styles.streakLabel}>Dalam Budget</Text>
        </View>
      </View>

      {/* ── LEADERBOARD ── */}
      <Text style={styles.sectionTitle}>Leaderboard Teman</Text>
      <View style={styles.leaderboard}>
        {leaderboard.map(item => {
          const tc = TIER_CONFIG[item.tier]
          return (
            <View key={item.rank} style={[styles.leaderRow, item.isMe && styles.leaderRowMe]}>
              <Text style={styles.leaderRankEmoji}>
                {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : '🥉'}
              </Text>
              <View style={[styles.leaderAvatar, { backgroundColor: item.isMe ? PRIMARY : '#2A2A2A' }]}>
                <Text style={styles.leaderAvatarText}>{item.name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.leaderInfo}>
                <Text style={styles.leaderName}>{item.name}{item.isMe ? ' (Kamu)' : ''}</Text>
                <Text style={[styles.leaderTier, { color: tc?.color || '#888780' }]}>
                  {tc?.icon} {item.tier}
                </Text>
              </View>
              <View style={styles.leaderScoreWrap}>
                <Text style={[styles.leaderScore, item.isMe && { color: PRIMARY }]}>{item.score}</Text>
                <Text style={styles.leaderScoreUnit}>XP</Text>
              </View>
            </View>
          )
        })}
        <Text style={styles.leaderNote}>✨ Fitur teman segera hadir</Text>
      </View>

      {/* ── QUICK ACTIONS ── */}
      <Text style={styles.sectionTitle}>Aksi Cepat</Text>
      <View style={styles.quickRow}>
        {[
          { icon: '➕', label: 'Catat', onPress: () => router.push('/tambah-transaksi') },
          { icon: '🔄', label: 'Transfer', onPress: () => router.push('/tambah-transaksi') },
          { icon: '🤖', label: 'AI Chat', onPress: () => router.push('/chat') },
          { icon: '👛', label: 'Dompet', onPress: () => router.push('/tambah-wallet') },
        ].map(item => (
          <TouchableOpacity key={item.label} style={styles.qaBtn} onPress={item.onPress}>
            <Text style={styles.qaIcon}>{item.icon}</Text>
            <Text style={styles.qaLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── TRANSAKSI TERAKHIR ── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Transaksi Terakhir</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/laporan')}>
          <Text style={styles.seeAll}>Lihat semua →</Text>
        </TouchableOpacity>
      </View>

      {transactions.slice(0, 5).length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💸</Text>
          <Text style={styles.emptyText}>Belum ada transaksi bulan ini</Text>
          <TouchableOpacity onPress={() => router.push('/tambah-transaksi')}>
            <Text style={styles.emptyAction}>+ Catat transaksi pertama</Text>
          </TouchableOpacity>
        </View>
      ) : (
        transactions.slice(0, 5).map(txn => (
          <TouchableOpacity
            key={txn.id}
            style={styles.txnItem}
            onPress={() => {
              if (!txn.is_wallet_transfer) router.push(`/edit-transaksi?id=${txn.id}`)
            }}
          >
            <View style={[styles.txnIconWrap, txn.is_wallet_transfer && { backgroundColor: '#1E1A2E' }]}>
              <Text style={styles.txnEmoji}>{CATEGORY_EMOJI[txn.category] || '📦'}</Text>
            </View>
            <View style={styles.txnInfo}>
              <Text style={styles.txnCat}>
                {txn.is_wallet_transfer
                  ? (txn.type === 'expense' ? 'Transfer Keluar' : 'Transfer Masuk')
                  : txn.category}
              </Text>
              <Text style={styles.txnDate}>{txn.date}{txn.note ? ' · ' + txn.note : ''}</Text>
            </View>
            <Text style={[
              styles.txnAmount,
              txn.type === 'income' ? styles.txnIncome : styles.txnExpense,
              txn.is_wallet_transfer && { color: '#888780' },
            ]}>
              {txn.type === 'income' ? '+' : '-'}{fmt(txn.amount, true)}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  loadingWrap: { flex: 1, backgroundColor: '#0F0F0F', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: '#888780' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerRight: { flexDirection: 'row', gap: 8 },
  avatar: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  greeting: { fontSize: 12, color: '#888780' },
  name: { fontSize: 18, fontWeight: '700', color: '#fff' },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  iconBtnText: { fontSize: 16 },
  badge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#E24B4A', borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 9, color: '#fff', fontWeight: '800' },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#1A1A1A', borderWidth: 0.5, borderColor: '#2A2A2A' },
  logoutBtnText: { fontSize: 13, color: '#888780', fontWeight: '500' },

  // Tier Card
  tierCard: {
    marginHorizontal: 20, marginBottom: 24, backgroundColor: '#141420',
    borderRadius: 20, padding: 20, borderWidth: 1.5, overflow: 'hidden',
  },
  tierGlow: {
    position: 'absolute', top: -40, right: -40,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: PRIMARY, opacity: 0.06,
  },
  tierTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tierEmojiWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tierEmoji: { fontSize: 22 },
  tierRankName: { fontSize: 18, fontWeight: '700' },
  tierRankLabel: { fontSize: 11, color: '#888780', marginTop: 2 },
  tierScoreWrap: { alignItems: 'flex-end' },
  tierScoreNum: { fontSize: 32, fontWeight: '800', lineHeight: 36 },
  tierScoreUnit: { fontSize: 11, color: '#888780' },
  tierBalanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  tierBalLabel: { fontSize: 12, color: '#888780', marginBottom: 4 },
  tierBalAmount: { fontSize: 26, fontWeight: '700', color: '#fff' },
  tierChangePill: { backgroundColor: '#1A1A1A', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  tierChangeText: { fontSize: 12, fontWeight: '600' },
  xpSection: { gap: 6 },
  xpBar: { height: 6, backgroundColor: '#2A2A2A', borderRadius: 3, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 3 },
  xpLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  xpPct: { fontSize: 11, color: '#888780' },
  xpNext: { fontSize: 11, color: '#888780' },

  // Section
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#888780',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 12, paddingHorizontal: 20,
  },
  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingRight: 20,
  },
  seeAll: { fontSize: 13, color: PRIMARY, fontWeight: '500', paddingBottom: 12 },

  // Score Grid
  scoreGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    paddingHorizontal: 20, marginBottom: 24,
  },
  scoreCard: {
    width: '47%', backgroundColor: '#1A1A1A', borderRadius: 16,
    padding: 14, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  scoreCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  scoreEmoji: { fontSize: 20 },
  scoreNum: { fontSize: 24, fontWeight: '800' },
  scoreBarBg: { height: 4, backgroundColor: '#2A2A2A', borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  scoreBarFill: { height: '100%', borderRadius: 2 },
  scoreLabel: { fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 2 },
  scoreDesc: { fontSize: 10, color: '#888780' },

  // Streak
  streakRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 24 },
  streakCard: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 16, padding: 14,
    alignItems: 'center', borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  streakEmoji: { fontSize: 22, marginBottom: 6 },
  streakNum: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 2 },
  streakLabel: { fontSize: 10, color: '#888780', textAlign: 'center' },

  // Leaderboard
  leaderboard: {
    marginHorizontal: 20, backgroundColor: '#1A1A1A',
    borderRadius: 16, overflow: 'hidden', marginBottom: 24,
    borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  leaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 0.5, borderBottomColor: '#2A2A2A',
  },
  leaderRowMe: { backgroundColor: '#0D1A2E' },
  leaderRankEmoji: { fontSize: 18, width: 24, textAlign: 'center' },
  leaderAvatar: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  leaderAvatarText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  leaderInfo: { flex: 1 },
  leaderName: { fontSize: 13, fontWeight: '600', color: '#fff' },
  leaderTier: { fontSize: 11, marginTop: 2 },
  leaderScoreWrap: { alignItems: 'flex-end' },
  leaderScore: { fontSize: 16, fontWeight: '800', color: '#fff' },
  leaderScoreUnit: { fontSize: 10, color: '#888780' },
  leaderNote: { fontSize: 11, color: '#888780', textAlign: 'center', padding: 10 },

  // Quick Actions
  quickRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 24 },
  qaBtn: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 14, padding: 14,
    alignItems: 'center', borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  qaIcon: { fontSize: 22, marginBottom: 6 },
  qaLabel: { fontSize: 10, color: '#888780', fontWeight: '600', textAlign: 'center' },

  // Transactions
  emptyState: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyText: { fontSize: 14, color: '#888780', marginBottom: 12 },
  emptyAction: { fontSize: 14, color: PRIMARY, fontWeight: '600' },
  txnItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 20,
    borderBottomWidth: 0.5, borderBottomColor: '#1A1A1A',
  },
  txnIconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center',
  },
  txnEmoji: { fontSize: 18 },
  txnInfo: { flex: 1 },
  txnCat: { fontSize: 14, fontWeight: '500', color: '#fff' },
  txnDate: { fontSize: 11, color: '#888780', marginTop: 2 },
  txnAmount: { fontSize: 13, fontWeight: '700' },
  txnIncome: { color: '#1D9E75' },
  txnExpense: { color: '#E24B4A' },
})
