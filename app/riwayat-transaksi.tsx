import { useState, useEffect, useCallback, useRef } from 'react'
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ActivityIndicator, FlatList, RefreshControl, Platform,
} from 'react-native'
import { Stack, router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { Transaction, UserWallet } from '../types'
import { COLORS, RADIUS } from '../constants/theme'
import { formatMoney, amountInIDR } from '../lib/format'

const PAGE_SIZE = 50

type FlowFilter = 'all' | 'income' | 'expense' | 'transfer'

const FLOW_LABEL: Record<FlowFilter, string> = {
  all: 'Semua',
  income: 'Masuk',
  expense: 'Keluar',
  transfer: 'Transfer',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** Daftar 12 bulan terakhir sebagai opsi filter, plus opsi "semua waktu". */
function recentMonths(): { value: string; label: string }[] {
  const out = [{ value: '', label: 'Semua' }]
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({ value: v, label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` })
  }
  return out
}

export default function RiwayatTransaksiScreen() {
  const [rows, setRows] = useState<Transaction[]>([])
  const [wallets, setWallets] = useState<Record<string, UserWallet>>({})
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [done, setDone] = useState(false)

  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [flow, setFlow] = useState<FlowFilter>('all')
  const [month, setMonth] = useState('')

  const months = useRef(recentMonths()).current
  // Menandai permintaan terakhir; hasil permintaan lama diabaikan supaya
  // ketikan cepat tidak membuat daftar berkedip ke hasil yang sudah basi.
  const reqId = useRef(0)

  // Tunda pencarian 350ms supaya tidak menembak database tiap huruf.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 350)
    return () => clearTimeout(t)
  }, [query])

  async function fetchPage(offset: number) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { data: [] as Transaction[], eof: true }

    let q = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (flow === 'transfer') q = q.eq('is_wallet_transfer', true)
    else if (flow !== 'all') q = q.eq('type', flow).eq('is_wallet_transfer', false)

    if (month) {
      // Batas akhir dirakit sebagai teks, BUKAN lewat Date+toISOString: di zona
      // WIB konversi ke UTC memundurkan tanggal sehari, sehingga transaksi di
      // hari terakhir bulan itu diam-diam hilang dari hasil saring.
      const [y, m] = month.split('-').map(Number)
      const end = m === 12
        ? `${y + 1}-01-01`
        : `${y}-${String(m + 1).padStart(2, '0')}-01`
      q = q.gte('date', `${month}-01`).lt('date', end)
    }

    if (debounced) {
      const safe = debounced.replace(/[%,()]/g, ' ')
      q = q.or(`note.ilike.%${safe}%,category.ilike.%${safe}%`)
    }

    const { data, error } = await q
    if (error) return { data: [] as Transaction[], eof: true }
    const list = (data ?? []) as Transaction[]
    return { data: list, eof: list.length < PAGE_SIZE }
  }

  async function reload(isRefresh = false) {
    const id = ++reqId.current
    isRefresh ? setRefreshing(true) : setLoading(true)
    const { data, eof } = await fetchPage(0)
    if (id !== reqId.current) return
    setRows(data)
    setDone(eof)
    setLoading(false)
    setRefreshing(false)
  }

  async function loadMore() {
    if (loadingMore || done || loading) return
    const id = reqId.current
    setLoadingMore(true)
    const { data, eof } = await fetchPage(rows.length)
    if (id === reqId.current) {
      setRows(prev => [...prev, ...data])
      setDone(eof)
    }
    setLoadingMore(false)
  }

  useEffect(() => { reload() }, [debounced, flow, month])

  // Muat ulang saat kembali dari layar edit, supaya perubahan langsung terlihat.
  useFocusEffect(useCallback(() => { reload(true) }, [debounced, flow, month]))

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data } = await supabase
        .from('user_wallets')
        .select('id, wallet_name, icon, currency')
        .eq('user_id', session.user.id)
      const map: Record<string, UserWallet> = {}
      for (const w of (data ?? []) as UserWallet[]) map[w.id] = w
      setWallets(map)
    })()
  }, [])

  const totalIDR = rows.reduce(
    (s, t) => s + (t.is_wallet_transfer ? 0 : (t.type === 'income' ? 1 : -1) * amountInIDR(t)),
    0
  )

  function renderItem({ item }: { item: Transaction }) {
    const transfer = item.is_wallet_transfer
    const income = item.type === 'income'
    const wallet = item.wallet_id ? wallets[item.wallet_id] : undefined
    const d = new Date(item.date)

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.6}
        onPress={() => router.push(`/edit-transaksi?id=${item.id}`)}
      >
        <View style={styles.dateCol}>
          <Text style={styles.dateDay}>{String(d.getDate()).padStart(2, '0')}</Text>
          <Text style={styles.dateMon}>{MONTHS[d.getMonth()]}</Text>
        </View>

        <View style={styles.infoCol}>
          <Text style={styles.title} numberOfLines={1}>
            {transfer
              ? (income ? 'Transfer masuk' : 'Transfer keluar')
              : (item.note || item.category || 'Tanpa catatan')}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {[transfer ? 'Transfer' : item.category, wallet?.wallet_name]
              .filter(Boolean).join(' · ')}
          </Text>
        </View>

        <View style={styles.amountCol}>
          <Text
            style={[
              styles.amount,
              transfer ? styles.neutral : income ? styles.income : styles.expense,
            ]}
            numberOfLines={1}
          >
            {transfer ? '' : income ? '+' : '−'}{formatMoney(item.amount, item.currency)}
          </Text>
          {/* Untuk transaksi valas, nilai rupiah terkuncinya ikut ditampilkan
              supaya jelas berapa yang masuk ke laporan. */}
          {item.currency && item.currency !== 'IDR' && (
            <Text style={styles.amountIdr}>≈ {formatMoney(amountInIDR(item))}</Text>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Riwayat Transaksi',
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 12 }}>
              <Text style={styles.back}>‹ Kembali</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {/* Pencarian */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari catatan atau kategori..."
          placeholderTextColor={COLORS.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter arah uang */}
      <View style={styles.chipRow}>
        {(Object.keys(FLOW_LABEL) as FlowFilter[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, flow === f && styles.chipOn]}
            onPress={() => setFlow(f)}
          >
            <Text style={[styles.chipText, flow === f && styles.chipTextOn]}>
              {FLOW_LABEL[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filter bulan */}
      <FlatList
        horizontal
        data={months}
        keyExtractor={m => m.value || 'all'}
        showsHorizontalScrollIndicator={false}
        style={styles.monthBar}
        contentContainerStyle={styles.monthBarContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.mChip, month === item.value && styles.mChipOn]}
            onPress={() => setMonth(item.value)}
          >
            <Text style={[styles.mChipText, month === item.value && styles.mChipTextOn]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Ringkasan hasil saring */}
      {!loading && rows.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {rows.length}{done ? '' : '+'} transaksi
          </Text>
          <Text style={[
            styles.summaryNet,
            { color: totalIDR >= 0 ? COLORS.income : COLORS.expense },
          ]}>
            {totalIDR >= 0 ? '+' : '−'}{formatMoney(Math.abs(totalIDR))}
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={t => t.id}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} />
          }
          contentContainerStyle={rows.length === 0 ? { flex: 1 } : { paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={38} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>
                {debounced || month || flow !== 'all'
                  ? 'Tidak ada transaksi yang cocok dengan saringan ini'
                  : 'Belum ada transaksi'}
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
              : (done && rows.length > 0
                  ? <Text style={styles.endText}>· selesai ·</Text>
                  : null)
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  back: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.card, marginHorizontal: 12, marginTop: 12,
    paddingHorizontal: 12, height: 42, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1, fontSize: 14, color: COLORS.text,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },

  chipRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, marginTop: 10 },
  chip: {
    flex: 1, height: 32, borderRadius: RADIUS.pill, alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  chipTextOn: { color: '#fff' },

  monthBar: { flexGrow: 0, marginTop: 8 },
  monthBarContent: { paddingHorizontal: 12, gap: 6 },
  mChip: {
    paddingHorizontal: 12, height: 28, borderRadius: RADIUS.pill,
    justifyContent: 'center', backgroundColor: COLORS.card,
    borderWidth: 1, borderColor: COLORS.border,
  },
  mChipOn: { backgroundColor: COLORS.primary + '18', borderColor: COLORS.primary },
  mChipText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  mChipTextOn: { color: COLORS.primary },

  summary: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  summaryText: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  summaryNet: { fontSize: 12, fontWeight: '700' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, marginHorizontal: 12, marginBottom: 6,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: RADIUS.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  dateCol: { width: 34, alignItems: 'center' },
  dateDay: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  dateMon: { fontSize: 9, color: COLORS.textMuted, textTransform: 'uppercase' },
  infoCol: { flex: 1, paddingHorizontal: 10 },
  title: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  sub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  amountCol: { alignItems: 'flex-end' },
  amount: { fontSize: 13, fontWeight: '700' },
  amountIdr: { fontSize: 10, color: COLORS.textMuted, marginTop: 1 },
  income: { color: COLORS.income },
  expense: { color: COLORS.expense },
  neutral: { color: COLORS.textMuted },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  emptyText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 19 },
  endText: {
    textAlign: 'center', fontSize: 11, color: COLORS.textMuted,
    marginVertical: 14,
  },
})
