/**
 * Stock Market Widget
 * Displays IHSG + custom user watchlist stocks
 */

import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native'
import {
  getIHSGIndex,
  getStockPrices,
  clearStockCache,
  POPULAR_STOCKS,
  DEFAULT_WATCHLIST,
  type StockPrice,
} from '../lib/stock-data'
import AsyncStorage from '@react-native-async-storage/async-storage'

const PRIMARY = '#185FA5'
const INCOME_COLOR = '#16A34A'
const EXPENSE_COLOR = '#E24B4A'

const WATCHLIST_KEY = '@stock_watchlist'

export default function StockWidget() {
  const [ihsg, setIhsg] = useState({ index: 0, change: 0, changePercent: 0 })
  const [stocks, setStocks] = useState<StockPrice[]>([])
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [showWatchlistModal, setShowWatchlistModal] = useState(false)

  // Load watchlist from AsyncStorage
  useEffect(() => {
    loadWatchlist()
  }, [])

  // Fetch data when watchlist changes
  useEffect(() => {
    fetchData()
  }, [watchlist])

  async function loadWatchlist() {
    try {
      const stored = await AsyncStorage.getItem(WATCHLIST_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setWatchlist(parsed)
      }
    } catch (error) {
      console.error('Failed to load watchlist:', error)
    }
  }

  async function saveWatchlist(tickers: string[]) {
    try {
      await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(tickers))
      setWatchlist(tickers)
    } catch (error) {
      console.error('Failed to save watchlist:', error)
      Alert.alert('Error', 'Gagal menyimpan watchlist')
    }
  }

  async function fetchData() {
    try {
      setLoading(true)
      const [ihsgData, stockData] = await Promise.all([
        getIHSGIndex(),
        getStockPrices(watchlist),
      ])
      setIhsg(ihsgData)
      setStocks(stockData)
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Error fetching stock data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function handleRefresh() {
    clearStockCache()
    setRefreshing(true)
    await fetchData()
  }

  function handleToggleTicker(ticker: string) {
    if (watchlist.includes(ticker)) {
      // Remove
      if (watchlist.length <= 1) {
        Alert.alert('Minimum 1 Saham', 'Watchlist harus memiliki minimal 1 saham')
        return
      }
      saveWatchlist(watchlist.filter(t => t !== ticker))
    } else {
      // Add
      if (watchlist.length >= 10) {
        Alert.alert('Maksimal 10 Saham', 'Watchlist hanya bisa menampilkan maksimal 10 saham')
        return
      }
      saveWatchlist([...watchlist, ticker])
    }
  }

  const timeSinceUpdate = Math.floor((Date.now() - lastUpdate.getTime()) / 60000)

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📈 Pasar Saham</Text>
        <View style={styles.headerRight}>
          <Text style={styles.updateTime}>
            {timeSinceUpdate === 0 ? 'Baru saja' : `${timeSinceUpdate}m lalu`}
          </Text>
          <TouchableOpacity onPress={handleRefresh} disabled={refreshing}>
            <Text style={styles.refreshBtn}>{refreshing ? '⏳' : '↻'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowWatchlistModal(true)}>
            <Text style={styles.watchlistBtn}>⭐</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && stocks.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={PRIMARY} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* IHSG Card */}
          <View style={[styles.card, styles.ihsgCard]}>
            <Text style={styles.cardLabel}>IHSG</Text>
            <Text style={styles.cardIndex}>{ihsg.index.toLocaleString('id-ID')}</Text>
            <View style={styles.cardChange}>
              <Text style={[styles.cardChangeText, { color: ihsg.change >= 0 ? INCOME_COLOR : EXPENSE_COLOR }]}>
                {ihsg.change >= 0 ? '▲' : '▼'} {Math.abs(ihsg.change).toFixed(2)} ({ihsg.changePercent >= 0 ? '+' : ''}{ihsg.changePercent.toFixed(2)}%)
              </Text>
            </View>
          </View>

          {/* Stock Cards */}
          {stocks.map(stock => (
            <View key={stock.symbol} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardSymbol}>{stock.symbol}</Text>
              </View>
              <Text style={styles.cardName} numberOfLines={1}>{stock.name}</Text>
              <Text style={styles.cardPrice}>Rp {stock.price.toLocaleString('id-ID')}</Text>
              <View style={styles.cardChange}>
                <Text style={[styles.cardChangeText, { color: stock.change >= 0 ? INCOME_COLOR : EXPENSE_COLOR }]}>
                  {stock.change >= 0 ? '▲' : '▼'} {Math.abs(stock.changePercent).toFixed(2)}%
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Watchlist Modal */}
      <Modal
        visible={showWatchlistModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowWatchlistModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⭐ Watchlist Saham</Text>
              <TouchableOpacity onPress={() => setShowWatchlistModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Pilih saham yang ingin kamu pantau (maksimal 10)
            </Text>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {POPULAR_STOCKS.map(stock => {
                const isSelected = watchlist.includes(stock.symbol)
                return (
                  <TouchableOpacity
                    key={stock.symbol}
                    style={[styles.stockItem, isSelected && styles.stockItemSelected]}
                    onPress={() => handleToggleTicker(stock.symbol)}
                  >
                    <View style={styles.stockItemLeft}>
                      <Text style={styles.stockItemSymbol}>{stock.symbol}</Text>
                      <Text style={styles.stockItemName}>{stock.name}</Text>
                    </View>
                    <View style={styles.stockItemRight}>
                      <Text style={styles.stockItemSector}>{stock.sector}</Text>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Text style={styles.modalFooterText}>
                {watchlist.length} / 10 saham dipilih
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0D1B3E',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  updateTime: {
    fontSize: 11,
    color: '#888',
  },
  refreshBtn: {
    fontSize: 18,
    color: PRIMARY,
  },
  watchlistBtn: {
    fontSize: 18,
    color: '#EF9F27',
  },
  loadingContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    width: 150,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  ihsgCard: {
    backgroundColor: PRIMARY,
    width: 170,
  },
  cardLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    marginBottom: 4,
  },
  cardIndex: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardSymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY,
  },
  cardName: {
    fontSize: 10,
    color: '#888',
    marginBottom: 8,
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0D1B3E',
    marginBottom: 4,
  },
  cardChange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardChangeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0D1B3E',
  },
  modalClose: {
    fontSize: 24,
    color: '#888',
  },
  modalDesc: {
    fontSize: 13,
    color: '#888',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  modalScroll: {
    paddingHorizontal: 20,
  },
  stockItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F4F7FA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  stockItemSelected: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY + '10',
  },
  stockItemLeft: {
    flex: 1,
  },
  stockItemSymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D1B3E',
    marginBottom: 2,
  },
  stockItemName: {
    fontSize: 11,
    color: '#888',
  },
  stockItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockItemSector: {
    fontSize: 10,
    color: '#888',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  checkmark: {
    fontSize: 16,
    color: PRIMARY,
    fontWeight: '700',
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    marginTop: 8,
  },
  modalFooterText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
})
