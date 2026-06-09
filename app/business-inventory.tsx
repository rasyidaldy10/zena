import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Stack, router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Product } from '../types'
import { COLORS } from '../constants/theme'
import { formatRupiah } from '../lib/format'
import ModalTambahProduk from '../components/ModalTambahProduk'

export default function BusinessInventoryScreen() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  function onRefresh() {
    setRefreshing(true)
    fetchProducts()
  }

  async function handleToggleActive(product: Product) {
    Alert.alert(
      'Nonaktifkan Produk',
      `Nonaktifkan produk "${product.name}"? Produk tidak akan muncul di list.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Nonaktifkan',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('products')
                .update({ is_active: false })
                .eq('id', product.id)

              if (error) throw error

              Alert.alert('Berhasil', 'Produk dinonaktifkan')
              fetchProducts()
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Gagal menonaktifkan produk')
            }
          },
        },
      ]
    )
  }

  // Calculate stats
  const totalProducts = products.length
  const totalStockValue = products.reduce(
    (sum, p) => sum + p.stock_qty * p.buy_price,
    0
  )
  const lowStockProducts = products.filter(
    (p) => p.stock_qty <= p.stock_min_alert
  )

  function renderProductCard({ item }: { item: Product }) {
    const isLowStock = item.stock_qty <= item.stock_min_alert

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/stock-detail?id=${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitle}>
            <Text style={styles.productName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.category && (
              <Text style={styles.category}>{item.category}</Text>
            )}
          </View>
          {isLowStock && (
            <View style={styles.alertBadge}>
              <Text style={styles.alertText}>⚠️ Stok Rendah</Text>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.row}>
            <Text style={styles.label}>Stok Saat Ini</Text>
            <Text
              style={[
                styles.value,
                styles.stockValue,
                isLowStock && { color: COLORS.DANGER },
              ]}
            >
              {item.stock_qty.toLocaleString('id-ID')} {item.unit}
            </Text>
          </View>

          {item.stock_min_alert > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Minimum Alert</Text>
              <Text style={styles.valueSmall}>
                {item.stock_min_alert.toLocaleString('id-ID')} {item.unit}
              </Text>
            </View>
          )}

          <View style={styles.separator} />

          <View style={styles.row}>
            <Text style={styles.label}>HPP</Text>
            <Text style={styles.valueSmall}>{formatRupiah(item.buy_price)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Harga Jual</Text>
            <Text style={[styles.value, { color: COLORS.SUCCESS }]}>
              {formatRupiah(item.sell_price)}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Nilai Stok</Text>
            <Text style={styles.value}>
              {formatRupiah(item.stock_qty * item.buy_price)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.deactivateButton}
          onPress={() => handleToggleActive(item)}
        >
          <Text style={styles.deactivateButtonText}>Nonaktifkan</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Inventory',
          headerRight: () => (
            <TouchableOpacity onPress={() => setShowAddModal(true)}>
              <Text style={styles.addButton}>+ Produk</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {/* Summary Header */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Produk</Text>
            <Text style={styles.summaryValue}>{totalProducts}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Nilai Stok</Text>
            <Text style={[styles.summaryValue, { color: COLORS.PRIMARY }]}>
              {formatRupiah(totalStockValue)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Stok Rendah</Text>
            <Text
              style={[
                styles.summaryValue,
                {
                  color:
                    lowStockProducts.length > 0 ? COLORS.DANGER : COLORS.SUCCESS,
                },
              ]}
            >
              {lowStockProducts.length}
            </Text>
          </View>
        </View>
      </View>

      {/* Products List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      ) : products.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyText}>Belum ada produk</Text>
          <Text style={styles.emptySubtext}>
            Tap "+ Produk" untuk mulai tracking inventory
          </Text>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProductCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {/* Add Product Modal */}
      <ModalTambahProduk
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchProducts}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  addButton: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.PRIMARY,
    marginRight: 16,
  },
  summaryCard: {
    backgroundColor: COLORS.CARD,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryItem: {
    flex: 1,
    gap: 4,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.TEXT_LIGHT,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: COLORS.BORDER,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.TEXT_LIGHT,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: COLORS.CARD,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    gap: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  category: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
  },
  alertBadge: {
    backgroundColor: COLORS.DANGER + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  alertText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.DANGER,
  },
  cardBody: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: COLORS.TEXT_LIGHT,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  stockValue: {
    fontSize: 16,
  },
  valueSmall: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.TEXT,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.BORDER,
    marginVertical: 4,
  },
  deactivateButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  deactivateButtonText: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
  },
})
