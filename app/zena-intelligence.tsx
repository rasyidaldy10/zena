import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Animated,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { ZenaNotification, AIInsight, AgentLog, NotificationType } from '../types'

const PRIMARY = '#185FA5'
const GREEN = '#1D9E75'
const RED = '#E24B4A'
const GRAY = '#888780'

const AGENTS = [
  { id: 'budget-monitor',        name: 'Budget Monitor',       icon: '🛡️', desc: 'Pantau pengeluaran vs budget' },
  { id: 'anomaly-detector',      name: 'Anomaly Detector',     icon: '🔍', desc: 'Deteksi pengeluaran tidak wajar' },
  { id: 'weekly-insight',        name: 'Weekly Insight',       icon: '📊', desc: 'Insight mingguan via AI' },
  { id: 'gmail-parser',          name: 'Gmail Parser',         icon: '📧', desc: 'Parse transaksi dari email bank' },
  { id: 'daily-summary',         name: 'Daily Summary',        icon: '📋', desc: 'Ringkasan harian jam 21.00' },
  { id: 'smart-categorization',  name: 'Smart Categorization', icon: '🏷️', desc: 'Kategorisasi otomatis transaksi' },
] as const

type AgentId = typeof AGENTS[number]['id']
type AgentStatus = 'active' | 'standby' | 'processing'

const TYPE_ICON: Record<NotificationType, string> = {
  budget_alert: '💰', anomaly: '🔍', weekly_insight: '📊',
  daily_summary: '📋', gmail: '📧', categorization: '🏷️',
}

const timeAgo = (dateStr: string): string => {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'baru saja'
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`
  return `${Math.floor(diff / 86400)} hari lalu`
}

function PulseDot({ status }: { status: AgentStatus }) {
  const anim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (status === 'standby') {
      anim.setValue(1)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.6, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [status, anim])

  const color = status === 'active' ? GREEN : status === 'processing' ? PRIMARY : GRAY

  return (
    <View style={dotStyles.wrap}>
      <Animated.View style={[dotStyles.dot, { backgroundColor: color, transform: [{ scale: anim }] }]} />
    </View>
  )
}

const dotStyles = StyleSheet.create({
  wrap: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
})

const getStatus = (logs: AgentLog[], agentId: string): AgentStatus => {
  const agentLogs = logs.filter(l => l.agent_name === agentId)
  if (!agentLogs.length) return 'standby'
  const diff = (Date.now() - new Date(agentLogs[0].created_at).getTime()) / 1000
  if (diff < 120) return 'processing'
  if (diff < 86400) return 'active'
  return 'standby'
}

const STATUS_LABEL: Record<AgentStatus, string> = {
  active: 'ACTIVE', standby: 'STANDBY', processing: 'PROCESSING',
}

export default function ZenaIntelligenceScreen() {
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [alerts, setAlerts] = useState<ZenaNotification[]>([])
  const [insights, setInsights] = useState<AIInsight[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)

  const fetchData = async () => {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const uid = session.user.id

    try {
      const [{ data: logsData }, { data: alertsData }, { data: insightsData }] = await Promise.all([
        supabase.from('agent_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(30),
        supabase.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(10),
        supabase.from('ai_insights').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(3),
      ])
      setLogs((logsData ?? []) as AgentLog[])
      setAlerts((alertsData ?? []) as ZenaNotification[])
      setInsights((insightsData ?? []) as AIInsight[])
    } catch {
      // Tables might not exist yet — user needs to run migration
    }
    setLoading(false)
  }

  useFocusEffect(useCallback(() => { fetchData() }, []))

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      channelRef.current = supabase
        .channel(`zena-intel-${session.user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`,
        }, (payload) => {
          setAlerts(prev => [payload.new as ZenaNotification, ...prev.slice(0, 9)])
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_logs',
          filter: `user_id=eq.${session.user.id}`,
        }, (payload) => {
          setLogs(prev => [payload.new as AgentLog, ...prev.slice(0, 29)])
        })
        .subscribe()
    })

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Kembali</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerZena}>ZENA</Text>
          <Text style={styles.headerSub}>Intelligence System</Text>
        </View>
        <View style={{ width: 80 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

          {/* Agent Cards */}
          <Text style={styles.sectionTitle}>6 Active Agents</Text>
          <View style={styles.agentGrid}>
            {AGENTS.map(agent => {
              const status = getStatus(logs, agent.id)
              const agentLogs = logs.filter(l => l.agent_name === agent.id).slice(0, 3)
              const lastLog = agentLogs[0]
              const statusColor = status === 'active' ? GREEN : status === 'processing' ? PRIMARY : GRAY
              return (
                <View key={agent.id} style={styles.agentCard}>
                  <View style={styles.agentCardTop}>
                    <View style={styles.agentIconWrap}>
                      <Text style={styles.agentIcon}>{agent.icon}</Text>
                    </View>
                    <View style={styles.agentStatusRow}>
                      <PulseDot status={status} />
                      <Text style={[styles.agentStatus, { color: statusColor }]}>{STATUS_LABEL[status]}</Text>
                    </View>
                  </View>
                  <Text style={styles.agentName}>{agent.name}</Text>
                  <Text style={styles.agentDesc}>{agent.desc}</Text>
                  <Text style={styles.agentLastRun}>
                    {lastLog ? `Terakhir: ${timeAgo(lastLog.created_at)}` : 'Belum pernah jalan'}
                  </Text>
                  {agentLogs.length > 0 && (
                    <View style={styles.agentLogs}>
                      {agentLogs.map((log, i) => (
                        <Text key={i} style={styles.agentLogItem} numberOfLines={1}>
                          · {log.result ?? log.action}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              )
            })}
          </View>

          {/* Live Alerts */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Live Alerts</Text>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>

          {alerts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Belum ada alert</Text>
            </View>
          ) : (
            alerts.map(notif => {
              const type = notif.type as NotificationType
              const icon = TYPE_ICON[type] ?? '🔔'
              return (
                <View key={notif.id} style={[styles.alertCard, !notif.is_read && styles.alertCardUnread]}>
                  <Text style={styles.alertIcon}>{icon}</Text>
                  <View style={styles.alertBody}>
                    <Text style={styles.alertTitle}>{notif.title}</Text>
                    <Text style={styles.alertMsg} numberOfLines={2}>{notif.message}</Text>
                    <Text style={styles.alertTime}>{timeAgo(notif.created_at)}</Text>
                  </View>
                  {!notif.is_read && <View style={styles.unreadDot} />}
                </View>
              )
            })
          )}

          {/* AI Insights */}
          <Text style={styles.sectionTitle}>AI Insights</Text>
          {insights.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Insight mingguan akan muncul setelah Weekly Insight Agent berjalan setiap Sabtu.</Text>
            </View>
          ) : (
            insights.map(insight => (
              <View key={insight.id} style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <Text style={styles.insightIcon}>📊</Text>
                  <Text style={styles.insightWeek}>Minggu {insight.week_start}</Text>
                </View>
                <Text style={styles.insightText}>{insight.insight_text}</Text>
              </View>
            ))
          )}

          {/* Migration Note */}
          <View style={styles.migrationNote}>
            <Text style={styles.migrationTitle}>⚙️ Setup Required</Text>
            <Text style={styles.migrationText}>
              Jalankan SQL migration di Supabase Dashboard → SQL Editor → buka file{' '}
              <Text style={styles.migrationCode}>supabase/migrations/001_zena_intelligence.sql</Text>
            </Text>
            <Text style={styles.migrationText}>
              Setup cron jobs di Supabase Dashboard → Edge Functions → Schedule:
              {'\n'}· Weekly Insight: sabtu 09.00 WIB (cron: "0 2 * * 6")
              {'\n'}· Daily Summary: setiap hari 21.00 WIB (cron: "0 14 * * *")
            </Text>
          </View>
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
  headerCenter: { alignItems: 'center' },
  headerZena: { fontSize: 24, fontWeight: '800', color: '#fff', letterSpacing: 4 },
  headerSub: { fontSize: 11, color: GRAY, letterSpacing: 2, marginTop: 2 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: GRAY, textTransform: 'uppercase',
    letterSpacing: 1.5, marginHorizontal: 16, marginTop: 24, marginBottom: 12,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginRight: 16 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: RED },
  liveText: { fontSize: 10, color: RED, fontWeight: '700', letterSpacing: 1 },
  agentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  agentCard: {
    width: '47%', backgroundColor: '#1A1A1A', borderRadius: 16,
    padding: 14, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  agentCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  agentIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  agentIcon: { fontSize: 18 },
  agentStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  agentStatus: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  agentName: { fontSize: 13, fontWeight: '700', color: '#fff', marginBottom: 3 },
  agentDesc: { fontSize: 10, color: GRAY, marginBottom: 8, lineHeight: 14 },
  agentLastRun: { fontSize: 10, color: '#555', marginBottom: 6 },
  agentLogs: { gap: 2 },
  agentLogItem: { fontSize: 10, color: '#444', lineHeight: 14 },
  alertCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14,
    marginHorizontal: 16, marginBottom: 8, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  alertCardUnread: { borderColor: PRIMARY + '60', backgroundColor: '#0D1A2E' },
  alertIcon: { fontSize: 20 },
  alertBody: { flex: 1 },
  alertTitle: { fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 3 },
  alertMsg: { fontSize: 12, color: GRAY, lineHeight: 17, marginBottom: 4 },
  alertTime: { fontSize: 10, color: '#555' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY, marginTop: 4 },
  insightCard: {
    backgroundColor: '#141420', borderRadius: 14, padding: 16,
    marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: '#534AB7' + '40',
  },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  insightIcon: { fontSize: 18 },
  insightWeek: { fontSize: 12, color: GRAY, fontWeight: '500' },
  insightText: { fontSize: 14, color: '#fff', lineHeight: 22 },
  emptyCard: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 20,
    marginHorizontal: 16, marginBottom: 8, borderWidth: 0.5, borderColor: '#2A2A2A',
  },
  emptyText: { fontSize: 13, color: GRAY, textAlign: 'center', lineHeight: 20 },
  migrationNote: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16,
    margin: 16, borderWidth: 1, borderColor: '#BA7517' + '50',
  },
  migrationTitle: { fontSize: 13, fontWeight: '700', color: '#BA7517', marginBottom: 8 },
  migrationText: { fontSize: 12, color: GRAY, lineHeight: 18, marginBottom: 6 },
  migrationCode: { fontFamily: 'monospace', color: '#fff' },
})
