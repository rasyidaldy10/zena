import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Dimensions
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { UserWallet, Transaction, UserPreferences, TierName } from '../../types'
import { calculateFinancialScore } from '../../lib/scoring'
import { TIER_CONFIG } from '../../types'
import { COLORS, RADIUS, SHADOW } from '../../constants/theme'
import { setAppMode } from '../../lib/modeStore'
import CEOWelcomeModal from '../../components/CEOWelcomeModal'
import PortfolioWidget from '../../components/PortfolioWidget'

// Design system v2
const PRIMARY = COLORS.primary       // #1763D6
const BUSINESS = COLORS.business     // #16A06A
const BG_APP = COLORS.bg
const CARD_BG = COLORS.card
const TEXT_MAIN = COLORS.text
const TEXT_SECONDARY = COLORS.textMuted
const INCOME_COLOR = COLORS.income
const EXPENSE_COLOR = COLORS.expense
const BORDER = COLORS.border
// Gradient header per mode
const GRAD_PERSONAL = ['#1763D6', '#0F4FB5'] as const
const GRAD_BUSINESS = ['#16A06A', '#0E8A58'] as const

const { width: SCREEN_WIDTH } = Dimensions.get('window')

type TabMode = 'personal' | 'business'

export default function HomeScreen() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null)
  const [wallets, setWallets] = useState<UserWallet[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [notifCount, setNotifCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeMode, setActiveMode] = useState<TabMode>('personal')
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [rincianExpanded, setRincianExpanded] = useState(false)
  const [showCEOWelcome, setShowCEOWelcome] = useState(false)
  const channelRef = useRef<any>(null)
  const [businessStats, setBusinessStats] = useState({
    totalPiutang: 0,
    totalHutang: 0,
    piutangCount: 0,
    hutangCount: 0,
    lowStockCount: 0,
    activeProjectsCount: 0,
  })

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const [
      { data: p },
      { data: w },
      { data: t },
      { data: n }
    ] = await Promise.all([
      supabase.from('user_preferences').select('*').eq('user_id', session.user.id).order('created_at', { ascending: true }).limit(1),
      supabase.from('user_wallets').select('*').eq('user_id', session.user.id).eq('is_active', true),
      supabase.from('transactions').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('notifications').select('id').eq('user_id', session.user.id).eq('is_read', false)
    ])

    const prefsObj = (Array.isArray(p) ? p[0] : p) as UserPreferences | undefined
    setPrefs(prefsObj as UserPreferences)
    setWallets((w ?? []) as UserWallet[])
    setTransactions((t ?? []) as Transaction[])
    setNotifCount(n?.length ?? 0)

    // Set active mode from preferences
    if (prefsObj?.active_mode) {
      setActiveMode(prefsObj.active_mode as TabMode)
      setAppMode(prefsObj.active_mode as TabMode)
    }

    // Fetch business stats kalau sedang di mode bisnis (active_mode), supaya
    // proyek aktif/piutang/dll muncul walau flag business_mode belum di-set.
    if (prefsObj?.active_mode === 'business' || prefsObj?.business_mode) {
      const [
        { data: piutang },
        { data: hutang },
        { data: lowStock },
        { data: activeProjects }
      ] = await Promise.all([
        supabase.from('receivables').select('amount').eq('user_id', session.user.id).eq('type', 'piutang').eq('status', 'pending'),
        supabase.from('receivables').select('amount').eq('user_id', session.user.id).eq('type', 'hutang').eq('status', 'pending'),
        supabase.rpc('get_low_stock_count', { p_user_id: session.user.id }),
        supabase.from('projects').select('id').eq('user_id', session.user.id).eq('status', 'aktif')
      ])

      setBusinessStats({
        totalPiutang: piutang?.reduce((sum, r: any) => sum + r.amount, 0) || 0,
        totalHutang: hutang?.reduce((sum, r: any) => sum + r.amount, 0) || 0,
        piutangCount: piutang?.length || 0,
        hutangCount: hutang?.length || 0,
        lowStockCount: lowStock || 0,
        activeProjectsCount: activeProjects?.length || 0,
      })
    }

    setLoading(false)

    // Check if user is new (show CEO welcome once)
    const hasSeenWelcome = await supabase
      .from('user_preferences')
      .select('has_seen_ceo_welcome')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true })
      .limit(1)

    if (prefsObj && !hasSeenWelcome.data?.[0]?.has_seen_ceo_welcome) {
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

      // Setup realtime channel with proper error handling
      const channel = supabase
        .channel(`notif-badge-${session.user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`,
        }, () => {
          setNotifCount(prev => prev + 1)
        })
        .subscribe((status) => {
          // Handle subscription status
          if (status === 'SUBSCRIBED') {
            console.log('Notification badge realtime: connected')
          }
          if (status === 'CHANNEL_ERROR') {
            console.error('Notification badge realtime: error')
          }
          if (status === 'TIMED_OUT') {
            console.error('Notification badge realtime: timed out')
          }
        })

      channelRef.current = channel
    }).catch((error) => {
      // Catch any auth errors
      console.error('Realtime setup error:', error.message || 'Unknown error')
    })

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current).catch((err) => {
          console.error('Channel cleanup error:', err)
        })
      }
    }
  }, [])

  const handleToggleMode = async () => {
    const newMode = activeMode === 'personal' ? 'business' : 'personal'
    selectMode(newMode)
  }

  // Pilih mode spesifik (dipakai pill toggle) + simpan ke preferences
  const selectMode = async (newMode: TabMode) => {
    if (newMode === activeMode) return
    setActiveMode(newMode)
    setAppMode(newMode)
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await supabase
        .from('user_preferences')
        .update({ active_mode: newMode })
        .eq('user_id', session.user.id)
    }
  }

  const getBalance = () => {
    if (activeMode === 'personal') {
      return wallets.filter(w => w.wallet_function === 'personal').reduce((s, w) => s + w.current_balance, 0)
    }
    if (activeMode === 'business') {
      return wallets.filter(w => w.wallet_function === 'business').reduce((s, w) => s + w.current_balance, 0)
    }
    return 0
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

      {/* HEADER (gradient, rounded bottom) */}
      <LinearGradient
        colors={activeMode === 'business' ? GRAD_BUSINESS : GRAD_PERSONAL}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View>
            <Text style={styles.headerGreeting}>{greeting} 👋</Text>
            <Text style={styles.headerName}>
              {activeMode === 'business' && prefs?.business_name
                ? prefs.business_name
                : prefs?.nickname || 'User'}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            {notifCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{notifCount > 9 ? '9+' : notifCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/(tabs)/profil')}>
            <Ionicons name="settings-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* MODE TOGGLE — pill di dalam card putih */}
        <View style={styles.modeCard}>
          <View style={styles.modePill}>
            <TouchableOpacity
              style={[styles.modePillTab, activeMode === 'personal' && styles.modePillTabActivePersonal]}
              onPress={() => selectMode('personal')}
              activeOpacity={0.8}
            >
              <Ionicons name="person" size={15} color={activeMode === 'personal' ? '#fff' : TEXT_SECONDARY} />
              <Text style={[styles.modePillText, activeMode === 'personal' && styles.modePillTextActive]}>
                Mode Pribadi
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modePillTab, activeMode === 'business' && styles.modePillTabActiveBusiness]}
              onPress={() => selectMode('business')}
              activeOpacity={0.8}
            >
              <Ionicons name="briefcase" size={15} color={activeMode === 'business' ? '#fff' : TEXT_SECONDARY} />
              <Text style={[styles.modePillText, activeMode === 'business' && styles.modePillTextActive]}>
                Mode Bisnis
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* BALANCE CARD */}
        <View style={styles.balanceCard}>
          {/* Balance */}
          <View style={styles.balanceContent}>
            <View style={styles.balanceLeft}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.balanceLabel}>Total Saldo</Text>
                <TouchableOpacity onPress={() => setBalanceVisible(!balanceVisible)}>
                  <Ionicons name={balanceVisible ? 'eye-outline' : 'eye-off-outline'} size={18} color={TEXT_SECONDARY} />
                </TouchableOpacity>
              </View>
              <Text style={styles.balanceAmount}>
                {balanceVisible ? `Rp ${balance.toLocaleString('id-ID')}` : 'Rp ••••••'}
              </Text>
              <View style={styles.balanceChangeRow}>
                <Ionicons name="trending-up" size={13} color={INCOME_COLOR} />
                <Text style={styles.balanceChange}>12% bulan ini</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch' }}>
              <TouchableOpacity
                style={styles.rincianBtn}
                onPress={() => setRincianExpanded(!rincianExpanded)}
              >
                <Text style={styles.rincianBtnText}>Rincian</Text>
                <Ionicons name="chevron-forward" size={13} color={activeMode === 'business' ? BUSINESS : PRIMARY} />
              </TouchableOpacity>
              {/* Ilustrasi dekoratif (icon, no copyright) */}
              <View style={[styles.balanceArt, { backgroundColor: (activeMode === 'business' ? BUSINESS : PRIMARY) + '14' }]}>
                <Ionicons
                  name={activeMode === 'business' ? 'business' : 'wallet'}
                  size={32}
                  color={activeMode === 'business' ? BUSINESS : PRIMARY}
                />
              </View>
            </View>
          </View>

          {/* Expanded Wallet List — difilter sesuai mode aktif biar konsisten
              dengan Total Saldo (personal mode → wallet pribadi, dst) */}
          {rincianExpanded && (
            <View style={styles.walletList}>
              {wallets.filter(w => w.wallet_function === activeMode).map(w => (
                <View key={w.id} style={styles.walletItem}>
                  <Text style={styles.walletIcon}>{w.icon}</Text>
                  <View style={styles.walletInfo}>
                    <Text style={styles.walletName}>{w.wallet_name}</Text>
                    <Text style={styles.walletType}>{w.wallet_type}</Text>
                  </View>
                  <Text style={styles.walletBalance}>Rp {w.current_balance.toLocaleString('id-ID')}</Text>
                </View>
              ))}
              {wallets.filter(w => w.wallet_function === activeMode).length === 0 && (
                <Text style={styles.walletEmptyHint}>
                  {activeMode === 'business'
                    ? 'Belum ada dompet bisnis. Tambah di Profil (pilih "Bisnis").'
                    : 'Belum ada dompet pribadi.'}
                </Text>
              )}
            </View>
          )}

        </View>

        {/* FINANCIAL HEALTH CARD (terpisah, tap → detail) */}
        <TouchableOpacity style={styles.healthCard} activeOpacity={0.85} onPress={() => router.push('/financial-health')}>
          <View style={styles.healthTop}>
            <View>
              <Text style={styles.healthLabel}>Financial Health</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 2 }}>
                <Text style={styles.healthScore}>{score?.total ?? 0}</Text>
                <Text style={styles.healthScoreMax}>/100</Text>
              </View>
            </View>
            <View style={[styles.healthBadge, { backgroundColor: tierConfig.color + '18' }]}>
              <Text style={[styles.healthBadgeText, { color: tierConfig.color }]}>
                {(score?.total ?? 0) >= 80 ? 'Sangat Baik' : (score?.total ?? 0) >= 60 ? 'Baik' : (score?.total ?? 0) >= 40 ? 'Cukup' : 'Perlu Perbaikan'}
              </Text>
            </View>
          </View>
          <View style={styles.healthBar}>
            <View style={[styles.healthBarFill, { width: `${score?.total ?? 0}%`, backgroundColor: tierConfig.color }]} />
          </View>
          <Text style={styles.healthDelta}>Tier: {tierName} · streak {streak} hari · ketuk untuk detail ›</Text>
        </TouchableOpacity>

        {/* BUSINESS STATS (show only in business tab) */}
        {activeMode === 'business' && (
          <View style={styles.businessStatsSection}>
            <View style={styles.businessStatsHeader}>
              <Text style={styles.businessStatsTitle}>Ringkasan Bisnis</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/profil')}>
                <Text style={styles.businessStatsLink}>Kelola →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.businessStatsGrid}>
              {/* Piutang — garis kiri hijau */}
              <TouchableOpacity style={[styles.bsCard, { borderLeftColor: '#16A06A' }]} onPress={() => router.push('/business-receivables')} activeOpacity={0.8}>
                <View style={[styles.bsIcon, { backgroundColor: '#16A06A' }]}>
                  <Ionicons name="cash" size={20} color="#fff" />
                </View>
                <View style={styles.bsTextCol}>
                  <Text style={styles.bsLabel}>Piutang</Text>
                  <Text style={[styles.bsValue, { color: '#16A06A' }]} numberOfLines={1}>
                    Rp {businessStats.totalPiutang.toLocaleString('id-ID')}
                  </Text>
                  <Text style={styles.bsSub}>{businessStats.piutangCount} Invoice</Text>
                </View>
              </TouchableOpacity>

              {/* Hutang — garis kiri merah */}
              <TouchableOpacity style={[styles.bsCard, { borderLeftColor: '#E5484D' }]} onPress={() => router.push('/business-receivables')} activeOpacity={0.8}>
                <View style={[styles.bsIcon, { backgroundColor: '#E5484D' }]}>
                  <Ionicons name="receipt" size={20} color="#fff" />
                </View>
                <View style={styles.bsTextCol}>
                  <Text style={styles.bsLabel}>Hutang</Text>
                  <Text style={[styles.bsValue, { color: '#E5484D' }]} numberOfLines={1}>
                    Rp {businessStats.totalHutang.toLocaleString('id-ID')}
                  </Text>
                  <Text style={styles.bsSub}>{businessStats.hutangCount} Tagihan</Text>
                </View>
              </TouchableOpacity>

              {/* Project Aktif — garis kiri biru */}
              <TouchableOpacity style={[styles.bsCard, { borderLeftColor: '#1763D6' }]} onPress={() => router.push('/business-projects')} activeOpacity={0.8}>
                <View style={[styles.bsIcon, { backgroundColor: '#1763D6' }]}>
                  <Ionicons name="briefcase" size={20} color="#fff" />
                </View>
                <View style={styles.bsTextCol}>
                  <Text style={styles.bsLabel}>Project Aktif</Text>
                  <Text style={[styles.bsValue, { color: '#1763D6' }]}>{businessStats.activeProjectsCount} Project</Text>
                  <Text style={styles.bsSub}>Sedang berjalan</Text>
                </View>
              </TouchableOpacity>

              {/* Stok Rendah — garis kiri kuning */}
              <TouchableOpacity style={[styles.bsCard, { borderLeftColor: '#F5A623' }]} onPress={() => router.push('/business-inventory')} activeOpacity={0.8}>
                <View style={[styles.bsIcon, { backgroundColor: '#F5A623' }]}>
                  <Ionicons name="cube" size={20} color="#fff" />
                </View>
                <View style={styles.bsTextCol}>
                  <Text style={styles.bsLabel}>Stok Rendah</Text>
                  <Text style={[styles.bsValue, { color: '#F5A623' }]}>{businessStats.lowStockCount} Produk</Text>
                  <Text style={styles.bsSub}>Perlu restock</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* AKSES CEPAT - PERSONAL MODE */}
        {activeMode === 'personal' && (
          <>
            <Text style={styles.sectionTitle}>Akses Cepat</Text>
            <View style={styles.quickActions}>
              {/* Row 1 */}
              <View style={styles.quickRow}>
                <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/tambah-transaksi')}>
                  <View style={[styles.aksesCircle, { backgroundColor: PRIMARY }]}>
                    <Ionicons name="add" size={28} color="#fff" />
                  </View>
                  <Text style={styles.quickLabel}>Catat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/tambah-transaksi')}>
                  <View style={styles.aksesCard}><Ionicons name="camera" size={26} color="#1763D6" /></View>
                  <Text style={styles.quickLabel}>Scan Struk</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/(tabs)/laporan')}>
                  <View style={styles.aksesCard}><Ionicons name="bar-chart" size={26} color="#16A06A" /></View>
                  <Text style={styles.quickLabel}>Laporan</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/(tabs)/laporan')}>
                  <View style={styles.aksesCard}><Ionicons name="pie-chart" size={26} color="#E5484D" /></View>
                  <Text style={styles.quickLabel}>Budget</Text>
                </TouchableOpacity>
              </View>

              {/* Row 2 */}
              <View style={styles.quickRow}>
                <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/chat')}>
                  <View style={styles.aksesCard}><Ionicons name="chatbubble-ellipses" size={26} color="#7C3AED" /></View>
                  <Text style={styles.quickLabel}>Zena AI</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/investment-portfolio')}>
                  <View style={styles.aksesCard}><Ionicons name="trending-up" size={26} color="#16A06A" /></View>
                  <Text style={styles.quickLabel}>Investasi</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/zena-intelligence')}>
                  <View style={styles.aksesCard}><Ionicons name="sparkles" size={26} color="#0E8A58" /></View>
                  <Text style={styles.quickLabel}>ZENA Intel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/(tabs)/reminder')}>
                  <View style={styles.aksesCard}><Ionicons name="notifications" size={26} color="#1763D6" /></View>
                  <Text style={styles.quickLabel}>Reminder</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* AKSES CEPAT - BUSINESS MODE (4 icon) */}
        {activeMode === 'business' && (
          <>
            <Text style={styles.sectionTitle}>Akses Cepat</Text>
            <View style={styles.quickActions}>
              <View style={styles.quickRow}>
                <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/business-projects')}>
                  <View style={styles.aksesCard}><Ionicons name="briefcase" size={26} color="#1763D6" /></View>
                  <Text style={styles.quickLabel}>Projects</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/business-inventory')}>
                  <View style={styles.aksesCard}><Ionicons name="cube" size={26} color="#16A06A" /></View>
                  <Text style={styles.quickLabel}>Inventory</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/business-receivables')}>
                  <View style={styles.aksesCard}><Ionicons name="swap-horizontal" size={26} color="#E5484D" /></View>
                  <Text style={styles.quickLabel}>Receivables</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/(tabs)/laporan')}>
                  <View style={styles.aksesCard}><Ionicons name="bar-chart" size={26} color="#B45309" /></View>
                  <Text style={styles.quickLabel}>Laporan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* FINANCIAL SCORE (Personal mode only) */}
        {activeMode === 'personal' && (
          <>
        <Text style={styles.sectionTitle}>Financial Score</Text>
        <View style={styles.scoreGrid}>
          {[
            { label: 'Konsistensi', value: score?.consistency ?? 0, color: INCOME_COLOR },
            { label: 'Budget', value: Math.min(score?.budget_adherence ?? 0, 100), color: PRIMARY },
            { label: 'Tabungan', value: score?.saving_rate ?? 0, color: '#B45309' },
            { label: tierName, value: score?.total ?? 0, color: tierConfig.color },
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

        {/* PORTOFOLIO INVESTASI — cuma aset yang user punya (bukan market umum) */}
        <PortfolioWidget />
        </>
        )}

        {/* TRANSAKSI TERAKHIR (show in both modes, but filtered by mode) */}
        <View style={styles.txnHeader}>
          <Text style={styles.sectionTitle}>Transaksi Terakhir</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/laporan')}>
            <Text style={styles.txnSeeAll}>Semua →</Text>
          </TouchableOpacity>
        </View>

        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={40} color={TEXT_SECONDARY} />
            <Text style={styles.emptyText}>Belum ada transaksi</Text>
          </View>
        ) : (
          <View style={styles.txnList}>
            {transactions.map(txn => (
              <TouchableOpacity
                key={txn.id}
                style={styles.txnItem}
                onPress={() => router.push(`/edit-transaksi?id=${txn.id}`)}
                activeOpacity={0.7}
              >
                <View style={[styles.txnIcon, { backgroundColor: txn.type === 'income' ? '#F0FDF4' : '#FEF2F2' }]}>
                  <Ionicons
                    name={txn.type === 'income' ? 'arrow-down' : 'arrow-up'}
                    size={18}
                    color={txn.type === 'income' ? INCOME_COLOR : EXPENSE_COLOR}
                  />
                </View>
                <View style={styles.txnInfo}>
                  <Text style={styles.txnCategory}>{txn.category}</Text>
                  <Text style={styles.txnDate}>{new Date(txn.date).toLocaleDateString('id-ID')}</Text>
                </View>
                <Text style={[styles.txnAmount, { color: txn.type === 'income' ? INCOME_COLOR : EXPENSE_COLOR }]}>
                  {txn.type === 'income' ? '+' : '-'}Rp {txn.amount.toLocaleString('id-ID')}
                </Text>
              </TouchableOpacity>
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
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 22,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerLogo: { width: 40, height: 40, borderRadius: 20 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#15233A',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#fff' },
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

  // Mode toggle pill (card putih) — no negative margin biar TIDAK ke-clip ScrollView
  modeCard: {
    backgroundColor: CARD_BG, marginHorizontal: 16, marginTop: 14,
    borderRadius: RADIUS.lg, padding: 5, ...SHADOW.card,
  },
  modePill: { flexDirection: 'row', backgroundColor: '#F1F4F9', borderRadius: RADIUS.md, padding: 4 },
  modePillTab: { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 9, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  modePillTabActivePersonal: { backgroundColor: PRIMARY },
  modePillTabActiveBusiness: { backgroundColor: BUSINESS },
  modePillText: { fontSize: 12.5, fontWeight: '700', color: TEXT_SECONDARY },
  modePillTextActive: { color: '#fff' },

  balanceCard: {
    backgroundColor: CARD_BG, marginHorizontal: 16, marginTop: 12,
    borderRadius: RADIUS.xl, padding: 20, ...SHADOW.card,
  },
  balanceContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  balanceLeft: { flex: 1 },
  balanceLabel: { fontSize: 13, color: TEXT_SECONDARY },
  balanceAmount: { fontSize: 28, fontWeight: '800', color: TEXT_MAIN, marginTop: 4 },
  balanceChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  balanceChange: { fontSize: 12, color: INCOME_COLOR, fontWeight: '600' },
  rincianBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: PRIMARY + '10', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14,
  },
  rincianBtnText: { fontSize: 12, fontWeight: '600', color: PRIMARY },
  balanceArt: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  walletList: { marginTop: 16, gap: 12 },
  walletEmptyHint: { fontSize: 12, color: '#888780', lineHeight: 18, paddingVertical: 4 },
  walletItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  walletIcon: { fontSize: 24 },
  walletInfo: { flex: 1 },
  walletName: { fontSize: 14, fontWeight: '600', color: TEXT_MAIN },
  walletType: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 },
  walletBalance: { fontSize: 13, fontWeight: '600', color: TEXT_MAIN },
  // Financial Health card
  healthCard: {
    backgroundColor: CARD_BG, marginHorizontal: 16, marginTop: 12,
    borderRadius: RADIUS.xl, padding: 18, ...SHADOW.card,
  },
  healthTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  healthLabel: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: '600' },
  healthScore: { fontSize: 32, fontWeight: '800', color: TEXT_MAIN, lineHeight: 34 },
  healthScoreMax: { fontSize: 14, color: TEXT_SECONDARY, marginBottom: 4 },
  healthBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill },
  healthBadgeText: { fontSize: 12, fontWeight: '700' },
  healthBar: { height: 8, backgroundColor: '#EDF0F5', borderRadius: 4, overflow: 'hidden', marginTop: 14 },
  healthBarFill: { height: '100%', borderRadius: 4 },
  healthDelta: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 8 },

  quickActions: { marginHorizontal: 16, marginTop: 4, gap: 16 },
  quickRow: { flexDirection: 'row', justifyContent: 'space-between' },
  quickBtn: { alignItems: 'center', width: (SCREEN_WIDTH - 64) / 4, position: 'relative' },
  // Card putih kotak-rounded + shadow (icon filled berwarna) — ala reference
  aksesCard: {
    width: 60, height: 60, borderRadius: 18, backgroundColor: CARD_BG,
    alignItems: 'center', justifyContent: 'center', ...SHADOW.card,
  },
  // Catat = lingkaran solid warna mode
  aksesCircle: {
    width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
    shadowColor: PRIMARY, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  quickIcon: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
  },
  quickLabel: { fontSize: 11, color: TEXT_MAIN, marginTop: 8, textAlign: 'center', fontWeight: '500' },
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
  businessStatsSection: {
    marginHorizontal: 20, marginTop: 20,
    backgroundColor: CARD_BG, borderRadius: 16, padding: 16,
  },
  businessStatsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  businessStatsTitle: { fontSize: 16, fontWeight: '700', color: TEXT_MAIN },
  businessStatsLink: { fontSize: 13, fontWeight: '600', color: PRIMARY },
  businessStatsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  // Card stat baru: icon kotak berwarna + value + subtitle (ala reference)
  bsCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minWidth: '47%', flexGrow: 1, flexBasis: '47%',
    backgroundColor: CARD_BG, borderRadius: RADIUS.lg, padding: 12, ...SHADOW.card,
    borderLeftWidth: 4, borderLeftColor: '#16A06A',
  },
  bsIcon: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  bsTextCol: { flex: 1 },
  bsLabel: { fontSize: 11, color: TEXT_SECONDARY },
  bsValue: { fontSize: 15, fontWeight: '800', marginTop: 1 },
  bsSub: { fontSize: 10, color: TEXT_SECONDARY, marginTop: 1 },
  businessQuickLinks: {
    flexDirection: 'row', gap: 8, marginTop: 12,
  },
  businessQuickLinkBtn: {
    flex: 1, backgroundColor: '#EFF6FF', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: PRIMARY + '30',
  },
  businessQuickLinkIcon: { fontSize: 20 },
  businessQuickLinkText: { fontSize: 11, fontWeight: '600', color: PRIMARY },
})
