import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, ActivityIndicator
} from 'react-native'
import { useFocusEffect, router } from 'expo-router'

import { supabase } from '../../lib/supabase'
import { PERSONA_CONFIG, BUDGET_METHODS } from '../../constants'
import { calculateFinancialScore } from '../../lib/scoring'
import { TIER_CONFIG, WALLET_TYPE_CONFIG, UserWallet } from '../../types'
import { Persona, BudgetMethod, UserPreferences } from '../../types'

const PRIMARY = '#185FA5'

export default function ProfilScreen() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState('')
  const [income, setIncome] = useState('')
  const [score, setScore] = useState(0)
  const [tier, setTier] = useState('Starter')
  const [wallets, setWallets] = useState<UserWallet[]>([])

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data: prefsData } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user?.id)
      .single()

    if (prefsData) {
      setPrefs(prefsData)
      setNickname(prefsData.nickname || '')
      setIncome(prefsData.monthly_income?.toLocaleString('id-ID') || '')
    }

    const { data: txns } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user?.id)

    if (txns && prefsData) {
      const scoreData = calculateFinancialScore(txns, prefsData.monthly_income || 0, 7)
      setScore(scoreData.total)
      setTier(scoreData.tier)
    }

    const { data: walletsData } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', user?.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
    if (walletsData) setWallets(walletsData)

    setLoading(false)
  }

  useFocusEffect(useCallback(() => { fetchData() }, []))

  const handleSave = async () => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('user_preferences').upsert({
      user_id: user?.id,
      nickname,
      monthly_income: parseFloat(income.replace(/\./g, '')) || 0,
      updated_at: new Date().toISOString(),
    })
    setEditing(false)
    fetchData()
    setSaving(false)
  }

  const handlePersonaChange = async (p: Persona) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('user_preferences').upsert({
      user_id: user?.id, persona: p, updated_at: new Date().toISOString(),
    })
    fetchData()
  }

  const handleMethodChange = async (m: BudgetMethod) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('user_preferences').upsert({
      user_id: user?.id, budget_method: m, updated_at: new Date().toISOString(),
    })
    fetchData()
  }

  const tierConfig = TIER_CONFIG[tier as keyof typeof TIER_CONFIG]

  if (loading) return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator color={PRIMARY} />
    </View>
  )

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profil</Text>
      </View>

      {/* ZENA Intelligence Banner */}
      <TouchableOpacity style={styles.zenaBanner} onPress={() => router.push('/zena-intelligence')} activeOpacity={0.8}>
        <View style={styles.zenaBannerLeft}>
          <Text style={styles.zenaBannerTitle}>ZENA</Text>
          <Text style={styles.zenaBannerSub}>Intelligence System</Text>
        </View>
        <View style={styles.zenaBannerRight}>
          <Text style={styles.zenaBannerAgents}>6 Agents Active</Text>
          <Text style={styles.zenaBannerArrow}>→</Text>
        </View>
      </TouchableOpacity>

      {/* Gmail Auto-Import Banner */}
      <TouchableOpacity style={styles.gmailBanner} onPress={() => router.push('/gmail-setup')} activeOpacity={0.8}>
        <Text style={styles.gmailIcon}>📧</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.gmailTitle}>Gmail Auto-Import</Text>
          <Text style={styles.gmailSub}>Auto-catat transaksi dari email bank</Text>
        </View>
        <Text style={styles.gmailArrow}>→</Text>
      </TouchableOpacity>

      {/* Tier Card */}
      <View style={[styles.tierCard, { borderTopColor: tierConfig?.color || PRIMARY }]}>
        <View style={styles.tierLeft}>
          <Text style={styles.tierIcon}>{tierConfig?.icon || '💸'}</Text>
          <View>
            <Text style={styles.tierName}>{tier}</Text>
            <Text style={styles.tierLabel}>Financial Rank</Text>
          </View>
        </View>
        <View style={styles.tierRight}>
          <Text style={styles.tierScore}>{score}</Text>
          <Text style={styles.tierScoreLabel}>/ 100</Text>
        </View>
      </View>

      {/* Score breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Financial Score</Text>
        <View style={styles.scoreBarWrap}>
          <View style={styles.scoreBarFill}>
            <View style={[styles.scoreBarInner, { width: `${score}%`, backgroundColor: tierConfig?.color || PRIMARY }]} />
          </View>
          <Text style={styles.scoreBarText}>{score}%</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Informasi</Text>
          <TouchableOpacity onPress={() => editing ? handleSave() : setEditing(true)}>
            <Text style={styles.editBtn}>{editing ? (saving ? 'Menyimpan...' : 'Simpan') : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nama panggilan</Text>
          {editing ? (
            <TextInput
              style={styles.infoInput}
              value={nickname}
              onChangeText={setNickname}
              placeholderTextColor="#888780"
            />
          ) : (
            <Text style={styles.infoValue}>{prefs?.nickname || '-'}</Text>
          )}
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Penghasilan/bulan</Text>
          {editing ? (
            <TextInput
              style={styles.infoInput}
              value={income}
              onChangeText={(t) => setIncome(t.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'))}
              keyboardType="numeric"
              placeholderTextColor="#888780"
            />
          ) : (
            <Text style={styles.infoValue}>Rp {prefs?.monthly_income?.toLocaleString('id-ID') || '0'}</Text>
          )}
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Metode budget</Text>
          <Text style={styles.infoValue}>{BUDGET_METHODS[prefs?.budget_method as BudgetMethod]?.name || '-'}</Text>
        </View>
      </View>

      {/* Persona */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Persona</Text>
        {(Object.entries(PERSONA_CONFIG) as [Persona, typeof PERSONA_CONFIG[Persona]][]).map(([key, p]) => (
          <TouchableOpacity
            key={key}
            style={[styles.personaBtn, prefs?.persona === key && styles.personaBtnActive]}
            onPress={() => handlePersonaChange(key)}
          >
            <Text style={styles.personaIcon}>{p.icon}</Text>
            <View style={styles.personaInfo}>
              <Text style={[styles.personaName, prefs?.persona === key && styles.personaNameActive]}>{p.name}</Text>
              <Text style={styles.personaDesc}>{p.desc}</Text>
            </View>
            {prefs?.persona === key && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* Budget method */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Metode Budgeting</Text>
        {(Object.entries(BUDGET_METHODS) as [BudgetMethod, typeof BUDGET_METHODS[BudgetMethod]][]).map(([key, m]) => (
          <TouchableOpacity
            key={key}
            style={[styles.methodBtn, prefs?.budget_method === key && styles.methodBtnActive]}
            onPress={() => handleMethodChange(key)}
          >
            <Text style={[styles.methodName, prefs?.budget_method === key && styles.methodNameActive]}>{m.name}</Text>
            <Text style={styles.methodDesc}>{m.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Dompet Saya */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Dompet Saya ({wallets.length}/8)</Text>
          {wallets.length < 8 && (
            <TouchableOpacity onPress={() => router.push('/tambah-wallet')}>
              <Text style={styles.editBtn}>+ Tambah</Text>
            </TouchableOpacity>
          )}
        </View>
        {wallets.length === 0 ? (
          <Text style={styles.emptyWallet}>Belum ada dompet</Text>
        ) : (
          wallets.map((w) => {
            const typeLabel = WALLET_TYPE_CONFIG[w.wallet_type]?.label || w.wallet_type
            return (
              <TouchableOpacity
                key={w.id}
                style={styles.walletItem}
                onPress={() => router.push(`/edit-wallet?id=${w.id}`)}
                activeOpacity={0.7}
              >
                <View style={[styles.walletDot, { backgroundColor: w.color || PRIMARY }]}>
                  <Text style={styles.walletDotIcon}>{w.icon}</Text>
                </View>
                <View style={styles.walletInfo}>
                  <Text style={styles.walletName}>{w.wallet_name}</Text>
                  <Text style={styles.walletType}>{typeLabel}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.walletBalance}>
                    Rp {w.current_balance.toLocaleString('id-ID')}
                  </Text>
                  <Text style={styles.walletEdit}>Edit →</Text>
                </View>
              </TouchableOpacity>
            )
          })
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  zenaBanner: {
    marginHorizontal: 20, marginBottom: 20, backgroundColor: '#0D1A2E',
    borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', borderWidth: 1, borderColor: PRIMARY + '60',
  },
  zenaBannerLeft: {},
  zenaBannerTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: 3 },
  zenaBannerSub: { fontSize: 11, color: '#888780', letterSpacing: 1, marginTop: 2 },
  zenaBannerRight: { alignItems: 'flex-end' },
  zenaBannerAgents: { fontSize: 12, color: '#1D9E75', fontWeight: '600', marginBottom: 4 },
  zenaBannerArrow: { fontSize: 18, color: PRIMARY },
  gmailBanner: {
    marginHorizontal: 20, marginBottom: 16, backgroundColor: '#1A1A1A',
    borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center',
    gap: 12, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  gmailIcon: { fontSize: 28 },
  gmailTitle: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 2 },
  gmailSub: { fontSize: 11, color: '#888780' },
  gmailArrow: { fontSize: 16, color: '#888780' },
  loadingWrap: { flex: 1, backgroundColor: '#0F0F0F', alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerTitle: { fontSize: 24, fontWeight: '600', color: '#fff' },
  tierCard: {
    marginHorizontal: 20, marginBottom: 20, backgroundColor: '#1A1A1A',
    borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', borderTopWidth: 3,
  },
  tierLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tierIcon: { fontSize: 28 },
  tierName: { fontSize: 18, fontWeight: '600', color: '#fff' },
  tierLabel: { fontSize: 11, color: '#888780', marginTop: 2 },
  tierRight: { alignItems: 'flex-end' },
  tierScore: { fontSize: 32, fontWeight: '600', color: '#fff' },
  tierScoreLabel: { fontSize: 12, color: '#888780' },
  section: { marginHorizontal: 20, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  editBtn: { fontSize: 14, color: PRIMARY, fontWeight: '500' },
  scoreBarWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreBarFill: { flex: 1, height: 8, backgroundColor: '#2A2A2A', borderRadius: 4, overflow: 'hidden' },
  scoreBarInner: { height: '100%', borderRadius: 4 },
  scoreBarText: { fontSize: 13, color: '#fff', fontWeight: '600', minWidth: 36 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#2A2A2A',
  },
  infoLabel: { fontSize: 14, color: '#888780' },
  infoValue: { fontSize: 14, color: '#fff', fontWeight: '500' },
  infoInput: {
    fontSize: 14, color: '#fff', textAlign: 'right',
    backgroundColor: '#2A2A2A', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  personaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  personaBtnActive: { borderColor: PRIMARY, borderWidth: 2 },
  personaIcon: { fontSize: 22 },
  personaInfo: { flex: 1 },
  personaName: { fontSize: 13, fontWeight: '500', color: '#fff' },
  personaNameActive: { color: PRIMARY },
  personaDesc: { fontSize: 11, color: '#888780', marginTop: 1 },
  checkmark: { fontSize: 14, color: PRIMARY, fontWeight: '700' },
  methodBtn: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  methodBtnActive: { borderColor: PRIMARY, borderWidth: 2 },
  methodName: { fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 3 },
  methodNameActive: { color: PRIMARY },
  methodDesc: { fontSize: 11, color: '#888780' },
  emptyWallet: { fontSize: 13, color: '#888780', textAlign: 'center', paddingVertical: 12 },
  walletItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#2A2A2A',
  },
  walletDot: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  walletDotIcon: { fontSize: 18 },
  walletInfo: { flex: 1 },
  walletName: { fontSize: 14, fontWeight: '500', color: '#fff' },
  walletType: { fontSize: 11, color: '#888780', marginTop: 2 },
  walletBalance: { fontSize: 13, fontWeight: '600', color: '#fff' },
  walletEdit: { fontSize: 11, color: PRIMARY, marginTop: 4 },
})