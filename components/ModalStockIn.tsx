import { useState, useEffect } from 'react'
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
import { Product, Project } from '../types'
import { COLORS } from '../constants/theme'

interface Props {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  product: Product
}

export default function ModalStockIn({ visible, onClose, onSuccess, product }: Props) {
  const [qty, setQty] = useState('')
  const [pricePerUnit, setPricePerUnit] = useState('')
  const [note, setNote] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible) {
      // Pre-fill with product's buy_price
      setPricePerUnit(product.buy_price.toLocaleString('id-ID'))
      fetchProjects()
    }
  }, [visible, product])

  async function fetchProjects() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'aktif')
        .order('created_at', { ascending: false })

      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
    }
  }

  async function handleSave() {
    const qtyNum = parseFloat(qty) || 0
    const priceNum = parseFloat(pricePerUnit.replace(/[^0-9]/g, '')) || 0

    if (qtyNum <= 0) {
      Alert.alert('Error', 'Qty harus lebih dari 0')
      return
    }

    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')

      // Insert stock movement
      const { error: movementError } = await supabase.from('stock_movements').insert({
        user_id: session.user.id,
        product_id: product.id,
        project_id: selectedProjectId,
        type: 'in',
        qty: qtyNum,
        price_per_unit: priceNum,
        note: note.trim() || null,
      })

      if (movementError) throw movementError

      // Update product stock_qty
      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock_qty: product.stock_qty + qtyNum,
        })
        .eq('id', product.id)

      if (updateError) throw updateError

      Alert.alert('Berhasil', 'Stok masuk berhasil dicatat', [
        {
          text: 'OK',
          onPress: () => {
            resetForm()
            onSuccess()
            onClose()
          },
        },
      ])
    } catch (error: any) {
      console.error('Error saving stock in:', error)
      Alert.alert('Error', error.message || 'Gagal menyimpan')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setQty('')
    setPricePerUnit('')
    setNote('')
    setSelectedProjectId(null)
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
            <Text style={styles.title}>Stok Masuk - {product.name}</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Qty */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Qty Masuk <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.qtyInput}>
                <TextInput
                  style={styles.qtyValue}
                  value={qty}
                  onChangeText={setQty}
                  placeholder="0"
                  placeholderTextColor={COLORS.TEXT_LIGHT}
                  keyboardType="numeric"
                  editable={!loading}
                />
                <Text style={styles.unit}>{product.unit}</Text>
              </View>
            </View>

            {/* Price per Unit */}
            <View style={styles.field}>
              <Text style={styles.label}>Harga Beli per Unit</Text>
              <View style={styles.currencyInput}>
                <Text style={styles.currencyPrefix}>Rp</Text>
                <TextInput
                  style={styles.currencyValue}
                  value={pricePerUnit}
                  onChangeText={(text) => setPricePerUnit(formatCurrency(text))}
                  placeholder="0"
                  placeholderTextColor={COLORS.TEXT_LIGHT}
                  keyboardType="numeric"
                  editable={!loading}
                />
              </View>
            </View>

            {/* Note */}
            <View style={styles.field}>
              <Text style={styles.label}>Catatan</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={note}
                onChangeText={setNote}
                placeholder="Catatan (opsional)"
                placeholderTextColor={COLORS.TEXT_LIGHT}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!loading}
              />
            </View>

            {/* Link to Project */}
            {projects.length > 0 && (
              <View style={styles.field}>
                <Text style={styles.label}>Link ke Project (Opsional)</Text>
                <View style={styles.projectList}>
                  <TouchableOpacity
                    style={[
                      styles.projectItem,
                      !selectedProjectId && styles.projectItemActive,
                    ]}
                    onPress={() => setSelectedProjectId(null)}
                  >
                    <Text style={styles.projectText}>Tidak ada project</Text>
                  </TouchableOpacity>
                  {projects.slice(0, 3).map((proj) => (
                    <TouchableOpacity
                      key={proj.id}
                      style={[
                        styles.projectItem,
                        selectedProjectId === proj.id && styles.projectItemActive,
                      ]}
                      onPress={() => setSelectedProjectId(proj.id)}
                    >
                      <Text style={styles.projectText}>{proj.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
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
                <Text style={styles.buttonSaveText}>Simpan</Text>
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
  projectList: {
    gap: 8,
  },
  projectItem: {
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  projectItemActive: {
    backgroundColor: COLORS.PRIMARY + '10',
    borderColor: COLORS.PRIMARY,
  },
  projectText: {
    fontSize: 13,
    color: COLORS.TEXT,
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
    backgroundColor: COLORS.SUCCESS,
  },
  buttonSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
})
