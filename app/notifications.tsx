import { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { supabase } from '../lib/supabase'
import { ZenaNotification, NotificationType } from '../types'

const PRIMARY = '#185FA5'

const TYPE_CONFIG: Record<NotificationType, { icon: string; color: string }> = {
  budget_alert:   { icon: '💰', color: '#E24B4A' },
  anomaly:        { icon: '🔍', color: '#BA7517' },
  weekly_insight: { icon: '📊', color: '#534AB7' },
  daily_summary:  { icon: '📋', color: '#185FA5' },
  gmail:          { icon: '📧', color: '#1D9E75' },
  categorization: { icon: '🏷️', color: '#888780' },
}

const timeAgo = (dateStr: string): string => {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'baru saja'
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`
  return `${Math.floor(diff / 86400)} hari lalu`
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<ZenaNotification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      setNotifications((data ?? []) as ZenaNotification[])
    } catch {
      setNotifications([])
    }
    setLoading(false)
  }

  useFocusEffect(useCallback(() => { fetchNotifications() }, []))

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const markAllRead = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', session.user.id).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const deleteNotif = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const handlePress = (notif: ZenaNotification) => {
    if (!notif.is_read) markRead(notif.id)
    Alert.alert(notif.title, notif.message, [{ text: 'Tutup' }])
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Kembali</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifikasi</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markAllText}>Baca Semua</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
      ) : notifications.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyText}>Belum ada notifikasi</Text>
          <Text style={styles.emptySub}>Alert dari Zena Intelligence akan muncul di sini</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount} belum dibaca</Text>
            </View>
          )}
          {notifications.map(notif => {
            const cfg = TYPE_CONFIG[notif.type as NotificationType] ?? TYPE_CONFIG.categorization
            return (
              <TouchableOpacity
                key={notif.id}
                style={[styles.notifCard, !notif.is_read && styles.notifCardUnread]}
                onPress={() => handlePress(notif)}
                activeOpacity={0.7}
              >
                <View style={[styles.notifIcon, { backgroundColor: cfg.color + '20' }]}>
                  <Text style={styles.notifEmoji}>{cfg.icon}</Text>
                </View>
                <View style={styles.notifBody}>
                  <Text style={[styles.notifTitle, !notif.is_read && styles.notifTitleUnread]}>
                    {notif.title}
                  </Text>
                  <Text style={styles.notifMsg} numberOfLines={2}>{notif.message}</Text>
                  <Text style={styles.notifTime}>{timeAgo(notif.created_at)}</Text>
                </View>
                <View style={styles.notifActions}>
                  {!notif.is_read && <View style={[styles.unreadDot, { backgroundColor: cfg.color }]} />}
                  <TouchableOpacity onPress={() => deleteNotif(notif.id)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F0F' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 0.5, borderBottomColor: '#2A2A2A',
  },
  backBtn: { width: 80 },
  backText: { fontSize: 14, color: PRIMARY },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  markAllText: { fontSize: 13, color: PRIMARY, fontWeight: '500', width: 80, textAlign: 'right' },
  scroll: { flex: 1, paddingHorizontal: 16 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 8 },
  emptySub: { fontSize: 13, color: '#888780', textAlign: 'center', paddingHorizontal: 32 },
  unreadBadge: {
    backgroundColor: '#1A1A1A', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    alignSelf: 'flex-start', marginTop: 12, marginBottom: 4,
  },
  unreadBadgeText: { fontSize: 12, color: PRIMARY, fontWeight: '600' },
  notifCard: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 14,
    marginTop: 8, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  notifCardUnread: { borderColor: PRIMARY + '60', backgroundColor: '#0D1A2E' },
  notifIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifEmoji: { fontSize: 20 },
  notifBody: { flex: 1 },
  notifTitle: { fontSize: 14, fontWeight: '500', color: '#888780', marginBottom: 4 },
  notifTitleUnread: { color: '#fff', fontWeight: '700' },
  notifMsg: { fontSize: 13, color: '#888780', lineHeight: 18, marginBottom: 6 },
  notifTime: { fontSize: 11, color: '#555' },
  notifActions: { alignItems: 'center', gap: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 14, color: '#555' },
})
