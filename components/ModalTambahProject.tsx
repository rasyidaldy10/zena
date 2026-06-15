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
import { ProjectType } from '../types'
import { PROJECT_TYPES } from '../constants/business'
import { COLORS } from '../constants/theme'

type BizWallet = { id: string; wallet_name: string; current_balance: number; icon: string }

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
  const [wallets, setWallets] = useState<BizWallet[]>([])
  const [dpWalletId, setDpWalletId] = useState('')
  const [loading, setLoading] = useState(false)
  // Jenis custom: yang sudah pernah dipakai (diingat dari riwayat) + input baru
  const [customTypes, setCustomTypes] = useState<string[]>([])
  const [writingCustom, setWritingCustom] = useState(false)
  const [customInput, setCustomInput] = useState('')

  const DEFAULT_TYPE_VALUES = PROJECT_TYPES.map((t) => t.value)

  // Ambil dompet bisnis + jenis project custom dari riwayat
  useEffect(() => {
    if (!visible) return
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data } = await supabase
        .from('user_wallets')
        .select('id, wallet_name, current_balance, icon')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .eq('wallet_function', 'business')
      if (data) setWallets(data)

      // jenis custom = type project lama yang bukan bawaan
      const { data: projs } = await supabase
        .from('projects')
        .select('type')
        .eq('user_id', session.user.id)
      const customs = Array.from(
        new Set((projs || []).map((p: any) => p.type).filter((t: string) => t && !DEFAULT_TYPE_VALUES.includes(t)))
      ) as string[]
      setCustomTypes(customs)
    })()
  }, [visible])

  async function handleSave() {
    if (!name.trim()) {
      notify('Error', 'Nama project wajib diisi')
      return
    }
    if (writingCustom && !customInput.trim()) {
      notify('Error', 'Tulis jenis project-nya dulu')
      return
    }

    const contractNum = parseFloat(contractValue.replace(/[^0-9]/g, '')) || 0
    if (contractNum <= 0) {
      notify('Error', 'Nilai kontrak harus lebih dari 0')
      return
    }

    const dpNum = parseFloat(dpAmount.replace(/[^0-9]/g, '')) || 0
    if (dpNum > contractNum) {
      notify('Error', 'DP tidak boleh lebih besar dari nilai kontrak')
      return
    }
    if (dpNum > 0 && !dpWalletId) {
      notify('Error', 'Pilih dompet tujuan DP dulu (uang DP masuk ke sini)')
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

      // 2. If DP > 0, create DP term (lunas) + transaksi PEMASUKAN + update saldo wallet
      if (dpNum > 0) {
        const { error: termError } = await supabase.from('project_terms').insert({
          project_id: project.id,
          label: 'DP',
          amount: dpNum,
          condition_text: 'Down Payment',
          paid_at: new Date().toISOString(),
          wallet_id: dpWalletId,
        })
        if (termError) throw termError

        // Transaksi pemasukan untuk DP (biar kecatat di laporan & saldo)
        const { error: txError } = await supabase.from('transactions').insert({
          user_id: session.user.id,
          amount: dpNum,
          type: 'income',
          category: 'Bisnis',
          wallet_id: dpWalletId,
          wallet_source: dpWalletId,
          project_id: project.id,
          source: 'manual',
          is_categorized: true,
          note: `DP project: ${name.trim()}`,
          date: new Date().toISOString(),
        })
        if (txError) throw txError

        // Update saldo wallet (+DP)
        const wallet = wallets.find(w => w.id === dpWalletId)
        if (wallet) {
          await supabase.from('user_wallets')
            .update({ current_balance: wallet.current_balance + dpNum })
            .eq('id', dpWalletId)
        }
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

      // Success — panggil callback LANGSUNG (jangan di dalam Alert onPress,
      // karena di web onPress tidak jalan → modal tak menutup)
      resetForm()
      onSuccess()
      onClose()
      notify('Berhasil', 'Project berhasil ditambahkan')
    } catch (error: any) {
      console.error('Error creating project:', error)
      notify('Error', error.message || 'Gagal menambahkan project')
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
    setDpWalletId('')
    setWritingCustom(false)
    setCustomInput('')
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
                      type === projectType.value && !writingCustom && styles.typeButtonActive,
                    ]}
                    onPress={() => { setWritingCustom(false); setType(projectType.value) }}
                    disabled={loading}
                  >
                    <Text style={styles.typeIcon}>{projectType.icon}</Text>
                    <Text
                      style={[
                        styles.typeLabel,
                        type === projectType.value && !writingCustom && styles.typeLabelActive,
                      ]}
                    >
                      {projectType.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                {/* Jenis custom yang diingat dari riwayat */}
                {customTypes.map((ct) => (
                  <TouchableOpacity
                    key={ct}
                    style={[styles.typeButton, type === ct && !writingCustom && styles.typeButtonActive]}
                    onPress={() => { setWritingCustom(false); setType(ct) }}
                    disabled={loading}
                  >
                    <Text style={styles.typeIcon}>📌</Text>
                    <Text style={[styles.typeLabel, type === ct && !writingCustom && styles.typeLabelActive]}>{ct}</Text>
                  </TouchableOpacity>
                ))}
                {/* Tulis sendiri */}
                <TouchableOpacity
                  style={[styles.typeButton, writingCustom && styles.typeButtonActive]}
                  onPress={() => { setWritingCustom(true); setType(customInput.trim()) }}
                  disabled={loading}
                >
                  <Text style={styles.typeIcon}>✏️</Text>
                  <Text style={[styles.typeLabel, writingCustom && styles.typeLabelActive]}>Tulis sendiri</Text>
                </TouchableOpacity>
              </View>
              {writingCustom && (
                <TextInput
                  style={styles.customTypeInput}
                  value={customInput}
                  onChangeText={(t) => { setCustomInput(t); setType(t.trim()) }}
                  placeholder="Ketik jenis project sendiri (mis. Renovasi)"
                  placeholderTextColor={COLORS.TEXT_LIGHT}
                  editable={!loading}
                  autoFocus
                />
              )}
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

            {/* Dompet tujuan DP — wajib kalau DP > 0 (uang DP masuk ke sini) */}
            {(parseFloat(dpAmount.replace(/[^0-9]/g, '')) || 0) > 0 && (
              <View style={styles.field}>
                <Text style={styles.label}>
                  DP Masuk ke Dompet <Text style={styles.required}>*</Text>
                </Text>
                {wallets.length === 0 ? (
                  <Text style={[styles.hint, { color: COLORS.DANGER }]}>
                    Belum ada dompet bisnis. Buat dulu di Profil (pilih "Bisnis").
                  </Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {wallets.map((w) => (
                      <TouchableOpacity
                        key={w.id}
                        style={[styles.walletPick, dpWalletId === w.id && styles.walletPickActive]}
                        onPress={() => setDpWalletId(w.id)}
                        disabled={loading}
                      >
                        <Text style={styles.walletPickText}>{w.icon} {w.wallet_name}</Text>
                        {dpWalletId === w.id && <Text style={styles.walletPickCheck}>✓</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
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
  customTypeInput: {
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.TEXT,
    marginTop: 8,
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
  walletPick: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND, borderWidth: 1, borderColor: COLORS.BORDER,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12,
  },
  walletPickActive: { backgroundColor: COLORS.PRIMARY + '10', borderColor: COLORS.PRIMARY },
  walletPickText: { fontSize: 14, color: COLORS.TEXT, fontWeight: '500' },
  walletPickCheck: { fontSize: 16, color: COLORS.PRIMARY, fontWeight: '700' },
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
