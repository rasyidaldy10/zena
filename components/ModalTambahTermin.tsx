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
import { COLORS } from '../constants/theme'

interface Props {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
  projectId: string
}

export default function ModalTambahTermin({ visible, onClose, onSuccess, projectId }: Props) {
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [conditionText, setConditionText] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!label.trim()) {
      Alert.alert('Error', 'Label termin wajib diisi')
      return
    }

    const amountNum = parseFloat(amount.replace(/[^0-9]/g, '')) || 0
    if (amountNum <= 0) {
      Alert.alert('Error', 'Nominal harus lebih dari 0')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.from('project_terms').insert({
        project_id: projectId,
        label: label.trim(),
        amount: amountNum,
        condition_text: conditionText.trim() || null,
      })

      if (error) throw error

      Alert.alert('Berhasil', 'Termin berhasil ditambahkan', [
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
      console.error('Error creating term:', error)
      Alert.alert('Error', error.message || 'Gagal menambahkan termin')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setLabel('')
    setAmount('')
    setConditionText('')
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
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Tambah Termin</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Label */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Label Termin <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={setLabel}
                placeholder="Contoh: Termin 1, Termin Akhir"
                placeholderTextColor={COLORS.TEXT_LIGHT}
                editable={!loading}
              />
            </View>

            {/* Amount */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Nominal <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.currencyInput}>
                <Text style={styles.currencyPrefix}>Rp</Text>
                <TextInput
                  style={styles.currencyValue}
                  value={amount}
                  onChangeText={(text) => setAmount(formatCurrency(text))}
                  placeholder="0"
                  placeholderTextColor={COLORS.TEXT_LIGHT}
                  keyboardType="numeric"
                  editable={!loading}
                />
              </View>
            </View>

            {/* Condition Text */}
            <View style={styles.field}>
              <Text style={styles.label}>Kondisi/Jatuh Tempo (Opsional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={conditionText}
                onChangeText={setConditionText}
                placeholder="Contoh: Dibayar setelah barang dikirim"
                placeholderTextColor={COLORS.TEXT_LIGHT}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!loading}
              />
            </View>
          </View>

          {/* Footer */}
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
