import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator, Platform, Image
} from 'react-native'
import { useFocusEffect, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../lib/supabase'
import { confirmAsync, notify } from '../../lib/alert'
import { clearChatHistory } from '../../lib/chatHistory'
import { uploadImage } from '../../lib/upload'
import { PERSONA_CONFIG, BUDGET_METHODS } from '../../constants'
import { calculateFinancialScore } from '../../lib/scoring'
import { WALLET_TYPE_CONFIG, UserWallet } from '../../types'
import { Persona, BudgetMethod, UserPreferences } from '../../types'
import { COLORS, RADIUS, SHADOW } from '../../constants/theme'
import {
  computeXp, getTierByXp, getNextTierByXp, BADGES, computeBadges, estimateRankPercent,
} from '../../lib/gamification'

const PRIMARY = COLORS.primary
const TEXT_MAIN = COLORS.text
const TEXT_MUTED = COLORS.textMuted
const CARD = COLORS.card
const BORDER = COLORS.border
const BG_APP = COLORS.bg

type ScoreData = ReturnType<typeof calculateFinancialScore>

export default function ProfilScreen() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState('')
  const [income, setIncome] = useState('')
  const [score, setScore] = useState<ScoreData | null>(null)
  const [wallets, setWallets] = useState<UserWallet[]>([])
  const [activeMode, setActiveMode] = useState<'personal' | 'business'>('personal')
  const [businessName, setBusinessName] = useState('')
  const [ppnEnabled, setPpnEnabled] = useState(false)
  const [ppnRate, setPpnRate] = useState('11')
  // Gamification
  const [txnCount, setTxnCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [hasInvestment, setHasInvestment] = useState(false)
  const [totalSavings, setTotalSavings] = useState(0)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data: prefsRows } = await supabase
      .from('user_preferences').select('*')
      .eq('user_id', user?.id).order('created_at', { ascending: true }).limit(1)
    const prefsData = prefsRows?.[0]

    if (prefsData) {
      setPrefs(prefsData)
      setNickname(prefsData.nickname || '')
      setIncome(prefsData.monthly_income?.toLocaleString('id-ID') || '')
      setActiveMode(prefsData.active_mode || 'personal')
      setBusinessName(prefsData.business_name || '')
      setPpnEnabled(prefsData.ppn_enabled || false)
      setPpnRate(prefsData.ppn_rate?.toString() || '11')
      setAvatarUrl((prefsData as any).avatar_url || '')
    }

    const { data: txns } = await supabase.from('transactions').select('*').eq('user_id', user?.id)
    const realTxns = (txns || []).filter((t: any) => !t.is_wallet_transfer)
    setTxnCount(realTxns.length)

    // streak — hari berturut ada transaksi
    const dates = new Set(realTxns.map((t: any) => t.date))
    let s = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      if (dates.has(d.toISOString().split('T')[0])) s++
      else break
    }
    setStreak(s)

    if (txns && prefsData) {
      setScore(calculateFinancialScore(txns, prefsData.monthly_income || 0, s))
    }

    const { data: walletsData } = await supabase
      .from('user_wallets').select('*').eq('user_id', user?.id)
      .eq('is_active', true).order('created_at', { ascending: true })
    if (walletsData) {
      setWallets(walletsData)
      setTotalSavings(walletsData.reduce((sum: number, w: any) => sum + (w.current_balance || 0), 0))
    }

    const { data: holdings } = await supabase
      .from('investment_holdings').select('id').eq('user_id', user?.id).limit(1)
    setHasInvestment(!!(holdings && holdings.length > 0))

    setLoading(false)
  }

  useFocusEffect(useCallback(() => { fetchData() }, []))

  const handleSave = async () => {
    if (activeMode === 'personal') {
      const incomeValue = parseFloat(income.replace(/\./g, ''))
      if (isNaN(incomeValue) || incomeValue < 0) {
        notify('Error', 'Penghasilan harus diisi dengan angka yang valid'); return
      }
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const updateData: any = { updated_at: new Date().toISOString() }
    if (activeMode === 'personal') {
      updateData.nickname = nickname
      updateData.monthly_income = parseFloat(income.replace(/\./g, ''))
    } else {
      updateData.business_name = businessName
    }
    await supabase.from('user_preferences').update(updateData).eq('user_id', user?.id)
    setEditing(false); fetchData(); setSaving(false)
  }

  const handlePersonaChange = async (p: Persona) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('user_preferences').update({ persona: p, updated_at: new Date().toISOString() }).eq('user_id', user?.id)
    fetchData()
  }

  const handleMethodChange = async (m: BudgetMethod) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('user_preferences').update({ budget_method: m, updated_at: new Date().toISOString() }).eq('user_id', user?.id)
    fetchData()
  }

  const handlePpnToggle = async () => {
    const newValue = !ppnEnabled
    setPpnEnabled(newValue)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('user_preferences').update({ ppn_enabled: newValue, updated_at: new Date().toISOString() }).eq('user_id', user?.id)
  }

  const handlePpnRateChange = async (value: string) => {
    const rateNum = parseFloat(value) || 11
    if (rateNum > 0 && rateNum <= 100) {
      setPpnRate(value)
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('user_preferences').update({ ppn_rate: rateNum, updated_at: new Date().toISOString() }).eq('user_id', user?.id)
    } else {
      notify('Error', 'PPN harus antara 0-100%')
      setPpnRate(prefs?.ppn_rate?.toString() || '11')
    }
  }

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, base64: false })
    if (result.canceled || !result.assets?.[0]) return
    setUploadingAvatar(true)
    const url = await uploadImage(result.assets[0].uri, 'avatars')
    if (url) {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('user_preferences').update({ avatar_url: url }).eq('user_id', user?.id)
      setAvatarUrl(url)
    } else {
      notify('Gagal', 'Upload foto gagal. Pastikan bucket "logos" sudah dibuat (run SQL).')
    }
    setUploadingAvatar(false)
  }

  const handleLogout = async () => {
    const ok = await confirmAsync('Keluar dari Zena?', 'Kamu perlu login lagi untuk mengakses akunmu.', 'Keluar')
    if (!ok) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await clearChatHistory(user.id)
      await supabase.auth.signOut()
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.href = '/'
      else router.replace('/(auth)/login')
    } catch { notify('Error', 'Gagal logout. Coba lagi.') }
  }

  if (loading) return (
    <View style={styles.loadingWrap}><ActivityIndicator color={PRIMARY} /></View>
  )

  const total = score?.total ?? 0
  const xp = computeXp({ transactionCount: txnCount, streakDays: streak })
  const tier = getTierByXp(xp)
  const nextTier = getNextTierByXp(xp)
  const tierProgress = nextTier ? Math.min(100, Math.round(((xp - tier.min) / (nextTier.min - tier.min)) * 100)) : 100
  const xpToNext = nextTier ? nextTier.min - xp : 0
  const rankPct = estimateRankPercent(total)
  const badges = computeBadges({ transactionCount: txnCount, streakDays: streak, hasInvestment, budgetAdherence: score?.budget_adherence ?? 0 })
  const initials = (prefs?.nickname || 'U').slice(0, 2).toUpperCase()
  const fmtShort = (n: number) => n >= 1_000_000 ? `Rp ${(n / 1_000_000).toFixed(1)}jt` : `Rp ${n.toLocaleString('id-ID')}`

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* HEADER biru */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.avatar} onPress={pickAvatar} activeOpacity={0.8}>
            {uploadingAvatar ? <ActivityIndicator color="#fff" />
              : avatarUrl ? <Image source={{ uri: avatarUrl }} style={styles.avatarImg} resizeMode="cover" />
              : <Text style={styles.avatarText}>{initials}</Text>}
            <View style={styles.avatarCam}><Ionicons name="camera" size={11} color="#fff" /></View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName}>{prefs?.nickname || 'User'}</Text>
            <View style={[styles.memberBadge, { backgroundColor: tier.color + '33' }]}>
              <Ionicons name={tier.icon as any} size={12} color="#fff" />
              <Text style={styles.memberBadgeText}>{tier.label} Member</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.editProfileBtn} onPress={() => router.push('/edit-profil')}>
            <Text style={styles.editProfileText}>Ubah Profil</Text>
          </TouchableOpacity>
        </View>

        {/* 3 stat box */}
        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{tier.label}</Text>
            <Text style={styles.statLabel}>Level</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{total}</Text>
            <Text style={styles.statLabel}>Financial Health</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>Top {rankPct}%</Text>
            <Text style={styles.statLabel}>Rank</Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {/* TIER CARD */}
        <View style={styles.tierCard}>
          <View style={styles.tierHead}>
            <View style={[styles.tierMedal, { backgroundColor: tier.color + '22' }]}>
              <Ionicons name={tier.icon as any} size={26} color={tier.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tierName}>{tier.label} Tier</Text>
              <Text style={styles.tierXp}>{xp.toLocaleString('id-ID')}{nextTier ? `/${nextTier.min.toLocaleString('id-ID')}` : ''} XP</Text>
            </View>
            <Text style={[styles.tierPct, { color: tier.color }]}>{tierProgress}%</Text>
          </View>
          <View style={styles.xpBar}>
            <View style={[styles.xpFill, { width: `${tierProgress}%`, backgroundColor: tier.color }]} />
          </View>
          {nextTier ? (
            <Text style={styles.tierNext}>{xpToNext.toLocaleString('id-ID')} XP lagi menuju {nextTier.label} ✨</Text>
          ) : (
            <Text style={styles.tierNext}>Tier tertinggi tercapai 🎉</Text>
          )}
        </View>

        {/* BADGES */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Badge</Text>
        </View>
        <View style={styles.badgeGrid}>
          {BADGES.map(b => {
            const earned = badges[b.key]
            return (
              <View key={b.key} style={[styles.badgeItem, !earned && styles.badgeLocked]}>
                <View style={[styles.badgeIcon, { backgroundColor: earned ? b.color + '22' : '#EEF1F6' }]}>
                  <Ionicons name={b.icon as any} size={22} color={earned ? b.color : '#C2C9D6'} />
                </View>
                <Text style={[styles.badgeLabel, !earned && { color: '#C2C9D6' }]}>{b.label}</Text>
              </View>
            )
          })}
        </View>

        {/* STATISTIK PRIBADI */}
        <Text style={styles.sectionTitle}>Statistik Pribadi</Text>
        <View style={styles.statsCard}>
          <View style={styles.statsItem}>
            <Text style={styles.statsValue}>{txnCount}</Text>
            <Text style={styles.statsLabel}>Transaksi Tercatat</Text>
          </View>
          <View style={styles.statsItem}>
            <Text style={styles.statsValue}>{streak}</Text>
            <Text style={styles.statsLabel}>Hari Konsisten</Text>
          </View>
          <View style={styles.statsItem}>
            <Text style={styles.statsValue}>{fmtShort(totalSavings)}</Text>
            <Text style={styles.statsLabel}>Total Saldo</Text>
          </View>
        </View>

        {/* PROFIL BISNIS — hanya relevan saat mode/akses bisnis */}
        {(activeMode === 'business' || prefs?.business_mode) && (
          <TouchableOpacity style={styles.bizLink} onPress={() => router.push('/profil-bisnis')} activeOpacity={0.8}>
            <View style={styles.bizLinkIcon}><Ionicons name="business" size={20} color={COLORS.business} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>Profil Usaha</Text>
              <Text style={styles.rowDesc}>Nama, logo, alamat, rekening (untuk invoice)</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
          </TouchableOpacity>
        )}

        {/* INFORMASI / EDIT */}
        <View style={styles.cardSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Informasi</Text>
            <TouchableOpacity onPress={() => editing ? handleSave() : setEditing(true)} activeOpacity={0.7}>
              <Text style={styles.editBtn}>{editing ? (saving ? 'Menyimpan...' : 'Simpan') : 'Edit'}</Text>
            </TouchableOpacity>
          </View>
          {activeMode === 'personal' ? (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nama panggilan</Text>
                {editing
                  ? <TextInput style={styles.infoInput} value={nickname} onChangeText={setNickname} placeholder="Nama" placeholderTextColor={TEXT_MUTED} />
                  : <Text style={styles.infoValue}>{prefs?.nickname || '-'}</Text>}
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Penghasilan/bulan</Text>
                {editing
                  ? <TextInput style={styles.infoInput} value={income} onChangeText={(t) => setIncome(t.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'))} keyboardType="numeric" placeholder="0" placeholderTextColor={TEXT_MUTED} />
                  : <Text style={styles.infoValue}>Rp {prefs?.monthly_income?.toLocaleString('id-ID') || '0'}</Text>}
              </View>
            </>
          ) : (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nama Perusahaan</Text>
              {editing
                ? <TextInput style={styles.infoInput} value={businessName} onChangeText={setBusinessName} placeholder="PT Nama Perusahaan" placeholderTextColor={TEXT_MUTED} />
                : <Text style={styles.infoValue}>{prefs?.business_name || 'Belum diisi'}</Text>}
            </View>
          )}
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Metode budget</Text>
            <Text style={styles.infoValue}>{BUDGET_METHODS[prefs?.budget_method as BudgetMethod]?.name || '-'}</Text>
          </View>
        </View>

        {/* PERSONA */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>AI Persona</Text>
          {(Object.entries(PERSONA_CONFIG) as [Persona, typeof PERSONA_CONFIG[Persona]][]).map(([key, p]) => (
            <TouchableOpacity key={key} style={[styles.rowBtn, prefs?.persona === key && styles.rowBtnActive]} onPress={() => handlePersonaChange(key)}>
              <Text style={styles.rowIcon}>{p.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, prefs?.persona === key && { color: PRIMARY }]}>{p.name}</Text>
                <Text style={styles.rowDesc}>{p.desc}</Text>
              </View>
              {prefs?.persona === key && <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* BUDGET METHOD */}
        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Metode Budgeting</Text>
          {(Object.entries(BUDGET_METHODS) as [BudgetMethod, typeof BUDGET_METHODS[BudgetMethod]][]).map(([key, m]) => (
            <TouchableOpacity key={key} style={[styles.rowBtn, prefs?.budget_method === key && styles.rowBtnActive]} onPress={() => handleMethodChange(key)}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowName, prefs?.budget_method === key && { color: PRIMARY }]}>{m.name}</Text>
                <Text style={styles.rowDesc}>{m.desc}</Text>
              </View>
              {prefs?.budget_method === key && <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* PPN — disembunyikan atas permintaan (set true utk tampilkan lagi) */}
        {false && (
        <View style={styles.cardSection}>
          <Text style={styles.sectionTitle}>Pengaturan PPN</Text>
          <TouchableOpacity style={styles.toggleRow} onPress={handlePpnToggle} activeOpacity={0.7}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <Ionicons name="receipt-outline" size={20} color={PRIMARY} />
              <View>
                <Text style={styles.rowName}>Aktifkan PPN</Text>
                <Text style={styles.rowDesc}>Pajak Pertambahan Nilai</Text>
              </View>
            </View>
            <View style={[styles.switch, ppnEnabled && { backgroundColor: PRIMARY }]}>
              <View style={[styles.knob, ppnEnabled && { alignSelf: 'flex-end' }]} />
            </View>
          </TouchableOpacity>
          {ppnEnabled && (
            <View style={styles.ppnRateCard}>
              <Text style={styles.infoLabel}>Tarif PPN (%)</Text>
              <TextInput style={styles.ppnRateInput} value={ppnRate} onChangeText={handlePpnRateChange} keyboardType="decimal-pad" placeholder="11" placeholderTextColor={TEXT_MUTED} />
            </View>
          )}
        </View>
        )}

        {/* DOMPET */}
        {(['personal', 'business'] as const).map(fn => {
          if (fn === 'business' && !prefs?.business_mode) return null
          const list = wallets.filter(w => w.wallet_function === fn)
          return (
            <View key={fn} style={styles.cardSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{fn === 'personal' ? 'Dompet Pribadi' : 'Dompet Bisnis'} ({list.length}/5)</Text>
                <TouchableOpacity onPress={() => router.push('/detail-wallet')}>
                  <Text style={styles.editBtn}>Lihat Semua →</Text>
                </TouchableOpacity>
              </View>
              {list.length === 0 ? (
                <Text style={styles.emptyWallet}>Belum ada dompet {fn === 'personal' ? 'pribadi' : 'bisnis'}</Text>
              ) : list.slice(0, 2).map(w => (
                <TouchableOpacity key={w.id} style={styles.walletItem} onPress={() => router.push(`/edit-wallet?id=${w.id}`)} activeOpacity={0.7}>
                  <View style={[styles.walletDot, { backgroundColor: w.color || PRIMARY }]}>
                    <Text style={{ fontSize: 18 }}>{w.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{w.wallet_name}</Text>
                    <Text style={styles.rowDesc}>{WALLET_TYPE_CONFIG[w.wallet_type]?.label || w.wallet_type}</Text>
                  </View>
                  <Text style={styles.walletBalance}>Rp {w.current_balance.toLocaleString('id-ID')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )
        })}

        {/* LOGOUT */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.logoutText}>Keluar dari Akun</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, backgroundColor: BG_APP, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: BG_APP },
  header: {
    backgroundColor: PRIMARY, paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#15233A', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  avatarCam: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  bizLink: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CARD, borderRadius: RADIUS.lg, padding: 14, ...SHADOW.card, marginBottom: 14 },
  bizLinkIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.business + '15', alignItems: 'center', justifyContent: 'center' },
  headerName: { fontSize: 19, fontWeight: '800', color: '#fff' },
  memberBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, marginTop: 5 },
  memberBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  editProfileBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill },
  editProfileText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  statRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: RADIUS.lg, paddingVertical: 14 },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10.5, color: 'rgba(255,255,255,0.8)', marginTop: 3, textAlign: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.25)' },
  body: { paddingHorizontal: 16, paddingTop: 16 },

  tierCard: { backgroundColor: CARD, borderRadius: RADIUS.xl, padding: 18, ...SHADOW.card, marginBottom: 18 },
  tierHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  tierMedal: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tierName: { fontSize: 16, fontWeight: '800', color: TEXT_MAIN },
  tierXp: { fontSize: 12, color: TEXT_MUTED, marginTop: 2 },
  tierPct: { fontSize: 16, fontWeight: '800' },
  xpBar: { height: 10, backgroundColor: '#EDF0F5', borderRadius: 5, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 5 },
  tierNext: { fontSize: 12, color: TEXT_MUTED, marginTop: 10 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: TEXT_MAIN, marginBottom: 10 },
  editBtn: { fontSize: 13, fontWeight: '700', color: PRIMARY },

  badgeGrid: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  badgeItem: { flex: 1, backgroundColor: CARD, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center', ...SHADOW.card },
  badgeLocked: { opacity: 0.7 },
  badgeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  badgeLabel: { fontSize: 10.5, fontWeight: '700', color: TEXT_MAIN, textAlign: 'center' },

  statsCard: { flexDirection: 'row', backgroundColor: CARD, borderRadius: RADIUS.xl, padding: 16, ...SHADOW.card, marginBottom: 22 },
  statsItem: { flex: 1, alignItems: 'center' },
  statsValue: { fontSize: 18, fontWeight: '800', color: TEXT_MAIN },
  statsLabel: { fontSize: 10.5, color: TEXT_MUTED, marginTop: 4, textAlign: 'center' },

  cardSection: { backgroundColor: CARD, borderRadius: RADIUS.lg, padding: 16, ...SHADOW.card, marginBottom: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  infoLabel: { fontSize: 13, color: TEXT_MUTED },
  infoValue: { fontSize: 14, fontWeight: '600', color: TEXT_MAIN },
  infoInput: { fontSize: 14, fontWeight: '600', color: TEXT_MAIN, textAlign: 'right', minWidth: 120, borderBottomWidth: 1, borderBottomColor: PRIMARY, paddingVertical: 2 },

  rowBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: RADIUS.md, marginTop: 6, borderWidth: 1, borderColor: BORDER },
  rowBtnActive: { borderColor: PRIMARY, backgroundColor: PRIMARY + '0C' },
  rowIcon: { fontSize: 22 },
  rowName: { fontSize: 14, fontWeight: '700', color: TEXT_MAIN },
  rowDesc: { fontSize: 11.5, color: TEXT_MUTED, marginTop: 2 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  switch: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#D5DBE5', padding: 3, justifyContent: 'center' },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  ppnRateCard: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ppnRateInput: { fontSize: 16, fontWeight: '700', color: TEXT_MAIN, borderWidth: 1, borderColor: BORDER, borderRadius: RADIUS.sm, paddingHorizontal: 14, paddingVertical: 8, minWidth: 80, textAlign: 'center' },

  walletItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  walletDot: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  walletBalance: { fontSize: 13, fontWeight: '700', color: TEXT_MAIN },
  emptyWallet: { fontSize: 13, color: TEXT_MUTED, paddingVertical: 8 },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.danger + '12', borderRadius: RADIUS.lg, paddingVertical: 15, marginTop: 8, marginBottom: 20 },
  logoutText: { fontSize: 15, fontWeight: '700', color: COLORS.danger },
})
