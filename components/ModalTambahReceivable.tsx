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
  Platform,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { notify } from '../lib/alert'
import { Project } from '../types'
import { COLORS } from '../constants/theme'

interface Props {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function ModalTambahReceivable({ visible, onClose, onSuccess }: Props) {
  const [type, setType] = useState<'piutang' | 'hutang'>('piutang')
  const [partyName, setPartyName] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (visible) {
      fetchProjects()
    }
  }, [visible])

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
    if (!partyName.trim()) {
      notify('Error', 'Nama pihak wajib diisi')
      return
    }

    const amountNum = parseFloat(amount.replace(/[^0-9]/g, '')) || 0
    if (amountNum <= 0) {
      notify('Error', 'Nominal harus lebih dari 0')
      return
    }

    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')

      const { error } = await supabase.from('receivables').insert({
        user_id: session.user.id,
        type,
        party_name: partyName.trim(),
        amount: amountNum,
        description: description.trim() || null,
        due_date: dueDate || null,
        project_id: selectedProjectId,
        status: 'pending',
      })

      if (error) throw error

      const label = type === 'piutang' ? 'Piutang' : 'Hutang'
      resetForm()
      onSuccess()
      onClose()
      notify('Berhasil', `${label} berhasil ditambahkan`)
    } catch (error: any) {
      console.error('Error creating receivable:', error)
      notify('Error', error.message || 'Gagal menambahkan')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setType('piutang')
    setPartyName('')
    setAmount('')
    setDescription('')
    setDueDate('')
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
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Tambah {type === 'piutang' ? 'Piutang' : 'Hutang'}</Text>
            <TouchableOpacity onPress={onClose} disabled={loading}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Type Toggle */}
            <View style={styles.field}>
              <Text style={styles.label}>Tipe</Text>
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    type === 'piutang' && styles.toggleButtonActive,
                  ]}
                  onPress={() => setType('piutang')}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      type === 'piutang' && styles.toggleTextActive,
                    ]}
                  >
                    📥 Piutang
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    type === 'hutang' && styles.toggleButtonActive,
                  ]}
                  onPress={() => setType('hutang')}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.toggleText,
                      type === 'hutang' && styles.toggleTextActive,
                    ]}
                  >
                    📤 Hutang
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Party Name */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Nama Pihak <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={partyName}
                onChangeText={setPartyName}
                placeholder={type === 'piutang' ? 'Nama customer/klien' : 'Nama supplier/vendor'}
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

            {/* Description */}
            <View style={styles.field}>
              <Text style={styles.label}>Keterangan</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Keterangan tambahan (opsional)"
                placeholderTextColor={COLORS.TEXT_LIGHT}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!loading}
              />
            </View>

            {/* Due Date */}
            <View style={styles.field}>
              <Text style={styles.label}>Jatuh Tempo (Opsional)</Text>
              <TextInput
                style={styles.input}
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="YYYY-MM-DD (contoh: 2026-12-31)"
                placeholderTextColor={COLORS.TEXT_LIGHT}
                editable={!loading}
              />
              <Text style={styles.hint}>Format: YYYY-MM-DD</Text>
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
                  {projects.map((project) => (
                    <TouchableOpacity
                      key={project.id}
                      style={[
                        styles.projectItem,
                        selectedProjectId === project.id && styles.projectItemActive,
                      ]}
                      onPress={() => setSelectedProjectId(project.id)}
                    >
                      <Text style={styles.projectText}>
                        {project.name}
                        {project.client_name && ` - ${project.client_name}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
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
  toggleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: COLORS.PRIMARY + '10',
    borderColor: COLORS.PRIMARY,
  },
  toggleText: {
    fontSize: 14,
    color: COLORS.TEXT,
  },
  toggleTextActive: {
    fontWeight: '600',
    color: COLORS.PRIMARY,
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
  hint: {
    fontSize: 11,
    color: COLORS.TEXT_LIGHT,
    marginTop: 4,
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
    paddingVertical: 12,
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
    backgroundColor: COLORS.PRIMARY,
  },
  buttonSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
})
