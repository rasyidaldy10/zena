import { useState, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { supabase } from '../lib/supabase'
import type { InvestmentHolding } from '../types'

const PRIMARY = '#185FA5'
const GREEN = '#16A34A'
const RED = '#E24B4A'
const CARD_BG = '#FFFFFF'
const TEXT_MAIN = '#0D1B3E'
const TEXT_SECONDARY = '#888888'

const ICONS: Record<string, string> = { stock: '📈', crypto: '₿', reksadana: '💼', obligasi: '📊' }

export default function PortfolioWidget() {
  const [holdings, setHoldings] = useState<InvestmentHolding[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(useCallback(() => {
    let active = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      const { data } = await supabase
        .from('investment_holdings')
        .select('*')
        .eq('user_id', session.user.id)
        .order('total_value', { ascending: false })
      if (active) { setHoldings((data as InvestmentHolding[]) || []); setLoading(false) }
    })()
    return () => { active = false }
  }, []))

  const totalValue = holdings.reduce((s, h) => s + h.total_value, 0)
  const totalGain = holdings.reduce((s, h) => s + h.unrealized_gain_loss, 0)
  const gainPct = totalValue - totalGain > 0 ? (totalGain / (totalValue - totalGain)) * 100 : 0
  const fmt = (n: number) => 'Rp ' + Math.round(n).toLocaleString('id-ID')

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => router.push('/investment-portfolio')}>
      <View style={styles.header}>
        <Text style={styles.title}>📈 Portofolio Investasi</Text>
        <Text style={styles.link}>Lihat →</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginVertical: 16 }} />
      ) : holdings.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Belum ada investasi</Text>
          <Text style={styles.emptySub}>Tap untuk mulai catat saham/kripto kamu</Text>
        </View>
      ) : (
        <>
          <Text style={styles.totalValue}>{fmt(totalValue)}</Text>
          <Text style={[styles.gain, { color: totalGain >= 0 ? GREEN : RED }]}>
            {totalGain >= 0 ? '▲' : '▼'} {fmt(Math.abs(totalGain))} ({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(2)}%)
          </Text>
          <View style={styles.list}>
            {holdings.slice(0, 3).map((h) => {
              const isGain = h.unrealized_gain_loss >= 0
              return (
                <View key={h.id} style={styles.row}>
                  <Text style={styles.rowSym}>{ICONS[h.asset_type] || '📦'} {h.symbol}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.rowVal}>{fmt(h.total_value)}</Text>
                    <Text style={[styles.rowGain, { color: isGain ? GREEN : RED }]}>
                      {isGain ? '+' : ''}{h.unrealized_gain_loss_percent.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              )
            })}
            {holdings.length > 3 && (
              <Text style={styles.more}>+{holdings.length - 3} aset lainnya</Text>
            )}
          </View>
        </>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: CARD_BG, borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 15, fontWeight: '700', color: TEXT_MAIN },
  link: { fontSize: 13, color: PRIMARY, fontWeight: '600' },
  empty: { paddingVertical: 16, alignItems: 'center' },
  emptyText: { fontSize: 14, fontWeight: '600', color: TEXT_MAIN },
  emptySub: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 },
  totalValue: { fontSize: 24, fontWeight: '800', color: TEXT_MAIN, marginTop: 4 },
  gain: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  list: { marginTop: 12, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowSym: { fontSize: 14, fontWeight: '600', color: TEXT_MAIN },
  rowVal: { fontSize: 13, fontWeight: '600', color: TEXT_MAIN },
  rowGain: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  more: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 4, textAlign: 'center' },
})
