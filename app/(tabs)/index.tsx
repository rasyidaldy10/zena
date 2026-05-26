import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { router } from 'expo-router'

const PRIMARY = '#185FA5'

export default function DashboardScreen() {
  const [mode, setMode] = useState<'personal' | 'business'>('personal')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login')
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Selamat datang 👋</Text>
          <Text style={styles.appName}>Zena</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Keluar</Text>
        </TouchableOpacity>
      </View>

      {/* Mode Toggle */}
      <View style={styles.toggleWrap}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'personal' && styles.toggleBtnActive]}
          onPress={() => setMode('personal')}
        >
          <Text style={[styles.toggleText, mode === 'personal' && styles.toggleTextActive]}>
            Pribadi
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'business' && styles.toggleBtnActive]}
          onPress={() => setMode('business')}
        >
          <Text style={[styles.toggleText, mode === 'business' && styles.toggleTextActive]}>
            Bisnis
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>
            {mode === 'personal' ? 'Total saldo pribadi' : 'Total saldo bisnis'}
          </Text>
          <Text style={styles.balanceAmount}>Rp 0</Text>
          <Text style={styles.balanceSub}>Belum ada transaksi</Text>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Aksi cepat</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.qaBtn}>
            <Text style={styles.qaIcon}>➕</Text>
            <Text style={styles.qaLabel}>Catat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaBtn}>
            <Text style={styles.qaIcon}>📷</Text>
            <Text style={styles.qaLabel}>Scan struk</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaBtn}>
            <Text style={styles.qaIcon}>🎤</Text>
            <Text style={styles.qaLabel}>Voice</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaBtn}>
            <Text style={styles.qaIcon}>🤖</Text>
            <Text style={styles.qaLabel}>AI Chat</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Transactions */}
        <Text style={styles.sectionTitle}>Transaksi terakhir</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💸</Text>
          <Text style={styles.emptyText}>Belum ada transaksi</Text>
          <Text style={styles.emptySubtext}>Mulai catat pengeluaran pertamamu!</Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  greeting: { fontSize: 13, color: '#888780' },
  appName: { fontSize: 24, fontWeight: '600', color: '#FFFFFF', letterSpacing: -0.5 },
  logoutBtn: { padding: 8 },
  logoutText: { fontSize: 13, color: '#888780' },
  toggleWrap: {
    flexDirection: 'row',
    backgroundColor: '#1A1A1A',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: PRIMARY },
  toggleText: { fontSize: 13, color: '#888780', fontWeight: '500' },
  toggleTextActive: { color: '#fff', fontWeight: '600' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  balanceCard: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  balanceLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  balanceAmount: { fontSize: 32, fontWeight: '600', color: '#fff', letterSpacing: -1 },
  balanceSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#888780', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  quickActions: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  qaBtn: { flex: 1, backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 0.5, borderColor: '#2A2A2A' },
  qaIcon: { fontSize: 20, marginBottom: 6 },
  qaLabel: { fontSize: 11, color: '#888780', fontWeight: '500' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 15, color: '#FFFFFF', fontWeight: '500', marginBottom: 4 },
  emptySubtext: { fontSize: 13, color: '#888780' },
})