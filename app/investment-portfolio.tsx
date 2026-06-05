/**
 * Investment Portfolio Screen
 * Shows all user's investment holdings (stocks, crypto, reksadana, obligasi)
 */

import { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import type { InvestmentHolding, InvestmentAssetType } from '../types'

const PRIMARY = '#185FA5'
const BG_APP = '#F4F7FA'
const CARD_BG = '#FFFFFF'
const TEXT_MAIN = '#0D1B3E'
const TEXT_SECONDARY = '#888888'
const INCOME_COLOR = '#16A34A'
const EXPENSE_COLOR = '#E24B4A'

type FilterType = 'all' | InvestmentAssetType

const ASSET_ICONS: Record<InvestmentAssetType, string> = {
  stock: '📈',
  crypto: '₿',
  reksadana: '💼',
  obligasi: '📊',
}

const ASSET_LABELS: Record<InvestmentAssetType, string> = {
  stock: 'Saham',
  crypto: 'Kripto',
  reksadana: 'Reksadana',
  obligasi: 'Obligasi',
}

export default function InvestmentPortfolioScreen() {
  const [holdings, setHoldings] = useState<InvestmentHolding[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')

  useEffect(() => {
    fetchHoldings()
  }, [])

  async function fetchHoldings() {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data, error } = await supabase
        .from('investment_holdings')
        .select('*')
        .eq('user_id', session.user.id)
        .order('total_value', { ascending: false })

      if (error) throw error

      setHoldings((data || []) as InvestmentHolding[])
    } catch (error: any) {
      console.error('Error fetching holdings:', error)
      Alert.alert('Error', error.message || 'Gagal memuat portfolio')
    } finally {
      setLoading(false)
    }
  }

  const filteredHoldings = filter === 'all'
    ? holdings
    : holdings.filter(h => h.asset_type === filter)

  // Calculate totals
  const totalValue = filteredHoldings.reduce((sum, h) => sum + h.total_value, 0)
  const totalGainLoss = filteredHoldings.reduce((sum, h) => sum + h.unrealized_gain_loss, 0)
  const totalGainLossPercent = totalValue > 0
    ? (totalGainLoss / (totalValue - totalGainLoss)) * 100
    : 0

  // Count by asset type
  const assetCounts = holdings.reduce((acc, h) => {
    acc[h.asset_type] = (acc[h.asset_type] || 0) + 1
    return acc
  }, {} as Record<InvestmentAssetType, number>)

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Portfolio Investasi</Text>
        <TouchableOpacity onPress={() => Alert.alert('Tambah Holding', 'Fitur tambah asset segera hadir!')}>
          <Text style={styles.addBtn}>+</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* SUMMARY CARD */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Nilai Portfolio</Text>
            <Text style={styles.summaryValue}>Rp {totalValue.toLocaleString('id-ID')}</Text>
            <View style={styles.summaryGain}>
              <Text style={[
                styles.summaryGainText,
                { color: totalGainLoss >= 0 ? INCOME_COLOR : EXPENSE_COLOR }
              ]}>
                {totalGainLoss >= 0 ? '▲' : '▼'} Rp {Math.abs(totalGainLoss).toLocaleString('id-ID')}
              </Text>
              <Text style={[
                styles.summaryGainPercent,
                { color: totalGainLoss >= 0 ? INCOME_COLOR : EXPENSE_COLOR }
              ]}>
                ({totalGainLossPercent >= 0 ? '+' : ''}{totalGainLossPercent.toFixed(2)}%)
              </Text>
            </View>
            <Text style={styles.summaryDesc}>{filteredHoldings.length} asset dalam portfolio</Text>
          </View>

          {/* FILTER TABS */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            <TouchableOpacity
              style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                Semua ({holdings.length})
              </Text>
            </TouchableOpacity>
            {(['stock', 'crypto', 'reksadana', 'obligasi'] as InvestmentAssetType[]).map(type => {
              const count = assetCounts[type] || 0
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.filterBtn, filter === type && styles.filterBtnActive]}
                  onPress={() => setFilter(type)}
                >
                  <Text style={[styles.filterText, filter === type && styles.filterTextActive]}>
                    {ASSET_ICONS[type]} {ASSET_LABELS[type]} ({count})
                  </Text>
                </TouchableOpacity>
              )
            })}
          </ScrollView>

          {/* HOLDINGS LIST */}
          {filteredHoldings.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 48 }}>📊</Text>
              <Text style={styles.emptyText}>Belum ada asset di portfolio</Text>
              <Text style={styles.emptyDesc}>
                Tambahkan saham, kripto, atau reksadana yang kamu miliki
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => Alert.alert('Tambah Asset', 'Fitur ini sedang dalam pengembangan')}
              >
                <Text style={styles.emptyBtnText}>+ Tambah Asset</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.holdingsList}>
              {filteredHoldings.map(holding => {
                const isGain = holding.unrealized_gain_loss >= 0
                return (
                  <TouchableOpacity
                    key={holding.id}
                    style={styles.holdingCard}
                    onPress={() => Alert.alert(
                      holding.asset_name,
                      `Symbol: ${holding.symbol}\nQuantity: ${holding.quantity}\nAvg Buy: Rp ${holding.average_buy_price.toLocaleString('id-ID')}\nCurrent: Rp ${holding.current_price.toLocaleString('id-ID')}`
                    )}
                  >
                    {/* Icon + Name */}
                    <View style={styles.holdingLeft}>
                      <View style={styles.holdingIcon}>
                        <Text style={{ fontSize: 24 }}>{ASSET_ICONS[holding.asset_type]}</Text>
                      </View>
                      <View style={styles.holdingInfo}>
                        <Text style={styles.holdingSymbol}>{holding.symbol}</Text>
                        <Text style={styles.holdingName} numberOfLines={1}>{holding.asset_name}</Text>
                        <Text style={styles.holdingQuantity}>
                          {holding.quantity} @ Rp {holding.current_price.toLocaleString('id-ID')}
                        </Text>
                      </View>
                    </View>

                    {/* Value + Gain/Loss */}
                    <View style={styles.holdingRight}>
                      <Text style={styles.holdingValue}>
                        Rp {holding.total_value.toLocaleString('id-ID')}
                      </Text>
                      <View style={styles.holdingGain}>
                        <Text style={[
                          styles.holdingGainText,
                          { color: isGain ? INCOME_COLOR : EXPENSE_COLOR }
                        ]}>
                          {isGain ? '▲' : '▼'} {Math.abs(holding.unrealized_gain_loss_percent).toFixed(2)}%
                        </Text>
                      </View>
                      <Text style={[
                        styles.holdingGainAmount,
                        { color: isGain ? INCOME_COLOR : EXPENSE_COLOR }
                      ]}>
                        {isGain ? '+' : ''}Rp {holding.unrealized_gain_loss.toLocaleString('id-ID')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          {/* FOOTER HINT */}
          {holdings.length > 0 && (
            <View style={styles.footerHint}>
              <Text style={styles.footerHintText}>
                💡 Harga otomatis update setiap 5 menit
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_APP },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: CARD_BG,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {},
  backText: { fontSize: 14, color: PRIMARY },
  headerTitle: { fontSize: 16, fontWeight: '600', color: TEXT_MAIN },
  addBtn: { fontSize: 28, color: PRIMARY, fontWeight: '300' },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  summaryCard: {
    backgroundColor: PRIMARY,
    borderRadius: 20,
    padding: 24,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  summaryGain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  summaryGainText: {
    fontSize: 16,
    fontWeight: '600',
  },
  summaryGainPercent: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },

  filterScroll: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  filterBtn: {
    backgroundColor: CARD_BG,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  filterTextActive: {
    color: '#fff',
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_MAIN,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  holdingsList: {
    paddingHorizontal: 20,
  },
  holdingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  holdingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  holdingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BG_APP,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  holdingInfo: {
    flex: 1,
  },
  holdingSymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY,
    marginBottom: 2,
  },
  holdingName: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 4,
  },
  holdingQuantity: {
    fontSize: 10,
    color: TEXT_SECONDARY,
  },
  holdingRight: {
    alignItems: 'flex-end',
  },
  holdingValue: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_MAIN,
    marginBottom: 4,
  },
  holdingGain: {
    marginBottom: 2,
  },
  holdingGainText: {
    fontSize: 12,
    fontWeight: '600',
  },
  holdingGainAmount: {
    fontSize: 11,
    fontWeight: '500',
  },

  footerHint: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  footerHintText: {
    fontSize: 12,
    color: '#B8860B',
    textAlign: 'center',
  },
})
