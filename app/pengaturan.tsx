import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { confirmAsync, notify } from '../lib/alert'
import { clearChatHistory } from '../lib/chatHistory'
import { COLORS, RADIUS, SHADOW } from '../constants/theme'

const PRIMARY = COLORS.primary
const TEXT_MAIN = COLORS.text
const TEXT_MUTED = COLORS.textMuted
const CARD = COLORS.card
const BG_APP = COLORS.bg

type Item = { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; danger?: boolean }

export default function PengaturanScreen() {
  const soon = (f: string) => notify(f, 'Fitur ini segera hadir.')

  const handleLogout = async () => {
    const ok = await confirmAsync('Keluar dari Zena?', 'Kamu perlu login lagi untuk mengakses akunmu.', 'Keluar')
    if (!ok) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await clearChatHistory(user.id)
      await supabase.auth.signOut()
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.href = '/'
      else router.replace('/(auth)/login')
    } catch { notify('Error', 'Gagal logout. Coba lagi.') }
  }

  const items: Item[] = [
    { icon: 'person-outline', label: 'Profil Saya', onPress: () => router.push('/(tabs)/profil') },
    { icon: 'shield-checkmark-outline', label: 'Keamanan (PIN & Biometrik)', onPress: () => soon('Keamanan') },
    { icon: 'notifications-outline', label: 'Notifikasi', onPress: () => router.push('/notifications') },
    { icon: 'swap-horizontal-outline', label: 'Mode & Aplikasi (Pribadi & Bisnis)', onPress: () => router.push('/(tabs)/profil') },
    { icon: 'cloud-upload-outline', label: 'Backup & Sinkronisasi', onPress: () => soon('Backup & Sinkronisasi') },
    { icon: 'help-circle-outline', label: 'Bantuan & Dukungan', onPress: () => soon('Bantuan & Dukungan') },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={TEXT_MAIN} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pengaturan</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {items.map((it, i) => (
            <TouchableOpacity
              key={it.label}
              style={[styles.row, i === items.length - 1 && { borderBottomWidth: 0 }]}
              onPress={it.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.rowIcon}><Ionicons name={it.icon} size={20} color={PRIMARY} /></View>
              <Text style={styles.rowLabel}>{it.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.logoutText}>Keluar Akun</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Zena · versi 1.0</Text>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_APP },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, backgroundColor: CARD,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: BG_APP },
  headerTitle: { fontSize: 17, fontWeight: '800', color: TEXT_MAIN },
  card: { backgroundColor: CARD, borderRadius: RADIUS.lg, ...SHADOW.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: PRIMARY + '12', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: TEXT_MAIN },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.danger + '12', borderRadius: RADIUS.lg, paddingVertical: 15, marginTop: 18 },
  logoutText: { fontSize: 15, fontWeight: '700', color: COLORS.danger },
  version: { fontSize: 12, color: TEXT_MUTED, textAlign: 'center', marginTop: 24 },
})
