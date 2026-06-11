import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native'
import { Stack } from 'expo-router'
import { supabase } from '../lib/supabase'
import { confirmAsync, notify } from '../lib/alert'
import { Receivable } from '../types'
import { COLORS } from '../constants/theme'
import { formatRupiah, formatDate } from '../lib/format'
import ModalTambahReceivable from '../components/ModalTambahReceivable'

type SectionData = {
  title: string
  data: Receivable[]
}

export default function BusinessReceivablesScreen() {
  const [receivables, setReceivables] = useState<Receivable[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    fetchReceivables()
  }, [])

  async function fetchReceivables() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data, error } = await supabase
        .from('receivables')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setReceivables(data || [])
    } catch (error) {
      console.error('Error fetching receivables:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  function onRefresh() {
    setRefreshing(true)
    fetchReceivables()
  }

  async function handleTandaiLunas(receivable: Receivable) {
    const label = receivable.type === 'piutang' ? 'Piutang' : 'Hutang'
    const ok = await confirmAsync(
      'Tandai Lunas',
      `${label} dari ${receivable.party_name} sebesar ${formatRupiah(receivable.amount)} akan ditandai lunas. Lanjutkan?`,
      'Ya, Lunas'
    )
    if (!ok) return

    try {
      const { error } = await supabase
        .from('receivables')
        .update({ status: 'lunas', settled_at: new Date().toISOString() })
        .eq('id', receivable.id)
      if (error) throw error
      notify('Berhasil', `${label} ditandai lunas`)
      fetchReceivables()
    } catch (error: any) {
      notify('Error', error.message || 'Gagal menandai lunas')
    }
  }

  async function handleDelete(receivable: Receivable) {
    const ok = await confirmAsync(
      'Hapus',
      `Hapus ${receivable.type === 'piutang' ? 'piutang' : 'hutang'} ini?`,
      'Hapus'
    )
    if (!ok) return

    try {
      const { error } = await supabase
        .from('receivables')
        .delete()
        .eq('id', receivable.id)
      if (error) throw error
      notify('Berhasil', 'Data berhasil dihapus')
      fetchReceivables()
    } catch (error: any) {
      notify('Error', error.message || 'Gagal menghapus')
    }
  }

  function handleKirimReminder(receivable: Receivable) {
    if (receivable.type !== 'piutang') {
      Alert.alert('Info', 'Reminder hanya untuk piutang')
      return
    }

    const message = `Halo ${receivable.party_name}, mengingatkan pembayaran sebesar ${formatRupiah(receivable.amount)}${receivable.due_date ? ` jatuh tempo ${formatDate(receivable.due_date)}` : ''}. Terima kasih - Zena Finance`

    const url = `whatsapp://send?text=${encodeURIComponent(message)}`

    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url)
      } else {
        Alert.alert('Error', 'WhatsApp tidak terinstall')
      }
    })
  }

  // Calculate totals
  const piutangPending = receivables
    .filter(r => r.type === 'piutang' && r.status === 'pending')
    .reduce((sum, r) => sum + r.amount, 0)

  const hutangPending = receivables
    .filter(r => r.type === 'hutang' && r.status === 'pending')
    .reduce((sum, r) => sum + r.amount, 0)

  const netReceivable = piutangPending - hutangPending

  // Prepare sections
  const sections: SectionData[] = [
    {
      title: `Piutang (${receivables.filter(r => r.type === 'piutang' && r.status === 'pending').length})`,
      data: receivables.filter(r => r.type === 'piutang' && r.status === 'pending'),
    },
    {
      title: `Hutang (${receivables.filter(r => r.type === 'hutang' && r.status === 'pending').length})`,
      data: receivables.filter(r => r.type === 'hutang' && r.status === 'pending'),
    },
    {
      title: 'Riwayat Lunas',
      data: receivables.filter(r => r.status === 'lunas'),
    },
  ].filter(section => section.data.length > 0)

  function renderReceivableItem({ item }: { item: Receivable }) {
    const isOverdue = item.due_date && new Date(item.due_date) < new Date() && item.status === 'pending'

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitle}>
            <Text style={styles.partyName}>{item.party_name}</Text>
            {item.due_date && item.status === 'pending' && (
              <Text
                style={[
                  styles.dueDate,
                  isOverdue && styles.dueDateOverdue,
                ]}
              >
                {isOverdue ? '⚠️ Jatuh tempo: ' : 'Jatuh tempo: '}
                {formatDate(item.due_date)}
              </Text>
            )}
          </View>
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor:
                  item.type === 'piutang'
                    ? COLORS.SUCCESS + '20'
                    : COLORS.WARNING + '20',
              },
            ]}
          >
            <Text
              style={[
                styles.typeText,
                {
                  color: item.type === 'piutang' ? COLORS.SUCCESS : COLORS.WARNING,
                },
              ]}
            >
              {item.type === 'piutang' ? '📥 Piutang' : '📤 Hutang'}
            </Text>
          </View>
        </View>

        {item.description && (
          <Text style={styles.description}>{item.description}</Text>
        )}

        <Text
          style={[
            styles.amount,
            { color: item.type === 'piutang' ? COLORS.SUCCESS : COLORS.WARNING },
          ]}
        >
          {formatRupiah(item.amount)}
        </Text>

        {item.status === 'pending' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
              onPress={() => handleTandaiLunas(item)}
            >
              <Text style={styles.actionButtonText}>✓ Tandai Lunas</Text>
            </TouchableOpacity>

            {item.type === 'piutang' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonSecondary]}
                onPress={() => handleKirimReminder(item)}
              >
                <Text style={styles.actionButtonTextSecondary}>📱 Kirim Reminder</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonDanger]}
              onPress={() => handleDelete(item)}
            >
              <Text style={styles.actionButtonTextDanger}>🗑️</Text>
            </TouchableOpacity>
          </View>
        )}

        {item.status === 'lunas' && (
          <View style={styles.settledInfo}>
            <View style={styles.settledBadge}>
              <Text style={styles.settledText}>✓ Lunas</Text>
            </View>
            {item.settled_at && (
              <Text style={styles.settledDate}>
                {formatDate(item.settled_at)}
              </Text>
            )}
          </View>
        )}
      </View>
    )
  }

  function renderSectionHeader({ section }: { section: SectionData }) {
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Piutang & Hutang',
          headerRight: () => (
            <TouchableOpacity onPress={() => setShowAddModal(true)}>
              <Text style={styles.addButton}>+ Baru</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {/* Summary Header */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Piutang</Text>
            <Text style={[styles.summaryValue, { color: COLORS.SUCCESS }]}>
              {formatRupiah(piutangPending)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Hutang</Text>
            <Text style={[styles.summaryValue, { color: COLORS.WARNING }]}>
              {formatRupiah(hutangPending)}
            </Text>
          </View>
        </View>
        <View style={styles.summaryNet}>
          <Text style={styles.summaryNetLabel}>Net</Text>
          <Text
            style={[
              styles.summaryNetValue,
              { color: netReceivable >= 0 ? COLORS.SUCCESS : COLORS.DANGER },
            ]}
          >
            {formatRupiah(netReceivable)}
          </Text>
        </View>
      </View>

      {/* Receivables List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      ) : receivables.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>💰</Text>
          <Text style={styles.emptyText}>Belum ada piutang atau hutang</Text>
          <Text style={styles.emptySubtext}>
            Tap "+ Baru" untuk mulai tracking
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          renderItem={renderReceivableItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* Floating Action Button - always visible */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Receivable Modal */}
      <ModalTambahReceivable
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchReceivables}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  addButton: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.PRIMARY,
    marginRight: 16,
  },
  summaryCard: {
    backgroundColor: COLORS.CARD,
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
  },
  summaryItem: {
    flex: 1,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: COLORS.BORDER,
  },
  summaryNet: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  summaryNetLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  summaryNetValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.TEXT_LIGHT,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.TEXT,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: COLORS.CARD,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    flex: 1,
    gap: 4,
  },
  partyName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  dueDate: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
  },
  dueDateOverdue: {
    color: COLORS.DANGER,
    fontWeight: '600',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  description: {
    fontSize: 13,
    color: COLORS.TEXT_LIGHT,
  },
  amount: {
    fontSize: 20,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionButtonPrimary: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  actionButtonSecondary: {
    backgroundColor: COLORS.BACKGROUND,
    borderColor: COLORS.BORDER,
  },
  actionButtonDanger: {
    backgroundColor: COLORS.BACKGROUND,
    borderColor: COLORS.BORDER,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.WHITE,
  },
  actionButtonTextSecondary: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  actionButtonTextDanger: {
    fontSize: 14,
  },
  settledInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settledBadge: {
    backgroundColor: COLORS.SUCCESS + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  settledText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.SUCCESS,
  },
  settledDate: {
    fontSize: 12,
    color: COLORS.TEXT_LIGHT,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  fabText: {
    fontSize: 32,
    color: '#fff',
    fontWeight: '600',
  },
})
