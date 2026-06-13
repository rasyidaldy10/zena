import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { notify } from '../lib/alert'
import { COLORS } from '../constants/theme'
import { PRODUCT_UNITS } from '../constants/business'
import { Product } from '../types'

interface Props {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  product?: Product | null // kalau diisi → mode edit
}

export default function ModalTambahProduk({ visible, onClose, onSuccess, product }: Props) {
  const isEdit = !!product
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [unit, setUnit] = useState('pcs')
  const [buyPrice, setBuyPrice] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [initialStock, setInitialStock] = useState('')
  const [minAlert, setMinAlert] = useState('')
  const [loading, setLoading] = useState(false)
  // Varian/tipe (opsional, hanya mode tambah). Tiap tipe punya nama + stok + harga jual.
  const [variants, setVariants] = useState<{ name: string; stock: string; price: string }[]>([])

  const addVariant = () => setVariants(v => [...v, { name: '', stock: '', price: '' }])
  const removeVariant = (i: number) => setVariants(v => v.filter((_, idx) => idx !== i))
  const updateVariant = (i: number, field: 'name' | 'stock' | 'price', val: string) =>
    setVariants(v => v.map((item, idx) => idx === i ? { ...item, [field]: val } : item))

  // Prefill saat mode edit / modal dibuka
  useEffect(() => {
    if (visible && product) {
      setName(product.name || '')
      setCategory(product.category || '')
      setUnit(product.unit || 'pcs')
      setBuyPrice(product.buy_price ? product.buy_price.toLocaleString('id-ID') : '')
      setSellPrice(product.sell_price ? product.sell_price.toLocaleString('id-ID') : '')
      setMinAlert(product.stock_min_alert ? String(product.stock_min_alert) : '')
    }
  }, [visible, product])

  async function handleSave() {
    if (!name.trim()) {
      notify('Error', 'Nama produk wajib diisi')
      return
    }

    const buyPriceNum = parseFloat(buyPrice.replace(/[^0-9]/g, '')) || 0
    const sellPriceNum = parseFloat(sellPrice.replace(/[^0-9]/g, '')) || 0
    const initialStockNum = parseFloat(initialStock.replace(/[^0-9]/g, '')) || 0
    const minAlertNum = parseFloat(minAlert.replace(/[^0-9]/g, '')) || 0

    if (buyPriceNum < 0 || sellPriceNum < 0) {
      notify('Error', 'Harga tidak boleh negatif')
      return
    }

    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')

      if (isEdit && product) {
        // MODE EDIT — update field produk (stok TIDAK diubah di sini,
        // stok dikelola lewat Stok Masuk / Adjustment)
        const { error: updateError } = await supabase
          .from('products')
          .update({
            name: name.trim(),
            category: category.trim() || null,
            unit,
            buy_price: buyPriceNum,
            sell_price: sellPriceNum,
            stock_min_alert: minAlertNum,
          })
          .eq('id', product.id)

        if (updateError) throw updateError

        onSuccess()
        onClose()
        notify('Berhasil', 'Produk berhasil diperbarui')
      } else {
        // MODE TAMBAH — insert produk baru
        // Kalau pakai varian: total stok = jumlah stok semua varian
        const validVariants = variants
          .map(v => ({ name: v.name.trim(), stock: parseFloat(v.stock.replace(/[^0-9]/g, '')) || 0, price: parseFloat(v.price.replace(/[^0-9]/g, '')) || sellPriceNum }))
          .filter(v => v.name)
        const useVariants = validVariants.length > 0
        const productStock = useVariants
          ? validVariants.reduce((s, v) => s + v.stock, 0)
          : initialStockNum

        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert({
            user_id: session.user.id,
            name: name.trim(),
            category: category.trim() || null,
            unit,
            buy_price: buyPriceNum,
            sell_price: sellPriceNum,
            stock_qty: productStock,
            stock_min_alert: minAlertNum,
            is_active: true,
          })
          .select()
          .single()

        if (productError) throw productError

        // Insert varian (kalau ada)
        if (useVariants) {
          const { error: varError } = await supabase.from('product_variants').insert(
            validVariants.map(v => ({
              product_id: newProduct.id,
              user_id: session.user.id,
              name: v.name,
              stock_qty: v.stock,
              sell_price: v.price,
              buy_price: buyPriceNum,
            }))
          )
          if (varError) throw varError
        }

        // Stock movement untuk stok awal (kalau ada)
        if (productStock > 0) {
          const { error: movementError } = await supabase.from('stock_movements').insert({
            user_id: session.user.id,
            product_id: newProduct.id,
            type: 'in',
            qty: productStock,
            price_per_unit: buyPriceNum,
            note: useVariants ? 'Stok awal (dari varian)' : 'Stok awal saat produk dibuat',
          })
          if (movementError) console.error('Error creating initial stock movement:', movementError)
        }

        resetForm()
        onSuccess()
        onClose()
        notify('Berhasil', 'Produk berhasil ditambahkan')
      }
    } catch (error: any) {
      console.error('Error saving product:', error)
      notify('Error', error.message || 'Gagal menyimpan produk')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setName('')
    setCategory('')
    setUnit('pcs')
    setBuyPrice('')
    setSellPrice('')
    setInitialStock('')
    setMinAlert('')
    setVariants([])
  }

  function formatCurrency(value: string) {
    const num = value.replace(/[^0-9]/g, '')
    if (!num) return ''
    return parseInt(num).toLocaleString('id-ID')
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>{isEdit ? 'Edit Produk' : 'Tambah Produk'}</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Name */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Nama Produk <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Contoh: Syringe 10ml"
                placeholderTextColor={COLORS.TEXT_LIGHT}
                editable={!loading}
              />
            </View>

            {/* Category */}
            <View style={styles.field}>
              <Text style={styles.label}>Kategori</Text>
              <TextInput
                style={styles.input}
                value={category}
                onChangeText={setCategory}
                placeholder="Contoh: Alat Medis"
                placeholderTextColor={COLORS.TEXT_LIGHT}
                editable={!loading}
              />
            </View>

            {/* Unit */}
            <View style={styles.field}>
              <Text style={styles.label}>Satuan</Text>
              <View style={styles.unitGrid}>
                {PRODUCT_UNITS.map((productUnit) => (
                  <TouchableOpacity
                    key={productUnit.value}
                    style={[
                      styles.unitButton,
                      unit === productUnit.value && styles.unitButtonActive,
                    ]}
                    onPress={() => setUnit(productUnit.value)}
                    disabled={loading}
                  >
                    <Text
                      style={[
                        styles.unitText,
                        unit === productUnit.value && styles.unitTextActive,
                      ]}
                    >
                      {productUnit.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Buy Price (HPP) */}
            <View style={styles.field}>
              <Text style={styles.label}>Harga Beli (HPP)</Text>
              <View style={styles.currencyInput}>
                <Text style={styles.currencyPrefix}>Rp</Text>
                <TextInput
                  style={styles.currencyValue}
                  value={buyPrice}
                  onChangeText={(text) => setBuyPrice(formatCurrency(text))}
                  placeholder="0"
                  placeholderTextColor={COLORS.TEXT_LIGHT}
                  keyboardType="numeric"
                  editable={!loading}
                />
              </View>
            </View>

            {/* Sell Price */}
            <View style={styles.field}>
              <Text style={styles.label}>Harga Jual</Text>
              <View style={styles.currencyInput}>
                <Text style={styles.currencyPrefix}>Rp</Text>
                <TextInput
                  style={styles.currencyValue}
                  value={sellPrice}
                  onChangeText={(text) => setSellPrice(formatCurrency(text))}
                  placeholder="0"
                  placeholderTextColor={COLORS.TEXT_LIGHT}
                  keyboardType="numeric"
                  editable={!loading}
                />
              </View>
            </View>

            {/* Initial Stock — hanya saat tambah & TIDAK pakai varian
                (kalau pakai varian, total stok = jumlah stok tiap tipe) */}
            {!isEdit && variants.length === 0 && (
              <View style={styles.field}>
                <Text style={styles.label}>Stok Awal</Text>
                <TextInput
                  style={styles.input}
                  value={initialStock}
                  onChangeText={setInitialStock}
                  placeholder="0"
                  placeholderTextColor={COLORS.TEXT_LIGHT}
                  keyboardType="numeric"
                  editable={!loading}
                />
              </View>
            )}

            {/* Varian / Tipe (opsional, hanya mode tambah) */}
            {!isEdit && (
              <View style={styles.field}>
                <Text style={styles.label}>Tipe / Varian (opsional)</Text>
                <Text style={styles.hint}>
                  Mis. produk punya beberapa tipe (O2, Air, dll). Total stok = jumlah semua tipe.
                </Text>
                {variants.map((v, i) => (
                  <View key={i} style={styles.variantRow}>
                    <TextInput
                      style={[styles.input, { flex: 1.4 }]}
                      value={v.name}
                      onChangeText={(t) => updateVariant(i, 'name', t)}
                      placeholder="Nama tipe"
                      placeholderTextColor={COLORS.TEXT_LIGHT}
                      editable={!loading}
                    />
                    <TextInput
                      style={[styles.input, { flex: 0.8 }]}
                      value={v.stock}
                      onChangeText={(t) => updateVariant(i, 'stock', t.replace(/[^0-9]/g, ''))}
                      placeholder="Stok"
                      placeholderTextColor={COLORS.TEXT_LIGHT}
                      keyboardType="numeric"
                      editable={!loading}
                    />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={v.price}
                      onChangeText={(t) => updateVariant(i, 'price', formatCurrency(t))}
                      placeholder="Harga"
                      placeholderTextColor={COLORS.TEXT_LIGHT}
                      keyboardType="numeric"
                      editable={!loading}
                    />
                    <TouchableOpacity onPress={() => removeVariant(i)} style={styles.variantDel}>
                      <Text style={{ color: COLORS.DANGER, fontSize: 18 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addVariantBtn} onPress={addVariant} disabled={loading}>
                  <Text style={styles.addVariantText}>+ Tambah Tipe</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Min Alert */}
            <View style={styles.field}>
              <Text style={styles.label}>Minimum Stok Alert</Text>
              <TextInput
                style={styles.input}
                value={minAlert}
                onChangeText={setMinAlert}
                placeholder="0"
                placeholderTextColor={COLORS.TEXT_LIGHT}
                keyboardType="numeric"
                editable={!loading}
              />
              <Text style={styles.hint}>
                Sistem akan alert jika stok ≤ nilai ini
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.buttonCancel]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.buttonCancelText}>Batal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonSave]}
              onPress={handleSave}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.WHITE} />
              ) : (
                <Text style={styles.buttonSaveText}>{isEdit ? 'Simpan Perubahan' : 'Simpan'}</Text>
              )}
            </TouchableOpacity>
          </View>
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
    maxHeight: '90%',
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
  content: {
    padding: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 8,
  },
  required: {
    color: COLORS.DANGER,
  },
  input: {
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.TEXT,
  },
  unitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unitButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  unitButtonActive: {
    backgroundColor: COLORS.PRIMARY + '10',
    borderColor: COLORS.PRIMARY,
  },
  unitText: {
    fontSize: 12,
    color: COLORS.TEXT,
  },
  unitTextActive: {
    fontWeight: '600',
    color: COLORS.PRIMARY,
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginRight: 4,
  },
  currencyValue: {
    flex: 1,
    fontSize: 14,
    color: COLORS.TEXT,
    padding: 0,
  },
  hint: {
    fontSize: 11,
    color: COLORS.TEXT_LIGHT,
    marginTop: 4,
  },
  variantRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 8 },
  variantDel: { paddingHorizontal: 6, paddingVertical: 8 },
  addVariantBtn: {
    marginTop: 10, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed',
    borderColor: COLORS.PRIMARY, paddingVertical: 10, alignItems: 'center',
  },
  addVariantText: { fontSize: 13, fontWeight: '600', color: COLORS.PRIMARY },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCancel: {
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  buttonCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  buttonSave: {
    backgroundColor: COLORS.PRIMARY,
  },
  buttonSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
})
