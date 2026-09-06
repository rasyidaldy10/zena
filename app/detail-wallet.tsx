import { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { UserWallet, InvestmentHolding, WALLET_TYPE_CONFIG } from '../types'
import { formatMoney, formatDelta } from '../lib/format'
import {
  getRates, toIDR, dailyMovement, unrealizedPL, isForeign, spreadPercent, type FxRateMap,
} from '../lib/fx'

const PRIMARY = '#185FA5'
const GAIN = '#16A06A'
const LOSS = '#E24B4A'

export default function DetailWalletScreen() {
  const [wallets, setWallets] = useState<UserWallet[]>([])
  const [holdings, setHoldings] = useState<Record<string, InvestmentHolding[]>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [rates, setRates] = useState<FxRateMap>({})

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    // Fetch wallets
    const { data: w } = await supabase
      .from('user_wallets')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    const walletList = (w ?? []) as UserWallet[]
    setWallets(walletList)

    const foreignCodes = [...new Set(walletList.map(x => x.currency).filter(isForeign))] as string[]
    if (foreignCodes.length > 0) {
      getRates(foreignCodes).then(setRates).catch(() => { /* tampil tanpa nilai rupiah */ })
    }

    // Fetch holdings untuk wallet investasi
    const investmentWallets = (w ?? []).filter(wallet => wallet.wallet_type === 'investasi')
    if (investmentWallets.length > 0) {
      const { data: h } = await supabase
        .from('investment_holdings')
        .select('*')
        .in('wallet_id', investmentWallets.map(iw => iw.id))

      const holdingsByWallet: Record<string, InvestmentHolding[]> = {}
      for (const holding of (h ?? [])) {
        if (!holdingsByWallet[holding.wallet_id]) {
          holdingsByWallet[holding.wallet_id] = []
        }
        holdingsByWallet[holding.wallet_id].push(holding as InvestmentHolding)
      }
      setHoldings(holdingsByWallet)
    }

    setLoading(false)
    setRefreshing(false)
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  // Dompet valas dikonversi pakai kurs BELI bank (nilai cair hari ini)
  const totalBalance = wallets.reduce(
    (sum, w) => sum + (isForeign(w.currency)
      ? (toIDR(w.current_balance, w.currency!, rates) ?? 0)
      : w.current_balance),
    0
  )

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 100 }} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Semua Dompet</Text>
        <TouchableOpacity onPress={() => router.push('/tambah-wallet')}>
          <Text style={styles.addText}>+ Tambah</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={PRIMARY} />}
      >
        {/* Total Balance Card */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Saldo Semua Dompet</Text>
          <Text style={styles.totalAmount}>Rp {totalBalance.toLocaleString('id-ID')}</Text>
          <Text style={styles.totalCount}>{wallets.length} dompet aktif</Text>
        </View>

        {/* Wallet List */}
        {wallets.map((wallet) => {
          const typeConfig = WALLET_TYPE_CONFIG[wallet.wallet_type]
          const walletHoldings = holdings[wallet.id] || []
          const isInvestment = wallet.wallet_type === 'investasi'

          return (
            <View key={wallet.id} style={styles.walletCard}>
              {/* Wallet Header */}
              <View style={[styles.walletHeader, { backgroundColor: wallet.color }]}>
                <View style={styles.walletHeaderLeft}>
                  <Text style={styles.walletIcon}>{wallet.icon}</Text>
                  <View>
                    <Text style={styles.walletName}>{wallet.wallet_name}</Text>
                    <Text style={styles.walletType}>{typeConfig?.label || wallet.wallet_type}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => router.push(`/edit-wallet?id=${wallet.id}`)}
                >
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>

              {/* Balance */}
              <View style={styles.walletBody}>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceLabel}>Saldo Saat Ini</Text>
                  <Text style={styles.balanceAmount}>
                    {formatMoney(wallet.current_balance, wallet.currency)}
                  </Text>
                </View>

                {/* Blok valas: nilai rupiah, gerak harian, untung/rugi */}
                {isForeign(wallet.currency) && (() => {
                  const cur = wallet.currency!
                  const rate = rates[cur]
                  const idrValue = toIDR(wallet.current_balance, cur, rates)
                  const move = dailyMovement(wallet.current_balance, cur, rates)
                  const pl = unrealizedPL(wallet.current_balance, cur, wallet.avg_buy_rate, rates)
                  const spread = spreadPercent(cur, rates)

                  if (!rate) {
                    return (
                      <View style={styles.fxBox}>
                        <Text style={styles.fxMuted}>
                          Kurs belum termuat. Tarik ke bawah untuk memuat ulang.
                        </Text>
                      </View>
                    )
                  }

                  return (
                    <View style={styles.fxBox}>
                      <View style={styles.fxRow}>
                        <Text style={styles.fxLabel}>Nilai Rupiah</Text>
                        <Text style={styles.fxValue}>
                          {idrValue !== null ? formatMoney(idrValue) : '—'}
                        </Text>
                      </View>

                      <View style={styles.fxRow}>
                        <Text style={styles.fxLabel}>Hari Ini</Text>
                        {move ? (
                          <Text style={[
                            styles.fxValue,
                            { color: move.direction === 'up' ? GAIN : move.direction === 'down' ? LOSS : '#888780' },
                          ]}>
                            {move.direction === 'up' ? '▲ ' : move.direction === 'down' ? '▼ ' : ''}
                            {formatDelta(move.amountIDR)} ({move.percent > 0 ? '+' : ''}
                            {move.percent.toFixed(2)}%)
                          </Text>
                        ) : (
                          // Butuh dua hari snapshot kurs buat bisa dibandingkan
                          <Text style={styles.fxMuted}>belum ada pembanding</Text>
                        )}
                      </View>

                      {pl && (
                        <View style={styles.fxRow}>
                          <Text style={styles.fxLabel}>Untung/Rugi</Text>
                          <Text style={[styles.fxValue, { color: pl.amountIDR >= 0 ? GAIN : LOSS }]}>
                            {formatDelta(pl.amountIDR)} ({pl.percent > 0 ? '+' : ''}
                            {pl.percent.toFixed(2)}%)
                          </Text>
                        </View>
                      )}

                      <View style={styles.fxDivider} />

                      <Text style={styles.fxNote}>
                        Kurs BCA {cur} — beli {formatMoney(rate.buy)} / jual {formatMoney(rate.sell)}
                        {spread ? ` · spread ${spread.toFixed(2)}%` : ''}
                      </Text>
                      {!!wallet.avg_buy_rate && (
                        <Text style={styles.fxNote}>
                          Kurs rata-rata perolehan {formatMoney(wallet.avg_buy_rate)}
                        </Text>
                      )}
                      <Text style={styles.fxNote}>
                        Nilai saldo dihitung pakai kurs beli bank — yang kamu terima kalau dicairkan
                        sekarang.{rate.source === 'yahoo' ? ' Sumber: kurs pasar (BCA tidak terbaca).' : ''}
                        {rate.source_time ? ` Diperbarui ${rate.source_time}.` : ''}
                      </Text>
                    </View>
                  )
                })()}

                {/* Investment Holdings */}
                {isInvestment && (
                  <>
                    {walletHoldings.length > 0 ? (
                      <>
                        <View style={styles.divider} />
                        <Text style={styles.holdingsTitle}>Portofolio ({walletHoldings.length})</Text>
                        {walletHoldings.map((holding) => {
                          const currentValue = holding.total_value
                          const buyValue = holding.quantity * holding.average_buy_price
                          const profitLoss = holding.unrealized_gain_loss
                          const profitLossPercent = holding.unrealized_gain_loss_percent

                          return (
                            <View key={holding.id} style={styles.holdingItem}>
                              <View style={styles.holdingHeader}>
                                <Text style={styles.holdingTicker}>{holding.symbol}</Text>
                                <Text style={[
                                  styles.holdingPL,
                                  { color: profitLoss >= 0 ? '#1D9E75' : '#E24B4A' }
                                ]}>
                                  {profitLoss >= 0 ? '+' : ''}{profitLossPercent.toFixed(2)}%
                                </Text>
                              </View>
                              <View style={styles.holdingRow}>
                                <Text style={styles.holdingLabel}>{holding.quantity} unit • {holding.asset_name}</Text>
                                <Text style={styles.holdingValue}>Rp {currentValue.toLocaleString('id-ID')}</Text>
                              </View>
                              <View style={styles.holdingRow}>
                                <Text style={styles.holdingLabel}>Harga: Rp {holding.current_price.toLocaleString('id-ID')}</Text>
                                <Text style={[
                                  styles.holdingPLAmount,
                                  { color: profitLoss >= 0 ? '#1D9E75' : '#E24B4A' }
                                ]}>
                                  {profitLoss >= 0 ? '+' : ''}Rp {profitLoss.toLocaleString('id-ID')}
                                </Text>
                              </View>
                            </View>
                          )
                        })}
                        <TouchableOpacity
                          style={styles.addHoldingBtn}
                          onPress={() => router.push(`/tambah-investasi?walletId=${wallet.id}`)}
                        >
                          <Text style={styles.addHoldingText}>+ Tambah Saham</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <View style={styles.divider} />
                        <View style={styles.emptyHolding}>
                          <Text style={styles.emptyHoldingText}>Belum ada investasi</Text>
                          <TouchableOpacity
                            style={styles.addHoldingBtn}
                            onPress={() => router.push(`/tambah-investasi?walletId=${wallet.id}`)}
                          >
                            <Text style={styles.addHoldingText}>+ Tambah Saham</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </>
                )}

                {/* Bank Info */}
                {wallet.bank_name && wallet.last_4_digits && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.bankInfo}>
                      <Text style={styles.bankInfoLabel}>📧 Gmail Auto-Import</Text>
                      <Text style={styles.bankInfoValue}>
                        {wallet.bank_name} • •••{wallet.last_4_digits}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          )
        })}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 0.5, borderBottomColor: '#2A2A2A',
  },
  backText: { fontSize: 14, color: PRIMARY },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  addText: { fontSize: 14, color: PRIMARY, fontWeight: '600' },
  scroll: { flex: 1 },
  totalCard: {
    marginHorizontal: 20, marginTop: 20, backgroundColor: PRIMARY,
    borderRadius: 16, padding: 20, alignItems: 'center',
  },
  totalLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  totalAmount: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 4 },
  totalCount: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  walletCard: {
    marginHorizontal: 20, marginTop: 16, backgroundColor: '#1A1A1A',
    borderRadius: 16, overflow: 'hidden', borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  walletHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16,
  },
  walletHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  walletIcon: { fontSize: 28 },
  walletName: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 2 },
  walletType: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  editBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  editBtnText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  walletBody: { padding: 16 },
  balanceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  balanceLabel: { fontSize: 12, color: '#888780' },
  balanceAmount: { fontSize: 18, fontWeight: '700', color: '#fff' },
  divider: { height: 0.5, backgroundColor: '#2A2A2A', marginVertical: 12 },
  fxBox: {
    marginTop: 12, padding: 12, borderRadius: 12,
    backgroundColor: '#12202E', borderWidth: 1, borderColor: PRIMARY + '35',
  },
  fxRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  fxLabel: { fontSize: 12, color: '#7E8B99' },
  fxValue: { fontSize: 13, fontWeight: '700', color: '#fff' },
  fxMuted: { fontSize: 11, color: '#7E8B99', fontStyle: 'italic' },
  fxDivider: { height: 0.5, backgroundColor: '#2A3A4A', marginVertical: 8 },
  fxNote: { fontSize: 10, color: '#7E8B99', lineHeight: 15, marginTop: 2 },
  holdingsTitle: {
    fontSize: 12, fontWeight: '700', color: '#888780',
    textTransform: 'uppercase', marginBottom: 8,
  },
  holdingItem: {
    backgroundColor: '#0F0F0F', borderRadius: 8, padding: 12, marginBottom: 8,
  },
  holdingHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
  },
  holdingTicker: { fontSize: 14, fontWeight: '700', color: '#fff' },
  holdingPL: { fontSize: 13, fontWeight: '600' },
  holdingRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4,
  },
  holdingLabel: { fontSize: 11, color: '#888780' },
  holdingValue: { fontSize: 13, color: '#fff', fontWeight: '500' },
  holdingPLAmount: { fontSize: 12, fontWeight: '600' },
  addHoldingBtn: {
    backgroundColor: PRIMARY + '20', borderRadius: 8,
    paddingVertical: 10, alignItems: 'center', marginTop: 8,
    borderWidth: 1, borderColor: PRIMARY + '40',
  },
  addHoldingText: { fontSize: 13, color: PRIMARY, fontWeight: '600' },
  emptyHolding: { alignItems: 'center', paddingVertical: 8 },
  emptyHoldingText: { fontSize: 12, color: '#888780', marginBottom: 12 },
  bankInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bankInfoLabel: { fontSize: 11, color: '#888780' },
  bankInfoValue: { fontSize: 12, color: PRIMARY, fontWeight: '500' },
})
