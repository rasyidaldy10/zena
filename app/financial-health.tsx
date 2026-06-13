import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { calculateFinancialScore } from '../lib/scoring'
import { COLORS, RADIUS, SHADOW } from '../constants/theme'
import Gauge from '../components/Gauge'

const PRIMARY = COLORS.primary
const TEXT_MAIN = COLORS.text
const TEXT_MUTED = COLORS.textMuted
const CARD = COLORS.card
const BG_APP = COLORS.bg

type Comp = { label: string; value: number }

export default function FinancialHealthScreen() {
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [comps, setComps] = useState<Comp[]>([])
  const [tip, setTip] = useState('')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [{ data: prefsRows }, { data: txns }, { data: holdings }, { data: hutang }] = await Promise.all([
      supabase.from('user_preferences').select('monthly_income').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1),
      supabase.from('transactions').select('*').eq('user_id', user.id),
      supabase.from('investment_holdings').select('id').eq('user_id', user.id),
      supabase.from('receivables').select('amount').eq('user_id', user.id).eq('type', 'hutang').eq('status', 'pending'),
    ])

    const income = prefsRows?.[0]?.monthly_income || 0
    const score = calculateFinancialScore(txns || [], income, 0)
    const hasInv = !!(holdings && holdings.length > 0)
    const totalHutang = (hutang || []).reduce((s: number, r: any) => s + r.amount, 0)
    const utangScore = totalHutang === 0 ? 90 : income > 0 ? Math.max(20, 100 - Math.min(80, (totalHutang / income) * 20)) : 50
    const investScore = hasInv ? 80 : 35

    const list: Comp[] = [
      { label: 'Budget', value: Math.min(100, score.budget_adherence) },
      { label: 'Konsistensi', value: score.consistency },
      { label: 'Tabungan', value: score.saving_rate },
      { label: 'Investasi', value: Math.round(investScore) },
      { label: 'Utang', value: Math.round(utangScore) },
    ]
    // total = rata-rata 5 komponen
    const avg = Math.round(list.reduce((s, c) => s + c.value, 0) / list.length)
    setTotal(avg)
    setComps(list)

    // Tip: komponen terendah
    const lowest = [...list].sort((a, b) => a.value - b.value)[0]
    const tips: Record<string, string> = {
      Budget: 'Coba tetapkan batas pengeluaran per kategori & catat tiap transaksi.',
      Konsistensi: 'Catat transaksi setiap hari untuk jaga streak & kebiasaan.',
      Tabungan: 'Sisihkan minimal 20% pemasukan ke tabungan tiap bulan.',
      Investasi: 'Mulai investasi rutin (saham/reksadana) walau nominal kecil.',
      Utang: 'Prioritaskan lunasi hutang berbunga tinggi lebih dulu.',
    }
    setTip(tips[lowest.label] || 'Catat transaksi rutin untuk skor yang lebih akurat.')
    setLoading(false)
  }

  const barColor = (v: number) => v >= 70 ? COLORS.success : v >= 40 ? COLORS.warning : COLORS.danger

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={TEXT_MAIN} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Financial Health</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Gauge */}
          <View style={styles.gaugeCard}>
            <Gauge value={total} size={230} />
            <View style={styles.deltaRow}>
              <Ionicons name="trending-up" size={15} color={COLORS.success} />
              <Text style={styles.deltaText}>+5 poin dari minggu lalu</Text>
            </View>
          </View>

          {/* Komponen */}
          <Text style={styles.sectionTitle}>Komponen Penilaian</Text>
          <View style={styles.compCard}>
            {comps.map((c, i) => (
              <View key={c.label} style={[styles.compRow, i === comps.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.compLabel}>{c.label}</Text>
                <View style={styles.compBarBg}>
                  <View style={[styles.compBarFill, { width: `${c.value}%`, backgroundColor: barColor(c.value) }]} />
                </View>
                <Text style={[styles.compValue, { color: barColor(c.value) }]}>{c.value}/100</Text>
              </View>
            ))}
          </View>

          {/* Tips */}
          <View style={styles.tipCard}>
            <View style={styles.tipIcon}><Ionicons name="bulb" size={20} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>Tips Meningkatkan Skor</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_APP },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, backgroundColor: CARD,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: BG_APP },
  headerTitle: { fontSize: 17, fontWeight: '800', color: TEXT_MAIN },
  gaugeCard: { backgroundColor: CARD, borderRadius: RADIUS.xl, padding: 20, alignItems: 'center', ...SHADOW.card, marginBottom: 20 },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  deltaText: { fontSize: 13, fontWeight: '700', color: COLORS.success },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: TEXT_MAIN, marginBottom: 12 },
  compCard: { backgroundColor: CARD, borderRadius: RADIUS.lg, padding: 16, ...SHADOW.card, marginBottom: 20 },
  compRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  compLabel: { fontSize: 13, fontWeight: '600', color: TEXT_MAIN, width: 84 },
  compBarBg: { flex: 1, height: 8, backgroundColor: '#EDF0F5', borderRadius: 4, overflow: 'hidden' },
  compBarFill: { height: '100%', borderRadius: 4 },
  compValue: { fontSize: 12, fontWeight: '700', width: 54, textAlign: 'right' },
  tipCard: { flexDirection: 'row', gap: 12, backgroundColor: PRIMARY + '0F', borderRadius: RADIUS.lg, padding: 16, borderWidth: 1, borderColor: PRIMARY + '22' },
  tipIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center' },
  tipTitle: { fontSize: 14, fontWeight: '800', color: TEXT_MAIN, marginBottom: 4 },
  tipText: { fontSize: 12.5, color: TEXT_MUTED, lineHeight: 18 },
})
