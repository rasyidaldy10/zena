import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { Stack, router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Project, ProjectStatus } from '../types'
import { getProjectTypeIcon } from '../constants/business'
import { COLORS } from '../constants/theme'
import { formatRupiah } from '../lib/format'
import ModalTambahProject from '../components/ModalTambahProject'

type FilterStatus = 'all' | ProjectStatus

export default function BusinessProjectsScreen() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      let query = supabase
        .from('projects')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error

      // Fetch stats for each project
      const projectsWithStats = await Promise.all(
        (data || []).map(async (project) => {
          const stats = await getProjectStats(project.id)
          return { ...project, ...stats }
        })
      )

      setProjects(projectsWithStats)
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  async function getProjectStats(projectId: string) {
    try {
      const { data, error } = await supabase.rpc('get_project_stats', {
        p_project_id: projectId,
      })

      if (error) throw error

      return data?.[0] || {
        total_paid: 0,
        total_expense: 0,
        estimated_profit: 0,
        margin_pct: 0,
      }
    } catch (error) {
      console.error('Error fetching project stats:', error)
      return {
        total_paid: 0,
        total_expense: 0,
        estimated_profit: 0,
        margin_pct: 0,
      }
    }
  }

  function onRefresh() {
    setRefreshing(true)
    fetchProjects()
  }

  function renderProjectCard({ item }: { item: Project }) {
    const progressPct = item.contract_value > 0
      ? ((item.total_paid || 0) / item.contract_value) * 100
      : 0

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/business-project-detail?id=${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitle}>
            <Text style={styles.projectIcon}>{getProjectTypeIcon(item.type)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.projectName} numberOfLines={1}>
                {item.name}
              </Text>
              {item.client_name && (
                <Text style={styles.clientName} numberOfLines={1}>
                  {item.client_name}
                </Text>
              )}
            </View>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  item.status === 'aktif'
                    ? COLORS.SUCCESS + '20'
                    : item.status === 'selesai'
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
                    item.status === 'aktif'
                      ? COLORS.SUCCESS
                      : item.status === 'selesai'
                      ? COLORS.TEXT_LIGHT
                      : COLORS.WARNING,
                },
              ]}
            >
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.row}>
            <Text style={styles.label}>Nilai Kontrak</Text>
            <Text style={styles.value}>{formatRupiah(item.contract_value)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Estimasi Profit</Text>
            <Text
              style={[
                styles.value,
                { color: (item.estimated_profit || 0) >= 0 ? COLORS.SUCCESS : COLORS.DANGER },
              ]}
            >
              {formatRupiah(item.estimated_profit || 0)}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Margin</Text>
            <Text
              style={[
                styles.value,
                { color: (item.margin_pct || 0) >= 0 ? COLORS.SUCCESS : COLORS.DANGER },
              ]}
            >
              {(item.margin_pct || 0).toFixed(1)}%
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress Pembayaran</Text>
            <Text style={styles.progressPct}>{progressPct.toFixed(0)}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.min(progressPct, 100)}%` }]} />
          </View>
          <Text style={styles.progressDetail}>
            {formatRupiah(item.total_paid || 0)} / {formatRupiah(item.contract_value)}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Projects',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 12 }}>
              <Text style={{ fontSize: 15, color: COLORS.PRIMARY, fontWeight: '600' }}>‹ Kembali</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={() => setShowAddModal(true)}>
              <Text style={styles.addButton}>+ Baru</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        {(['all', 'aktif', 'selesai', 'pending'] as FilterStatus[]).map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.chip, filter === status && styles.chipActive]}
            onPress={() => {
              setFilter(status)
              setLoading(true)
              setTimeout(() => fetchProjects(), 100)
            }}
          >
            <Text style={[styles.chipText, filter === status && styles.chipTextActive]}>
              {status === 'all' ? 'Semua' : status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Projects List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
        </View>
      ) : projects.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>Belum ada project</Text>
          <Text style={styles.emptySubtext}>
            Tap "+ Baru" untuk mulai tracking project bisnis kamu
          </Text>
        </View>
      ) : (
        <FlatList
          data={projects}
          renderItem={renderProjectCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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

      {/* Add Project Modal */}
      <ModalTambahProject
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchProjects}
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.CARD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  chipActive: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.TEXT,
  },
  chipTextActive: {
    color: COLORS.WHITE,
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
  card: {
    backgroundColor: COLORS.CARD,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  projectIcon: {
    fontSize: 24,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  clientName: {
    fontSize: 13,
    color: COLORS.TEXT_LIGHT,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: COLORS.TEXT_LIGHT,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  progressContainer: {
    gap: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 13,
    color: COLORS.TEXT_LIGHT,
  },
  progressPct: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.PRIMARY,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: COLORS.BORDER,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.PRIMARY,
  },
  progressDetail: {
    fontSize: 11,
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
