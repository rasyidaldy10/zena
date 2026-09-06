import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { supabase } from '../lib/supabase'
import { confirmAsync, notify } from '../lib/alert'
import { Project, ProjectTerm, Transaction, UserWallet } from '../types'
import { getProjectTypeIcon, getProjectTypeLabel } from '../constants/business'
import { COLORS } from '../constants/theme'
import { formatRupiah } from '../lib/format'
import ModalTambahTermin from '../components/ModalTambahTermin'
import ModalPilihWallet from '../components/ModalPilihWallet'

export default function BusinessProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [terms, setTerms] = useState<ProjectTerm[]>([])
  const [expenses, setExpenses] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddTermModal, setShowAddTermModal] = useState(false)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [selectedTerm, setSelectedTerm] = useState<ProjectTerm | null>(null)

  useEffect(() => {
    if (id) {
      fetchProjectDetail()
    }
  }, [id])

  async function fetchProjectDetail() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .eq('user_id', session.user.id)
        .single()

      if (projectError) throw projectError

      // Fetch stats
      const { data: statsData } = await supabase.rpc('get_project_stats', {
        p_project_id: id,
      })

      setProject({
        ...projectData,
        ...(statsData?.[0] || {}),
      })

      // Fetch terms
      const { data: termsData, error: termsError } = await supabase
        .from('project_terms')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: true })

      if (termsError) throw termsError
      setTerms(termsData || [])

      // Fetch expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('transactions')
        .select('*')
        .eq('project_id', id)
        .eq('type', 'expense')
        .order('date', { ascending: false })

      if (expensesError) throw expensesError
      setExpenses(expensesData || [])
    } catch (error: any) {
      console.error('Error fetching project detail:', error)
      notify('Error', error.message || 'Gagal memuat detail project')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  function onRefresh() {
    setRefreshing(true)
    fetchProjectDetail()
  }

  function handleTandaiLunas(term: ProjectTerm) {
    setSelectedTerm(term)
    setShowWalletModal(true)
  }

  async function handleWalletSelected(wallet: UserWallet) {
    if (!selectedTerm) return

    setShowWalletModal(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')

      // 1. Update term paid_at
      const { error: termError } = await supabase
        .from('project_terms')
        .update({
          paid_at: new Date().toISOString(),
          wallet_id: wallet.id,
        })
        .eq('id', selectedTerm.id)

      if (termError) throw termError

      // 2. Insert transaction income
      const { error: transactionError } = await supabase.from('transactions').insert({
        user_id: session.user.id,
        amount: selectedTerm.amount,
        type: 'income',
        category: 'Bisnis',
        wallet_id: wallet.id,
        wallet_source: wallet.wallet_name,
        project_id: id,
        source: 'manual',
        is_categorized: true,
        note: `Pembayaran termin: ${selectedTerm.label}`,
        date: new Date().toISOString(),
      })

      if (transactionError) throw transactionError

      // 3. Update wallet balance
      const { error: walletError } = await supabase
        .from('user_wallets')
        .update({
          current_balance: wallet.current_balance + selectedTerm.amount,
        })
        .eq('id', wallet.id)

      if (walletError) throw walletError

      // 4. Check if all terms are paid → update receivable status
      const allTermsPaid = terms.every(
        (t) => t.id === selectedTerm.id || t.paid_at !== null
      )

      if (allTermsPaid) {
        const { error: receivableError } = await supabase
          .from('receivables')
          .update({
            status: 'lunas',
            settled_at: new Date().toISOString(),
          })
          .eq('project_id', id)
          .eq('type', 'piutang')

        if (receivableError) console.error('Error updating receivable:', receivableError)
      }

      notify('Berhasil', 'Termin berhasil ditandai lunas')
      fetchProjectDetail()
    } catch (error: any) {
      console.error('Error marking term as paid:', error)
      notify('Error', error.message || 'Gagal menandai termin lunas')
    } finally {
      setSelectedTerm(null)
    }
  }

  async function handleTandaiSelesai() {
    const ok = await confirmAsync(
      'Tandai Selesai',
      'Project akan ditandai selesai. Lanjutkan?',
      'Ya, Selesai'
    )
    if (!ok) return

    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'selesai' })
        .eq('id', id)
      if (error) throw error
      router.replace('/business-projects')
      setTimeout(() => notify('Berhasil', 'Project ditandai selesai'), 300)
    } catch (error: any) {
      notify('Error', error.message || 'Gagal menandai selesai')
    }
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    )
  }

  if (!project) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Project tidak ditemukan</Text>
      </View>
    )
  }

  const sisaPiutang = project.contract_value - (project.total_paid || 0)
  const progressPct = project.contract_value > 0
    ? ((project.total_paid || 0) / project.contract_value) * 100
    : 0

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: project.name,
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 12 }}>
              <Text style={{ fontSize: 15, color: COLORS.PRIMARY, fontWeight: '600' }}>‹ Kembali</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitle}>
              <Text style={styles.projectIcon}>{getProjectTypeIcon(project.type)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.projectName}>{project.name}</Text>
                {project.client_name && (
                  <Text style={styles.clientName}>{project.client_name}</Text>
                )}
              </View>
            </View>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    project.status === 'aktif'
                      ? COLORS.SUCCESS + '20'
                      : project.status === 'selesai'
                      ? COLORS.TEXT_LIGHT + '20'
                      : COLORS.WARNING + '20',
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      project.status === 'aktif'
                        ? COLORS.SUCCESS
                        : project.status === 'selesai'
                        ? COLORS.TEXT_LIGHT
                        : COLORS.WARNING,
                  },
                ]}
              >
                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              </Text>
            </View>
          </View>

          <Text style={styles.projectType}>{getProjectTypeLabel(project.type)}</Text>
        </View>

        {/* Detail Card — grid kompak 2 kolom, bukan baris besar satu-satu */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Detail Keuangan</Text>

          <View style={styles.statGrid}>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>Nilai Kontrak</Text>
              <Text style={styles.statValue}>{formatRupiah(project.contract_value)}</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>Total Dibayar</Text>
              <Text style={[styles.statValue, { color: COLORS.SUCCESS }]}>
                {formatRupiah(project.total_paid || 0)}
              </Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>Sisa Piutang</Text>
              <Text style={[styles.statValue, { color: COLORS.WARNING }]}>
                {formatRupiah(sisaPiutang)}
              </Text>
            </View>
            <View style={styles.statCell}>
              <Text style={styles.statLabel}>Total Pengeluaran</Text>
              <Text style={[styles.statValue, { color: COLORS.DANGER }]}>
                {formatRupiah(project.total_expense || 0)}
              </Text>
            </View>
          </View>

          <View style={styles.separator} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Estimasi Profit</Text>
            <Text
              style={[
                styles.detailValueBold,
                { color: (project.estimated_profit || 0) >= 0 ? COLORS.SUCCESS : COLORS.DANGER },
              ]}
            >
              {formatRupiah(project.estimated_profit || 0)}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Margin</Text>
            <Text
              style={[
                styles.detailValueBold,
                { color: (project.margin_pct || 0) >= 0 ? COLORS.SUCCESS : COLORS.DANGER },
              ]}
            >
              {(project.margin_pct || 0).toFixed(1)}%
            </Text>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Progress Pembayaran</Text>
              <Text style={styles.progressPct}>{progressPct.toFixed(0)}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${Math.min(progressPct, 100)}%` }]} />
            </View>
          </View>
        </View>

        {/* Termin Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Termin Pembayaran</Text>
            <TouchableOpacity onPress={() => setShowAddTermModal(true)}>
              <Text style={styles.addButton}>+ Termin</Text>
            </TouchableOpacity>
          </View>

          {terms.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada termin</Text>
          ) : (
            <View style={styles.termList}>
              {terms.map((term) => (
                <View key={term.id} style={styles.termItem}>
                  <View style={styles.termLeft}>
                    <Text style={styles.termLabel} numberOfLines={1}>{term.label}</Text>
                    {term.condition_text && (
                      <Text style={styles.termCondition} numberOfLines={1}>{term.condition_text}</Text>
                    )}
                  </View>
                  <Text style={styles.termAmount}>{formatRupiah(term.amount)}</Text>
                  {term.paid_at ? (
                    <View style={styles.paidBadge}>
                      <Text style={styles.paidText}>✓ Lunas</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.payButton}
                      onPress={() => handleTandaiLunas(term)}
                    >
                      <Text style={styles.payButtonText}>Bayar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Pengeluaran Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              Pengeluaran{expenses.length > 0 ? ` (${expenses.length})` : ''}
            </Text>
            <TouchableOpacity
              onPress={() =>
                router.push(`/tambah-transaksi?mode=business&project_id=${id}`)
              }
            >
              <Text style={styles.addButton}>+ Catat</Text>
            </TouchableOpacity>
          </View>

          {expenses.length === 0 ? (
            <Text style={styles.emptyText}>Belum ada pengeluaran</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.tableHeaderCell, styles.colDate]}>Tanggal</Text>
                <Text style={[styles.tableHeaderCell, styles.colNote]}>Keterangan</Text>
                <Text style={[styles.tableHeaderCell, styles.colAmount]}>Nominal</Text>
              </View>
              {expenses.map((expense) => (
                <TouchableOpacity
                  key={expense.id}
                  style={styles.tableRow}
                  onPress={() => router.push(`/edit-transaksi?id=${expense.id}`)}
                >
                  <Text style={[styles.tableCellDate, styles.colDate]}>
                    {new Date(expense.date).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </Text>
                  <Text style={[styles.tableCellNote, styles.colNote]} numberOfLines={1}>
                    {expense.note || expense.category}
                  </Text>
                  <Text style={[styles.tableCellAmount, styles.colAmount]} numberOfLines={1}>
                    {formatRupiah(expense.amount)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Buat Invoice dari project */}
        <TouchableOpacity
          style={styles.invoiceBtn}
          onPress={() => {
            const amount = sisaPiutang > 0 ? sisaPiutang : project.contract_value
            const q = new URLSearchParams({
              type: 'invoice',
              client: project.client_name || project.name,
              amount: String(Math.round(amount)),
              pname: project.name,
              project: id!,
            }).toString()
            router.push(`/document-form?${q}`)
          }}
        >
          <Text style={styles.invoiceBtnText}>🧾 Buat Invoice dari Project</Text>
        </TouchableOpacity>

        {/* Footer Actions */}
        {project.status === 'aktif' && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.footerButton, styles.completeButton]}
              onPress={handleTandaiSelesai}
            >
              <Text style={styles.footerButtonText}>✓ Tandai Selesai</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      <ModalTambahTermin
        visible={showAddTermModal}
        onClose={() => setShowAddTermModal(false)}
        onSuccess={fetchProjectDetail}
        projectId={id!}
      />

      <ModalPilihWallet
        visible={showWalletModal}
        onClose={() => {
          setShowWalletModal(false)
          setSelectedTerm(null)
        }}
        onSelect={handleWalletSelected}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
    gap: 8,
  },
  headerCard: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  projectIcon: {
    fontSize: 26,
  },
  projectName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.WHITE,
  },
  clientName: {
    fontSize: 11,
    color: COLORS.WHITE + 'CC',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  projectType: {
    fontSize: 11,
    color: COLORS.WHITE + 'AA',
  },
  card: {
    backgroundColor: COLORS.CARD,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  addButton: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.PRIMARY,
  },
  // Grid 2 kolom buat 4 angka utama — lebih rapat daripada satu baris per angka
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statCell: {
    width: '50%',
    paddingVertical: 6,
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.TEXT_LIGHT,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.TEXT,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  detailLabel: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
  },
  detailValueBold: {
    fontSize: 14,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.BORDER,
    marginVertical: 4,
  },
  progressContainer: {
    gap: 4,
    marginTop: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 11,
    color: COLORS.TEXT_LIGHT,
  },
  progressPct: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.PRIMARY,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: COLORS.BORDER,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY,
  },
  termList: {
    gap: 0,
  },
  termItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  termLeft: {
    flex: 1,
    gap: 1,
  },
  termLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  termCondition: {
    fontSize: 10,
    color: COLORS.TEXT_LIGHT,
  },
  termAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.PRIMARY,
  },
  paidBadge: {
    backgroundColor: COLORS.SUCCESS + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  paidText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.SUCCESS,
  },
  payButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  payButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  // Tabel pengeluaran: 1 baris ringkas per transaksi (tanggal | keterangan | nominal)
  table: {
    gap: 0,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.TEXT_LIGHT,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  colDate: { width: 44 },
  colNote: { flex: 1, paddingHorizontal: 6 },
  colAmount: { width: 98, textAlign: 'right' },
  tableCellDate: {
    fontSize: 11,
    color: COLORS.TEXT_LIGHT,
  },
  tableCellNote: {
    fontSize: 12,
    color: COLORS.TEXT,
  },
  tableCellAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.DANGER,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.TEXT_LIGHT,
    textAlign: 'center',
    paddingVertical: 12,
  },
  footer: {
    gap: 12,
    marginTop: 8,
  },
  footerButton: {
    backgroundColor: COLORS.CARD,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  completeButton: {
    backgroundColor: COLORS.SUCCESS + '10',
    borderColor: COLORS.SUCCESS,
  },
  footerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.SUCCESS,
  },
  invoiceBtn: {
    backgroundColor: COLORS.PRIMARY + '12',
    borderColor: COLORS.PRIMARY,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  invoiceBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.PRIMARY,
  },
})
