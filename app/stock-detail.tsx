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
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Product, StockMovement } from '../types'
import { COLORS } from '../constants/theme'
import { formatRupiah, formatDateTime } from '../lib/format'
import ModalStockIn from '../components/ModalStockIn'
import ModalStockAdjust from '../components/ModalStockAdjust'
import ModalTambahProduk from '../components/ModalTambahProduk'

export default function StockDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [product, setProduct] = useState<Product | null>(null)
  const [movements, setMovements] = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showStockInModal, setShowStockInModal] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    if (id) {
      fetchStockDetail()
    }
  }, [id])

  async function fetchStockDetail() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      // Fetch product
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('user_id', session.user.id)
        .single()

      if (productError) throw productError
      setProduct(productData)

      // Fetch stock movements
      const { data: movementsData, error: movementsError } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('product_id', id)
        .order('created_at', { ascending: false })

      if (movementsError) throw movementsError
      setMovements(movementsData || [])
    } catch (error: any) {
      console.error('Error fetching stock detail:', error)
      Alert.alert('Error', error.message || 'Gagal memuat detail stok')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  function onRefresh() {
    setRefreshing(true)
    fetchStockDetail()
  }

  function handleEditProduct() {
    if (!product) return
    setShowEditModal(true)
  }

  function renderMovementItem({ item }: { item: StockMovement }) {
    const isIncrease = item.type === 'in' || (item.type === 'adjustment' && item.qty > 0)

    return (
      <View style={styles.movementCard}>
        <View style={styles.movementHeader}>
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor:
                  item.type === 'in'
                    ? COLORS.SUCCESS + '20'
                    : item.type === 'out'
                    ? COLORS.DANGER + '20'
                    : COLORS.WARNING + '20',
              },
            ]}
          >
            <Text
              style={[
                styles.typeText,
                {
                  color:
                    item.type === 'in'
                      ? COLORS.SUCCESS
                      : item.type === 'out'
                      ? COLORS.DANGER
                      : COLORS.WARNING,
                },
              ]}
            >
              {item.type === 'in'
                ? '📥 Stok Masuk'
                : item.type === 'out'
                ? '📤 Stok Keluar'
                : '🔧 Adjustment'}
            </Text>
          </View>
          <Text style={styles.movementDate}>{formatDateTime(item.created_at)}</Text>
        </View>

        <View style={styles.movementBody}>
          <View style={styles.movementRow}>
            <Text style={styles.movementLabel}>Qty</Text>
            <Text
              style={[
                styles.movementValue,
                {
                  color: isIncrease ? COLORS.SUCCESS : COLORS.DANGER,
                },
              ]}
            >
              {isIncrease ? '+' : '-'}
              {Math.abs(item.qty).toLocaleString('id-ID')} {product?.unit}
            </Text>
          </View>

          <View style={styles.movementRow}>
            <Text style={styles.movementLabel}>Harga per Unit</Text>
            <Text style={styles.movementValue}>{formatRupiah(item.price_per_unit)}</Text>
          </View>

          <View style={styles.movementRow}>
            <Text style={styles.movementLabel}>Total Nilai</Text>
            <Text style={styles.movementValue}>
              {formatRupiah(Math.abs(item.qty) * item.price_per_unit)}
            </Text>
          </View>

          {item.note && (
            <View style={styles.noteContainer}>
              <Text style={styles.noteLabel}>Catatan:</Text>
              <Text style={styles.noteText}>{item.note}</Text>
            </View>
          )}

          {item.project_id && (
            <Text style={styles.linkedText}>🔗 Terhubung dengan project</Text>
          )}

          {item.transaction_id && (
            <Text style={styles.linkedText}>🔗 Dari transaksi penjualan</Text>
          )}
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    )
  }

  if (!product) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Produk tidak ditemukan</Text>
      </View>
    )
  }

  const isLowStock = product.stock_qty <= product.stock_min_alert

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: product.name,
          headerShown: true,
          headerBackTitle: 'Kembali',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 12 }}>
              <Text style={{ fontSize: 15, color: COLORS.PRIMARY, fontWeight: '600' }}>‹ Kembali</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <FlatList
        data={movements}
        renderItem={renderMovementItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <>
            {/* Product Info Card */}
            <View style={styles.productCard}>
              <View style={styles.productHeader}>
                <View style={styles.productTitle}>
                  <Text style={styles.productName}>{product.name}</Text>
                  {product.category && (
                    <Text style={styles.productCategory}>{product.category}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={handleEditProduct}
                >
                  <Text style={styles.editButtonText}>✏️ Edit</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.stockInfo}>
                <Text style={styles.stockLabel}>Stok Saat Ini</Text>
                <Text
                  style={[
                    styles.stockValue,
                    isLowStock && { color: COLORS.DANGER },
                  ]}
                >
                  {product.stock_qty.toLocaleString('id-ID')} {product.unit}
                </Text>
                {isLowStock && (
                  <View style={styles.lowStockBadge}>
                    <Text style={styles.lowStockText}>⚠️ Stok di bawah minimum alert</Text>
                  </View>
                )}
              </View>

              <View style={styles.priceInfo}>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>HPP</Text>
                  <Text style={styles.priceValue}>{formatRupiah(product.buy_price)}</Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Harga Jual</Text>
                  <Text style={[styles.priceValue, { color: COLORS.SUCCESS }]}>
                    {formatRupiah(product.sell_price)}
                  </Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Nilai Stok</Text>
                  <Text style={[styles.priceValue, { fontWeight: '700' }]}>
                    {formatRupiah(product.stock_qty * product.buy_price)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonPrimary]}
                onPress={() => setShowStockInModal(true)}
              >
                <Text style={styles.actionButtonText}>📥 Stok Masuk</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonSecondary]}
                onPress={() => setShowAdjustModal(true)}
              >
                <Text style={styles.actionButtonTextSecondary}>🔧 Adjustment</Text>
              </TouchableOpacity>
            </View>

            {/* Movement History Header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Riwayat Mutasi Stok</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Belum ada riwayat mutasi stok</Text>
          </View>
        }
      />

      {/* Modals */}
      <ModalStockIn
        visible={showStockInModal}
        onClose={() => setShowStockInModal(false)}
        onSuccess={fetchStockDetail}
        product={product}
      />

      <ModalStockAdjust
        visible={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        onSuccess={fetchStockDetail}
        product={product}
      />

      <ModalTambahProduk
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={fetchStockDetail}
        product={product}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: COLORS.TEXT_LIGHT,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  productCard: {
    backgroundColor: COLORS.CARD,
    borderRadius: 12,
    padding: 16,
    gap: 16,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productTitle: {
    flex: 1,
    gap: 4,
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  productCategory: {
    fontSize: 13,
    color: COLORS.TEXT_LIGHT,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  editButtonText: {
    fontSize: 12,
    color: COLORS.TEXT,
  },
  stockInfo: {
    gap: 8,
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.BORDER,
  },
  stockLabel: {
    fontSize: 13,
    color: COLORS.TEXT_LIGHT,
  },
  stockValue: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  lowStockBadge: {
    backgroundColor: COLORS.DANGER + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  lowStockText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.DANGER,
  },
  priceInfo: {
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 13,
    color: COLORS.TEXT_LIGHT,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionButtonPrimary: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  actionButtonSecondary: {
    backgroundColor: COLORS.BACKGROUND,
    borderColor: COLORS.BORDER,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  actionButtonTextSecondary: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  sectionHeader: {
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.TEXT,
    textTransform: 'uppercase',
  },
  movementCard: {
    backgroundColor: COLORS.CARD,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  movementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  movementDate: {
    fontSize: 11,
    color: COLORS.TEXT_LIGHT,
  },
  movementBody: {
    gap: 8,
  },
  movementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  movementLabel: {
    fontSize: 13,
    color: COLORS.TEXT_LIGHT,
  },
  movementValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  noteContainer: {
    backgroundColor: COLORS.BACKGROUND,
    padding: 12,
    borderRadius: 8,
    gap: 4,
    marginTop: 4,
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.TEXT_LIGHT,
  },
  noteText: {
    fontSize: 13,
    color: COLORS.TEXT,
  },
  linkedText: {
    fontSize: 11,
    color: COLORS.PRIMARY,
    marginTop: 4,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.TEXT_LIGHT,
  },
})
