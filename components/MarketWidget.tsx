import { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native'
import { getMarketData, clearMarketCache, formatChange } from '../lib/market-data'
import { MarketData } from '../types'

const PRIMARY = '#185FA5'
const GREEN = '#1D9E75'
const RED = '#E74C3C'

export default function MarketWidget() {
  const [data, setData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setError(null)
      const marketData = await getMarketData()
      setData(marketData)
    } catch (err) {
      console.error('Market data error:', err)
      setError('Gagal memuat data market')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    clearMarketCache()
    await loadData()
  }

  const formatPrice = (price: number) => {
    if (price >= 1_000_000) {
      return `Rp ${(price / 1_000_000).toFixed(2)}jt`
    }
    return `Rp ${price.toLocaleString('id-ID')}`
  }

  const getTimeSince = (timestamp: string) => {
    const now = Date.now()
    const then = new Date(timestamp).getTime()
    const diff = Math.floor((now - then) / 1000) // seconds

    if (diff < 60) return `${diff}d lalu`
    if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`
    if (diff < 86400) return `${Math.floor(diff / 3600)}j lalu`
    return 'baru saja'
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>📊 Market</Text>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={PRIMARY} />
          <Text style={styles.loadingText}>Memuat data market...</Text>
        </View>
      </View>
    )
  }

  if (error || !data) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>📊 Market</Text>
        </View>
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error || 'Data tidak tersedia'}</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.retryBtn}>
            <Text style={styles.retryText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Market</Text>
        <TouchableOpacity onPress={handleRefresh} disabled={refreshing}>
          <Text style={styles.refreshBtn}>
            {refreshing ? '⏳' : '↻'} {refreshing ? 'Memuat...' : 'Refresh'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {/* Crypto */}
        {data.crypto.map((asset) => {
          const change = formatChange(asset.change_24h)
          return (
            <View key={asset.symbol} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.assetIcon}>{asset.symbol === 'BTC' ? '₿' : asset.symbol === 'ETH' ? 'Ξ' : '◈'}</Text>
                <Text style={styles.assetSymbol}>{asset.symbol}</Text>
              </View>
              <Text style={styles.assetName}>{asset.name}</Text>
              <Text style={styles.assetPrice}>{formatPrice(asset.price)}</Text>
              <View style={styles.changeWrap}>
                <Text style={[styles.changeText, { color: change.color }]}>
                  {change.icon} {change.text}
                </Text>
              </View>
            </View>
          )
        })}

        {/* IHSG */}
        {data.indices.map((asset) => {
          const change = formatChange(asset.change_24h)
          return (
            <View key={asset.symbol} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.assetIcon}>📈</Text>
                <Text style={styles.assetSymbol}>{asset.symbol}</Text>
              </View>
              <Text style={styles.assetName}>{asset.name}</Text>
              <Text style={styles.assetPrice}>{asset.price.toLocaleString('id-ID')}</Text>
              <View style={styles.changeWrap}>
                <Text style={[styles.changeText, { color: change.color }]}>
                  {change.icon} {change.text}
                </Text>
              </View>
            </View>
          )
        })}
      </ScrollView>

      <Text style={styles.footer}>
        Diperbarui {getTimeSince(data.last_updated)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  refreshBtn: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: '600',
  },
  scroll: {
    paddingLeft: 16,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 140,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  assetIcon: {
    fontSize: 20,
    marginRight: 6,
  },
  assetSymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  assetName: {
    fontSize: 11,
    color: '#888',
    marginBottom: 8,
  },
  assetPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  changeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#888',
  },
  errorWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 13,
    color: RED,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
})
