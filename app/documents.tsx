import { useState, useCallback } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { COLORS, RADIUS, SHADOW } from '../constants/theme'

const PRIMARY = COLORS.primary
const TEXT_MAIN = COLORS.text
const TEXT_MUTED = COLORS.textMuted
const CARD = COLORS.card
const BG_APP = COLORS.bg

type Doc = {
  id: string; doc_type: 'invoice' | 'quotation'; doc_number: string
  client_name: string | null; issue_date: string | null; total: number; status: string
}

const STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#8A93A6' },
  sent: { label: 'Terkirim', color: '#1763D6' },
  paid: { label: 'Lunas', color: '#16A06A' },
  approved: { label: 'Disetujui', color: '#16A06A' },
  rejected: { label: 'Ditolak', color: '#E5484D' },
}

export default function DocumentsScreen() {
  const params = useLocalSearchParams()
  const [tab, setTab] = useState<'invoice' | 'quotation'>(params.tab === 'quotation' ? 'quotation' : 'invoice')
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)

  useFocusEffect(useCallback(() => { fetchDocs() }, [tab]))

  async function fetchDocs() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('documents').select('id, doc_type, doc_number, client_name, issue_date, total, status')
      .eq('user_id', user?.id).eq('doc_type', tab).order('created_at', { ascending: false })
    setDocs((data || []) as Doc[])
    setLoading(false)
  }

  const fmt = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID')
  const unpaid = docs.filter(d => d.status !== 'paid' && d.status !== 'approved' && d.status !== 'rejected').reduce((s, d) => s + (d.total || 0), 0)
  const counts = docs.reduce((acc: Record<string, number>, d) => { acc[d.status] = (acc[d.status] || 0) + 1; return acc }, {})

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={TEXT_MAIN} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dokumen</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['invoice', 'quotation'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t === 'invoice' ? 'Invoice' : 'Penawaran'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {/* Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{tab === 'invoice' ? 'Total Belum Dibayar' : 'Total Penawaran Aktif'}</Text>
            <Text style={styles.summaryValue}>{fmt(unpaid)}</Text>
            <View style={styles.statusCounts}>
              {Object.entries(counts).map(([s, c]) => (
                <View key={s} style={styles.countChip}>
                  <View style={[styles.dot, { backgroundColor: STATUS[s]?.color || '#888' }]} />
                  <Text style={styles.countText}>{STATUS[s]?.label || s} {c}</Text>
                </View>
              ))}
            </View>
          </View>

          {docs.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={44} color={TEXT_MUTED} />
              <Text style={styles.emptyText}>Belum ada {tab === 'invoice' ? 'invoice' : 'penawaran'}</Text>
              <Text style={styles.emptySub}>Ketuk tombol + untuk membuat</Text>
            </View>
          ) : docs.map(d => {
            const st = STATUS[d.status] || STATUS.draft
            return (
              <View key={d.id} style={styles.docCard}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push(`/document-preview?id=${d.id}`)} activeOpacity={0.8}>
                  <View style={styles.docTop}>
                    <Text style={styles.docNumber}>{d.doc_number}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: st.color + '20' }]}>
                      <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.docClient}>{d.client_name || 'Tanpa klien'}</Text>
                  <View style={styles.docBottom}>
                    <Text style={styles.docDate}>{d.issue_date || '-'}</Text>
                    <Text style={styles.docTotal}>{fmt(d.total)}</Text>
                  </View>
                </TouchableOpacity>
                <View style={styles.docActions}>
                  <TouchableOpacity onPress={() => router.push(`/document-form?id=${d.id}`)} style={styles.docActionBtn}>
                    <Ionicons name="create-outline" size={18} color={PRIMARY} />
                    <Text style={styles.docActionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push(`/document-preview?id=${d.id}`)} style={styles.docActionBtn}>
                    <Ionicons name="eye-outline" size={18} color={PRIMARY} />
                    <Text style={styles.docActionText}>Lihat</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => router.push(`/document-form?type=${tab}`)} activeOpacity={0.85}>
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_APP },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12, backgroundColor: CARD,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: BG_APP },
  headerTitle: { fontSize: 17, fontWeight: '800', color: TEXT_MAIN },
  tabs: { flexDirection: 'row', backgroundColor: '#EAEEF4', borderRadius: RADIUS.md, padding: 4, margin: 16, marginBottom: 0, gap: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: 'center' },
  tabActive: { backgroundColor: PRIMARY, ...SHADOW.card },
  tabText: { fontSize: 13, fontWeight: '700', color: TEXT_MUTED },
  tabTextActive: { color: '#fff' },
  summaryCard: { backgroundColor: CARD, borderRadius: RADIUS.xl, padding: 18, ...SHADOW.card, marginBottom: 16 },
  summaryLabel: { fontSize: 12, color: TEXT_MUTED },
  summaryValue: { fontSize: 26, fontWeight: '800', color: TEXT_MAIN, marginTop: 4 },
  statusCounts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  countChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  countText: { fontSize: 12, color: TEXT_MUTED, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 50 },
  emptyText: { fontSize: 15, fontWeight: '700', color: TEXT_MAIN, marginTop: 10 },
  emptySub: { fontSize: 12, color: TEXT_MUTED, marginTop: 4 },
  docCard: { backgroundColor: CARD, borderRadius: RADIUS.lg, padding: 14, ...SHADOW.card, marginBottom: 12 },
  docTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  docNumber: { fontSize: 14, fontWeight: '800', color: TEXT_MAIN },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.pill },
  statusText: { fontSize: 11, fontWeight: '700' },
  docClient: { fontSize: 13, color: TEXT_MUTED, marginTop: 4 },
  docBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  docDate: { fontSize: 12, color: TEXT_MUTED },
  docTotal: { fontSize: 15, fontWeight: '800', color: TEXT_MAIN },
  docActions: { flexDirection: 'row', gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10 },
  docActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 6 },
  docActionText: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  fab: {
    position: 'absolute', right: 20, bottom: 24, width: 60, height: 60, borderRadius: 30,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
    shadowColor: PRIMARY, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
})
