import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { notify } from '../lib/alert'
import { Product } from '../types'
import { COLORS } from '../constants/theme'

interface Props {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  product: Product
}

export default function ModalStockAdjust({ visible, onClose, onSuccess, product }: Props) {
  const [newQty, setNewQty] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    const newQtyNum = parseFloat(newQty) || 0

    if (newQtyNum < 0) {
      notify('Error', 'Stok tidak boleh negatif')
      return
    }

    if (!note.trim()) {
      notify('Error', 'Catatan alasan adjustment wajib diisi')
      return
    }

    const difference = newQtyNum - product.stock_qty

    if (difference === 0) {
      notify('Info', 'Tidak ada perubahan stok')
      return
    }

    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')

      // Insert stock movement (adjustment)
      const { error: movementError } = await supabase.from('stock_movements').insert({
        user_id: session.user.id,
        product_id: product.id,
        type: 'adjustment',
        qty: difference, // positive or negative
        price_per_unit: product.buy_price,
        note: note.trim(),
      })

      if (movementError) throw movementError

      // Update product stock_qty
      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock_qty: newQtyNum,
        })
        .eq('id', product.id)

      if (updateError) throw updateError

      resetForm()
      onSuccess()
      onClose()
      notify('Berhasil', `Stok disesuaikan dari ${product.stock_qty} menjadi ${newQtyNum} ${product.unit}`)
    } catch (error: any) {
      console.error('Error saving stock adjustment:', error)
      notify('Error', error.message || 'Gagal menyimpan')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setNewQty('')
    setNote('')
  }

  const difference = (parseFloat(newQty) || 0) - product.stock_qty

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Stock Adjustment - {product.name}</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Current Stock Info */}
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Stok Saat Ini</Text>
              <Text style={styles.infoValue}>
                {product.stock_qty.toLocaleString('id-ID')} {product.unit}
              </Text>
            </View>

            {/* New Qty */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Stok Aktual (Hasil Opname) <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.qtyInput}>
                <TextInput
                  style={styles.qtyValue}
                  value={newQty}
                  onChangeText={setNewQty}
                  placeholder="0"
                  placeholderTextColor={COLORS.TEXT_LIGHT}
                  keyboardType="numeric"
                  editable={!loading}
                />
                <Text style={styles.unit}>{product.unit}</Text>
              </View>
            </View>

            {/* Difference Display */}
            {newQty && difference !== 0 && (
              <View
                style={[
                  styles.differenceCard,
                  {
                    backgroundColor:
                      difference > 0 ? COLORS.SUCCESS + '10' : COLORS.DANGER + '10',
                  },
                ]}
              >
                <Text style={styles.differenceLabel}>Selisih</Text>
                <Text
                  style={[
                    styles.differenceValue,
                    { color: difference > 0 ? COLORS.SUCCESS : COLORS.DANGER },
                  ]}
                >
                  {difference > 0 ? '+' : ''}
                  {difference.toLocaleString('id-ID')} {product.unit}
                </Text>
              </View>
            )}

            {/* Note */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Catatan Alasan <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={note}
                onChangeText={setNote}
                placeholder="Contoh: Hasil stock opname fisik, ada barang rusak, dll"
                placeholderTextColor={COLORS.TEXT_LIGHT}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!loading}
              />
              <Text style={styles.hint}>
                Wajib isi alasan untuk audit trail
              </Text>
            </View>
          </View>

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
                <Text style={styles.buttonSaveText}>Simpan Adjustment</Text>
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
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.TEXT,
    flex: 1,
  },
  closeButton: {
    fontSize: 24,
    color: COLORS.TEXT_LIGHT,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  infoCard: {
    backgroundColor: COLORS.PRIMARY + '10',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
  },
  infoValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.PRIMARY,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
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
  textArea: {
    minHeight: 80,
  },
  qtyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  qtyValue: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT,
    padding: 0,
  },
  unit: {
    fontSize: 14,
    color: COLORS.TEXT_LIGHT,
    marginLeft: 8,
  },
  differenceCard: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    gap: 4,
  },
  differenceLabel: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
  },
  differenceValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  hint: {
    fontSize: 11,
    color: COLORS.TEXT_LIGHT,
  },
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
    backgroundColor: COLORS.WARNING,
  },
  buttonSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
})
