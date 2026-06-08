import { useState } from 'react'
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
import { ProjectType } from '../types'
import { PROJECT_TYPES } from '../constants/business'
import { COLORS } from '../constants/theme'

interface Props {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ModalTambahProject({ visible, onClose, onSuccess }: Props) {
  const [name, setName] = useState('')
  const [clientName, setClientName] = useState('')
  const [type, setType] = useState<ProjectType>('alkes')
  const [contractValue, setContractValue] = useState('')
  const [dpAmount, setDpAmount] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Error', 'Nama project wajib diisi')
      return
    }

    const contractNum = parseFloat(contractValue.replace(/[^0-9]/g, '')) || 0
    if (contractNum <= 0) {
      Alert.alert('Error', 'Nilai kontrak harus lebih dari 0')
      return
    }

    const dpNum = parseFloat(dpAmount.replace(/[^0-9]/g, '')) || 0
    if (dpNum > contractNum) {
      Alert.alert('Error', 'DP tidak boleh lebih besar dari nilai kontrak')
      return
    }

    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')

      // 1. Insert project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          user_id: session.user.id,
          name: name.trim(),
          client_name: clientName.trim() || null,
          type,
          contract_value: contractNum,
          status: 'aktif',
        })
        .select()
        .single()

      if (projectError) throw projectError

      // 2. If DP > 0, create DP term
      if (dpNum > 0) {
        const { error: termError } = await supabase.from('project_terms').insert({
          project_id: project.id,
          label: 'DP',
          amount: dpNum,
          condition_text: 'Down Payment',
          paid_at: new Date().toISOString(),
        })

        if (termError) throw termError
      }

      // 3. Create receivable for remaining amount
      const remainingAmount = contractNum - dpNum
      if (remainingAmount > 0) {
        const { error: receivableError } = await supabase.from('receivables').insert({
          user_id: session.user.id,
          project_id: project.id,
          type: 'piutang',
          party_name: clientName.trim() || name.trim(),
          amount: remainingAmount,
          description: `Sisa pembayaran project ${name}`,
          status: 'pending',
        })

        if (receivableError) throw receivableError
      }

      // Success
      Alert.alert('Berhasil', 'Project berhasil ditambahkan', [
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
      console.error('Error creating project:', error)
      Alert.alert('Error', error.message || 'Gagal menambahkan project')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setName('')
    setClientName('')
    setType('alkes')
    setContractValue('')
    setDpAmount('')
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
            <Text style={styles.title}>Tambah Project Baru</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Nama Project */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Nama Project <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Contoh: Pengadaan Alkes RS XYZ"
                placeholderTextColor={COLORS.TEXT_LIGHT}
                editable={!loading}
              />
            </View>

            {/* Client Name */}
            <View style={styles.field}>
              <Text style={styles.label}>Nama Client</Text>
              <TextInput
                style={styles.input}
                value={clientName}
                onChangeText={setClientName}
                placeholder="Contoh: RS XYZ"
                placeholderTextColor={COLORS.TEXT_LIGHT}
                editable={!loading}
              />
            </View>

            {/* Type */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Jenis Project <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.typeGrid}>
                {PROJECT_TYPES.map((projectType) => (
                  <TouchableOpacity
                    key={projectType.value}
                    style={[
                      styles.typeButton,
                      type === projectType.value && styles.typeButtonActive,
                    ]}
                    onPress={() => setType(projectType.value)}
                    disabled={loading}
                  >
                    <Text style={styles.typeIcon}>{projectType.icon}</Text>
                    <Text
                      style={[
                        styles.typeLabel,
                        type === projectType.value && styles.typeLabelActive,
                      ]}
                    >
                      {projectType.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Contract Value */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Nilai Kontrak <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.currencyInput}>
                <Text style={styles.currencyPrefix}>Rp</Text>
                <TextInput
                  style={styles.currencyValue}
                  value={contractValue}
                  onChangeText={(text) => setContractValue(formatCurrency(text))}
                  placeholder="0"
                  placeholderTextColor={COLORS.TEXT_LIGHT}
                  keyboardType="numeric"
                  editable={!loading}
                />
              </View>
            </View>

            {/* DP Amount (Optional) */}
            <View style={styles.field}>
              <Text style={styles.label}>DP Awal (Opsional)</Text>
              <View style={styles.currencyInput}>
                <Text style={styles.currencyPrefix}>Rp</Text>
                <TextInput
                  style={styles.currencyValue}
                  value={dpAmount}
                  onChangeText={(text) => setDpAmount(formatCurrency(text))}
                  placeholder="0"
                  placeholderTextColor={COLORS.TEXT_LIGHT}
                  keyboardType="numeric"
                  editable={!loading}
                />
              </View>
              <Text style={styles.hint}>Jika sudah terima DP, masukkan nominalnya</Text>
            </View>
          </ScrollView>

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
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    minWidth: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  typeButtonActive: {
    backgroundColor: COLORS.PRIMARY + '10',
    borderColor: COLORS.PRIMARY,
  },
  typeIcon: {
    fontSize: 20,
  },
  typeLabel: {
    fontSize: 13,
    color: COLORS.TEXT,
    flex: 1,
  },
  typeLabelActive: {
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
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
    marginTop: 4,
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
