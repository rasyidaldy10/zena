import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { Product, TransactionItem } from '../types'
import { COLORS } from '../constants/theme'
import { formatRupiah } from '../lib/format'

interface Props {
  visible: boolean
  onClose: () => void
  onAddItem: (item: TransactionItem & { product: Product }) => void
}

export default function ItemKeranjangPicker({ visible, onClose, onAddItem }: Props) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')

  useEffect(() => {
    if (visible) {
      fetchProducts()
    }
  }, [visible])

  async function fetchProducts() {
    setLoading(true)
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
    }
  }

  function handleSelectProduct(product: Product) {
    setSelectedProduct(product)
    setQty('')
    setPrice(product.sell_price.toLocaleString('id-ID'))
  }

  function handleAddToCart() {
    if (!selectedProduct) return

    const qtyNum = parseFloat(qty) || 0
    const priceNum = parseFloat(price.replace(/[^0-9]/g, '')) || 0

    if (qtyNum <= 0) {
      Alert.alert('Error', 'Qty harus lebih dari 0')
      return
    }

    if (qtyNum > selectedProduct.stock_qty) {
      Alert.alert('Error', `Stok tidak cukup. Tersedia: ${selectedProduct.stock_qty} ${selectedProduct.unit}`)
      return
    }

    if (priceNum <= 0) {
      Alert.alert('Error', 'Harga harus lebih dari 0')
      return
    }

    const item: TransactionItem & { product: Product } = {
      id: '',
      transaction_id: '',
      product_id: selectedProduct.id,
      product: selectedProduct,
      qty: qtyNum,
      price_per_unit: priceNum,
      subtotal: qtyNum * priceNum,
      hpp_per_unit: selectedProduct.buy_price,
      hpp_total: qtyNum * selectedProduct.buy_price,
    }

    onAddItem(item)
    setSelectedProduct(null)
    setQty('')
    setPrice('')
  }

  function renderProductItem({ item }: { item: Product }) {
    const isLowStock = item.stock_qty <= item.stock_min_alert

    return (
      <TouchableOpacity
        style={[
          styles.productCard,
          selectedProduct?.id === item.id && styles.productCardActive,
        ]}
        onPress={() => handleSelectProduct(item)}
      >
        <View style={styles.productHeader}>
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{item.name}</Text>
            {item.category && (
              <Text style={styles.productCategory}>{item.category}</Text>
            )}
          </View>
          {isLowStock && (
            <View style={styles.lowStockBadge}>
              <Text style={styles.lowStockText}>⚠️ Rendah</Text>
            </View>
          )}
        </View>

        <View style={styles.productFooter}>
          <Text style={styles.productStock}>
            Stok: {item.stock_qty.toLocaleString('id-ID')} {item.unit}
          </Text>
          <Text style={styles.productPrice}>{formatRupiah(item.sell_price)}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Pilih Produk</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={COLORS.PRIMARY} />
            </View>
          ) : products.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>Belum ada produk</Text>
            </View>
          ) : (
            <>
              <FlatList
                data={products}
                renderItem={renderProductItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
              />

              {selectedProduct && (
                <View style={styles.inputSection}>
                  <View style={styles.selectedProduct}>
                    <Text style={styles.selectedProductName}>{selectedProduct.name}</Text>
                    <Text style={styles.selectedProductPrice}>
                      {formatRupiah(selectedProduct.sell_price)} / {selectedProduct.unit}
                    </Text>
                  </View>

                  <View style={styles.inputRow}>
                    <View style={styles.inputField}>
                      <Text style={styles.inputLabel}>Qty</Text>
                      <View style={styles.qtyInput}>
                        <TextInput
                          style={styles.qtyValue}
                          value={qty}
                          onChangeText={setQty}
                          placeholder="0"
                          placeholderTextColor={COLORS.TEXT_LIGHT}
                          keyboardType="numeric"
                        />
                        <Text style={styles.unit}>{selectedProduct.unit}</Text>
                      </View>
                    </View>

                    <View style={styles.inputField}>
                      <Text style={styles.inputLabel}>Harga Jual</Text>
                      <View style={styles.priceInput}>
                        <Text style={styles.pricePrefix}>Rp</Text>
                        <TextInput
                          style={styles.priceValue}
                          value={price}
                          onChangeText={(text) =>
                            setPrice(
                              text.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
                            )
                          }
                          placeholder="0"
                          placeholderTextColor={COLORS.TEXT_LIGHT}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  </View>

                  {qty && price && (
                    <View style={styles.subtotalCard}>
                      <Text style={styles.subtotalLabel}>Subtotal</Text>
                      <Text style={styles.subtotalValue}>
                        {formatRupiah(
                          parseFloat(qty) * parseFloat(price.replace(/[^0-9]/g, ''))
                        )}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity style={styles.addButton} onPress={handleAddToCart}>
                    <Text style={styles.addButtonText}>✓ Tambah ke Keranjang</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  closeButton: {
    fontSize: 24,
    color: COLORS.TEXT_LIGHT,
  },
  centerContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.TEXT_LIGHT,
  },
  listContent: {
    padding: 16,
    gap: 8,
  },
  productCard: {
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  productCardActive: {
    backgroundColor: COLORS.PRIMARY + '10',
    borderColor: COLORS.PRIMARY,
    borderWidth: 2,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  productInfo: {
    flex: 1,
    gap: 2,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  productCategory: {
    fontSize: 11,
    color: COLORS.TEXT_LIGHT,
  },
  lowStockBadge: {
    backgroundColor: COLORS.DANGER + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  lowStockText: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.DANGER,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productStock: {
    fontSize: 11,
    color: COLORS.TEXT_LIGHT,
  },
  productPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.SUCCESS,
  },
  inputSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    gap: 12,
  },
  selectedProduct: {
    backgroundColor: COLORS.PRIMARY + '10',
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  selectedProductName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.PRIMARY,
  },
  selectedProductPrice: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputField: {
    flex: 1,
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  qtyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  qtyValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT,
    padding: 0,
  },
  unit: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
    marginLeft: 4,
  },
  priceInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pricePrefix: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginRight: 4,
  },
  priceValue: {
    flex: 1,
    fontSize: 14,
    color: COLORS.TEXT,
    padding: 0,
  },
  subtotalCard: {
    backgroundColor: COLORS.SUCCESS + '10',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtotalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  subtotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.SUCCESS,
  },
  addButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
})
