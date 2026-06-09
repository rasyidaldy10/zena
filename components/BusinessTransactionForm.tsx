import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { supabase } from '../lib/supabase'
import { Product, UserWallet, Project, BusinessCategory, TransactionItem } from '../types'
import { COLORS } from '../constants/theme'
import { BUSINESS_CATEGORIES, PPN_TYPES } from '../constants/business'
import { formatRupiah } from '../lib/format'
import ItemKeranjangPicker from './ItemKeranjangPicker'

interface Props {
  onSuccess: () => void
  prefilledProjectId?: string | null
}

export default function BusinessTransactionForm({ onSuccess, prefilledProjectId }: Props) {
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [category, setCategory] = useState<BusinessCategory>('operasional')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [wallets, setWallets] = useState<UserWallet[]>([])
  const [selectedWalletId, setSelectedWalletId] = useState<string>('')
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(prefilledProjectId || null)
  const [loading, setLoading] = useState(false)

  // PPN states
  const [ppnEnabled, setPpnEnabled] = useState(false)
  const [ppnRate, setPpnRate] = useState(11)
  const [usePpn, setUsePpn] = useState(false)
  const [ppnType, setPpnType] = useState<'masukan' | 'keluaran'>('keluaran')
  const [ppnInclusive, setPpnInclusive] = useState(false)

  // Items (for penjualan)
  const [items, setItems] = useState<Array<TransactionItem & { product: Product }>>([])
  const [showItemPicker, setShowItemPicker] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    // Auto-set ppn_type based on transaction type
    if (type === 'income') {
      setPpnType('keluaran')
    } else {
      setPpnType('masukan')
    }
  }, [type])

  async function fetchData() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      // Fetch wallets
      const { data: walletsData } = await supabase
        .from('user_wallets')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      setWallets(walletsData || [])
      if (walletsData && walletsData.length > 0) {
        setSelectedWalletId(walletsData[0].id)
      }

      // Fetch projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('status', 'aktif')
        .order('created_at', { ascending: false })

      setProjects(projectsData || [])

      // Fetch user PPN settings
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('ppn_enabled, ppn_rate')
        .eq('user_id', session.user.id)
        .single()

      if (prefs) {
        setPpnEnabled(prefs.ppn_enabled || false)
        setPpnRate(prefs.ppn_rate || 11)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  function calculatePPN() {
    const baseAmount = parseFloat(amount.replace(/[^0-9]/g, '')) || 0

    if (!usePpn || baseAmount === 0) {
      return { ppnAmount: 0, dpp: baseAmount, total: baseAmount }
    }

    let ppnAmount = 0
    let dpp = baseAmount

    if (ppnInclusive) {
      // PPN sudah termasuk dalam amount
      dpp = baseAmount / (1 + ppnRate / 100)
      ppnAmount = baseAmount - dpp
    } else {
      // PPN ditambahkan di atas amount
      ppnAmount = baseAmount * (ppnRate / 100)
      dpp = baseAmount
    }

    const total = ppnInclusive ? baseAmount : baseAmount + ppnAmount

    return { ppnAmount, dpp, total }
  }

  function calculateItemsTotal() {
    return items.reduce((sum, item) => sum + item.subtotal, 0)
  }

  async function handleSave() {
    if (!selectedWalletId) {
      Alert.alert('Error', 'Pilih wallet terlebih dahulu')
      return
    }

    const selectedWallet = wallets.find(w => w.id === selectedWalletId)
    if (!selectedWallet) return

    // Determine final amount
    let finalAmount = 0
    let hasItems = false

    if (category === 'penjualan' && items.length > 0) {
      // Use items total
      finalAmount = calculateItemsTotal()
      hasItems = true
    } else {
      // Use manual amount
      finalAmount = parseFloat(amount.replace(/[^0-9]/g, '')) || 0
    }

    if (finalAmount <= 0) {
      Alert.alert('Error', 'Nominal harus lebih dari 0')
      return
    }

    const ppnCalc = usePpn ? calculatePPN() : { ppnAmount: 0, dpp: finalAmount, total: finalAmount }

    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')

      // 1. Insert transaction
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: session.user.id,
          amount: usePpn ? ppnCalc.total : finalAmount,
          type,
          category: BUSINESS_CATEGORIES.find(c => c.value === category)?.label || category,
          wallet_id: selectedWalletId,
          wallet_source: selectedWallet.wallet_name,
          project_id: selectedProjectId,
          business_category: category,
          has_items: hasItems,
          source: 'manual',
          is_categorized: true,
          note: note.trim() || `Transaksi bisnis - ${category}`,
          date: new Date().toISOString(),
          ppn_type: usePpn ? ppnType : null,
          ppn_amount: usePpn ? ppnCalc.ppnAmount : 0,
          amount_before_ppn: usePpn ? ppnCalc.dpp : 0,
          is_ppn_inclusive: usePpn ? ppnInclusive : false,
        })
        .select()
        .single()

      if (txError) throw txError

      // 2. If has items, insert transaction_items and update stock
      if (hasItems && items.length > 0) {
        for (const item of items) {
          // Insert transaction_item with HPP
          const { error: itemError } = await supabase.from('transaction_items').insert({
            transaction_id: transaction.id,
            product_id: item.product_id,
            qty: item.qty,
            price_per_unit: item.price_per_unit,
            subtotal: item.subtotal,
            hpp_per_unit: item.product.buy_price,
            hpp_total: item.qty * item.product.buy_price,
          })

          if (itemError) throw itemError

          // Insert stock_movement (out)
          const { error: stockError } = await supabase.from('stock_movements').insert({
            user_id: session.user.id,
            product_id: item.product_id,
            transaction_id: transaction.id,
            project_id: selectedProjectId,
            type: 'out',
            qty: item.qty,
            price_per_unit: item.price_per_unit, // sell price
            note: `Penjualan - ${transaction.note}`,
          })

          if (stockError) throw stockError

          // Update product stock_qty
          const { error: updateError } = await supabase
            .from('products')
            .update({
              stock_qty: item.product.stock_qty - item.qty,
            })
            .eq('id', item.product_id)

          if (updateError) throw updateError
        }
      }

      // 3. Update wallet balance
      const newBalance =
        type === 'income'
          ? selectedWallet.current_balance + (usePpn ? ppnCalc.total : finalAmount)
          : selectedWallet.current_balance - (usePpn ? ppnCalc.total : finalAmount)

      const { error: walletError } = await supabase
        .from('user_wallets')
        .update({ current_balance: newBalance })
        .eq('id', selectedWalletId)

      if (walletError) throw walletError

      // 4. If PPN enabled, upsert tax_summary
      if (usePpn && ppnCalc.ppnAmount > 0) {
        const txDate = new Date()
        const { error: taxError } = await supabase.rpc('upsert_tax_summary', {
          p_user_id: session.user.id,
          p_month: txDate.getMonth() + 1,
          p_year: txDate.getFullYear(),
          p_ppn_type: ppnType,
          p_ppn_amount: ppnCalc.ppnAmount,
        })

        if (taxError) console.error('Error updating tax summary:', taxError)
      }

      Alert.alert('Berhasil', 'Transaksi berhasil disimpan', [
        {
          text: 'OK',
          onPress: () => {
            onSuccess()
          },
        },
      ])
    } catch (error: any) {
      console.error('Error saving transaction:', error)
      Alert.alert('Error', error.message || 'Gagal menyimpan transaksi')
    } finally {
      setLoading(false)
    }
  }

  const ppnCalc = calculatePPN()
  const itemsTotal = calculateItemsTotal()

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Type Toggle */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tipe Transaksi</Text>
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, type === 'expense' && styles.toggleButtonActive]}
            onPress={() => setType('expense')}
          >
            <Text style={[styles.toggleText, type === 'expense' && styles.toggleTextActive]}>
              📤 Pengeluaran
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, type === 'income' && styles.toggleButtonActive]}
            onPress={() => setType('income')}
          >
            <Text style={[styles.toggleText, type === 'income' && styles.toggleTextActive]}>
              📥 Pemasukan
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Business Category */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Kategori Bisnis</Text>
        <View style={styles.categoryGrid}>
          {BUSINESS_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              style={[styles.categoryButton, category === cat.value && styles.categoryButtonActive]}
              onPress={() => setCategory(cat.value)}
            >
              <Text style={styles.categoryIcon}>{cat.icon}</Text>
              <Text
                style={[
                  styles.categoryLabel,
                  category === cat.value && styles.categoryLabelActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Items Keranjang (for penjualan) */}
      {category === 'penjualan' && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Produk yang Dijual</Text>
            <TouchableOpacity onPress={() => setShowItemPicker(true)}>
              <Text style={styles.addButton}>+ Tambah Produk</Text>
            </TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada produk. Tap "+ Tambah Produk"</Text>
          ) : (
            <View style={styles.itemsList}>
              {items.map((item, index) => (
                <View key={index} style={styles.itemCard}>
                  <View style={styles.itemLeft}>
                    <Text style={styles.itemName}>{item.product.name}</Text>
                    <Text style={styles.itemDetail}>
                      {item.qty} {item.product.unit} × {formatRupiah(item.price_per_unit)}
                    </Text>
                  </View>
                  <View style={styles.itemRight}>
                    <Text style={styles.itemTotal}>{formatRupiah(item.subtotal)}</Text>
                    <TouchableOpacity
                      onPress={() => setItems(items.filter((_, i) => i !== index))}
                    >
                      <Text style={styles.removeButton}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>Total Penjualan</Text>
                <Text style={styles.totalValue}>{formatRupiah(itemsTotal)}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Manual Amount (jika bukan penjualan atau tidak ada items) */}
      {(category !== 'penjualan' || items.length === 0) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nominal</Text>
          <View style={styles.currencyInput}>
            <Text style={styles.currencyPrefix}>Rp</Text>
            <TextInput
              style={styles.currencyValue}
              value={amount}
              onChangeText={(text) =>
                setAmount(text.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'))
              }
              placeholder="0"
              placeholderTextColor={COLORS.TEXT_LIGHT}
              keyboardType="numeric"
            />
          </View>
        </View>
      )}

      {/* PPN Section */}
      {ppnEnabled && (
        <View style={styles.section}>
          <View style={styles.ppnHeader}>
            <Text style={styles.sectionTitle}>PPN (Pajak)</Text>
            <TouchableOpacity
              style={[styles.ppnToggle, usePpn && styles.ppnToggleActive]}
              onPress={() => setUsePpn(!usePpn)}
            >
              <Text style={[styles.ppnToggleText, usePpn && styles.ppnToggleTextActive]}>
                {usePpn ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          {usePpn && (
            <>
              <View style={styles.ppnTypeRow}>
                {PPN_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.ppnTypeButton, ppnType === t.value && styles.ppnTypeButtonActive]}
                    onPress={() => setPpnType(t.value as 'masukan' | 'keluaran')}
                  >
                    <Text style={styles.ppnTypeIcon}>{t.icon}</Text>
                    <Text style={[styles.ppnTypeText, ppnType === t.value && styles.ppnTypeTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.inclusiveToggle}
                onPress={() => setPpnInclusive(!ppnInclusive)}
              >
                <View style={[styles.checkbox, ppnInclusive && styles.checkboxChecked]}>
                  {ppnInclusive && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.inclusiveLabel}>Harga sudah termasuk PPN</Text>
              </TouchableOpacity>

              <View style={styles.ppnCalc}>
                <View style={styles.ppnRow}>
                  <Text style={styles.ppnLabel}>DPP (Dasar Pengenaan Pajak)</Text>
                  <Text style={styles.ppnValue}>{formatRupiah(ppnCalc.dpp)}</Text>
                </View>
                <View style={styles.ppnRow}>
                  <Text style={styles.ppnLabel}>PPN {ppnRate}%</Text>
                  <Text style={[styles.ppnValue, { color: COLORS.WARNING }]}>
                    {formatRupiah(ppnCalc.ppnAmount)}
                  </Text>
                </View>
                <View style={[styles.ppnRow, styles.ppnRowTotal]}>
                  <Text style={styles.ppnLabelTotal}>Total</Text>
                  <Text style={styles.ppnValueTotal}>{formatRupiah(ppnCalc.total)}</Text>
                </View>
              </View>
            </>
          )}
        </View>
      )}

      {/* Note */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Catatan</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={note}
          onChangeText={setNote}
          placeholder="Catatan transaksi (opsional)"
          placeholderTextColor={COLORS.TEXT_LIGHT}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* Wallet */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wallet</Text>
        <View style={styles.walletList}>
          {wallets.map((wallet) => (
            <TouchableOpacity
              key={wallet.id}
              style={[
                styles.walletItem,
                selectedWalletId === wallet.id && styles.walletItemActive,
              ]}
              onPress={() => setSelectedWalletId(wallet.id)}
            >
              <Text style={styles.walletIcon}>{wallet.icon}</Text>
              <Text style={styles.walletName}>{wallet.wallet_name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Project */}
      {projects.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Link ke Project (Opsional)</Text>
          <View style={styles.projectList}>
            <TouchableOpacity
              style={[styles.projectItem, !selectedProjectId && styles.projectItemActive]}
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

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, loading && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.WHITE} />
        ) : (
          <Text style={styles.saveButtonText}>💾 Simpan Transaksi</Text>
        )}
      </TouchableOpacity>

      {/* Item Picker Modal */}
      {showItemPicker && (
        <ItemKeranjangPicker
          visible={showItemPicker}
          onClose={() => setShowItemPicker(false)}
          onAddItem={(item) => {
            setItems([...items, item])
            setShowItemPicker(false)
          }}
        />
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.TEXT,
    marginBottom: 12,
  },
  addButton: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.PRIMARY,
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
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  toggleText: {
    fontSize: 14,
    color: COLORS.TEXT,
  },
  toggleTextActive: {
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    width: '48%',
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryButtonActive: {
    backgroundColor: COLORS.PRIMARY + '10',
    borderColor: COLORS.PRIMARY,
  },
  categoryIcon: {
    fontSize: 20,
  },
  categoryLabel: {
    fontSize: 12,
    color: COLORS.TEXT,
    flex: 1,
  },
  categoryLabelActive: {
    fontWeight: '600',
    color: COLORS.PRIMARY,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.TEXT_LIGHT,
    textAlign: 'center',
    paddingVertical: 20,
  },
  itemsList: {
    gap: 8,
  },
  itemCard: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemLeft: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  itemDetail: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.SUCCESS,
  },
  removeButton: {
    fontSize: 16,
    color: COLORS.DANGER,
  },
  totalCard: {
    backgroundColor: COLORS.PRIMARY + '10',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
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
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginRight: 4,
  },
  currencyValue: {
    flex: 1,
    fontSize: 16,
    color: COLORS.TEXT,
    padding: 0,
  },
  ppnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ppnToggle: {
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  ppnToggleActive: {
    backgroundColor: COLORS.SUCCESS,
    borderColor: COLORS.SUCCESS,
  },
  ppnToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.TEXT_LIGHT,
  },
  ppnToggleTextActive: {
    color: COLORS.WHITE,
  },
  ppnTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  ppnTypeButton: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ppnTypeButtonActive: {
    backgroundColor: COLORS.WARNING + '10',
    borderColor: COLORS.WARNING,
  },
  ppnTypeIcon: {
    fontSize: 16,
  },
  ppnTypeText: {
    fontSize: 12,
    color: COLORS.TEXT,
    flex: 1,
  },
  ppnTypeTextActive: {
    fontWeight: '600',
    color: COLORS.WARNING,
  },
  inclusiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  checkmark: {
    fontSize: 12,
    color: COLORS.WHITE,
    fontWeight: '700',
  },
  inclusiveLabel: {
    fontSize: 13,
    color: COLORS.TEXT,
  },
  ppnCalc: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  ppnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ppnRowTotal: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  ppnLabel: {
    fontSize: 13,
    color: COLORS.TEXT_LIGHT,
  },
  ppnValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  ppnLabelTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  ppnValueTotal: {
    fontSize: 16,
    fontWeight: '700',
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
  walletList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  walletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.BACKGROUND,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  walletItemActive: {
    backgroundColor: COLORS.PRIMARY + '10',
    borderColor: COLORS.PRIMARY,
  },
  walletIcon: {
    fontSize: 16,
  },
  walletName: {
    fontSize: 13,
    color: COLORS.TEXT,
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
  saveButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 40,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.WHITE,
  },
})
